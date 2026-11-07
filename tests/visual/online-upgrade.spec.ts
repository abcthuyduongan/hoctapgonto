import {test,expect} from '@playwright/test';
import {cloudBrowserFixture} from '../helpers/cloud-browser-fixture.mjs';
import AxeBuilder from '@axe-core/playwright';

for(const pin of ['7352','73529','735291'])test(`existing ${pin.length}-digit parent PIN opens the portal without replacing settings`,async({page})=>{
  const f=await cloudBrowserFixture();
  try{
    async function post(route:string,data:unknown,csrf=''){
      const response=await page.request.post(f.origin+'/api/online'+route,{headers:{Origin:f.origin,...(csrf?{'X-CSRF-Token':csrf}:{})},data});
      expect(response.ok(),await response.text()).toBe(true);return response.json();
    }
    const admin=await post('/setup',{token:f.token,name:'Upgrade compatibility',username:'upgrade.admin',password:f.password});
    const cls=await post('/classes',{name:'Lớp nâng cấp',grade:3},admin.csrfToken);
    const {student}=await post('/students',{classId:cls.id,name:'An nâng cấp',username:'upgrade.child',password:f.password},admin.csrfToken);
    await post('/parent/setup-pin',{studentId:student.id,pin},admin.csrfToken);
    await page.context().clearCookies();await post('/login',{username:'upgrade.child',password:f.password});
    await page.goto(f.origin+'/?online=1');await page.getByRole('button',{name:'Mở khu phụ huynh',exact:true}).click();
    const dialog=page.getByRole('dialog',{name:'Khu vực dành cho Phụ huynh',exact:true});await expect(dialog).toBeVisible();
    await dialog.getByLabel('Mã PIN',{exact:true}).fill(pin);
    await expect(dialog.getByRole('button',{name:'Xác nhận',exact:true})).toBeEnabled();
    await dialog.getByRole('button',{name:'Xác nhận',exact:true}).click();
    await expect(page.locator('.parent-portal-root')).toBeVisible();
    await expect(page.locator('.parent-header h1')).toContainText('Khu Phụ Huynh');
  }finally{await f.close();}
});

test('assigned map, header, mobile navigation and modal keyboard focus work across seven widths',async({page},testInfo)=>{
  const f=await cloudBrowserFixture();const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  try{
    async function post(route:string,data:unknown,csrf=''){
      const response=await page.request.post(f.origin+'/api/online'+route,{headers:{Origin:f.origin,...(csrf?{'X-CSRF-Token':csrf}:{})},data});expect(response.ok(),await response.text()).toBe(true);return response.json();
    }
    const admin=await post('/setup',{token:f.token,name:'Trường học kiểm tra giao diện',username:'layout.admin',password:f.password});
    const cls=await post('/classes',{name:'Lớp hành trình đủ môn',grade:3},admin.csrfToken);
    await post('/students',{classId:cls.id,name:'Bảo An kiểm tra giao diện',username:'layout.child',password:f.password},admin.csrfToken);
    await post('/weeks',{requestId:'layout-week',classId:cls.id,title:'Tuần 01',sets:['Toán','Tiếng Việt','Tiếng Anh','Tin học'].map((subjectLabel,i)=>({subjectLabel,pack:{id:'layout-'+i,version:1,grade:3,subject:'thinking',source:'local',publishedAt:'2026-11-07T00:00:00Z',kind:'quiz',title:'Bộ '+subjectLabel,items:[1,2].map(n=>({id:'layout-'+i+'-'+n,kind:'multiple-choice',objectiveId:'LAYOUT',prompt:`${subjectLabel}: câu ${n}`,options:['Đúng','Sai 1','Sai 2','Sai 3'],correctIndex:0,explanation:'Lời giải.'}))}}))},admin.csrfToken);
    await page.context().clearCookies();await post('/login',{username:'layout.child',password:f.password});
    for(const width of [320,390,620,768,1024,1440,1920]){
      await page.setViewportSize({width,height:width<768?844:900});await page.goto(f.origin+'/?online=1');
      await expect(page.locator('.daily-journey-card')).toBeVisible();await page.evaluate(()=>document.fonts.ready);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
      const bounds=await page.locator('.student-topbar').evaluate(header=>{
        const box=header.getBoundingClientRect();return{height:box.height,escaped:Array.from(header.querySelectorAll('button,a')).filter(element=>element.getClientRects().length).filter(element=>{const r=element.getBoundingClientRect();return r.left<box.left-1||r.right>box.right+1||r.top<box.top-1||r.bottom>box.bottom+1;}).map(element=>element.getAttribute('aria-label')||element.textContent)};
      });
      expect(bounds.height).toBe(width<=1024?56:64);expect(bounds.escaped,`header overflow at ${width}`).toEqual([]);
      if(width<=1024)await expect(page.getByRole('navigation',{name:'Thanh điều hướng học sinh'}).getByRole('button')).toHaveCount(5);
      const account=page.getByRole('button',{name:/^Mở tùy chọn tài khoản/});await account.focus();await page.keyboard.press('Enter');
      await expect(page.locator('.account-menu-popover button').first()).toBeFocused();await page.keyboard.press('Escape');await expect(account).toBeFocused();
      const mission=page.getByRole('button',{name:/nhiệm vụ/i}).filter({visible:true});await mission.click();
      const dialog=page.getByRole('dialog',{name:/Nhiệm Vụ Ngày/i});await expect(dialog).toBeVisible();
      expect(await dialog.evaluate(element=>element.contains(document.activeElement))).toBe(true);
      const controls=dialog.locator('button:visible:not([disabled])');await controls.first().focus();await page.keyboard.press('Shift+Tab');await expect(controls.last()).toBeFocused();await page.keyboard.press('Tab');await expect(controls.first()).toBeFocused();
      await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
      await page.screenshot({path:testInfo.outputPath(`assigned-world-${width}.png`),fullPage:true});
      if(width===390||width===1440){
        const scan=await new AxeBuilder({page}).analyze();expect(scan.violations.filter(v=>['critical','serious'].includes(v.impact??''))).toEqual([]);
      }
    }
    expect(errors).toEqual([]);
  }finally{await f.close();}
});

test('shared dialog traps keyboard focus and returns focus to its opener',async({page})=>{
  const f=await cloudBrowserFixture();
  try{
    await page.goto(f.origin+'/?ui=1');const opener=page.getByRole('button',{name:'Mở hộp thoại thử nghiệm',exact:true});await opener.click();
    const dialog=page.getByRole('dialog',{name:'Hộp thoại chuẩn Bảo An',exact:true});await expect(dialog).toBeVisible();
    const buttons=dialog.getByRole('button');await buttons.first().focus();await page.keyboard.press('Shift+Tab');await expect(buttons.last()).toBeFocused();await page.keyboard.press('Tab');await expect(buttons.first()).toBeFocused();
    await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(opener).toBeFocused();
  }finally{await f.close();}
});
