import { expect, test } from '@playwright/test';

async function noHorizontalOverflow(page: import('@playwright/test').Page) {
  const result=await page.evaluate(()=>({viewport:innerWidth,actual:document.documentElement.scrollWidth}));
  expect(result.actual).toBeLessThanOrEqual(result.viewport+2);
}

test('Alpha 2.7.7: islands and mascot load as real assets on the home screen', async ({page}) => {
  await page.setViewportSize({width:1440,height:900});
  await page.goto('/');
  await expect(page.locator('.portal273-world')).toHaveCount(3);
  await expect(page.locator('.portal273-world .portal273-start')).toHaveCount(3);
  await expect(page.locator('.portal273-world img')).toHaveCount(3);
  await page.locator('.portal273-world img').first().waitFor({state:'visible'});
  const images=await page.locator('.portal273-world img').evaluateAll(els=>els.map(el=>{const i=el as HTMLImageElement; return i.complete&&i.naturalWidth>0;}));
  expect(images).toEqual([true,true,true]);
  await noHorizontalOverflow(page);
});

for (const width of [320,390,768,1024]) {
 test(`Alpha 2.7.7: responsive layout at ${width}px has no horizontal overflow`,async ({page})=>{
  await page.setViewportSize({width,height:width<600?844:900});
  await page.goto('/');
  await expect(page.locator('.portal273-world')).toHaveCount(3);
  await noHorizontalOverflow(page);
 });
}

test('Alpha 2.7.7: Math Quest feedback does not shift answer buttons',async ({page})=>{
  await page.goto('/');
  await page.locator('.portal273-start').first().click();
  const answers=page.locator('.answer-grid');
  await expect(answers).toBeVisible();
  const before=await answers.boundingBox();
  await page.locator('.answer-option').first().click();
  await expect(page.locator('.stable-response-zone')).toHaveClass(/has-result/);
  const after=await answers.boundingBox();
  expect(before).not.toBeNull(); expect(after).not.toBeNull();
  expect(Math.abs((before?.y??0)-(after?.y??0))).toBeLessThanOrEqual(1);
  await noHorizontalOverflow(page);
});

test('Alpha 2.7.7: motion-off disables island floating animation',async ({page})=>{
  await page.goto('/');
  const motion=page.getByRole('button',{name:/Hiệu ứng/});
  if((await motion.getAttribute('aria-pressed'))==='true') await motion.click();
  await expect(page.locator('html')).toHaveAttribute('data-motion','off');
  const value=await page.locator('.portal273-island-art').first().evaluate(el=>getComputedStyle(el).animationName);
  expect(value).toBe('none');
});
