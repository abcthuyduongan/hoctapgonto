import {seedLegacyWeek} from './helpers/legacy-weeks.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {mkdtemp,mkdir,copyFile,rm} from 'node:fs/promises';
import {resolve,join,dirname,basename} from 'node:path';
import {OnlineStore} from '../server/online-store.mjs';
import {inspectOnlineBackup,snapshotOnlineDatabase,restoreOnlineDatabase} from '../server/online-recovery.mjs';

const results=resolve('test-results');
async function fixture(t){
 t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-10-17T06:00:00.000Z')});await mkdir(results,{recursive:true});const directory=await mkdtemp(join(results,'question-recovery-')),databasePath=join(directory,'source.sqlite'),store=new OnlineStore(databasePath),workspaceId=randomUUID(),adminId=randomUUID(),at=new Date().toISOString();store.db.prepare('INSERT INTO workspaces(id,name,created_at) VALUES(?,?,?)').run(workspaceId,'Question recovery',at);store.db.prepare("INSERT INTO users(id,workspace_id,username,password_hash,role,created_at) VALUES(?,?,?,?,'admin',?)").run(adminId,workspaceId,'manager','salt:hash',at);const admin={id:adminId,workspaceId,username:'manager',role:'admin'},cls=store.createClass(admin,{name:'Lớp lưu sao',grade:3}),student=store.createStudent(admin,{classId:cls.id,name:'An',username:'question-child'},'salt:hash','question-child'),user=store.db.prepare("SELECT * FROM users WHERE username='question-child'").get(),auth={id:user.id,workspaceId,username:user.username,role:'student',studentId:student.id};
 const source=(id,suffix='')=>({id,version:1,title:'Câu hỏi cần sao lưu',kind:'pairs',grade:3,subject:'thinking',source:'local',publishedAt:at,items:[['Cây','Lá'],['Trời','Mây'],['Biển','Nước'],['Rừng','Gỗ']].map(([left,right],i)=>({id:'q'+(i+1),kind:'pair',objectiveId:'RECOVERY.QUESTION',left:left+suffix,right}))}),pack=source('recovery-question'),next=source('recovery-next',' tuần sau'),weeks=[pack,next].map((pack,i)=>seedLegacyWeek(store,admin,{requestId:'recovery-week-'+i,classId:cls.id,title:'Tuần '+(i+1),sets:[{subjectLabel:'Tự nhiên',pack}]}));
 t.after(async()=>{store.close();assert.equal(dirname(resolve(directory)),results);assert.match(basename(directory),/^question-recovery-/);await rm(directory,{recursive:true,force:true});});
 return{store,directory,databasePath,admin,auth,student,cls,pack,weeks,tick:ms=>t.mock.timers.tick(ms)};
}
function start(f,key,moduleId='math-quest',reviewItemIds){return f.store.startPlay(f.auth,{requestId:key,moduleId,packId:f.pack.id,contentVersion:1,...(reviewItemIds?{reviewItemIds}:{})},true);}
function answer(f,play,item,key=item.id){return f.store.attempt(f.auth,play.session.sessionId,{attemptKey:key,itemId:item.id,response:play.presentation.kind==='quiz'?{kind:'choice',choiceIndex:item.correctIndex}:{kind:'pair',first:{itemId:item.id,side:'left'},second:{itemId:item.id,side:'right'}},hintsUsed:0,elapsedMs:0});}
async function damaged(f,snapshot,name,change){const file=join(f.directory,name+'.sqlite');await copyFile(snapshot,file);const db=new DatabaseSync(file);try{change(db);}finally{db.close();}assert.throws(()=>inspectOnlineBackup(file),error=>error.status===400,name);}

