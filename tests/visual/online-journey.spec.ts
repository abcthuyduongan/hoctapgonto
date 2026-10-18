import {seedLegacyApiWeek} from '../helpers/legacy-weeks.mjs';
import path from 'node:path';
import {mkdir,mkdtemp,rm} from 'node:fs/promises';
import {once} from 'node:events';
import {expect,test} from '@playwright/test';
import {createOnlineServer} from '../../server/online-server.mjs';

test('each question keeps its highest stars across games, then the student explicitly closes a mastered week',async({page},testInfo)=>{
  const root=path.resolve('test-results');await mkdir(root,{recursive:true});const directory=await mkdtemp(path.join(root,'question-journey-'));
  const server=createOnlineServer({databasePath:path.join(directory,'data.sqlite'),staticRoot:path.resolve(process.env.BAO_AN_STATIC_ROOT??'dist'),setupToken:'question-journey-bootstrap',secureCookies:false});
  server.listen(0,'127.0.0.1');await once(server,'listening');const origin='http://127.0.0.1:'+(server.address() as {port:number}).port,password='Question-journey-fixture-2026!';
  async function request(route:string,data?:unknown){const me=data&&!['/setup','/login'].includes(route)?await(await page.request.get(origin+'/api/online/me')).json():null;if(route==='/weeks')await seedLegacyApiWeek(server.onlineStore,me,data);return data?page.request.post(origin+'/api/online'+route,{headers:{Origin:origin,...(me?{'X-CSRF-Token':me.csrfToken}:{})},data}):page.request.get(origin+'/api/online'+route);}
  async function api(route:string,data?:unknown){const response=await request(route,data);expect(response.ok(),await response.text()).toBe(true);return response.json();}
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/models/*.glb',route=>route.fulfill({status:404,contentType:'text/plain',body:'Fixture has no 3D model'}));
  try{
    await api('/setup',{token:'question-journey-bootstrap',name:'Sao từng câu',username:'journey.admin',password});const cls=await api('/classes',{name:'Lớp sao từng câu',grade:3});await api('/students',{name:'Học sinh hành trình',classId:cls.id,username:'journey.child',password});
    const packs=[1,2].map(week=>({id:`journey-pack-${week}`,version:1,title:`Bộ tuần ${week}`,kind:'quiz',subject:'thinking',grade:3,source:'local',publishedAt:'2026-10-17T00:00:00Z',items:[1,2,3,4].map(i=>({id:`journey-${week}-${i}`,objectiveId:'JOURNEY',kind:'multiple-choice',prompt:`Tuần ${week}: câu hỏi ${i}`,options:[`Đáp án ${week}.${i}`,'Sai A','Sai B','Sai C'],correctIndex:0,explanation:'Đáp án đã được giáo viên xác định.'}))}));
    const week1=await api('/weeks',{requestId:'journey-week-1',classId:cls.id,title:'Tuần 01',sets:[{subjectLabel:'Hành trình',pack:packs[0]}]});const week2=await api('/weeks',{requestId:'journey-week-2',classId:cls.id,title:'Tuần 02',sets:[{subjectLabel:'Hành trình tiếp',pack:packs[1]}]});
    await page.context().clearCookies();await api('/login',{username:'journey.child',password});await page.goto(origin+'/?online=1&controls=1');
    await expect(page.getByLabel('Tiến độ tuần hiện tại')).toContainText('Tuần 01: 0/4 câu đạt yêu cầu');await expect(page.getByRole('button',{name:'Sang Tuần 02',exact:true})).toHaveCount(0);
    expect((await request('/play/compact',{requestId:'future-denied',moduleId:'math-quest',packId:packs[1].id,contentVersion:1})).status()).toBe(403);
    expect((await request('/student/advance-week',{requestId:'premature-advance',weekId:week1.id})).status()).toBe(400);
    // Move the persisted server clock rather than waiting 60 seconds in the test.
    let makeSlow=true;
    await page.route('**/api/online/play/*/question-open',async route=>{
      const response=await route.fetch();if(makeSlow&&response.ok()){
        const input=route.request().postDataJSON(),playId=new URL(route.request().url()).pathname.split('/').at(-2)!;
        const row=server.onlineStore.db.prepare('SELECT json FROM plays WHERE id=?').get(playId),session=JSON.parse(row.json);session.questionClocks[input.itemId]=new Date(Date.now()-(input.itemId===packs[0].items[0].id?75000:45000)).toISOString();server.onlineStore.db.prepare('UPDATE plays SET json=? WHERE id=?').run(JSON.stringify(session),playId);
        const clock=await response.json();await route.fulfill({response,json:{...clock,openedAt:session.questionClocks[input.itemId]}});return;
      }await route.fulfill({response});
    });
    const firstStart=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/online/play/compact');await page.getByRole('button',{name:'Chơi Đảo Câu Hỏi bằng bộ được giao',exact:true}).click();const originalResponse=await firstStart,originalPlay=await originalResponse.json(),originalStart=originalResponse.request().postDataJSON();
    for(let i=0;i<4;i++){
      await expect(page.locator('.quiz-question')).toHaveText(packs[0].items[i].prompt);await page.locator('.answer-option').first().click();await expect(page.locator('.question-star-receipt')).toContainText(i?'2/3 sao':'1/3 sao');
      await page.getByRole('button',{name:i===3?'Hoàn thành bộ câu hỏi':'Đến trạm kế tiếp ➜',exact:true}).click();
    }
    await expect(page.locator('.question-completion')).toBeVisible();await expect(page.locator('.premium-reward-stars')).toHaveCount(0);await page.getByRole('button',{name:'Trở về hành trình',exact:true}).click();
    let state=await api('/student/summary?cursor=current');expect(state.balance.earned).toBe(7);expect(state.currentWeekSummary).toMatchObject({one:1,two:3,three:0,ready:false});
    const sourceSet=page.locator('.online-week-path > li > ul > li').filter({hasText:'Bộ tuần 1'}),details=sourceSet.locator('details');await details.locator('summary').click();const loadGames=sourceSet.getByRole('button',{name:'Chọn trò để học hoặc ôn lại',exact:true});if(await loadGames.isVisible())await loadGames.click();
    await page.getByRole('combobox',{name:'Trò để học và ôn · Bộ tuần 1',exact:true}).selectOption('memory-match');const retryStart=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/online/play/compact');await sourceSet.getByRole('button',{name:/^Học lại câu 1 ·/}).click();const retry=await(await retryStart).json();
    expect(retry.presentation.items).toHaveLength(2);expect(retry.session.requiredItemIds).toContain(packs[0].items[0].id);const [target,anchor]=retry.presentation.items.map((item:any)=>item.id);
    async function pair(itemId:string){await page.locator(`.memory-card[data-pair-id="${itemId}"][data-pair-side="left"]`).click();await page.locator(`.memory-card[data-pair-id="${itemId}"][data-pair-side="right"]`).click();}
    await pair(target);await expect(page.locator('.question-star-receipt')).toContainText('+2 sao mới');await pair(anchor);await expect(page.locator('.question-completion')).toBeVisible();await page.getByRole('button',{name:'Trở về hành trình',exact:true}).click();
    state=await api('/student/summary?cursor=current');expect(state.balance.earned).toBe(10);expect(state.currentWeekSummary).toMatchObject({one:0,two:2,three:2,ready:true});expect(state.currentWeekSummary.weekId).toBe(week1.id);await expect(page.getByLabel('Tiến độ tuần hiện tại')).toContainText('2 câu 2 sao · 2 câu 3 sao');
    await page.getByRole('button',{name:'Sang Tuần 02',exact:true}).click();let dialog=page.getByRole('dialog',{name:'Sang Tuần 02?',exact:true});await expect(dialog).toBeVisible();await expect(dialog).toContainText('2 câu 2 sao');await expect(dialog).toContainText('2 câu 3 sao');await expect(dialog).toContainText('Tuần 01 sẽ khóa');await dialog.getByRole('button',{name:'Ở lại ôn thêm',exact:true}).click();expect((await api('/student/summary?cursor=current')).currentWeekSummary.weekId).toBe(week1.id);
    // Replaying the same source in another game can improve tiers but never add
    // more than three stars for an already mastered source question.
    makeSlow=false;await page.getByRole('button',{name:'Ôn lại các câu 2 sao',exact:true}).click();await expect(sourceSet.locator('details')).toHaveAttribute('open','');if(await loadGames.isVisible())await loadGames.click();await page.getByRole('combobox',{name:'Trò để học và ôn · Bộ tuần 1',exact:true}).selectOption('word-connect');await sourceSet.getByRole('button',{name:/^Học bộ này ·/}).click();
    for(const item of packs[0].items){await page.locator(`.connect-col-left [data-pair-id="${item.id}"]`).click();await page.locator(`.connect-col-right [data-pair-id="${item.id}"]`).click();}
    await expect(page.locator('.question-completion')).toBeVisible();await page.getByRole('button',{name:'Trở về hành trình',exact:true}).click();state=await api('/student/summary?cursor=current');expect(state.balance.earned).toBe(12);expect(state.currentWeekSummary).toMatchObject({two:0,three:4,ready:true});await expect(sourceSet.locator('summary')).toContainText('4 câu 3 sao');
    await page.getByRole('button',{name:'Sang Tuần 02',exact:true}).click();dialog=page.getByRole('dialog',{name:'Sang Tuần 02?',exact:true});let advanceBody:any;
    page.on('request',request=>{if(new URL(request.url()).pathname==='/api/online/student/advance-week')advanceBody=request.postDataJSON();});await expect(dialog).toContainText('0 câu 2 sao');await expect(dialog).toContainText('4 câu 3 sao');await dialog.getByRole('button',{name:'Xác nhận sang tuần mới',exact:true}).click();await expect(page.getByLabel('Tiến độ tuần hiện tại')).toContainText('Tuần 02: 0/4 câu đạt yêu cầu');await page.getByRole('button',{name:'Xem tóm tắt các bộ trước',exact:true}).click();await expect(page.locator('.online-week-path > li.is-done')).toContainText('Tuần này đã khóa');await expect(sourceSet.locator('details')).toHaveCount(0);
    expect((await api('/student/advance-week',advanceBody)).currentWeekSummary.weekId).toBe(week2.id);expect((await api('/student/summary?cursor=current')).balance.earned).toBe(12);
    expect((await request('/play/compact',originalStart)).status()).toBe(403);expect((await request(`/play/${originalPlay.session.sessionId}/question-open`,{itemId:packs[0].items[0].id})).status()).toBe(403);
    await page.reload();await expect(page.getByLabel('Tiến độ tuần hiện tại')).toContainText('Tuần 02: 0/4 câu đạt yêu cầu');expect(errors).toEqual([]);await page.screenshot({path:testInfo.outputPath('journey-closed-week-one.png'),fullPage:true});
  }finally{await page.unrouteAll({behavior:'ignoreErrors'});server.closeAllConnections?.();await new Promise<void>(resolve=>server.close(()=>resolve()));server.onlineClose();expect(path.dirname(path.resolve(directory))).toBe(root);expect(path.basename(directory)).toMatch(/^question-journey-/);await rm(directory,{recursive:true,force:true});}
});
