import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import type { LearningSession, LessonAttemptCommit, LessonCompletionCommit } from '../../src/core/learning-contracts';
import { learningStorageFixture } from './helpers/learning-storage-fixture';
import { createLearningStorageServer } from './helpers/learning-storage';

test.use({serviceWorkers:'block'});
let server:Awaited<ReturnType<typeof createLearningStorageServer>>;
test.beforeAll(async()=>{server=await createLearningStorageServer(path.resolve('test-results',`ba10-core-${process.pid}-${Date.now()}`));});
test.afterAll(async()=>{await server?.close();});
const owner='ba10-owner';
const plus=(time:string,seconds:number)=>new Date(Date.parse(time)+seconds*1000).toISOString();
async function harness(page:Page){await page.goto(`${server.origin}/qa-storage`);await page.waitForFunction(()=>!!(window as any).__learningStorage);}
async function invoke(page:Page,method:string,args:unknown[]=[]){return page.evaluate(async({method,args})=>{
  try{return {ok:true,value:await (window as any).__learningStorage.storage[method](...args)};}
  catch(error){return {ok:false,message:error instanceof Error?error.message:String(error)};}
},{method,args});}
async function call<T=any>(page:Page,method:string,args:unknown[]=[]):Promise<T>{const response=await invoke(page,method,args);if(!response.ok)throw new Error(`${method}: ${response.message}`);return response.value;}
async function snapshot(page:Page){return page.evaluate(async()=>{
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open('bao-an-learning-v3-alpha');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
  try{return await new Promise<Record<string,unknown[]>>((resolve,reject)=>{
    const stores=[...db.objectStoreNames],tx=db.transaction(stores,'readonly'),reads=Object.fromEntries(stores.map(name=>[name,tx.objectStore(name).getAll()]));
    tx.oncomplete=()=>resolve(Object.fromEntries(stores.map(name=>[name,reads[name].result])));tx.onabort=()=>reject(tx.error);
  });}finally{db.close();}
});}
async function setup(page:Page,prefix:string){await harness(page);await call(page,'listProfiles');const fixture=learningStorageFixture(prefix);
  await call(page,'savePack',[fixture.pack]);await call(page,'saveCurriculum',[fixture.curriculum]);await call(page,'saveProfile',[fixture.profile]);return fixture;}
function active(fixture:ReturnType<typeof learningStorageFixture>,role:'practice'|'assessment'|'review',start:string,id=role,practiceIds:string[]=[],passId?:string):LearningSession{
  const form=fixture.curriculum.lessons[0].forms.find(row=>row.role===role)!;
  const session:LearningSession={...structuredClone(fixture.session),ownerTabId:owner,sessionId:`${fixture.session.sessionId}-${id}`,status:'active',
    mode:role==='practice'?'lesson-practice':role==='assessment'?'lesson-assessment':'lesson-review',activityId:form.activityId,formId:form.formId,formRevision:form.revision,
    blueprint:form.blueprint,startedAt:start,checkpoint:{...structuredClone(fixture.session.checkpoint),stepIndex:0,readStepIds:[],receipts:[],exposedItemKeys:[],
      formId:form.formId,formRevision:form.revision,itemOrder:form.itemRefs,updatedAt:start},sourcePracticeResultIds:practiceIds};
  delete session.endedAt;delete session.sourcePassResultId;if(passId)session.sourcePassResultId=passId;return session;
}
async function read(page:Page,session:LearningSession){for(const step of [session.scope.lessonId.replace(/-lesson$/,'-step')])await call(page,'markLessonStep',[session.sessionId,owner,step,plus(session.startedAt,1)]);}
async function answerAll(page:Page,session:LearningSession,wrongCount=0){for(const [index,itemRef] of session.checkpoint.itemOrder.entries())await call(page,'submitLessonAttempt',
  [session.sessionId,owner,{attemptKey:`q-${index}`,itemRef,response:{version:1,kind:'choice',selectedIndex:index<wrongCount?1:0},hintsUsed:0,elapsedMs:15000},plus(session.startedAt,index+2)]);}
async function practice(page:Page,fixture:ReturnType<typeof learningStorageFixture>){const session=active(fixture,'practice','2026-10-12T10:00:00.000Z');await call(page,'createLearningSession',[session]);await read(page,session);await answerAll(page,session);
  return call<LessonCompletionCommit>(page,'finalizeLearningSession',[session.sessionId,owner,plus(session.startedAt,10)]);}

