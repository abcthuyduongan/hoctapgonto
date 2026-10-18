import {seedLegacyApiWeek} from '../helpers/legacy-weeks.mjs';
import {test,expect,type Page} from '@playwright/test';
import {cloudBrowserFixture} from '../helpers/cloud-browser-fixture.mjs';

async function studentFixture(page:Page){
  const f=await cloudBrowserFixture();
  async function api(route:string,body:unknown,csrf=''){
    if(route==='/weeks')await seedLegacyApiWeek(f.store,await(await page.request.get(f.origin+'/api/online/me')).json(),body);const response=await page.request.post(f.origin+'/api/online'+route,{headers:{Origin:f.origin,...(csrf?{'X-CSRF-Token':csrf}:{})},data:body});
    expect(response.ok(),await response.text()).toBe(true);return response.json();
  }
  try{
    const admin=await api('/setup',{token:f.token,name:'Loading test',username:'loading.admin',password:f.password});
    const cls=await api('/classes',{name:'Loading class',grade:3},admin.csrfToken);
    await api('/students',{name:'Loading student',classId:cls.id,username:'loading.child',password:f.password},admin.csrfToken);
    const pack={id:'loading-quiz',title:'Bài học mở ngay',version:1,grade:3,kind:'quiz',subject:'thinking',source:'local',publishedAt:'2026-10-17T00:00:00.000Z',items:[1,2].map(i=>({id:'loading-'+i,kind:'multiple-choice',objectiveId:'LOADING.TEST',prompt:'Chọn câu trả lời '+i,options:['Đúng '+i,'Sai A','Sai B','Sai C'],correctIndex:0,explanation:'Đáp án do tác giả xác định.'}))};
    await api('/weeks',{requestId:'loading-week',title:'Tuần 01',classId:cls.id,sets:[{subjectLabel:'Kiểm tra tải trò chơi',pack}]},admin.csrfToken);
    await page.context().clearCookies();await api('/login',{username:'loading.child',password:f.password});
    return f;
  }catch(error){await f.close();throw error;}
}

