import test from 'node:test';
import assert from 'node:assert/strict';
import { learningStorageFixture,assessmentEvidence,reviewEvidence } from './visual/helpers/learning-storage-fixture.ts';
import { changeRewardRequest,earnedRewardStars,makeRewardRequest,rewardBalance,rewardStatus,validateRewardWallet } from '../src/core/reward-wallet.ts';
import { rebuildLessonProgress,validateLearnerSettings } from '../src/core/curriculum.ts';
import { parseLearningBackup,prepareBackupRestore,serializeLearningBackup } from '../src/core/backup-io.ts';
import { bestGameRewards,earnedGameStars,gameRewardAwards,gameSessionEvidenceErrors,scoreGameResponse } from '../src/core/game-rewards.ts';
import { makeLearningEvent,sameAttempt } from '../src/core/sdk.ts';
import { findGameAssignment,gameAssignmentChoices,validateGameAssignments } from '../src/core/game-assignments.ts';
const at='2026-10-14T10:00:00.000Z',later='2026-10-14T10:01:00.000Z';
const wallet=()=>({schemaVersion:1,enabled:true,rateVnd:1000,updatedAt:at,requests:[]});
const input=(id='wish')=>({requestId:id,title:'Bộ bút màu',goalVnd:1500});
const fixture=()=>{const f=learningStorageFixture('wallet'),a=assessmentEvidence(f),r=reviewEvidence(f,a);return{f,results:[f.result,a.result,r.result],sessions:[f.session,a.session,r.session],events:[...f.events,...a.events,...r.events]};};
test('wallet: reserve rounded whole stars, keep achievement, lock the rate and release only cancellation',()=>{
  const w=wallet(),request=makeRewardRequest(w,3,input(),at);assert.equal(request.stars,2);assert.equal(request.amountVnd,2000);w.requests.push(request);
  assert.deepEqual(rewardBalance(3,w),{earned:3,available:1,pending:2,redeemed:0});w.rateVnd=5000;
  assert.equal(w.requests[0].rateVnd,1000);assert.equal(w.requests[0].amountVnd,2000);
  assert.throws(()=>makeRewardRequest(w,3,{...input('expensive'),goalVnd:10000},later),/chưa đủ/);
  w.requests[0]=changeRewardRequest(request,'cancelled',later);assert.equal(rewardBalance(3,w).available,3);assert.equal(rewardBalance(3,w).earned,3);
});
test('wallet: pending→approved→fulfilled holds stars permanently; retries cannot duplicate or rewrite a decision',()=>{
  const w=wallet(),request=makeRewardRequest(w,3,input(),at);assert.equal(makeRewardRequest({...w,requests:[request]},0,input(),later),request);
  assert.throws(()=>makeRewardRequest({...w,requests:[request]},3,{...input(),goalVnd:1000},later),/đã được dùng/);
  const approved=changeRewardRequest(request,'approved',later,'Gia đình đồng ý'),fulfilled=changeRewardRequest(approved,'fulfilled','2026-10-14T10:02:00.000Z','Đã trao bộ bút');
  assert.equal(changeRewardRequest(fulfilled,'fulfilled',at),fulfilled);assert.equal(rewardStatus(fulfilled),'fulfilled');assert.throws(()=>changeRewardRequest(approved,'cancelled',later),/đổi trạng thái/);
  assert.deepEqual(rewardBalance(3,{...w,requests:[fulfilled]}),{earned:3,available:1,pending:0,redeemed:2});
});
test('wallet: disabled, malformed integers, limits and backward clocks are rejected',()=>{
  assert.throws(()=>makeRewardRequest({...wallet(),enabled:false},3,input(),at),/chưa bật/);
  for(const value of [0,-1,1.5,NaN,Infinity,100000001])assert.throws(()=>makeRewardRequest(wallet(),3,{...input(),goalVnd:value},at));
  const request=makeRewardRequest(wallet(),3,input(),at);assert.throws(()=>changeRewardRequest(request,'approved','2026-10-13T10:00:00.000Z'),/đang lùi/);
  assert.ok(validateRewardWallet({...wallet(),requests:Array.from({length:501},(_,i)=>({...request,requestId:`id-${i}`}))}).length);
  assert.ok(validateRewardWallet({...wallet(),unexpected:true}).length);let called=false;const hostile=wallet();Object.defineProperty(hostile,'requests',{get(){called=true;throw new Error('accessor');}});assert.ok(validateRewardWallet(hostile).length);assert.equal(called,false);
});
test('wallet: strict schema checks status transitions, amount tampering, duplicate IDs and future history',()=>{
  const w=wallet(),request=makeRewardRequest(w,3,input(),at);
  for(const bad of [{...request,amountVnd:1999},{...request,stars:1},{...request,history:[{status:'fulfilled',at}]},{...request,history:[...request.history,{status:'approved',at:later}]},{...request,history:[...request.history,{status:'cancelled',at},{status:'approved',at}]}])assert.ok(validateRewardWallet({...w,requests:[bad]}).length);
  assert.ok(validateRewardWallet({...w,requests:[request,request]}).length);const f=learningStorageFixture('wallet-settings');assert.deepEqual(validateLearnerSettings({...f.profile.learningSettings,rewardWallet:w},[f.curriculum]),[]);
});
test('wallet: evidence uses immutable highest stars across revisions, never a forged progress cache or later result',()=>{
  const {f,results}=fixture();assert.equal(earnedRewardStars(f.profile.profileId,results,[f.curriculum]),3);
  assert.equal(earnedRewardStars(f.profile.profileId,[...results,{...results.at(-1),resultId:'new-revision',scope:{...results.at(-1).scope,curriculumRevision:2}}],[f.curriculum]),3);
  const w=wallet(),request=makeRewardRequest(w,3,input(),at),evidence={profileId:f.profile.profileId,results,curricula:[f.curriculum],notAfter:at};
  assert.deepEqual(validateRewardWallet({...w,requests:[request]},evidence),[]);
  assert.ok(validateRewardWallet({...w,requests:[request]},{...evidence,results:[f.result]}).length);
  const early={...request,requestedAt:'2026-10-12T10:02:00.000Z',history:[{status:'pending',at:'2026-10-12T10:02:00.000Z'}]};assert.ok(validateRewardWallet({...w,requests:[early]},evidence).length);
  assert.ok(validateRewardWallet({...w,requests:[request]},{...evidence,profileId:'other-child'}).length);
});
test('wallet: concurrent-looking holds cannot overspend; rejected request releases only at its actual decision time',()=>{
  const {f,results}=fixture(),w=wallet(),first=makeRewardRequest(w,3,input('first'),at),second=makeRewardRequest(w,3,input('second'),at),evidence={profileId:f.profile.profileId,results,curricula:[f.curriculum]};
  assert.ok(validateRewardWallet({...w,requests:[first,second]},evidence).length);
  const rejected=changeRewardRequest(first,'rejected',later);assert.ok(validateRewardWallet({...w,updatedAt:later,requests:[rejected,second]},evidence).length);
  const next=makeRewardRequest({...w,requests:[rejected]},3,input('second'),'2026-10-14T10:02:00.000Z');assert.deepEqual(validateRewardWallet({...w,updatedAt:next.requestedAt,requests:[rejected,next]},evidence),[]);
});
test('wallet: backup round-trip retains fulfillment, duplicate restore adds nothing, missing reward evidence fails atomically',()=>{
  const {f,results,sessions,events}=fixture(),w=wallet(),request=makeRewardRequest(w,3,input(),at);
  w.requests=[changeRewardRequest(changeRewardRequest(request,'approved',at),'fulfilled',at,'Đã trao')];f.profile.learningSettings.rewardWallet=w;f.profile.updatedAt=at;
  const data={packs:[f.pack],curricula:[f.curriculum],profiles:[f.profile],sessions,events,sessionResults:results,lessonProgress:rebuildLessonProgress(results,[f.curriculum]),reviews:[]};
  const parsed=parseLearningBackup(serializeLearningBackup(data,later));assert.deepEqual(parsed.profiles[0].learningSettings.rewardWallet,w);
  const plan=prepareBackupRestore(parsed,data);assert.equal(plan.canRestore,true);assert.equal(plan.additions.profiles.length,0);assert.equal(plan.additions.sessionResults.length,0);
  const missing={...data,sessionResults:[f.result],sessions:[f.session],events:f.events,lessonProgress:rebuildLessonProgress([f.result],[f.curriculum])};assert.throws(()=>serializeLearningBackup(missing,later),/nhiều sao hơn/);
  const forged=structuredClone(parsed);forged.profiles[0].learningSettings.rewardWallet.requests[0].amountVnd=999999;assert.throws(()=>parseLearningBackup(JSON.stringify(forged)),/không khớp/);
});

