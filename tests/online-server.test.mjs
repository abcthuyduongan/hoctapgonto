import {prepareSuccessfulAttempt,registerStorePlay,fixtureQuestion} from './helpers/secure-play.mjs';
import {seedLegacyWeek} from './helpers/legacy-weeks.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
import {randomUUID,createHash} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {request as httpRequest} from 'node:http';
import {createOnlineServer} from '../server/online-server.mjs';
import {waveFixture} from './helpers/media-fixture.mjs';

const projectRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const resultsRoot=path.join(projectRoot,'test-results');
const setupToken='online-integration-setup-token-2026';
const managerPassword='Manager-test-password-2026!';
const studentPassword='Student-test-password-2026!';
const apiPrefix='/api/online';

/** Exercise the public HTTP boundary, including real cookies and CSRF headers. */
class Client {
  constructor(origin){this.origin=origin;this.cookie='';this.csrfToken='';}
  async request(route,{method='GET',body,csrf=this.csrfToken,origin=this.origin,headers={}}={}){
    const mutation=!['GET','HEAD'].includes(method);
    const requestHeaders={'X-Bao-An-Question-Protocol':'1',...headers};
    if(this.cookie)requestHeaders.Cookie=this.cookie;
    if(mutation){
      requestHeaders['Content-Type']='application/json';
      if(origin!==null)requestHeaders.Origin=origin;
      if(csrf)requestHeaders['X-CSRF-Token']=csrf;
    }
    const response=await fetch(`${this.origin}${apiPrefix}${route}`,{
      method,headers:requestHeaders,redirect:'manual',
      ...(mutation?{body:JSON.stringify(body??{})}:{}),
    });
    assert.match(response.headers.get('cache-control')??'',/no-store/i,`${method} ${route} must not be cached`);
    assert.match(response.headers.get('content-type')??'',/application\/json/i,`${method} ${route} returns JSON`);
    const cookies=response.headers.getSetCookie();
    if(cookies.length)this.cookie=cookies.map(value=>value.split(';',1)[0]).join('; ');
    const data=await response.json();
    if(response.ok&&typeof data.csrfToken==='string')this.csrfToken=data.csrfToken;
    return {status:response.status,ok:response.ok,data,headers:response.headers};
  }
  async ok(route,options){
    await prepareSuccessfulAttempt(this,route,options);const result=await this.request(route,options);
    assert.ok(result.ok,`${options?.method??'GET'} ${route}: ${result.status} ${JSON.stringify(result.data)}`);
    if(['/play','/play/compact'].includes(route))await registerStorePlay(this,result.data,this.fixtureStore());
    return result.data;
  }
  async denied(route,options,statuses=[400,401,403,404,409]){
    const result=await this.request(route,options);
    assert.ok(statuses.includes(result.status),`${options?.method??'GET'} ${route}: expected denial, got ${result.status} ${JSON.stringify(result.data)}`);
    return result;
  }
}

async function fixture(t){
  await mkdir(resultsRoot,{recursive:true});
  const directory=await mkdtemp(path.join(resultsRoot,'online-server-'));
  const staticRoot=path.join(directory,'public');
  await mkdir(staticRoot);
  await writeFile(path.join(staticRoot,'index.html'),'<!doctype html><title>Online integration fixture</title>');
  const options={databasePath:path.join(directory,'online.sqlite'),staticRoot,setupToken,secureCookies:false};
  let server,origin;
  async function start(){
    server=await createOnlineServer(options);
    server.listen(0,'127.0.0.1');
    await once(server,'listening');
    origin=`http://127.0.0.1:${server.address().port}`;
  }
  async function close(){
    if(!server)return;
    const closing=server;server=undefined;
    await new Promise((resolve,reject)=>closing.close(error=>error?reject(error):resolve()));
    await closing.onlineClose?.();
  }
  await start();
  t.after(async()=>{
    await close();
    // The only recursively removed path is the verified mkdtemp child above.
    const absolute=path.resolve(directory);
    assert.equal(path.dirname(absolute),path.resolve(resultsRoot));
    assert.ok(path.basename(absolute).startsWith('online-server-'));
    await rm(absolute,{recursive:true,force:true});
  });
  return {
    client:()=>Object.assign(new Client(origin),{fixtureStore:()=>server.onlineStore}),
    database:()=>server.onlineStore.db,
    server:()=>server,
    async restart(){await close();await start();},
    async bootstrap(){
      const manager=new Client(origin);manager.fixtureStore=()=>server.onlineStore;
      const identity=await manager.ok('/setup',{method:'POST',body:{token:setupToken,name:'Lớp học thử nghiệm',username:'manager',password:managerPassword}});
      assert.equal(identity.user.role,'admin');
      assert.ok(identity.user.workspaceId);
      assert.ok(identity.csrfToken);
      return manager;
    },
  };
}