test('BA10: host-scored practice correction, assessment and delayed review commit 1→2→3 stars exactly once',async({page})=>{
  const fixture=await setup(page,'ba10-stars');const p=active(fixture,'practice','2026-10-12T10:00:00.000Z');await call(page,'createLearningSession',[p]);
  // A component's old read flags cannot grant the reading evidence.
  expect((await call<LearningSession>(page,'getLearningSession',[p.sessionId])).checkpoint.readStepIds).toEqual([]);
  await read(page,p);await answerAll(page,p,1);
  expect((await invoke(page,'finalizeLearningSession',[p.sessionId,owner,plus(p.startedAt,10)])).ok).toBe(false);
  const repaired=await call<LessonAttemptCommit>(page,'submitLessonAttempt',[p.sessionId,owner,{attemptKey:'repair',itemRef:p.checkpoint.itemOrder[0],response:{version:1,kind:'choice',selectedIndex:0},hintsUsed:1,elapsedMs:5000},plus(p.startedAt,11)]);
  expect(repaired.event.correct).toBe(true);expect(repaired.event.submissionIndex).toBe(2);
  const one=await call<LessonCompletionCommit>(page,'finalizeLearningSession',[p.sessionId,owner,plus(p.startedAt,12)]);
  expect(one.result).toMatchObject({starTier:1,independent:false,firstAttemptCorrect:4,practiceCorrected:true});expect(one.newStars).toBe(1);
  const a=active(fixture,'assessment',plus(p.startedAt,60),'assessment',[one.result.resultId]);await call(page,'createLearningSession',[a]);await answerAll(page,a,1);
  expect((await snapshot(page)).reviews).toHaveLength(5); // Independent schedule is withheld until completion.
  const two=await call<LessonCompletionCommit>(page,'finalizeLearningSession',[a.sessionId,owner,plus(a.startedAt,10)]);
  expect(two.result).toMatchObject({starTier:2,passed:true,firstAttemptCorrect:4,totalItems:5});expect(two.newStars).toBe(1);
  const tooSoon=active(fixture,'review',plus(a.startedAt,86400),'early',[one.result.resultId],two.result.resultId);
  expect((await invoke(page,'createLearningSession',[tooSoon])).ok).toBe(false);
  const r=active(fixture,'review',plus(a.startedAt,90000),'review',[one.result.resultId],two.result.resultId);
  await call(page,'createLearningSession',[r]);await answerAll(page,r,1);
  const three=await call<LessonCompletionCommit>(page,'finalizeLearningSession',[r.sessionId,owner,plus(r.startedAt,10)]);
  expect(three.result.starTier).toBe(3);expect(three.progress.bestStars).toBe(3);expect(three.newStars).toBe(1);
  const before=await snapshot(page);const replay=await call<LessonCompletionCommit>(page,'finalizeLearningSession',[r.sessionId,owner,plus(r.startedAt,99)]);
  expect(replay).toEqual({...three,newStars:0,duplicate:true});expect(await snapshot(page)).toEqual(before);
  expect(before.sessionResults).toHaveLength(3);expect(before.lessonProgress).toHaveLength(1);
  expect(before.reviews).toHaveLength(15);expect(before.reviews.filter((row:any)=>row.evidenceKind==='independent')).toHaveLength(10);
});

test('BA10: missing evidence, different-owner writes, duplicate submissions and a 3/5 assessment preserve honest outcomes',async({page})=>{
  const fixture=await setup(page,'ba10-evidence'),one=await practice(page,fixture);const a=active(fixture,'assessment','2026-10-12T10:01:00.000Z','assessment',[one.result.resultId]);
  await call(page,'createLearningSession',[a]);const empty=await snapshot(page);
  expect((await invoke(page,'finalizeLearningSession',[a.sessionId,owner,plus(a.startedAt,1)])).ok).toBe(false);expect(await snapshot(page)).toEqual(empty);
  const input={attemptKey:'first',itemRef:a.checkpoint.itemOrder[0],response:{version:1,kind:'choice',selectedIndex:1},hintsUsed:0,elapsedMs:2000};
  expect((await invoke(page,'submitLessonAttempt',[a.sessionId,'another-owner',input,plus(a.startedAt,2)])).ok).toBe(false);
  const committed=await call<LessonAttemptCommit>(page,'submitLessonAttempt',[a.sessionId,owner,input,plus(a.startedAt,2)]);const saved=await snapshot(page);
  const retry=await call<LessonAttemptCommit>(page,'submitLessonAttempt',[a.sessionId,owner,{...input,elapsedMs:9000},plus(a.startedAt,3)]);
  expect(retry.event).toEqual(committed.event);expect(retry.duplicate).toBe(true);expect(await snapshot(page)).toEqual(saved);
  expect((await invoke(page,'submitLessonAttempt',[a.sessionId,owner,{...input,attemptKey:'new-key',response:{version:1,kind:'choice',selectedIndex:0}},plus(a.startedAt,4)])).ok).toBe(false);
  for(const [index,itemRef] of a.checkpoint.itemOrder.entries()){if(index===0)continue;await call(page,'submitLessonAttempt',[a.sessionId,owner,{...input,attemptKey:`q-${index}`,itemRef,response:{version:1,kind:'choice',selectedIndex:index===1?1:0}},plus(a.startedAt,index+4)]);}
  const failed=await call<LessonCompletionCommit>(page,'finalizeLearningSession',[a.sessionId,owner,plus(a.startedAt,12)]);
  expect(failed.result).toMatchObject({firstAttemptCorrect:3,completed:true,passed:false,starTier:0});expect(failed.progress.bestStars).toBe(1);
});