const gameAt='2026-10-14T09:00:00.000Z',gameEnd='2026-10-14T09:01:00.000Z';
function gameFixture({id='game-question-set',sessionId='game-session',moduleId='math-quest',version=1,correct=5,hint=-1,completedAt=gameEnd}={}){
  const kind=moduleId==='math-quest'?'quiz':['memory-match','word-connect'].includes(moduleId)?'pairs':'sentences';
  const pack={id,version,title:'Bộ câu hỏi game',subject:'math',grade:3,source:'local',publishedAt:'2026-10-12T00:00:00.000Z',kind,items:Array.from({length:5},(_,index)=>({id:`game-q${index+1}`,objectiveId:'MATH3.GAME',...(kind==='quiz'?{kind:'multiple-choice',prompt:`${index+1} + 1 = ?`,options:[String(index+2),String(index+3),String(index+4),String(index+5)],correctIndex:0,explanation:'Cộng thêm một.'}:kind==='pairs'?{kind:'pair',left:`${index+1} + 1`,right:String(index+2)}:{kind:'sentence',prompt:`Xếp dãy ${index+1}`,words:[String(index+1),String(index+2),String(index+3)],hint:'Theo thứ tự tăng dần.'})}))};
  const session={sessionId,profileId:'game-child',packId:id,contentVersion:version,moduleId,moduleVersion:'1.0.0',startedAt:gameAt,status:'completed',endedAt:completedAt,rewardPolicyVersion:1};
  const response=(item,valid=true)=>kind==='quiz'?{kind:'choice',choiceIndex:valid?0:1}:kind==='pairs'?{kind:'pair',first:{itemId:item.id,side:'left'},second:{itemId:valid?item.id:pack.items[(pack.items.indexOf(item)+1)%5].id,side:'right'}}:{kind:'order',indices:valid?[0,1,2]:[2,1,0]};
  const events=[];
  function submit(item,valid,hintsUsed=0){const raw=response(item,valid);events.push({...makeLearningEvent({...session,status:'active'},pack,{attemptKey:`answer-${events.length+1}`,itemId:item.id,objectiveId:item.objectiveId,correct:valid,hintsUsed,elapsedMs:1000,response:raw},'2026-10-14T09:00:30.000Z'),gameSequence:events.length+1});}
  pack.items.forEach((item,index)=>{submit(item,index<correct,index===hint?1:0);if(kind!=='quiz'&&index>=correct)submit(item,true);});
  return {pack,session,events,evidence:{packs:[pack],sessions:[session],events}};
}