function pairs(id='nature-week-01',version=1){
  return {
    id,version,title:'Khám phá thiên nhiên',subject:'thinking',grade:3,kind:'pairs',source:'local',publishedAt:'2026-10-15T00:00:00.000Z',
    items:[['Cây cần gì để quang hợp?','Ánh sáng'],['Con gì có sáu chân?','Côn trùng'],['Nước đông thành gì?','Nước đá'],['Hành tinh chúng ta sống?','Trái Đất']]
      .map(([left,right],index)=>({id:`nature-${index+1}`,objectiveId:'NATURE3.OBSERVE',kind:'pair',left,right})),
  };
}
async function makeClass(manager,name='Lớp thiên nhiên'){
  return manager.ok('/classes',{method:'POST',body:{name,grade:3}});
}
async function makeStudent(manager,classId,username,name=username){
  const result=await manager.ok('/students',{method:'POST',body:{classId,username,name,password:studentPassword}});
  assert.equal(result.student.classId,classId);
  assert.equal(result.student.username,username);
  assert.equal(result.credentials.username,username);
  assert.equal(result.credentials.password,studentPassword);
  return result.student;
}
async function login(client,username,password=studentPassword){
  return client.ok('/login',{method:'POST',body:{username,password}});
}
async function provisionManager(f,username='second-manager'){
  const db=f.database(),workspaceId=randomUUID(),userId=randomUUID(),createdAt=new Date().toISOString();
  const passwordHash=db.prepare("SELECT password_hash FROM users WHERE username='manager'").get().password_hash;
  db.prepare('INSERT INTO workspaces(id,name,created_at) VALUES(?,?,?)').run(workspaceId,'Đơn vị thứ hai',createdAt);
  db.prepare('INSERT INTO users(id,workspace_id,username,password_hash,role,created_at) VALUES(?,?,?,?,?,?)').run(userId,workspaceId,username,passwordHash,'admin',createdAt);
  const manager=f.client();await login(manager,username,managerPassword);return manager;
}
async function mediaBytes(client,id,{range,method='GET'}={}){
  const response=await fetch(`${client.origin}${apiPrefix}/media/${id}`,{method,headers:{...(client.cookie?{Cookie:client.cookie}:{}),...(range?{Range:range}:{})}});
  assert.match(response.headers.get('cache-control')??'',/no-store/i);
  return{status:response.status,headers:response.headers,bytes:Buffer.from(await response.arrayBuffer())};
}
function slowPost(f,client,route,body){
  const payload=JSON.stringify(body),first=payload.slice(0,1),rest=payload.slice(1);
  const started=new Promise(resolve=>f.server().once('request',req=>{
    assert.equal(req.url,`${apiPrefix}${route}`);
    req.once('data',()=>resolve());
  }));
  let request;
  const response=new Promise((resolve,reject)=>{
    request=httpRequest(`${client.origin}${apiPrefix}${route}`,{method:'POST',headers:{Cookie:client.cookie,Origin:client.origin,'X-CSRF-Token':client.csrfToken,'Content-Type':'application/json','X-Bao-An-Question-Protocol':'1'}},res=>{
      const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>{
        try{resolve({status:res.statusCode,data:JSON.parse(Buffer.concat(chunks).toString('utf8'))});}catch(error){reject(error);}
      });res.on('error',reject);
    });request.on('error',reject);request.write(first);
  });
  return{started,response,finish:()=>request.end(rest),destroy:()=>request.destroy()};
}
async function publish(manager,classId,{requestId='week-01',title='Tuần khám phá đầu tiên',sets=[{subjectLabel:'Tự nhiên',pack:pairs()}]}={}){
  const store=manager.fixtureStore(),auth=(await manager.ok('/me')).user;
  if(!store.db.prepare('SELECT id FROM weeks WHERE workspace_id=? AND request_id=?').get(auth.workspaceId,requestId))seedLegacyWeek(store,auth,{requestId,title,classId,sets});
  return manager.ok('/weeks',{method:'POST',body:{requestId,title,classId,sets}});
}
function answer(play,item,correct=true){
  item=fixtureQuestion(play,item);
  if(play.presentation.kind==='quiz')return {kind:'choice',choiceIndex:correct?item.correctIndex:(item.correctIndex+1)%4};
  if(play.presentation.kind==='pairs')return {kind:'pair',first:{itemId:item.id,side:'left'},second:{itemId:correct?item.id:play.presentation.items.find(row=>row.id!==item.id).id,side:'right'}};
  if(play.presentation.kind==='learning'){
    if(item.kind==='reading-choice'||item.kind==='listening-choice')return{kind:'choice',choiceIndex:correct?item.correctIndex:(item.correctIndex+1)%4};
    return{kind:'text',value:correct?(item.kind==='numeric-answer'?item.answer:item.acceptedAnswers[0]):(item.kind==='numeric-answer'?'999999':'Incorrect answer')};
  }
  return {kind:'order',indices:item.words.map((_word,index)=>index)};
}
async function startPlay(client,pack,{requestId='play-01',moduleId='math-quest'}={}){
  const play=await client.ok('/play',{method:'POST',body:{requestId,moduleId,packId:pack.id,contentVersion:pack.version}});
  assert.equal(play.session.packId,pack.id);
  assert.equal(play.session.contentVersion,pack.version);
  return play;
}
async function submit(client,play,item,{attemptKey=`answer-${item.id}`,response=answer(play,item),hintsUsed=0,...extra}={}){
  return client.ok(`/play/${play.session.sessionId}/attempt`,{method:'POST',body:{attemptKey,itemId:item.id,response,hintsUsed,elapsedMs:100,...extra}});
}
async function finish(client,pack,options={}){
  const play=await startPlay(client,pack,options);
  for(const item of play.presentation.items)await submit(client,play,item);
  const result=await client.ok(`/play/${play.session.sessionId}/complete`,{method:'POST'});
  return {play,result};
}

