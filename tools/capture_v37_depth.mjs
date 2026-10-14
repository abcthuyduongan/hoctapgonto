/** Capture composition and runtime evidence from the built application.
 * Run after the production build and when no other GPU browser test is running.
 * This uses isolated browser contexts and does not inspect the user's profile.
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const target = new URL(process.argv[2] ?? 'http://127.0.0.1:5180/?premium3d=1');
target.searchParams.set('premium3d', '1');
const output = new URL('../docs/V37_depth_qa/', import.meta.url);
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge' });
const evidence = {
  date: new Date().toISOString(), target: target.href, browser: browser.version(),
  os: `${os.type()} ${os.release()}`, cpu: os.cpus()[0]?.model, memoryBytes: os.totalmem(),
  note: 'Headless Edge on Windows. Mobile and landscape are viewport/touch emulation on the same desktop GPU, not physical phone measurements. FPS samples use the renderer rolling window and are not an independent GPU profiler.',
  views: [], errors: [],
};
const definitions = [
  { width: 1440, height: 900, touch: false },
  { width: 390, height: 844, touch: true },
  { width: 320, height: 640, touch: true },
  { width: 844, height: 390, touch: true },
];

async function readLayout(page) {
  return page.evaluate(() => {
    const rect = element => {
      if (!element) return null;
      const box = element.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height };
    };
    const controls = [...document.querySelectorAll('.ba3d-world-name, .ba3d-island-control select, .ba3d-play, .top-navigation button')].map(element => {
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      const shown = box.width > 0 && box.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
      const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
      return {
        text: element.getAttribute('aria-label') ?? element.textContent?.trim(), tag: element.tagName,
        rect: rect(element), shown,
        outsideViewport: shown && (box.x < -1 || box.y < -1 || box.right > innerWidth + 1 || box.bottom > innerHeight + 1),
        receivesPointer: shown && (hit === element || !!hit && element.contains(hit)),
        primaryTouchTarget: element.matches('.ba3d-island-control button, .ba3d-island-control select'),
      };
    });
    const host = document.querySelector('.ba3d-render-host');
    const canvas = host?.querySelector('canvas');
    const gl = canvas?.getContext('webgl2');
    const debug = gl?.getExtension('WEBGL_debug_renderer_info');
    return {
      viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
      horizontalOverflow: { root: document.documentElement.scrollWidth, body: document.body.scrollWidth, exceedsViewport: document.documentElement.scrollWidth > innerWidth || document.body.scrollWidth > innerWidth },
      sections: Object.fromEntries(['.site-header', '.top-navigation', '.ba3d-world', '.ba3d-render-host', '.ba3d-hero-title', '.ba3d-anchors', '.ba3d-shortcuts', '.ba3d-render-controls'].map(selector => [selector, rect(document.querySelector(selector))])),
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
    page.on('response', response => {
      if (response.status() >= 400) errors.push({ type: 'http', status: response.status(), url: response.url() });
    });
    try {
      await page.goto(target.href, { waitUntil: 'networkidle' });
      await page.locator('.ba3d-render-host[data-state="ready"][data-engine="three-webgl"]').waitFor({ timeout: 20000 });
      await page.waitForTimeout(4000);
      const samples = [];
      for (let sample = 0; sample < 4; sample++) {
        samples.push(await page.locator('.ba3d-render-host').evaluate(host => JSON.parse(host.getAttribute('data-diagnostics') ?? '{}')));
        await page.waitForTimeout(1000);
      }
      for (const focus of ['default', 'math']) {
        if (focus === 'math') {
          await page.getByRole('button', { name: 'Xem đảo Đảo Toán Học', exact: true }).click();
          await page.waitForTimeout(1200);
        }
        const name = `depth-${focus}-${definition.width}x${definition.height}`;
        const layout = await readLayout(page);
        await page.screenshot({ path: fileURLToPath(new URL(`${name}.png`, output)) });
        evidence.views.push({ name, focus, emulatedTouch: definition.touch, screenshot: `${name}.png`, ...layout, runtimeSamples: focus === 'default' ? samples : undefined, errors: [...errors] });
        console.log(`${name}: ${layout.state}, FPS ${layout.diagnostics.fpsMedian ?? '?'}, draw calls ${layout.diagnostics.drawCalls ?? '?'}, overflow ${layout.horizontalOverflow.exceedsViewport}, controls outside ${layout.controls.filter(control => control.outsideViewport).length}, blocked ${layout.controls.filter(control => !control.receivesPointer).length}`);
      }
    } catch (error) {
      evidence.errors.push({ viewport: definition, message: String(error), pageErrors: errors });
    } finally { await context.close(); }
  }
} finally { await browser.close(); }

await fs.writeFile(new URL('depth-browser-evidence.json', output), `${JSON.stringify(evidence, null, 2)}\n`);
const failures = evidence.views.filter(view => view.horizontalOverflow.exceedsViewport || Object.values(view.gameControlCounts).some(count => count !== 3) || view.controls.some(control => control.outsideViewport || !control.receivesPointer || view.emulatedTouch && control.primaryTouchTarget && control.rect.height < 44) || view.errors.length > 0);
const rows = evidence.views.map(view => `| ${view.name} | ${view.diagnostics.fpsMedian ?? 'n/a'} | ${view.diagnostics.fpsP95FrameMs ?? 'n/a'} | ${view.diagnostics.drawCalls ?? 'n/a'} | ${view.diagnostics.triangles ?? 'n/a'} | ${view.horizontalOverflow.exceedsViewport ? 'FAIL' : 'PASS'} | ${view.controls.filter(control => control.outsideViewport || !control.receivesPointer).length} | ${view.emulatedTouch ? view.controls.filter(control => control.primaryTouchTarget && control.rect.height < 44).length : 'n/a'} | ${view.errors.length} |`).join('\n');
await fs.writeFile(new URL('capture-summary.md', output), `# V3.7 composition capture\n\nCaptured ${evidence.date}, ${evidence.browser}, ${evidence.cpu}.\n\n${evidence.note}\n\n| View | Renderer median FPS | P95 frame ms | Draw calls | Triangles | Horizontal overflow | Outside/blocked controls | Primary touch controls below 44px | Page/resource errors |\n|---|---:|---:|---:|---:|---|---:|---:|---:|\n${rows}\n\nVisual quality requires reviewing the screenshots; successful control/layout checks do not establish art approval. See depth-browser-evidence.json for exact rectangles and rolling-window samples.\n`);
if (evidence.errors.length || evidence.views.length !== definitions.length * 2 || failures.length) process.exitCode = 1;
