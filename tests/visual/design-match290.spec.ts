import { test, expect } from '@playwright/test';

/** Run against the ACTUAL React app, not the standalone preview. */
for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
  { width: 320, height: 700 },
]) {
  test(`Design 2.9: full interactive home remains contained at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expect(page.locator('.portal273-world')).toHaveCount(3);
    await expect(page.locator('.portal273-start')).toHaveCount(3);
    await expect(page.getByText('Thế giới học tập')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBeTruthy();
    const failedAssets = await page.locator('img').evaluateAll(imgs => imgs.filter(i => i.offsetWidth > 0 && (!i.complete || i.naturalWidth === 0)).map(i => i.getAttribute('src')));
    expect(failedAssets, `Broken imagery: ${failedAssets.join(', ')}`).toEqual([]);
    await page.screenshot({path:`visual-output/design290-home-${viewport.width}.png`,fullPage:true});
  });
}

test('Design 2.9: Memory Match remains playable after choosing two cards', async ({ page }) => {
  await page.goto('/');
  await page.locator('.portal273-start').nth(1).click();
  const facedown=page.locator('.memory-card:not(.revealed):not(.found)');
  await expect(facedown).toHaveCount(12);
  await facedown.nth(0).click();
  await facedown.nth(1).click();
  // Same-pair or different-pair selections must both lead to unlocked remainder.
  await expect.poll(async () => page.locator('.memory-card:not([disabled])').count(), {timeout:5500}).toBeGreaterThan(0);
  await expect(page.locator('.forest-board')).toBeVisible();
  await page.screenshot({path:'visual-output/design290-memory-react.png'});
});

test('Design 2.9: Math Quiz does not move question/answers after feedback', async ({ page }) => {
  await page.goto('/');
  await page.locator('.portal273-start').first().click();
  const answers=page.locator('.answer-grid');
  const before=await answers.boundingBox();
  await page.locator('.answer-option').first().click();
  await expect(page.locator('.answer-feedback')).toBeVisible();
  const after=await answers.boundingBox();
  expect(Math.abs((after?.y??0)-(before?.y??0))).toBeLessThanOrEqual(2);
  await page.screenshot({path:'visual-output/design290-math-react.png'});
});