test('online HTTP authentication requires setup token, own origin and CSRF; logout revokes the cookie',async t=>{
  const f=await fixture(t),anonymous=f.client();
  assert.equal((await anonymous.ok('/status')).configured,false);
  await anonymous.denied('/me',{},[401]);
  const setup={token:setupToken,name:'Lớp thử nghiệm',username:'manager',password:managerPassword};
  await anonymous.denied('/setup',{method:'POST',body:setup,origin:null},[403]);
  await anonymous.denied('/setup',{method:'POST',body:{...setup,token:'invalid-token'}},[401,403]);
  const created=await anonymous.request('/setup',{method:'POST',body:setup});
  assert.ok(created.ok,JSON.stringify(created.data));
  const setCookie=created.headers.get('set-cookie')??'';
  assert.match(setCookie,/HttpOnly/i);assert.match(setCookie,/SameSite=Lax/i);
  assert.equal(created.data.user.role,'admin');
  assert.equal((await anonymous.ok('/status')).configured,true);
  await anonymous.denied('/setup',{method:'POST',body:setup},[403,409]);
  const stranger=f.client();
  await stranger.denied('/login',{method:'POST',body:{username:'manager',password:'incorrect-password'}},[401]);
  const manager=f.client();await login(manager,'manager',managerPassword);
  const identity=await manager.ok('/me');
  assert.equal(identity.user.username,'manager');
  assert.equal(identity.user.password,undefined);assert.equal(identity.user.passwordHash,undefined);
  await manager.denied('/classes',{method:'POST',body:{name:'Missing CSRF',grade:3},csrf:null},[403]);
  await manager.denied('/classes',{method:'POST',body:{name:'Foreign origin',grade:3},origin:'https://foreign.invalid'},[403]);
  assert.equal((await manager.ok('/dashboard')).classes.length,0);
  const classRow=await makeClass(manager);assert.ok(classRow.id);
  const stolenCookie=manager.cookie;
  await manager.ok('/logout',{method:'POST'});
  const revoked=f.client();revoked.cookie=stolenCookie;
  await revoked.denied('/me',{},[401]);
});

test('online class assignment and student authority stay isolated; weekly imports are immutable and atomic',async t=>{
  const f=await fixture(t),manager=await f.bootstrap();
  const classroom=await makeClass(manager,'Lớp A'),otherClass=await makeClass(manager,'Lớp B');
  const first=await makeStudent(manager,classroom.id,'student-one','An');
  await makeStudent(manager,classroom.id,'student-two','Bình');
  await makeStudent(manager,otherClass.id,'student-other-class','Chi');
  const week=await publish(manager,classroom.id);
  assert.equal(week.sets[0].subjectLabel,'Tự nhiên');
  assert.equal(week.sets[0].pack.subject,'thinking');
  const repeated=await publish(manager,classroom.id);
  assert.equal(repeated.id,week.id);
  const one=f.client(),two=f.client(),other=f.client();
  await login(one,'student-one');await login(two,'student-two');await login(other,'student-other-class');
  const assigned=await one.ok('/student');
  assert.equal(assigned.student.id,first.id);
  assert.equal(assigned.current.subjectLabel,'Tự nhiên');
  assert.equal(assigned.weeks.length,1);
  assert.equal((await other.ok('/student')).weeks.length,0);
  assert.equal((await other.ok('/student')).current,null);
  for(const [route,body] of [['/classes',{name:'Forbidden',grade:3}],['/wallet',{enabled:true,rateVnd:1000}],['/students',{classId:classroom.id,name:'Forbidden',username:'forbidden'}]]){
    await one.denied(route,{method:'POST',body},[403]);
  }
  await one.denied('/dashboard',{},[403]);
  await other.denied('/play',{method:'POST',body:{requestId:'inaccessible',moduleId:'math-quest',packId:pairs().id,contentVersion:1}},[403,404,409]);
  const play=await startPlay(one,assigned.current.pack);
  await two.denied(`/play/${play.session.sessionId}/attempt`,{method:'POST',body:{attemptKey:'guessed-session',itemId:play.presentation.items[0].id,response:answer(play,play.presentation.items[0]),hintsUsed:0,elapsedMs:100}},[403,404]);
  await two.denied(`/play/${play.session.sessionId}/complete`,{method:'POST'},[403,404]);
  const altered=pairs();altered.items[0].right='Câu trả lời đã thay đổi';
  await manager.denied('/weeks',{method:'POST',body:{requestId:'week-01',title:'Tuần đã thay đổi',classId:classroom.id,sets:[{subjectLabel:'Tự nhiên',pack:altered}]}},[409]);
  await manager.denied('/weeks',{method:'POST',body:{requestId:'conflicting-version',title:'Không được xuất bản một phần',classId:classroom.id,sets:[{subjectLabel:'Sáng tạo',pack:pairs('brand-new-pack')},{subjectLabel:'Tự nhiên',pack:altered}]}},[400,409]);
  const dashboard=await manager.ok('/dashboard');
  assert.equal(dashboard.weeks.length,1);
  assert.equal(dashboard.stats.questions,4);
  assert.equal(dashboard.weeks[0].sets[0].pack.items[0].right,pairs().items[0].right);
  await one.ok(`/play/${play.session.sessionId}/abandon`,{method:'POST'});
});

