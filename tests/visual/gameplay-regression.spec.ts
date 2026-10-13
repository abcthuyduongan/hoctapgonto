import { expect, test, type Page } from '@playwright/test';
import { BUILTIN_PACKS } from '../../src/core/seed';
import type { LearningEvent, PlaySession, QuizPack, PairsPack, SentencePack } from '../../src/core/contracts';

// These reads inspect the actual production origin's IndexedDB. The application
// creates its own database and sessions; tests never replace the storage adapter.
async function history(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('bao-an-learning-v3-alpha', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const read = (name: string) => new Promise<unknown[]>((resolve, reject) => {
        const transaction = db.transaction(name, 'readonly');
        const request = transaction.objectStore(name).getAll();
        transaction.oncomplete = () => resolve(request.result);
        transaction.onerror = () => reject(transaction.error);
      });
      const [sessions, events, packs] = await Promise.all([read('sessions'), read('events'), read('packs')]);
      return { sessions, events, packs, version: db.version, stores: [...db.objectStoreNames] };
    } finally { db.close(); }
  }) as Promise<{ sessions: PlaySession[]; events: LearningEvent[]; packs: { key: string; pack: QuizPack }[]; version: number; stores: string[] }>;
}

async function openGame(page: Page, moduleId: string) {
  await page.locator(`.ba3d-${moduleId} .ba3d-play`).click();
  await expect(page.locator('.immersive-dialog')).toBeVisible();
}

async function assertCompleted(page: Page, moduleId: string, packId: string, itemCount: number, eventCount = itemCount) {
  await expect(page.locator('.reward-panel')).toBeVisible();
  const saved = await history(page);
  expect(saved.version).toBe(1);
  expect(saved.stores).toEqual(['events', 'packs', 'sessions']);
  expect(saved.sessions).toHaveLength(1);
  const session = saved.sessions[0];
  expect(session).toMatchObject({ moduleId, packId, contentVersion: 1, status: 'completed' });
  expect(Date.parse(session.endedAt!)).toBeGreaterThanOrEqual(Date.parse(session.startedAt));
  expect(saved.events).toHaveLength(eventCount);
  expect(new Set(saved.events.map(event => event.eventId)).size).toBe(eventCount);
  expect(saved.events.filter(event => event.correct)).toHaveLength(itemCount);
  saved.events.forEach(event => {
    expect(event).toMatchObject({ sessionId: session.sessionId, moduleId, packId, contentVersion: 1, moduleVersion: session.moduleVersion });
    expect(event.itemId).not.toBe('');
    expect(event.objectiveId).not.toBe('');
    expect(event.elapsedMs).toBeGreaterThanOrEqual(0);
  });
  await page.locator('.reward-home').click();
  await page.reload();
  await expect(page.locator('.ba3d-play')).toHaveCount(3);
  const refreshed = await history(page);
  expect(refreshed.sessions).toEqual(saved.sessions);
  expect(refreshed.events).toEqual(saved.events);
  await page.getByRole('button', { name: /Góc phụ huynh/ }).click();
  await expect(page.locator('.screen-space')).toBeVisible();
  return saved;
}

test('Math Quest completes all 8 answers once, including rapid answer/next clicks, and persists after refresh', async ({ page }) => {
  const pack = BUILTIN_PACKS.find(pack => pack.id === 'math3-adventure') as QuizPack;
  expect(pack.items).toHaveLength(8);
  await page.goto('/?premium3d=1');
  await openGame(page, 'math-quest');
  for (let index = 0; index < pack.items.length; index++) {
    const item = pack.items[index];
    await expect(page.locator('.quiz-question')).toHaveText(item.prompt);
    const answer = page.locator('.answer-option').nth(item.correctIndex);
    if (index === 0) await answer.evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click(); });
    else await answer.click();
    await expect(page.locator('.answer-feedback')).toContainText('Chính xác');
    expect((await history(page)).events).toHaveLength(index + 1);
    const next = page.locator('.result-next');
    if (index === 0) await next.evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click(); });
    else await next.click();
  }
  await assertCompleted(page, 'math-quest', pack.id, pack.items.length);
});

test('Memory Match recovers from rapid mismatched taps, completes 6 pairs and preserves exactly 7 attempts', async ({ page }) => {
  const pack = BUILTIN_PACKS.find(pack => pack.id === 'english3-family') as PairsPack;
  expect(pack.items).toHaveLength(6);
  await page.goto('/?premium3d=1');
  await openGame(page, 'memory-match');
  await expect(page.locator('.memory-card')).toHaveCount(12);
  const card = (label: string) => page.locator('.memory-card').filter({ has: page.getByText(label, { exact: true }) });
  const indices = await page.locator('.memory-front').allTextContents();
  await page.locator('.memory-grid').evaluate((grid, chosen) => {
    const cards = [...grid.querySelectorAll<HTMLButtonElement>('.memory-card')];
    cards[chosen[0]].click(); cards[chosen[0]].click();
    cards[chosen[1]].click(); cards[chosen[2]].click();
  }, [indices.indexOf(pack.items[0].left), indices.indexOf(pack.items[1].left), indices.indexOf(pack.items[2].left)]);
  await expect(page.locator('.memory-feedback-message')).toContainText(/chưa khớp/i);
  await expect(page.locator('.memory-card:not(:disabled)')).toHaveCount(12);
  expect((await history(page)).events).toHaveLength(1);
  for (let index = 0; index < pack.items.length; index++) {
    const pair = pack.items[index];
    await card(pair.left).click();
    await card(pair.right).click();
    await expect(page.locator('.memory-card.found')).toHaveCount((index + 1) * 2);
  }
  await assertCompleted(page, 'memory-match', pack.id, pack.items.length, 7);
});

