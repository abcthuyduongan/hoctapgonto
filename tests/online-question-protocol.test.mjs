import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {once} from 'node:events';
import {setTimeout as delay} from 'node:timers/promises';
import {createOnlineServer} from '../server/online-server.mjs';
import {createCloudApi} from '../server/cloud-api.mjs';
import {createPostgresFixture} from './helpers/postgres-fixture.mjs';
import {waveFixture} from './helpers/media-fixture.mjs';
import {audioDurationMs} from '../server/audio-duration.mjs';
import {snapshotOnlineDatabase,inspectOnlineBackup} from '../server/online-recovery.mjs';
import {DatabaseSync} from 'node:sqlite';

const token='protocol-test-bootstrap-2026',password='Protocol-test-password-2026!',at='2026-10-17T00:00:00.000Z';
class Client{
 constructor(send,origin){this.send=send;this.origin=origin;this.cookie='';this.csrf='';}
 async request(route,body,{binary=false,headers={}}={}){
  const h={'X-Bao-An-Question-Protocol':'1',...headers,...(this.cookie?{Cookie:this.cookie}:{})};if(body!==undefined)Object.assign(h,{Origin:this.origin,'Content-Type':'application/json','X-CSRF-Token':this.csrf});
  const r=await this.send(new Request(this.origin+'/api/online'+route,{method:body===undefined?'GET':'POST',headers:h,...(body===undefined?{}:{body:JSON.stringify(body)})}));
  const cookies=r.headers.getSetCookie();if(cookies.length)this.cookie=cookies.map(c=>c.split(';',1)[0]).join('; ');const data=binary?Buffer.from(await r.arrayBuffer()):await r.json();if(data.csrfToken)this.csrf=data.csrfToken;return{status:r.status,data};
 }
 async ok(route,body,options){const r=await this.request(route,body,options);assert.ok(r.status>=200&&r.status<300,route+' '+JSON.stringify(r));return r.data;}
 async denied(route,body,status=409,options){const r=await this.request(route,body,options);assert.equal(r.status,status,route+' '+JSON.stringify(r.data));return r;}
}
async function fixture(t,engine){
 let store,send,origin,directory,objects;
 if(engine==='SQLite'){
  const root=path.resolve('test-results');await mkdir(root,{recursive:true});directory=await mkdtemp(path.join(root,'question-protocol-'));const staticRoot=path.join(directory,'public');await mkdir(staticRoot);await writeFile(path.join(staticRoot,'index.html'),'<title>Test only</title>');
  const server=createOnlineServer({databasePath:path.join(directory,'test.sqlite'),staticRoot,setupToken:token,secureCookies:false});server.listen(0,'127.0.0.1');await once(server,'listening');origin='http://127.0.0.1:'+server.address().port;send=request=>fetch(request);store=server.onlineStore;
  t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await server.onlineClose();assert.equal(path.dirname(path.resolve(directory)),root);assert.ok(path.basename(directory).startsWith('question-protocol-'));await rm(directory,{recursive:true,force:true});});
 }else{
  ({store}=await createPostgresFixture(t,{bootstrap:false}));objects=new Map();origin='https://protocol.example.test';send=createCloudApi({store,storage:{async upload(key,b){objects.set(key,Buffer.from(b));},async download(key){return objects.get(key);},async remove(key){objects.delete(key);}},publicOrigin:origin,setupToken:token});
 }
 const manager=new Client(send,origin),identity=await manager.ok('/setup',{token,name:'Protocol fixture',username:'protocol.admin',password});const cls=await manager.ok('/classes',{name:'Lớp thử',grade:3});await manager.ok('/students',{name:'An',username:'protocol.child',classId:cls.id,password});
 const audio=await manager.ok('/media',{name:'two-seconds.wav',mime:'audio/wav',base64:waveFixture(2).toString('base64')});
 const quiz={id:'protocol-math',version:1,title:'Phép cộng',subject:'thinking',grade:3,source:'local',publishedAt:at,kind:'quiz',items:[1,2].map(i=>({id:'q'+i,kind:'multiple-choice',objectiveId:'PROTOCOL.MATH',prompt:`Câu bí mật ${i}: ${i} + 2 bằng bao nhiêu?`,options:[String(i+2),'100','101','102'],correctIndex:0,explanation:'Lời giải riêng chỉ sau đáp án đúng.'}))};
 const learning={id:'protocol-listen',version:1,title:'Bài nghe',subject:'thinking',grade:3,source:'local',publishedAt:at,kind:'learning',contentFormatVersion:2,passages:[],media:[{mediaId:audio.id,kind:'audio',url:'/audio/'+audio.id+'.wav',sha256:audio.sha256,transcript:'TRANSCRIPT_PRIVATE_2026',source:'Tự soạn',rights:'Tự soạn',approvedAt:at}],items:[1,2].map(i=>({id:'listen'+i,kind:'listening-choice',objectiveId:'PROTOCOL.ENGLISH',prompt:'Nghe và chọn tên '+i,audioId:audio.id,options:['Lucy','Mai','Nam','Lan'],correctIndex:0,hint:'Nghe âm đầu tên.',explanation:'Tên trong bài nghe là Lucy.'}))};
 const viet={...structuredClone(quiz),id:'protocol-viet',title:'Từ đồng nghĩa',items:quiz.items.map((q,i)=>({...q,id:'viet'+i,prompt:'Chọn nghĩa từ vui vẻ '+i,options:['Hân hoan','Buồn','Lo','Giận']}))};
 const sets=[{subjectLabel:'Toán',pack:quiz},{subjectLabel:'Tiếng Anh',pack:learning},{subjectLabel:'Tiếng Việt',pack:viet}],week=await manager.ok('/weeks',{requestId:'week',classId:cls.id,title:'Tuần 01',sets});
 const child=new Client(send,origin);await child.ok('/login',{username:'protocol.child',password});await child.ok('/student/journey',{});
 const start=(pack=quiz,requestId='play',legacy=false)=>child.ok(legacy?'/play':'/play/compact',{requestId,moduleId:'math-quest',packId:pack.id,contentVersion:pack.version});
 const answer=(p,itemId,choiceIndex=0,hintsUsed=0,key=itemId)=>child.ok(`/play/${p.session.sessionId}/attempt`,{attemptKey:key,itemId,response:{kind:'choice',choiceIndex},hintsUsed,elapsedMs:0});
 return{store,manager,admin:identity.user,child,sets,week,cls,quiz,learning,audio,start,answer,directory,objects};
}