test('BA10: a knowledge hint changes the assessment to guided practice and cannot award independent stars',async({page})=>{
  const fixture=await setup(page,'ba10-hint'),one=await practice(page,fixture),a=active(fixture,'assessment','2026-10-12T10:01:00.000Z','assessment',[one.result.resultId]);await call(page,'createLearningSession',[a]);
  const guided=await call<LearningSession>(page,'useLessonKnowledgeHint',[a.sessionId,owner,plus(a.startedAt,1)]);
  expect(guided.mode).toBe('lesson-practice');expect(guided.guidedFrom).toBe('lesson-assessment');await read(page,{...a,startedAt:plus(a.startedAt,1)});await answerAll(page,{...a,startedAt:plus(a.startedAt,2)});
  const done=await call<LessonCompletionCommit>(page,'finalizeLearningSession',[a.sessionId,owner,plus(a.startedAt,12)]);
  expect(done.result).toMatchObject({starTier:1,independent:false,passed:false});expect(done.newStars).toBe(0);
});

test('BA10: pause/reload/resume preserves form, seed, order, receipt and deadline; other tabs cannot steal active ownership',async({page,context})=>{
  const fixture=await setup(page,'ba10-resume'),p=active(fixture,'practice','2026-10-12T10:00:00.000Z');p.checkpoint.deadlineAt=plus(p.startedAt,60);await call(page,'createLearningSession',[p]);await read(page,p);
  const input={attemptKey:'q0',itemRef:p.checkpoint.itemOrder[0],response:{version:1,kind:'choice',selectedIndex:0},hintsUsed:0,elapsedMs:2000};
  const receipt=await call<LessonAttemptCommit>(page,'submitLessonAttempt',[p.sessionId,owner,input,plus(p.startedAt,2)]);
  await call(page,'pauseLearningSession',[p.sessionId,owner,plus(p.startedAt,3)]);await harness(page);
  const resumed=await call<LearningSession>(page,'resumeLearningSession',[p.sessionId,'new-owner',plus(p.startedAt,4)]);
  expect(resumed.checkpoint).toMatchObject({formId:p.formId,seed:p.checkpoint.seed,itemOrder:p.checkpoint.itemOrder,receipts:receipt.session.checkpoint.receipts,deadlineAt:p.checkpoint.deadlineAt});
  const other=await context.newPage();try{await harness(other);expect((await invoke(other,'resumeLearningSession',[p.sessionId,'foreign-owner',plus(p.startedAt,5)])).ok).toBe(false);}finally{await other.close();}
  expect((await call<LessonAttemptCommit>(page,'submitLessonAttempt',[p.sessionId,'new-owner',input,plus(p.startedAt,5)])).duplicate).toBe(true);
  expect((await invoke(page,'submitLessonAttempt',[p.sessionId,'new-owner',{...input,attemptKey:'q1',itemRef:p.checkpoint.itemOrder[1]},plus(p.startedAt,61)])).ok).toBe(false);
});

for(const failedStore of ['sessionResults','lessonProgress','reviews','sessions'] as const){
  test(`BA10: failure in ${failedStore} rolls back completion, stars and review; owner can retry`,async({page})=>{
    const fixture=await setup(page,`ba10-rollback-${failedStore.toLowerCase()}`),one=await practice(page,fixture),a=active(fixture,'assessment','2026-10-12T10:01:00.000Z','assessment',[one.result.resultId]);
    await call(page,'createLearningSession',[a]);await answerAll(page,a);const before=await snapshot(page);
    await page.evaluate(store=>{const add=IDBObjectStore.prototype.add,put=IDBObjectStore.prototype.put;const fail=function(this:IDBObjectStore,value:any,key?:IDBValidKey){
      const native=this.name==='sessionResults'?add:put,request=native.call(this,value,key);
      if(this.name===store){IDBObjectStore.prototype.add=add;IDBObjectStore.prototype.put=put;request.addEventListener('success',()=>this.transaction.abort());}return request;};
      IDBObjectStore.prototype.add=fail;IDBObjectStore.prototype.put=fail;
    },failedStore);
    expect((await invoke(page,'finalizeLearningSession',[a.sessionId,owner,plus(a.startedAt,10)])).ok).toBe(false);expect(await snapshot(page)).toEqual(before);
    const retry=await call<LessonCompletionCommit>(page,'finalizeLearningSession',[a.sessionId,owner,plus(a.startedAt,11)]);expect(retry.result.starTier).toBe(2);expect(retry.newStars).toBe(1);
  });
}

