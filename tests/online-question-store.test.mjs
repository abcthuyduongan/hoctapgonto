import {seedLegacyWeek} from './helpers/legacy-weeks.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {OnlineStore} from '../server/online-store.mjs';

const at='2026-10-17T00:00:00.000Z';
function fixture(t){
  const store=new OnlineStore(':memory:');t.after(()=>store.close());
  const workspaceId=randomUUID(),id=randomUUID();store.db.prepare('INSERT INTO workspaces(id,name,created_at) VALUES(?,?,?)').run(workspaceId,'Đơn vị sao từng câu',at);
  store.db.prepare('INSERT INTO users(id,workspace_id,username,password_hash,role,created_at) VALUES(?,?,?,?,?,?)').run(id,workspaceId,'manager','fixture-hash','admin',at);
  const admin={id,workspaceId,username:'manager',role:'admin'},cls=store.createClass(admin,{name:'Lớp sao từng câu',grade:3});
  function child(username='question-child',classroom=cls){const student=store.createStudent(admin,{name:username,classId:classroom.id,username},'fixture-child-hash',username),user=store.db.prepare('SELECT * FROM users WHERE username=?').get(username);return{student,auth:{id:user.id,workspaceId,username,role:'student',studentId:student.id}};}
  const s=child();let request=0;
  function pack(id='question-pack',count=4){return{id,version:1,title:'Bộ '+id,subject:'thinking',grade:3,kind:'quiz',source:'local',publishedAt:at,items:Array.from({length:count},(_,i)=>({id:`q${i+1}`,kind:'multiple-choice',objectiveId:'QUESTION.TEST',prompt:`${id} đề câu ${i+1}`,options:[`${id} đúng ${i+1}`,`${id} sai A ${i+1}`,`${id} sai B ${i+1}`,`${id} sai C ${i+1}`],correctIndex:0,explanation:'Đáp án đầu tiên.'}))};}
  function publish(source=pack(),sets){return seedLegacyWeek(store,admin,{requestId:'week-'+ ++request,classId:cls.id,title:'Tuần '+request,sets:sets??[{subjectLabel:'Tư duy',pack:source}]});}
  function start(source,{moduleId='math-quest',reviewItemIds,requestId='play-'+ ++request,compact=true,auth=s.auth}={}){return store.startPlay(auth,{requestId,moduleId,packId:source.id,contentVersion:source.version,...(reviewItemIds?{reviewItemIds}:{})},compact);}
  function clock(play,itemId,elapsedMs=1000){store.openQuestion(s.auth,play.session.sessionId,{itemId});const row=store.play(s.auth,play.session.sessionId);Object.defineProperty(row.session.questionClocks,itemId,{value:new Date(Date.now()-elapsedMs).toISOString(),enumerable:true,writable:true,configurable:true});store.db.prepare('UPDATE plays SET json=? WHERE workspace_id=? AND id=?').run(JSON.stringify(row.session),workspaceId,play.session.sessionId);}
  function answer(play,itemId,{correct=true,key=itemId,elapsedMs=1,hintsUsed=0}={}){return store.attempt(s.auth,play.session.sessionId,{attemptKey:key,itemId,response:{kind:'choice',choiceIndex:correct?0:1},hintsUsed,elapsedMs});}
  function pair(play,first,second,key=first){return store.attempt(s.auth,play.session.sessionId,{attemptKey:key,itemId:play.session.moduleId==='memory-match'?second:first,response:{kind:'pair',first:{itemId:first,side:'left'},second:{itemId:second,side:'right'}},hintsUsed:0,elapsedMs:1});}
  return{store,admin,cls,...s,child,pack,publish,start,clock,answer,pair};
}
const denied=(action,status)=>assert.throws(action,error=>error.status===status);

