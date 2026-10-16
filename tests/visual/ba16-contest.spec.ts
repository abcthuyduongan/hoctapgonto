import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { expect,test,type Page } from '@playwright/test';
import { rows,answer,advancedContestPath } from './helpers/self-study';
import { answerRich } from './helpers/rich-study';
import { createLearningStorageServer } from './helpers/learning-storage';
import { LIBRARY_CURRICULA,LIBRARY_PACKS,RICH_CURRICULA } from '../../src/core/lesson-seed';
import { CONTEST_CURRICULA } from '../../src/core/contest-catalog';
import { buildLessonSession } from '../../src/core/lesson-host';
import { findRefItem } from '../../src/core/curriculum';
import { parseLearningBackup } from '../../src/core/backup-io';
import type { LearningSubject } from '../../src/core/learning-contracts';

test.use({serviceWorkers:'block'});
let server:Awaited<ReturnType<typeof createLearningStorageServer>>;
test.beforeAll(async()=>{server=await createLearningStorageServer(path.resolve('test-results',`ba16-core-${process.pid}-${Date.now()}`));});
test.afterAll(async()=>server?.close());

const routes=[
  {subject:'math' as const,label:'Toán',path:'Toán hướng tới Violympic',lessons:['Vận dụng bảng nhân và chia','Giải bài toán một bước'],maximum:100},
  {subject:'vietnamese' as const,label:'Tiếng Việt',path:'Tiếng Việt hướng tới Trạng Nguyên',lessons:['Hiểu nghĩa từ và từ trái nghĩa','Đọc đoạn ngắn, tìm thông tin'],maximum:300},
  {subject:'english' as const,label:'Tiếng Anh',path:'Tiếng Anh hướng tới IOE',lessons:['Từ vựng gia đình','Câu giới thiệu đơn giản'],maximum:100},
];
async function call(page:Page,method:string,args:unknown[]=[]):Promise<any>{return page.evaluate(async({method,args})=>(window as any).__learningStorage.storage[method](...args),{method,args});}
async function invoke(page:Page,method:string,args:unknown[]=[]){return page.evaluate(async({method,args})=>{try{return {ok:true,value:await(window as any).__learningStorage.storage[method](...args)};}catch(error){return {ok:false,error:String(error)};}},{method,args});}
async function harness(page:Page){await page.goto(`${server.origin}/qa-storage`);await page.waitForFunction(()=>!!(window as any).__learningStorage);}
async function foundations(page:Page,subject:LearningSubject){
  await harness(page);await call(page,'ensureLearningLibrary',[LIBRARY_PACKS,LIBRARY_CURRICULA]);
  const profile=(await call(page,'listProfiles'))[0],curriculum=RICH_CURRICULA.find(row=>row.subject===subject)!;
  const enrolled=await call(page,'enrollLearningCurriculum',[profile.profileId,curriculum]);
  const context:any={packs:LIBRARY_PACKS,curricula:LIBRARY_CURRICULA,sessions:[],events:[],results:[],profiles:[enrolled]};
  const base=Date.now()-60_000;let offset=0;
  for(const lesson of curriculum.lessons)for(const role of ['practice','assessment'] as const){
    const form=lesson.forms.find(row=>row.role===role)!,start=new Date(base+offset).toISOString();
    const draft=buildLessonSession(profile.profileId,curriculum,lesson,form,context,'contest-fixture-owner',`${lesson.lessonId}-${role}`,start);
    let session=await call(page,'createLearningSession',[draft]);
    if(role==='practice')for(const step of lesson.steps)session=await call(page,'markLessonStep',[session.sessionId,'contest-fixture-owner',step.stepId,new Date(base+offset+1).toISOString()]);
    for(const [index,itemRef] of form.itemRefs.entries()){
      const item:any=findRefItem(itemRef,LIBRARY_PACKS),response=item.options?{version:1,kind:'choice',selectedIndex:item.correctIndex}:{version:1,kind:'text',value:item.answer??item.acceptedAnswers[0]};
      const commit=await call(page,'submitLessonAttempt',[session.sessionId,'contest-fixture-owner',{attemptKey:`answer-${index}`,itemRef,response,hintsUsed:0,elapsedMs:1000},new Date(base+offset+index+2).toISOString()]);
      session=commit.session;context.events.push(commit.event);
    }
    const receipt=await call(page,'finalizeLearningSession',[session.sessionId,'contest-fixture-owner',new Date(base+offset+1000).toISOString()]);
    context.sessions.push(await call(page,'getLearningSession',[session.sessionId]));context.results.push(receipt.result);offset+=2000;
  }
  return {profile:enrolled,curriculum,context};
}
async function openContest(page:Page,pathName:string){await page.getByRole('button',{name:'Luyện thi',exact:true}).click();const card=page.getByRole('article',{name:pathName,exact:true});await expect(card.getByRole('button',{name:'Bắt đầu luyện tổng hợp',exact:true})).toBeEnabled();await card.getByRole('button',{name:'Bắt đầu luyện tổng hợp',exact:true}).click();await expect(page.getByRole('timer',{name:'Thời gian còn lại'})).toBeVisible();}
async function answerCurrent(page:Page){const data=await rows(page),session=data.sessions.find(row=>row.status==='active'&&row.mode==='contest-mock'),ref=session.checkpoint.itemOrder[0],item:any=findRefItem(ref,data.packs.map(row=>row.pack));
  const question=page.getByRole('article',{name:'Câu hỏi đang làm'});if(item.options)await question.getByRole('group',{name:'Chọn câu trả lời'}).getByRole('button').nth(item.correctIndex).click();else await question.getByRole('textbox').fill(item.answer??item.acceptedAnswers[0]);
  await question.getByRole('button',{name:'Gửi câu trả lời',exact:true}).click();await question.getByRole('button',{name:'Tiếp tục',exact:true}).click();}