test('online resources and identically named packs remain isolated across workspaces',async t=>{
  const f=await fixture(t),firstManager=await f.bootstrap();
  // Provision the second tenant only as test setup: public registration is closed.
  // Every access and mutation under test below goes through authenticated HTTP.
  const secondManager=await provisionManager(f);
  const classA=await makeClass(firstManager,'Đơn vị A'),classB=await makeClass(secondManager,'Đơn vị B');
  await makeStudent(firstManager,classA.id,'tenant-a-student');
  const studentB=await makeStudent(secondManager,classB.id,'tenant-b-student');
  const packA=pairs(),packB=pairs();packB.items[0].right='Năng lượng mặt trời';
  await publish(firstManager,classA.id,{sets:[{subjectLabel:'Tự nhiên A',pack:packA}]});
  await publish(secondManager,classB.id,{sets:[{subjectLabel:'Tự nhiên B',pack:packB}]});
  assert.equal((await firstManager.ok('/dashboard')).classes.length,1);
  assert.equal((await secondManager.ok('/dashboard')).classes.length,1);
  await firstManager.denied(`/students/${studentB.id}`,{method:'PATCH',body:{name:'Foreign edit'}},[404]);
  await firstManager.denied('/students',{method:'POST',body:{classId:classB.id,name:'Foreign student',username:'foreign-student',password:studentPassword}},[404]);
  await firstManager.denied('/weeks',{method:'POST',body:{requestId:'foreign-class-week',title:'Foreign week',classId:classB.id,sets:[{subjectLabel:'Tự nhiên',pack:pairs('foreign-class-pack')}]}},[404]);
  const a=f.client(),b=f.client();await login(a,'tenant-a-student');await login(b,'tenant-b-student');
  const aState=await a.ok('/student'),bState=await b.ok('/student');
  assert.equal(aState.current.pack.items,undefined);
  assert.equal(bState.current.pack.items,undefined);
  assert.equal(aState.current.pack.itemCount,packA.items.length);
  assert.equal(bState.current.pack.itemCount,packB.items.length);
  const aPlay=await startPlay(a,aState.current.pack,{requestId:'same-play-key'});
  await b.denied(`/play/${aPlay.session.sessionId}/attempt`,{method:'POST',body:{attemptKey:'foreign-attempt',itemId:aPlay.presentation.items[0].id,response:answer(aPlay,aPlay.presentation.items[0]),hintsUsed:0,elapsedMs:100}},[404]);
  await b.denied(`/play/${aPlay.session.sessionId}/complete`,{method:'POST'},[404]);
  for(const item of aPlay.presentation.items)await submit(a,aPlay,item);
  await a.ok(`/play/${aPlay.session.sessionId}/complete`,{method:'POST'});
  await finish(b,bState.current.pack,{requestId:'same-play-key'});
  await firstManager.ok('/wallet',{method:'POST',body:{enabled:true,rateVnd:1000}});
  await secondManager.ok('/wallet',{method:'POST',body:{enabled:true,rateVnd:1000}});
  const wish=await a.ok('/redemptions',{method:'POST',body:{requestId:'tenant-a-only-wish',title:'Bút màu',goalVnd:2000}});
  await secondManager.denied(`/redemptions/${wish.requestId}/transition`,{method:'POST',body:{status:'approved'}},[404]);
  await b.denied(`/redemptions/${wish.requestId}/cancel`,{method:'POST'},[404]);
  assert.equal((await firstManager.ok('/dashboard')).redemptions.length,1);
  assert.equal((await secondManager.ok('/dashboard')).redemptions.length,0);
  assert.equal((await b.ok('/student')).balance.available,3);
});

test('online raw responses are graded by the host, retries commit once and pack revisions cannot multiply stars',async t=>{
  const f=await fixture(t),manager=await f.bootstrap(),classroom=await makeClass(manager);
  const student=await makeStudent(manager,classroom.id,'learner');
  await publish(manager,classroom.id);
  const learner=f.client();await login(learner,'learner');
  const state=await learner.ok('/student'),play=await startPlay(learner,state.current.pack,{requestId:'raw-evidence'});
  await learner.denied(`/play/${play.session.sessionId}/complete`,{method:'POST'},[400,409]);
  const first=play.presentation.items[0];
  const forged=await learner.request(`/play/${play.session.sessionId}/attempt`,{method:'POST',body:{attemptKey:'forged-outcome',itemId:first.id,response:answer(play,first,false),hintsUsed:0,elapsedMs:100,correct:true,stars:100000,profileId:'another-student'}});
  if(forged.ok)assert.equal(forged.data.event.correct,false);
  else assert.equal(forged.status,400);
  await learner.ok(`/play/${play.session.sessionId}/abandon`,{method:'POST'});
  const perfect=await startPlay(learner,state.current.pack,{requestId:'perfect-evidence'});
  const item=perfect.presentation.items[0],receipt=await submit(learner,perfect,item,{attemptKey:'stable-answer'});
  assert.equal(receipt.event.correct,true);assert.equal(receipt.duplicate,false);
  const retry=await submit(learner,perfect,item,{attemptKey:'stable-answer'});
  assert.equal(retry.duplicate,true);assert.equal(retry.event.eventId,receipt.event.eventId);
  await learner.denied(`/play/${perfect.session.sessionId}/attempt`,{method:'POST',body:{attemptKey:'stable-answer',itemId:item.id,response:answer(perfect,item,false),hintsUsed:0,elapsedMs:100}},[409]);
  for(const next of perfect.presentation.items.slice(1))await submit(learner,perfect,next);
  const complete=await learner.ok(`/play/${perfect.session.sessionId}/complete`,{method:'POST'});
  assert.equal(complete.gained,3);assert.equal(complete.tier,3);assert.equal(complete.state.balance.earned,3);
  const twice=await learner.ok(`/play/${perfect.session.sessionId}/complete`,{method:'POST'});
  assert.equal(twice.gained,0);assert.equal(twice.state.balance.earned,3);
  const replay=await finish(learner,state.current.pack,{requestId:'alternate-presentation',moduleId:'word-connect'});
  assert.equal(replay.result.gained,0);assert.equal(replay.result.state.balance.earned,3);
  const revised=pairs(undefined,2);
  const revisedClass=await makeClass(manager,'Lớp dùng phiên bản mới');
  await publish(manager,revisedClass.id,{requestId:'week-revised',title:'Tuần ôn phiên bản mới',sets:[{subjectLabel:'Tự nhiên mở rộng',pack:revised}]});
  await manager.ok(`/students/${student.id}`,{method:'PATCH',body:{classId:revisedClass.id}});
  const transferred=f.client();await login(transferred,'learner');
  const revision=await finish(transferred,revised,{requestId:'revised-presentation',moduleId:'memory-match'});
  assert.equal(revision.result.gained,0);assert.equal(revision.result.state.balance.earned,3);
});

