/** Capture production game scenes in isolated Edge profiles.
 * --baseline writes the previous built UI to a separate baseline directory.
 * No SDK/storage mocks or product QA globals are installed.
 */
import { chromium, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import os from 'node:os';
import crypto from 'node:crypto';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';

const baseline = process.argv.includes('--baseline');
const foxOnly = process.argv.includes('--fox-only');
const moduleFilter = process.argv.find(value => value.startsWith('--module='))?.slice('--module='.length);
const address = process.argv.find(value => /^https?:\/\//.test(value)) ?? 'http://127.0.0.1:5180/';
const target = new URL(address);
const output = new URL(`../docs/V37_games_qa/${baseline ? 'baseline/' : ''}`, import.meta.url);
await fs.mkdir(output, { recursive: true });
// Use the preserved seed only as a read-only answer oracle. Play and storage
// still run through actual production DOM controls and GameSDK callbacks.
const seedSource = await fs.readFile(new URL('../src/core/seed.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(seedSource, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { BUILTIN_PACKS } = await import(`data:text/javascript;charset=utf-8,${encodeURIComponent(compiled)}`);
const packs = {
  'math-quest': BUILTIN_PACKS.find(pack => pack.id === 'math3-adventure'),
  'memory-match': BUILTIN_PACKS.find(pack => pack.id === 'english3-family'),
  'sentence-builder': BUILTIN_PACKS.find(pack => pack.id === 'english3-sentences'),
};
const browser = await chromium.launch({ channel: 'msedge' });
const evidence = {
  date: new Date().toISOString(), target: target.href, baseline, browser: browser.version(),
  os: `${os.type()} ${os.release()}`, cpu: os.cpus()[0]?.model,
  seedHash: crypto.createHash('sha256').update(seedSource).digest('hex'),
  note: 'Isolated desktop Edge contexts. Touch viewports are desktop emulation, not physical-device GPU measurements. Seed answers are read-only; attempts/completion are performed by the real game UI. Renderer FPS is a rolling-window sample.',
  views: [], resources: [], bundles: [], errors: [], video: null,
};
const definitions = [
  { width: 1440, height: 900, touch: false },
  { width: 390, height: 844, touch: true },
  { width: 320, height: 640, touch: true },
];

async function exportFoxPortrait() {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  let productionModule = '';
  page.on('response', response => {
    if (/\/assets\/PremiumWorldRenderer-[^/]+\.js(?:\?|$)/.test(response.url())) productionModule = response.url();
  });
  try {
    await page.goto(target.href, { waitUntil: 'networkidle' });
    await page.locator('.ba3d-render-host[data-state="ready"][data-engine="three-webgl"]').waitFor({ timeout: 20000 });
    if (!productionModule) throw new Error('No observed production renderer chunk for fox export');
    await page.getByRole('button', { name: /Góc phụ huynh/ }).click();
    const result = await page.evaluate(async moduleUrl => {
      const { createPremiumRenderer } = await import(moduleUrl);
      const canvas = document.createElement('canvas');
      canvas.style.cssText = 'position:fixed;left:-2000px;top:0;width:640px;height:768px;pointer-events:none';
      document.body.append(canvas);
      const signal = new AbortController();
      const runtime = await createPremiumRenderer({ canvas, signal: signal.signal, quality: 'high', motionOn: false, paused: false, onSelect() {}, onContextLost() {} });
      try {
        runtime.setPaused(true);
        const scene = runtime.world.scene;
        for (const child of scene.children) child.visible = child.isLight || child === runtime.guideAnchor;
        scene.background = null; scene.fog = null;
        runtime.guideAnchor.position.set(0, 0, 0);
        runtime.guideAnchor.scale.setScalar(1);
        runtime.guideAnchor.quaternion.identity();
        runtime.mascot.mixer.getRoot().scale.setScalar(1);
        runtime.mascot.play('Idle', false); runtime.mascot.mixer.setTime(.35);
        runtime.camera.aspect = 640 / 768;
        runtime.camera.position.set(0, 1.15, 6.2);
        runtime.camera.lookAt(0, 1.15, 0);
        runtime.camera.updateProjectionMatrix(); runtime.camera.updateMatrixWorld();
        runtime.renderer.setClearColor(0x000000, 0);
        runtime.renderer.render(scene, runtime.camera);
        const dataUrl = canvas.toDataURL('image/webp', .9);
        const decoded = await new Promise((resolve, reject) => {
          const picture = new Image(); picture.onload = () => resolve(picture); picture.onerror = reject; picture.src = dataUrl;
        });
        const verification = document.createElement('canvas'); verification.width = 640; verification.height = 768;
        const twoD = verification.getContext('2d'); twoD.drawImage(decoded, 0, 0);
        const pixels = twoD.getImageData(0, 0, 640, 768).data;
        let left = 640, top = 768, right = -1, bottom = -1, opaquePixels = 0;
        for (let y = 0; y < 768; y++) for (let x = 0; x < 640; x++) {
          if (pixels[(y * 640 + x) * 4 + 3] > 8) { left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y); opaquePixels++; }
        }
        const cornerAlpha = [0, 639, 767 * 640, 768 * 640 - 1].map(index => pixels[index * 4 + 3]);
        return { dataUrl, width: 640, height: 768, alphaBounds: { left, top, right, bottom }, cornerAlpha, opaquePixels, animation: 'Idle at 0.35s', renderer: moduleUrl };
      } finally { runtime.dispose(); signal.abort(); canvas.remove(); }
    }, productionModule);
    if (result.cornerAlpha.some(alpha => alpha !== 0) || result.opaquePixels < 10000 || result.alphaBounds.left < 12 || result.alphaBounds.top < 12 || result.alphaBounds.right > 628 || result.alphaBounds.bottom > 756) throw new Error(`Fox portrait has clipped or invalid transparent pixels: ${JSON.stringify({ ...result, dataUrl: undefined })}`);
    const buffer = Buffer.from(result.dataUrl.split(',')[1], 'base64');
    const destination = new URL('../public/art/fox-guide-common.webp', import.meta.url);
    await fs.writeFile(destination, buffer);
    const source = await fs.readFile(new URL('../public/models/fox-guide.glb', import.meta.url));
    const provenance = { date: new Date().toISOString(), source: 'public/models/fox-guide.glb', sourceSha256: crypto.createHash('sha256').update(source).digest('hex'), output: 'public/art/fox-guide-common.webp', outputSha256: crypto.createHash('sha256').update(buffer).digest('hex'), bytes: buffer.length, ...result, dataUrl: undefined };
    await fs.writeFile(new URL('fox-portrait-provenance.json', output), `${JSON.stringify(provenance, null, 2)}\n`);
    console.log(`Exported shared fox portrait: ${buffer.length} bytes, bounds ${JSON.stringify(result.alphaBounds)}, source SHA256 ${provenance.sourceSha256}`);
  } finally { await context.close(); }
}

if (foxOnly) {
  try { await exportFoxPortrait(); }
  finally { await browser.close(); }
  process.exit(0);
}

async function layout(page) {
  return page.evaluate(() => {
    const rect = element => {
      if (!element) return null;
      const box = element.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height };
    };
    const reward = document.querySelector('.reward-panel');
    const controls = [...document.querySelectorAll(reward ? '.reward-panel button' : '.immersive-dialog button, .immersive-dialog select')].map(element => {
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      const shown = box.width > 0 && box.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
      const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
      return {
        text: element.getAttribute('aria-label') ?? element.textContent?.trim(), rect: rect(element), shown,
        outsideViewport: shown && (box.x < -1 || box.y < -1 || box.right > innerWidth + 1 || box.bottom > innerHeight + 1),
        receivesPointer: shown && (hit === element || !!hit && element.contains(hit)),
        primaryTouchTarget: element.matches('.answer-option, .result-next, .memory-card, .word-tile, .sentence-actions button, .reward-home, .game-dialog-head button'),
      };
    });
    const host = document.querySelector('.ba3d-render-host');
    const shell = document.querySelector('.immersive-dialog') ?? document.querySelector('.app-shell');
    return {
      viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth || document.body.scrollWidth > innerWidth,
      controls,
      sections: Object.fromEntries(['.immersive-dialog', '.game-dialog-head', '.world-hud', '.challenge-card', '.forest-board', '.sentence-scroll', '.world-guide', '.forest-guide', '.sentence-guide', '.reward-panel', '.ba37-game-scene-slot', '.ba37-mascot-window'].map(selector => [selector, rect(document.querySelector(selector))])),
      canvasCount: document.querySelectorAll('canvas.ba3d-canvas').length,
      canvasRect: rect(document.querySelector('canvas.ba3d-canvas')),
      canvasInGameSlot: !!document.querySelector('.ba37-game-scene-slot canvas.ba3d-canvas'),
      engine: host?.getAttribute('data-engine'), state: host?.getAttribute('data-state'),
      gameEngine: shell?.getAttribute('data-scene-engine'), gameState: shell?.getAttribute('data-scene-state'),
      diagnostics: JSON.parse(document.querySelector('canvas.ba3d-canvas')?.getAttribute('data-diagnostics') ?? host?.getAttribute('data-diagnostics') ?? '{}'),
      sceneImages: [...document.querySelectorAll('.immersive-dialog img')].map(image => ({ src: image.getAttribute('src'), alt: image.alt, decoded: image.complete && image.naturalWidth > 0, rect: rect(image) })),
    };
  });
}

async function capture(page, definition, moduleId, state, errors) {
  if (!baseline) {
    const mood = { waiting: 'idle', correct: 'happy', retry: 'encourage', reward: 'victory' }[state];
    await page.waitForFunction(expected => {
      const diagnostics = JSON.parse(document.querySelector('canvas.ba3d-canvas')?.getAttribute('data-diagnostics') ?? document.querySelector('.ba3d-render-host')?.getAttribute('data-diagnostics') ?? '{}');
      return diagnostics.sceneMode === 'game' && diagnostics.gameWorld === expected.moduleId && diagnostics.guideMood === expected.mood;
    }, { moduleId, mood }, { timeout: 15000 });
  }
  await page.waitForTimeout(state === 'reward' ? 600 : 250);
  const name = `${moduleId}-${state}-${definition.width}x${definition.height}`;
  const value = await layout(page);
  await page.screenshot({ path: fileURLToPath(new URL(`${name}.png`, output)) });
  evidence.views.push({ name, moduleId, stateName: state, emulatedTouch: definition.touch, screenshot: `${name}.png`, ...value, errors: [...errors] });
  console.log(`${baseline ? 'baseline ' : ''}${name}: ${value.engine}/${value.state}, game ${value.diagnostics.gameWorld ?? 'none'}, mood ${value.diagnostics.guideMood ?? 'none'}, FPS ${value.diagnostics.fpsMedian ?? '?'}, overflow ${value.horizontalOverflow}, outside ${value.controls.filter(control => control.outsideViewport).length}, blocked ${value.controls.filter(control => !control.receivesPointer).length}`);
}

async function beginVideo(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('canvas.ba3d-canvas');
    const type = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find(value => MediaRecorder.isTypeSupported(value));
    if (!canvas?.captureStream || !type) return false;
    const stream = canvas.captureStream(30);
    const recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 2800000 });
    const chunks = [];
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    window.__gameCapture = { recorder, chunks, stream, type };
    recorder.start(200); return true;
  });
}

