import { test,expect } from '@playwright/test';

test('Alpha 2.8 Math Quest: saved answer reveals reaction without moving the board',async ({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');
  await page.locator('.portal273-start').first().click();
  const grid=page.locator('.answer-grid');
  await expect(grid).toBeVisible();
  const before=await grid.boundingBox();
  await page.locator('.answer-option').first().click();
  await expect(page.locator('.stable-response-zone')).toHaveClass(/has-result/);
  await expect(page.locator('.game-reaction')).toHaveCount(1);
  const after=await grid.boundingBox();
  expect(before && after).toBeTruthy();
  expect(Math.abs((before?.y||0)-(after?.y||0))).toBeLessThanOrEqual(1);
});

test('Alpha 2.8: disabling motion hides reaction particles',async ({page})=>{
  await page.goto('/');
  const button=page.getByRole('button',{name:/Hiệu ứng/});
  if ((await button.getAttribute('aria-pressed'))==='true')await button.click();
  await page.locator('.portal273-start').first().click();
  await page.locator('.answer-option').first().click();
  await expect(page.locator('.game-reaction')).toBeHidden();
});

test('Alpha 2.8: completion overlays current scene instead of replacing its answer grid',async ({page})=>{
  await page.goto('/');
  await page.locator('.portal273-start').first().click();
  for(let i=0;i<8;i++) {
    await expect(page.locator('.answer-grid')).toBeVisible();
    await page.locator('.answer-option').first().click();
    await expect(page.locator('.result-next')).toBeEnabled();
    await page.locator('.result-next').click();
  }
  await expect(page.locator('.premium-reward-panel')).toBeVisible();
  await expect(page.locator('.answer-grid')).toHaveCount(1);
  await expect(page.locator('.premium-reward-stars span')).toHaveCount(3);
});
