import { expect, test, type Page } from '@playwright/test';
import type { ContentPack, LearningEvent, ModuleId, PairsPack, PlaySession, QuizPack, SentencePack } from '../../src/core/contracts';
import { BUILTIN_PACKS } from '../../src/core/seed';

test.use({ serviceWorkers: 'block' });

const worlds: Record<ModuleId, string> = {
  'math-quest': 'Đảo Toán Học',
  'memory-match': 'Khu Rừng Trí Nhớ',
  'sentence-builder': 'Xưởng Ghép Câu',
  'word-connect': 'Đảo Nối Từ',
  'sequence-trail': 'Bậc Thang Quy Luật',
};
const math = BUILTIN_PACKS.find(pack => pack.id === 'math3-adventure') as QuizPack;
const pairs = BUILTIN_PACKS.find(pack => pack.id === 'english3-family') as PairsPack;
const sentence = BUILTIN_PACKS.find(pack => pack.id === 'english3-sentences') as SentencePack;
const sequence = BUILTIN_PACKS.find(pack => pack.id === 'logic3-sequence') as SentencePack;

// Inspect the application's actual production database, without replacing its
// adapter or manufacturing reward records in the browser.
async function history(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('bao-an-learning-v3-alpha');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise<{ sessions: PlaySession[]; events: LearningEvent[]; packs: { key: string; pack: ContentPack }[] }>((resolve, reject) => {
        const tx = db.transaction(['sessions', 'events', 'packs'], 'readonly');
        const sessions = tx.objectStore('sessions').getAll();
        const events = tx.objectStore('events').getAll();
        const packs = tx.objectStore('packs').getAll();
        tx.oncomplete = () => resolve({ sessions: sessions.result, events: events.result, packs: packs.result });
        tx.onabort = () => reject(tx.error);
      });
    } finally { db.close(); }
  });
}

async function openGame(page: Page, moduleId: ModuleId, pack: ContentPack) {
  await page.getByRole('button', { name: `Chọn ${worlds[moduleId]}`, exact: true }).click();
  await page.locator(`#ba3d-pack-${moduleId}`).selectOption(`${pack.id}@${pack.version}`);
  await page.locator(`.ba3d-${moduleId} .ba3d-play`).click();
  await expect(page.locator('.immersive-dialog')).toBeVisible();
}

async function finishMath(page: Page, pack: QuizPack, wrong = 0, hint = false) {
  await openGame(page, 'math-quest', pack);
  for (const [index, item] of pack.items.entries()) {
    await expect(page.locator('.quiz-question')).toHaveText(item.prompt);
    if (hint && index === 0) await page.getByRole('button', { name: /Cần một gợi ý/ }).click();
    const choice = index < wrong ? (item.correctIndex + 1) % 4 : item.correctIndex;
    await page.locator('.answer-option').nth(choice).click();
    await expect(page.locator('.result-next')).toBeVisible();
    await page.locator('.result-next').click();
  }
  await expect(page.locator('.reward-panel')).toBeVisible();
  await expect(page.locator('.game-star-receipt')).toBeVisible();
}

async function returnHome(page: Page) {
  await page.locator('.reward-home').click();
  await expect(page.getByRole('navigation', { name: 'Chọn đảo học tập' }).getByRole('button')).toHaveCount(5);
}

async function balance(page: Page, earned: number, available = earned) {
  await page.getByRole('button', { name: 'Góc phụ huynh', exact: true }).click();
  const wallet = page.getByRole('region', { name: 'Quản lý đổi sao' });
  await expect(wallet).toContainText(`Thành tích vẫn giữ đủ ${earned} sao`);
  await expect(wallet).toContainText(`${available} sao khả dụng`);
  await page.getByRole('button', { name: 'Thế giới game', exact: true }).click();
}

async function importPack(page: Page, pack: ContentPack) {
  await page.getByRole('button', { name: 'Xưởng học liệu', exact: true }).click();
  const manual = page.locator('details.creator-manual');
  if (await manual.getAttribute('open') === null) await manual.locator('summary').click();
  await page.getByLabel('Chọn tệp bộ học liệu JSON').setInputFiles({
    name: `${pack.id}-v${pack.version}.json`, mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ schema: 'baoan-learning-content', formatVersion: 1, packs: [pack] })),
  });
  await expect(page.locator('.creator-workspace [role="status"]')).toContainText('Đã nhập 1 bộ mới');
  await page.getByRole('button', { name: 'Thế giới game', exact: true }).click();
}

