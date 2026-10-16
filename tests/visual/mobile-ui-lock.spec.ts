import { expect, test, type Locator, type Page } from '@playwright/test';
import { getSceneTheme } from '../../src/world3d/scenes/sceneCatalog';
import type { WorldId } from '../../src/world3d/engine';

test.use({ serviceWorkers: 'block' });
const worlds: WorldId[] = ['math-quest', 'memory-match', 'sentence-builder', 'word-connect', 'sequence-trail'];
const choice = (page: Page, id: WorldId) => page.getByRole('button', { name: `Chọn ${getSceneTheme(id).world}`, exact: true });

const viewports = [
  { width: 1920, height: 1080 }, { width: 1440, height: 900 },
  { width: 1366, height: 768 }, { width: 1024, height: 768 },
  { width: 768, height: 1024 }, { width: 390, height: 844 },
  { width: 375, height: 812 }, { width: 320, height: 640 },
];

async function withinViewportAndClickable(locator: Locator, page: Page, label: string) {
  await expect(locator, label).toBeVisible();
  const box = await locator.boundingBox();
  expect(box, label).not.toBeNull();
  const viewport = page.viewportSize()!;
  expect(box!.x, `${label}: left edge`).toBeGreaterThanOrEqual(-1);
  expect(box!.y, `${label}: top edge`).toBeGreaterThanOrEqual(-1);
  expect(box!.x + box!.width, `${label}: right edge`).toBeLessThanOrEqual(viewport.width + 1);
  expect(box!.y + box!.height, `${label}: bottom edge`).toBeLessThanOrEqual(viewport.height + 1);
  const receivesPointer = await locator.evaluate(element => {
    const box = element.getBoundingClientRect();
    const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
    return hit === element || !!hit && element.contains(hit);
  });
  expect(receivesPointer, `${label}: another layer covers its touch center`).toBe(true);
}

