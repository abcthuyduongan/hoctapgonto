import path from 'node:path';
import {mkdir,mkdtemp,rm} from 'node:fs/promises';
import {once} from 'node:events';
import {test,expect,type Page} from '@playwright/test';
import {createOnlineServer} from '../../server/online-server.mjs';
import {seedLegacyApiWeek} from '../helpers/legacy-weeks.mjs';

function gate(){let release=()=>{};const held=new Promise<void>(resolve=>{release=resolve;});return{held,release};}
async function fixture(page:Page,withSecondSubject=false){
  const root=path.resolve('test-results');await mkdir(root,{recursive:true});
  const directory=await mkdtemp(path.join(root,'student-flow-'));
  const server=createOnlineServer({databasePath:path.join(directory,'data.sqlite'),staticRoot:path.resolve(process.env.BAO_AN_STATIC_ROOT??'dist'),setupToken:'student-flow-bootstrap',secureCookies:false});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  const origin='http://127.0.0.1:'+(server.address() as {port:number}).port,password='Student-flow-fixture-2026!';
  async function api(route:string,data?:unknown){
    const me=data&&!['/setup','/login'].includes(route)?await(await page.request.get(origin+'/api/online/me')).json():null;
    if(route==='/weeks')await seedLegacyApiWeek(server.onlineStore,me,data);
    const response=data?await page.request.post(origin+'/api/online'+route,{headers:{Origin:origin,...(me?{'X-CSRF-Token':me.csrfToken}:{})},data}):await page.request.get(origin+'/api/online'+route);
    expect(response.ok(),await response.text()).toBe(true);return response.json();
  }
  try{
    await api('/setup',{token:'student-flow-bootstrap',name:'Bảo An Learning',username:'flow.admin',password});
    const cls=await api('/classes',{name:'Lớp 3A5',grade:3});
    await api('/students',{name:'Đặng Ngọc Bảo An',classId:cls.id,username:'flow.child',password});
    const pack={id:'flow-quiz',version:1,title:'Công nghệ | quiz | Tuần 01',kind:'quiz',subject:'thinking',grade:3,source:'local',publishedAt:'2026-10-18T00:00:00Z',items:[1,2].map(i=>({id:`flow-${i}`,objectiveId:'FLOW',kind:'multiple-choice',prompt:`Câu hỏi ${i}`,options:[`Đúng ${i}`,'Sai A','Sai B','Sai C'],correctIndex:0,explanation:'Đáp án đúng.'}))};
    await api('/weeks',{requestId:'flow-week',classId:cls.id,title:'Tuần 01',sets:[{subjectLabel:'Công nghệ',pack},...(withSecondSubject?[{subjectLabel:'Tiếng Anh',pack:{...pack,id:'flow-english',title:'Khám phá English',items:pack.items.map((item,index)=>({...item,id:`english-${index}`,prompt:`Câu hỏi Tiếng Anh ${index+1}`}))}}]:[])]});
    await page.context().clearCookies();await api('/login',{username:'flow.child',password});await page.goto(origin+'/');
    await page.getByRole('button',{name:/Thu gọn bản đồ|Danh sách/i}).click();
    await expect(page.locator('[data-hub-mode="light"]')).toBeVisible();
    return{server,async close(){await page.unrouteAll({behavior:'ignoreErrors'});server.closeAllConnections?.();await new Promise<void>(resolve=>server.close(()=>resolve()));server.onlineClose();expect(path.dirname(directory)).toBe(root);expect(path.basename(directory)).toMatch(/^student-flow-/);await rm(directory,{recursive:true,force:true});}};
  }catch(error){server.closeAllConnections?.();await new Promise<void>(resolve=>server.close(()=>resolve()));server.onlineClose();expect(path.dirname(path.resolve(directory))).toBe(root);expect(path.basename(directory)).toMatch(/^student-flow-/);await rm(directory,{recursive:true,force:true});throw error;}
}

test('the lightweight exploration map and wallet remain usable on phone and desktop',async({page},testInfo)=>{
  const f=await fixture(page);
  try{
    for(const width of [320,390,620,1440]){
      await page.setViewportSize({width,height:844});
      const wallet=page.getByRole('button',{name:/Ví đổi sao|Mở ví/i});
      await expect(page.getByRole('heading',{name:'Chào Đặng Ngọc Bảo An'})).toBeVisible();
      await expect(page.getByRole('button',{name:'Khám phá Công nghệ · Công nghệ | quiz | Tuần 01',exact:true})).toHaveAttribute('aria-pressed','true');
      await expect(page.getByRole('progressbar',{name:'Số câu đạt yêu cầu tuần này'})).toHaveAttribute('value','0');
      await expect(wallet).toBeVisible();await wallet.focus();await page.keyboard.press('Enter');
      await expect(page.getByRole('dialog',{name:'⭐ Ví đổi sao của con'})).toBeVisible();
      await page.getByRole('button',{name:'Đóng ✕',exact:true}).click();await expect(wallet).toBeFocused();
      await expect(page.locator('canvas,.ba37-mascot-window img')).toHaveCount(0);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await page.screenshot({path:testInfo.outputPath(`student-home-${width}.png`),fullPage:true});
    }
  }finally{await f.close();}
});