test('game stars: complete every question, exact 80% earns two, perfect earns three, lower result earns one',()=>{
  for(const [correct,tier]of [[0,1],[3,1],[4,2],[5,3]]){const f=gameFixture({correct});assert.deepEqual(gameSessionEvidenceErrors(f.session,f.events,f.pack,true),[]);assert.equal(earnedGameStars(f.evidence,'game-child'),tier);assert.equal(bestGameRewards(f.evidence,'game-child')[0].firstTryCorrect,correct);}
  const incomplete=gameFixture();incomplete.evidence.events=incomplete.events.slice(0,4);assert.equal(earnedGameStars(incomplete.evidence,'game-child'),0);assert.match(gameSessionEvidenceErrors(incomplete.session,incomplete.evidence.events,incomplete.pack,true)[0],/tất cả/);
  assert.equal(earnedGameStars(gameFixture().evidence,'other-child'),0);
});

test('game stars: sentence retries and hints never improve the first submission within a session',()=>{
  for(const moduleId of ['sentence-builder','sequence-trail']){const f=gameFixture({moduleId,correct:4});assert.equal(f.events.length,6);assert.equal(bestGameRewards(f.evidence,'game-child')[0].starTier,2);assert.equal(bestGameRewards(f.evidence,'game-child')[0].firstTryCorrect,4);}
  const hinted=gameFixture({hint:0});assert.equal(earnedGameStars(hinted.evidence,'game-child'),2);
  const duplicate=gameFixture({correct:4});const first=duplicate.pack.items[4];duplicate.evidence.events.push({...duplicate.events[4],eventId:'game-session:correct-again',response:{kind:'choice',choiceIndex:0},correct:true,gameSequence:6,itemId:first.id});assert.equal(earnedGameStars(duplicate.evidence,'game-child'),2);
});

