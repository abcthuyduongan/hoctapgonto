import path from 'node:path';
import { expect,test,type Page } from '@playwright/test';
import type { LearningEvent,PlaySession,QuizPack } from '../../src/core/contracts';
import { createLearningStorageServer } from './helpers/learning-storage';
import { LIBRARY_CURRICULA,LIBRARY_PACKS } from '../../src/core/lesson-seed';
import { sampleGameJourney } from '../../src/core/game-journey';

test.use({serviceWorkers:'block'});
let server:Awaited<ReturnType<typeof createLearningStorageServer>>;
test.beforeAll(async()=>{server=await createLearningStorageServer(path.resolve('test-results',`game-reward-core-${process.pid}-${Date.now()}`));});
test.afterAll(async()=>{await server?.close();});
async function harness(page:Page){await page.goto(`${server.origin}/qa-storage`);await page.waitForFunction(()=>!!(window as any).__learningStorage);}
async function invoke(page:Page,method:string,args:unknown[]=[]){return page.evaluate(async({method,args})=>{try{return{ok:true,value:await(window as any).__learningStorage.storage[method](...args)};}catch(error){return{ok:false,message:error instanceof Error?error.message:String(error)};}},{method,args});}
async function call(page:Page,method:string,args:unknown[]=[]):Promise<any>{const result=await invoke(page,method,args);if(!result.ok)throw new Error(`${method}: ${result.message}`);return result.value;}
async function setup(page:Page){
  await harness(page);await call(page,'listProfiles');
  const pack:QuizPack={id:'game-storage-question-set',version:1,title:'Câu hỏi kiểm tra sao game',kind:'quiz',subject:'math',grade:3,source:'local',publishedAt:'2026-10-12T00:00:00.000Z',items:Array.from({length:5},(_,index)=>({kind:'multiple-choice',id:`game-storage-q${index+1}`,objectiveId:'MATH3.GAME',prompt:`${index+1} + 1 = ?`,options:[String(index+2),String(index+3),String(index+4),String(index+5)],correctIndex:0,explanation:'Cộng thêm một.'}))};
  await call(page,'savePack',[pack]);
  const session:PlaySession={sessionId:'game-storage-session',profileId:'default-learner',packId:pack.id,contentVersion:1,moduleId:'math-quest',moduleVersion:'1.0.0',startedAt:new Date(Date.now()-10_000).toISOString(),status:'active'};
  await call(page,'createSession',[session]);return{pack,session};
}
function eventFor(session:PlaySession,pack:QuizPack,index:number,choiceIndex=0,key=`answer-${index}`):LearningEvent{
  const item=pack.items[index];return{eventId:`${session.sessionId}:${key}`,sessionId:session.sessionId,profileId:session.profileId,packId:pack.id,contentVersion:pack.version,moduleId:session.moduleId,moduleVersion:session.moduleVersion,itemId:item.id,objectiveId:item.objectiveId,correct:choiceIndex===0,hintsUsed:0,elapsedMs:1000,occurredAt:session.startedAt,response:{kind:'choice',choiceIndex},gameSequence:999};
}
async function snapshot(page:Page){return{sessions:await call(page,'listSessions'),events:await call(page,'listEvents'),profiles:await call(page,'listProfiles'),summary:await call(page,'getRewardSummary',['default-learner'])};}

test('game rewards storage: competing tabs receive contiguous host sequence, stable retries and only one highest pack award',async({page,context})=>{
  const{pack,session}=await setup(page),other=await context.newPage();await harness(other);
  const first=eventFor(session,pack,0),second=eventFor(session,pack,1);
  const receipts=await Promise.all([call(page,'addEvent',[first]),call(other,'addEvent',[second])]);
  expect(receipts.map(row=>row.event.gameSequence).sort()).toEqual([1,2]);
  expect(receipts.every(row=>row.event.occurredAt>session.startedAt)).toBe(true);
  const replay=await call(other,'addEvent',[{...first,elapsedMs:99999,occurredAt:'2026-10-12T00:00:00.000Z',gameSequence:123}]);expect(replay.duplicate).toBe(true);expect(replay.event).toEqual(receipts[0].event);
  const changed=await invoke(other,'addEvent',[{...first,response:{kind:'choice',choiceIndex:1},correct:false}]);expect(changed.ok).toBe(false);
  for(let index=2;index<5;index++)await call(page,'addEvent',[eventFor(session,pack,index)]);
  await Promise.all([call(page,'endSession',[session.sessionId,'completed']),call(other,'endSession',[session.sessionId,'completed'])]);
  const before=await snapshot(page);expect(before.events).toHaveLength(5);expect(before.summary).toMatchObject({earned:3,gameEarned:3,learningEarned:0,available:3});expect(before.sessions[0].rewardPolicyVersion).toBe(1);
  await call(other,'endSession',[session.sessionId,'completed']);expect(await snapshot(page)).toEqual(before);
  const next={...session,sessionId:'game-storage-replay',startedAt:new Date().toISOString()};await call(other,'createSession',[next]);for(let index=0;index<5;index++)await call(other,'addEvent',[eventFor(next,pack,index)]);await call(other,'endSession',[next.sessionId,'completed']);
  expect((await call(page,'getRewardSummary',['default-learner'])).earned).toBe(3);await other.close();
});