test('choosing a map destination opens its own assigned questions without awarding stars',async({page})=>{
  const f=await fixture(page,true);
  try{
    const english=page.getByRole('button',{name:'Khám phá Tiếng Anh · Khám phá English',exact:true});
    await english.click();await expect(english).toHaveAttribute('aria-pressed','true');
    const start=page.getByRole('button',{name:'Chơi Đảo Câu Hỏi bằng bộ được giao',exact:true});
    await expect(start).toBeEnabled();await start.click();
    await expect(page.locator('.quiz-question')).toHaveText('Câu hỏi Tiếng Anh 1');
    await expect(page.getByRole('img',{name:'Cáo nhỏ đồng hành',exact:true})).toContainText('🦊');
    await page.getByRole('button',{name:'← Thoát trò chơi',exact:true}).click();
    await expect(start).toBeFocused();
    expect(f.server.onlineStore.db.prepare('SELECT count(*) AS n FROM attempts').get().n).toBe(0);
    expect(f.server.onlineStore.db.prepare('SELECT count(*) AS n FROM awards').get().n).toBe(0);
    await page.getByRole('button',{name:'Khám phá Công nghệ · Công nghệ | quiz | Tuần 01',exact:true}).click();
    await expect(start).toBeEnabled();await start.click();
    await expect(page.locator('.quiz-question')).toHaveText('Câu hỏi 1');
    await page.getByRole('button',{name:'← Thoát trò chơi',exact:true}).click();
  }finally{await f.close();}
});

test('slow start and exit show feedback, block duplicate exits and restore the original control focus',async({page},testInfo)=>{
  const f=await fixture(page),startGate=gate(),exitGate=gate();let starts=0,exits=0;
  try{
    await page.setViewportSize({width:390,height:640});
    await page.route('**/api/online/play/compact',async route=>{starts++;await startGate.held;await route.continue();});
    const start=page.getByRole('button',{name:'Chơi Đảo Câu Hỏi bằng bộ được giao',exact:true});
    await start.click();await expect.poll(()=>starts).toBe(1);
    await expect(page.getByRole('status').filter({hasText:'Đang mở trò chơi…'})).toBeInViewport();
    await expect(start).toBeDisabled();startGate.release();
    await expect(page.locator('.quiz-question')).toHaveText('Câu hỏi 1');
    await page.route('**/api/online/play/*/abandon',async route=>{exits++;await exitGate.held;await route.continue();});
    const exit=page.getByRole('button',{name:'← Thoát trò chơi',exact:true});
    await exit.click();await expect.poll(()=>exits).toBe(1);
    await expect(page.getByRole('status').filter({hasText:'Đang trở về hành trình…'})).toBeInViewport();
    await expect(page.locator('.game-dialog-head button')).toBeDisabled();
    await page.screenshot({path:testInfo.outputPath('leaving-slow-connection.png')});
    exitGate.release();await expect(page.locator('.immersive-dialog')).toHaveCount(0);
    await expect(start).toBeFocused();expect(starts).toBe(1);expect(exits).toBe(1);
  }finally{startGate.release();exitGate.release();await f.close();}
});

