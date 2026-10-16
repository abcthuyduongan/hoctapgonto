import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID,createHash,scryptSync} from 'node:crypto';
import {mkdtemp,mkdir,readFile,writeFile,copyFile,readdir,rm,access} from 'node:fs/promises';
import {join,resolve,dirname,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {once} from 'node:events';
import {spawnSync} from 'node:child_process';
import {OnlineStore} from '../server/online-store.mjs';
import {createOnlineServer} from '../server/online-server.mjs';
import {inspectOnlineBackup,snapshotOnlineDatabase,restoreOnlineDatabase} from '../server/online-recovery.mjs';
import {waveFixture} from './helpers/media-fixture.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),resultRoot=join(root,'test-results');
const password='Recovery-test-password-2026!',setupToken='recovery-test-bootstrap-token-2026';
const hash=value=>createHash('sha256').update(value).digest('hex');
const passwordHash=(()=>{const salt='recovery-fixture-salt';return`${salt}:${scryptSync(password,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024}).toString('hex')}`;})();
async function fixture(t){
  await mkdir(resultRoot,{recursive:true});const directory=await mkdtemp(join(resultRoot,'online-recovery-')),databasePath=join(directory,'source','bao-an.sqlite'),staticRoot=join(directory,'app');
  await mkdir(staticRoot);await writeFile(join(staticRoot,'index.html'),'<!doctype html><title>Recovery fixture</title>');
  let store=new OnlineStore(databasePath),server;
  const workspaceId=randomUUID(),adminId=randomUUID(),at=new Date().toISOString();
  store.db.prepare('INSERT INTO workspaces(id,name,created_at) VALUES(?,?,?)').run(workspaceId,'Kho thử phục hồi',at);
  store.db.prepare("INSERT INTO users(id,workspace_id,username,password_hash,role,created_at) VALUES(?,?,?,?,'admin',?)").run(adminId,workspaceId,'manager',passwordHash,at);
  const admin={id:adminId,workspaceId,username:'manager',role:'admin'},classroom=store.createClass(admin,{name:'Lớp cần giữ nguyên',grade:3});
  const student=store.createStudent(admin,{classId:classroom.id,name:'An',username:'learner'},passwordHash,'learner'),studentRow=store.db.prepare("SELECT * FROM users WHERE username='learner'").get(),learner={id:studentRow.id,workspaceId,username:'learner',role:'student',studentId:student.id};
  const png=await readFile(join(root,'public','icons','bao-an-192.png')),wav=waveFixture();
  const image=store.uploadMedia(admin,{name:'recovery-image.png',mime:'image/png',base64:png.toString('base64')}),audio=store.uploadMedia(admin,{name:'recovery-audio.wav',mime:'audio/wav',base64:wav.toString('base64')});
  const pack={id:'recovery-questions',version:1,title:'Bộ cần phục hồi',subject:'thinking',grade:3,source:'local',publishedAt:at,kind:'pairs',items:[['Cây cần gì?','Ánh sáng'],['Nước đông thành gì?','Nước đá'],['Con gì có cánh?','Chim'],['Hành tinh chúng ta sống?','Trái Đất']].map(([left,right],index)=>({id:`restore-item-${index}`,kind:'pair',objectiveId:'RECOVERY.PRACTICE',left,right,...(index===0?{media:{imageId:image.id,imageAlt:'Hình khu vườn',audioId:audio.id,audioTranscript:'Hello. My name is Lucy. I am nine.'}}:{})}))};
  const week=store.publishWeek(admin,{requestId:'recovery-week',title:'Tuần phục hồi',classId:classroom.id,sets:[{subjectLabel:'Tự nhiên do tác giả đặt',pack}]});
  const play=store.startPlay(learner,{requestId:'completed-play',moduleId:'math-quest',packId:pack.id,contentVersion:1});
  for(const item of play.presentation.items)store.attempt(learner,play.session.sessionId,{attemptKey:`answer-${item.id}`,itemId:item.id,response:{kind:'choice',choiceIndex:item.correctIndex},hintsUsed:0,elapsedMs:100});
  store.finishPlay(learner,play.session.sessionId);store.configureWallet(admin,{enabled:true,rateVnd:1000});
  const request=store.requestReward(learner,{requestId:'retained-wish',title:'Hộp bút',goalVnd:2000});store.transitionReward(admin,request.requestId,{status:'approved',note:'Chờ trao'});
  const active=store.startPlay(learner,{requestId:'active-play',moduleId:'math-quest',packId:pack.id,contentVersion:1});
  store.attempt(learner,active.session.sessionId,{attemptKey:'pending-answer',itemId:active.presentation.items[0].id,response:{kind:'choice',choiceIndex:active.presentation.items[0].correctIndex},hintsUsed:0,elapsedMs:100});
  const oldToken='old-restored-cookie-token';store.db.prepare('INSERT INTO auth_sessions VALUES(?,?,?,?)').run(hash(oldToken),learner.id,'old-csrf-token',Date.now()+600000);
  t.after(async()=>{
    if(server){await new Promise((done,reject)=>server.close(error=>error?reject(error):done()));server.onlineClose();server=undefined;}
    store?.close();const absolute=resolve(directory);assert.equal(dirname(absolute),resolve(resultRoot));assert.match(basename(absolute),/^online-recovery-/);await rm(absolute,{recursive:true,force:true});
  });
  return{directory,databasePath,staticRoot,admin,learner,classroom,week,request,image,audio,png,wav,oldToken,
    store:()=>store,setStore:value=>{store=value;},closeStore(){store?.close();store=undefined;},
    async start(path=databasePath){store?.close();store=undefined;server=createOnlineServer({databasePath:path,staticRoot,setupToken,secureCookies:false});server.listen(0,'127.0.0.1');await once(server,'listening');return`http://127.0.0.1:${server.address().port}`;},
    async stop(){await new Promise((done,reject)=>server.close(error=>error?reject(error):done()));server.onlineClose();server=undefined;},
    database:()=>server.onlineStore.db,
  };
}
class Client{
  constructor(origin){this.origin=origin;this.cookie='';this.csrf='';}
  async call(route,{method='GET',body,csrf=this.csrf,binary=false}={}){
    const mutable=method!=='GET',response=await fetch(`${this.origin}/api/online${route}`,{method,headers:{...(this.cookie?{Cookie:this.cookie}:{}),...(mutable?{Origin:this.origin,'Content-Type':'application/json',...(csrf?{'X-CSRF-Token':csrf}:{})}:{})},...(mutable?{body:JSON.stringify(body??{})}:{})});
    assert.match(response.headers.get('cache-control')??'',/no-store/);const cookies=response.headers.getSetCookie();if(cookies.length)this.cookie=cookies.map(value=>value.split(';',1)[0]).join('; ');
    const data=binary&&response.ok?Buffer.from(await response.arrayBuffer()):await response.json();if(data.csrfToken)this.csrf=data.csrfToken;return{status:response.status,headers:response.headers,data};
  }
  async ok(route,options){const result=await this.call(route,options);assert.ok(result.status>=200&&result.status<300,`${route}: ${result.status} ${JSON.stringify(result.data)}`);return result.data;}
}
async function login(client,username){return client.ok('/login',{method:'POST',body:{username,password}});}

test('recovery CLI previews without writing, restores into a clean directory and boots through real HTTP after restart',async t=>{
  const f=await fixture(t),snapshot=join(f.directory,'snapshot.sqlite'),preview=await snapshotOnlineDatabase(f.store().db,snapshot);f.closeStore();
  assert.equal(preview.activePlays,1);assert.equal(preview.sessionsToRevoke,1);assert.equal(preview.counts.media,2);
  const clean=join(f.directory,'clean-restored'),cli=join(root,'server','restore-online.mjs');
  const view=spawnSync(process.execPath,['--experimental-strip-types',cli,'--file',snapshot,'--data-dir',clean],{cwd:root,encoding:'utf8',windowsHide:true});
  assert.equal(view.status,0,view.stderr);const shown=JSON.parse(view.stdout);assert.equal(shown.mode,'PREVIEW_ONLY');assert.equal(shown.sha256,preview.sha256);assert.equal(shown.workspaceIds,undefined);assert.ok(!view.stdout.includes(passwordHash));
  await assert.rejects(access(join(clean,'bao-an.sqlite')),{code:'ENOENT'});
  const restored=spawnSync(process.execPath,['--experimental-strip-types',cli,'--file',snapshot,'--data-dir',clean,'--confirm',preview.sha256],{cwd:root,encoding:'utf8',windowsHide:true});
  assert.equal(restored.status,0,restored.stderr);assert.equal(JSON.parse(restored.stdout).preBackupCreated,false);
  const target=join(clean,'bao-an.sqlite'),origin=await f.start(target),old=new Client(origin);old.cookie=`baoan_online_session=${f.oldToken}`;
  assert.equal((await old.call('/student')).status,401);
  const manager=new Client(origin),learner=new Client(origin);await login(manager,'manager');await login(learner,'learner');
  let state=await learner.ok('/student');assert.deepEqual(state.balance,{earned:3,available:1,pending:2,redeemed:0});assert.equal(state.requests[0].history.at(-1).status,'approved');assert.equal(state.weeks[0].id,f.week.id);
  assert.equal(f.database().prepare("SELECT count(*) AS n FROM plays WHERE json_extract(json,'$.status')='active'").get().n,0);
  const media=await learner.call(`/media/${f.image.id}`,{binary:true});assert.deepEqual(media.data,f.png);
  assert.equal(f.database().prepare('PRAGMA integrity_check').get().integrity_check,'ok');
  await f.stop();const restarted=await f.start(target),again=new Client(restarted);await login(again,'learner');state=await again.ok('/student');assert.equal(state.wallet.rateVnd,1000);assert.equal(state.balance.earned,3);
});

test('recovery rejects altered schema, broken links, changed media and changed preview hashes without overwriting data',async t=>{
  const f=await fixture(t),snapshot=join(f.directory,'snapshot.sqlite'),preview=await snapshotOnlineDatabase(f.store().db,snapshot);
  for(const[kind,change]of[
    ['trigger',db=>db.exec('CREATE TRIGGER hostile_restore AFTER DELETE ON auth_sessions BEGIN DELETE FROM users; END;')],
    ['foreign-key',db=>db.exec("PRAGMA foreign_keys=OFF; UPDATE students SET class_id='missing-class';")],
    ['media',db=>db.prepare('UPDATE media SET bytes=? WHERE id=?').run(Buffer.from('changed bytes'),f.image.id)],
    ['version',db=>db.exec('UPDATE schema_version SET version=2;')],
    ['stars',db=>db.exec('UPDATE awards SET tier=1;')],
  ]){
    const damaged=join(f.directory,`damaged-${kind}.sqlite`);await copyFile(snapshot,damaged);const db=new DatabaseSync(damaged);try{change(db);}finally{db.close();}
    assert.throws(()=>inspectOnlineBackup(damaged),error=>error.status===400,kind);
    await assert.rejects(restoreOnlineDatabase({databasePath:f.databasePath,backupPath:damaged,expectedSha256:preview.sha256,database:f.store().db}),error=>[400,409].includes(error.status));
    assert.equal(f.store().workspace(f.admin.workspaceId).rate_vnd,1000);
  }
  await assert.rejects(restoreOnlineDatabase({databasePath:f.databasePath,backupPath:snapshot,expectedSha256:'0'.repeat(64),database:f.store().db}),error=>error.status===409);
  assert.equal(f.store().db.prepare('SELECT count(*) AS n FROM auth_sessions').get().n,1);
});

test('recovery rolls back a failed atomic install and keeps a verified pre-restore snapshot',async t=>{
  const f=await fixture(t),snapshot=join(f.directory,'old.sqlite'),preview=await snapshotOnlineDatabase(f.store().db,snapshot);
  f.store().configureWallet(f.admin,{enabled:true,rateVnd:5000});
  await assert.rejects(restoreOnlineDatabase({databasePath:f.databasePath,backupPath:snapshot,expectedSha256:preview.sha256,database:f.store().db,
    closeDatabase:()=>f.closeStore(),reopenDatabase:()=>f.setStore(new OnlineStore(f.databasePath)),beforeInstall:()=>{throw new Error('Simulated rename failure');}}),error=>error.status===500);
  assert.equal(f.store().workspace(f.admin.workspaceId).rate_vnd,5000);assert.equal(f.store().db.prepare('SELECT count(*) AS n FROM auth_sessions').get().n,1);
  const files=await readdir(join(dirname(f.databasePath),'backups'));assert.equal(files.length,1);assert.equal(inspectOnlineBackup(join(dirname(f.databasePath),'backups',files[0])).counts.students,1);
  await assert.rejects(access(f.databasePath+'.restore-journal.json'),{code:'ENOENT'});
});

test('recovery HTTP requires an explicit session-bound preview and restores live data with all sessions revoked',async t=>{
  const f=await fixture(t),origin=await f.start(),manager=new Client(origin),learner=new Client(origin);await login(manager,'manager');await login(learner,'learner');
  assert.equal((await manager.ok('/recovery')).supported,true);
  assert.equal((await new Client(origin).call('/backup',{method:'POST'})).status,401);
  assert.equal((await learner.call('/backup',{method:'POST'})).status,403);
  assert.equal((await manager.call('/backup',{method:'POST',csrf:null})).status,403);
  const downloaded=await manager.call('/backup',{method:'POST',binary:true});assert.equal(downloaded.status,200);assert.equal(downloaded.headers.get('content-type'),'application/vnd.sqlite3');assert.equal(hash(downloaded.data),downloaded.headers.get('x-backup-sha256'));
  const file=join(f.directory,'download.sqlite');await writeFile(file,downloaded.data);assert.equal(inspectOnlineBackup(file).counts.media,2);
  const blocked=spawnSync(process.execPath,['--experimental-strip-types',join(root,'server','restore-online.mjs'),'--file',file,'--data-dir',dirname(f.databasePath),'--confirm',hash(downloaded.data)],{cwd:root,encoding:'utf8',windowsHide:true});assert.equal(blocked.status,1);assert.match(blocked.stderr,/đang được/);
  await manager.ok('/wallet',{method:'POST',body:{enabled:true,rateVnd:5000}});await manager.ok('/classes',{method:'POST',body:{name:'Sau bản sao',grade:3}});
  const preview=await manager.ok('/restore/preview',{method:'POST',body:{base64:downloaded.data.toString('base64')}});assert.equal(preview.counts.classes,1);assert.equal(preview.counts.media,2);assert.equal(preview.workspaceIds,undefined);assert.ok(!JSON.stringify(preview).includes(passwordHash));
  assert.equal((await manager.call('/restore/commit',{method:'POST',body:{restoreToken:preview.restoreToken,sha256:preview.sha256,confirm:false}})).status,400);
  assert.equal((await manager.call('/restore/commit',{method:'POST',body:{restoreToken:preview.restoreToken,sha256:'0'.repeat(64),confirm:true}})).status,409);
  const otherSession=new Client(origin);await login(otherSession,'manager');assert.equal((await otherSession.call('/restore/commit',{method:'POST',body:{restoreToken:preview.restoreToken,sha256:preview.sha256,confirm:true}})).status,403);
  const restored=await manager.ok('/restore/commit',{method:'POST',body:{restoreToken:preview.restoreToken,sha256:preview.sha256,confirm:true}});assert.equal(restored.restored,true);assert.equal(restored.reauthenticate,true);assert.equal(restored.preBackupCreated,true);assert.equal(restored.preBackupPath,undefined);
  assert.equal((await learner.call('/student')).status,401);assert.equal((await otherSession.call('/me')).status,401);
  const currentManager=new Client(origin),currentLearner=new Client(origin);await login(currentManager,'manager');await login(currentLearner,'learner');
  assert.equal((await currentManager.ok('/dashboard')).classes.length,1);const state=await currentLearner.ok('/student');assert.equal(state.wallet.rateVnd,1000);assert.equal(state.balance.pending,2);
  assert.equal(f.database().prepare("SELECT count(*) AS n FROM plays WHERE json_extract(json,'$.status')='active'").get().n,0);
  assert.deepEqual((await currentLearner.call(`/media/${f.audio.id}`,{binary:true})).data,f.wav);
  assert.equal((await currentManager.call('/restore/preview',{method:'POST',body:{base64:Buffer.from('not sqlite').toString('base64')}})).status,400);
  assert.equal((await currentManager.ok('/dashboard')).classes.length,1);
});

test('recovery startup rolls back an interrupted rename journal before opening the database',async t=>{
  const f=await fixture(t);f.closeStore();const parent=dirname(f.databasePath),folder=await mkdtemp(join(parent,'.bao-an-recovery-'));
  await copyFile(f.databasePath,join(folder,'previous.sqlite'));await writeFile(f.databasePath,Buffer.from('interrupted invalid candidate'));
  await writeFile(f.databasePath+'.restore-journal.json',JSON.stringify({target:resolve(f.databasePath),folder,hadOriginal:true}));
  const origin=await f.start(),manager=new Client(origin);await login(manager,'manager');assert.equal((await manager.ok('/dashboard')).classes[0].name,'Lớp cần giữ nguyên');
  await assert.rejects(access(folder),{code:'ENOENT'});await assert.rejects(access(f.databasePath+'.restore-journal.json'),{code:'ENOENT'});
});