test('game stars: wrong pair choices count for both touched pairs; all pairs must eventually be solved',()=>{
  for(const moduleId of ['memory-match','word-connect']){const f=gameFixture({moduleId});assert.equal(earnedGameStars(f.evidence,'game-child'),3);
    const wrong={...f.events[0],eventId:'game-session:wrong-first',correct:false,response:{kind:'pair',first:{itemId:f.pack.items[0].id,side:'left'},second:{itemId:f.pack.items[1].id,side:'right'}}};
    if(moduleId==='memory-match'){wrong.itemId=f.pack.items[1].id;wrong.objectiveId=f.pack.items[1].objectiveId;}
    f.evidence.events=[wrong,...f.events].map((event,index)=>({...event,gameSequence:index+1}));
    assert.equal(earnedGameStars(f.evidence,'game-child'),1);assert.equal(bestGameRewards(f.evidence,'game-child')[0].firstTryCorrect,3);
    f.evidence.events=f.evidence.events.slice(0,-1);assert.equal(earnedGameStars(f.evidence,'game-child'),0);
  }
});

test('game stars: only highest tier per profile and pack ID across replay, version and compatible game survives',()=>{
  const a=gameFixture({moduleId:'sentence-builder',correct:3}),b=gameFixture({moduleId:'sequence-trail',sessionId:'game-session-v2',version:2,correct:5,completedAt:'2026-10-14T09:03:00.000Z'}),c=gameFixture({moduleId:'sentence-builder',sessionId:'game-session-repeat',correct:3,completedAt:'2026-10-14T09:04:00.000Z'});
  const e={packs:[a.pack,b.pack],sessions:[a.session,b.session,c.session],events:[...a.events,...b.events,...c.events]};
  assert.equal(gameRewardAwards(e,'game-child').length,3);assert.equal(earnedGameStars(e,'game-child'),3);assert.equal(earnedGameStars(e,'game-child','2026-10-14T09:02:00.000Z'),1);assert.equal(bestGameRewards(e,'game-child')[0].sessionId,b.session.sessionId);
  const another=gameFixture({id:'another-question-set',sessionId:'another-game'});e.packs.push(another.pack);e.sessions.push(another.session);e.events.push(...another.events);assert.equal(earnedGameStars(e,'game-child'),6);
});

test('game stars: early completion, abandonment, legacy flags and boolean-only attempts cannot mint stars',()=>{
  for(const mutate of [f=>delete f.session.rewardPolicyVersion,f=>f.session.rewardPolicyVersion=2,f=>f.session.status='abandoned',f=>f.session.status='active',f=>f.events.forEach(event=>delete event.response),f=>f.events.splice(0)]){const f=gameFixture();mutate(f);assert.equal(earnedGameStars(f.evidence,'game-child'),0);}
  const missing=gameFixture();missing.evidence.packs=[];assert.equal(earnedGameStars(missing.evidence,'game-child'),0);
});

test('game stars: host rechecks raw answer, item identity, sequence and clocks instead of trusting outcome claims',()=>{
  const mutations=[f=>f.events[0].response.choiceIndex=1,f=>f.events[0].correct=false,f=>f.events[0].objectiveId='FORGED',f=>f.events[0].profileId='another-child',f=>f.events[0].gameSequence=2,f=>f.events[0].eventId='wrong-session:key',f=>f.events[0].occurredAt='2026-10-14T09:02:00.000Z',f=>f.events[0].occurredAt='2026-10-14T08:59:00.000Z',f=>f.events[0].hintsUsed=-1,f=>f.events[0].elapsedMs=Infinity,f=>f.session.endedAt='bad-clock',f=>f.pack.items[0].correctIndex=1];
  for(const mutate of mutations){const f=gameFixture();mutate(f);assert.equal(earnedGameStars(f.evidence,'game-child'),0);}
  const f=gameFixture();assert.throws(()=>makeLearningEvent({...f.session,status:'active'},f.pack,{attemptKey:'lie',itemId:f.pack.items[0].id,objectiveId:'MATH3.GAME',correct:true,hintsUsed:0,elapsedMs:100,response:{kind:'choice',choiceIndex:1}},gameAt),/khớp/);
  assert.equal(sameAttempt(f.events[0],{...f.events[0],response:{kind:'choice',choiceIndex:1}}),false);
  assert.throws(()=>scoreGameResponse(f.pack,'math-quest',f.pack.items[0].id,{kind:'choice',choiceIndex:7}),/không hợp lệ/);
  const sentence=gameFixture({moduleId:'sentence-builder'});for(const indices of [[0,0,1],[0,1],[-1,0,1],[0,1,9]])assert.throws(()=>scoreGameResponse(sentence.pack,'sentence-builder',sentence.pack.items[0].id,{kind:'order',indices}));
});

