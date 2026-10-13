/** Browser evidence from the built React application; isolated QA data only. */
import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
const target = process.argv[2] ?? 'http://127.0.0.1:5178';
const output = new URL('../docs/V37_qa/', import.meta.url);
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge' });
const evidence = { date: new Date().toISOString(), browser: browser.version(), headless: true,
  os: `${os.type()} ${os.release()}`, cpu: os.cpus()[0]?.model, memoryBytes: os.totalmem(),
  note: 'Desktop Edge automation. Mobile viewports are emulation, not physical phone measurements.', views: [], baselineBundle: [] };
try {
  for (const [width, height] of [[1440,900],[390,844],[320,640]]) {
    const context = await browser.newContext({ viewport: { width, height } });
    const page = await context.newPage();
    await page.goto(`${target}/?premium3d=1`);
    await page.locator('.ba3d-render-host[data-state="ready"]').waitFor({ timeout: 15000 });
    await page.waitForTimeout(4000);
    const data = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      const gl = canvas?.getContext('webgl2');
      const debug = gl?.getExtension('WEBGL_debug_renderer_info');
      return { diagnostics: JSON.parse(document.querySelector('.ba3d-render-host')?.getAttribute('data-diagnostics') ?? '{}'),
        renderer: debug && gl ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : 'unavailable',
        viewport: { width: innerWidth, height: innerHeight }, overflow: document.documentElement.scrollWidth > innerWidth };
    });
    evidence.views.push(data);
    await page.screenshot({ path: fileURLToPath(new URL(`premium-${width}x${height}.png`, output)) });
    await context.close();
  }
  const context = await browser.newContext();
  const page = await context.newPage();
  for (const [width,height] of [[1440,900],[390,844],[320,640]]) {
    await page.setViewportSize({ width,height });
    await page.goto('http://127.0.0.1:5176/');
    await page.locator('.ba3d-play').first().waitFor();
    await page.waitForTimeout(700);
    evidence.baselineBundle = await page.evaluate(() => performance.getEntriesByType('resource').map(entry=>entry.name).filter(name=>/\/assets\/index.*\.js$/.test(name)));
    await page.screenshot({ path: fileURLToPath(new URL(`baseline-${width}x${height}.png`, output)) });
  }
  const baselineData = await page.evaluate(async () => {
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open('bao-an-learning-v3-alpha',1);
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    const read = name => new Promise((resolve,reject) => {
      const transaction = database.transaction(name,'readonly'); const request = transaction.objectStore(name).getAll();
      transaction.oncomplete = () => resolve(request.result); transaction.onerror = () => reject(transaction.error);
    });
    const values = Object.fromEntries(await Promise.all(['packs','sessions','events'].map(async name=>[name,await read(name)])));
    database.close();
    return { isolatedQAProfile: true, ...values, localStorage: Object.fromEntries(Object.entries(localStorage)) };
  });
  await fs.writeFile(new URL('baseline-isolated-data.json', output), JSON.stringify(baselineData,null,2));
  await context.close();
} finally { await browser.close(); }
await fs.writeFile(new URL('browser-evidence.json', output), JSON.stringify(evidence,null,2));
console.log(JSON.stringify(evidence,null,2));
