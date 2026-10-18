import {test,expect,type Page} from '@playwright/test';
import {cloudBrowserFixture} from '../helpers/cloud-browser-fixture.mjs';

function gate(){let release=()=>{};const held=new Promise<void>(resolve=>{release=resolve;});return{held,release};}
async function configuredFixture(page:Page){
  const f=await cloudBrowserFixture();
  try{
    const response=await page.request.post(f.origin+'/api/online/setup',{headers:{Origin:f.origin},data:{token:f.token,name:'Startup school',username:'startup.admin',password:f.password}});
    expect(response.ok(),await response.text()).toBe(true);const admin=await response.json();
    const clsResponse=await page.request.post(f.origin+'/api/online/classes',{headers:{Origin:f.origin,'X-CSRF-Token':admin.csrfToken},data:{name:'Startup class',grade:3}});
    expect(clsResponse.ok(),await clsResponse.text()).toBe(true);
    return{...f,admin,cls:await clsResponse.json()};
  }catch(error){await f.close();throw error;}
}

for(const authenticated of[false,true])test(`startup overlaps status and identity without an incorrect auth screen (${authenticated?'existing session':'logged out'})`,async({page},testInfo)=>{
  const f=await configuredFixture(page),status=gate(),identity=gate(),starts:{path:string;at:number}[]=[];
  if(!authenticated)await page.context().clearCookies();
  let statusDone=false,identityDone=false;
  await page.route('**/api/online/status',async route=>{starts.push({path:'status',at:Date.now()});await status.held;await route.continue();statusDone=true;});
  await page.route('**/api/online/me',async route=>{starts.push({path:'me',at:Date.now()});await identity.held;await route.continue();identityDone=true;});
  try{
    await page.goto(f.origin+'/');
    // This cannot pass if /me is only sent after the held /status response.
    await expect.poll(()=>starts.map(row=>row.path).sort()).toEqual(['me','status']);
    expect(statusDone).toBe(false);expect(identityDone).toBe(false);
    await expect(page.getByText('Đang kết nối máy chủ…',{exact:true})).toBeVisible();
    await expect(page.getByRole('heading',{name:'Chào mừng bạn trở lại',exact:true})).toHaveCount(0);
    identity.release();await expect.poll(()=>identityDone).toBe(true);
    await expect(page.getByText('Đang kết nối máy chủ…',{exact:true})).toBeVisible();
    status.release();
    if(authenticated){
      await expect(page.getByRole('heading',{name:'Lớp học & hành trình mỗi tuần',exact:true})).toBeVisible();
      await expect(page.getByRole('heading',{name:'Chào mừng bạn trở lại',exact:true})).toHaveCount(0);
      await page.getByRole('button',{name:'Học liệu tuần',exact:true}).click();
      await expect(page.getByText(/Mỗi hình \/ âm thanh tối đa 2 MB\./)).toBeVisible();
    }else await expect(page.getByRole('heading',{name:'Chào mừng bạn trở lại',exact:true})).toBeVisible();
    expect(starts.filter(row=>row.path==='status')).toHaveLength(1);expect(starts.filter(row=>row.path==='me')).toHaveLength(1);
    await testInfo.attach('startup-overlap',{body:JSON.stringify({authenticated,bothRequestsStartedBeforeEitherResponse:true,startGapMs:Math.abs(starts[0].at-starts[1].at),requests:starts}),contentType:'application/json'});
  }finally{status.release();identity.release();await page.unrouteAll({behavior:'ignoreErrors'});await f.close();}
});

test('an unconfigured server opens setup without waiting for the speculative identity check',async({page})=>{
  const f=await cloudBrowserFixture(),identity=gate();let requested=false,identityDone=false;
  await page.route('**/api/online/me',async route=>{requested=true;await identity.held;await route.continue();identityDone=true;});
  try{
    await page.goto(f.origin+'/');await expect.poll(()=>requested).toBe(true);
    await expect(page.getByRole('heading',{name:'Tạo không gian học tập',exact:true})).toBeVisible();expect(identityDone).toBe(false);
    await expect(page.getByRole('heading',{name:'Chào mừng bạn trở lại',exact:true})).toHaveCount(0);
    identity.release();await expect.poll(()=>identityDone).toBe(true);
    await expect(page.getByRole('heading',{name:'Tạo không gian học tập',exact:true})).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
  }finally{identity.release();await page.unrouteAll({behavior:'ignoreErrors'});await f.close();}
});

for(const failure of['status','identity'] as const)test(`startup preserves ${failure} failures and a retry can recover`,async({page})=>{
  const f=await configuredFixture(page);let failed=false;
  const pattern=failure==='status'?'**/api/online/status':'**/api/online/me';
  await page.route(pattern,async route=>{if(!failed){failed=true;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Kết nối khởi động thử nghiệm bị chậm.'})});}else await route.continue();});
  try{
    await page.goto(f.origin+'/');await expect(page.getByRole('heading',{name:'Máy chủ chưa sẵn sàng',exact:true})).toBeVisible();
    await expect(page.getByRole('alert')).toContainText('Kết nối khởi động thử nghiệm bị chậm.');
    await expect(page.getByRole('heading',{name:'Chào mừng bạn trở lại',exact:true})).toHaveCount(0);
    await page.getByRole('button',{name:'Thử kết nối lại',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Lớp học & hành trình mỗi tuần',exact:true})).toBeVisible();
  }finally{await page.unrouteAll({behavior:'ignoreErrors'});await f.close();}
});

test('admin coalesces focus reads but fetches fresh data after a write instead of reusing an older response',async({page},testInfo)=>{
  const f=await configuredFixture(page),oldRead=gate();let reads=0,oldSnapshotReady=false;
  try{
    await page.goto(f.origin+'/');await expect(page.getByText('Lớp chưa có học sinh. Cấp tài khoản ở biểu mẫu bên cạnh.',{exact:true})).toBeVisible();
    await page.route('**/api/online/admin/summary?*',async route=>{
      const number=++reads,response=await route.fetch();
      if(number===1){oldSnapshotReady=true;await oldRead.held;}
      await route.fulfill({response}).catch(()=>{});
    });
    await page.evaluate(()=>{window.dispatchEvent(new Event('focus'));document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new Event('focus'));});
    await expect.poll(()=>oldSnapshotReady).toBe(true);expect(reads).toBe(1);
    await page.evaluate(()=>{document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new Event('focus'));});
    await page.getByLabel('Họ tên học sinh',{exact:true}).fill('Học sinh sau khi cập nhật');
    await page.getByLabel('Tên đăng nhập',{exact:true}).fill('startup.child');
    await page.getByRole('button',{name:'Cấp tài khoản',exact:true}).click();
    await expect(page.locator('.online-list').getByText('Học sinh sau khi cập nhật',{exact:true})).toBeVisible();
    expect(reads).toBe(2);oldRead.release();
    await expect(page.locator('.online-list').getByText('Học sinh sau khi cập nhật',{exact:true})).toBeVisible();
    const students=await f.pool.query('SELECT count(*)::int AS n FROM bao_an.students');expect(students.rows[0].n).toBe(1);
    await testInfo.attach('admin-read-deduplication',{body:JSON.stringify({focusBurstReads:1,totalReadsIncludingForcedPostWriteRefresh:reads,studentsAfterWrite:1,staleSnapshotCannotReplaceNewData:true}),contentType:'application/json'});
  }finally{oldRead.release();await page.unrouteAll({behavior:'ignoreErrors'});await f.close();}
});