for(const engine of ['SQLite','PostgreSQL']){
 test(`${engine}: a recognized audio header without playable duration is rejected before upload writes`,async t=>{
  const f=await fixture(t,engine),before=await f.manager.ok('/media'),bad={name:'broken-header.wav',mime:'audio/wav',base64:Buffer.from('RIFF0000WAVE').toString('base64')},good={name:'valid-after-rejection.wav',mime:'audio/wav',base64:waveFixture().toString('base64')},objectsBefore=f.objects?.size;
  await f.manager.denied('/media',bad,422);assert.deepEqual(await f.manager.ok('/media'),before);
  if(engine==='PostgreSQL'){await f.manager.denied('/media/batch',{files:[good,bad]},422);assert.deepEqual(await f.manager.ok('/media'),before);assert.equal(f.objects.size,objectsBefore);}
  const accepted=await f.manager.ok('/media',good);assert.equal(accepted.name,good.name);assert.equal((await f.manager.ok('/media')).length,before.length+1);
  if(engine==='SQLite'){const large=waveFixture(200);assert.ok(large.length>2*1024*1024);assert.equal((await f.manager.ok('/media',{name:'valid-local-large.wav',mime:'audio/wav',base64:large.toString('base64')})).size,large.length);}
 });
 test(`${engine}: ordering hints are disclosed and charged by the server and validated in backups`,async t=>{
  const f=await fixture(t,engine),cls=await f.manager.ok('/classes',{name:'Lớp gợi ý',grade:3});await f.manager.ok('/students',{name:'Bình',username:'ordering.child',classId:cls.id,password});
  const vi={...f.quiz,id:'hint-viet',title:'Ghép câu',kind:'sentences',items:[['Em','chăm','học'],['Tôi','yêu','sách']].map((words,i)=>({id:'hint-vi-'+i,kind:'sentence',objectiveId:'HINT.VI',prompt:'Ghép câu '+i,words,hint:'PRIVATE_HINT_VI '+i}))};
  const en={...vi,id:'hint-english',title:'Quy luật',items:[['Birds','can','fly'],['We','read','books']].map((words,i)=>({id:'hint-en-'+i,kind:'sentence',objectiveId:'HINT.EN',prompt:'Xếp đúng '+i,words,hint:'PRIVATE_HINT_EN '+i}))};
  await f.manager.ok('/weeks',{requestId:'hint-week',classId:cls.id,title:'Tuần 01',sets:[{subjectLabel:'Toán',pack:f.quiz},{subjectLabel:'Tiếng Việt',pack:vi},{subjectLabel:'Tiếng Anh',pack:en}]});
  const child=new Client(f.child.send,f.child.origin);await child.ok('/login',{username:'ordering.child',password});
  let inspectedPlay;
  for(const[moduleId,pack]of[['sentence-builder',vi],['sequence-trail',en]]){
   const p=await child.ok('/play/compact',{requestId:moduleId,moduleId,packId:pack.id,contentVersion:1}),base='/play/'+p.session.sessionId;
   assert.equal(JSON.stringify(p).includes('PRIVATE_HINT_'),false);assert.deepEqual(p.presentation.items[0].words,pack.items[0].words);
   await child.denied(base+'/question-hint',{itemId:pack.items[1].id});await child.denied(base+'/question-open',{itemId:pack.items[0].id},400);
   const hint=await child.ok(base+'/question-hint',{itemId:pack.items[0].id});assert.equal(hint.hint,pack.items[0].hint);assert.deepEqual(await child.ok(base+'/question-hint',{itemId:pack.items[0].id}),hint);
   const input={attemptKey:'hinted-correct',itemId:pack.items[0].id,response:{kind:'order',indices:[0,1,2]},hintsUsed:0,elapsedMs:0},result=await child.ok(base+'/attempt',input);
   assert.equal(result.event.hintsUsed,1);assert.equal(result.questionRewards.questions[0].tier,2);assert.equal((await child.ok(base+'/attempt',input)).questionRewards.gained,0);await child.denied(base+'/question-hint',{itemId:pack.items[0].id});
   const plain=await child.ok(base+'/attempt',{...input,attemptKey:'plain-correct',itemId:pack.items[1].id,hintsUsed:1});assert.equal(plain.event.hintsUsed,0);assert.equal(plain.questionRewards.questions[0].tier,3);await child.ok(base+'/complete-compact',{});inspectedPlay=p.session.sessionId;
  }
  if(engine==='SQLite'){const file=path.join(f.directory,'ordering-backup.sqlite');await snapshotOnlineDatabase(f.store.db,file);assert.equal(inspectOnlineBackup(file).sha256.length,64);const db=new DatabaseSync(file);try{const row=db.prepare('SELECT json FROM plays WHERE id=?').get(inspectedPlay),session=JSON.parse(row.json);delete session.questionHints['hint-en-0'];db.prepare('UPDATE plays SET json=? WHERE id=?').run(JSON.stringify(session),inspectedPlay);}finally{db.close();}assert.throws(()=>inspectOnlineBackup(file),e=>e.status===400);}
 });
 test(`${engine}: public routes keep future prompts, answers and solutions private; server hints and receipts are authoritative`,async t=>{
  const f=await fixture(t,engine),p=await f.start(),base='/play/'+p.session.sessionId;
  await f.child.denied('/play/compact',{requestId:'obsolete-tab',moduleId:'math-quest',packId:f.quiz.id,contentVersion:1},409,{headers:{'X-Bao-An-Question-Protocol':'0'}});
  await f.child.denied('/student',undefined,409,{headers:{'X-Bao-An-Question-Protocol':'0'}});
  for(const data of [p,await f.child.ok('/student')]){const s=JSON.stringify(data);for(const secret of ['correctIndex','acceptedAnswers','Lời giải riêng','Câu bí mật','TRANSCRIPT_PRIVATE_2026'])assert.equal(s.includes(secret),false,secret);}
  await f.child.denied(base+'/question-open',{itemId:'q2'});await f.child.denied(base+'/question-hint',{itemId:'q1'});
  const opened=await f.child.ok(base+'/question-open',{itemId:'q1'});assert.equal(opened.item.prompt,f.quiz.items[0].prompt);assert.equal(opened.item.correctIndex,undefined);assert.equal(opened.item.explanation,undefined);assert.equal(opened.item.hint,undefined);
  assert.equal((await f.child.ok(base+'/question-open',{itemId:'q1'})).openedAt,opened.openedAt);
  const wrong=await f.answer(p,'q1',1,0,'wrong');assert.equal(wrong.event.correct,false);assert.equal(wrong.feedback,undefined);
  const hint=await f.child.ok(base+'/question-hint',{itemId:'q1'});assert.equal(hint.hintsUsed,1);assert.deepEqual(await f.child.ok(base+'/question-hint',{itemId:'q1'}),hint);
  const right=await f.answer(p,'q1',0,0,'right');assert.equal(right.event.hintsUsed,1);assert.equal(right.event.correct,true);assert.equal(right.feedback.correctIndex,0);assert.equal(right.feedback.explanation,f.quiz.items[0].explanation);assert.equal(right.questionRewards.questions[0].tier,2);
  const retry=await f.answer(p,'q1',0,0,'right');assert.equal(retry.duplicate,true);assert.equal(retry.questionRewards.gained,0);assert.deepEqual(retry.feedback,right.feedback);await f.child.denied(base+'/question-hint',{itemId:'q1'});
  await f.child.ok(base+'/question-open',{itemId:'q2'});assert.equal((await f.answer(p,'q2',0,20)).event.hintsUsed,0,'unused client hints cannot replace server receipts');
  if(engine==='SQLite'){const file=path.join(f.directory,'backup.sqlite');await snapshotOnlineDatabase(f.store.db,file);assert.equal(inspectOnlineBackup(file).sha256.length,64);const db=new DatabaseSync(file);try{const row=db.prepare('SELECT json FROM plays WHERE id=?').get(p.session.sessionId),session=JSON.parse(row.json);session.questionHints.q1.used=0;db.prepare('UPDATE plays SET json=? WHERE id=?').run(JSON.stringify(session),p.session.sessionId);}finally{db.close();}assert.throws(()=>inspectOnlineBackup(file),e=>e.status===400);}
  const legacy=await f.start(f.quiz,'legacy-path',true);assert.equal(legacy.session.questionProtocolVersion,1);assert.equal(legacy.pack.items,undefined);assert.equal(JSON.stringify(legacy).includes('correctIndex'),false);await f.child.ok(`/play/${legacy.session.sessionId}/question-open`,{itemId:'q1'});assert.equal((await f.answer(legacy,'q1')).event.correct,true);
 });
 test(`${engine}: a listening answer needs the assigned audio download and its verified minimum duration`,async t=>{
  const f=await fixture(t,engine),p=await f.start(f.learning),base='/play/'+p.session.sessionId,itemId='listen1',media='/media/'+f.audio.id,context='?playId='+p.session.sessionId+'&itemId='+itemId;
  await f.child.denied(base+'/question-open',{itemId});await f.child.denied(base+'/attempt',{attemptKey:'bypass',itemId,response:{kind:'choice',choiceIndex:0},hintsUsed:0,elapsedMs:0},400);
  const head=await f.child.send(new Request(f.child.origin+'/api/online'+media+context,{method:'HEAD',headers:{Cookie:f.child.cookie}}));assert.equal(head.status,200);await f.child.denied(base+'/question-open',{itemId});
  await f.child.ok(media+context,undefined,{binary:true,headers:{Range:'bytes=0-15'}});await f.child.denied(base+'/question-open',{itemId});
  await f.child.ok(media+context,undefined,{binary:true});await f.child.denied(base+'/question-open',{itemId});await delay(2050);
  const clock=await f.child.ok(base+'/question-open',{itemId});assert.equal(clock.item.prompt,f.learning.items[0].prompt);assert.equal(JSON.stringify(clock).includes('TRANSCRIPT_PRIVATE_2026'),false);const receipt=await f.answer(p,itemId);assert.equal(receipt.questionRewards.questions[0].tier,3);assert.equal(receipt.feedback.audioTranscript,'TRANSCRIPT_PRIVATE_2026');
  await f.child.denied(base+'/question-open',{itemId:'listen2'}); // The shared audio must be downloaded for this question as well.
 });
 test(`${engine}: changed meaning cannot retain an old ID; a new question starts without mastery and keeps the old wallet`,async t=>{
  const f=await fixture(t,engine),p=await f.start();await f.child.ok(`/play/${p.session.sessionId}/question-open`,{itemId:'q1'});await f.answer(p,'q1');
  const revised=structuredClone(f.sets);revised.forEach(s=>s.pack.version=2);revised[0].pack.items[0].prompt='5 + 7 bằng bao nhiêu?';revised[0].pack.items[0].options=['12','13','14','15'];
  const input={requestId:'revision',replaceWeekId:f.week.id,title:f.week.title,classId:f.cls.id,sets:revised};
  const {requestId,...checkInput}=input;void requestId;const check=await f.manager.ok('/admin/week-check',checkInput);assert.match(check.revisionError,/q1.*itemId mới/);await f.manager.denied('/weeks',input);
  assert.equal((await f.child.ok('/student/summary')).balance.earned,3);
  revised[0].pack.items[0].id='q-new';await f.manager.ok('/weeks',input);const state=await f.child.ok('/student/summary'),progress=state.weeks[0].sets.find(s=>s.pack.id===f.quiz.id).questionProgress;
  assert.equal(progress.questions.find(q=>q.itemId==='q-new').tier,0);assert.equal(state.balance.earned,3);assert.equal(state.currentWeekSummary.ready,false);
 });
}
test('server audio duration is taken from bounded bytes, not a filename or client duration',async()=>{assert.equal(await audioDurationMs(waveFixture(2),'audio/wav'),2000);await assert.rejects(()=>audioDurationMs(Buffer.from('RIFFinvalid file'),'audio/wav'),e=>e.status===422);const localLarge=waveFixture(200);assert.ok(localLarge.length>2*1024*1024);await assert.rejects(()=>audioDurationMs(localLarge,'audio/wav'),e=>e.status===422);assert.equal(await audioDurationMs(localLarge,'audio/wav',8*1024*1024),200000);});