test('online weekly progression requires every question to pass and a manual advance before closing the old week',async t=>{
  const f=await fixture(t),manager=await f.bootstrap(),classroom=await makeClass(manager);
  await makeStudent(manager,classroom.id,'weekly-learner');
  const first=pairs('nature-first'),second=pairs('safety-first'),future=pairs('creative-next');
  for(const[source,content]of[[second,[['Trước khi qua đường cần làm gì?','Quan sát hai bên'],['Đi xe đạp nên đội gì?','Mũ bảo hiểm'],['Thấy lửa lớn cần gọi ai?','Người lớn'],['Sau khi ăn cần bỏ rác ở đâu?','Thùng rác']]],[future,[['Màu xanh trộn vàng thành gì?','Xanh lá'],['Gấp giấy dùng thao tác nào?','Miết nếp'],['Dán giấy cần vật liệu gì?','Keo dán'],['Để vẽ nét thẳng dùng gì?','Thước kẻ']]]]){
    source.items=source.items.map((item,index)=>({...item,left:content[index][0],right:content[index][1]}));
  }
  await publish(manager,classroom.id,{sets:[{subjectLabel:'Tự nhiên',pack:first},{subjectLabel:'Kỹ năng sống',pack:second}]});
  await publish(manager,classroom.id,{requestId:'week-02',title:'Tuần sáng tạo',sets:[{subjectLabel:'Sáng tạo',pack:future}]});
  const learner=f.client();await login(learner,'weekly-learner');
  let state=await learner.ok('/student');
  assert.deepEqual(state.weeks.map(week=>week.unlocked),[true,false]);
  await learner.denied('/play',{method:'POST',body:{requestId:'skip-week',moduleId:'math-quest',packId:future.id,contentVersion:1}},[403,409]);
  async function learn(pack,requestId,poor=false){const play=await learner.ok('/play/compact',{method:'POST',body:{requestId,moduleId:'memory-match',packId:pack.id,contentVersion:pack.version}});
    const pair=(a,b,key)=>learner.ok(`/play/${play.session.sessionId}/attempt`,{method:'POST',body:{attemptKey:key,itemId:b,response:{kind:'pair',first:{itemId:a,side:'left'},second:{itemId:b,side:'right'}},hintsUsed:0,elapsedMs:1}});
    if(poor)for(let i=0;i<2;i++)await pair(pack.items[0].id,pack.items[1].id,'wrong-'+i);
    for(const item of pack.items)await pair(item.id,item.id,'right-'+item.id);
    return learner.ok(`/play/${play.session.sessionId}/complete-compact`,{method:'POST'});}
  const low=await learn(first,'one-star',true);
  assert.equal(low.gained,0);assert.equal(low.state.current.pack.id,first.id);assert.equal(low.state.current.questionProgress.one,2);
  assert.equal(low.state.weeks[1].unlocked,false);
  await learn(first,'first-set-passed');
  state=await learner.ok('/student');
  assert.equal(state.current.pack.id,second.id);assert.equal(state.current.subjectLabel,'Kỹ năng sống');
  assert.equal(state.weeks[0].done,false);assert.equal(state.weeks[1].unlocked,false);
  await learn(second,'second-set-passed');
  state=await learner.ok('/student');
  assert.equal(state.weeks[0].done,true);assert.equal(state.weeks[1].unlocked,false);assert.equal(state.currentWeekSummary.ready,true);
  state=await learner.ok('/student/advance-week',{method:'POST',body:{weekId:state.weeks[0].id,requestId:'confirmed-next-week'}});
  assert.equal(state.weeks[0].id,state.currentWeekSummary.weekId);assert.equal(state.weeks[0].unlocked,true);
  assert.equal(state.current.pack.id,future.id);assert.equal(state.current.subjectLabel,'Sáng tạo');
});

