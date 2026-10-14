/** Compare the actual production world before/after PR03 textured assets.
 * Isolated Edge profiles; no storage mocks or product globals.
 */
import { chromium, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const baseline = process.argv.includes('--baseline');
const target = new URL(process.argv.find(value => /^https?:\/\//.test(value)) ?? 'http://127.0.0.1:5180/');
const output = new URL(`../docs/V37_art_qa/${baseline ? 'baseline/' : ''}`, import.meta.url);
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge' });
const evidence = { date: new Date().toISOString(), target: target.href, baseline, browser: browser.version(),
  os: `${os.type()} ${os.release()}`, cpu: os.cpus()[0]?.model,
  note: 'Production Edge, isolated contexts. Mobile viewport/touch emulation uses the desktop GPU. Renderer FPS is a rolling-window sample. Baseline preserves the previous two-GLB build before PR03 assets.',
  views: [], requests: [], bundles: [], errors: [], video: null,
};
const worlds = ['math-quest', 'memory-match', 'sentence-builder'];
const definitions = [{ width: 1440, height: 900, touch: false }, { width: 390, height: 844, touch: true }, { width: 320, height: 640, touch: true }];

async function layout(page, game) {
  return page.evaluate(inGame => {
    const rect = element => {
      if (!element) return null;
      const box = element.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height };
    };
    const controls = [...document.querySelectorAll(inGame ? '.immersive-dialog button, .immersive-dialog select' : '.ba3d-world-name, .ba3d-island-control select, .ba3d-play, .ba3d-overview-reset, .top-navigation button')].map(element => {
      const box = element.getBoundingClientRect(), style = getComputedStyle(element);
      const shown = box.width > 0 && box.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
      const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
      return { text: element.getAttribute('aria-label') ?? element.textContent?.trim(), rect: rect(element), shown,
        outsideViewport: shown && (box.x < -1 || box.y < -1 || box.right > innerWidth + 1 || box.bottom > innerHeight + 1),
        receivesPointer: shown && (hit === element || !!hit && element.contains(hit)),
        primaryTouchTarget: element.matches('.ba3d-island-control button, .ba3d-island-control select, .ba3d-overview-reset, .answer-option, .result-next, .memory-card, .word-tile, .sentence-actions button, .game-dialog-head button'),
      };
    });
    const host = document.querySelector('.ba3d-render-host'), canvas = host?.querySelector('canvas');
    const gl = canvas?.getContext('webgl2'), debug = gl?.getExtension('WEBGL_debug_renderer_info');
    return { viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth || document.body.scrollWidth > innerWidth,
      controls, canvasCount: document.querySelectorAll('canvas.ba3d-canvas').length,
      canvasInGameSlot: !!document.querySelector('.ba37-game-scene-slot canvas.ba3d-canvas'),
      engine: host?.getAttribute('data-engine'), state: host?.getAttribute('data-state'),
      diagnostics: JSON.parse(canvas?.getAttribute('data-diagnostics') ?? host?.getAttribute('data-diagnostics') ?? '{}'),
      renderer: debug && gl ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : 'unavailable',
      sections: Object.fromEntries(['.ba3d-render-host', '.ba3d-hero-title', '.ba3d-island-overview', '.ba3d-anchors', '.immersive-dialog', '.challenge-card', '.forest-board', '.sentence-scroll', '.ba37-mascot-window'].map(selector => [selector, rect(document.querySelector(selector))])),
    };
  }, game);
}

async function settled(page, selected) {
  await page.waitForFunction(id => {
    const stats = JSON.parse(document.querySelector('canvas.ba3d-canvas')?.getAttribute('data-diagnostics') ?? '{}');
    return stats.sceneMode === 'home' && stats.selectedWorld === id && stats.carouselMoving === false
      && stats.mascotLocation === (id ?? 'waiting') && stats.mascotState === (id ? 'on-island' : 'waiting');
  }, selected, { timeout: 15000 });
}

async function shot(page, definition, name, game, errors, runtimeSamples) {
  await page.waitForTimeout(650);
  const file = `${name}-${definition.width}x${definition.height}`;
  const value = await layout(page, game);
  await page.screenshot({ path: fileURLToPath(new URL(`${file}.png`, output)) });
  evidence.views.push({ name: file, scenario: name, game, screenshot: `${file}.png`, emulatedTouch: definition.touch, ...value, errors: [...errors], runtimeSamples });
  console.log(`${baseline ? 'baseline ' : ''}${file}: ${value.engine}, assets ${value.diagnostics.readyAssets?.length}, FPS ${value.diagnostics.fpsMedian ?? '?'}, triangles ${value.diagnostics.triangles ?? '?'}, overflow ${value.horizontalOverflow}, outside ${value.controls.filter(control => control.outsideViewport).length}, blocked ${value.controls.filter(control => !control.receivesPointer).length}`);
}

async function videoStart(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('canvas.ba3d-canvas');
    const type = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find(value => MediaRecorder.isTypeSupported(value));
    if (!canvas?.captureStream || !type) return false;
    const stream = canvas.captureStream(30), chunks = [];
    const recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 3000000 });
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    window.__artCapture = { stream, chunks, recorder, type }; recorder.start(200); return true;
  });
}
async function videoStop(page) {
  const result = await page.evaluate(async () => {
    const value = window.__artCapture; if (!value) return null;
    await new Promise(resolve => { value.recorder.onstop = resolve; value.recorder.stop(); });
    value.stream.getTracks().forEach(track => track.stop());
    return { type: value.type, bytes: Array.from(new Uint8Array(await new Blob(value.chunks, { type: value.type }).arrayBuffer())) };
  });
  if (!result) return;
  await fs.writeFile(new URL('art-world-demo.webm', output), Buffer.from(result.bytes));
  evidence.video = { file: 'art-world-demo.webm', bytes: result.bytes.length, mimeType: result.type,
    note: 'Canvas only: entrance, three rotating selections, each game scene and return. HTML controls are shown in screenshots.' };
}

