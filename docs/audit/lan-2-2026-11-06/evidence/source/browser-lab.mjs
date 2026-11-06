import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {once} from 'node:events';
import {chromium,expect as baseExpect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {createOnlineServer} from '../../server/online-server.mjs';
import {seedLegacyWeek} from '../../tests/helpers/legacy-weeks.mjs';

const output=path.resolve('test-results/audit-lan-2-2026-11-06/browser-lab');
const expect=baseExpect.configure({timeout:45000});
fs.mkdirSync(output,{recursive:true});
const password='Audit-synthetic-2026!',setupToken='audit-lab-local-bootstrap';
const server=createOnlineServer({databasePath:':memory:',staticRoot:path.resolve('dist'),setupToken,secureCookies:false});
server.listen(0,'127.0.0.1');await once(server,'listening');
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({channel:'chrome',headless:true});
const results=[],errors=[];
const dataset={classes:23,students:1000,weeksPerClass:8,questionsPerPack:12};
try{
 const boot=await fetch(origin+'/api/online/setup',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({token:setupToken,name:'Audit synthetic learning school',username:'audit.admin',password})});
 if(!boot.ok)throw Error(await boot.text());const identity=await boot.json();
 const store=server.onlineStore,auth=identity.user,hash=store.db.prepare('SELECT password_hash FROM users WHERE id=?').get(auth.id).password_hash;
 const classes=[];for(let c=0;c<23;c++)classes.push(store.createClass(auth,{name:'Lớp thử '+String(c+1).padStart(2,'0'),grade:3}));
 for(let i=0;i<1000;i++)store.createStudent(auth,{classId:classes[i%23].id,name:'Học sinh thử '+i,username:'audit.child.'+i},hash,'audit.child.'+i);
 const pack={id:'audit-lab-quiz',version:1,title:'Bộ câu hỏi thử hiệu năng',kind:'quiz',subject:'thinking',grade:3,source:'local',publishedAt:'2026-11-06T00:00:00Z',items:Array.from({length:12},(_,i)=>({id:'lab-q'+i,objectiveId:'AUDIT.LAB',kind:'multiple-choice',prompt:'Câu thử '+(i+1),options:['Đúng '+(i+1),'Sai A','Sai B','Sai C'],correctIndex:0,explanation:'Đáp án thử.'}))};
 for(const cls of classes)for(let w=0;w<8;w++)seedLegacyWeek(store,auth,{classId:cls.id,title:'Tuần thử '+(w+1),requestId:cls.id+'-'+w,sets:[{subjectLabel:'Toán',pack}]});
 const profiles=[{name:'desktop-local',viewport:{width:1440,height:900},cpu:1,network:null},{name:'mobile-limited-4g',viewport:{width:390,height:844},cpu:4,network:{offline:false,latency:150,downloadThroughput:1.6*1024*1024/8,uploadThroughput:750*1024/8,connectionType:'cellular4g'}}];
 for(const profile of profiles)for(let run=1;run<=3;run++){
  const context=await browser.newContext({viewport:profile.viewport,deviceScaleFactor:1,isMobile:profile.name.startsWith('mobile'),hasTouch:profile.name.startsWith('mobile'),serviceWorkers:'block'});
  await context.addInitScript(()=>{
   window.__audit={lcp:0,cls:0,sessionCls:0,sessionStart:0,lastShift:0,events:[],longTasks:[]};
   for(const type of ['largest-contentful-paint','layout-shift','event','longtask'])try{new PerformanceObserver(list=>{for(const e of list.getEntries()){
    if(type==='largest-contentful-paint')window.__audit.lcp=e.startTime;
    if(type==='layout-shift'&&!e.hadRecentInput){if(e.startTime-window.__audit.lastShift>1000||e.startTime-window.__audit.sessionStart>5000){window.__audit.sessionCls=0;window.__audit.sessionStart=e.startTime;}window.__audit.sessionCls+=e.value;window.__audit.lastShift=e.startTime;window.__audit.cls=Math.max(window.__audit.cls,window.__audit.sessionCls);}
    if(type==='event'&&e.interactionId)window.__audit.events.push({name:e.name,duration:e.duration,interactionId:e.interactionId});
    if(type==='longtask')window.__audit.longTasks.push({start:e.startTime,duration:e.duration});
   }}).observe({type,buffered:true,...(type==='event'?{durationThreshold:16}:{})});}catch{}
  });
  const page=await context.newPage(),cdp=await context.newCDPSession(page);
  await cdp.send('Network.enable');await cdp.send('Emulation.setCPUThrottlingRate',{rate:profile.cpu});if(profile.network)await cdp.send('Network.emulateNetworkConditions',profile.network);
  const network=[],pageErrors=[];page.on('response',response=>network.push({url:new URL(response.url()).pathname,status:response.status()}));page.on('pageerror',e=>pageErrors.push(e.message));
  async function snapshot(scenario,started,extra={}){
   await page.waitForTimeout(650);
   const values=await page.evaluate(()=>{
    const nav=performance.getEntriesByType('navigation')[0],resources=performance.getEntriesByType('resource');
    const sum=suffix=>resources.filter(r=>new RegExp(suffix).test(new URL(r.name).pathname)).reduce((n,r)=>n+r.encodedBodySize,0);
    const visible=[...document.querySelectorAll('button,a,input,select')].map(e=>({e,r:e.getBoundingClientRect()})).filter(({e,r})=>r.width&&r.height&&getComputedStyle(e).visibility!=='hidden');
    return {ttfbMs:nav?.responseStart-nav?.requestStart,fcpMs:performance.getEntriesByName('first-contentful-paint')[0]?.startTime??null,lcpObservedMs:window.__audit.lcp||null,clsObserved:window.__audit.cls,domNodes:document.querySelectorAll('*').length,documentWidth:document.documentElement.scrollWidth,viewportWidth:innerWidth,requestCount:resources.length,totalEncodedBytes:resources.reduce((n,r)=>n+r.encodedBodySize,0),totalTransferBytes:resources.reduce((n,r)=>n+r.transferSize,0),jsEncodedBytes:sum('\\.js$'),cssEncodedBytes:sum('\\.css$'),requests:resources.map(r=>({path:new URL(r.name).pathname,durationMs:r.duration,ttfbMs:r.responseStart-r.requestStart,transferBytes:r.transferSize,encodedBytes:r.encodedBodySize,initiator:r.initiatorType})),smallTargets:visible.filter(({r})=>r.width<44||r.height<44).slice(0,25).map(({e,r})=>({label:(e.getAttribute('aria-label')||e.textContent||e.getAttribute('placeholder')||e.tagName).trim().slice(0,90),width:r.width,height:r.height})),labEventMaxDurationMs:Math.max(0,...window.__audit.events.map(e=>e.duration)),longTasks:window.__audit.longTasks};
   });
   const item={profile:profile.name,run,scenario,usableMs:Number((performance.now()-started-650).toFixed(1)),...values,...extra};results.push(item);
   console.log(JSON.stringify({profile:profile.name,run,scenario,usableMs:item.usableMs,lcp:item.lcpObservedMs,requests:item.requestCount}));
   fs.writeFileSync(path.join(output,'results-in-progress.json'),JSON.stringify(results,null,2));return item;
  }
  async function navigation(scenario,ready,cold=false){if(cold)await cdp.send('Network.clearBrowserCache');const start=performance.now();await page.goto(origin+'/?online=1',{waitUntil:'load'});await ready();await page.waitForFunction(()=>[...document.images].filter(img=>{const r=img.getBoundingClientRect();return r.width&&r.height&&r.top<innerHeight&&r.bottom>0;}).every(img=>img.complete&&img.naturalWidth>0),null,{timeout:45000});return snapshot(scenario,start);}
  try{
   await navigation('auth-cold',()=>expect(page.getByRole('heading',{name:'Chào mừng bạn trở lại',exact:true})).toBeVisible(),true);
   await navigation('auth-warm',()=>expect(page.getByRole('heading',{name:'Chào mừng bạn trở lại',exact:true})).toBeVisible());
   if(run===1)await page.screenshot({path:path.join(output,profile.name+'-auth.png'),fullPage:true});
   await page.getByLabel('Tên đăng nhập',{exact:true}).fill('audit.admin');await page.getByLabel('Mật khẩu',{exact:true}).fill(password);
   let start=performance.now();await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();await expect(page.getByRole('heading',{name:'Lớp học & hành trình mỗi tuần',exact:true})).toBeVisible();await snapshot('admin-login-action',start);
   await navigation('admin-session-cold',()=>expect(page.getByRole('heading',{name:'Thêm học sinh',exact:true})).toBeVisible(),true);
   if(run===1){await page.screenshot({path:path.join(output,profile.name+'-admin.png'),fullPage:true});const axe=await new AxeBuilder({page}).analyze();fs.writeFileSync(path.join(output,profile.name+'-admin-axe.json'),JSON.stringify({url:'local synthetic fixture',violations:axe.violations,incomplete:axe.incomplete},null,2));}
   start=performance.now();await page.getByRole('button',{name:'Học liệu tuần',exact:true}).click();await expect(page.locator('input[type=file]').first()).toBeAttached();await snapshot('admin-to-week-material',start);
   await context.clearCookies();const login=await context.request.post(origin+'/api/online/login',{headers:{Origin:origin},data:{username:'audit.child.0',password}});if(!login.ok())throw Error(await login.text());
   await page.coverage.startCSSCoverage({resetOnNavigation:false});
   await navigation('student-session-cold',()=>expect(page.locator('[data-hub-mode="light"]')).toBeVisible(),true);
   if(run===1){await page.screenshot({path:path.join(output,profile.name+'-student.png'),fullPage:true});const axe=await new AxeBuilder({page}).analyze();fs.writeFileSync(path.join(output,profile.name+'-student-axe.json'),JSON.stringify({url:'local synthetic fixture',violations:axe.violations,incomplete:axe.incomplete},null,2));}
   start=performance.now();await page.getByRole('button',{name:'Chơi Đảo Câu Hỏi bằng bộ được giao',exact:true}).click();await expect(page.locator('.answer-option').first()).toBeEnabled();await snapshot('student-to-game',start);
   if(run===1)await page.screenshot({path:path.join(output,profile.name+'-game.png'),fullPage:true});
   start=performance.now();await page.locator('.answer-option').filter({hasText:'Đúng 1'}).click();await expect(page.locator('.answer-option.correct')).toBeVisible();await snapshot('answer-save-ack',start);
   start=performance.now();await page.getByRole('button',{name:'← Thoát trò chơi',exact:true}).click();await expect(page.locator('.immersive-dialog')).toHaveCount(0);await snapshot('game-exit',start);
   const css=await page.coverage.stopCSSCoverage();fs.writeFileSync(path.join(output,profile.name+'-'+run+'-css-coverage.json'),JSON.stringify(css.map(c=>({url:new URL(c.url).pathname,totalCharacters:c.text.length,usedCharacters:c.ranges.reduce((n,r)=>n+r.end-r.start,0)})),null,2));
   if(run===1){await page.getByRole('button',{name:'Mở thị trấn của con',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.screenshot({path:path.join(output,profile.name+'-town.png'),fullPage:true});}
  }catch(e){errors.push({profile:profile.name,run,message:e.message});await page.screenshot({path:path.join(output,profile.name+'-'+run+'-failure.png'),fullPage:true}).catch(()=>{});console.log('LAB_ERROR '+e.message);}
  finally{if(pageErrors.length)errors.push({profile:profile.name,run,pageErrors});await context.close();}
 }
}finally{
 await browser.close();server.closeAllConnections?.();await new Promise(resolve=>server.close(resolve));server.onlineClose();
 const report={kind:'Local browser lab on production dist and SQLite fixture; not real 4G device, Supabase latency or field INP',capturedAtUtc:new Date().toISOString(),environment:{node:process.version,platform:process.platform,cpuModel:os.cpus()[0]?.model,logicalCPUs:os.cpus().length,totalMemoryGiB:Number((os.totalmem()/1024**3).toFixed(1))},dataset,method:{repetitions:3,browserChannel:'chrome',mobileViewport:'390x844',desktopViewport:'1440x900',mobileCpuSlowdown:4,network:'CDP 150ms latency, 1.6Mib/s down, 750Kib/s up; no packet loss',lcp:'Observed until 650ms after the ready locator; not a field percentile',cls:'Max observed session window; no field claims',inp:'CHUA_KIEM_CHUNG; EventTiming maximum retained only as laboratory interaction sample',concurrency:'Run after full Playwright and unit suites finish'},results,errors};
 fs.writeFileSync(path.join(output,'browser-lab.json'),JSON.stringify(report,null,2));
}