test('online redemptions reserve stars atomically and survive restart with decisions and locked rates',async t=>{
  const f=await fixture(t),manager=await f.bootstrap(),classroom=await makeClass(manager);
  const student=await makeStudent(manager,classroom.id,'redeemer');
  await makeStudent(manager,classroom.id,'other-redeemer');
  await publish(manager,classroom.id);
  await manager.ok('/wallet',{method:'POST',body:{enabled:true,rateVnd:1000}});
  const learner=f.client(),other=f.client();await login(learner,'redeemer');await login(other,'other-redeemer');
  await finish(learner,(await learner.ok('/student')).current.pack);
  for(const requestId of [undefined,null,{},[]]){
    await learner.denied('/redemptions',{method:'POST',body:{...(requestId===undefined?{}:{requestId}),title:'Mã yêu cầu không hợp lệ',goalVnd:1000}},[400]);
  }
  assert.equal((await learner.ok('/student')).requests.length,0);
  const request=id=>({method:'POST',body:{requestId:id,title:'Bút màu',goalVnd:2000}});
  const concurrent=await Promise.all([learner.request('/redemptions',request('wish-a')),learner.request('/redemptions',request('wish-b'))]);
  assert.equal(concurrent.filter(result=>result.ok).length,1);
  assert.ok(concurrent.filter(result=>!result.ok).every(result=>[400,409].includes(result.status)));
  const pending=concurrent.find(result=>result.ok).data;
  assert.equal(pending.stars,2);assert.equal(pending.rateVnd,1000);assert.equal(pending.amountVnd,2000);
  let state=await learner.ok('/student');
  assert.deepEqual(state.balance,{earned:3,available:1,pending:2,redeemed:0});
  const duplicate=await learner.ok('/redemptions',{method:'POST',body:{requestId:pending.requestId,title:'Bút màu',goalVnd:2000}});
  assert.equal(duplicate.requestId,pending.requestId);
  assert.equal((await learner.ok('/student')).requests.length,1);
  await other.denied(`/redemptions/${pending.requestId}/cancel`,{method:'POST'},[403,404]);
  await learner.denied(`/redemptions/${pending.requestId}/transition`,{method:'POST',body:{status:'approved'}},[403]);
  await manager.ok(`/redemptions/${pending.requestId}/transition`,{method:'POST',body:{status:'rejected',note:'Chọn lại món quà'}});
  assert.equal((await learner.ok('/student')).balance.available,3);
  const accepted=await learner.ok('/redemptions',request('accepted-wish'));
  await manager.ok('/wallet',{method:'POST',body:{enabled:true,rateVnd:5000}});
  const approved=await manager.ok(`/redemptions/${accepted.requestId}/transition`,{method:'POST',body:{status:'approved',note:'Đồng ý'}});
  assert.equal(approved.rateVnd,1000);assert.equal(approved.amountVnd,2000);
  await learner.denied(`/redemptions/${accepted.requestId}/cancel`,{method:'POST'},[400,409]);
  await manager.ok(`/redemptions/${accepted.requestId}/transition`,{method:'POST',body:{status:'fulfilled',note:'Đã trao'}});
  state=await learner.ok('/student');assert.deepEqual(state.balance,{earned:3,available:1,pending:0,redeemed:2});
  await f.restart();
  const restoredManager=f.client(),restoredLearner=f.client();
  await login(restoredManager,'manager',managerPassword);await login(restoredLearner,'redeemer');
  const restored=await restoredLearner.ok('/student');
  assert.deepEqual(restored.balance,state.balance);
  assert.equal(restored.requests.length,2);
  assert.equal(restored.requests.find(row=>row.requestId===accepted.requestId).history.at(-1).status,'fulfilled');
  assert.equal(restored.wallet.rateVnd,5000);
  const dashboard=await restoredManager.ok('/dashboard');
  assert.equal(dashboard.students.find(row=>row.id===student.id).balance.redeemed,2);
});

test('online student suspension and credential reset revoke existing access',async t=>{
  const f=await fixture(t),manager=await f.bootstrap(),classroom=await makeClass(manager);
  const student=await makeStudent(manager,classroom.id,'managed-student');
  const learner=f.client();await login(learner,'managed-student');
  await manager.ok(`/students/${student.id}`,{method:'PATCH',body:{active:false}});
  await learner.denied('/student',{},[401,403]);
  await f.client().denied('/login',{method:'POST',body:{username:'managed-student',password:studentPassword}},[401,403]);
  await manager.ok(`/students/${student.id}`,{method:'PATCH',body:{active:true}});
  const returned=f.client();await login(returned,'managed-student');
  const reset=await manager.ok(`/students/${student.id}/reset-password`,{method:'POST'});
  assert.equal(reset.username,'managed-student');assert.ok(reset.password);assert.notEqual(reset.password,studentPassword);
  await returned.denied('/student',{},[401,403]);
  await f.client().denied('/login',{method:'POST',body:{username:'managed-student',password:studentPassword}},[401]);
  const fresh=f.client();await login(fresh,'managed-student',reset.password);
  assert.equal((await fresh.ok('/student')).student.id,student.id);
});