test('game stars wallet: game awards join lesson awards once and can only fund requests after actual completion',()=>{
  const g=gameFixture(),{f,results}=fixture(),w=wallet(),profileId='game-child';const lessonResults=results.map(result=>({...result,profileId,scope:{...result.scope,profileId}}));
  assert.equal(earnedRewardStars(profileId,lessonResults,[f.curriculum],undefined,g.evidence),6);
  assert.equal(earnedRewardStars(profileId,[],[],gameAt,g.evidence),0);
  const request=makeRewardRequest(w,3,{requestId:'game-gift',title:'Sách mới',goalVnd:3000},at),evidence={profileId,results:[],curricula:[],...g.evidence};
  assert.deepEqual(validateRewardWallet({...w,requests:[request]},evidence),[]);
  const early={...request,requestedAt:gameAt,history:[{status:'pending',at:gameAt}]};assert.ok(validateRewardWallet({...w,requests:[early]},evidence).some(error=>error.includes('nhiều sao hơn')));
  assert.ok(validateRewardWallet({...w,requests:[request,{...request,requestId:'second-game-gift'}]},evidence).length);
  const noProof={...g.evidence,events:g.events.slice(1)};assert.ok(validateRewardWallet({...w,requests:[request]},{...evidence,...noProof}).length);
});

test('game stars backup: raw evidence and fulfilled reward survive restore once; tampering or missing proof rejects everything',()=>{
  const g=gameFixture(),w=wallet(),request=makeRewardRequest(w,3,{requestId:'game-gift',title:'Sách mới',goalVnd:3000},at);w.requests=[changeRewardRequest(changeRewardRequest(request,'approved',at),'fulfilled',at)];
  const profile={profileId:'game-child',name:'Bảo An',avatar:'fox',grade:3,colorTheme:'teal',createdAt:'2026-10-12T00:00:00.000Z',updatedAt:at,learningSettings:{schemaVersion:1,enrollments:[],preferredSubjects:['math'],rewardWallet:w}};
  const data={...g.evidence,profiles:[profile],reviews:[],curricula:[],sessionResults:[],lessonProgress:[]},raw=serializeLearningBackup(data,later),parsed=parseLearningBackup(raw);
  assert.equal(earnedGameStars(parsed,'game-child'),3);assert.equal(rewardBalance(3,parsed.profiles[0].learningSettings.rewardWallet).available,0);assert.equal(prepareBackupRestore(parsed,data).canRestore,true);assert.equal(prepareBackupRestore(parsed,data).additions.events.length,0);
  for(const mutate of [bad=>bad.events[0].response.choiceIndex=1,bad=>bad.events[0].gameSequence=3,bad=>bad.events.splice(0,1),bad=>delete bad.sessions[0].rewardPolicyVersion]){const bad=structuredClone(parsed);mutate(bad);assert.throws(()=>parseLearningBackup(JSON.stringify(bad)));}
  const noWallet=structuredClone(parsed);delete noWallet.profiles[0].learningSettings.rewardWallet;delete noWallet.sessions[0].rewardPolicyVersion;const old=parseLearningBackup(JSON.stringify(noWallet));assert.equal(earnedGameStars(old,'game-child'),0);
});