test('game rewards storage: forged results and premature completion leave no awards; correction retains original first-attempt score',async({page})=>{
  const{pack,session}=await setup(page),wrong=eventFor(session,pack,0,1),before=await snapshot(page);
  expect((await invoke(page,'addEvent',[{...wrong,correct:true}])).ok).toBe(false);expect(await snapshot(page)).toEqual(before);
  await call(page,'addEvent',[wrong]);const partial=await snapshot(page);expect((await invoke(page,'endSession',[session.sessionId,'completed'])).ok).toBe(false);expect(await snapshot(page)).toEqual(partial);
  await call(page,'addEvent',[eventFor(session,pack,0,0,'correct-later')]);for(let index=1;index<5;index++)await call(page,'addEvent',[eventFor(session,pack,index)]);
  await call(page,'endSession',[session.sessionId,'completed']);const saved=await snapshot(page);expect(saved.summary.gameRewards[0]).toMatchObject({starTier:2,firstTryCorrect:4,totalItems:5});
  expect((await invoke(page,'addEvent',[eventFor(session,pack,0,0,'after-complete')])).ok).toBe(false);expect(await snapshot(page)).toEqual(saved);
});

test('game rewards storage: aborted answer transaction retries exactly once; legacy boolean-only completion earns nothing',async({page})=>{
  const{pack,session}=await setup(page),event=eventFor(session,pack,0),before=await snapshot(page);
  await page.evaluate(()=>{const original=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(value:any,...args:any[]){if(this.name==='reviews'){IDBObjectStore.prototype.put=original;throw new DOMException('Game reward quota','QuotaExceededError');}return original.call(this,value,...args);};});
  expect((await invoke(page,'addEvent',[event])).ok).toBe(false);expect(await snapshot(page)).toEqual(before);
  const receipt=await call(page,'addEvent',[event]);expect(receipt.event.gameSequence).toBe(1);expect((await call(page,'addEvent',[event])).duplicate).toBe(true);
  const noResponse={...eventFor(session,pack,1)};delete noResponse.response;expect((await invoke(page,'addEvent',[noResponse])).ok).toBe(false);await call(page,'endSession',[session.sessionId,'abandoned']);expect((await call(page,'getRewardSummary',['default-learner'])).earned).toBe(0);
  const legacy={...session,sessionId:'legacy-boolean-session'};await call(page,'createSession',[legacy]);for(let index=0;index<5;index++){const row=eventFor(legacy,pack,index);delete row.response;await call(page,'addEvent',[row]);}await call(page,'endSession',[legacy.sessionId,'completed']);expect((await call(page,'getRewardSummary',['default-learner'])).earned).toBe(0);
});

