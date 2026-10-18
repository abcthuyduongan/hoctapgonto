import {threeSubjectSets} from './helpers/planned-weeks.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {randomUUID,createHash} from 'node:crypto';
import {once} from 'node:events';
import {access,mkdir,readFile,readdir,rm,stat,writeFile} from 'node:fs/promises';
import {createServer} from 'node:net';
import {dirname,isAbsolute,join,relative,resolve,sep} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {setTimeout as delay} from 'node:timers/promises';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {unzipSync} from 'fflate';
import {packageRelease,RELEASE_VERSION} from '../tools/package_release.mjs';
import {isBuiltin} from 'node:module';
import {waveFixture} from './helpers/media-fixture.mjs';

const workspace=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const results=join(workspace,'test-results');
const managerPassword='Package-manager-test-2026!';
const studentPassword='Package-student-test-2026!';
const inside=(root,file)=>{const path=relative(root,file);return path===''||!isAbsolute(path)&&path!=='..'&&!path.startsWith(`..${sep}`);};

async function unusedPort(){
  const socket=createServer();socket.listen(0,'127.0.0.1');await once(socket,'listening');const port=socket.address().port;
  await new Promise((done,reject)=>socket.close(error=>error?reject(error):done()));return port;
}
function runNode(file,{cwd,env,args=[]}){
  const child=spawn(process.execPath,[file,...args],{cwd,env,windowsHide:true,stdio:['ignore','pipe','pipe']});
  let output='',stdout='',launchError;
  child.stdout.on('data',part=>{stdout=(stdout+part.toString()).slice(-64*1024);});
  for(const pipe of [child.stdout,child.stderr])pipe.on('data',part=>{output=(output+part.toString()).slice(-64*1024);});
  child.once('error',error=>{launchError=error;});
  return {child,output:()=>output,stdout:()=>stdout,error:()=>launchError};
}
async function ended(processState,timeout=7000){
  if(processState.child.exitCode!==null||processState.child.signalCode!==null)return;
  const timer=delay(timeout,undefined,{ref:false}).then(()=>{throw new Error(`Packaged process did not exit: ${processState.output()}`);});
  await Promise.race([once(processState.child,'exit'),timer]);
}
async function stop(processState){
  if(!processState||processState.child.exitCode!==null||processState.child.signalCode!==null)return;
  processState.child.kill('SIGTERM');await ended(processState);
}
async function waitReady(processState,origin){
  const until=Date.now()+15000;
  while(Date.now()<until){
    if(processState.error())throw processState.error();
    if(processState.child.exitCode!==null||processState.child.signalCode!==null)throw new Error(`Packaged server exited before readiness: ${processState.output()}`);
    try{const response=await fetch(`${origin}/api/online/status`,{signal:AbortSignal.timeout(500)});if(response.ok)return await response.json();}catch{}
    await delay(30);
  }
  throw new Error(`Packaged server did not become ready: ${processState.output()}`);
}
class Client{
  constructor(origin){this.origin=origin;this.cookie='';this.csrf='';}
  async call(route,{method='GET',body}={}){
    const mutation=method!=='GET',response=await fetch(`${this.origin}/api/online${route}`,{method,redirect:'manual',signal:AbortSignal.timeout(5000),
      headers:{'X-Bao-An-Question-Protocol':'1',...(this.cookie?{Cookie:this.cookie}:{}),...(mutation?{'Content-Type':'application/json',Origin:this.origin,...(this.csrf?{'X-CSRF-Token':this.csrf}:{})}:{})},
      ...(mutation?{body:JSON.stringify(body??{})}:{})});
    assert.match(response.headers.get('content-type')??'',/application\/json/i);
    assert.match(response.headers.get('cache-control')??'',/no-store/i);
    const cookies=response.headers.getSetCookie();if(cookies.length)this.cookie=cookies.map(value=>value.split(';',1)[0]).join('; ');
    const result=await response.json();assert.ok(response.ok,`${method} ${route}: ${response.status} ${JSON.stringify(result)}`);
    if(result.csrfToken)this.csrf=result.csrfToken;return result;
  }
}
function quiz(){return {id:'packaged-author-questions',version:1,title:'Nội dung tự soạn trong ZIP',subject:'thinking',grade:4,source:'local',publishedAt:'2026-10-15T00:00:00.000Z',kind:'quiz',items:[
  {id:'packaged-q1',objectiveId:'AUTHOR.CUSTOM',kind:'multiple-choice',prompt:'Câu do tác giả đặt thứ nhất?',options:['Mây','Gió','Nắng','Mưa'],correctIndex:2,explanation:'Đáp án của tác giả là Nắng.'},
  {id:'packaged-q2',objectiveId:'AUTHOR.CUSTOM',kind:'multiple-choice',prompt:'Câu do tác giả đặt thứ hai?',options:['Hoa','Lá','Cành','Rễ'],correctIndex:1,explanation:'Đáp án của tác giả là Lá.'},
]};}
async function builtinOnly(file){
  const source=await readFile(file,'utf8');
  const result=await build({stdin:{contents:source,sourcefile:file,resolveDir:dirname(file)},bundle:true,packages:'external',platform:'node',format:'esm',write:false,metafile:true,logLevel:'silent'});
  const imports=Object.values(result.metafile.outputs).flatMap(output=>output.imports);
  assert.ok(imports.length>0,`${file} exposes its builtin runtime imports`);
  for(const entry of imports)assert.ok(entry.external&&isBuiltin(entry.path),`${file} must not depend on an installed runtime package: ${entry.path}`);
  assert.doesNotMatch(source,/\bimport\s*\(\s*[^'"\s]/,'Runtime imports cannot be computed package names.');
}

test('actual pilot ZIP runs a standalone local manager from an extracted Unicode folder and preserves data and backups', {timeout:60000}, async t=>{
  await mkdir(results,{recursive:true});
  const fixtureRoot=join(results,`online-package-${randomUUID()}`),root=join(fixtureRoot,'Bản đóng gói có dấu và khoảng trắng');
  const dist=join(root,'PWA tối giản'),output=join(root,'Thư mục ZIP gốc'),extract=join(root,'Giải nén sạch');
  await mkdir(join(dist,'assets'),{recursive:true});await mkdir(extract,{recursive:true});
  const html='<!doctype html><html lang="vi"><meta charset="utf-8"><title>Gói thử Bảo An</title><main>Ứng dụng thử độc lập</main></html>';
  await writeFile(join(dist,'index.html'),html);
  await writeFile(join(dist,'sw.js'),'const BUILD_ID="0123456789abcdef";\nself.addEventListener("fetch",()=>{});');
  await writeFile(join(dist,'manifest.webmanifest'),'{"name":"Bảo An gói thử","start_url":"/"}');
  await writeFile(join(dist,'assets','tiny.js'),'document.documentElement.dataset.packaged="yes";');
  let running;
  t.after(async()=>{
    await stop(running);
    const absolute=resolve(fixtureRoot);assert.equal(dirname(absolute),resolve(results));assert.match(absolute.split(sep).at(-1),/^online-package-[a-f0-9-]+$/);
    assert.ok(inside(workspace,absolute));await rm(absolute,{recursive:true,force:true});
  });
  const packaged=await packageRelease({distDir:dist,outputRoot:output}),archive=unzipSync(await readFile(packaged.zipPath));
  const prefix=`bao-an-learning-${RELEASE_VERSION}/`;
  for(const [name,bytes] of Object.entries(archive)){
    assert.ok(name.startsWith(prefix));const destination=resolve(extract,...name.slice(prefix.length).split('/'));
    assert.ok(inside(extract,destination)&&destination!==extract);await mkdir(dirname(destination),{recursive:true});await writeFile(destination,bytes);
  }
  const manifest=JSON.parse(await readFile(join(extract,'release.json'),'utf8'));
  for(const file of manifest.files){const bytes=await readFile(join(extract,...file.path.split('/')));assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256);}
  await t.test('extracted bundle has only builtin imports and needs no npm install or source checkout',async()=>{
    const notices=await readFile(join(extract,'THIRD_PARTY_NOTICES.txt'),'utf8');
    assert.match(notices,/===== music-metadata@[^\n]+ \(MIT\) =====/);
    assert.match(notices,/===== ieee754@[^\n]+ \(BSD-3-Clause\) =====/);
    for(const filename of ['music-metadata/LICENSE.txt','ieee754/LICENSE'])assert.ok(notices.includes((await readFile(join(workspace,'node_modules',...filename.split('/')),'utf8')).trim()),`Full license must be distributed: ${filename}`);
    assert.ok(manifest.files.some(file=>file.path==='THIRD_PARTY_NOTICES.txt'));
    for(const file of ['online-local.mjs','backup-online.mjs','restore-online.mjs','serve_release.mjs'])await builtinOnly(join(extract,file));
    for(const missing of ['node_modules','package.json','server','src'])await assert.rejects(access(join(extract,missing)),{code:'ENOENT'});
    const start=await readFile(join(extract,'MO_QUAN_LY.cmd'),'utf8'),backup=await readFile(join(extract,'SAO_LUU_QUAN_LY.cmd'),'utf8');
    assert.match(start,/node\.exe "%~dp0online-local\.mjs"/);assert.match(start,/BAO_AN_STATIC_DIR=%~dp0app/);assert.match(start,/BAO_AN_DATA_DIR=%~dp0data/);
    assert.match(backup,/node\.exe "%~dp0backup-online\.mjs"/);assert.doesNotMatch(start+backup,/\bnpm\b|npm install/i);
  });
  const port=await unusedPort(),origin=`http://127.0.0.1:${port}`,env={...process.env};
  for(const key of Object.keys(env))if(key.startsWith('BAO_AN_')||['NODE_PATH','NODE_OPTIONS'].includes(key))delete env[key];
  Object.assign(env,{BAO_AN_HOST:'127.0.0.1',BAO_AN_PORT:String(port),BAO_AN_STATIC_DIR:'app',BAO_AN_DATA_DIR:'data',NODE_PATH:''});
  async function start(){running=runNode(join(extract,'online-local.mjs'),{cwd:extract,env});return waitReady(running,origin);}
  assert.deepEqual(await start(),{available:true,configured:false,runtimeVersion:RELEASE_VERSION,questionProtocolVersion:1});
  const token=(await readFile(join(extract,'data','bootstrap-token.txt'),'utf8')).trim();assert.ok(token.length>=24);
  assert.ok((await stat(join(extract,'data','bao-an.sqlite'))).isFile());
  const manager=new Client(origin),learner=new Client(origin);
  let classroom,student,week,request,beforeRestart;
  await t.test('standalone executable serves the fixture app and handles setup, accounts, wallet and question publication through HTTP',async()=>{
    const page=await fetch(`${origin}/?online=1`);assert.equal(page.status,200);assert.equal(await page.text(),html);
    const asset=await fetch(`${origin}/assets/tiny.js`);assert.equal(asset.status,200);assert.match(await asset.text(),/packaged/);
    const identity=await manager.call('/setup',{method:'POST',body:{token,name:'Đơn vị từ gói giải nén',username:'packaged-manager',password:managerPassword}});assert.equal(identity.user.role,'admin');
    classroom=await manager.call('/classes',{method:'POST',body:{name:'Lớp học trong gói thử',grade:4}});
    const created=await manager.call('/students',{method:'POST',body:{classId:classroom.id,name:'Học sinh gói thử',username:'packaged-student',password:studentPassword}});student=created.student;
    await manager.call('/wallet',{method:'POST',body:{enabled:true,rateVnd:2500}});
    week=await manager.call('/weeks',{method:'POST',body:{requestId:'packaged-week',classId:classroom.id,title:'Tuần giữ nguyên sau khởi động lại',sets:threeSubjectSets([{subjectLabel:'Môn do người soạn tự đặt',pack:quiz()}])}});
    assert.equal(week.sets[0].pack.items.length,2);assert.equal(week.sets[0].subjectLabel,'Môn do người soạn tự đặt');
    await learner.call('/login',{method:'POST',body:{username:'packaged-student',password:studentPassword}});
    const state=await learner.call('/student');assert.equal(state.student.id,student.id);assert.equal(state.current.pack.id,quiz().id);assert.equal(state.wallet.rateVnd,2500);
  });
  await t.test('real packaged gameplay awards stars and records a manager-approved redemption',async()=>{
    const play=await learner.call('/play',{method:'POST',body:{requestId:'packaged-play',moduleId:'math-quest',packId:quiz().id,contentVersion:1}});
    assert.equal(JSON.stringify(play).includes('correctIndex'),false);
    for(const item of play.presentation.items){await learner.call(`/play/${play.session.sessionId}/question-open`,{method:'POST',body:{itemId:item.id}});await learner.call(`/play/${play.session.sessionId}/attempt`,{method:'POST',body:{attemptKey:`answer-${item.id}`,itemId:item.id,response:{kind:'choice',choiceIndex:quiz().items.find(q=>q.id===item.id).correctIndex},hintsUsed:0,elapsedMs:250}});}
    const complete=await learner.call(`/play/${play.session.sessionId}/complete`,{method:'POST'});assert.equal(complete.gained,3);
    request=await learner.call('/redemptions',{method:'POST',body:{requestId:'packaged-wish',title:'Hộp bút tự chọn',goalVnd:5000}});assert.equal(request.stars,2);
    const approved=await manager.call(`/redemptions/${request.requestId}/transition`,{method:'POST',body:{status:'approved',note:'Đã duyệt trong gói thử'}});assert.equal(approved.history.at(-1).status,'approved');
    assert.deepEqual((await learner.call('/student')).balance,{earned:3,available:1,pending:2,redeemed:0});
  });
  let snapshot;
  await t.test('packaged backup script creates a consistent read-only SQLite snapshot while the executable is running',async()=>{
    const backup=runNode(join(extract,'backup-online.mjs'),{cwd:extract,env});await ended(backup);
    assert.equal(backup.child.exitCode,0,backup.output());assert.match(backup.output(),/Đã sao lưu/);
    const files=(await readdir(join(extract,'data','backups'))).filter(file=>file.endsWith('.sqlite'));assert.equal(files.length,1);snapshot=join(extract,'data','backups',files[0]);
    const database=new DatabaseSync(snapshot,{readOnly:true});
    try{
      assert.equal(database.prepare('PRAGMA integrity_check').get().integrity_check,'ok');assert.deepEqual(database.prepare('PRAGMA foreign_key_check').all(),[]);
      assert.equal(database.prepare('SELECT count(*) AS n FROM classes').get().n,1);assert.equal(database.prepare('SELECT count(*) AS n FROM students').get().n,1);
      assert.equal(database.prepare('SELECT rate_vnd FROM workspaces').get().rate_vnd,2500);assert.equal(database.prepare('SELECT tier FROM awards').get().tier,1);assert.equal(JSON.parse(database.prepare('SELECT json FROM awards').get().json).questionLedger.legacyStars,3);
      assert.equal(database.prepare('SELECT status FROM redemptions').get().status,'approved');
      const packed=JSON.parse(database.prepare('SELECT json FROM packs').get().json);assert.equal(packed.items[1].options[packed.items[1].correctIndex],'Lá');
      assert.throws(()=>database.exec("UPDATE workspaces SET name='forbidden'"),/readonly|read.only/i);
    }finally{database.close();}
    await manager.call(`/redemptions/${request.requestId}/transition`,{method:'POST',body:{status:'fulfilled',note:'Đã trao'}});
    await manager.call('/wallet',{method:'POST',body:{enabled:true,rateVnd:5000}});beforeRestart=await learner.call('/student');
    assert.deepEqual(beforeRestart.balance,{earned:3,available:1,pending:0,redeemed:2});
  });
  await t.test('public static URLs never expose private database, bootstrap token, backup or server source',async()=>{
    const outsideSecret='private-extracted-package-secret';await writeFile(join(extract,'.env'),outsideSecret);
    for(const path of ['/data/bao-an.sqlite','/data/bao-an.sqlite-wal','/data/bao-an.sqlite-shm','/data/bootstrap-token.txt',`/data/backups/${snapshot.split(sep).at(-1)}`,'/bootstrap-token.txt','/.env','/%2eenv','/%252e%252e/data/bootstrap-token.txt','/online-local.mjs','/backup-online.mjs','/restore-online.mjs']){
      const response=await fetch(origin+path,{headers:{Accept:'text/html'},signal:AbortSignal.timeout(5000)}),bytes=Buffer.from(await response.arrayBuffer());
      assert.ok([400,404].includes(response.status),`${path}: ${response.status}`);assert.ok(!bytes.includes(Buffer.from('SQLite format 3')));assert.ok(!bytes.includes(Buffer.from(token)));assert.ok(!bytes.includes(Buffer.from(outsideSecret)));
    }
    assert.ok(!running.output().includes(token));assert.ok(!running.output().includes(managerPassword));assert.ok(!running.output().includes(studentPassword));
  });
  await t.test('restarting the extracted executable retains accounts, assignments, earnings, wallet and redemption history',async()=>{
    await stop(running);assert.deepEqual(await start(),{available:true,configured:true,runtimeVersion:RELEASE_VERSION,questionProtocolVersion:1});
    assert.equal((await readFile(join(extract,'data','bootstrap-token.txt'),'utf8')).trim(),token);
    const restoredManager=new Client(origin),restoredLearner=new Client(origin);
    await restoredManager.call('/login',{method:'POST',body:{username:'packaged-manager',password:managerPassword}});
    await restoredLearner.call('/login',{method:'POST',body:{username:'packaged-student',password:studentPassword}});
    const dashboard=await restoredManager.call('/dashboard'),state=await restoredLearner.call('/student');
    assert.equal(dashboard.classes[0].id,classroom.id);assert.equal(dashboard.students[0].id,student.id);assert.equal(dashboard.weeks[0].id,week.id);
    assert.equal(dashboard.weeks[0].sets[0].pack.id,quiz().id);assert.equal(state.weeks[0].sets[0].stars,0);assert.equal(state.weeks[0].done,false);assert.equal(state.weeks[0].sets[0].questionProgress.zero,2);
    assert.deepEqual(state.balance,beforeRestart.balance);assert.equal(state.wallet.rateVnd,5000);assert.equal(state.requests[0].history.at(-1).status,'fulfilled');
    const backup=new DatabaseSync(snapshot,{readOnly:true});try{assert.equal(backup.prepare('SELECT rate_vnd FROM workspaces').get().rate_vnd,2500);assert.equal(backup.prepare('SELECT status FROM redemptions').get().status,'approved');}finally{backup.close();}
  });
  await t.test('bundled restore CLI previews then restores a real backup into a clean Unicode data directory and boots preserved history',async()=>{
    await stop(running);const cleanData=join(extract,'Dữ liệu phục hồi sạch');
    const preview=runNode(join(extract,'restore-online.mjs'),{cwd:extract,env,args:['--file',snapshot,'--data-dir',cleanData]});await ended(preview);
    assert.equal(preview.child.exitCode,0,preview.output());const checked=JSON.parse(preview.stdout());assert.equal(checked.mode,'PREVIEW_ONLY');assert.equal(checked.counts.students,1);assert.equal(checked.counts.awards,1);assert.equal(checked.counts.redemptions,1);
    await assert.rejects(access(join(cleanData,'bao-an.sqlite')),{code:'ENOENT'});
    const restored=runNode(join(extract,'restore-online.mjs'),{cwd:extract,env,args:['--file',snapshot,'--data-dir',cleanData,'--confirm',checked.sha256]});await ended(restored);
    assert.equal(restored.child.exitCode,0,restored.output());assert.equal(JSON.parse(restored.stdout()).restored,true);
    const db=new DatabaseSync(join(cleanData,'bao-an.sqlite'),{readOnly:true});try{assert.equal(db.prepare('SELECT count(*) AS n FROM auth_sessions').get().n,0);assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');}finally{db.close();}
    env.BAO_AN_DATA_DIR=cleanData;assert.deepEqual(await start(),{available:true,configured:true,runtimeVersion:RELEASE_VERSION,questionProtocolVersion:1});
    const previousSession=await fetch(`${origin}/api/online/student`,{headers:{Cookie:learner.cookie},signal:AbortSignal.timeout(5000)});assert.equal(previousSession.status,401);
    const restoredManager=new Client(origin),restoredLearner=new Client(origin);await restoredManager.call('/login',{method:'POST',body:{username:'packaged-manager',password:managerPassword}});await restoredLearner.call('/login',{method:'POST',body:{username:'packaged-student',password:studentPassword}});
    const dashboard=await restoredManager.call('/dashboard'),state=await restoredLearner.call('/student');
    assert.equal(dashboard.classes[0].id,classroom.id);assert.equal(dashboard.students[0].id,student.id);assert.equal(state.weeks[0].id,week.id);assert.equal(state.weeks[0].sets[0].stars,0);assert.equal(state.weeks[0].sets[0].questionProgress.zero,2);
    assert.equal(state.wallet.rateVnd,2500);assert.equal(state.requests[0].history.at(-1).status,'approved');assert.deepEqual(state.balance,{earned:3,available:1,pending:2,redeemed:0});
  });
  await t.test('packaged audio parser validates the listening duration without installed dependencies',async()=>{
    const owner=new Client(origin),child=new Client(origin);await owner.call('/login',{method:'POST',body:{username:'packaged-manager',password:managerPassword}});
    const cls=await owner.call('/classes',{method:'POST',body:{name:'Lớp nghe trong ZIP',grade:4}});await owner.call('/students',{method:'POST',body:{classId:cls.id,name:'Bình',username:'packaged-audio-child',password:studentPassword}});
    const wav=waveFixture(),audio=await owner.call('/media',{method:'POST',body:{name:'packaged-listening.wav',mime:'audio/wav',base64:wav.toString('base64')}}),at='2026-10-17T00:00:00.000Z';
    const source={id:'packaged-listening-source',version:1,title:'Bài nghe trong gói độc lập',subject:'thinking',grade:4,source:'local',publishedAt:at,kind:'learning',contentFormatVersion:2,passages:[],media:[{mediaId:audio.id,kind:'audio',url:'/audio/'+audio.id+'.wav',sha256:audio.sha256,transcript:'My name is Lucy.',source:'Tự soạn',rights:'Tự soạn',approvedAt:at}],items:[1,2].map(i=>({id:'packaged-listen-'+i,kind:'listening-choice',objectiveId:'PACKAGE.LISTEN',prompt:'Tên bạn là gì '+i+'?',audioId:audio.id,options:['Lucy','Mai','Nam','Lan'],correctIndex:0,hint:'Nghe âm đầu.',explanation:'Tên bạn là Lucy.'}))};
    await owner.call('/weeks',{method:'POST',body:{requestId:'packaged-listening-week',classId:cls.id,title:'Tuần nghe',sets:threeSubjectSets([{subjectLabel:'Tiếng Anh',pack:source}])}});await child.call('/login',{method:'POST',body:{username:'packaged-audio-child',password:studentPassword}});
    const p=await child.call('/play/compact',{method:'POST',body:{requestId:'packaged-audio-play',moduleId:'math-quest',packId:source.id,contentVersion:1}}),url=origin+'/api/online/media/'+audio.id+'?playId='+p.session.sessionId+'&itemId=packaged-listen-1';
    const response=await fetch(url,{headers:{Cookie:child.cookie},signal:AbortSignal.timeout(5000)});assert.equal(response.status,200);assert.deepEqual(Buffer.from(await response.arrayBuffer()),wav);await delay(150);
    const opened=await child.call('/play/'+p.session.sessionId+'/question-open',{method:'POST',body:{itemId:'packaged-listen-1'}});assert.equal(opened.item.correctIndex,undefined);assert.equal(opened.item.prompt,source.items[0].prompt);
    const receipt=await child.call('/play/'+p.session.sessionId+'/attempt',{method:'POST',body:{attemptKey:'audio-answer',itemId:'packaged-listen-1',response:{kind:'choice',choiceIndex:0},hintsUsed:0,elapsedMs:0}});assert.equal(receipt.questionRewards.gained,3);assert.equal(receipt.feedback.audioTranscript,'My name is Lucy.');
  });
});