async function finishVideo(page) {
  const recording = await page.evaluate(async () => {
    const value = window.__gameCapture;
    if (!value) return null;
    await new Promise(resolve => { value.recorder.onstop = resolve; value.recorder.stop(); });
    value.stream.getTracks().forEach(track => track.stop());
    const blob = new Blob(value.chunks, { type: value.type });
    return { bytes: Array.from(new Uint8Array(await blob.arrayBuffer())), mimeType: value.type };
  });
  if (!recording) return;
  await fs.writeFile(new URL('shared-games-demo.webm', output), Buffer.from(recording.bytes));
  evidence.video = { file: 'shared-games-demo.webm', bytes: recording.bytes.length, mimeType: recording.mimeType,
    note: 'The same persistent canvas transitions from home through Math, Memory, Sentence scenes and back. The recording contains 3D environments and guide reactions; HTML game controls and reward cards are shown in the screenshots.' };
}

async function mathStates(page, definition, errors) {
  const pack = packs['math-quest'];
  await capture(page, definition, 'math-quest', 'waiting', errors);
  await page.locator('.answer-option').nth((pack.items[0].correctIndex + 1) % 4).click();
  await expect(page.locator('.feedback-retry')).toBeVisible();
  await capture(page, definition, 'math-quest', 'retry', errors);
  await page.locator('.result-next').click();
  for (let index = 1; index < pack.items.length; index++) {
    await expect(page.locator('.quiz-question')).toHaveText(pack.items[index].prompt);
    await page.locator('.answer-option').nth(pack.items[index].correctIndex).click();
    await expect(page.locator('.feedback-win')).toBeVisible();
    if (index === 1) await capture(page, definition, 'math-quest', 'correct', errors);
    await page.locator('.result-next').click();
  }
  await expect(page.locator('.reward-panel')).toBeVisible();
  await capture(page, definition, 'math-quest', 'reward', errors);
}