test('SQLite awards each correct question immediately with server timing and compact idempotent receipts',t=>{
  const f=fixture(t),source=f.pack();f.publish(source);const summary=f.store.ensureJourney(f.auth);assert.equal(summary.currentWeekSummary.total,4);assert.equal(summary.currentWeekSummary.zero,4);assert.equal(summary.currentWeekSummary.ready,false);assert.equal(JSON.stringify(summary).includes('questionIds'),false);assert.equal(summary.current.pack.items,undefined);
  const play=f.start(source);assert.equal(play.session.rewardPolicyVersion,2);assert.equal(play.pack.items,undefined);assert.equal(play.presentation.items.length,4);
  denied(()=>f.answer(play,'q1'),400);assert.equal(f.store.events(f.auth,play.session.sessionId).length,0);
  const firstClock=f.store.openQuestion(f.auth,play.session.sessionId,{itemId:'q1'}),again=f.store.openQuestion(f.auth,play.session.sessionId,{itemId:'q1'});assert.equal(firstClock.openedAt,again.openedAt);
  f.clock(play,'q1',61_000);const receipt=f.answer(play,'q1',{elapsedMs:0});assert.equal(receipt.event.correct,true);assert.ok(receipt.event.elapsedMs>=61_000);assert.equal(receipt.event.elapsedMs,Date.parse(receipt.event.occurredAt)-Date.parse(f.store.play(f.auth,play.session.sessionId).session.questionClocks.q1));assert.equal(receipt.questionRewards.gained,1);assert.deepEqual(receipt.questionRewards.questions,[{itemId:'q1',tier:1}]);assert.equal(receipt.questionRewards.balance,undefined);assert.equal(f.store.balance(f.auth,f.student.id).earned,1);
  const duplicate=f.answer(play,'q1',{elapsedMs:999});assert.equal(duplicate.duplicate,true);assert.equal(duplicate.questionRewards.gained,0);assert.deepEqual(duplicate.questionRewards.questions,[{itemId:'q1',tier:1}]);assert.equal(f.store.events(f.auth,play.session.sessionId).length,1);denied(()=>f.store.finishPlay(f.auth,play.session.sessionId,false,true),400);
  const original=f.store.rewards,requests=f.store.requests;f.store.rewards=()=>{throw new Error('Attempt must not load all awards');};f.store.requests=()=>{throw new Error('Attempt must not load wallet requests');};
  try{f.clock(play,'q2');const next=f.answer(play,'q2');assert.equal(next.questionRewards.gained,3);assert.deepEqual(next.questionRewards.questions,[{itemId:'q2',tier:3}]);}finally{f.store.rewards=original;f.store.requests=requests;}
});

test('SQLite question caps cross games and reviews without dropping source items or rewarding completion twice',t=>{
  const f=fixture(t),source=f.pack();f.publish(source);const slow=f.start(source);f.clock(slow,'q1',61_000);f.answer(slow,'q1');
  const review=f.start(source,{moduleId:'memory-match',reviewItemIds:['q1']});assert.deepEqual(review.session.requiredItemIds,['q1','q2']);assert.equal(review.presentation.items.length,2);assert.equal(f.store.play(f.auth,review.session.sessionId).pack.items.length,4);
  const match=f.pair(review,'q1','q1');assert.equal(match.questionRewards.gained,2);assert.deepEqual(match.questionRewards.questions,[{itemId:'q1',tier:3}]);assert.equal(f.store.balance(f.auth,f.student.id).earned,3);
  denied(()=>f.pair(review,'q3','q3'),400);denied(()=>f.store.finishPlay(f.auth,review.session.sessionId,false,true),400);
  f.pair(review,'q2','q2');const done=f.store.finishPlay(f.auth,review.session.sessionId,false,true);assert.equal(done.gained,0);assert.equal(done.state.balance.earned,6);assert.equal(done.state.currentWeekSummary.ready,false);assert.equal(done.state.currentWeekSummary.zero,2);assert.equal(f.store.finishPlay(f.auth,review.session.sessionId,false,true).gained,0);
  const replay=f.start(source,{moduleId:'word-connect',reviewItemIds:['q1','q2']});assert.equal(f.pair(replay,'q1','q1').questionRewards.gained,0);assert.equal(f.pair(replay,'q2','q2').questionRewards.gained,0);assert.equal(f.store.balance(f.auth,f.student.id).earned,6);
  const single=f.start(source,{reviewItemIds:['q3']});assert.equal(single.presentation.items.length,1);f.clock(single,'q3');f.answer(single,'q3');assert.equal(f.store.finishPlay(f.auth,single.session.sessionId,false,true).gained,0);assert.equal(f.store.balance(f.auth,f.student.id).earned,9);
});

