import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import {execFileSync} from 'node:child_process';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {OnlineStore} from '../../server/online-store.mjs';
import {createPostgresFixture} from '../../tests/helpers/postgres-fixture.mjs';
import {exportCloudBackup,restoreCloudBackup} from '../../server/cloud-backup-restore.mjs';

const observations=[];
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
async function sqliteFixture(t){
  const store=new OnlineStore(':memory:');t.after(()=>store.close());
  const at=new Date().toISOString();
  store.db.prepare('INSERT INTO workspaces(id,name,created_at) VALUES(?,?,?)').run('audit-security-workspace','Audit only',at);
  store.db.prepare("INSERT INTO users(id,workspace_id,username,password_hash,role,created_at) VALUES(?,?,?,?,'admin',?)").run('audit-admin','audit-security-workspace','audit.admin','fixture-hash',at);
  return{store,admin:{id:'audit-admin',workspaceId:'audit-security-workspace',role:'admin',username:'audit.admin'}};
}
for(const engine of ['SQLite','PostgreSQL adapter'])test('AUDIT 4.0.1: PIN lockout bypass through setup-pin '+engine,async t=>{
  const f=engine==='SQLite'?await sqliteFixture(t):await createPostgresFixture(t);
  const cls=await f.store.createClass(f.admin,{name:'Audit class',grade:3});
  const child=await f.store.createStudent(f.admin,{classId:cls.id,name:'Audit child',username:'audit.child'},'fixture-hash','audit.child');
  const row=engine==='SQLite'?f.store.db.prepare('SELECT * FROM users WHERE username=?').get('audit.child'):await f.store.findUserByUsername('audit.child');
  const auth={id:row.id,workspaceId:f.admin.workspaceId,username:row.username,role:'student',studentId:child.id,tokenHash:'audit-session-binding'};
  await f.store.setupParentPin(f.admin,child.id,{pin:'7342'});
  for(let i=0;i<5;i++){try{await f.store.verifyParentPin(auth,child.id,'0000');}catch{}}
  let verifyError;try{await f.store.verifyParentPin(auth,child.id,'7342');}catch(e){verifyError=e;}
  assert.equal(verifyError.status,429);
  let failures=0,rateLimits=0;
  for(let i=0;i<20;i++){try{await f.store.setupParentPin(auth,child.id,{pin:'9881',oldPin:'0000'});}catch(e){if(e.status===403)failures++;if(e.status===429)rateLimits++;}}
  assert.equal(failures,20);assert.equal(rateLimits,0);
  const changed=await f.store.setupParentPin(auth,child.id,{pin:'9881',oldPin:'7342'});
  assert.equal(changed.success,true);
  observations.push({case:'pin-lock-bypass-via-oldPin',engine,verifyCorrectPinWhileLockedStatus:verifyError.status,setupWrongOldPinAttempts:20,wrongOldPinDenied:failures,setupRateLimits:rateLimits,setupCorrectOldPinDuringLockSucceeded:changed.success});
});

test('AUDIT 4.0.1: restore upload failure happens after target SQL is committed',async t=>{
 const source=await createPostgresFixture(t);
 const bytes=await readFile('public/icons/bao-an-192.png');
 const objectPath=source.admin.workspaceId+'/audit-icon';
 await source.store.addMedia(source.admin,{id:'audit-icon',name:'audit.png',mime:'image/png',bytes,objectPath});
 const backup=await exportCloudBackup(source.store,{download:async()=>bytes},source.admin.workspaceId);
 const target=await createPostgresFixture(t,{bootstrap:false});
 const uploads=new Map();const goodStorage={upload:async(p,b)=>uploads.set(p,b)};
 await restoreCloudBackup(target.store,goodStorage,backup);
 await target.store.exec('UPDATE bao_an.workspaces SET name=$2 WHERE id=$1',[source.admin.workspaceId,'TARGET NEWER DATA']);
 const before=(await target.store.one('SELECT name FROM bao_an.workspaces WHERE id=$1',[source.admin.workspaceId])).name;
 let failure;try{await restoreCloudBackup(target.store,{upload:async()=>{throw new Error('AUDIT injected storage outage');}},backup);}catch(e){failure=e;}
 assert.match(failure?.message??'',/AUDIT injected storage outage/);
 const after=(await target.store.one('SELECT name FROM bao_an.workspaces WHERE id=$1',[source.admin.workspaceId])).name;
 assert.notEqual(after,before);
 observations.push({case:'restore-nonatomic-storage-failure',error:failure.message,targetWorkspaceNameBefore:before,targetWorkspaceNameAfter:after,sqlChangedDespiteFailure:true});
});

test('AUDIT 4.0.1: dry-run and restore accept missing media uploader',async t=>{
 const source=await createPostgresFixture(t);
 const bytes=await readFile('public/icons/bao-an-192.png');
 await source.store.addMedia(source.admin,{id:'audit-no-uploader',name:'audit.png',mime:'image/png',bytes,objectPath:source.admin.workspaceId+'/audit-no-uploader'});
 const backup=await exportCloudBackup(source.store,{download:async()=>bytes},source.admin.workspaceId);
 const target=await createPostgresFixture(t,{bootstrap:false});
 const dryRun=await restoreCloudBackup(target.store,null,backup,{dryRun:true});
 const result=await restoreCloudBackup(target.store,null,backup);
 assert.equal(dryRun.valid,true);assert.equal(result.success,true);assert.equal(result.mediaHashMatch,true);assert.equal(result.mediaRestored,1);
 observations.push({case:'restore-false-success-without-storage',dryRunValid:dryRun.valid,storageUploaderPresent:false,reportedSuccess:result.success,reportedMediaRestored:result.mediaRestored,reportedMediaHashMatch:result.mediaHashMatch});
});

