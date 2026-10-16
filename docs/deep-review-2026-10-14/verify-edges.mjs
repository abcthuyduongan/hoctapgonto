import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { BUILTIN_PACKS } from '../../src/core/seed.ts';
const baseURL = 'http://127.0.0.1:5199';
const result = {};
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '5199', '--strictPort'], { windowsHide: true, stdio: 'pipe' });
let log = ''; server.stdout.on('data', b => log += b); server.stderr.on('data', b => log += b);
let browser;
try {
  for (let i = 0; i < 60; i++) { try { if ((await fetch(baseURL)).ok) break; } catch {} if (server.exitCode !== null) throw new Error(log); await new Promise(r => setTimeout(r, 100)); }
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1440, height: 900 } });
  const page = await context.newPage(); await page.goto(baseURL + '/manifest.webmanifest');
  await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const r = indexedDB.open('bao-an-learning-v3-alpha', 1);
      r.onupgradeneeded = () => { r.result.createObjectStore('packs', { keyPath: 'key' }); r.result.createObjectStore('sessions', { keyPath: 'sessionId' }); r.result.createObjectStore('events', { keyPath: 'eventId' }); };
      r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
    });
    await new Promise((resolve, reject) => {
      const tx = db.transaction('sessions', 'readwrite');
      tx.objectStore('sessions').add({ sessionId: 'legacy-before-upgrade', packId: 'math3-adventure', contentVersion: 1, moduleId: 'math-quest', moduleVersion: '0.2.7', startedAt: '2026-10-12T10:00:00.000Z', endedAt: '2026-10-12T10:01:00.000Z', status: 'completed' });
      tx.oncomplete = resolve; tx.onabort = () => reject(tx.error);
    }); db.close();
  });
  await page.goto(baseURL); await page.locator('.ba3d-home').waitFor();
  result.migration = await page.evaluate(async () => {
    const db = await new Promise(resolve => { const r = indexedDB.open('bao-an-learning-v3-alpha'); r.onsuccess = () => resolve(r.result); });
    const session = await new Promise(resolve => { const r = db.transaction('sessions').objectStore('sessions').get('legacy-before-upgrade'); r.onsuccess = () => resolve(r.result); });
    const value = { version: db.version, stores: [...db.objectStoreNames], session }; db.close(); return value;
  });
  await page.getByRole('button', { name: /Xưởng học liệu/ }).click();
  await page.getByRole('button', { name: /Math Quest · Trắc nghiệm/ }).click();
  await page.locator('#copy-from').selectOption('math4-adventure@1');
  await page.locator('#pack-title').fill('Audit: Only title changed');
  await page.getByRole('button', { name: 'Xuất bản học liệu ↗' }).click();
  await page.locator('form').getByRole('status').waitFor();
  result.copiedPack = await page.evaluate(async () => {
    const db = await new Promise(resolve => { const r = indexedDB.open('bao-an-learning-v3-alpha'); r.onsuccess = () => resolve(r.result); });
    const row = await new Promise(resolve => { const r = db.transaction('packs').objectStore('packs').get('math4-adventure@2'); r.onsuccess = () => resolve(r.result); }); db.close(); return row;
  });
  result.originalObjectives = BUILTIN_PACKS.find(p => p.id === 'math4-adventure').items.map(i => i.objectiveId);
  await context.close();
  result.navigation = [];
  for (const width of [390, 320]) {
    const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width, height: 844 } });
    const p = await ctx.newPage(); await p.goto(baseURL); await p.locator('.ba3d-home').waitFor();
    result.navigation.push(await p.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, buttons: [...document.querySelectorAll('.top-navigation .nav-item')].map(b => {
      const r = b.getBoundingClientRect(); const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return { text: b.textContent, rect: r.toJSON(), hitIsButtonOrChild: hit !== null && b.contains(hit), fullyInViewport: r.x >= 0 && r.right <= innerWidth, textWidth: b.scrollWidth, clientWidth: b.clientWidth };
    }) })));
    await ctx.close();
  }
} catch (e) { result.harnessError = { message: e.message, stack: e.stack }; }
finally { if (browser) await browser.close(); server.kill(); await writeFile(new URL('./edge-results.json', import.meta.url), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result, null, 2)); }