test('online an in-flight old password check cannot restore access after an administrative reset',async t=>{
  const f=await fixture(t),manager=await f.bootstrap(),classroom=await makeClass(manager);
  await makeStudent(manager,classroom.id,'credential-race-student');
  const db=f.database(),key=createHash('sha256').update('user:credential-race-student').digest('hex');
  const client=f.client(),pending=client.request('/login',{method:'POST',body:{username:'credential-race-student',password:studentPassword}});
  // The persisted rate-limit entry is written immediately before asynchronous
  // password verification. Change credentials while that verification is pending.
  const deadline=Date.now()+3000;
  while(!db.prepare('SELECT key FROM login_limits WHERE key=?').get(key)){
    assert.ok(Date.now()<deadline,'The login request did not reach password verification');
    await delay(1);
  }
  const managerHash=db.prepare("SELECT password_hash FROM users WHERE username='manager'").get().password_hash;
  db.prepare("UPDATE users SET password_hash=? WHERE username='credential-race-student'").run(managerHash);
  const result=await pending;
  assert.equal(result.status,401,'A verified hash snapshot must still match the current credentials before creating a session');
  await client.denied('/me',{},[401]);
});

test('online authenticated chunked mutations cannot outlive reset or suspension while the body is pending',async t=>{
  for(const action of['reset-password','suspend'])await t.test(action,async sub=>{
    const f=await fixture(sub),manager=await f.bootstrap(),classroom=await makeClass(manager);
    const student=await makeStudent(manager,classroom.id,`slow-${action}`);await publish(manager,classroom.id);
    const learner=f.client();await login(learner,student.username);
    const slow=slowPost(f,learner,'/play',{requestId:`slow-${action}`,moduleId:'math-quest',packId:pairs().id,contentVersion:1});
    sub.after(()=>slow.destroy());
    await slow.started;
    if(action==='reset-password')await manager.ok(`/students/${student.id}/reset-password`,{method:'POST'});
    else await manager.ok(`/students/${student.id}`,{method:'PATCH',body:{active:false}});
    slow.finish();
    assert.equal((await slow.response).status,401,'The cookie must still be valid after the request body finishes');
    assert.equal(f.database().prepare('SELECT count(*) AS n FROM plays WHERE student_id=?').get(student.id).n,0);
  });
});

test('online repeated failed logins are limited by normalized account and remain limited after restart',async t=>{
  const f=await fixture(t);await f.bootstrap();
  const client=f.client();
  for(let attempt=0;attempt<12;attempt++){
    await client.denied('/login',{method:'POST',body:{username:'unknown-student',password:'Invalid-test-password!'}},[401]);
  }
  await client.denied('/login',{method:'POST',body:{username:'UNKNOWN-STUDENT',password:'Invalid-test-password!'}},[429]);
  await f.restart();
  await f.client().denied('/login',{method:'POST',body:{username:'unknown-student',password:'Invalid-test-password!'}},[429]);
  const manager=f.client();await login(manager,'manager',managerPassword);
  assert.equal((await manager.ok('/me')).user.role,'admin');
});

