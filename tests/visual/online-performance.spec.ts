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
  await page.goto(f.origin+'/');await expect(page.getByRole('heading',{name:'Chào mừng bạn trở lại',exact:true})).toBeVisible();
  const authAssets=await Promise.all(bodies),js=authAssets.filter(row=>row.name.endsWith('.js')).reduce((n,row)=>n+row.gzip,0),css=authAssets.filter(row=>row.name.endsWith('.css')).reduce((n,row)=>n+row.gzip,0);
  expect(requests.some(url=>/OnlineAdminDashboard|OnlineStudentWorld|WorldCanvas|three-vendor|\.glb/.test(url))).toBe(false);expect(js).toBeLessThanOrEqual(100*1024);expect(css).toBeLessThanOrEqual(20*1024);
  await page.getByLabel('Tên đăng nhập',{exact:true}).fill('perf.child');await page.getByLabel('Mật khẩu',{exact:true}).fill(f.password);await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();await expect(page.locator('[data-hub-mode="light"]')).toBeVisible();
  await page.screenshot({path:testInfo.outputPath('lite-hub.png'),fullPage:true});
  await page.getByRole('button',{name:'Chơi Đảo Câu Hỏi bằng bộ được giao',exact:true}).click();await expect(page.locator('.quiz-question')).toHaveText('Câu hỏi 1');await expect(page.locator('.answer-option').first()).toBeEnabled();
  expect(requests.some(url=>/WorldCanvas|three-vendor|\.glb/.test(url))).toBe(false);expect(await page.evaluate(()=>(window as any).__perfWebgl)).toBe(0);await expect(page.locator('canvas')).toHaveCount(0);
  await page.locator('.immersive-dialog').screenshot({path:testInfo.outputPath('lite-quiz.png')});
  await page.getByRole('button',{name:'← Thoát trò chơi',exact:true}).click();await expect(page.locator('[data-hub-mode="light"]')).toBeVisible();
  await testInfo.attach('role-bundle-and-lite',{body:JSON.stringify({authAssets,jsGzip:js,cssGzip:css,glbRequests:requests.filter(url=>url.endsWith('.glb')).length,webglContexts:await page.evaluate(()=>(window as any).__perfWebgl)},null,2),contentType:'application/json'});
 }finally{await f.close();}
});

for(const game of ['memory','connect'])test(`${game} overlaps mismatch reveal with slow ACK without unlocking before receipt`,async({page})=>{
 const f=await fixture(page);let release=()=>{},requested=false;
 const held=new Promise<void>(resolve=>{release=resolve;});
 try{
  await f.api('/login',{username:'perf.child',password:f.password});await page.goto(f.origin+'/');
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

test('optional 3D is lazy, bounded, settles without RAF and releases when a lesson starts',async({page},testInfo)=>{
 const f=await fixture(page),models:string[]=[];page.on('request',r=>{if(r.url().endsWith('.glb'))models.push(r.url());});
 try{
  await f.api('/login',{username:'perf.child',password:f.password});await page.goto(f.origin+'/?online=1&controls=1');await expect(page.locator('[data-hub-mode="light"]')).toBeVisible();expect(models).toHaveLength(0);
  await page.getByRole('button',{name:'Khám phá 3D',exact:true}).click();const host=page.locator('.ba3d-render-host');await expect(host).toHaveAttribute('data-state','ready',{timeout:60000});await expect(host).toHaveAttribute('data-engine','three-webgl');
  const stats=async()=>JSON.parse(await host.getAttribute('data-diagnostics')??'{}');await expect.poll(async()=>(await stats()).readyAssets?.length).toBe(2);expect(models.every(url=>url.includes('/models/optimized/'))).toBe(true);
  await page.getByRole('button',{name:'Chọn Khu Rừng Trí Nhớ',exact:true}).click();await expect.poll(async()=>(await stats()).readyAssets?.includes('memory-world')).toBe(true);
  await expect.poll(async()=>(await stats()).renderPending,{timeout:12000}).toBe(false);const measured=await stats();expect(measured.activeAssetBytes).toBeLessThanOrEqual(2*1024*1024);expect(measured.textureBytesEstimate+measured.geometryBytesEstimate).toBeLessThanOrEqual(32*1024*1024);await expect(page.locator('canvas')).toHaveCount(1);
  await page.locator('.game-hub').screenshot({path:testInfo.outputPath('optional-3d.png')});
  await page.getByRole('button',{name:'Bắt đầu',exact:true}).click();await expect(page.locator('.memory-grid')).toBeVisible();await expect(page.locator('.ba3d-render-host')).toHaveCount(0);await expect(page.locator('canvas')).toHaveCount(0);await expect(page.locator('.immersive-dialog')).toHaveAttribute('data-scene-engine','html');
  await page.getByRole('button',{name:'← Thoát trò chơi',exact:true}).click();await expect(host).toHaveAttribute('data-state','ready',{timeout:60000});
  const cdp=await page.context().newCDPSession(page),samples:{cycle:number;heap:number;canvases:number}[]=[];
  try{for(let cycle=0;cycle<10;cycle++){
   await page.getByRole('button',{name:'Chế độ nhẹ',exact:true}).click();await expect(page.locator('canvas')).toHaveCount(0);
   await cdp.send('HeapProfiler.collectGarbage');const heap=await cdp.send('Runtime.getHeapUsage');samples.push({cycle,heap:heap.usedSize,canvases:await page.locator('canvas').count()});
   await page.getByRole('button',{name:'Khám phá 3D',exact:true}).click();await expect(host).toHaveAttribute('data-state','ready',{timeout:60000});await expect(page.locator('canvas')).toHaveCount(1);
  }}finally{await cdp.detach();}
  expect(samples.at(-1)!.heap-samples[4].heap).toBeLessThanOrEqual(10*1024*1024);
  await testInfo.attach('optional-3d-resource-budget',{body:JSON.stringify({models,measured,modeChanges:20,samples},null,2),contentType:'application/json'});
 }finally{await f.close();}
});