for(const route of routes)test(`BA16: two ${route.label} foundation lessons unlock a real mixed practice turn without adding learning stars`,async({page})=>{
  test.setTimeout(120_000);await page.goto(advancedContestPath);await page.getByRole('button',{name:'Luyện thi',exact:true}).click();
  await expect(page.getByRole('article',{name:route.path,exact:true}).getByRole('button',{name:'Bắt đầu luyện tổng hợp',exact:true})).toBeDisabled();
  await page.getByRole('article',{name:route.path,exact:true}).getByRole('button',{name:'Học kiến thức nền',exact:true}).click();
  for(const title of route.lessons){const card=page.getByRole('article',{name:`Bài ${title}`,exact:true});
    await card.getByRole('button',{name:'Học bài này',exact:true}).click();await answer(page);await page.getByRole('button',{name:'Chọn bước tiếp theo',exact:true}).click();
    await card.getByRole('button',{name:'Tự mình thử sức',exact:true}).click();await answer(page);await page.getByRole('button',{name:'Chọn bước tiếp theo',exact:true}).click();
  }
  const before=await rows(page);expect(before.lessonProgress.reduce((sum,row)=>sum+row.bestStars,0)).toBe(4);
  await openContest(page,route.path);await expect(page.getByRole('button',{name:/Gợi ý/})).toHaveCount(0);
  if(route.subject==='math'){
    await answerCurrent(page);await page.getByRole('button',{name:'Bỏ qua câu này',exact:true}).click();await page.getByRole('button',{name:'Nộp lượt luyện',exact:true}).click();
    await expect(page.getByRole('region',{name:'Kết quả luyện tổng hợp'})).toContainText('10/100 điểm');
    await expect(page.getByRole('region',{name:'Kết quả luyện tổng hợp'})).toContainText('1 câu bỏ qua · 8 câu chưa làm');
  }else{await answerRich(page, -1,false);await page.getByRole('button',{name:'Hoàn tất và lưu',exact:true}).click();await expect(page.getByRole('region',{name:'Kết quả luyện tổng hợp'})).toContainText(`${route.maximum}/${route.maximum} điểm`);}
  const after=await rows(page),result=after.sessionResults.find(row=>row.mode==='contest-mock');expect(result).toMatchObject({starTier:0,passed:false,independent:false});
  expect(after.lessonProgress.reduce((sum,row)=>sum+row.bestStars,0)).toBe(4);expect(after.sessionResults).toHaveLength(5);
  expect(after.lessonProgress.filter(row=>row.bestStars>0)).toEqual(before.lessonProgress);
  if(route.subject==='english'){const session=after.sessions.find(row=>row.sessionId===result.sessionId);expect(session.checkpoint.mediaPlayback).toHaveLength(5);}
});

