import {test,expect} from '@playwright/test';

test('Bảo An V3.1: scene canvas, three games, controls and no overflow',async({page})=>{
 await page.goto('/');
 await expect(page.locator('canvas.ba3d-canvas')).toBeVisible();
 await expect(page.locator('.ba3d-island-control')).toHaveCount(3);
 await expect(page.getByText('Thế giới học tập').first()).toBeVisible();
 const dimensions=await page.evaluate(()=>({scrollW:document.documentElement.scrollWidth,width:innerWidth}));
 expect(dimensions.scrollW).toBeLessThanOrEqual(dimensions.width);
 await page.screenshot({path:'test-results/real3d-home-desktop.png'});
});

test('Bảo An V3.1: navigate Math Quest and return',async({page})=>{
 await page.goto('/');await page.locator('.ba3d-math-quest .ba3d-play').click();
 await expect(page.locator('.immersive-dialog')).toBeVisible();
 await expect(page.locator('.world-math')).toBeVisible();
 await page.getByRole('button',{name:/Thoát trò chơi/}).click();
 await expect(page.locator('.ba3d-world')).toBeVisible();
});

test('Bảo An V3.1: Memory Match remains clickable after selecting two cards',async({page})=>{
 await page.goto('/');await page.locator('.ba3d-memory-match .ba3d-play').click();
 await expect(page.locator('.memory-card')).toHaveCount(12);
 await page.locator('.memory-card').nth(0).click();
 await page.locator('.memory-card').nth(1).click();
 await page.waitForTimeout(1600);
 const unlocked=await page.locator('.memory-card:not(.found):not([disabled])').count();
 expect(unlocked).toBeGreaterThan(0);
});

test.use({viewport:{width:390,height:844}});
test('Bảo An V3.1: mobile stays within viewport',async({page})=>{
 await page.goto('/');
 await expect(page.locator('.ba3d-play')).toHaveCount(3);
 const box=await page.evaluate(()=>({x:document.documentElement.scrollWidth,y:document.documentElement.scrollHeight,w:innerWidth,h:innerHeight}));
 expect(box.x).toBeLessThanOrEqual(box.w);expect(box.y).toBeLessThanOrEqual(box.h);
 await page.screenshot({path:'test-results/real3d-home-mobile.png'});
});
