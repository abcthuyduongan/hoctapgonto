import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {resolve} from 'node:path';
import {writeFile,mkdtemp,rm,mkdir} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import {execFileSync} from 'node:child_process';
import {OnlineStore} from '../../server/online-store.mjs';
import {openProtocolQuestion} from '../../server/question-protocol.mjs';
import {createHash} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {createOnlineServer} from '../../server/online-server.mjs';
import {createCloudApi} from '../../server/cloud-api.mjs';
import {PostgresStore} from '../../server/postgres-store.mjs';
import {createPostgresFixture,postgresMigration,pglitePool} from '../../tests/helpers/postgres-fixture.mjs';
import {exportCloudBackup,restoreCloudBackup} from '../../server/cloud-backup-restore.mjs';
import {readFile} from 'node:fs/promises';

const observations=[];
const password='Audit-only-password-2026!';
const token='audit-bootstrap-token-20261105';
function client(send,origin){
  let cookie='',csrf='';
  return async(route,method='GET',body)=>{
    const headers={'X-Bao-An-Question-Protocol':'1',...(cookie?{Cookie:cookie}:{}),...(method!=='GET'?{Origin:origin,'Content-Type':'application/json','X-CSRF-Token':csrf}:{})};
    const response=await send(new Request(origin+'/api/online'+route,{method,headers,...(body!==undefined?{body:JSON.stringify(body)}:{})}));
    const cookies=response.headers.getSetCookie();if(cookies.length)cookie=cookies.map(v=>v.split(';',1)[0]).join('; ');
    const data=await response.json();if(data.csrfToken)csrf=data.csrfToken;
    return{status:response.status,data};
  };
}
async function harness(t,engine){
  if(engine==='SQLite HTTP'){
    const server=createOnlineServer({databasePath:':memory:',staticRoot:resolve('dist'),setupToken:token,secureCookies:false});
    server.listen(0,'127.0.0.1');await once(server,'listening');
    t.after(async()=>{server.closeAllConnections?.();await new Promise(resolve=>server.close(resolve));server.onlineClose();});
    return{origin:'http://127.0.0.1:'+server.address().port,send:request=>fetch(request)};
  }
  const f=await createPostgresFixture(t,{bootstrap:false});
  const origin='https://audit-fixture.example.test';
  const api=createCloudApi({store:f.store,storage:{download:async()=>Buffer.alloc(0),upload:async()=>{}},publicOrigin:origin,setupToken:token});
  return{origin,send:request=>api(request,{ip:'192.0.2.110'})};
}
for(const engine of ['SQLite HTTP','PostgreSQL cloud adapter']){
  test('AUDIT reproduction: '+engine+' lets an unverified student disable PIN-protected controls',async t=>{
    const h=await harness(t,engine),manager=client(h.send,h.origin),child=client(h.send,h.origin),parent=client(h.send,h.origin);
    assert.equal((await manager('/setup','POST',{token,name:'Audit isolated fixture',username:'audit.manager',password})).status,201);
    const cls=(await manager('/classes','POST',{name:'Audit class',grade:3})).data;
    const childA=(await manager('/students','POST',{classId:cls.id,name:'Audit child A',username:'audit.child.a',password})).data.student;
    const childB=(await manager('/students','POST',{classId:cls.id,name:'Audit child B',username:'audit.child.b',password})).data.student;
    assert.equal((await manager('/parent/setup-pin','POST',{studentId:childA.id,pin:'7342'})).status,200);
    assert.equal((await manager('/parent/settings','POST',{studentId:childA.id,maxMinutesPerDay:25,allowedStartHour:0,allowedEndHour:24})).status,200);
    assert.equal((await child('/login','POST',{username:'audit.child.a',password})).status,200);
    // No verify-pin request has been made.
    const dashboard=await child('/parent/dashboard');
    const altered=await child('/parent/settings','POST',{maxMinutesPerDay:0,allowedStartHour:0,allowedEndHour:24});
    assert.equal(dashboard.status,200);
    assert.equal(altered.status,200);
    assert.equal(altered.data.maxMinutesPerDay,0);
    assert.ok(altered.data.pinHash&&altered.data.pinSalt);
    const createdParent=await manager('/parents','POST',{name:'Audit parent A',username:'audit.parent.a',password,studentIds:[childA.id]});
    assert.equal(createdParent.status,201);
    assert.equal((await parent('/login','POST',{username:'audit.parent.a',password})).status,200);
    const deniedDashboard=await parent('/parent/dashboard?studentId='+childB.id);
    const otherSettings=await parent('/parent/settings','POST',{studentId:childB.id,maxMinutesPerDay:99,allowedStartHour:0,allowedEndHour:24});
    assert.equal(deniedDashboard.status,403);
    assert.equal(otherSettings.status,200);
    assert.equal(otherSettings.data.maxMinutesPerDay,99);
    observations.push({case:'parent-control-authorization',engine,noPinVerificationPerformed:true,studentDashboardStatus:dashboard.status,studentSettingsStatus:altered.status,newStudentLimit:altered.data.maxMinutesPerDay,responseExposesPinHash:!!altered.data.pinHash,responseExposesPinSalt:!!altered.data.pinSalt,unlinkedParentDashboardStatus:deniedDashboard.status,unlinkedParentSettingsStatus:otherSettings.status,unlinkedParentChangedLimit:otherSettings.data.maxMinutesPerDay});
  });
}
test('AUDIT reproduction: cloud backup drops parent-child relationships',async t=>{
  const source=await createPostgresFixture(t),target=await createPostgresFixture(t,{bootstrap:false});
  const cls=await source.store.createClass(source.admin,{name:'Audit backup class',grade:3});
  const student=await source.store.createStudent(source.admin,{classId:cls.id,name:'Audit child',username:'audit.backup.child'},'fixture-hash','audit.backup.child');
  const parent=await source.store.createParent(source.admin,{name:'Audit parent',username:'audit.backup.parent',studentIds:[student.id]},'fixture-hash','audit.backup.parent');
  const parentAuth={id:parent.id,workspaceId:source.admin.workspaceId,role:'parent',username:parent.username};
  const before=await source.store.parentStudents(parentAuth);
  assert.equal(before.length,1);
  const storage={download:async()=>Buffer.alloc(0),upload:async()=>{}};
  const backup=await exportCloudBackup(source.store,storage,source.admin.workspaceId);
  await restoreCloudBackup(target.store,storage,backup);
  const after=await target.store.parentStudents(parentAuth);
  assert.equal(after.length,0);
  observations.push({case:'backup-parent-links',before:before.length,after:after.length,parentStudentsTableExported:Object.hasOwn(JSON.parse(backup.payload).tables,'parent_students')});
});
test('AUDIT reproduction: storage failure is silently exported as a valid zero-byte asset',async t=>{
  const f=await createPostgresFixture(t),bytes=await readFile('public/icons/bao-an-192.png'),mediaId='11111111-1111-4111-8111-111111111111';
  await f.store.addMedia(f.admin,{id:mediaId,name:'audit.png',mime:'image/png',bytes,objectPath:f.admin.workspaceId+'/'+mediaId});
  const storage={download:async()=>{throw new Error('Simulated storage outage');}};
  const backup=await exportCloudBackup(f.store,storage,f.admin.workspaceId);
  const payload=JSON.parse(backup.payload);
  assert.equal(payload.mediaAssets.length,1);
  assert.equal(Buffer.from(payload.mediaAssets[0].dataBase64,'base64').length,0);
  observations.push({case:'backup-swallowed-storage-failure',exportReturnedSuccess:true,tableDeclaredSize:payload.tables.media[0].size,exportedBytes:0,checksumMatches:createHash('sha256').update(backup.payload).digest('hex')===backup.checksum});
});
test('AUDIT reproduction: ready accepts base schema but new student summary requires missing migration',async t=>{
  const db=new PGlite();t.after(()=>db.close());
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated;');
  await db.exec(await readFile(new URL('../../supabase/migrations/202610150001_online.sql',import.meta.url),'utf8'));
  const store=await new PostgresStore({pool:pglitePool(db)}).ready();
  const adminUser=await store.createWorkspaceAdmin({name:'Audit base-only',username:'audit.base.admin',passwordHash:'fixture-hash'});
  const auth={id:adminUser.id,workspaceId:adminUser.workspace_id,role:'admin',username:adminUser.username};
  const cls=await store.createClass(auth,{name:'Audit base class',grade:3});
  const child=await store.createStudent(auth,{classId:cls.id,name:'Audit base child',username:'audit.base.child'},'fixture-hash','audit.base.child');
  const user=await store.findUserByUsername('audit.base.child');
  let error;
  try{await store.studentSummary({id:user.id,workspaceId:auth.workspaceId,role:'student',studentId:child.id,username:user.username});}catch(e){error=e;}
  assert.ok(error);
  observations.push({case:'missing-migrations-not-detected',readyAccepted:true,summaryFailed:true,errorMessage:error.message});
});
test('AUDIT reproduction: upgrading the old SQLite schema keeps the old users role constraint',async()=>{
  const directory=await mkdtemp(resolve('test-results','audit-legacy-sqlite-'));
  let store;
  try{
    const oldSource=execFileSync('git',['show','a6d0af1:server/online-store.mjs'],{encoding:'utf8'});
    const ddl=['workspaces','users'].map(name=>oldSource.match(new RegExp('CREATE TABLE IF NOT EXISTS '+name+'\\([^;]+;'))?.[0]);
    assert.ok(ddl.every(Boolean));
    const databasePath=resolve(directory,'old.sqlite');
    const old=new DatabaseSync(databasePath);old.exec(ddl.join('\n'));old.close();
    store=new OnlineStore(databasePath);
    const at=new Date().toISOString(),workspaceId='audit-old-workspace',adminId='audit-old-admin';
    store.db.prepare('INSERT INTO workspaces(id,name,created_at) VALUES(?,?,?)').run(workspaceId,'Old workspace',at);
    store.db.prepare("INSERT INTO users(id,workspace_id,username,password_hash,role,created_at) VALUES(?,?,?,?,'admin',?)").run(adminId,workspaceId,'audit.old.admin','fixture-hash',at);
    const admin={id:adminId,workspaceId,username:'audit.old.admin',role:'admin'};
    const cls=store.createClass(admin,{name:'Old class',grade:3});
    const child=store.createStudent(admin,{classId:cls.id,name:'Old child',username:'audit.old.child'},'fixture-hash','audit.old.child');
    let error;try{store.createParent(admin,{name:'New parent',username:'audit.old.parent',studentIds:[child.id]},'fixture-hash','audit.old.parent');}catch(e){error=e;}
    assert.match(error?.message??'',/CHECK constraint failed/);
    observations.push({case:'sqlite-upgrade-parent-role',oldCommit:'a6d0af1',startupAccepted:true,createParentFailed:true,errorMessage:error.message});
  }finally{
    store?.close();
    assert.ok(directory.startsWith(resolve('test-results')+'\\'));
    await rm(directory,{recursive:true,force:true});
  }
});

