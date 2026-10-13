import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const OUTPUT='visual-output';
async function snap(page:Page,name:string,game=false) {
  mkdirSync(OUTPUT,{recursive:true});
  const options={path:`${OUTPUT}/${name}.png`,animations:'disabled' as const};
  if(game) await page.locator('.immersive-dialog').screenshot(options);
  else await page.screenshot({...options,fullPage:true});
}
async function launch(page:Page,n:number) {
  await page.locator('.portal273-world .portal273-start').nth(n).click();
  await expect(page.locator('.game-dialog.adventure-dialog')).toBeVisible();
  await expect(page.locator('.world-stage')).toBeVisible();
}
async function exit(page:Page){
  await page.locator('.immersive-dialog .game-dialog-head .button').click();
  await expect(page.locator('.immersive-dialog')).toHaveCount(0);
}
async function noOverflow(page:Page) {
  const widths=await page.evaluate(()=>({w:innerWidth,scroll:document.documentElement.scrollWidth}));
  expect(widths.scroll).toBeLessThanOrEqual(widths.w+2);
}

test('Alpha 2.7.6: three games, learning editor and parent dashboard — desktop',async({page})=>{
  await page.goto('/');
  await expect(page.locator('.portal273-world')).toHaveCount(3);
  await expect(page.getByRole('heading',{name:/Thế giới học tập/})).toBeVisible();
  await snap(page,'01-world-home-1440');
  await launch(page,0);await expect(page.locator('.quiz-question')).toBeVisible();
  await expect(page.locator('.world-guide img')).toHaveJSProperty('complete',true);
  await snap(page,'02-math-1440',true);await exit(page);
  await launch(page,1);await expect(page.locator('.memory-card').first()).toBeVisible();
  await snap(page,'03-memory-1440',true);await exit(page);
  await launch(page,2);await expect(page.locator('.sentence-bank .word-tile').first()).toBeVisible();
  await snap(page,'04-sentence-1440',true);await exit(page);
  await page.locator('.nav-item').filter({hasText:'Góc phụ huynh'}).click();
  await expect(page.getByRole('heading',{name:/Mỗi bước tiến đều đáng ghi nhận/})).toBeVisible();
  await snap(page,'05-parent-1440');
  await page.locator('.nav-item').filter({hasText:'Xưởng học liệu'}).click();
  await expect(page.getByRole('heading',{name:/Creator Studio/})).toBeVisible();
  await snap(page,'06-studio-1440');
});
for(const width of [390,320]) {
 test(`Alpha 2.7.6: ${width}px mobile navigation, games and responsive layout`,async({page})=>{
   await page.setViewportSize({width,height:width===320?700:844});
   await page.goto('/');await noOverflow(page);
   await expect(page.locator('.nav-item')).toHaveCount(3);
   await expect(page.locator('.portal273-start')).toHaveCount(3);
   await snap(page,`07-world-home-${width}`);
   for(let i=0;i<3;i++) {
     await launch(page,i);await noOverflow(page);
     await snap(page,`08-mobile-${width}-game-${i}`,true);
     await exit(page);
   }
 });
}

test('Alpha 2.7.6: sound and reduced-motion state persists',async({page})=>{
 await page.setViewportSize({width:320,height:700});await page.goto('/');
 const sound=page.getByRole('button',{name:/Âm thanh/});
 await sound.click();await expect(sound).toHaveAttribute('aria-pressed','true');
 await page.getByRole('button',{name:/Hiệu ứng/}).click();
 await expect(page.locator('html')).toHaveAttribute('data-motion','off');
 await page.reload();await expect(page.locator('html')).toHaveAttribute('data-motion','off');
});