test('game rewards storage: game-funded requests serialize across tabs, preserve held stars during replay and release on cancellation',async({page,context})=>{
  const{pack,session}=await setup(page);for(let index=0;index<5;index++)await call(page,'addEvent',[eventFor(session,pack,index)]);await call(page,'endSession',[session.sessionId,'completed']);await call(page,'configureRewardWallet',['default-learner',true,1000]);
  const other=await context.newPage();await harness(other);const outcomes=await Promise.all([invoke(page,'requestReward',['default-learner',{requestId:'request-a',title:'Bút màu',goalVnd:2000}]),invoke(other,'requestReward',['default-learner',{requestId:'request-b',title:'Sổ tay',goalVnd:2000}])]);expect(outcomes.filter(row=>row.ok)).toHaveLength(1);expect(outcomes.filter(row=>!row.ok)[0].message).toContain('chưa đủ');
  const accepted=outcomes.find(row=>row.ok)!.value;expect(await call(other,'requestReward',['default-learner',{requestId:accepted.requestId,title:accepted.title,goalVnd:accepted.goalVnd}])).toEqual(accepted);
  expect(await call(page,'getRewardSummary',['default-learner'])).toMatchObject({earned:3,available:1,pending:2,redeemed:0});await call(other,'updateRewardRequest',['default-learner',accepted.requestId,'cancelled']);expect(await call(page,'getRewardSummary',['default-learner'])).toMatchObject({earned:3,available:3,pending:0});
  await call(page,'requestReward',['default-learner',{requestId:'three-stars',title:'Vở mới',goalVnd:3000}]);await call(page,'updateRewardRequest',['default-learner','three-stars','approved']);await call(other,'updateRewardRequest',['default-learner','three-stars','fulfilled']);expect(await call(page,'getRewardSummary',['default-learner'])).toMatchObject({earned:3,available:0,pending:0,redeemed:3});await other.close();
});

test('game assignments storage: parent pins are atomic, independent packs blocked, and stale forms cannot erase another game or the wallet',async({page,context})=>{
  const{pack}=await setup(page),stale=(await call(page,'listProfiles'))[0],other=await context.newPage();await harness(other);
  await call(page,'configureRewardWallet',['default-learner',true,2000]);
  await Promise.all([call(page,'configureGameAssignment',['default-learner','math-quest',{packId:pack.id,contentVersion:pack.version}]),call(other,'configureGameAssignment',['default-learner','memory-match',{packId:'english3-family',contentVersion:1}])]);
  let current=(await call(page,'listProfiles'))[0];expect(current.learningSettings.gameAssignments).toEqual({'math-quest':{packId:pack.id,contentVersion:1},'memory-match':{packId:'english3-family',contentVersion:1}});expect(current.learningSettings.rewardWallet).toMatchObject({enabled:true,rateVnd:2000});
  await call(other,'saveProfile',[{...stale,name:'Bảo An sau đổi tên'}]);await call(page,'configureLearner',['default-learner',{textbook:'Ghi chú phụ huynh'}]);current=(await call(page,'listProfiles'))[0];expect(current.learningSettings.gameAssignments).toHaveProperty('math-quest');expect(current.learningSettings.gameAssignments).toHaveProperty('memory-match');expect(current.learningSettings.rewardWallet.rateVnd).toBe(2000);
  const reserved=LIBRARY_CURRICULA.flatMap(row=>row.lessons).flatMap(row=>row.forms).find(row=>row.role==='assessment'&&row.itemRefs.every(ref=>LIBRARY_PACKS.find(pack=>pack.id===ref.packId&&pack.version===ref.contentVersion)?.kind==='quiz'))!.itemRefs[0];
  const protectedPack=LIBRARY_PACKS.find(row=>row.id===reserved.packId&&row.version===reserved.contentVersion)!;await call(page,'savePack',[protectedPack]);const before=await snapshot(page);
  for(const args of [['default-learner','math-quest',{packId:'missing-pack',contentVersion:1}],['default-learner','math-quest',{packId:'english3-family',contentVersion:1}],['default-learner','math-quest',{packId:reserved.packId,contentVersion:reserved.contentVersion}],['default-learner','unknown-game',{packId:pack.id,contentVersion:1}]])expect((await invoke(page,'configureGameAssignment',args)).ok).toBe(false);
  expect(await snapshot(page)).toEqual(before);
  await call(page,'configureGameAssignment',['default-learner','math-quest']);await call(other,'saveProfile',[current]);current=(await call(page,'listProfiles'))[0];expect(current.learningSettings.gameAssignments).not.toHaveProperty('math-quest');expect(current.learningSettings.gameAssignments).toHaveProperty('memory-match');expect(current.learningSettings.rewardWallet.rateVnd).toBe(2000);await other.close();
});