test('a student starts before slow 3D assets finish, warms the game during session creation and retries a failed answer safely',async({page},testInfo)=>{
  const f=await studentFixture(page);
  let releaseModels!:()=>void,releasePlay!:()=>void,releaseStudent=()=>{};
  const modelsHeld=new Promise<void>(resolve=>{releaseModels=resolve;}),playHeld=new Promise<void>(resolve=>{releasePlay=resolve;});
  let modelRequests=0,modelFinished=0,playRequested=false,gameChunkRequested=false;
  page.on('request',request=>{if(/\/assets\/MathQuest-[^/]+\.js$/.test(request.url()))gameChunkRequested=true;});
  await page.route('**/*.glb',async route=>{modelRequests++;await modelsHeld;await route.continue();modelFinished++;});
  await page.route('**/api/online/play/compact',async route=>{playRequested=true;await playHeld;await route.continue();});
  try{
    await page.goto(f.origin+'/');await page.getByRole('button',{name:'Khám phá 3D',exact:true}).click();
    const host=page.locator('.ba3d-render-host'),start=page.getByRole('button',{name:'Chơi Đảo Câu Hỏi bằng bộ được giao',exact:true});
    await expect(host).toHaveAttribute('data-state','loading');await expect(start).toBeVisible();
    await expect.poll(()=>modelRequests).toBeGreaterThan(0);
    const started=Date.now();await start.click();await expect.poll(()=>playRequested).toBe(true);
    await expect.poll(()=>gameChunkRequested).toBe(true);expect(modelFinished).toBe(0);
    releasePlay();await expect(page.locator('.quiz-question')).toHaveText('Chọn câu trả lời 1');
    const enterMs=Date.now()-started;expect(modelFinished).toBe(0);await expect(host).toHaveCount(0);
    let failures=0;await page.route('**/api/online/play/*/attempt',async route=>{if(failures++===0)await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Kết nối thử nghiệm bị gián đoạn. Vui lòng thử lại.'})});else await route.continue();});
    await page.locator('.answer-option').first().click();await expect(page.locator('.notice.error')).toContainText('Kết nối thử nghiệm bị gián đoạn');
    expect((await f.pool.query('SELECT count(*)::int AS n FROM bao_an.attempts')).rows[0].n).toBe(0);
    await expect(page.locator('.answer-option').first()).toBeDisabled();await page.locator('.notice.error').getByRole('button',{name:'Thử gửi lại đáp án',exact:true}).click();await expect(page.locator('.feedback-win')).toBeVisible();
    expect((await f.pool.query('SELECT count(*)::int AS n FROM bao_an.attempts')).rows[0].n).toBe(1);
    const exitRefresh=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/online/student/summary');
    await page.getByRole('button',{name:'← Thoát trò chơi',exact:true}).click();await exitRefresh;await expect(start).toBeVisible();
    let studentRequests=0;
    const studentHeld=new Promise<void>(resolve=>{releaseStudent=resolve;});
    await page.route('**/api/online/student/summary?*',async route=>{studentRequests++;await studentHeld;await route.continue();});
    const focusedRefresh=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/online/student/summary');
    await page.evaluate(()=>{window.dispatchEvent(new Event('focus'));document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new Event('focus'));});
    await expect.poll(()=>studentRequests).toBe(1);releaseStudent();await focusedRefresh;
    await expect(page.getByRole('button',{name:'Làm mới tiến độ',exact:true})).toBeEnabled();
    await testInfo.attach('loading-evidence',{body:JSON.stringify({enterMs,modelsHeld:modelRequests,modelFinished,gameChunkRequestedBeforePlayResponse:gameChunkRequested,studentRequests,committedAttempts:1}),contentType:'application/json'});
  }finally{releaseModels();releasePlay();releaseStudent();await page.unrouteAll({behavior:'ignoreErrors'});await f.close();}
});

test('failed scene downloads retain a working direct start and the fallback scene',async({page})=>{
  const f=await studentFixture(page);
  await page.route('**/*.glb',route=>route.fulfill({status:404,contentType:'text/plain',body:'Fixture scene unavailable'}));
  try{
    await page.goto(f.origin+'/');await page.getByRole('button',{name:'Khám phá 3D',exact:true}).click();await expect(page.locator('[data-hub-mode="light"]')).toBeVisible();await expect(page.locator('.ba3d-render-host')).toHaveCount(0);
    await page.getByRole('button',{name:'Chơi Đảo Câu Hỏi bằng bộ được giao',exact:true}).click();
    await expect(page.locator('.quiz-question')).toHaveText('Chọn câu trả lời 1');await page.locator('.answer-option').first().click();await expect(page.locator('.feedback-win')).toBeVisible();
    await page.getByRole('button',{name:'← Thoát trò chơi',exact:true}).click();await expect(page.getByRole('button',{name:'Chơi Đảo Câu Hỏi bằng bộ được giao',exact:true})).toBeEnabled();
  }finally{await f.close();}
});

test('an interrupted game chunk displays recovery controls and reload can start a new working session',async({page})=>{
  const f=await studentFixture(page);
  await page.route('**/*.glb',route=>route.fulfill({status:404,contentType:'text/plain',body:'Fixture scene unavailable'}));
  await page.route('**/assets/MathQuest-*.js',route=>route.abort('failed'));
  try{
    await page.goto(f.origin+'/');await page.getByRole('button',{name:'Chơi Đảo Câu Hỏi bằng bộ được giao',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Không tải được trò chơi',exact:true})).toBeVisible();
    await expect(page.getByRole('button',{name:'Thoát về màn hình chính',exact:true})).toBeEnabled();
    await page.unroute('**/assets/MathQuest-*.js');await page.getByRole('button',{name:'Tải lại ứng dụng',exact:true}).click();
    await page.getByRole('button',{name:'Chơi Đảo Câu Hỏi bằng bộ được giao',exact:true}).click();await expect(page.locator('.quiz-question')).toHaveText('Chọn câu trả lời 1');
    await page.getByRole('button',{name:'← Thoát trò chơi',exact:true}).click();
  }finally{await f.close();}
});
