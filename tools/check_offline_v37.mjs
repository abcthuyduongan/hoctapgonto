/** Independent V3.6.2 HTML QA. Uses an ephemeral Edge context and file URL;
 * never reads a user's browser profile or edits the HTML/local production data.
 * This legacy/localStorage branch does not claim React premium-renderer parity.
 */
import { chromium, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const target = new URL('../BAO_AN_LEARNING_V3_6_2_PLAYABLE.html', import.meta.url);
const output = new URL('../docs/V37_qa/', import.meta.url);
const digest = async () => createHash('sha256').update(await fs.readFile(target)).digest('hex');
const beforeHash = await digest();
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge' });
const evidence = { date: new Date().toISOString(), branch: 'Unchanged V3.6.2 standalone HTML',
  url: target.href, isolatedBrowserContext: true, browser: browser.version(), headless: true,
  storage: 'localStorage: baoan.real3d.offline1', tests: [], status: 'FAIL', htmlSha256: beforeHash,
  note: 'Independent file-URL legacy-renderer verification. Does not establish React IndexedDB or premium Three.js parity.' };
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto(target.href);
  await expect(page.locator('canvas#world')).toBeVisible();
  await expect(page.locator('[data-play]')).toHaveCount(3);
  expect(await page.evaluate(() => localStorage.getItem('baoan.real3d.offline1'))).toBeNull();
  const open = async id => {
    await page.locator(`[data-play="${id}"]`).click();
    await expect(page.locator('#playLayer')).toBeVisible();
  };
  const complete = async (game, count) => {
    await expect(page.locator('.play-complete')).toContainText(`${count}/${count}`);
    await page.locator('#done').click();
    await expect(page.locator('#playLayer')).toBeHidden();
    evidence.tests.push({ game, completed: count, total: count, pass: true });
  };
  const math = [
    ['12 + 8 = ?', 1], ['24 - 6 = ?', 1], ['7 × 3 = ?', 1], ['36 : 4 = ?', 1],
    ['15 + 7 = ?', 2], ['6 × 4 = ?', 2], ['42 - 15 = ?', 2], ['48 : 6 = ?', 2],
  ];
  await open('math-quest');
  for (const [prompt, correctIndex] of math) {
    await expect(page.locator('.play-question')).toHaveText(prompt);
    await expect(page.locator('.play-answer')).toHaveCount(4);
    await page.locator('.play-answer').nth(correctIndex).click();
    await expect(page.locator('#playFeedback')).toContainText('Chính xác');
  }
  await complete('math-quest', 8);

  await open('memory-match');
  await expect(page.locator('.play-tile')).toHaveCount(12);
  // Explore each initially hidden card through a real click and remember the
  // revealed DOM label. No access to the application's private deck/state.
  const remembered = new Map();
  for (let index = 0; index < 12; index += 2) {
    if (await page.locator('.play-complete').count()) break;
    for (const cardIndex of [index, index + 1]) {
      const card = page.locator('.play-tile').nth(cardIndex);
      await card.click();
      remembered.set((await card.textContent()).trim(), cardIndex);
    }
    await expect(page.locator('.play-tile.up:not(.found)')).toHaveCount(0);
  }
  const pairs = [['mother', 'mẹ'], ['father', 'bố'], ['brother', 'anh / em trai'],
    ['sister', 'chị / em gái'], ['grandmother', 'bà'], ['grandfather', 'ông']];
  for (const [left, right] of pairs) {
    if (await page.locator('.play-complete').count()) break;
    const leftIndex = remembered.get(left), rightIndex = remembered.get(right);
    expect(leftIndex, `Revealed label ${left}`).not.toBeUndefined();
    expect(rightIndex, `Revealed label ${right}`).not.toBeUndefined();
    const leftCard = page.locator('.play-tile').nth(leftIndex);
    if (await leftCard.evaluate(card => card.classList.contains('found'))) continue;
    await leftCard.click();
    await expect(leftCard).toHaveText(left);
    await page.locator('.play-tile').nth(rightIndex).click();
    await expect(page.locator('#playFeedback')).toContainText('Ghép đúng');
    await expect(page.locator('.play-tile.up:not(.found)')).toHaveCount(0);
  }
  await complete('memory-match', 6);

  const sentences = ['The cat is on the mat.', 'My mother is in the kitchen.',
    'I have a new school bag.', 'She likes reading books.', 'We play football after school.'];
  await open('sentence-builder');
  for (let index = 0; index < sentences.length; index++) {
    await expect(page.locator('.play-status')).toContainText(`Câu ${index + 1} / 5`);
    for (const word of sentences[index].replace(/\.$/, '').split(' ')) {
      await page.locator('.play-wordbank').getByRole('button', { name: word, exact: true }).click();
    }
    await page.locator('#checkSentence').click();
    await expect(page.locator('#playFeedback')).toContainText('Chính xác');
  }
  await complete('sentence-builder', 5);
  const history = await page.evaluate(() => JSON.parse(localStorage.getItem('baoan.real3d.offline1') || '[]'));
  expect(history.map(({ game, score, total }) => ({ game, score, total }))).toEqual([
    { game: 'math-quest', score: 8, total: 8 }, { game: 'memory-match', score: 6, total: 6 },
    { game: 'sentence-builder', score: 5, total: 5 },
  ]);
  await page.reload();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('baoan.real3d.offline1') || '[]'))).toEqual(history);
  await expect(page.locator('#totalStars')).toHaveText('19 ngôi sao');
  await expect(page.locator('#completedGames')).toHaveText('3 lượt chơi hoàn thành');
  await page.locator('#parentNav').click();
  await expect(page.locator('.history > div')).toHaveCount(3);
  await expect(page.locator('.history')).toContainText('8/8');
  await expect(page.locator('.history')).toContainText('6/6');
  await expect(page.locator('.history')).toContainText('5/5');
  evidence.historyAfterRefresh = history;
  evidence.persistencePass = true;
  evidence.pageErrors = pageErrors;
  expect(pageErrors).toEqual([]);
  await page.screenshot({ path: fileURLToPath(new URL('offline-history.png', output)) });
  evidence.htmlUnchanged = (await digest()) === beforeHash;
  expect(evidence.htmlUnchanged).toBe(true);
  evidence.status = 'PASS';
  await context.close();
} catch (error) {
  evidence.error = error instanceof Error ? error.message : String(error);
  process.exitCode = 1;
} finally {
  await browser.close();
  await fs.writeFile(new URL('offline-evidence.json', output), JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence, null, 2));
}