try {
  for (const definition of definitions) {
    const context = await browser.newContext({ viewport: { width: definition.width, height: definition.height }, hasTouch: definition.touch, isMobile: definition.touch, deviceScaleFactor: 1 });
    const page = await context.newPage(), errors = [];
    let inflight = 0, maxInflight = 0;
    page.on('pageerror', error => errors.push({ type: 'pageerror', message: error.message }));
    page.on('request', request => {
      if (/\/models\/[^/]+\.glb(?:\?|$)/.test(request.url())) { inflight++; maxInflight = Math.max(maxInflight, inflight); evidence.requests.push({ viewport: definition.width, url: request.url() }); }
      if (/\/assets\/[^/]+\.js(?:\?|$)/.test(request.url())) evidence.bundles.push({ viewport: definition.width, url: request.url() });
    });
    page.on('requestfinished', request => { if (/\/models\/[^/]+\.glb(?:\?|$)/.test(request.url())) inflight--; });
    page.on('requestfailed', request => {
      if (/\/models\/[^/]+\.glb(?:\?|$)/.test(request.url())) inflight--;
      errors.push({ type: 'requestfailed', url: request.url(), message: request.failure()?.errorText });
    });
    page.on('response', response => { if (response.status() >= 400) errors.push({ type: 'http', status: response.status(), url: response.url() }); });
    try {
      await page.goto(target.href, { waitUntil: 'networkidle' });
      await page.locator('.ba3d-render-host[data-state="ready"][data-engine="three-webgl"]').waitFor({ timeout: 25000 });
      await settled(page, null); await page.waitForTimeout(2500);
      const samples = [];
      for (let index = 0; index < 3; index++) { samples.push((await layout(page, false)).diagnostics); await page.waitForTimeout(500); }
      let recording = false;
      if (!definition.touch) { try { recording = await videoStart(page); } catch (error) { evidence.video = { unavailable: String(error) }; } }
      await shot(page, definition, 'home-overview', false, errors, samples);
      for (const id of worlds) {
        await page.locator(`.ba3d-${id} .ba3d-world-name`).click(); await settled(page, id);
        await shot(page, definition, `home-${id}`, false, errors);
      }
      await page.locator('.ba3d-overview-reset').click(); await settled(page, null);
      for (const id of worlds) {
        await page.locator(`.ba3d-${id} .ba3d-play`).click();
        await expect(page.locator('.immersive-dialog')).toBeVisible();
        await page.waitForFunction(moduleId => {
          const stats = JSON.parse(document.querySelector('canvas.ba3d-canvas')?.getAttribute('data-diagnostics') ?? '{}');
          return stats.sceneMode === 'game' && stats.gameWorld === moduleId && stats.guideVisible && stats.drawCalls > 0;
        }, id, { timeout: 15000 });
        await shot(page, definition, `game-${id}-waiting`, true, errors);
        await page.getByRole('button', { name: /Thoát trò chơi/ }).click();
        await expect(page.locator('.immersive-dialog')).toHaveCount(0);
      }
      evidence.views.filter(view => view.viewport.width === definition.width).forEach(view => { view.maxModelRequestsInFlight = maxInflight; });
      if (recording) { await page.waitForTimeout(800); await videoStop(page); }
    } catch (error) { evidence.errors.push({ viewport: definition, message: String(error), pageErrors: errors }); }
    finally { await context.close(); }
  }
} finally { await browser.close(); }

await fs.writeFile(new URL('art-browser-evidence.json', output), `${JSON.stringify(evidence, null, 2)}\n`);
const rows = evidence.views.map(view => `| ${view.name} | ${view.diagnostics.readyAssets?.length ?? 'n/a'} | ${view.diagnostics.fpsMedian ?? 'n/a'} | ${view.diagnostics.drawCalls ?? 'n/a'} | ${view.diagnostics.triangles ?? 'n/a'} | ${view.maxModelRequestsInFlight} | ${view.horizontalOverflow ? 'FAIL' : 'PASS'} | ${view.controls.filter(control => control.outsideViewport || !control.receivesPointer).length} | ${view.emulatedTouch ? view.controls.filter(control => control.primaryTouchTarget && control.rect.height < 44).length : 'n/a'} | ${view.errors.length} |`).join('\n');
await fs.writeFile(new URL('capture-summary.md', output), `# V3.7 PR03 ${baseline ? 'baseline' : 'textured art'} capture\n\nCaptured ${evidence.date}, Edge ${evidence.browser}.\n\n${evidence.note}\n\n| View | Ready assets | Median FPS | Draw calls | Triangles | Max GLB requests in flight | Overflow | Outside/blocked controls | Touch targets below 44px | Errors |\n|---|---:|---:|---:|---:|---:|---|---:|---:|---:|\n${rows}\n\nVisual acceptance requires reviewing the screenshots. The file gate does not establish final art approval.\n`);
const failures = evidence.views.filter(view => view.horizontalOverflow || view.controls.some(control => control.outsideViewport || !control.receivesPointer || view.emulatedTouch && control.primaryTouchTarget && control.rect.height < 44) || view.errors.length || view.maxModelRequestsInFlight > 2);
if (evidence.errors.length || evidence.views.length !== 21 || failures.length) process.exitCode = 1;