test('BA10: two simultaneous completions return one immutable result and one reward increase',async({page,context})=>{
  const fixture=await setup(page,'ba10-double'),p=active(fixture,'practice','2026-10-12T10:00:00.000Z');await call(page,'createLearningSession',[p]);await read(page,p);await answerAll(page,p);
  const other=await context.newPage();try{await harness(other);const receipts=await Promise.all([call<LessonCompletionCommit>(page,'finalizeLearningSession',[p.sessionId,owner,plus(p.startedAt,10)]),call<LessonCompletionCommit>(other,'finalizeLearningSession',[p.sessionId,owner,plus(p.startedAt,11)])]);
    expect(receipts.reduce((sum,row)=>sum+row.newStars,0)).toBe(1);expect(receipts.filter(row=>row.duplicate)).toHaveLength(1);
    expect((await snapshot(page)).sessionResults).toHaveLength(1);
  }finally{await other.close();}
});

test('BA10: checkpointed startup pauses only an orphaned lesson and keeps a live browser lock intact',async({page,context})=>{
  const fixture=await setup(page,'ba10-orphan'),p=active(fixture,'practice','2026-10-12T10:00:00.000Z');await call(page,'createLearningSession',[p]);await read(page,p);
  const receipt=await call<LessonAttemptCommit>(page,'submitLessonAttempt',[p.sessionId,owner,{attemptKey:'q0',itemRef:p.checkpoint.itemOrder[0],response:{version:1,kind:'choice',selectedIndex:0},hintsUsed:0,elapsedMs:2000},plus(p.startedAt,2)]);
  await page.evaluate(async id=>{(window as any).__releaseLesson=await (window as any).__learningStorage.acquireSessionOwnership(id);},p.sessionId);
  const other=await context.newPage();try{
    await harness(other);
    await other.evaluate(async()=>{const core=(window as any).__learningStorage;await core.recoverOrphanedLessons(await core.storage.listLearningSessions(),(id:string,owner:string)=>core.storage.pauseLearningSession(id,owner));});
    expect((await call<LearningSession>(page,'getLearningSession',[p.sessionId])).status).toBe('active');
    await page.reload();await page.waitForFunction(()=>!!(window as any).__learningStorage);
    await other.evaluate(async()=>{const core=(window as any).__learningStorage;await core.recoverOrphanedLessons(await core.storage.listLearningSessions(),(id:string,owner:string)=>core.storage.pauseLearningSession(id,owner));});
    const paused=await call<LearningSession>(other,'getLearningSession',[p.sessionId]);
    expect(paused.status).toBe('paused');expect(paused.checkpoint.receipts).toEqual(receipt.session.checkpoint.receipts);
    expect(paused.checkpoint.itemOrder).toEqual(p.checkpoint.itemOrder);
  }finally{await other.close();}
});

test('BA10: a quota error late in independent review scheduling rolls back result/progress/session and keeps the retry key',async({page})=>{
  const fixture=await setup(page,'ba10-quota'),one=await practice(page,fixture),a=active(fixture,'assessment','2026-10-12T10:01:00.000Z','assessment',[one.result.resultId]);
  await call(page,'createLearningSession',[a]);await answerAll(page,a);const before=await snapshot(page);
  await page.evaluate(()=>{const native=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(value,key){
    const request=native.call(this,value,key);if(this.name==='reviews'){IDBObjectStore.prototype.put=native;request.addEventListener('success',()=>{
      Object.defineProperty(request,'error',{value:new DOMException('QA finalizer quota','QuotaExceededError')});request.dispatchEvent(new Event('error'));this.transaction.abort();});}return request;};});
  expect((await invoke(page,'finalizeLearningSession',[a.sessionId,owner,plus(a.startedAt,10)])).ok).toBe(false);expect(await snapshot(page)).toEqual(before);
  const result=await call<LessonCompletionCommit>(page,'finalizeLearningSession',[a.sessionId,owner,plus(a.startedAt,11)]);expect(result.result.starTier).toBe(2);expect(result.newStars).toBe(1);
});
