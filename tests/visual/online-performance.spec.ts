import {test,expect,type Page} from '@playwright/test';
import {gzipSync} from 'node:zlib';
import {cloudBrowserFixture} from '../helpers/cloud-browser-fixture.mjs';

async function fixture(page:Page){
 const f=await cloudBrowserFixture();
 async function api(route:string,data?:unknown){const me=data&&!['/setup','/login'].includes(route)?await(await page.request.get(f.origin+'/api/online/me')).json():null;const response=data?await page.request.post(f.origin+'/api/online'+route,{headers:{Origin:f.origin,...(me?{'X-CSRF-Token':me.csrfToken}:{})},data}):await page.request.get(f.origin+'/api/online'+route);expect(response.ok(),await response.text()).toBe(true);return response.json();}
 try{
  await api('/setup',{token:f.token,name:'Performance fixture',username:'perf.admin',password:f.password});const cls=await api('/classes',{name:'Lớp hiệu năng',grade:3});await api('/students',{name:'An',classId:cls.id,username:'perf.child',password:f.password});
  const base={version:1,grade:3,subject:'thinking',source:'local',publishedAt:'2026-10-18T00:00:00.000Z'};
  const quiz={...base,id:'perf-quiz',kind:'quiz',title:'Câu hỏi hiệu năng',items:[1,2,3,4].map(i=>({id:'perf-'+i,kind:'multiple-choice',objectiveId:'PERF.TEST',prompt:`Câu hỏi ${i}`,options:[`Đáp án ${i}`,'Sai A','Sai B','Sai C'],correctIndex:0,explanation:'Đáp án của tác giả.'}))};
  const sentence=(id:string)=>({...base,id,kind:'sentences',title:id,items:(id==='perf-viet'?[['Em','chăm','học'],['Tôi','yêu','sách']]:[['Birds','can','fly'],['We','read','books']]).map((words,i)=>({id:id+i,kind:'sentence',objectiveId:'PERF.WORD',prompt:'Xếp câu '+i,words,hint:'Đọc thành câu.'}))});
  await api('/weeks',{requestId:'perf-week',classId:cls.id,title:'Tuần 01',sets:[{subjectLabel:'Toán',pack:quiz},{subjectLabel:'Tiếng Việt',pack:sentence('perf-viet')},{subjectLabel:'Tiếng Anh',pack:sentence('perf-en')}]});
  await page.context().clearCookies();return{...f,api,quiz};
 }catch(error){await f.close();throw error;}
}

test('login has a bounded role-free bundle and the default lesson creates no 3D requests or contexts',async({page},testInfo)=>{
 const f=await fixture(page),requests:string[]=[],bodies:Promise<{name:string;bytes:number;gzip:number}>[]=[];
 await page.addInitScript(()=>{(window as any).__perfWebgl=0;const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(this:HTMLCanvasElement,...args:any[]){if(String(args[0]).includes('webgl'))(window as any).__perfWebgl++;return(original as any).apply(this,args);} as any;});
 page.on('request',r=>requests.push(r.url()));page.on('response',r=>{if(/\/assets\/.*\.(js|css)$/.test(r.url()))bodies.push(r.body().then(body=>({name:new URL(r.url()).pathname,bytes:body.length,gzip:gzipSync(body).length})));});
 try{
  await page.goto(f.origin+'/?mode=list');await expect(page.getByRole('heading',{name:'Chào mừng bạn trở lại',exact:true})).toBeVisible();
  const authAssets=await Promise.all(bodies),js=authAssets.filter(row=>row.name.endsWith('.js')).reduce((n,row)=>n+row.gzip,0),css=authAssets.filter(row=>row.name.endsWith('.css')).reduce((n,row)=>n+row.gzip,0);
  expect(requests.some(url=>/OnlineAdminDashboard|OnlineStudentWorld|WorldCanvas|three-vendor|\.glb/.test(url))).toBe(false);expect(js).toBeLessThanOrEqual(100*1024);expect(css).toBeLessThanOrEqual(20*1024);
  await page.getByLabel('Tên đăng nhập',{exact:true}).fill('perf.child');await page.getByLabel('Mật khẩu',{exact:true}).fill(f.password);await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();await expect(page.locator('[data-hub-mode="light"]')).toBeVisible();
  const studentAssets=await Promise.all(bodies),studentCss=studentAssets.filter(row=>row.name.endsWith('.css')).reduce((n,row)=>n+row.gzip,0);expect(studentCss).toBeLessThanOrEqual(20*1024);
  const status=await(await page.request.get(f.origin+'/api/online/status')).json();expect(status.build.sourceId).toMatch(/^[a-f0-9]{64}$/);expect(await page.locator('#root').getAttribute('data-source-id')).toBe(status.build.sourceId);expect(await page.locator('#root').getAttribute('data-app-version')).toBe(status.runtimeVersion);
  await page.screenshot({path:testInfo.outputPath('lite-hub.png'),fullPage:true});
  await page.getByRole('button',{name:/^(?:Tiếp tục học ngay )?Chơi Đảo Câu Hỏi(?: bằng bộ được giao| · \d+ câu trong bộ)$/,exact:true}).click();await expect(page.locator('.quiz-question')).toHaveText('Câu hỏi 1');await expect(page.locator('.answer-option').first()).toBeEnabled();
  expect(requests.some(url=>/WorldCanvas|three-vendor|\.glb/.test(url))).toBe(false);expect(await page.evaluate(()=>(window as any).__perfWebgl)).toBe(0);await expect(page.locator('canvas')).toHaveCount(0);
  await page.locator('.immersive-dialog').screenshot({path:testInfo.outputPath('lite-quiz.png')});
  await page.getByRole('button',{name:'← Thoát trò chơi',exact:true}).click();await expect(page.locator('[data-hub-mode="light"]')).toBeVisible();
  await testInfo.attach('role-bundle-and-lite',{body:JSON.stringify({authAssets,jsGzip:js,cssGzip:css,studentCssGzip:studentCss,sourceId:status.build.sourceId,glbRequests:requests.filter(url=>url.endsWith('.glb')).length,webglContexts:await page.evaluate(()=>(window as any).__perfWebgl)},null,2),contentType:'application/json'});
 }finally{await f.close();}
});

