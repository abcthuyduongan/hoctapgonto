import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {cloudBrowserFixture} from '../helpers/cloud-browser-fixture.mjs';
import {seedRewardJourney} from '../helpers/reward-journey.mjs';

test('PIN-protected SafeTime tab shows only the permitted child, pairing code and device',async({page},testInfo)=>{
 const f=await cloudBrowserFixture();
 try{
  async function post(route:string,data:unknown){const me=route==='/setup'||route==='/login'?null:await(await page.request.get(f.origin+'/api/online/me')).json();const r=await page.request.post(f.origin+'/api/online'+route,{headers:{Origin:f.origin,...(me?{'X-CSRF-Token':me.csrfToken}:{})},data});expect(r.ok(),await r.text()).toBe(true);return r.json();}
  const admin=await post('/setup',{token:f.token,name:'SafeTime UI',username:'safetime.ui.admin',password:f.password});
  const cls=await post('/classes',{name:'Lớp 3',grade:3});
  const a=(await post('/students',{classId:cls.id,name:'Bảo An',username:'safetime.ui.a',password:f.password})).student;
  const b=(await post('/students',{classId:cls.id,name:'Bạn khác',username:'safetime.ui.b',password:f.password})).student;
  await post('/parent/setup-pin',{studentId:a.id,pin:'735291'});
  const otherCode=await post('/parent/safetime/pair-code',{studentIds:[b.id]});
  await f.store.createIntegrationClient(admin.workspace.id,{tokenHash:'ui-device-a',deviceId:'ui-a',deviceName:'Máy của Bảo An',allowedStudentIds:[a.id]});
  await f.store.createIntegrationClient(admin.workspace.id,{tokenHash:'ui-device-b',deviceId:'ui-b',deviceName:'Máy bạn khác',allowedStudentIds:[b.id]});
  await seedRewardJourney(post,cls.id);
  await page.context().clearCookies();await post('/login',{username:'safetime.ui.a',password:f.password});
  for(const width of [390,1440]){
   await page.setViewportSize({width,height:1000});await page.goto(f.origin+'/?online=1');
   const parent=page.getByRole('button',{name:'Mở khu phụ huynh',exact:true});if(width<=1024)await page.locator('.account-menu-trigger').click();await parent.click();
   const pin=page.getByRole('dialog',{name:'Khu vực dành cho Phụ huynh',exact:true});await pin.getByLabel('Mã PIN',{exact:true}).fill('735291');await pin.getByRole('button',{name:'Xác nhận',exact:true}).click();
   await page.getByRole('button',{name:/Kết nối SafeTime/}).click();const tab=page.locator('.parent-safetime-view');
   await expect(tab.getByText('Máy của Bảo An',{exact:true})).toBeVisible();await expect(tab.getByText('Máy bạn khác',{exact:true})).toHaveCount(0);
   await expect(tab.getByRole('checkbox')).toHaveCount(1);await expect(tab).not.toContainText(otherCode.code);
   await tab.getByRole('checkbox',{name:/Bảo An/}).check();await tab.getByRole('button',{name:'Tạo mã ghép đôi (10 phút)',exact:true}).click();
   await expect(tab.getByRole('region',{name:'Mã ghép đôi SafeTime',exact:true})).toBeVisible();
   expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
   const scan=await new AxeBuilder({page}).include('.parent-safetime-view').analyze();expect(scan.violations.filter(v=>['serious','critical'].includes(v.impact??''))).toEqual([]);
   await page.screenshot({path:testInfo.outputPath(`safetime-parent-${width}.png`),fullPage:true});
  }
  await page.goto(f.origin+'/?mode=list#/hoc/toan');await expect(page.locator('.region-map-container')).toBeVisible();
  await page.evaluate(()=>{location.hash='#/ban-do';});await expect(page.locator('.world-map-container')).toBeVisible();
  const summary=await(await page.request.get(f.origin+'/api/online/student/summary?cursor=current')).json();expect(summary.balance.earned).toBe(0);
 }finally{await f.close();}
});