async function finishMemory(page: Page, pack: PairsPack) {
  await openGame(page, 'memory-match', pack);
  const card = (label: string) => page.locator('.memory-card').filter({ has: page.getByText(label, { exact: true }) });
  for (const [index, item] of pack.items.entries()) {
    await card(item.left).click();
    await card(item.right).click();
    await expect(page.locator('.memory-card.found')).toHaveCount((index + 1) * 2);
  }
  await expect(page.locator('.reward-panel')).toBeVisible();
}

async function finishConnect(page: Page, pack: PairsPack) {
  await openGame(page, 'word-connect', pack);
  for (const [index, item] of pack.items.entries()) {
    await page.getByRole('button', { name: `Thẻ A: ${item.left}`, exact: true }).click();
    await page.getByRole('button', { name: `Thẻ B: ${item.right}`, exact: true }).click();
    await expect(page.locator('.connect-card.matched')).toHaveCount((index + 1) * 2);
  }
  await expect(page.locator('.reward-panel')).toBeVisible();
}

async function finishOrder(page: Page, moduleId: 'sentence-builder' | 'sequence-trail', pack: SentencePack) {
  await openGame(page, moduleId, pack);
  const prefix = moduleId === 'sentence-builder' ? 'sentence' : 'trail';
  for (const item of pack.items) {
    for (const word of item.words) await page.locator(`.${prefix}-bank`).getByRole('button', { name: word, exact: true }).click();
    await page.locator(`.${prefix}-main-action`).click();
    await expect(page.locator(`.${prefix}-result-reserve`)).toContainText('Chính xác');
    await page.locator(`.${prefix}-main-action`).click();
  }
  await expect(page.locator('.reward-panel')).toBeVisible();
}

