import { test,expect } from '@playwright/test';
for(const width of [1440,390,320]) {
 test(`Alpha 2.7.6: Math Quest answer does not shift its controls at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:width===320?700:900});await page.goto('/');
  await page.locator('.portal273-start').first().click();
  await expect(page.locator('.quiz-question')).toBeVisible();
  const before=await page.locator('.stable-response-zone').boundingBox();
  const answers=await page.locator('.answer-grid').boundingBox();
  await page.locator('.answer-option').first().click();
  await expect(page.locator('.stable-response-zone .answer-feedback')).toBeVisible();
  const after=await page.locator('.stable-response-zone').boundingBox();
  const answersAfter=await page.locator('.answer-grid').boundingBox();
  expect(Math.abs((after?.y??0)-(before?.y??0))).toBeLessThanOrEqual(2);
  expect(Math.abs((after?.height??0)-(before?.height??0))).toBeLessThanOrEqual(2);
  expect(Math.abs((answersAfter?.y??0)-(answers?.y??0))).toBeLessThanOrEqual(2);
  await expect(page.locator('.game-dialog')).toBeVisible();
 });
 test(`Alpha 2.7.6: Sentence Builder feedback remains stable at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:width===320?700:900});await page.goto('/');
  await page.locator('.portal273-start').nth(2).click();
  const frame=page.locator('.sentence-result-reserve');
  const before=await frame.boundingBox();
  for(const word of ['I','am','a','student.']) await page.locator('.sentence-bank').getByRole('button',{name:word,exact:true}).click();
  await page.getByRole('button',{name:/Kiểm tra câu/}).click();
  await expect(frame).toContainText('Chính xác');
  const after=await frame.boundingBox();
  expect(Math.abs((after?.y??0)-(before?.y??0))).toBeLessThanOrEqual(2);
  expect(Math.abs((after?.height??0)-(before?.height??0))).toBeLessThanOrEqual(2);
 });
}
test('Alpha 2.7.6: reward overlay preserves active game scene',async({page})=>{
 await page.goto('/');await page.locator('.portal273-start').first().click();
 for(let i=0;i<8;i++){
  await page.locator('.answer-option').first().click();
  await expect(page.locator('.result-next')).toBeVisible();
  await page.locator('.result-next').click();
 }
 await expect(page.locator('.reward-panel')).toBeVisible();
 await expect(page.locator('.math-adventure-layout')).toHaveCount(1);
});
