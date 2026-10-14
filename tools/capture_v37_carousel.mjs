/** Capture the actual built carousel in isolated Edge contexts.
 * Run with no other GPU browser test active; default is the existing preview.
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const target = new URL(process.argv[2] ?? 'http://127.0.0.1:5180/?premium3d=1');
target.searchParams.set('premium3d', '1');
const output = new URL('../docs/V37_carousel_qa/', import.meta.url);
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge' });
const evidence = {
  date: new Date().toISOString(), target: target.href, browser: browser.version(),
  os: `${os.type()} ${os.release()}`, cpu: os.cpus()[0]?.model,
  note: 'Headless Edge on Windows. Touch viewports are desktop emulation, not physical-phone testing. FPS is the real renderer rolling window, not an independent GPU profiler. Math and fox are textured premium GLBs; Memory and Language are provisional models.',
  views: [], motionSamples: [], modelRequests: [], video: null, errors: [],
};
const definitions = [
  { width: 1440, height: 900, touch: false },
  { width: 390, height: 844, touch: true },
  { width: 320, height: 640, touch: true },
];
const selections = [
  { name: 'math', id: 'math-quest' },
  { name: 'memory', id: 'memory-match' },
  { name: 'language', id: 'sentence-builder' },
];

async function readLayout(page) {
  return page.evaluate(() => {
    const rect = element => {
      if (!element) return null;
      const box = element.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height };
    };
    const controls = [...document.querySelectorAll('.ba3d-world-name, .ba3d-island-control select, .ba3d-play, .ba3d-overview-reset, .top-navigation button')].map(element => {
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      const shown = box.width > 0 && box.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
      const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
      return {
        text: element.getAttribute('aria-label') ?? element.textContent?.trim(), rect: rect(element), shown,
        outsideViewport: shown && (box.x < -1 || box.y < -1 || box.right > innerWidth + 1 || box.bottom > innerHeight + 1),
        receivesPointer: shown && (hit === element || !!hit && element.contains(hit)),
        primaryTouchTarget: element.matches('.ba3d-island-control button, .ba3d-island-control select, .ba3d-overview-reset'),
      };
    });
    const host = document.querySelector('.ba3d-render-host');
    const canvas = host?.querySelector('canvas');
    const gl = canvas?.getContext('webgl2');
    const debug = gl?.getExtension('WEBGL_debug_renderer_info');
    return {
      viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth || document.body.scrollWidth > innerWidth,
      sections: Object.fromEntries(['.site-header', '.top-navigation', '.ba3d-world', '.ba3d-render-host', '.ba3d-hero-title', '.ba3d-anchors', '.ba3d-island-overview'].map(selector => [selector, rect(document.querySelector(selector))])),
      controls, engine: host?.getAttribute('data-engine'), state: host?.getAttribute('data-state'),
      gameControlCounts: {
        focus: document.querySelectorAll('.ba3d-world-name').length,
        pack: document.querySelectorAll('.ba3d-island-control select').length,
        start: document.querySelectorAll('.ba3d-play').length,
      },
      diagnostics: JSON.parse(host?.getAttribute('data-diagnostics') ?? '{}'),
      renderer: debug && gl ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : 'unavailable',
    };
  });
}

async function settled(page, id) {
  await page.waitForFunction(expected => {
    const value = JSON.parse(document.querySelector('.ba3d-render-host')?.getAttribute('data-diagnostics') ?? '{}');
    return value.selectedWorld === expected && value.carouselMoving === false
      && value.mascotState === (expected ? 'on-island' : 'waiting')
      && value.mascotLocation === (expected ?? 'waiting');
  }, id, { timeout: 15000 });
}

async function startVideo(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('canvas.ba3d-canvas');
    const type = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find(value => MediaRecorder.isTypeSupported(value));
    if (!canvas?.captureStream || !type) return false;
    const stream = canvas.captureStream(30);
    const recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 3500000 });
    const chunks = [];
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    window.__carouselCapture = { recorder, chunks, stream, type };
    recorder.start(200);
    return true;
  });
}

async function stopVideo(page) {
  const recording = await page.evaluate(async () => {
    const value = window.__carouselCapture;
    if (!value) return null;
    await new Promise(resolve => { value.recorder.onstop = resolve; value.recorder.stop(); });
    value.stream.getTracks().forEach(track => track.stop());
    const blob = new Blob(value.chunks, { type: value.type });
    return { bytes: Array.from(new Uint8Array(await blob.arrayBuffer())), mimeType: value.type };
  });
  if (!recording) return;
  await fs.writeFile(new URL('carousel-demo.webm', output), Buffer.from(recording.bytes));
  evidence.video = { file: 'carousel-demo.webm', bytes: recording.bytes.length, mimeType: recording.mimeType, note: 'Canvas recording of initial waiting, Math, Memory, Language and return to overview. HTML controls are outside the canvas.' };
}

try {
  for (const definition of definitions) {
    const context = await browser.newContext({
      viewport: { width: definition.width, height: definition.height },
      hasTouch: definition.touch, isMobile: definition.touch, deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push({ type: 'pageerror', message: error.message }));
    page.on('requestfailed', request => errors.push({ type: 'requestfailed', url: request.url(), message: request.failure()?.errorText }));
    page.on('request', request => { if (/\/models\/[^/]+\.glb(?:\?|$)/.test(request.url())) evidence.modelRequests.push({ viewport: definition.width, url: request.url() }); });
    page.on('response', response => { if (response.status() >= 400) errors.push({ type: 'http', status: response.status(), url: response.url() }); });
    try {
      await page.goto(target.href, { waitUntil: 'networkidle' });
      await page.locator('.ba3d-render-host[data-state="ready"][data-engine="three-webgl"]').waitFor({ timeout: 20000 });
      await settled(page, null);
      await page.waitForTimeout(3000);
      const fpsSamples = [];
      for (let sample = 0; sample < 3; sample++) {
        fpsSamples.push((await readLayout(page)).diagnostics);
        await page.waitForTimeout(1000);
      }
      let recording = false;
      if (!definition.touch) {
        try { recording = await startVideo(page); }
        catch (error) { evidence.video = { unavailable: String(error) }; }
      }
      for (const selection of [{ name: 'initial', id: null }, ...selections]) {
        if (selection.id) {
          // Sample canvas diagnostics at frame cadence while the visible UI
          // triggers a selection; no test-only hooks are added to the product.
          await page.evaluate(() => {
            const canvas = document.querySelector('canvas.ba3d-canvas');
            window.__carouselMotionSamples = [];
            window.__carouselMotionTimer = setInterval(() => {
              window.__carouselMotionSamples.push(JSON.parse(canvas?.getAttribute('data-diagnostics') ?? '{}'));
            }, 40);
          });
          await page.locator(`.ba3d-${selection.id} .ba3d-world-name`).click();
          await settled(page, selection.id);
          const samples = await page.evaluate(() => { clearInterval(window.__carouselMotionTimer); return window.__carouselMotionSamples; });
          evidence.motionSamples.push({ viewport: definition.width, id: selection.id, samples });
        }
        await page.waitForTimeout(600);
        const name = `carousel-${selection.name}-${definition.width}x${definition.height}`;
        const layout = await readLayout(page);
        await page.screenshot({ path: fileURLToPath(new URL(`${name}.png`, output)) });
        evidence.views.push({ name, selection: selection.id, emulatedTouch: definition.touch, screenshot: `${name}.png`, ...layout, runtimeSamples: selection.id === null ? fpsSamples : undefined, errors: [...errors] });
        console.log(`${name}: ${layout.state}, FPS ${layout.diagnostics.fpsMedian ?? '?'}, draws ${layout.diagnostics.drawCalls ?? '?'}, overflow ${layout.horizontalOverflow}, outside ${layout.controls.filter(control => control.outsideViewport).length}, blocked ${layout.controls.filter(control => !control.receivesPointer).length}`);
      }
      if (recording) {
        await page.locator('.ba3d-overview-reset').click();
        await settled(page, null);
        await page.waitForTimeout(900);
        await stopVideo(page);
      }
    } catch (error) { evidence.errors.push({ viewport: definition, message: String(error), pageErrors: errors }); }
    finally { await context.close(); }
  }
} finally { await browser.close(); }

await fs.writeFile(new URL('carousel-browser-evidence.json', output), `${JSON.stringify(evidence, null, 2)}\n`);
const failures = evidence.views.filter(view => view.horizontalOverflow || Object.values(view.gameControlCounts).some(count => count !== 3) || view.controls.some(control => control.outsideViewport || !control.receivesPointer || view.emulatedTouch && control.primaryTouchTarget && control.rect.height < 44) || view.errors.length > 0);
const rows = evidence.views.map(view => `| ${view.name} | ${view.diagnostics.fpsMedian ?? 'n/a'} | ${view.diagnostics.fpsP95FrameMs ?? 'n/a'} | ${view.diagnostics.drawCalls ?? 'n/a'} | ${view.horizontalOverflow ? 'FAIL' : 'PASS'} | ${view.controls.filter(control => control.outsideViewport || !control.receivesPointer).length} | ${view.emulatedTouch ? view.controls.filter(control => control.primaryTouchTarget && control.rect.height < 44).length : 'n/a'} | ${view.errors.length} |`).join('\n');
await fs.writeFile(new URL('capture-summary.md', output), `# V3.7 island carousel capture\n\nCaptured ${evidence.date}, ${evidence.browser}, ${evidence.cpu}.\n\n${evidence.note}\n\n| View | Renderer median FPS | P95 frame ms | Draw calls | Horizontal overflow | Outside/blocked controls | Primary touch targets below 44px | Page/resource errors |\n|---|---:|---:|---:|---|---:|---:|---:|\n${rows}\n\nVisual QA requires reviewing the screenshots; layout and motion assertions do not establish final premium-art approval. See carousel-browser-evidence.json for actual transforms, rectangles and frame-window samples.\n`);
if (evidence.errors.length || evidence.views.length !== definitions.length * 4 || failures.length) process.exitCode = 1;