async function noHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({ viewport: innerWidth, root: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
  expect(dimensions.root).toBeLessThanOrEqual(dimensions.viewport);
  expect(dimensions.body).toBeLessThanOrEqual(dimensions.viewport);
}

async function stable(before: ReturnType<Locator['boundingBox']> extends Promise<infer T> ? T : never, locator: Locator, label: string) {
  const after = await locator.boundingBox();
  expect(before, label).not.toBeNull(); expect(after, label).not.toBeNull();
  for (const coordinate of ['x', 'y', 'width', 'height'] as const) {
    expect(Math.abs(after![coordinate] - before![coordinate]), `${label}: ${coordinate}`).toBeLessThanOrEqual(2);
  }
}

for (const viewport of viewports) {
  test(`Premium DOM controls and answer layouts remain usable at ${viewport.width}×${viewport.height}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.goto('/?premium3d=1&controls=1');
    await expect(page.locator('.ba3d-render-host')).toHaveAttribute('data-state', 'ready');
    await noHorizontalOverflow(page);
    const controls = page.locator('.ba3d-island-choice, .top-navigation button');
    await expect(controls).toHaveCount(8);
    for (let index = 0; index < await controls.count(); index++) {
      await withinViewportAndClickable(controls.nth(index), page, `Home control ${index + 1}`);
    }
    for (const id of worlds) {
      await choice(page, id).click();
      const packControls = page.locator(`.ba3d-${id} select, .ba3d-${id} .ba3d-play`);
      await expect(packControls).toHaveCount(2);
      for (const control of await packControls.all()) {
        await withinViewportAndClickable(control, page, `${id} pack/start control`);
        if (viewport.width <= 700) await expect.poll(async () => (await control.boundingBox())!.height, { message: 'Primary touch target height after the selection entrance animation' }).toBeGreaterThanOrEqual(44);
      }
    }
    await testInfo.attach(`premium-home-${viewport.width}x${viewport.height}`, { body: await page.screenshot(), contentType: 'image/png' });
    await choice(page, 'math-quest').click();
    await page.locator('.ba3d-math-quest .ba3d-play').click();
    await expect(page.locator('.quiz-question')).toBeVisible();
    for (const answer of await page.locator('.answer-option').all()) await withinViewportAndClickable(answer, page, 'Math answer');
    const answersBefore = await page.locator('.answer-grid').boundingBox();
    const feedbackBefore = await page.locator('.stable-response-zone').boundingBox();
    await page.locator('.answer-option').first().click();
    await expect(page.locator('.result-next')).toBeVisible();
    await stable(answersBefore, page.locator('.answer-grid'), 'Math answer grid after feedback');
    await stable(feedbackBefore, page.locator('.stable-response-zone'), 'Math feedback reserve');
    await withinViewportAndClickable(page.locator('.result-next'), page, 'Next math challenge');
    await noHorizontalOverflow(page);
    await testInfo.attach(`math-feedback-${viewport.width}x${viewport.height}`, { body: await page.screenshot(), contentType: 'image/png' });
    await page.getByRole('button', { name: /Thoát trò chơi/ }).click();
    await choice(page, 'sentence-builder').click();
    await page.locator('#ba3d-pack-sentence-builder').selectOption('english3-sentences@1');
    await page.locator('.ba3d-sentence-builder .ba3d-play').click();
    await expect(page.locator('.sentence-bank')).toBeVisible();
    for (const word of ['I', 'am', 'a', 'student.']) await page.locator('.sentence-bank').getByRole('button', { name: word, exact: true }).click();
    const sentenceActions = await page.locator('.sentence-actions').boundingBox();
    const sentenceFeedback = await page.locator('.sentence-result-reserve').boundingBox();
    await page.getByRole('button', { name: /Kiểm tra câu/ }).click();
    await expect(page.locator('.sentence-result-reserve')).toContainText('Chính xác');
    await stable(sentenceActions, page.locator('.sentence-actions'), 'Sentence action row');
    await stable(sentenceFeedback, page.locator('.sentence-result-reserve'), 'Sentence feedback reserve');
    await withinViewportAndClickable(page.locator('.sentence-main-action'), page, 'Next sentence');
    await noHorizontalOverflow(page);
  });
}

test('Touch input opens a game and submits Math and Sentence answers on a mobile viewport', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, baseURL, serviceWorkers: 'block' });
  const page = await context.newPage();
  try {
    await page.goto('/?premium3d=1&controls=1');
    await choice(page, 'math-quest').tap();
    await page.locator('.ba3d-math-quest .ba3d-play').tap();
    await page.locator('.answer-option').first().tap();
    await expect(page.locator('.answer-feedback')).toContainText('Chính xác');
    await page.locator('.result-next').tap();
    await expect(page.locator('.quiz-question')).toHaveText('63 − 27 = ?');
    await page.getByRole('button', { name: /Thoát trò chơi/ }).tap();
    await choice(page, 'sentence-builder').tap();
    await page.locator('#ba3d-pack-sentence-builder').selectOption('english3-sentences@1');
    await page.locator('.ba3d-sentence-builder .ba3d-play').tap();
    for (const word of ['I', 'am', 'a', 'student.']) await page.locator('.sentence-bank').getByRole('button', { name: word, exact: true }).tap();
    await page.getByRole('button', { name: /Kiểm tra câu/ }).tap();
    await expect(page.locator('.sentence-result-reserve')).toContainText('Chính xác');
    await page.locator('.sentence-main-action').tap();
    await expect(page.locator('.quest-progress')).toContainText('CÂU 2/6');
  } finally { await context.close(); }
});

test('Keyboard navigation activates DOM game controls, answers and returns focus to the start button', async ({ page }) => {
  await page.goto('/?premium3d=1&controls=1');
  const island = choice(page, 'math-quest');
  for (let index = 0; index < 35; index++) {
    if (await island.evaluate(button => button === document.activeElement)) break;
    await page.keyboard.press('Tab');
  }
  await expect(island).toBeFocused();
  await page.keyboard.press('Enter');
  const start = page.locator('.ba3d-math-quest .ba3d-play');
  let reached = false;
  for (let index = 0; index < 35; index++) {
    await page.keyboard.press('Tab');
    if (await start.evaluate(button => button === document.activeElement)) { reached = true; break; }
  }
  expect(reached, 'Math start is reachable by Tab').toBe(true);
  await page.keyboard.press('Enter');
  await expect(page.locator('.immersive-dialog')).toBeFocused();
  for (let index = 0; index < 12; index++) {
    await page.keyboard.press('Tab');
    if (await page.locator('.answer-option').first().evaluate(button => button === document.activeElement)) break;
  }
  await expect(page.locator('.answer-option').first()).toBeFocused();
  await page.keyboard.press('Space');
  await expect(page.locator('.answer-feedback')).toContainText('Chính xác');
  await page.getByRole('button', { name: /Thoát trò chơi/ }).focus();
  await page.keyboard.press('Enter');
  await expect(start).toBeFocused();
});

test('Reduced motion freezes the skeletal mixer and still permits focus, quality changes and play', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?premium3d=1&controls=1');
  await expect(page.locator('.ba3d-render-host')).toHaveAttribute('data-state', 'ready');
  const stats = () => page.locator('.ba3d-render-host').evaluate(host => JSON.parse((host as HTMLElement).dataset.diagnostics || '{}') as { motion: boolean; animationTime: number; activeClip: string; tier: string });
  await expect.poll(async () => (await stats()).motion).toBe(false);
  const time = (await stats()).animationTime;
  await choice(page, 'math-quest').click();
  await page.getByLabel('Chất lượng cảnh 3D').selectOption('low');
  await expect.poll(async () => (await stats()).tier).toBe('low');
  await page.waitForTimeout(1200);
  expect((await stats()).animationTime).toBe(time);
  expect((await stats()).activeClip).toBe('Idle');
  await page.locator('.ba3d-math-quest .ba3d-play').click();
  await expect(page.locator('.quiz-question')).toBeVisible();
  await page.getByRole('button', { name: /Thoát trò chơi/ }).click();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.getByTitle('Giảm chuyển động').click();
  await expect.poll(async () => (await stats()).motion).toBe(false);
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'off');
  await page.reload();
  await expect(page.locator('.ba3d-render-host')).toHaveAttribute('data-state', 'ready');
  await expect.poll(async () => (await stats()).motion).toBe(false);
});

test('Mobile landscape keeps primary controls within the short viewport', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto('/?premium3d=1&controls=1');
  await expect(page.locator('.ba3d-render-host')).toHaveAttribute('data-state', 'ready');
  await noHorizontalOverflow(page);
  await expect(page.locator('.ba3d-island-choice')).toHaveCount(5);
  for (const id of worlds) {
    await withinViewportAndClickable(choice(page, id), page, 'Landscape island choice');
    await choice(page, id).click();
    const controls = page.locator('.ba3d-play, .ba3d-island-control select');
    await expect(controls).toHaveCount(2);
    for (const control of await controls.all()) await withinViewportAndClickable(control, page, 'Landscape game control');
  }
  await testInfo.attach('premium-mobile-landscape', { body: await page.screenshot(), contentType: 'image/png' });
});
