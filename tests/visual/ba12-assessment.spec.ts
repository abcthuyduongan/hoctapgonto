import path from 'node:path';
import { test,expect,type Page } from '@playwright/test';
import { rows,readCards,answer,advancedLearningPath } from './helpers/self-study';
import { createLearningStorageServer } from './helpers/learning-storage';
import { learningStorageFixture } from './helpers/learning-storage-fixture';
import { buildLessonSession } from '../../src/core/lesson-host';
test.use({serviceWorkers:'block'});
let server:Awaited<ReturnType<typeof createLearningStorageServer>>;
test.beforeAll(async()=>{server=await createLearningStorageServer(path.resolve('test-results',`ba12-core-${process.pid}-${Date.now()}`));});
test.afterAll(async()=>server?.close());
const cases=[['Toán','Vận dụng bảng nhân và chia'],['Tiếng Việt','Hiểu nghĩa từ và từ trái nghĩa'],['Tiếng Anh','Từ vựng gia đình']];
async function startPractice(page:Page,subject='Toán',title=cases[0][1]){
  await page.goto(advancedLearningPath);await page.getByRole('button',{name:subject,exact:true}).click();
  const card=page.getByRole('article',{name:`Bài ${title}`});await card.getByRole('button',{name:'Học bài này',exact:true}).click();return card;
}
async function startAssessment(page:Page,card:ReturnType<Page['getByRole']>){await page.getByRole('button',{name:'Chọn bước tiếp theo'}).click();await card.getByRole('button',{name:'Tự mình thử sức',exact:true}).click();await expect(page.getByRole('button',{name:'Con cần gợi ý'})).toBeVisible();}
for(const [subject,title] of cases)test(`BA12: ${subject} first score stays 3/5 after correction; fresh form then earns tier two`,async({page})=>{
  const card=await startPractice(page,subject,title);await answer(page);await startAssessment(page,card);await answer(page,false,2);
  await expect(page.getByRole('region',{name:'Kết quả bài học'})).toContainText('3/5');await expect(page.getByLabel('Câu cần xem lại')).toBeVisible();
  const first=(await rows(page)).sessionResults.find(row=>row.mode==='lesson-assessment');expect(first).toMatchObject({starTier:0,passed:false,firstAttemptCorrect:3});
  await page.getByRole('button',{name:'Xem lại và luyện có hướng dẫn'}).click();await answer(page);
  const corrected=await rows(page);expect(corrected.sessionResults.find(row=>row.resultId===first.resultId)).toEqual(first);expect(corrected.lessonProgress[0].bestStars).toBe(1);
  await startAssessment(page,card);const session=(await rows(page)).sessions.find(row=>row.status==='active'&&row.mode);expect(session.formId).not.toBe(first.formId);
  await answer(page);await expect(card.getByText('Đã vượt qua',{exact:true})).toBeVisible();expect((await rows(page)).lessonProgress[0].bestStars).toBe(2);
});
test('BA12: exhausted independent pool keeps honest stars and an enabled practice path',async({page})=>{
  const card=await startPractice(page);await answer(page);
  const current=await rows(page),pin=current.profiles[0].learningSettings.enrollments.find((row:any)=>row.curriculumId.endsWith('-math'));
  const forms=current.curricula.find(row=>row.curriculum.curriculumId===pin.curriculumId&&row.curriculum.revision===pin.curriculumRevision).curriculum.lessons[0].forms.filter((form:any)=>form.role==='assessment');
  for(let attempt=0;attempt<forms.length;attempt++){await startAssessment(page,card);await answer(page,false,2);}
  await page.getByRole('button',{name:'Chọn bước tiếp theo'}).click();await expect(card).toContainText('Đã dùng hết bộ kiểm tra mới');
  await expect(card.getByRole('button',{name:'Tự mình thử sức',exact:true})).toBeDisabled();await expect(card.getByRole('button',{name:'Học và luyện lại',exact:true})).toBeEnabled();
  expect((await rows(page)).lessonProgress[0]).toMatchObject({bestStars:1,passed:false});
});
async function failOnce(page:Page,storeName:string,method:'add'|'put'){
  await page.evaluate(({storeName,method})=>{
    const original=IDBObjectStore.prototype[method],originalAdd=IDBObjectStore.prototype.add;
    (window as any).__ba12FailedKeys=[];
    IDBObjectStore.prototype.add=function(value:any,...rest:any[]){if(this.name==='events')(window as any).__ba12FailedKeys.push(value.attemptKey);return originalAdd.call(this,value,...rest);};
    if(method==='add'){
      const instrumented=IDBObjectStore.prototype.add;
      IDBObjectStore.prototype.add=function(value:any,...rest:any[]){if(this.name===storeName){IDBObjectStore.prototype.add=originalAdd;throw new DOMException('BA12 quota','QuotaExceededError');}return instrumented.call(this,value,...rest);};
    }else IDBObjectStore.prototype.put=function(value:any,...rest:any[]){if(this.name===storeName){IDBObjectStore.prototype.put=original;throw new DOMException('BA12 quota','QuotaExceededError');}return original.call(this,value,...rest);};
  },{storeName,method});
}
test('BA12: a failed answer save keeps the pending response, exposes no result, and retries the same logical answer',async({page})=>{
  await startPractice(page);await readCards(page);const before=await rows(page);await failOnce(page,'reviews','put');
  await page.getByRole('group',{name:'Chọn câu trả lời'}).getByRole('button').first().click();await page.getByRole('button',{name:'Gửi câu trả lời',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('BA12 quota');await expect(page.getByText('Đúng rồi!',{exact:true})).toHaveCount(0);expect(await rows(page)).toEqual(before);
  await expect(page.getByRole('group',{name:'Chọn câu trả lời'}).getByRole('button').first()).toBeDisabled();
  const failedKey=await page.evaluate(()=>(window as any).__ba12FailedKeys[0]);await page.getByRole('button',{name:'Thử lưu lại',exact:true}).click();await expect(page.getByText('Đúng rồi!',{exact:true})).toBeVisible();
  const saved=await rows(page);expect(saved.events).toHaveLength(1);expect(saved.events[0].attemptKey).toBe(failedKey);expect(saved.sessionResults).toHaveLength(0);
});
test('BA12: a failed final result save awards no star and retry commits exactly one result',async({page})=>{
  await startPractice(page);await answer(page,false,0,false);const before=await rows(page);await failOnce(page,'sessionResults','add');
  await page.getByRole('button',{name:'Hoàn tất và lưu',exact:true}).click();await expect(page.getByRole('alert')).toContainText('BA12 quota');expect(await rows(page)).toEqual(before);
  await expect(page.getByRole('region',{name:'Kết quả bài học'})).toHaveCount(0);
  await page.getByRole('button',{name:'Hoàn tất và lưu',exact:true}).click();await expect(page.getByRole('region',{name:'Kết quả bài học'})).toContainText('nhận thêm 1 sao');
  const saved=await rows(page);expect(saved.sessionResults).toHaveLength(1);expect(saved.lessonProgress[0].bestStars).toBe(1);
});
test('BA12: navigation after a committed independent answer resumes the next question without changing the first score',async({page})=>{
  const card=await startPractice(page);await answer(page);await startAssessment(page,card);
  const initial=await rows(page),session=initial.sessions.find(row=>row.status==='active'&&row.mode),ref=session.checkpoint.itemOrder[0],item=initial.packs.find(row=>row.pack.id===ref.packId).pack.items.find((row:any)=>row.id===ref.itemId);
  await page.getByRole('group',{name:'Chọn câu trả lời'}).getByRole('button').nth((item.correctIndex+1)%4).click();await page.getByRole('button',{name:'Gửi câu trả lời',exact:true}).click();
  await expect.poll(async()=>(await rows(page)).events.filter(row=>row.sessionId===session.sessionId).length).toBe(1);await page.reload();
  await page.getByRole('button',{name:'Tiếp tục bài đang học',exact:true}).click();await answer(page);
  const saved=await rows(page),result=saved.sessionResults.find(row=>row.sessionId===session.sessionId);expect(result).toMatchObject({firstAttemptCorrect:4,totalItems:5,starTier:2});
  expect(saved.events.filter(row=>row.sessionId===session.sessionId)).toHaveLength(5);
});
test('BA12: production writer captures legacy answers and blocks an exposed independent form',async({page})=>{
  await page.goto(`${server.origin}/qa-storage`);await page.waitForFunction(()=>!!(window as any).__learningStorage);
  const f=learningStorageFixture('legacy-writer'),form=f.curriculum.lessons[0].forms[1],ref=form.itemRefs[0];
  const invoke=(method:string,args:any[]=[])=>page.evaluate(async({method,args})=>{try{return {ok:true,value:await (window as any).__learningStorage.storage[method](...args)};}catch(error){return {ok:false,error:String(error)};}},{method,args});
  await invoke('listProfiles');await invoke('savePack',[f.pack]);await invoke('saveCurriculum',[f.curriculum]);await invoke('saveProfile',[f.profile]);
  // Fixture practice evidence is validated before insertion; only the legacy answer is newly committed here.
  await page.evaluate(async f=>{const db=await (window as any).__learningStorage.openLearningDatabase();await new Promise<void>((resolve,reject)=>{const tx=db.transaction(['sessions','events'],'readwrite');tx.objectStore('sessions').add(f.session);f.events.forEach(event=>tx.objectStore('events').add(event));tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);});},f);
  expect((await invoke('saveSessionResult',[f.result])).ok).toBe(true);
  const legacy={sessionId:'legacy-evidence-game',profileId:f.profile.profileId,packId:ref.packId,contentVersion:1,moduleId:'math-quest',moduleVersion:'1.0.0',startedAt:'2026-10-12T10:10:00.000Z',status:'active'};
  expect((await invoke('createSession',[legacy])).ok).toBe(true);expect((await invoke('addEvent',[{eventId:'legacy-evidence-game:answer',sessionId:legacy.sessionId,profileId:f.profile.profileId,packId:ref.packId,contentVersion:1,moduleId:'math-quest',moduleVersion:'1.0.0',itemId:ref.itemId,objectiveId:f.pack.items[0].objectiveId,correct:false,hintsUsed:0,elapsedMs:1000,occurredAt:'2026-10-12T10:10:30.000Z'}])).ok).toBe(true);
  const context={curricula:[f.curriculum],packs:[f.pack],sessions:[f.session],events:f.events,results:[f.result],profiles:[f.profile]};
  const session=buildLessonSession(f.profile.profileId,f.curriculum,f.curriculum.lessons[0],form,context,'owner','legacy-exposed-assessment','2026-10-12T11:00:00.000Z');
  const rejected=await invoke('createLearningSession',[session]);expect(rejected.ok).toBe(false);expect(rejected.error).toContain('đã lộ lời giải');
  session.mode='lesson-practice';session.guidedFrom='lesson-assessment';const guided=await invoke('createLearningSession',[session]);expect(guided.ok).toBe(true);expect(guided.value.exposureSources.legacyEventIds).toEqual(['legacy-evidence-game:answer']);
});
