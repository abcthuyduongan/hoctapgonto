import {test,expect,type Page} from '@playwright/test';
import {cloudBrowserFixture} from '../helpers/cloud-browser-fixture.mjs';

async function studentFixture(page:Page){
  const f=await cloudBrowserFixture();
  async function api(route:string,body:unknown,csrf=''){
    const response=await page.request.post(f.origin+'/api/online'+route,{headers:{Origin:f.origin,...(csrf?{'X-CSRF-Token':csrf}:{})},data:body});
    expect(response.ok(),await response.text()).toBe(true);return response.json();
  }
  try{
    const admin=await api('/setup',{token:f.token,name:'Password school',username:'password.admin',password:f.password});
    const cls=await api('/classes',{name:'Password class',grade:3},admin.csrfToken);
    await api('/students',{name:'Password student',classId:cls.id,username:'password.child',password:f.password},admin.csrfToken);
    await page.context().clearCookies();await api('/login',{username:'password.child',password:f.password});
    return f;
  }catch(error){await f.close();throw error;}
}

test('opening password change cancels a pending journey read and closing resumes it',async({page})=>{
  const f=await studentFixture(page);let release=()=>{},intercepted=0,aborted=0;
  const held=new Promise<void>(resolve=>{release=resolve;});
  page.on('requestfailed',request=>{if(['/api/online/student/summary','/api/online/student/journey'].includes(new URL(request.url()).pathname))aborted++;});
  await page.route(/\/api\/online\/student\/(?:summary|journey)(?:\?.*)?$/,async route=>{intercepted++;if(intercepted===1)await held;await route.continue().catch(()=>{});});
  try{await page.goto(f.origin+'/');await expect.poll(()=>intercepted).toBe(1);await page.getByRole('button',{name:'Đổi mật khẩu',exact:true}).click();await expect(page.getByRole('dialog',{name:'Đổi mật khẩu',exact:true})).toBeVisible();await expect.poll(()=>aborted).toBe(1);release();await page.getByRole('dialog').getByRole('button',{name:'Đóng ✕',exact:true}).click();await expect.poll(()=>intercepted).toBe(2);await expect(page.getByRole('heading',{name:'Chờ bộ câu hỏi của thầy cô',exact:true})).toBeVisible();}
  finally{release();await page.unrouteAll({behavior:'ignoreErrors'});await f.close();}
});

for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){
  test(`student changes their password in a lazy accessible dialog at ${viewport.width}px`,async({page},testInfo)=>{
    await page.setViewportSize(viewport);const f=await studentFixture(page),newPassword=' New-browser-password-2026! ';
    let dialogLoads=0,requests=0,release=()=>{};
    page.on('request',request=>{if(/\/assets\/OnlinePasswordDialog-[^/]+\.js$/.test(request.url()))dialogLoads++;});
    await page.route('**/models/*.glb',route=>route.fulfill({status:404,contentType:'text/plain',body:'Fixture scene unavailable'}));
    try{
      await page.goto(f.origin+'/');const open=page.getByRole('button',{name:'Đổi mật khẩu',exact:true});await expect(open).toBeVisible();expect(dialogLoads).toBe(0);
      await open.click();const dialog=page.getByRole('dialog',{name:'Đổi mật khẩu',exact:true});await expect(dialog).toBeVisible();await expect.poll(()=>dialogLoads).toBe(1);
      await dialog.getByLabel('Mật khẩu hiện tại',{exact:true}).fill('Incorrect-password-2026');
      await dialog.getByLabel('Mật khẩu mới',{exact:true}).fill(newPassword);await dialog.getByLabel('Nhập lại mật khẩu mới',{exact:true}).fill('Different-confirmation-2026');
      page.on('request',request=>{if(new URL(request.url()).pathname==='/api/online/account/password')requests++;});
      await dialog.getByRole('button',{name:'Lưu mật khẩu mới',exact:true}).click();await expect(dialog.getByRole('alert')).toContainText('chưa khớp');expect(requests).toBe(0);
      await dialog.getByLabel('Nhập lại mật khẩu mới',{exact:true}).fill(newPassword);
      await dialog.getByRole('button',{name:'Lưu mật khẩu mới',exact:true}).click();await expect(dialog.getByRole('alert')).toContainText('Mật khẩu hiện tại chưa đúng');expect(requests).toBe(1);
      await expect(page.getByRole('heading',{name:'Chào mừng bạn trở lại',exact:true})).toHaveCount(0);
      const bounds=await dialog.boundingBox();expect(bounds).not.toBeNull();expect(bounds!.x).toBeGreaterThanOrEqual(0);expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(viewport.width);
      await page.screenshot({path:testInfo.outputPath(`password-dialog-${viewport.width}.png`)});
      await dialog.getByLabel('Mật khẩu hiện tại',{exact:true}).fill(f.password);
      const held=new Promise<void>(resolve=>{release=resolve;});await page.route('**/api/online/account/password',async route=>{await held;await route.continue();});
      await dialog.getByRole('button',{name:'Lưu mật khẩu mới',exact:true}).click();await expect(dialog.getByRole('button',{name:'Đang đổi mật khẩu…',exact:true})).toBeDisabled();
      await expect(dialog.getByRole('button',{name:'Đóng ✕',exact:true})).toBeDisabled();await page.keyboard.press('Escape');await expect(dialog).toBeVisible();expect(requests).toBe(2);
      release();await expect(dialog.getByRole('status')).toContainText('Đã đổi mật khẩu thành công');await expect(dialog.getByRole('status')).toContainText('Tiến độ và sao đã được giữ nguyên');
      await expect(dialog.getByRole('button',{name:'Đăng nhập lại',exact:true})).toBeFocused();await expect(dialog.locator('input')).toHaveCount(0);
      await dialog.getByRole('button',{name:'Đăng nhập lại',exact:true}).click();await expect(page.getByRole('heading',{name:'Chào mừng bạn trở lại',exact:true})).toBeVisible();
      await page.getByLabel('Tên đăng nhập',{exact:true}).fill('password.child');await page.getByLabel('Mật khẩu',{exact:true}).fill(f.password);await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();
      await expect(page.getByRole('alert')).toContainText('Tên đăng nhập hoặc mật khẩu chưa đúng');
      await page.getByLabel('Mật khẩu',{exact:true}).fill(newPassword);await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();await expect(open).toBeVisible();
      const privateStorage=await page.evaluate(()=>JSON.stringify({local:{...localStorage},session:{...sessionStorage}}));expect(privateStorage).not.toContain(newPassword);expect(privateStorage).not.toContain(f.password);
    }finally{release();await page.unrouteAll({behavior:'ignoreErrors'});await f.close();}
  });
}