async function memoryStates(page, definition, errors) {
  const pack = packs['memory-match'];
  const card = label => page.locator('.memory-card').filter({ has: page.getByText(label, { exact: true }) });
  await capture(page, definition, 'memory-match', 'waiting', errors);
  await card(pack.items[0].left).click();
  await card(pack.items[1].left).click();
  await expect(page.locator('.memory-feedback-message')).toContainText(/chưa khớp/i);
  await capture(page, definition, 'memory-match', 'retry', errors);
  await expect(page.locator('.memory-card:not(:disabled)')).toHaveCount(12);
  for (let index = 0; index < pack.items.length; index++) {
    await card(pack.items[index].left).click();
    await card(pack.items[index].right).click();
    await expect(page.locator('.memory-card.found')).toHaveCount((index + 1) * 2);
    if (index === 0) await capture(page, definition, 'memory-match', 'correct', errors);
  }
  await expect(page.locator('.reward-panel')).toBeVisible();
  await capture(page, definition, 'memory-match', 'reward', errors);
}

async function sentenceStates(page, definition, errors) {
  const pack = packs['sentence-builder'];
  const word = label => page.locator('.sentence-bank').getByRole('button', { name: label, exact: true });
  await capture(page, definition, 'sentence-builder', 'waiting', errors);
  for (const label of [...pack.items[0].words].reverse()) await word(label).click();
  await page.getByRole('button', { name: /Kiểm tra câu/ }).click();
  await expect(page.locator('.feedback-retry')).toBeVisible();
  await capture(page, definition, 'sentence-builder', 'retry', errors);
  await page.locator('.sentence-main-action').click();
  for (let index = 0; index < pack.items.length; index++) {
    await expect(page.locator('.sentence-prompt')).toHaveText(pack.items[index].prompt);
    for (const label of pack.items[index].words) await word(label).click();
    await page.getByRole('button', { name: /Kiểm tra câu/ }).click();
    await expect(page.locator('.feedback-win')).toBeVisible();
    if (index === 0) await capture(page, definition, 'sentence-builder', 'correct', errors);
    await page.locator('.sentence-main-action').click();
  }
  await expect(page.locator('.reward-panel')).toBeVisible();
  await capture(page, definition, 'sentence-builder', 'reward', errors);
}