test('Sentence Builder completes the actual 6-sentence seed, rejects invalid drag indices and persists', async ({ page }) => {
  const pack = BUILTIN_PACKS.find(pack => pack.id === 'english3-sentences') as SentencePack;
  // The plan mentions 5 sentences; the preserved V3.6.2 seed contains 6.
  expect(pack.items).toHaveLength(6);
  await page.goto('/?premium3d=1');
  await openGame(page, 'sentence-builder');
  for (const value of ['-1', '999', '0.5', 'abc']) {
    await page.locator('.sentence-drop').evaluate((drop, raw) => {
      const dataTransfer = new DataTransfer(); dataTransfer.setData('text/plain', raw);
      drop.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer }));
    }, value);
  }
  await expect(page.locator('.sentence-drop .word-tile')).toHaveCount(0);
  for (const item of pack.items) {
    await expect(page.locator('.sentence-prompt')).toHaveText(item.prompt);
    for (const word of item.words) await page.locator('.sentence-bank').getByRole('button', { name: word, exact: true }).click();
    await page.getByRole('button', { name: /Kiểm tra câu/ }).click();
    await expect(page.locator('.sentence-result-reserve')).toContainText('Chính xác');
    await page.locator('.sentence-main-action').click();
  }
  await assertCompleted(page, 'sentence-builder', pack.id, pack.items.length);
});

test('Refreshing an active game abandons its session without losing the recorded answer', async ({ page }) => {
  await page.goto('/?premium3d=1');
  await openGame(page, 'math-quest');
  await page.locator('.answer-option').first().click();
  await expect(page.locator('.result-next')).toBeVisible();
  const prior = await history(page);
  expect(prior.sessions[0].status).toBe('active');
  await page.reload();
  await expect(page.locator('.ba3d-play')).toHaveCount(3);
  const saved = await history(page);
  expect(saved.sessions[0]).toMatchObject({ sessionId: prior.sessions[0].sessionId, status: 'abandoned' });
  expect(saved.events).toEqual(prior.events);
  await openGame(page, 'math-quest');
  await page.getByRole('button', { name: /Thoát trò chơi/ }).click();
  expect((await history(page)).sessions.map(session => session.status)).toEqual(['abandoned', 'abandoned']);
});

test('Closing and reopening a tab on the same origin preserves the answer and abandons the interrupted session', async ({ page, context }) => {
  await page.goto('/?premium3d=1');
  await openGame(page, 'math-quest');
  await page.locator('.answer-option').first().click();
  await expect(page.locator('.result-next')).toBeVisible();
  const beforeClose = await history(page);
  await page.close();
  const reopened = await context.newPage();
  await reopened.goto('/?premium3d=1');
  await expect(reopened.locator('.ba3d-play')).toHaveCount(3);
  const saved = await history(reopened);
  expect(saved.events).toEqual(beforeClose.events);
  expect(saved.sessions).toHaveLength(1);
  expect(saved.sessions[0]).toMatchObject({ sessionId: beforeClose.sessions[0].sessionId, status: 'abandoned' });
  await openGame(reopened, 'math-quest');
  expect((await history(reopened)).sessions).toHaveLength(2);
});

test('A new teacher JSON pack imports through the UI, plays fully and survives refresh without overwriting', async ({ page }) => {
  const original = BUILTIN_PACKS.find(pack => pack.id === 'math3-adventure') as QuizPack;
  const pack: QuizPack = { ...original, id: 'qa-v37-quiz', title: 'QA V3.7 · Hai câu toán mới', source: 'local', items: [
    { ...original.items[0], id: 'qa-new-1', prompt: '11 + 12 = ?', options: ['22', '23', '24', '25'], correctIndex: 1, explanation: '11 + 12 = 23.' },
    { ...original.items[1], id: 'qa-new-2', prompt: '6 × 5 = ?', options: ['25', '35', '30', '40'], correctIndex: 2, explanation: '6 × 5 = 30.' },
  ] };
  const file = { name: 'qa-v37-content.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ schema: 'baoan-learning-content', formatVersion: 1, packs: [pack] })) };
  await page.goto('/?premium3d=1');
  await page.getByRole('button', { name: /Xưởng học liệu/ }).click();
  await page.getByLabel('Chọn tệp bộ học liệu JSON').setInputFiles(file);
  await expect(page.getByRole('status')).toContainText('Đã nhập 1 bộ mới');
  await page.getByLabel('Chọn tệp bộ học liệu JSON').setInputFiles(file);
  await expect(page.getByRole('status')).toContainText('Đã nhập 0 bộ mới');
  expect((await history(page)).packs).toHaveLength(1);
  await page.getByRole('button', { name: /Thế giới game/ }).click();
  await page.getByLabel('Chọn bộ học liệu cho Math Quest').selectOption(`${pack.id}@1`);
  await openGame(page, 'math-quest');
  for (const item of pack.items) {
    await expect(page.locator('.quiz-question')).toHaveText(item.prompt);
    await page.locator('.answer-option').nth(item.correctIndex).click();
    await expect(page.locator('.answer-feedback')).toContainText('Chính xác');
    await page.locator('.result-next').click();
  }
  await assertCompleted(page, 'math-quest', pack.id, pack.items.length);
  expect((await history(page)).packs[0]).toMatchObject({ key: `${pack.id}@1`, pack: { id: pack.id, version: 1, items: pack.items } });
});