test('online image and audio uploads verify type, enforce assignment ownership and support private byte ranges',async t=>{
  const f=await fixture(t),manager=await f.bootstrap(),otherManager=await provisionManager(f);
  const classroom=await makeClass(manager,'Lớp có hình và âm thanh'),unassignedClass=await makeClass(manager,'Lớp chưa được giao');
  await makeStudent(manager,classroom.id,'media-learner');await makeStudent(manager,unassignedClass.id,'unassigned-learner');
  const learner=f.client(),unassigned=f.client();await login(learner,'media-learner');await login(unassigned,'unassigned-learner');
  const imageBytes=await readFile(path.join(projectRoot,'public','icons','bao-an-192.png'));
  const audioBytes=waveFixture();
  const image=await manager.ok('/media',{method:'POST',body:{name:'nature.png',mime:'image/png',base64:imageBytes.toString('base64')}});
  const audio=await manager.ok('/media',{method:'POST',body:{name:'greeting.wav',mime:'audio/wav',base64:audioBytes.toString('base64')}});
  assert.equal(image.kind,'image');assert.equal(image.mime,'image/png');assert.equal(image.size,imageBytes.length);
  assert.equal(image.sha256,createHash('sha256').update(imageBytes).digest('hex'));
  assert.equal(audio.kind,'audio');assert.equal(audio.sha256,createHash('sha256').update(audioBytes).digest('hex'));
  const duplicate=await manager.ok('/media',{method:'POST',body:{name:'nature.png',mime:'image/png',base64:imageBytes.toString('base64')}});
  assert.equal(duplicate.id,image.id);
  await manager.denied('/media',{method:'POST',body:{name:'fake.png',mime:'image/png',base64:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>').toString('base64')}},[400]);
  await manager.denied('/media',{method:'POST',body:{name:'wrong-type.wav',mime:'audio/wav',base64:imageBytes.toString('base64')}},[400]);
  await learner.denied('/media',{method:'POST',body:{name:'forbidden.png',mime:'image/png',base64:imageBytes.toString('base64')}},[403]);
  await f.client().denied(`/media/${image.id}`,{},[401]);
  await learner.denied(`/media/${image.id}`,{},[404]);
  await otherManager.denied(`/media/${image.id}`,{},[404]);
  const pack=pairs('media-questions');
  pack.items[0].media={imageId:image.id,imageAlt:'Hình minh họa khu vườn',audioId:audio.id,audioTranscript:'Hello. My name is Lucy. I am nine.'};
  const missing=pairs('missing-media-questions');missing.items[0].media={imageId:randomUUID(),imageAlt:'Hình chưa tải lên'};
  await manager.denied('/weeks',{method:'POST',body:{requestId:'missing-media-week',title:'Không xuất bản một phần',classId:classroom.id,sets:[{subjectLabel:'Hình ảnh',pack:pairs('rolled-back-media-pack')},{subjectLabel:'Thiếu hình',pack:missing}]}},[400]);
  assert.equal((await manager.ok('/dashboard')).weeks.length,0);
  assert.equal((await manager.ok('/dashboard')).stats.questions,0);
  await publish(manager,classroom.id,{sets:[{subjectLabel:'Tự nhiên có minh họa',pack}]});
  const whole=await mediaBytes(learner,image.id);
  assert.equal(whole.status,200);assert.equal(whole.headers.get('content-type'),'image/png');assert.deepEqual(whole.bytes,imageBytes);
  const range=await mediaBytes(learner,audio.id,{range:'bytes=0-15'});
  assert.equal(range.status,206);assert.equal(range.headers.get('content-range'),`bytes 0-15/${audioBytes.length}`);
  assert.equal(range.headers.get('accept-ranges'),'bytes');assert.deepEqual(range.bytes,audioBytes.subarray(0,16));
  const suffix=await mediaBytes(learner,audio.id,{range:'bytes=-16'});
  assert.equal(suffix.status,206);assert.deepEqual(suffix.bytes,audioBytes.subarray(-16));
  const head=await mediaBytes(learner,audio.id,{method:'HEAD'});
  assert.equal(head.status,200);assert.equal(Number(head.headers.get('content-length')),audioBytes.length);assert.equal(head.bytes.length,0);
  await learner.denied(`/media/${audio.id}`,{headers:{Range:`bytes=${audioBytes.length}-`}},[416]);
  await unassigned.denied(`/media/${audio.id}`,{},[404]);
  assert.equal((await manager.ok('/media')).length,2);
  assert.equal((await otherManager.ok('/media')).length,0);
});

test('online rich image, numeric, reading and listening exercises complete through server-scored HTTP evidence',async t=>{
  const f=await fixture(t),manager=await f.bootstrap(),classroom=await makeClass(manager,'Lớp luyện mở rộng');
  await makeStudent(manager,classroom.id,'rich-http-learner');
  const imageBytes=await readFile(path.join(projectRoot,'public','icons','bao-an-192.png'));
  const audioBytes=waveFixture();
  const image=await manager.ok('/media',{method:'POST',body:{name:'rich-question.png',mime:'image/png',base64:imageBytes.toString('base64')}});
  const audio=await manager.ok('/media',{method:'POST',body:{name:'rich-question.wav',mime:'audio/wav',base64:audioBytes.toString('base64')}});
  const publishedAt='2026-10-15T00:00:00.000Z',common={objectiveId:'RICH3.HTTP',hint:'Đọc hoặc nghe lại đề.',explanation:'Đối chiếu nội dung đã học.'};
  const pack={id:'rich-http-exercises',version:1,title:'Luyện đủ dạng bài',subject:'thinking',grade:3,source:'local',publishedAt,kind:'learning',contentFormatVersion:2,
    passages:[{passageId:'garden-reading',title:'Vườn nhà',body:'Trong vườn có hai cây xanh.',source:'Tự biên soạn',rights:'Được phép sử dụng',approvedAt:publishedAt}],
    media:[{mediaId:audio.id,kind:'audio',url:`/audio/${audio.id}.wav`,sha256:audio.sha256,transcript:'Hello. My name is Lucy. I am nine.',source:'Tự biên soạn',rights:'Được phép sử dụng',approvedAt:publishedAt}],
    items:[
      {...common,id:'rich-number',kind:'numeric-answer',prompt:'Hai cây được viết bằng số nào?',answer:'2',media:{imageId:image.id,imageAlt:'Hình minh họa hai cây'}},
      {...common,id:'rich-reading',kind:'reading-choice',prompt:'Trong vườn có bao nhiêu cây?',passageId:'garden-reading',options:['Một','Hai','Ba','Bốn'],correctIndex:1},
      {...common,id:'rich-listening',kind:'listening-gap',prompt:'Nghe và điền tên: My name is ___.',audioId:audio.id,acceptedAnswers:['Lucy'],caseSensitive:false},
    ]};
  const week=await publish(manager,classroom.id,{sets:[{subjectLabel:'Tổng hợp: đọc, nghe và trả lời',pack}]});
  assert.deepEqual(week.sets[0].games.map(game=>game.id),['math-quest']);
  const learner=f.client();await login(learner,'rich-http-learner');
  await learner.denied('/play',{method:'POST',body:{requestId:'unsupported-rich-game',moduleId:'memory-match',packId:pack.id,contentVersion:1}},[400]);
  const play=await startPlay(learner,(await learner.ok('/student')).current.pack,{requestId:'rich-raw-http'});
  assert.equal(play.presentation.kind,'learning');
  assert.equal(play.presentation.items[0].media.imageId,image.id);
  const numeric=await submit(learner,play,play.presentation.items[0],{response:{kind:'text',value:'+0002,000'}});
  assert.equal(numeric.event.correct,true);
  for(const item of play.presentation.items.slice(1))assert.equal((await submit(learner,play,item)).event.correct,true);
  const result=await learner.ok(`/play/${play.session.sessionId}/complete`,{method:'POST'});
  assert.equal(result.gained,3);assert.equal(result.tier,3);assert.equal(result.state.balance.earned,3);
  assert.equal((await mediaBytes(learner,audio.id,{range:'bytes=0-15'})).status,206);
});