try {
  for (const definition of definitions) {
    const context = await browser.newContext({ viewport: { width: definition.width, height: definition.height }, hasTouch: definition.touch, isMobile: definition.touch, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push({ type: 'pageerror', message: error.message }));
    page.on('requestfailed', request => errors.push({ type: 'requestfailed', url: request.url(), message: request.failure()?.errorText }));
    page.on('response', response => { if (response.status() >= 400) errors.push({ type: 'http', status: response.status(), url: response.url() }); });
    page.on('request', request => { if (/\.(?:glb|webp|png)(?:\?|$)/.test(request.url())) evidence.resources.push({ viewport: definition.width, url: request.url() }); });
    page.on('request', request => { if (/\/assets\/[^/]+\.js(?:\?|$)/.test(request.url())) evidence.bundles.push({ viewport: definition.width, url: request.url() }); });
    try {
      await page.goto(target.href, { waitUntil: 'networkidle' });
      await page.locator('.ba3d-render-host[data-state="ready"][data-engine="three-webgl"]').waitFor({ timeout: 20000 });
      await page.waitForTimeout(2500);
      let recording = false;
      if (!baseline && !definition.touch) {
        try { recording = await beginVideo(page); }
        catch (error) { evidence.video = { unavailable: String(error) }; }
      }
      for (const [id, states] of [['math-quest', mathStates], ['memory-match', memoryStates], ['sentence-builder', sentenceStates]]) {
        if (moduleFilter && id !== moduleFilter) continue;
        await page.locator(`.ba3d-${id} .ba3d-play`).click();
        await expect(page.locator('.immersive-dialog')).toBeVisible();
        await states(page, definition, errors);
        await page.locator('.reward-home').click();
        await expect(page.locator('.immersive-dialog')).toHaveCount(0);
      }
      if (recording) { await page.waitForTimeout(800); await finishVideo(page); }
    } catch (error) { evidence.errors.push({ viewport: definition, message: String(error), pageErrors: errors }); }
    finally { await context.close(); }
  }
} finally { await browser.close(); }

await fs.writeFile(new URL('game-browser-evidence.json', output), `${JSON.stringify(evidence, null, 2)}\n`);
const rows = evidence.views.map(view => `| ${view.name} | ${view.diagnostics.gameWorld ?? 'none'} | ${view.diagnostics.guideMood ?? 'none'} | ${view.diagnostics.fpsMedian ?? 'n/a'} | ${view.canvasCount} | ${view.horizontalOverflow ? 'FAIL' : 'PASS'} | ${view.controls.filter(control => control.outsideViewport || !control.receivesPointer).length} | ${view.emulatedTouch ? view.controls.filter(control => control.primaryTouchTarget && control.rect.height < 44).length : 'n/a'} | ${view.errors.length} |`).join('\n');
await fs.writeFile(new URL('capture-summary.md', output), `# V3.7 ${baseline ? 'baseline' : 'shared 3D'} game capture\n\nCaptured ${evidence.date}, Edge ${evidence.browser}.\n\n${evidence.note}\n\n| View | Game scene | Guide mood | Renderer FPS | Canvas count | Horizontal overflow | Outside/blocked controls | Primary touch targets below 44px | Page/resource errors |\n|---|---|---|---:|---:|---|---:|---:|---:|\n${rows}\n\nScreenshots require visual review. Baseline captures preserve the built UI before this in-game 3D update.\n`);
const failures = evidence.views.filter(view => view.horizontalOverflow || view.controls.some(control => control.outsideViewport || !control.receivesPointer || view.emulatedTouch && control.primaryTouchTarget && control.rect.height < 44) || view.errors.length);
if (evidence.errors.length || evidence.views.length !== definitions.length * (moduleFilter ? 4 : 12) || failures.length) process.exitCode = 1;
