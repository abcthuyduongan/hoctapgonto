import { expect, test, type Locator, type Page } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

async function receivesPointer(locator: Locator) {
  await expect(locator).toBeVisible();
  expect(await locator.evaluate(element => {
    const box = element.getBoundingClientRect();
    const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
    return hit === element || !!hit && element.contains(hit);
  }), 'Control center must receive the pointer').toBe(true);
}

async function chooseMath(page: Page) {
  await page.getByRole('button', { name: 'Chọn Đảo Toán Học', exact: true }).click();
}

async function focusStaysInDialog(page: Page, dialog: Locator) {
  await expect(dialog).toBeVisible();
  await expect.poll(() => dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
  for (const key of ['Tab', 'Shift+Tab']) {
    for (let count = 0; count < 12; count++) {
      await page.keyboard.press(key);
      expect(await dialog.evaluate(element => element.contains(document.activeElement)), `${key} stays in the dialog`).toBe(true);
    }
  }
}

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 640 }]) {
  test(`BA-01: game exit receives pointer and focus stays inside at ${viewport.width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.goto('/?view=games&controls=1');
    await chooseMath(page);
    await page.locator('.ba3d-math-quest .ba3d-play').click();
    const dialog = page.getByRole('dialog', { name: /^Đang chơi / });
    await expect(dialog.locator('.answer-option').first()).toBeVisible();
    const exit = dialog.getByRole('button', { name: /Thoát trò chơi/ });
    await receivesPointer(exit);
    await focusStaysInDialog(page, dialog);
    await testInfo.attach(`game-exit-${viewport.width}`, { body: await page.screenshot(), contentType: 'image/png' });
    await exit.click();
    await expect(dialog).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => document.querySelector('.site-header')?.hasAttribute('inert'))).toBe(false);
  });
}

for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 640 }]) {
  test(`BA-01: mobile navigation has distinct touch targets at ${viewport.width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.goto('/?view=games&controls=1');
    for (const menu of [/Góc phụ huynh/, /Xưởng học liệu/, /Thế giới game/]) {
      const navigation = page.getByRole('navigation', { name: 'Không gian ứng dụng' });
      const buttons = navigation.getByRole('button');
      await expect(buttons).toHaveCount(3);
      const boxes = [];
      for (const button of await buttons.all()) {
        await receivesPointer(button);
        const box = (await button.boundingBox())!;
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
        boxes.push(box);
      }
      for (let a=0;a<boxes.length;a++)for(let b=a+1;b<boxes.length;b++){
        const first=boxes[a],second=boxes[b];
        expect(first.x+first.width<=second.x||second.x+second.width<=first.x||first.y+first.height<=second.y||second.y+second.height<=first.y,'Navigation touch targets must not overlap').toBe(true);
      }
      for (const control of await page.locator('.experience-controls button').all()) await receivesPointer(control);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
      await navigation.getByRole('button', { name: menu }).click();
    }
    await testInfo.attach(`mobile-navigation-${viewport.width}`, { body: await page.screenshot(), contentType: 'image/png' });
  });
}

test('BA-01: profile and mini-app dialogs trap Tab and restore the opener', async ({ page }) => {
  await page.goto('/?view=games&controls=1');
  const profileOpener = page.getByRole('button', { name: 'Đổi hồ sơ học sinh' });
  await profileOpener.click();
  const profile = page.getByRole('dialog', { name: 'Chọn hồ sơ học sinh' });
  await focusStaysInDialog(page, profile);
  await profile.getByRole('button', { name: /Thêm hồ sơ/ }).click();
  await expect(profile.getByRole('textbox')).toBeFocused();
  await focusStaysInDialog(page, profile);
  await page.keyboard.press('Escape');
  await expect(profile).toHaveCount(0);
  await expect(profileOpener).toBeFocused();
  const miniOpener = page.getByRole('button', { name: /Bảng cửu chương/ });
  await miniOpener.click();
  const mini = page.getByRole('dialog', { name: 'Bảng cửu chương tương tác' });
  await focusStaysInDialog(page, mini);
  const exit = mini.getByRole('button', { name: /Thoát ứng dụng/ });
  await receivesPointer(exit);
  await exit.click();
  await expect(mini).toHaveCount(0);
  await expect(miniOpener).toBeFocused();
});

test('BA-01: touch can exit a game at 390px', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, serviceWorkers: 'block' });
  const page = await context.newPage();
  try {
    await page.goto('/?view=games&controls=1');
    await chooseMath(page);
    await page.locator('.ba3d-math-quest .ba3d-play').tap();
    const exit = page.getByRole('button', { name: /Thoát trò chơi/ });
    await receivesPointer(exit);
    await exit.tap();
    await expect(page.getByRole('dialog', { name: /^Đang chơi / })).toHaveCount(0);
  } finally { await context.close(); }
});

const islandChoices = [
  { id: 'math-quest', name: 'Chọn Đảo Toán Học' },
  { id: 'memory-match', name: 'Chọn Khu Rừng Trí Nhớ' },
  { id: 'sentence-builder', name: 'Chọn Xưởng Ghép Câu' },
  { id: 'word-connect', name: 'Chọn Đảo Nối Từ' },
  { id: 'sequence-trail', name: 'Chọn Bậc Thang Quy Luật' },
];

