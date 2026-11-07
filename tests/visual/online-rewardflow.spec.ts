import {test,expect} from '@playwright/test';
import {cloudBrowserFixture} from '../helpers/cloud-browser-fixture.mjs';
import {seedRewardJourney,earnRewardJourney} from '../helpers/reward-journey.mjs';

test('20 photographed gifts, 500-dong conversion and PIN-protected approval complete without duplicate star deductions',async({page},testInfo)=>{
  const f=await cloudBrowserFixture();
  try{
    async function post(route:string,data:unknown){
      const me=route==='/setup'||route==='/login'?null:await(await page.request.get(f.origin+'/api/online/me')).json();
      const r=await page.request.post(f.origin+'/api/online'+route,{headers:{Origin:f.origin,'X-Bao-An-Question-Protocol':'1',...(me?{'X-CSRF-Token':me.csrfToken}:{})},data});expect(r.ok(),await r.text()).toBe(true);return r.json();
    }
    await post('/setup',{token:f.token,name:'Gia đình Bảo An',username:'reward.ui.admin',password:f.password});
    await post('/wallet',{enabled:true,rateVnd:500});
    const cls=await post('/classes',{name:'Lớp 3',grade:3});const {student}=await post('/students',{classId:cls.id,name:'Bảo An',username:'reward.ui.child',password:f.password});
    await post('/parent/setup-pin',{studentId:student.id,pin:'735291'});const sets=await seedRewardJourney(post,cls.id);
    await page.goto(f.origin+'/?online=1');await page.getByRole('button',{name:'Kệ quà',exact:true}).click();
    await page.locator('.gift-preset-panel > summary').click();await expect(page.locator('.gift-preset-grid article')).toHaveCount(20);
    await page.getByRole('button',{name:'Thêm bộ 20 quà · Đặt 1 sao = 500 đồng',exact:true}).click();
    await expect(page.getByRole('status')).toContainText('Đã thêm 20 món quà');
    await page.getByRole('button',{name:'Thêm bộ 20 quà · Đặt 1 sao = 500 đồng',exact:true}).click();
    await expect(page.getByRole('status')).toContainText('giữ nguyên 20 món đã có');
    expect((await(await page.request.get(f.origin+'/api/online/gifts')).json()).length).toBe(20);
    await page.screenshot({path:testInfo.outputPath('admin-20-gifts.png'),fullPage:true});
    await page.context().clearCookies();await post('/login',{username:'reward.ui.child',password:f.password});await earnRewardJourney(post,sets);
    await page.goto(f.origin+'/?online=1');await page.getByRole('button',{name:/^Số sao của con:/}).click();
    const wallet=page.getByRole('dialog',{name:'⭐ Ví đổi sao của con',exact:true});await expect(wallet).toContainText('500');
    await wallet.getByLabel('Món quà con mong muốn',{exact:true}).fill('Tiết kiệm mua sách');await wallet.getByLabel('Mục tiêu tiền (đồng)',{exact:true}).fill('1000');await wallet.getByRole('button',{name:'Gửi ước muốn',exact:true}).click();await expect(wallet).toContainText('Đã gửi ước muốn');await wallet.getByRole('button',{name:'Đóng ✕',exact:true}).click();
    await page.locator('.student-goal-bar').getByRole('button',{name:/Kệ quà/}).click();const shelf=page.getByRole('dialog',{name:'🎁 Kệ quà của con',exact:true});
    await expect(shelf.locator('.gift-card')).toHaveCount(20);const snack=shelf.locator('.gift-card').filter({hasText:'Bim bim bắp ngọt Oishi 32g'});
    await expect(snack.getByRole('button',{name:'Đổi quà ngay',exact:true})).toBeEnabled();await expect(snack.getByRole('img')).toBeVisible();await expect.poll(()=>snack.getByRole('img').evaluate((i:HTMLImageElement)=>i.complete&&i.naturalWidth>0)).toBe(true);
    page.once('dialog',dialog=>dialog.accept());await snack.getByRole('button',{name:'Đổi quà ngay',exact:true}).click();await expect(shelf.getByRole('status')).toBeVisible();await shelf.getByRole('button',{name:'Đóng Kệ quà',exact:true}).click();
    await page.getByRole('button',{name:'Mở khu phụ huynh',exact:true}).click();const pin=page.getByRole('dialog',{name:'Khu vực dành cho Phụ huynh',exact:true});await pin.getByLabel('Mã PIN',{exact:true}).fill('735291');await pin.getByRole('button',{name:'Xác nhận',exact:true}).click();
    await page.getByRole('button',{name:/Duyệt đổi quà/}).click();
    const cash=page.locator('.redemption-card').filter({hasText:'Tiết kiệm mua sách'});await expect(cash).toContainText('2 sao');await expect(cash.locator('.redemption-money')).toContainText('1.000');await expect(cash.getByRole('button',{name:'🎁 Xác nhận đã trao tiền / quà',exact:true})).toHaveCount(0);
    for(const title of ['Tiết kiệm mua sách','Bim bim bắp ngọt Oishi 32g']){
      const card=page.locator('.redemption-card').filter({hasText:title});await card.getByRole('button',{name:'✓ Duyệt quà',exact:true}).click();await expect(card).toContainText('Đã duyệt · Chờ trao');
      page.once('dialog',dialog=>dialog.accept());await card.getByRole('button',{name:'🎁 Xác nhận đã trao tiền / quà',exact:true}).click();await expect(card).toHaveCount(0);await expect(page.locator('.parent-table tr').filter({hasText:title})).toContainText('Đã trao');
    }
    const summary=await(await page.request.get(f.origin+'/api/online/student/summary?cursor=current')).json();expect(summary.balance).toMatchObject({earned:18,available:5,pending:0,redeemed:13});
    const me=await(await page.request.get(f.origin+'/api/online/me')).json();expect((await page.request.post(f.origin+'/api/online/gifts/preset/bao-an-20',{headers:{Origin:f.origin,'X-CSRF-Token':me.csrfToken},data:{}})).status()).toBe(403);
    await page.screenshot({path:testInfo.outputPath('parent-cash-and-gift-fulfilled.png'),fullPage:true});
  }finally{await f.close();}
});
