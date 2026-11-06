import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {OnlineStore} from '../../server/online-store.mjs';
import {PostgresStore} from '../../server/postgres-store.mjs';
import {createPostgresFixture} from '../../tests/helpers/postgres-fixture.mjs';
import {openProtocolQuestion} from '../../server/question-protocol.mjs';
import {generateContestQuestions,buildReviewMistakesPack} from '../../server/contest-data.mjs';
import {CONTEST_PRESETS,VIOLYMPIC_MATH_POOL} from '../../src/core/contest-matrix.ts';
import {validatePack} from '../../src/core/validation.ts';
const observations=[];
const pack={id:'audit-history-pack',version:1,title:'Audit history',kind:'quiz',subject:'math',grade:3,source:'local',publishedAt:'2026-11-06T00:00:00.000Z',items:[{id:'q1',kind:'multiple-choice',objectiveId:'AUDIT.Q1',prompt:'1 + 1 bằng bao nhiêu?',options:['2','3','4','5'],correctIndex:0,explanation:'1+1=2.'},{id:'q2',kind:'multiple-choice',objectiveId:'AUDIT.Q2',prompt:'1 + 2 bằng bao nhiêu?',options:['3','4','5','6'],correctIndex:0,explanation:'1+2=3.'}]};
async function setup(t,engine){
 let store,admin;
 if(engine==='PostgreSQL')({store,admin}=await createPostgresFixture(t));
 else{
  store=new OnlineStore(':memory:');t.after(()=>store.close());
  store.db.prepare('INSERT INTO workspaces(id,name,created_at) VALUES(?,?,?)').run('audit-history-workspace','Audit history','2026-11-06T00:00:00.000Z');
  store.db.prepare("INSERT INTO users(id,workspace_id,username,password_hash,role,created_at) VALUES(?,?,?,?,'admin',?)").run('audit-history-admin','audit-history-workspace','audit.history.admin','fixture-only','2026-11-06T00:00:00.000Z');
  admin={id:'audit-history-admin',workspaceId:'audit-history-workspace',role:'admin',username:'audit.history.admin'};
 }
 const cls=await store.createClass(admin,{name:'Audit history class',grade:3});
 const student=await store.createStudent(admin,{classId:cls.id,name:'Audit child',username:'audit.history.child'},'fixture-only','audit.history.child');
 async function insert(id,minute,presentations){
  const values=[id,admin.workspaceId,student.id,id,JSON.stringify({sessionId:id,packId:pack.id,contentVersion:1,startedAt:'2026-11-06T01:'+String(minute).padStart(2,'0')+':00.000Z',questionPresentations:presentations})];
  if(engine==='SQLite')store.db.prepare('INSERT INTO plays(id,workspace_id,student_id,request_id,json) VALUES(?,?,?,?,?)').run(...values);
  else await store.exec('INSERT INTO bao_an.plays(id,workspace_id,student_id,request_id,json) VALUES($1,$2,$3,$4,$5::jsonb)',values);
 }
 return{store,admin,student,insert};
}
for(const engine of ['SQLite','PostgreSQL']){
 test('AUDIT: '+engine+' cold cache forgets target question after five unrelated plays',async t=>{
  const{store,admin,student,insert}=await setup(t,engine);
  await insert('history-target',0,{q1:{displayedCorrectIndex:0}});
  for(let i=1;i<=5;i++)await insert('history-other-'+i,i,{['other'+i]:{displayedCorrectIndex:2}});
  const last=await store.lastQuestionCorrectPosition(admin.workspaceId,student.id,'q1',1);
  assert.equal(last,null);
  const session={sessionId:'history-new',moduleId:'math-quest',rewardPolicyVersion:2,requiredItemIds:['q1']};
  const opened=openProtocolQuestion(session,pack,[],'q1',Date.now(),last,()=>0.05);
  const newPosition=opened.item.options.indexOf('2');assert.equal(newPosition,0);
  observations.push({case:'anti-repeat-cold-history-limit',engine,unrelatedLaterPlays:5,previousPosition:0,lookup:last,newPosition,repeated:true});
 });
 test('AUDIT: '+engine+' warm cache misses newer presentation from another instance',async t=>{
  const{store,admin,student,insert}=await setup(t,engine);
  await insert('history-instance-one',0,{q1:{displayedCorrectIndex:0}});
  assert.equal(await store.lastQuestionCorrectPosition(admin.workspaceId,student.id,'q1',1),0);
  await insert('history-instance-two',1,{q1:{displayedCorrectIndex:1}});
  const stale=await store.lastQuestionCorrectPosition(admin.workspaceId,student.id,'q1',1);assert.equal(stale,0);
  const session={sessionId:'history-new',moduleId:'math-quest',rewardPolicyVersion:2,requiredItemIds:['q1']};
  const opened=openProtocolQuestion(session,pack,[],'q1',Date.now(),stale,()=>0.05);
  const newPosition=opened.item.options.indexOf('2');assert.equal(newPosition,1);
  observations.push({case:'anti-repeat-stale-instance-cache',engine,cachedPosition:stale,latestStoredPosition:1,newPosition,repeated:true});
 });
}
test('AUDIT: contest ignores normal authored multiple-choice options and creates invalid review schema',()=>{
 const preset={...CONTEST_PRESETS['violympic-math-g3'],totalQuestions:VIOLYMPIC_MATH_POOL.length+5};
 const items=generateContestQuestions(preset,'audit-student','audit-contest',[pack]);
 const included=items.some(item=>item.id===pack.id+'_q1');assert.equal(included,false);
 const review=buildReviewMistakesPack({sessionId:'audit-contest',title:'Audit contest',subject:'math',grade:3},[{prompt:'1 + 1 bằng bao nhiêu?',correctAnswer:'2',explanation:'1 + 1 = 2.'},{prompt:'1 + 2 bằng bao nhiêu?',correctAnswer:'3',explanation:'1 + 2 = 3.'}]);
 const errors=validatePack(review);assert.ok(errors.length>0);
 assert.equal(review.items[0].correctIndex,0);
 observations.push({case:'contest-authored-bank-and-review-contract',authoredQuestionIncluded:included,reviewKind:review.kind,reviewItemKind:review.items[0].kind,reviewCorrectIndex:review.items[0].correctIndex,validationErrors:errors});
});
test.after(()=>{fs.mkdirSync('test-results/audit-2026-11-06',{recursive:true});fs.writeFileSync('test-results/audit-2026-11-06/shuffle-history-reproduction.json',JSON.stringify({note:'Passing assertions confirm unwanted behavior, not product acceptance',observations},null,2));});