test('game assignments: optional per-game pins accept only known games and exact positive content versions',()=>{
  const f=learningStorageFixture('assignment-settings'),mapping={'math-quest':{packId:f.pack.id,contentVersion:1},'sequence-trail':{packId:'logic3-sequence',contentVersion:1}};
  assert.deepEqual(validateLearnerSettings(f.profile.learningSettings,[f.curriculum]),[]);
  assert.deepEqual(validateLearnerSettings({...f.profile.learningSettings,gameAssignments:mapping},[f.curriculum]),[]);
  assert.deepEqual(validateGameAssignments({}),[]);
  for(const bad of [null,[],{'unknown-game':{packId:'valid-pack',contentVersion:1}},{'math-quest':{packId:'BAD ID',contentVersion:1}},{'math-quest':{packId:'valid-pack',contentVersion:0}},{'math-quest':{packId:'valid-pack',contentVersion:1.5}},{'math-quest':{packId:'valid-pack',contentVersion:1,extra:true}},{'math-quest':{packId:'valid-pack'}}])assert.ok(validateGameAssignments(bad).length);
  let called=false;const hostile={};Object.defineProperty(hostile,'math-quest',{enumerable:true,get(){called=true;throw new Error('getter');}});assert.ok(validateGameAssignments(hostile).length);assert.equal(called,false);
});

test('game assignments: available choices pin the exact compatible version and protect every independent form',()=>{
  const quiz=gameFixture(),newer=gameFixture({version:2}),pairs=gameFixture({id:'game-pair-set',moduleId:'word-connect'}),sentences=gameFixture({id:'game-order-set',moduleId:'sequence-trail'}),assignment={packId:quiz.pack.id,contentVersion:1};
  const packs=[quiz.pack,newer.pack,pairs.pack,sentences.pack,quiz.pack];
  assert.deepEqual(gameAssignmentChoices('math-quest',packs,[]).map(pack=>pack.version),[1,2]);assert.equal(findGameAssignment('math-quest',assignment,packs),quiz.pack);
  assert.equal(findGameAssignment('memory-match',assignment,packs),undefined);assert.equal(findGameAssignment('math-quest',{...assignment,contentVersion:3},packs),undefined);
  const curricula=[{lessons:[{forms:[{role:'practice',itemRefs:[{packId:quiz.pack.id,contentVersion:1,itemId:quiz.pack.items[0].id}]},{role:'assessment',itemRefs:[{packId:quiz.pack.id,contentVersion:2,itemId:newer.pack.items[0].id}]}]}]}];
  assert.deepEqual(gameAssignmentChoices('math-quest',packs,curricula).map(pack=>pack.version),[1]);
  curricula[0].lessons[0].forms[0].role='review';assert.equal(findGameAssignment('math-quest',assignment,packs,curricula),undefined);
  assert.equal(gameAssignmentChoices('word-connect',packs,[])[0],pairs.pack);assert.equal(gameAssignmentChoices('sequence-trail',packs,[])[0],sentences.pack);
  assert.equal(gameAssignmentChoices('math-quest',[{...quiz.pack,source:'foreign'}],[]).length,0);
});

test('game assignments backup: pins and reset defaults round-trip without generating stars; unavailable pins remain recoverable',()=>{
  const g=gameFixture(),profile={profileId:'game-child',name:'Bảo An',avatar:'fox',grade:3,colorTheme:'teal',createdAt:'2026-10-12T00:00:00.000Z',updatedAt:at,learningSettings:{schemaVersion:1,enrollments:[],preferredSubjects:['math'],gameAssignments:{'math-quest':{packId:g.pack.id,contentVersion:1}}}};
  const data={packs:[g.pack],profiles:[profile],sessions:[],events:[],reviews:[],curricula:[],sessionResults:[],lessonProgress:[]};
  const parsed=parseLearningBackup(serializeLearningBackup(data,later));assert.deepEqual(parsed.profiles[0].learningSettings.gameAssignments,profile.learningSettings.gameAssignments);assert.equal(earnedGameStars(parsed,'game-child'),0);assert.equal(prepareBackupRestore(parsed,data).additions.profiles.length,0);
  parsed.profiles[0].learningSettings.gameAssignments['math-quest'].contentVersion=2;const unavailable=parseLearningBackup(JSON.stringify(parsed));assert.equal(findGameAssignment('math-quest',unavailable.profiles[0].learningSettings.gameAssignments['math-quest'],unavailable.packs),undefined);
  parsed.profiles[0].learningSettings.gameAssignments={};assert.deepEqual(parseLearningBackup(JSON.stringify(parsed)).profiles[0].learningSettings.gameAssignments,{});
  const malformed=structuredClone(parsed);malformed.profiles[0].learningSettings.gameAssignments={'math-quest':{packId:g.pack.id,contentVersion:-1}};assert.throws(()=>parseLearningBackup(JSON.stringify(malformed)),/Gán bộ câu hỏi/);
});