test('weekly journey storage: saves atomically, protects pinned assessments and survives stale forms and concurrent wallet changes',async({page,context})=>{
  await setup(page);const stale=(await call(page,'listProfiles'))[0],journey=sampleGameJourney();
  await call(page,'configureGameJourney',['default-learner',journey]);const other=await context.newPage();await harness(other);
  await Promise.all([call(page,'configureRewardWallet',['default-learner',true,1000]),call(other,'saveProfile',[{...stale,name:'Bảo An'}])]);
  let profile=(await call(page,'listProfiles'))[0];expect(profile.learningSettings.gameJourney).toEqual(journey);expect(profile.learningSettings.rewardWallet.enabled).toBe(true);
  const before=await snapshot(page),changed=structuredClone(journey);changed.stages[0].title='Tiêu đề chưa lưu';
  await page.evaluate(()=>{const original=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(value:any,...args:any[]){if(this.name==='profiles'){IDBObjectStore.prototype.put=original;throw new DOMException('Journey quota','QuotaExceededError');}return original.call(this,value,...args);};});
  expect((await invoke(page,'configureGameJourney',['default-learner',changed])).ok).toBe(false);expect(await snapshot(page)).toEqual(before);
  await call(other,'configureGameJourney',['default-learner',changed]);await call(page,'saveProfile',[profile]);
  profile=(await call(page,'listProfiles'))[0];expect(profile.learningSettings.gameJourney.stages[0].title).toBe('Tiêu đề chưa lưu');
  const locked={...changed,selectedPack:changed.stages[2].packs.math};expect((await invoke(other,'configureGameJourney',['default-learner',locked])).ok).toBe(false);
  const reserved=LIBRARY_CURRICULA.flatMap(c=>c.lessons).flatMap(l=>l.forms).find(f=>f.role==='assessment'&&f.itemRefs.every(ref=>LIBRARY_PACKS.find(p=>p.id===ref.packId)?.kind==='quiz'))!.itemRefs[0];
  const protectedPack=LIBRARY_PACKS.find(p=>p.id===reserved.packId&&p.version===reserved.contentVersion)!;await call(page,'savePack',[protectedPack]);
  const invalid=structuredClone(changed);invalid.stages[0].packs.math={packId:protectedPack.id,contentVersion:protectedPack.version};
  const snapshotBefore=await snapshot(page);expect((await invoke(page,'configureGameJourney',['default-learner',invalid])).ok).toBe(false);expect(await snapshot(page)).toEqual(snapshotBefore);
  await other.close();
});

test('weekly journey storage: creation rechecks current progress inside the transaction; alternate answers keep the source identity',async({page})=>{
  const {session:old}=await setup(page);await call(page,'endSession',[old.sessionId,'abandoned']);
  const journey=sampleGameJourney();await call(page,'configureGameJourney',['default-learner',journey]);
  const session:PlaySession={sessionId:'weekly-alternate',profileId:'default-learner',packId:journey.stages[0].packs.math.packId,contentVersion:1,moduleId:'math-quest',moduleVersion:'1.0.0',presentationVersion:1,startedAt:new Date().toISOString(),status:'active'};
  for(const ref of [journey.stages[0].packs.english,journey.stages[1].packs.math,journey.stages[2].packs.math])expect((await invoke(page,'createSession',[{...session,sessionId:`blocked-${ref.packId}`,packId:ref.packId}])).ok).toBe(false);
  await call(page,'createSession',[session]);
  const {BUILTIN_PACKS}=await import('../../src/core/seed');const pack=BUILTIN_PACKS.find(p=>p.id===session.packId)!;
  for(const [index,item]of pack.items.entries())await call(page,'addEvent',[{eventId:`${session.sessionId}:answer-${index}`,sessionId:session.sessionId,profileId:session.profileId,packId:pack.id,contentVersion:1,moduleId:session.moduleId,moduleVersion:session.moduleVersion,itemId:item.id,objectiveId:item.objectiveId,correct:true,hintsUsed:0,elapsedMs:100,occurredAt:session.startedAt,response:{kind:'choice',choiceIndex:index%4}}]);
  await call(page,'endSession',[session.sessionId,'completed']);expect(await call(page,'getRewardSummary',['default-learner'])).toMatchObject({earned:3,gameEarned:3});
  expect((await invoke(page,'createSession',[{...session,sessionId:'stale-same-pack'}])).ok).toBe(false);
  await call(page,'createSession',[{...session,sessionId:'next-subject',packId:journey.stages[0].packs.vietnamese.packId}]);
  const events=await call(page,'listEvents');expect(events.every((row:any)=>row.packId===pack.id)).toBe(true);
});