async function tabTo(page: Page, target: Locator, limit = 30) {
  for (let count = 0; count < limit; count++) {
    if (await target.evaluate(element => element === document.activeElement)) return;
    await page.keyboard.press('Tab');
  }
  await expect(target).toBeFocused();
}

async function openAllWithKeyboard(page: Page) {
  const picker = page.getByRole('navigation', { name: 'Chọn đảo học tập' });
  await expect(picker.getByRole('button')).toHaveCount(5);
  for (const choice of islandChoices) {
    const button = picker.getByRole('button', { name: choice.name, exact: true });
    await receivesPointer(button);
    await page.locator('.brand').focus();
    await tabTo(page, button);
    await page.keyboard.press('Enter');
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await expect(picker.getByRole('button', { pressed: true })).toHaveCount(1);
    const start = page.locator(`.ba3d-${choice.id} .ba3d-play`);
    await receivesPointer(start);
    await tabTo(page, start, 10);
    await page.keyboard.press('Enter');
    const dialog = page.locator(`.dialog-${choice.id}`);
    await expect(dialog).toBeVisible();
    await expect(page.locator('canvas')).toHaveCount(1);
    if (choice.id === 'math-quest') {
      const answer = dialog.locator('.answer-option').first();
      await answer.focus();
      await page.keyboard.press('Enter');
      await expect(dialog.locator('.answer-feedback')).toBeVisible();
    }
    const exit = dialog.getByRole('button', { name: /Thoát trò chơi/ });
    await exit.focus();
    await page.keyboard.press('Enter');
    await expect(dialog).toHaveCount(0);
    await expect(picker.getByRole('button')).toHaveCount(5);
  }
  const saved = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('bao-an-learning-v3-alpha');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise<{ sessions: { moduleId: string; status: string }[]; events: { moduleId: string; itemId: string }[] }>((resolve, reject) => {
        const tx = db.transaction(['sessions', 'events'], 'readonly');
        const sessions = tx.objectStore('sessions').getAll();
        const events = tx.objectStore('events').getAll();
        tx.oncomplete = () => resolve({ sessions: sessions.result, events: events.result });
        tx.onabort = () => reject(tx.error);
      });
    } finally { db.close(); }
  });
  expect(new Set(saved.sessions.map(session => session.moduleId))).toEqual(new Set(islandChoices.map(choice => choice.id)));
  expect(saved.sessions).toHaveLength(5);
  expect(saved.sessions.every(session => session.status === 'abandoned')).toBe(true);
  expect(saved.events).toHaveLength(1);
  expect(saved.events[0]).toMatchObject({ moduleId: 'math-quest' });
  expect(saved.events[0].itemId).not.toBe('');
}

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 640 }]) {
  test(`BA-02: all five games open with Tab/Enter without canvas contexts at ${viewport.width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.addInitScript(() => { HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext; });
    await page.goto('/?view=games&controls=1');
    await expect(page.locator('.ba3d-render-host')).toHaveAttribute('data-state', 'unavailable');
    await openAllWithKeyboard(page);
    await page.reload();
    await expect(page.getByRole('navigation', { name: 'Chọn đảo học tập' }).getByRole('button')).toHaveCount(5);
    await testInfo.attach(`dom-picker-unavailable-${viewport.width}`, { body: await page.screenshot(), contentType: 'image/png' });
  });
}

test('BA-02: WebGL fallback can open all five games with the DOM picker', async ({ page }) => {
  await page.addInitScript(() => {
    const native = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, options?: unknown) {
      return type === '2d' ? native.call(this, '2d', options) : null;
    } as typeof HTMLCanvasElement.prototype.getContext;
  });
  await page.goto('/?view=games&controls=1');
  await expect(page.locator('.ba3d-render-host')).toHaveAttribute('data-state', 'fallback');
  await openAllWithKeyboard(page);
});

test('BA-02: DOM selection keeps the shared carousel and a single canvas', async ({ page }) => {
  await page.goto('/?view=games&controls=1');
  const host = page.locator('.ba3d-render-host');
  await expect(host).toHaveAttribute('data-state', 'ready');
  for (const choice of islandChoices) {
    const button = page.getByRole('button', { name: choice.name, exact: true });
    await button.click();
    await expect.poll(async () => {
      const diagnostics = JSON.parse(await host.getAttribute('data-diagnostics') || '{}');
      return { selected: diagnostics.selectedWorld, moving: diagnostics.carouselMoving, location: diagnostics.mascotLocation };
    }).toEqual({ selected: choice.id, moving: false, location: choice.id });
    await expect(page.locator('.ba3d-island-control')).toHaveCount(1);
    await expect(page.locator('canvas')).toHaveCount(1);
  }
  await page.getByRole('button', { name: /Xem tất cả các đảo/ }).click();
  await expect.poll(async () => JSON.parse(await host.getAttribute('data-diagnostics') || '{}').selectedWorld).toBeNull();
  await expect(page.getByRole('navigation', { name: 'Chọn đảo học tập' }).getByRole('button')).toHaveCount(5);
  await expect(page.getByRole('navigation', { name: 'Chọn đảo học tập' }).getByRole('button', { pressed: true })).toHaveCount(0);
  await expect(page.locator('canvas')).toHaveCount(1);
});