test('question backups retain partial active/abandoned stars and restore exact wallet and ledger',async t=>{
 const f=await fixture(t),first=start(f,'partial');f.store.openQuestion(f.auth,first.session.sessionId,{itemId:'q1'});f.tick(45000);assert.equal(answer(f,first,first.presentation.items[0]).questionRewards.gained,2);f.store.finishPlay(f.auth,first.session.sessionId,true,true);
 const active=start(f,'active-review','memory-match',['q2']);answer(f,active,active.presentation.items.find(q=>q.id==='q2'));const before=f.store.studentSummary(f.auth),snapshot=join(f.directory,'partial-backup.sqlite'),preview=await snapshotOnlineDatabase(f.store.db,snapshot);assert.equal(preview.activePlays,1);assert.equal(before.balance.earned,5);
 const target=join(f.directory,'restored','source.sqlite');await restoreOnlineDatabase({databasePath:target,backupPath:snapshot,expectedSha256:preview.sha256});const restored=new OnlineStore(target);try{const state=restored.studentSummary(f.auth);assert.deepEqual(state.balance,before.balance);assert.deepEqual(state.current.questionProgress,before.current.questionProgress);assert.equal(restored.db.prepare("SELECT count(*) AS n FROM plays WHERE json_extract(json,'$.status')='active'").get().n,0);assert.equal(inspectOnlineBackup(target).activePlays,0);}finally{restored.close();}
 await damaged(f,snapshot,'forged-clock',db=>{const row=db.prepare('SELECT rowid,json FROM attempts ORDER BY rowid LIMIT 1').get(),event=JSON.parse(row.json);event.elapsedMs=0;db.prepare('UPDATE attempts SET json=? WHERE rowid=?').run(JSON.stringify(event),row.rowid);});
 await damaged(f,snapshot,'forged-question-stars',db=>{const row=db.prepare('SELECT rowid,json FROM awards LIMIT 1').get(),award=JSON.parse(row.json);award.questionLedger.questionTiers.q1=3;award.questionLedger.earnedStars++;db.prepare('UPDATE awards SET json=? WHERE rowid=?').run(JSON.stringify(award),row.rowid);});
 await damaged(f,snapshot,'missing-partial-ledger',db=>db.exec('DELETE FROM awards'));
});

test('question backup verifies manual advancement using pinned pack versions and rejects forged jumps or early redemptions',async t=>{
 const f=await fixture(t),play=start(f,'mastery');for(const item of play.presentation.items){f.store.openQuestion(f.auth,play.session.sessionId,{itemId:item.id});f.tick(45000);answer(f,play,item);}f.store.finishPlay(f.auth,play.session.sessionId,false,true);f.store.configureWallet(f.admin,{enabled:true,rateVnd:1000});f.store.requestReward(f.auth,{requestId:'question-wish',title:'Bút',goalVnd:2000});f.tick(1000);f.store.advanceWeek(f.auth,{weekId:f.weeks[0].id,requestId:'confirmed'});
 const snapshot=join(f.directory,'advanced.sqlite');await snapshotOnlineDatabase(f.store.db,snapshot);assert.equal(inspectOnlineBackup(snapshot).counts.awards,1);
 await damaged(f,snapshot,'forged-advance-mastered-version',db=>{const row=db.prepare("SELECT rowid,target_id FROM audit WHERE action='student.journey.advance'").get(),marker=JSON.parse(row.target_id);marker.masteredPacks[0].contentVersion=99;db.prepare('UPDATE audit SET target_id=? WHERE rowid=?').run(JSON.stringify(marker),row.rowid);});
 await damaged(f,snapshot,'forged-week-init',db=>{const row=db.prepare("SELECT rowid,target_id FROM audit WHERE action='student.journey.init'").get(),marker=JSON.parse(row.target_id);marker.weekId=f.weeks[1].id;marker.position=2;db.prepare('UPDATE audit SET target_id=? WHERE rowid=?').run(JSON.stringify(marker),row.rowid);});
 await damaged(f,snapshot,'redemption-before-earned',db=>{const row=db.prepare('SELECT rowid,json FROM redemptions').get(),request=JSON.parse(row.json);request.history[0].at='2026-10-17T06:00:00.000Z';request.createdAt=request.history[0].at;db.prepare('UPDATE redemptions SET json=? WHERE rowid=?').run(JSON.stringify(request),row.rowid);});
});

test('question backup accepts original legacy-only evidence without creating per-question mastery',async t=>{
 const f=await fixture(t),play=f.store.startPlay(f.auth,{requestId:'legacy',moduleId:'math-quest',packId:f.pack.id,contentVersion:1});for(const item of play.presentation.items)answer(f,play,item);f.store.finishPlay(f.auth,play.session.sessionId);
 // Reproduce the exact schema-one award written by the earlier deployed application.
 const row=f.store.db.prepare('SELECT rowid,json FROM awards').get(),award=JSON.parse(row.json);delete award.questionLedger;award.starTier=3;f.store.db.prepare('UPDATE awards SET tier=3,json=? WHERE rowid=?').run(JSON.stringify(award),row.rowid);
 const snapshot=join(f.directory,'original-legacy.sqlite');await snapshotOnlineDatabase(f.store.db,snapshot);assert.equal(inspectOnlineBackup(snapshot).counts.awards,1);
 f.tick(1000);const review=start(f,'legacy-floor-review','math-quest',['q1']);f.store.openQuestion(f.auth,review.session.sessionId,{itemId:'q1'});f.tick(90000);assert.equal(answer(f,review,review.presentation.items[0]).questionRewards.gained,0);assert.equal(f.store.studentSummary(f.auth).balance.earned,3);const mixed=join(f.directory,'legacy-with-question.sqlite');await snapshotOnlineDatabase(f.store.db,mixed);assert.equal(inspectOnlineBackup(mixed).counts.awards,1);
});