test('BA16: pause and reload preserve the original deadline, then expiry saves ten unanswered items at zero score',async({page})=>{
  await foundations(page,'math');await page.clock.install({time:new Date()});await page.goto(server.origin+advancedContestPath);await openContest(page,routes[0].path);
  const initial=(await rows(page)).sessions.find(row=>row.mode==='contest-mock');await page.getByRole('button',{name:/Tạm dừng và lưu/}).click();await page.reload();await page.getByRole('button',{name:'Luyện thi',exact:true}).click();
  await page.getByRole('article',{name:routes[0].path,exact:true}).getByRole('button',{name:'Tiếp tục lượt đang làm',exact:true}).click();
  expect((await rows(page)).sessions.find(row=>row.sessionId===initial.sessionId).checkpoint.deadlineAt).toBe(initial.checkpoint.deadlineAt);
  await page.clock.fastForward(601_000);await expect(page.getByRole('region',{name:'Kết quả luyện tổng hợp'})).toContainText('Đã hết giờ');
  const result=(await rows(page)).sessionResults.find(row=>row.sessionId===initial.sessionId);expect(result).toMatchObject({firstAttemptCorrect:0,starTier:0,eventIds:[],contest:{score:0,elapsedMs:600_000,finishReason:'timeout',skippedItemKeys:[]}});expect(result.contest.unansweredItemKeys).toHaveLength(10);
});

test('BA16: real storage rolls back a failed contest finalizer, rejects a second owner and commits only one concurrent receipt',async({page,context})=>{
  const seeded=await foundations(page,'math'),catalog=CONTEST_CURRICULA.find(row=>row.subject==='math')!,profile=await call(page,'enrollLearningCurriculum',[seeded.profile.profileId,catalog]);seeded.context.profiles=[profile];
  const start=new Date().toISOString(),session=buildLessonSession(profile.profileId,catalog,catalog.lessons[0],catalog.lessons[0].forms[0],seeded.context,'contest-storage-owner','contest-storage-atomic',start);
  session.mode='contest-mock';session.contestSource={curriculumId:seeded.curriculum.curriculumId,curriculumRevision:seeded.curriculum.revision};session.checkpoint.deadlineAt=new Date(Date.parse(start)+600_000).toISOString();await call(page,'createLearningSession',[session]);
  const other=await context.newPage();try{await harness(other);expect((await invoke(other,'resumeLearningSession',[session.sessionId,'wrong-owner'])).ok).toBe(false);
    const before=await rows(page);await page.evaluate(()=>{const native=IDBObjectStore.prototype.add;IDBObjectStore.prototype.add=function(value,key){const request=native.call(this,value,key);if(this.name==='sessionResults'){IDBObjectStore.prototype.add=native;request.addEventListener('success',()=>this.transaction.abort());}return request;};});
    expect((await invoke(page,'finalizeLearningSession',[session.sessionId,'contest-storage-owner'])).ok).toBe(false);expect(await rows(page)).toEqual(before);
    const receipts=await Promise.all([call(page,'finalizeLearningSession',[session.sessionId,'contest-storage-owner']),call(other,'finalizeLearningSession',[session.sessionId,'contest-storage-owner'])]);
    expect(receipts.filter(row=>row.duplicate)).toHaveLength(1);expect(receipts.map(row=>row.result.resultId)).toEqual([receipts[0].result.resultId,receipts[0].result.resultId]);expect(receipts.every(row=>row.newStars===0&&row.result.starTier===0)).toBe(true);
    expect((await rows(page)).sessionResults).toHaveLength(5);
  }finally{await other.close();}
});

test('BA16: family portal checklist survives reload and backup without unlocking the two foundation requirements',async({page})=>{
  await page.goto(advancedContestPath);await page.getByRole('button',{name:'Luyện thi',exact:true}).click();const section=page.getByRole('region',{name:'Phụ huynh theo dõi trên cổng'}),check=section.getByRole('checkbox').first();await check.check();await expect(check).toBeChecked();
  const before=await rows(page),record=before.profiles[0].learningSettings.contestChecklist[0];expect(record).toMatchObject({contest:'violympic'});expect(record.source).toMatch(/^https:/);expect(Number.isFinite(Date.parse(record.confirmedAt))).toBe(true);
  await page.reload();await page.getByRole('button',{name:'Luyện thi',exact:true}).click();await expect(page.getByRole('region',{name:'Phụ huynh theo dõi trên cổng'}).getByRole('checkbox').first()).toBeChecked();
  await expect(page.getByRole('article',{name:routes[0].path,exact:true}).getByRole('button',{name:'Bắt đầu luyện tổng hợp',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Góc phụ huynh',exact:true}).click();const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Tải bản sao hồ sơ',exact:true}).click();const download=await pending,backup=parseLearningBackup(await readFile((await download.path())!,'utf8'));
  expect(backup.profiles[0].learningSettings?.contestChecklist).toEqual([record]);expect(backup.sessionResults).toEqual([]);expect(backup.lessonProgress).toEqual([]);
});