test('AUDIT reproduction: repeated new question presentations keep the authored A answer position',async()=>{
  const data=JSON.parse(await readFile('data/curriculum/hoc-ky-2-8-tuan.json','utf8'));
  const pack=data.weeks.flatMap(week=>week.packs).find(pack=>pack.kind==='quiz');
  const item=pack.items[0],orders=[];
  for(let i=0;i<12;i++){
    const session={sessionId:'audit-new-play-'+i,moduleId:'math-quest',rewardPolicyVersion:2,requiredItemIds:[item.id]};
    const opened=openProtocolQuestion(session,pack,[],item.id);
    orders.push(opened.item.options);
    assert.deepEqual(opened.item.options,item.options);
  }
  const choices=data.weeks.flatMap(week=>week.packs).flatMap(pack=>pack.items).filter(item=>Array.isArray(item.options)&&Number.isInteger(item.correctIndex));
  const correctIndexCounts={};for(const item of choices)correctIndexCounts[item.correctIndex]=(correctIndexCounts[item.correctIndex]??0)+1;
  observations.push({case:'answer-option-order',newPresentations:orders.length,distinctOptionOrders:new Set(orders.map(order=>JSON.stringify(order))).size,curriculumChoiceCount:choices.length,correctIndexCounts});
});

test.after(async()=>{
  await mkdir('test-results/danh-gia-4.0.0-2026-11-05',{recursive:true});
  await writeFile('test-results/danh-gia-4.0.0-2026-11-05/security-reproductions.json',JSON.stringify({note:'Passing audit assertions confirm unintended behavior; these are not positive product acceptance tests.',observations},null,2));
});