test('SQLite requires two stars on every question and an explicit advance, then rejects old-week retries and play',t=>{
  const f=fixture(t),source=f.pack(),week=f.publish(source),nextSource=f.pack('next-question-pack'),nextWeek=f.publish(nextSource);f.store.ensureJourney(f.auth);const play=f.start(source,{requestId:'original-start'});
  denied(()=>f.start(nextSource),403);denied(()=>f.store.advanceWeek(f.auth,{weekId:week.id,requestId:'too-early'}),400);
  for(const item of source.items){f.clock(play,item.id,31_000);const receipt=f.answer(play,item.id);assert.equal(receipt.questionRewards.questions[0].tier,2);}
  const ready=f.store.studentSummary(f.auth);assert.equal(ready.currentWeekSummary.ready,true);assert.equal(ready.currentWeekSummary.two,4);assert.equal(ready.currentWeekSummary.weekId,week.id);assert.equal(ready.weeks.find(row=>row.id===nextWeek.id).unlocked,false);denied(()=>f.start(nextSource),403);
  const second=f.child('other-child');f.store.ensureJourney(second.auth);const advanced=f.store.advanceWeek(f.auth,{weekId:week.id,requestId:'advance-once'});assert.equal(advanced.currentWeekSummary.weekId,nextWeek.id);assert.equal(advanced.page.cursor,'1');assert.equal(f.store.studentSummary(f.auth).weeks.find(row=>row.id===week.id).closed,true);assert.equal(f.store.studentSummary(second.auth).currentWeekSummary.weekId,week.id);assert.equal(f.store.publicStudent(f.admin,f.store.student(f.admin,f.student.id)).currentWeek,nextWeek.title);
  assert.equal(f.store.advanceWeek(f.auth,{weekId:week.id,requestId:'advance-once'}).currentWeekSummary.weekId,nextWeek.id);denied(()=>f.store.advanceWeek(f.auth,{weekId:nextWeek.id,requestId:'advance-once'}),409);
  denied(()=>f.start(source,{requestId:'original-start'}),403);denied(()=>f.store.packGames(f.auth,source.id,source.version),403);denied(()=>f.answer(play,'q1'),403);denied(()=>f.store.openQuestion(f.auth,play.session.sessionId,{itemId:'q1'}),403);denied(()=>f.store.finishPlay(f.auth,play.session.sessionId,false,true),403);
  assert.equal(f.store.balance(f.auth,f.student.id).earned,8);assert.equal(f.store.db.prepare("SELECT count(*) AS n FROM audit WHERE action='student.journey.advance' AND user_id=?").get(f.auth.id).n,1);
  const marker=JSON.parse(f.store.db.prepare("SELECT target_id FROM audit WHERE action='student.journey.advance' AND user_id=?").get(f.auth.id).target_id);assert.deepEqual(marker.masteredPacks,[{packId:source.id,contentVersion:1}]);
});

test('SQLite progression checks every assigned set and keeps account, class and version scopes',t=>{
  const f=fixture(t),a=f.pack('first-subject'),b=f.pack('second-subject');const week=f.publish(a,[{subjectLabel:'Môn một',pack:a},{subjectLabel:'Môn hai',pack:b}]);f.publish(f.pack('later-week'));
  const play=f.start(a);for(const item of a.items){f.clock(play,item.id);f.answer(play,item.id);}const summary=f.store.studentSummary(f.auth);assert.equal(summary.currentWeekSummary.total,8);assert.equal(summary.currentWeekSummary.three,4);assert.equal(summary.currentWeekSummary.zero,4);assert.equal(summary.currentWeekSummary.ready,false);denied(()=>f.store.advanceWeek(f.auth,{weekId:week.id,requestId:'not-all-sets'}),400);
  denied(()=>f.start({...a,version:2}),403);const other=f.store.createClass(f.admin,{name:'Lớp khác',grade:3});f.store.updateStudent(f.admin,f.student.id,{classId:other.id});denied(()=>f.start(a),403);denied(()=>f.store.openQuestion(f.auth,play.session.sessionId,{itemId:'q1'}),403);
  assert.equal(f.store.studentSummary(f.auth).current,null);assert.equal(f.store.ensureJourney(f.auth).current,null);denied(()=>f.store.ensureJourney(f.admin),403);
});