for(const game of ['memory','connect'])test(`${game} overlaps mismatch reveal with slow ACK without unlocking before receipt`,async({page})=>{
 const f=await fixture(page);let release=()=>{},requested=false;
 const held=new Promise<void>(resolve=>{release=resolve;});
 try{
  await f.api('/login',{username:'perf.child',password:f.password});await page.goto(f.origin+'/?mode=list');
  await page.getByRole('button',{name:`Chơi ${game==='memory'?'Memory Match':'Nối Từ Khám Phá'} bằng bộ được giao`,exact:true}).click();
  const left=(id:number)=>page.locator(game==='memory'?`.memory-card[data-pair-id="perf-${id}"][data-pair-side="left"]`:`.connect-col-left [data-pair-id="perf-${id}"]`);
  const right=(id:number)=>page.locator(game==='memory'?`.memory-card[data-pair-id="perf-${id}"][data-pair-side="right"]`:`.connect-col-right [data-pair-id="perf-${id}"]`);
  await page.route('**/api/online/play/*/attempt',async route=>{requested=true;const response=await route.fetch();await held;await route.fulfill({response});});
  await left(1).click();await right(2).click();await expect.poll(()=>requested).toBe(true);await expect(left(3)).toBeDisabled();
  // More than the reveal interval elapses while the authoritative ACK is held.
  await page.waitForTimeout(850);await expect(left(3)).toBeDisabled();release();await expect(left(3)).toBeEnabled({timeout:600});
  const count=await f.pool.query('SELECT count(*)::int AS n FROM bao_an.attempts');expect(count.rows[0].n).toBe(1);
 }finally{release();await page.unrouteAll({behavior:'ignoreErrors'});await f.close();}
});

test('the 2D release ignores saved 3D preferences and frees resources over fifty lesson visits',async({page},testInfo)=>{
 const f=await fixture(page),models:string[]=[],scripts:string[]=[],errors:string[]=[];
 page.on('request',r=>{if(r.url().endsWith('.glb'))models.push(r.url());if(r.url().endsWith('.js'))scripts.push(r.url());});page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{localStorage.setItem('bao-an-display-mode-v1','3d');(window as any).__webgl=0;const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(this:HTMLCanvasElement,...args:any[]){if(String(args[0]).includes('webgl'))(window as any).__webgl++;return(original as any).apply(this,args);} as any;});
 try{
  await f.api('/login',{username:'perf.child',password:f.password});await page.goto(f.origin+'/?mode=list');await expect(page.locator('[data-hub-mode="light"]')).toBeVisible();await expect(page.getByRole('button',{name:'Khám phá 3D',exact:true})).toHaveCount(0);
  const cdp=await page.context().newCDPSession(page),samples:{cycle:number;heap:number;nodes:number}[]=[];
  try{for(let cycle=1;cycle<=50;cycle++){
   await page.getByRole('button',{name:/^(?:Tiếp tục học ngay )?Chơi Đảo Câu Hỏi(?: bằng bộ được giao| · \d+ câu trong bộ)$/,exact:true}).click();await expect(page.locator('.answer-option').first()).toBeEnabled();
   await page.getByRole('button',{name:'← Thoát trò chơi',exact:true}).click();await expect(page.locator('.immersive-dialog')).toHaveCount(0);await expect(page.getByRole('button',{name:/^(?:Tiếp tục học ngay )?Chơi Đảo Câu Hỏi(?: bằng bộ được giao| · \d+ câu trong bộ)$/,exact:true})).toBeEnabled();
   if(cycle%10===0){await cdp.send('HeapProfiler.collectGarbage');const heap=await cdp.send('Runtime.getHeapUsage');samples.push({cycle,heap:heap.usedSize,nodes:await page.locator('*').count()});}
  }}finally{await cdp.detach();}
  expect(models).toEqual([]);expect(scripts.some(url=>/WorldCanvas|three-vendor|PremiumWorldRenderer/.test(url))).toBe(false);expect(await page.evaluate(()=>(window as any).__webgl)).toBe(0);expect(errors).toEqual([]);
  expect(samples.at(-1)!.heap-samples[0].heap).toBeLessThanOrEqual(10*1024*1024);expect(Math.max(...samples.map(s=>s.nodes))-Math.min(...samples.map(s=>s.nodes))).toBeLessThan(30);
  expect((await f.pool.query("SELECT count(*)::int AS n FROM bao_an.plays WHERE json->>'status'='active'")).rows[0].n).toBe(0);
  await testInfo.attach('fifty-2d-lesson-visits',{body:JSON.stringify({samples,modelRequests:models.length,webglContexts:0}),contentType:'application/json'});
 }finally{await f.close();}
});