test('Game world is the default home with three menus, character controls and no selection panels', async ({ page }, testInfo) => {
  await page.goto('/');
  const navigation = page.getByRole('navigation', { name: 'Không gian ứng dụng' });
  await expect(navigation.getByRole('button')).toHaveCount(3);
  await expect(navigation.getByRole('button', { name: 'Thế giới game', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(navigation.getByRole('button', { name: 'Tự học', exact: true })).toHaveCount(0);
  await expect(navigation.getByRole('button', { name: 'Luyện thi', exact: true })).toHaveCount(0);
  await expect(page.locator('.ba3d-island-picker, .game-hub-bottom')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Ví đổi sao', exact: true })).toBeVisible();
  const canvas = page.getByRole('img', { name: /Điều khiển Cáo trong thế giới game/ });
  await expect(page.locator('.ba3d-render-host')).toHaveAttribute('data-state', 'ready');
  await canvas.focus(); await page.keyboard.press('ArrowRight');
  await expect.poll(() => page.locator('.ba3d-render-host').evaluate(host => JSON.parse((host as HTMLElement).dataset.diagnostics || '{}').mascotState)).toBe('on-island');
  await page.keyboard.press('Enter');
  await expect(page.locator('.quiz-question')).toHaveText(math.items[0].prompt);
  await page.getByRole('button', { name: /Thoát trò chơi/ }).click();
  await expect(page.locator('.immersive-dialog')).toHaveCount(0);
  for (const viewport of [
    { width: 1440, height: 900, name: 'game-hub-after' },
    { width: 1113, height: 900, name: 'game-hub-1113-after' },
    { width: 390, height: 844, name: 'game-hub-mobile-after' },
  ]) {
    await page.setViewportSize(viewport);
    await canvas.focus(); await page.keyboard.press('Escape'); await page.keyboard.press('ArrowRight');
    await expect(page.locator('.ba3d-render-host')).toHaveAttribute('data-state', 'ready');
    await expect.poll(() => page.locator('.ba3d-render-host').evaluate(host => JSON.parse((host as HTMLElement).dataset.diagnostics || '{}').carouselMoving)).toBe(false);
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator('.ba3d-island-picker, .game-hub-bottom')).toHaveCount(0);
    const screenshot = await page.screenshot({ path: `test-results/${viewport.name}.png` });
    await testInfo.attach(viewport.name, { body: screenshot, contentType: 'image/png' });
  }
});

test('Game stars upgrade from one to three, survive refresh and never duplicate across replay or pack versions', async ({ page }) => {
  test.setTimeout(150_000);
  await page.goto('/?controls=1');
  await finishMath(page, math, 2); // 6/8 first answers: below 80%, complete = one star.
  await expect(page.locator('.game-star-receipt')).toContainText('+1 sao mới');
  await returnHome(page); await balance(page, 1);
  await finishMath(page, math); // Improvement awards only the missing two stars.
  await expect(page.locator('.game-star-receipt')).toContainText('+2 sao mới');
  await returnHome(page); await balance(page, 3);
  await finishMath(page, math);
  await expect(page.locator('.game-star-receipt')).toContainText('Đã giữ mức sao cao nhất');
  await returnHome(page); await balance(page, 3);
  const revision: QuizPack = { ...structuredClone(math), version: 2, source: 'local', title: 'QA · Cùng bộ câu, phiên bản 2' };
  await importPack(page, revision);
  await finishMath(page, revision);
  await expect(page.locator('.game-star-receipt')).toContainText('Đã giữ mức sao cao nhất');
  await returnHome(page); await balance(page, 3);
  await page.reload(); await balance(page, 3);
  const stored = await history(page);
  expect(stored.sessions).toHaveLength(4);
  expect(stored.sessions.every(session => session.status === 'completed' && session.packId === math.id)).toBe(true);
  expect(stored.sessions.every(session => session.rewardPolicyVersion === 1)).toBe(true);
  expect(stored.sessions.map(session => session.contentVersion).sort()).toEqual([1, 1, 1, 2]);
  expect(stored.events).toHaveLength(math.items.length * 4);
  for (const session of stored.sessions) {
    expect(stored.events.filter(event => event.sessionId === session.sessionId).map(event => event.gameSequence).sort((left, right) => left! - right!)).toEqual(math.items.map((_, index) => index + 1));
  }
  for (const event of stored.events) {
    const item = math.items.find(row => row.id === event.itemId)!;
    expect(event.response?.kind).toBe('choice');
    if (event.response?.kind === 'choice') expect(event.correct).toBe(event.response.choiceIndex === item.correctIndex);
  }
});

test('Seven of eight first answers earn two stars, and requesting a hint cannot earn a perfect tier', async ({ page }) => {
  await page.goto('/?controls=1');
  await finishMath(page, math, 1);
  await returnHome(page); await balance(page, 2);
  const other: QuizPack = { ...structuredClone(math), id: 'qa-reward-hint', title: 'QA · Gợi ý có tính vào mức sao', source: 'local' };
  await importPack(page, other);
  await finishMath(page, other, 0, true);
  await returnHome(page); await balance(page, 4);
  const hinted = (await history(page)).events.filter(event => event.packId === other.id);
  expect(hinted).toHaveLength(math.items.length);
  expect(hinted.filter(event => event.hintsUsed > 0)).toHaveLength(1);
});

test('All five real games submit raw responses; Memory and Connect share the same three-star pack ceiling', async ({ page }) => {
  test.setTimeout(150_000);
  await page.goto('/?controls=1');
  await finishMath(page, math); await returnHome(page); await balance(page, 3);
  await finishMemory(page, pairs); await returnHome(page); await balance(page, 6);
  await finishConnect(page, pairs); await returnHome(page); await balance(page, 6);
  await finishOrder(page, 'sentence-builder', sentence); await returnHome(page); await balance(page, 9);
  await finishOrder(page, 'sequence-trail', sequence); await returnHome(page); await balance(page, 12);
  const stored = await history(page);
  expect(stored.sessions).toHaveLength(5);
  expect(stored.sessions.every(session => session.status === 'completed')).toBe(true);
  for (const moduleId of Object.keys(worlds) as ModuleId[]) {
    const events = stored.events.filter(event => event.moduleId === moduleId);
    const expected = moduleId === 'math-quest' ? math.items.length : moduleId === 'sentence-builder' ? sentence.items.length : moduleId === 'sequence-trail' ? sequence.items.length : pairs.items.length;
    expect(events).toHaveLength(expected);
    expect(events.every(event => event.correct)).toBe(true);
    expect(events.every(event => event.response?.kind === (moduleId === 'math-quest' ? 'choice' : moduleId === 'memory-match' || moduleId === 'word-connect' ? 'pair' : 'order'))).toBe(true);
  }
});

test('An interrupted game earns no stars, and another child starts with an isolated balance', async ({ page }) => {
  await page.goto('/?controls=1'); await openGame(page, 'math-quest', math);
  await page.locator('.answer-option').nth(math.items[0].correctIndex).click();
  await expect(page.locator('.result-next')).toBeVisible();
  await page.getByRole('button', { name: /Thoát trò chơi/ }).click();
  await balance(page, 0);
  expect((await history(page)).sessions[0].status).toBe('abandoned');
  await finishMath(page, math); await returnHome(page); await balance(page, 3);
  await page.getByRole('button', { name: 'Đổi hồ sơ học sinh', exact: true }).click();
  const profiles = page.getByRole('dialog', { name: 'Chọn hồ sơ học sinh' });
  await profiles.getByRole('button', { name: /Thêm hồ sơ cho bé khác/ }).click();
  await profiles.getByLabel('Tên gọi của bé').fill('Bé kiểm thử thứ hai');
  await profiles.getByRole('button', { name: 'Tạo hồ sơ', exact: true }).click();
  await expect(profiles).toHaveCount(0);
  await balance(page, 0);
});

test('Earned game stars can fund a real-life wish; handover spends balance while replay preserves achievement', async ({ page }) => {
  test.setTimeout(100_000);
  await page.goto('/?controls=1'); await finishMath(page, math); await returnHome(page);
  await page.getByRole('button', { name: 'Góc phụ huynh', exact: true }).click();
  const parent = page.getByRole('region', { name: 'Quản lý đổi sao' });
  await expect(parent).toContainText('Thành tích vẫn giữ đủ 3 sao');
  await parent.getByLabel('Cho phép con đổi sao').check();
  await parent.getByLabel('Giá trị 1 sao (đồng)').fill('1000');
  page.once('dialog', dialog => dialog.accept());
  await parent.getByRole('button', { name: 'Lưu tỷ lệ đổi sao', exact: true }).click();
  await expect(parent.getByRole('status')).toContainText('Đã lưu tỷ lệ');
  await page.getByRole('button', { name: 'Thế giới game', exact: true }).click();
  await page.getByRole('button', { name: 'Ví đổi sao', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Ví đổi sao của con', exact: true });
  const child = dialog.getByRole('region', { name: 'Ví đổi sao', exact: true });
  await child.getByLabel('Món đồ con muốn').fill('Bút chì từ sao game');
  await child.getByLabel('Mục tiêu tiền (đồng)').fill('1000');
  await child.getByRole('button', { name: 'Gửi ước muốn cho phụ huynh', exact: true }).click();
  await expect(child).toContainText('2 sao khả dụng');
  await expect(child).toContainText('1 sao đang chờ');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await page.getByRole('button', { name: 'Góc phụ huynh', exact: true }).click();
  page.once('dialog', confirm => confirm.accept());
  await parent.getByRole('button', { name: 'Duyệt Bút chì từ sao game', exact: true }).click();
  const handover = parent.getByRole('button', { name: 'Xác nhận đã trao Bút chì từ sao game', exact: true });
  await expect(handover).toBeVisible();
  page.once('dialog', confirm => confirm.accept()); await handover.click();
  await expect(parent).toContainText('1 sao đã đổi');
  await expect(parent).toContainText('Thành tích vẫn giữ đủ 3 sao');
  await page.getByRole('button', { name: 'Thế giới game', exact: true }).click();
  await finishMath(page, math); await returnHome(page); await balance(page, 3, 2);
  await page.reload(); await balance(page, 3, 2);
});