test('SQLite legacy credits preserve the exact wallet and remain separate from per-question mastery',t=>{
  const f=fixture(t),source=f.pack();f.publish(source);const legacy={profileId:f.student.id,packId:source.id,starTier:3,sessionId:'legacy-session',completedAt:at,totalItems:4,firstTryCorrect:4};f.store.db.prepare('INSERT INTO awards VALUES(?,?,?,?,?)').run(f.auth.workspaceId,f.student.id,source.id,3,JSON.stringify(legacy));
  let summary=f.store.ensureJourney(f.auth);assert.equal(summary.balance.earned,3);assert.equal(summary.currentWeekSummary.zero,4);assert.equal(summary.currentWeekSummary.ready,false);
  const play=f.start(source);f.clock(play,'q1');assert.equal(f.answer(play,'q1').questionRewards.gained,0);let reward=f.store.rewards(f.auth,f.student.id)[0];assert.equal(reward.questionLedger.questionTiers.q1,3);assert.equal(reward.questionLedger.earnedStars,3);
  f.clock(play,'q2');assert.equal(f.answer(play,'q2').questionRewards.gained,3);assert.equal(f.store.balance(f.auth,f.student.id).earned,6);
  const old=f.start(source,{compact:false});assert.equal(old.session.rewardPolicyVersion,1);for(const item of source.items)f.answer(old,item.id);const completed=f.store.finishPlay(f.auth,old.session.sessionId,false,true);assert.equal(completed.gained,0);assert.equal(completed.state.balance.earned,6);reward=f.store.rewards(f.auth,f.student.id)[0];assert.deepEqual(reward.questionLedger.questionTiers,{q1:3,q2:3});assert.equal(reward.questionLedger.legacyStars,3);
  summary=f.store.studentSummary(f.auth);assert.equal(summary.currentWeekSummary.zero,2);assert.equal(summary.currentWeekSummary.ready,false);
});

test('SQLite attempt and question ledger writes roll back together on a persistence failure',t=>{
  const f=fixture(t),source=f.pack();f.publish(source);const play=f.start(source);f.clock(play,'q1');const prepare=f.store.db.prepare.bind(f.store.db);
  f.store.db.prepare=sql=>{if(sql.includes('INSERT INTO awards'))throw new Error('Simulated award write failure');return prepare(sql);};
  try{assert.throws(()=>f.answer(play,'q1'),/Simulated award write failure/);}finally{f.store.db.prepare=prepare;}
  assert.equal(f.store.events(f.auth,play.session.sessionId).length,0);assert.equal(f.store.rewards(f.auth,f.student.id).length,0);assert.equal(f.store.balance(f.auth,f.student.id).earned,0);
  assert.equal(f.answer(play,'q1').questionRewards.gained,3);assert.equal(f.answer(play,'q1').questionRewards.gained,0);assert.equal(f.store.balance(f.auth,f.student.id).earned,3);
});

test('SQLite current cursors reach later weeks while each metadata page remains bounded to twenty sets',t=>{
  const f=fixture(t),weeks=[];
  for(let i=0;i<22;i++){const pack=f.pack(`paged-week-${i+1}`,2);weeks.push({pack,week:f.publish(pack)});}
  f.store.ensureJourney(f.auth);
  for(const [index,{pack,week}]of weeks.slice(0,-1).entries()){
    const questionLedger={policyVersion:2,packId:pack.id,legacyStars:0,questionTiers:{q1:2,q2:2},earnedStars:4},award={profileId:f.student.id,packId:pack.id,starTier:2,sessionId:'fixture-completed',completedAt:at,totalItems:2,firstTryCorrect:2,questionLedger};
    f.store.db.prepare('INSERT INTO awards VALUES(?,?,?,?,?)').run(f.auth.workspaceId,f.student.id,pack.id,2,JSON.stringify(award));
    const result=f.store.advanceWeek(f.auth,{weekId:week.id,requestId:`page-advance-${index}`});assert.equal(result.currentWeekSummary.weekId,weeks[index+1].week.id);
  }
  const first=f.store.studentSummary(f.auth);assert.equal(first.weeks.flatMap(week=>week.sets).length,20);assert.equal(first.current.weekId,weeks[21].week.id);assert.equal(first.currentWeekSummary.cursor,'21');assert.equal(first.weeks.some(week=>week.id===weeks[21].week.id),false);
  const current=f.store.studentSummary(f.auth,'current');assert.equal(current.page.cursor,'21');assert.equal(current.weeks.length,1);assert.equal(current.weeks[0].id,weeks[21].week.id);assert.equal(current.weeks.flatMap(week=>week.sets).length,1);assert.equal(JSON.stringify(current).includes('questionIds'),false);assert.equal(current.current.pack.items,undefined);denied(()=>f.store.packGames(f.auth,weeks[0].pack.id,1),403);
});
