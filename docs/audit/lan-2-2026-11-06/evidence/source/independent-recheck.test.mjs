import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import {resolve,dirname,join} from 'node:path';
import {OnlineStore} from '../../server/online-store.mjs';
import {createHash,randomUUID} from 'node:crypto';
import {createOnlineServer} from '../../server/online-server.mjs';
import {createCloudApi} from '../../server/cloud-api.mjs';
import {createPostgresFixture} from '../../tests/helpers/postgres-fixture.mjs';
import {seedLegacyWeek} from '../../tests/helpers/legacy-weeks.mjs';
import {exportCloudBackup,restoreCloudBackup} from '../../server/cloud-backup-restore.mjs';
import {CONTEST_PRESETS} from '../../server/contest-data.mjs';
const observations=[];
const sha=b=>createHash('sha256').update(b).digest('hex');
const password='Audit-lan-2-password-2026!',token='audit-lan-2-bootstrap-20261106';
function client(send,origin){let cookie='',csrf='';return async(route,body)=>{const response=await send(new Request(origin+'/api/online'+route,{method:body===undefined?'GET':'POST',headers:{'X-Bao-An-Question-Protocol':'1',...(cookie?{Cookie:cookie}:{}),...(body!==undefined?{Origin:origin,'Content-Type':'application/json','X-CSRF-Token':csrf}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})}));const cookies=response.headers.getSetCookie();if(cookies.length)cookie=cookies.map(v=>v.split(';',1)[0]).join('; ');const data=await response.json();if(data.csrfToken)csrf=data.csrfToken;return{status:response.status,data};};}
async function harness(t,engine){
 if(engine==='SQLite HTTP'){const server=createOnlineServer({databasePath:':memory:',staticRoot:'dist',setupToken:token,secureCookies:false});server.listen(0,'127.0.0.1');await once(server,'listening');t.after(async()=>{server.closeAllConnections?.();await new Promise(r=>server.close(r));server.onlineClose();});return{store:server.onlineStore,origin:'http://127.0.0.1:'+server.address().port,send:r=>fetch(r)};}
 const f=await createPostgresFixture(t,{bootstrap:false});const origin='https://audit-lan-2.example.test';const api=createCloudApi({store:f.store,storage:{download:async()=>Buffer.alloc(0),upload:async()=>{}},publicOrigin:origin,setupToken:token});return{store:f.store,origin,send:r=>api(r,{ip:'192.0.2.111'})};
}
async function setup(t,engine,itemPrefix='audit-q'){
 const h=await harness(t,engine),manager=client(h.send,h.origin),child=client(h.send,h.origin),other=client(h.send,h.origin);
 const setup=await manager('/setup',{token,name:'Audit lane 2 fixture',username:'audit.manager',password});assert.equal(setup.status,201);const admin=setup.data.user;
 const cls=(await manager('/classes',{name:'Audit class A',grade:3})).data;
 const a=(await manager('/students',{classId:cls.id,name:'Audit child A',username:'audit.child.a',password})).data.student;
 const b=(await manager('/students',{classId:cls.id,name:'Audit child B',username:'audit.child.b',password})).data.student;
 const pack={id:'audit-question-bank',version:1,title:'Audit authored bank',kind:'quiz',subject:'thinking',grade:3,source:'local',publishedAt:'2026-11-06T00:00:00Z',items:[1,2].map(i=>({id:itemPrefix+i,objectiveId:'AUDIT.RECHECK',kind:'multiple-choice',prompt:'Audit '+i+' + 1 = ?',options:[String(i+1),'90','91','92'],correctIndex:0,explanation:'Audit answer.'}))};
 await seedLegacyWeek(h.store,admin,{requestId:'audit-week',classId:cls.id,title:'Audit week',sets:[{subjectLabel:'Toán',pack}]});
 assert.equal((await child('/login',{username:'audit.child.a',password})).status,200);assert.equal((await other('/login',{username:'audit.child.b',password})).status,200);
 await child('/student/journey',{});await other('/student/journey',{});
 const me=(await child('/me')).data.user,otherMe=(await other('/me')).data.user;
 return{...h,manager,child,other,admin,a,b,cls,pack,me,otherMe};
}
function findPrivate(value){if(!value||typeof value!=='object')return null;if(value.presentationsById&&Object.keys(value.presentationsById).length)return value.presentationsById;for(const v of Object.values(value)){const found=findPrivate(v);if(found)return found;}return null;}
for(const engine of ['SQLite HTTP','PostgreSQL API']){
 test('AUDIT lane 2: public session answer disclosure '+engine,async t=>{
  const f=await setup(t,engine);const body={requestId:'audit-open-play',packId:f.pack.id,contentVersion:1,moduleId:'math-quest'};
  const started=await f.child('/play/compact',body);assert.equal(started.status,201);const id=started.data.session.sessionId;
  const opened=await f.child('/play/'+id+'/question-open',{itemId:'audit-q1'});assert.equal(opened.status,200);
  const summary=await f.child('/student/summary?cursor=current');const repeated=await f.child('/play/compact',body);
  const secret=findPrivate(summary.data)||findPrivate(repeated.data);assert.ok(secret,'New private presentation map is disclosed in student API');
  const presentation=Object.values(secret).find(p=>p.itemId==='audit-q1');assert.ok(Number.isInteger(presentation.displayedCorrectIndex));
  const answer=await f.child('/play/'+id+'/attempt',{attemptKey:'audit-from-exposed-position',itemId:'audit-q1',response:{kind:'choice',choiceIndex:presentation.displayedCorrectIndex},hintsUsed:0,elapsedMs:0,presentationId:opened.data.item.presentationId});
  assert.equal(answer.status,200);assert.equal(answer.data.event.correct,true);
  observations.push({case:'public-session-answer-disclosure',engine,summaryHttpStatus:summary.status,reopenHttpStatus:repeated.status,summaryExposesMap:!!findPrivate(summary.data),reopenExposesMap:!!findPrivate(repeated.data),privatePresentationFields:Object.keys(presentation),answerSubmittedBeforeUsingAuthoredKey:true,serverMarkedCorrect:answer.data.event.correct});
 });
 test('AUDIT lane 2: autosave same-question edits still arrive out of order '+engine,async t=>{
  const f=await setup(t,engine),preset=Object.values(CONTEST_PRESETS)[0];const s=await f.store.startContest(f.me,{presetId:preset.id});
  const q=s.items[0],newer=q.kind==='choice'?(q.options[1]??'newer'):'newer',older=q.kind==='choice'?(q.options[0]??'older'):'older';
  await f.store.saveContestProgress(f.me,s.sessionId,{answers:{[q.id]:newer},revision:2,seq:2});
  await f.store.saveContestProgress(f.me,s.sessionId,{answers:{[q.id]:older},revision:1,seq:1});
  const current=(await f.store.activeContest(f.me)).session;assert.equal(current.answers[q.id],older);
  observations.push({case:'autosave-same-question-stale-overwrite',engine,newerRevision:2,olderRevisionDeliveredLast:1,expectedNewestAnswer:newer,actualPersistedAnswer:current.answers[q.id],staleValueWon:true});
 });
 test('AUDIT lane 2: review prefix bypasses assignment for another student '+engine,async t=>{
  const f=await setup(t,engine);const preset=Object.values(CONTEST_PRESETS)[0];const started=await f.store.startContest(f.me,{presetId:preset.id});await f.store.submitContest(f.me,started.sessionId,{answers:{}});
  const review=await f.store.contestReviewPack(f.me,started.sessionId);assert.ok(review.id.startsWith('review-'));
  const play=await f.other('/play/compact',{requestId:'audit-other-child-review',packId:review.id,contentVersion:review.version,moduleId:'math-quest'});
  assert.equal(play.status,201);const opened=await f.other('/play/'+play.data.session.sessionId+'/question-open',{itemId:review.items[0].id});assert.equal(opened.status,200);
  observations.push({case:'review-pack-other-child-access',engine,reviewBelongsToStudentA:true,studentBStartStatus:play.status,studentBQuestionOpenStatus:opened.status,studentBReceivedReviewQuestion:!!opened.data.item?.prompt});
 });
 test('CONTROL lane 2: PIN lockout now also blocks setup-pin '+engine,async t=>{
  const f=await setup(t,engine);assert.equal((await f.manager('/parent/setup-pin',{studentId:f.a.id,pin:'7342'})).status,200);
  for(let i=0;i<5;i++)await f.child('/parent/verify-pin',{pin:'0000'});
  const attempts=[];for(let i=0;i<6;i++)attempts.push((await f.child('/parent/setup-pin',{pin:'9881',oldPin:'0000'})).status);
  const correctWhileLocked=await f.child('/parent/setup-pin',{pin:'9881',oldPin:'7342'});assert.ok(attempts.every(s=>s===429));assert.equal(correctWhileLocked.status,429);
  observations.push({case:'pin-lockout-old-bypass-fixed',engine,outcome:'FIX_VERIFIED_FOR_TESTED_PATH',setupStatuses:attempts,correctOldPinDuringLock:correctWhileLocked.status});
 });
}
test('AUDIT lane 2: SQLite history lookup loses authored IDs containing dots',async t=>{
 const f=await setup(t,'SQLite HTTP','curriculum.q.');const started=await f.child('/play/compact',{requestId:'audit-dotted-id',packId:f.pack.id,contentVersion:1,moduleId:'math-quest'});assert.equal(started.status,201);
 const opened=await f.child('/play/'+started.data.session.sessionId+'/question-open',{itemId:'curriculum.q.1'});assert.equal(opened.status,200);
 const expected=opened.data.item.options.indexOf('2');const lookup=f.store.lastQuestionCorrectPosition(f.me.workspaceId,f.me.studentId,'curriculum.q.1',1);assert.equal(lookup,null);
 observations.push({case:'sqlite-dotted-question-history',authoredItemId:'curriculum.q.1',positionStoredInSession:expected,historyLookup:lookup,forgotPosition:true});
});
for(const point of ['after-create','after-drop'])test('AUDIT lane 2: SQLite migration recovery '+point,async()=>{
 const root=resolve('test-results/audit-lan-2-2026-11-06'),dir=await mkdtemp(join(root,'migration-'));let store;
 try{
  const file=join(dir,'legacy.sqlite'),db=new DatabaseSync(file);db.exec("CREATE TABLE workspaces(id TEXT PRIMARY KEY,name TEXT NOT NULL,wallet_enabled INTEGER NOT NULL DEFAULT 0,rate_vnd INTEGER NOT NULL DEFAULT 1000,created_at TEXT NOT NULL); CREATE TABLE users(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL REFERENCES workspaces(id),username TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('admin','student')),student_id TEXT,active INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL); CREATE TABLE users_upgrade_v4(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL REFERENCES workspaces(id),username TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('admin','student','parent')),student_id TEXT,active INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL);");
  db.prepare('INSERT INTO workspaces(id,name,created_at) VALUES(?,?,?)').run('w','Audit legacy','2026-11-06T00:00:00Z');db.prepare("INSERT INTO users(id,workspace_id,username,password_hash,role,created_at) VALUES(?,?,?,?,?,?)").run('a','w','audit.legacy.admin','fixture-hash','admin','2026-11-06T00:00:00Z');
  if(point==='after-drop')db.exec('INSERT INTO users_upgrade_v4 SELECT * FROM users; DROP TABLE users;');db.close();
  store=new OnlineStore(file);const adminCount=store.db.prepare("SELECT count(*) AS n FROM users WHERE role='admin'").get().n;
  if(point==='after-create'){assert.equal(adminCount,1);observations.push({case:'sqlite-migration-after-create-fixed',outcome:'FIX_VERIFIED_FOR_TESTED_PATH',adminCount});}
  else{assert.equal(adminCount,0);assert.equal(store.db.prepare('SELECT count(*) AS n FROM users_upgrade_v4').get().n,1);observations.push({case:'sqlite-migration-after-drop-account-loss',startupAccepted:true,currentUsers:adminCount,originalAdminOnlyInTemporaryTable:true,configured:store.configured(),recoveryIncomplete:true});}
 }finally{store?.close();assert.equal(dirname(dir),root);await rm(dir,{recursive:true,force:true});}
});
async function mediaBackup(t){const f=await createPostgresFixture(t);const bytes=await readFile('dist/art/fox-guide-common.webp');const id=randomUUID(),objectPath=f.admin.workspaceId+'/'+id;await f.store.addMedia(f.admin,{id,name:'audit-media.webp',mime:'image/webp',bytes,objectPath});const backup=await exportCloudBackup(f.store,{download:async()=>bytes},f.admin.workspaceId);return{...f,backup,bytes,objectPath};}
test('AUDIT lane 2: restoring media first can corrupt live media when SQL later fails',async t=>{
 const source=await mediaBackup(t),target=await createPostgresFixture(t,{bootstrap:false});const files=new Map();const storage={upload:async(p,b)=>files.set(p,Buffer.from(b)),download:async p=>files.get(p)};
 await restoreCloudBackup(target.store,storage,source.backup);const newer=await readFile('dist/art/game-cards/game-card-memory-grove.webp');files.set(source.objectPath,newer);
 await target.store.exec('UPDATE bao_an.media SET sha256=$1,size=$2 WHERE workspace_id=$3',[sha(newer),newer.length,source.admin.workspaceId]);await target.store.exec('UPDATE bao_an.workspaces SET name=$1 WHERE id=$2',['TARGET NEWER DATA',source.admin.workspaceId]);
 const exec=target.store.exec.bind(target.store);target.store.exec=async(sql,...args)=>{if(sql.startsWith('DELETE FROM bao_an.'))throw Error('AUDIT injected SQL failure after storage writes');return exec(sql,...args);};
 await assert.rejects(()=>restoreCloudBackup(target.store,storage,source.backup),/AUDIT injected SQL/);
 const name=(await target.store.one('SELECT name FROM bao_an.workspaces WHERE id=$1',[source.admin.workspaceId])).name;const media=await target.store.one('SELECT sha256 FROM bao_an.media WHERE workspace_id=$1',[source.admin.workspaceId]);
 assert.equal(name,'TARGET NEWER DATA');assert.notEqual(sha(files.get(source.objectPath)),media.sha256);
 observations.push({case:'restore-storage-overwritten-before-sql-failure',sqlTransactionRolledBack:true,targetDatabasePreserved:true,existingStorageBytesChanged:true,storageMatchesPreservedDatabase:false});
});
test('AUDIT lane 2: media metadata without media assets is accepted by preview',async t=>{
 const f=await mediaBackup(t),payload=JSON.parse(f.backup.payload);payload.mediaAssets=[];const changed={...f.backup,payload:JSON.stringify(payload)};changed.checksum=sha(changed.payload);
 const preview=await restoreCloudBackup(f.store,null,changed,{dryRun:true});assert.equal(preview.valid,true);
 observations.push({case:'backup-missing-media-assets-accepted',mediaRows:payload.tables.media.length,mediaAssets:0,previewValid:preview.valid,mediaCountReported:preview.mediaCount});
});
test('AUDIT lane 2: export consistency check misses concurrent new student/user relation',async t=>{
 const f=await createPostgresFixture(t);const cls=await f.store.createClass(f.admin,{name:'Concurrent class',grade:3});const rows=f.store.rows.bind(f.store);let injected=false;
 f.store.rows=async(sql,params,...rest)=>{if(sql==='SELECT * FROM bao_an.students WHERE workspace_id = $1'&&!injected){injected=true;await f.store.createStudent(f.admin,{classId:cls.id,name:'Concurrent child',username:'audit.concurrent.child'},'fixture-hash','audit.concurrent.child');}return rows(sql,params,...rest);};
 const backup=await exportCloudBackup(f.store,{download:async()=>Buffer.alloc(0)},f.admin.workspaceId);const p=JSON.parse(backup.payload);const userIds=new Set(p.tables.users.map(u=>u.id));assert.equal(p.tables.students.length,1);assert.equal(userIds.has(p.tables.students[0].user_id),false);
 const target=await createPostgresFixture(t,{bootstrap:false});await assert.rejects(()=>restoreCloudBackup(target.store,null,backup));
 observations.push({case:'backup-torn-student-user-snapshot',exportReportedSuccess:true,studentRows:1,parentUserMissingInBackup:true,checksumValid:true,restoreFailed:true});
});
test.after(async()=>{await writeFile(process.env.AUDIT_RECHECK_OUTPUT??'test-results/audit-lan-2-2026-11-06/independent-recheck.json',JSON.stringify({note:'Reproduction assertions confirm unwanted behavior. CONTROL/outcome FIX_VERIFIED entries verify only the tested repaired path; not blanket acceptance.',observations},null,2));});