test('AUDIT 4.0.1: dry-run accepts corrupt media with valid envelope checksum',async t=>{
 const f=await createPostgresFixture(t);
 const payload=JSON.stringify({workspaceId:f.admin.workspaceId,tables:{},mediaAssets:[{id:'audit-corrupt',objectPath:f.admin.workspaceId+'/audit-corrupt',mime:'image/png',size:10,sha256:hash(Buffer.from('expected bytes')),dataBase64:Buffer.from('wrong').toString('base64')}]});
 const backup={version:1,payload,checksum:hash(payload),tableCounts:{},mediaCount:1};
 const result=await restoreCloudBackup(f.store,{},backup,{dryRun:true});
 assert.equal(result.valid,true);
 observations.push({case:'restore-dry-run-incomplete-validation',missingRequiredTables:true,corruptMedia:true,reportedValid:result.valid});
});

test('AUDIT 4.0.1: SQLite migration fails silently on restart after an interrupted table-copy step',async()=>{
 const root=resolve('test-results/audit-2026-11-06');await mkdir(root,{recursive:true});
 const directory=await mkdtemp(join(root,'sqlite-interrupted-'));let store;
 try{
  const oldSource=execFileSync('git',['show','a6d0af1:server/online-store.mjs'],{encoding:'utf8'});
  const ddl=['workspaces','users'].map(name=>oldSource.match(new RegExp('CREATE TABLE IF NOT EXISTS '+name+'\\([^;]+;'))?.[0]);
  const file=join(directory,'legacy.sqlite'),db=new DatabaseSync(file);db.exec(ddl.join('\n'));
  db.exec("INSERT INTO workspaces(id,name,created_at) VALUES('audit-legacy','Audit legacy','2026-11-06'); CREATE TABLE users_upgrade_v4(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL REFERENCES workspaces(id),username TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('admin','student','parent')),student_id TEXT,active INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL);");
  db.close();
  store=new OnlineStore(file);
  let error;try{store.db.prepare("INSERT INTO users(id,workspace_id,username,password_hash,role,created_at) VALUES('audit-parent','audit-legacy','audit.parent','fixture-hash','parent','2026-11-06')").run();}catch(e){error=e;}
  assert.match(error?.message??'',/CHECK constraint failed/);
  observations.push({case:'sqlite-interrupted-migration-silent-failure',simulatedInterruption:'After users_upgrade_v4 CREATE and before INSERT/DROP',startupAccepted:true,legacyRoleConstraintRemains:true,createParentError:error.message});
 }finally{store?.close();assert.ok(directory.startsWith(root+'\\'));await rm(directory,{recursive:true,force:true});}
});

test('AUDIT 4.0.1: backup export can mix snapshots across a concurrent committed write',async t=>{
 const source=await createPostgresFixture(t);
 const cls=await source.store.createClass(source.admin,{name:'Audit snapshot class',grade:3});
 const child=await source.store.createStudent(source.admin,{classId:cls.id,name:'Audit snapshot child',username:'audit.snapshot.child'},'fixture-hash','audit.snapshot.child');
 const store=Object.create(source.store);let inserted=false;
 store.rows=async(sql,params)=>{
  const rows=await source.store.rows(sql,params);
  if(sql.includes('FROM bao_an.plays WHERE')&&!inserted){
   inserted=true;
   await source.store.transaction(async client=>{
    await source.store.exec('INSERT INTO bao_an.plays(id,workspace_id,student_id,request_id,json) VALUES($1,$2,$3,$4,$5::jsonb)',['audit-concurrent-play',source.admin.workspaceId,child.id,'audit-concurrent-request',JSON.stringify({sessionId:'audit-concurrent-play',startedAt:new Date().toISOString()})],client);
    await source.store.exec('INSERT INTO bao_an.attempts(workspace_id,play_id,attempt_key,payload_hash,json,sequence) VALUES($1,$2,$3,$4,$5::jsonb,1)',[source.admin.workspaceId,'audit-concurrent-play','audit-concurrent-attempt','audit-payload-hash',JSON.stringify({itemId:'audit-item',correct:true})],client);
   });
  }
  return rows;
 };
 const backup=await exportCloudBackup(store,{download:async()=>Buffer.alloc(0)},source.admin.workspaceId);
 const payload=JSON.parse(backup.payload);
 assert.equal(payload.tables.plays.length,0);assert.equal(payload.tables.attempts.length,1);
 const target=await createPostgresFixture(t,{bootstrap:false});let error;
 try{await restoreCloudBackup(target.store,{upload:async()=>{}},backup);}catch(e){error=e;}
 assert.ok(error);
 observations.push({case:'backup-read-snapshot-race',committedSourceWrite:true,exportedPlays:payload.tables.plays.length,exportedAttempts:payload.tables.attempts.length,exportReportedChecksumValid:hash(backup.payload)===backup.checksum,restoreFailed:true,errorMessage:error.message});
});

test.after(async()=>{await mkdir('test-results/audit-2026-11-06',{recursive:true});await writeFile('test-results/audit-2026-11-06/security-reproductions-401.json',JSON.stringify({note:'Passing audit assertions confirm unwanted behavior, not acceptance.',observations},null,2));});