test('saving an answer and completing a lesson keep the exit disabled until server confirmation',async({page})=>{
  const f=await fixture(page),answerGate=gate(),completeGate=gate();let saving=false,completing=false,summaryReads=0;
  try{
    const start=page.getByRole('button',{name:'Chơi Đảo Câu Hỏi bằng bộ được giao',exact:true});await start.click();
    await expect(page.locator('.quiz-question')).toHaveText('Câu hỏi 1');
    await page.route('**/api/online/play/*/attempt',async route=>{saving=true;await answerGate.held;await route.continue();},{times:1});
    await page.locator('.answer-option',{hasText:'Đúng 1'}).click();await expect.poll(()=>saving).toBe(true);
    await expect(page.locator('.game-dialog-head button')).toBeDisabled();
    await expect(page.getByRole('status').filter({hasText:'Đang lưu câu trả lời…'})).toBeVisible();answerGate.release();
    await page.getByRole('button',{name:'Đến trạm kế tiếp ➜',exact:true}).click();
    await expect(page.locator('.quiz-question')).toHaveText('Câu hỏi 2');await page.locator('.answer-option',{hasText:'Đúng 2'}).click();
    await page.route('**/api/online/play/*/complete-compact',async route=>{completing=true;await completeGate.held;await route.continue();});
    await page.getByRole('button',{name:'Hoàn thành bộ câu hỏi',exact:true}).click();await expect.poll(()=>completing).toBe(true);
    await expect(page.locator('.game-dialog-head button')).toBeDisabled();
    await expect(page.getByRole('status').filter({hasText:'Đang lưu kết quả hoàn thành…'})).toBeVisible();completeGate.release();
    await expect(page.locator('.question-completion')).toBeVisible();
    await page.route('**/api/online/student/summary?*',async route=>{summaryReads++;await route.continue();});
    await page.getByRole('button',{name:'Trở về hành trình',exact:true}).click();
    await expect(page.locator('.immersive-dialog')).toHaveCount(0);
    await expect(page.getByLabel('Tiến độ tuần hiện tại')).toContainText('2/2 câu đạt yêu cầu');
    await expect(start).toBeFocused();
    expect(summaryReads).toBe(0);
  }finally{answerGate.release();completeGate.release();await f.close();}
});

test('a refresh snapshot requested before play cannot replace newly saved stars',async({page})=>{
  const f=await fixture(page),snapshot=gate();let requested=false,settled=false;
  try{
    await page.route('**/api/online/student/summary?*',async route=>{
      const response=await route.fetch();requested=true;await snapshot.held;
      await route.fulfill({response}).catch(()=>{});settled=true;
    },{times:1});
    const refresh=page.getByRole('button',{name:'Làm mới tiến độ',exact:true});await refresh.click();await expect.poll(()=>requested).toBe(true);
    await expect(page.getByRole('button',{name:'Đang làm mới…',exact:true})).toBeDisabled();
    await page.getByRole('button',{name:'Chơi Đảo Câu Hỏi bằng bộ được giao',exact:true}).click();
    await expect(page.locator('.quiz-question')).toHaveText('Câu hỏi 1');await page.locator('.answer-option',{hasText:'Đúng 1'}).click();
    await expect(page.locator('.feedback-win')).toBeVisible();await expect(page.locator('.game-wallet-button')).toContainText('3 sao');
    snapshot.release();await expect.poll(()=>settled).toBe(true);
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    await expect(page.locator('.game-wallet-button')).toContainText('3 sao');
    await page.getByRole('button',{name:'← Thoát trò chơi',exact:true}).click();
    await expect(page.getByLabel('Tiến độ tuần hiện tại')).toContainText('1/2 câu đạt yêu cầu');
    await expect(page.getByRole('alert')).toHaveCount(0);
  }finally{snapshot.release();await f.close();}
});

test('a failed answer or exit clears the busy state and allows a safe retry',async({page})=>{
  const f=await fixture(page);
  try{
    await page.getByRole('button',{name:'Chơi Đảo Câu Hỏi bằng bộ được giao',exact:true}).click();
    await expect(page.locator('.quiz-question')).toHaveText('Câu hỏi 1');
    await page.route('**/api/online/play/*/attempt',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Thử nghiệm mất kết nối khi lưu.'})}),{times:1});
    await page.locator('.answer-option',{hasText:'Đúng 1'}).click();
    await expect(page.getByRole('alert')).toContainText('Thử nghiệm mất kết nối khi lưu.');
    await expect(page.locator('.online-game-request-status')).toHaveCount(0);
    await expect(page.locator('.game-dialog-head button')).toBeEnabled();
    await page.getByRole('button',{name:'Thử gửi lại đáp án',exact:true}).click();
    await expect(page.locator('.feedback-win')).toBeVisible();
    expect(Number(f.server.onlineStore.db.prepare('SELECT count(*) AS n FROM attempts').get().n)).toBe(1);
    await page.route('**/api/online/play/*/abandon',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Thử nghiệm mất kết nối khi thoát.'})}),{times:1});
    const exit=page.getByRole('button',{name:'← Thoát trò chơi',exact:true});await exit.click();
    await expect(page.getByRole('alert')).toContainText('Thử nghiệm mất kết nối khi thoát.');
    await expect(page.locator('.online-game-request-status')).toHaveCount(0);await expect(exit).toBeEnabled();
    await exit.click();await expect(page.locator('.immersive-dialog')).toHaveCount(0);
    await expect(page.getByLabel('Tiến độ tuần hiện tại')).toContainText('1/2 câu đạt yêu cầu');
    await expect(page.getByRole('alert')).toHaveCount(0);
  }finally{await f.close();}
});
