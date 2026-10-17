import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {createCloudApi} from '../server/cloud-api.mjs';
import {createPostgresFixture} from './helpers/postgres-fixture.mjs';
import {waveFixture} from './helpers/media-fixture.mjs';

const origin='https://baoan.example.test',setupToken='cloud-fixture-setup-token-2026-private';
const managerPassword='Manager-cloud-password-2026!',studentPassword='Student-cloud-password-2026!';
class Client{
  constructor(api){this.api=api;this.cookie='';this.csrf='';}
  async request(route,{method='GET',body,csrf=this.csrf,requestOrigin=origin,headers={},binary=false}={}){
    const mutable=!['GET','HEAD'].includes(method),h={...headers};if(this.cookie)h.Cookie=this.cookie;
    if(mutable){h['Content-Type']='application/json';if(requestOrigin!==null)h.Origin=requestOrigin;if(csrf)h['X-CSRF-Token']=csrf;}
    const response=await this.api(new Request(`${origin}/api/online${route}`,{method,headers:h,...(mutable?{body:JSON.stringify(body??{})}:{})}),{ip:'192.0.2.100'});
    assert.match(response.headers.get('cache-control')??'',/no-store/);assert.equal(response.headers.get('netlify-cdn-cache-control'),'no-store');
    const cookies=response.headers.getSetCookie();if(cookies.length)this.cookie=cookies.map(value=>value.split(';',1)[0]).join('; ');
    const data=binary?Buffer.from(await response.arrayBuffer()):await response.json();
    if(response.ok&&typeof data.csrfToken==='string')this.csrf=data.csrfToken;
    return{status:response.status,ok:response.ok,headers:response.headers,data};
  }
  async ok(route,options){const result=await this.request(route,options);assert.ok(result.ok,`${route}: ${result.status} ${JSON.stringify(result.data)}`);return result.data;}
  async denied(route,options,status){assert.equal((await this.request(route,options)).status,status);}
}
async function fixture(t){
  const f=await createPostgresFixture(t,{bootstrap:false}),objects=new Map(),removed=[];
  const storage={async upload(path,bytes,mime){assert.ok(!objects.has(path));objects.set(path,{bytes:Buffer.from(bytes),mime});},async download(path){assert.ok(objects.has(path));return Buffer.from(objects.get(path).bytes);},async remove(path){removed.push(path);objects.delete(path);}};
  const api=createCloudApi({store:f.store,storage,publicOrigin:origin,setupToken});
  return{...f,api,objects,removed,storage,client:()=>new Client(api)};
}
async function bootstrap(f){const manager=f.client();await manager.ok('/setup',{method:'POST',body:{token:setupToken,name:'Lớp học trên máy chủ',username:'manager',password:managerPassword}});return manager;}
async function classroom(manager,name='Lớp tự nhiên'){return manager.ok('/classes',{method:'POST',body:{name,grade:3}});}
async function student(manager,classId,username){return manager.ok('/students',{method:'POST',body:{classId,name:username,username,password:studentPassword}});}
async function login(client,username,password=studentPassword){return client.ok('/login',{method:'POST',body:{username,password}});}

test('cloud batches sixteen audio uploads in one transaction, deduplicates retries and validates the entire batch',async t=>{
  const f=await fixture(t),manager=await bootstrap(f),files=Array.from({length:16},(_,i)=>({name:`audio-${i}.wav`,mime:'audio/wav',base64:waveFixture().toString('base64')}));
  let commits=0;const transaction=f.store.transaction.bind(f.store);f.store.transaction=async action=>{commits++;return transaction(action);};
  const assets=await manager.ok('/media/batch',{method:'POST',body:{files}});assert.equal(assets.length,16);assert.equal(commits,1);assert.equal(f.objects.size,16);
  assert.equal((await manager.ok('/media')).length,16);assert.equal((await f.store.rows("SELECT id FROM bao_an.audit WHERE action='media.upload'")).length,16);
  assert.deepEqual(await manager.ok('/media/batch',{method:'POST',body:{files}}),assets);assert.equal(commits,1);assert.equal(f.objects.size,16);
  const concurrentFiles=files.slice(0,2).map(file=>({...file,name:'new-'+file.name}));
  const [a,b]=await Promise.all([manager.ok('/media/batch',{method:'POST',body:{files:concurrentFiles}}),manager.ok('/media/batch',{method:'POST',body:{files:concurrentFiles}})]);
  assert.deepEqual(a,b);assert.equal(f.objects.size,18);assert.equal((await manager.ok('/media')).length,18);
  for(const invalid of [[],Array(25).fill(files[0]),[{...files[0],mime:'image/png'}],[{...files[0],name:'valid.wav'},{...files[1],base64:'invalid'}]])await manager.denied('/media/batch',{method:'POST',body:{files:invalid}},400);
  const large=Buffer.alloc(1100000);waveFixture().copy(large);await manager.denied('/media/batch',{method:'POST',body:{files:[0,1].map(i=>({name:`large-${i}.wav`,mime:'audio/wav',base64:large.toString('base64')}))}},400);
  assert.equal(f.objects.size,18);
  const cls=await classroom(manager);await student(manager,cls.id,'batch-child');const child=f.client();await login(child,'batch-child');await child.denied('/media/batch',{method:'POST',body:{files}},403);
  await manager.denied('/media/batch',{method:'POST',body:{files},csrf:'wrong'},403);
});

test('cloud batch failures roll back metadata and clean uploaded objects; logout during upload cannot commit',async t=>{
  const f=await fixture(t),manager=await bootstrap(f),files=Array.from({length:4},(_,i)=>({name:`fail-${i}.wav`,mime:'audio/wav',base64:waveFixture().toString('base64')}));
  const first=f.store.addMediaBatch.bind(f.store),exec=f.store.exec.bind(f.store);
  f.store.exec=async(sql,...args)=>{if(sql.includes('INSERT INTO bao_an.audit')&&sql.includes('jsonb_to_recordset'))throw new Error('Simulated audit failure after media insert');return exec(sql,...args);};
  await manager.denied('/media/batch',{method:'POST',body:{files}},500);assert.equal(f.objects.size,0);assert.equal((await manager.ok('/media')).length,0);
  f.store.exec=exec;const upload=f.storage.upload;let calls=0;f.storage.upload=async(...args)=>{if(++calls===2)throw new Error('Simulated storage failure');return upload(...args);};
  await manager.denied('/media/batch',{method:'POST',body:{files}},500);assert.equal(f.objects.size,0);assert.equal((await manager.ok('/media')).length,0);f.storage.upload=upload;
  f.store.addMediaBatch=async(...args)=>{await manager.ok('/logout',{method:'POST'});return first(...args);};
  await manager.denied('/media/batch',{method:'POST',body:{files}},401);assert.equal(f.objects.size,0);assert.equal((await f.store.rows('SELECT id FROM bao_an.media')).length,0);
});

async function pendingBody(f,client,route){
  let controller,authenticated;
  const entered=new Promise(resolve=>{authenticated=resolve;}),find=f.store.findSession.bind(f.store);
  f.store.findSession=async(...args)=>{const result=await find(...args);authenticated();return result;};
  const stream=new ReadableStream({start(value){controller=value;}});
  const response=f.api(new Request(origin+'/api/online'+route,{method:'POST',duplex:'half',body:stream,
    headers:{Origin:origin,'Content-Type':'application/json',Cookie:client.cookie,'X-CSRF-Token':client.csrf}}));
  await entered;f.store.findSession=find;
  return async body=>{controller.enqueue(new TextEncoder().encode(JSON.stringify(body)));controller.close();return response;};
}

test('cloud pending mutations cannot outlive logout or session expiry',async t=>{
  const f=await fixture(t),manager=await bootstrap(f);
  for(const reason of ['logout','expiry']){
    if(reason==='expiry')await login(manager,'manager',managerPassword);
    const finish=await pendingBody(f,manager,'/classes');
    if(reason==='logout')await manager.ok('/logout',{method:'POST'});
    else await f.store.exec('UPDATE bao_an.auth_sessions SET expires_at=0');
    const response=await finish({name:'Must not be committed',grade:3});
    assert.equal(response.status,401,reason);
    assert.equal((await f.store.rows('SELECT id FROM bao_an.classes')).length,0);
  }
});

test('cloud pending student play cannot outlive a password reset',async t=>{
  const f=await fixture(t),manager=await bootstrap(f),cls=await classroom(manager),created=await student(manager,cls.id,'pending-child'),source=pack();
  await manager.ok('/weeks',{method:'POST',body:{requestId:'pending-week',title:'Pending week',classId:cls.id,sets:[{subjectLabel:'Nature',pack:source}]}});
  const learner=f.client();await login(learner,'pending-child');
  const finish=await pendingBody(f,learner,'/play');
  await manager.ok(`/students/${created.student.id}/reset-password`,{method:'POST'});
  const response=await finish({requestId:'pending-play',moduleId:'math-quest',packId:source.id,contentVersion:1});
  assert.equal(response.status,401);
  assert.equal((await f.store.rows('SELECT id FROM bao_an.plays')).length,0);
});
function pack(){return{id:'cloud-nature-questions',version:1,title:'Tự nhiên',subject:'thinking',grade:3,source:'local',publishedAt:'2026-10-15T00:00:00.000Z',kind:'pairs',items:[['Cây cần gì?','Ánh sáng'],['Nước đông thành gì?','Nước đá'],['Vật gì có cánh?','Máy bay'],['Hành tinh chúng ta sống?','Trái Đất']].map(([left,right],index)=>({id:`cloud-item-${index}`,objectiveId:'NATURE3.CLOUD',kind:'pair',left,right}))};}

test('cloud Request/Response API preserves real scrypt authentication, CSRF, gameplay and atomic reward accounting',async t=>{
  const f=await fixture(t),anonymous=f.client();
  assert.equal((await anonymous.ok('/status')).configured,false);
  await anonymous.denied('/dashboard',{},401);
  await anonymous.denied('/setup',{method:'POST',body:{token:setupToken,name:'School',username:'manager',password:managerPassword},requestOrigin:null},403);
  const manager=f.client(),setup=await manager.request('/setup',{method:'POST',body:{token:setupToken,name:'Cloud test',username:'manager',password:managerPassword}});
  assert.equal(setup.status,201);assert.match(setup.headers.get('set-cookie'),/HttpOnly/);assert.match(setup.headers.get('set-cookie'),/Secure/);assert.match(setup.headers.get('set-cookie'),/SameSite=Lax/);
  const stored=await f.store.findUserByUsername('manager');assert.notEqual(stored.password_hash,managerPassword);assert.match(stored.password_hash,/^[a-f0-9]+:[a-f0-9]+$/);
  await manager.denied('/classes',{method:'POST',body:{name:'No CSRF',grade:3},csrf:null},403);
  await manager.denied('/classes',{method:'POST',body:{name:'Foreign origin',grade:3},requestOrigin:'https://foreign.invalid'},403);
  const cls=await classroom(manager),created=await student(manager,cls.id,'cloud-learner');
  assert.equal(created.credentials.password,studentPassword);
  const source=pack(),week={requestId:'cloud-week',title:'Tuần tự nhiên',classId:cls.id,sets:[{subjectLabel:'Tự nhiên',pack:source}]};
  const published=await manager.ok('/weeks',{method:'POST',body:week});assert.equal((await manager.ok('/weeks',{method:'POST',body:week})).id,published.id);
  const learner=f.client();await login(learner,'cloud-learner');await learner.denied('/dashboard',{},403);
  assert.equal((await learner.ok('/student')).current.subjectLabel,'Tự nhiên');
  const play=await learner.ok('/play',{method:'POST',body:{requestId:'cloud-play',moduleId:'math-quest',packId:source.id,contentVersion:1}});
  for(const item of play.presentation.items){const input={attemptKey:`answer-${item.id}`,itemId:item.id,response:{kind:'choice',choiceIndex:item.correctIndex},hintsUsed:0,elapsedMs:100};
    const receipt=await learner.ok(`/play/${play.session.sessionId}/attempt`,{method:'POST',body:input});assert.equal(receipt.event.correct,true);
    if(item===play.presentation.items[0])assert.equal((await learner.ok(`/play/${play.session.sessionId}/attempt`,{method:'POST',body:input})).duplicate,true);
  }
  const completed=await learner.ok(`/play/${play.session.sessionId}/complete`,{method:'POST'});assert.equal(completed.gained,3);
  assert.equal((await learner.ok(`/play/${play.session.sessionId}/complete`,{method:'POST'})).gained,0);
  await manager.ok('/wallet',{method:'POST',body:{enabled:true,rateVnd:1000}});
  const wishes=await Promise.all(['wish-a','wish-b'].map(requestId=>learner.request('/redemptions',{method:'POST',body:{requestId,title:'Bút màu',goalVnd:2000}})));
  assert.deepEqual(wishes.map(row=>row.status).sort(),[201,400]);const wish=wishes.find(row=>row.ok).data;
  assert.deepEqual((await learner.ok('/student')).balance,{earned:3,available:1,pending:2,redeemed:0});
  await learner.denied(`/redemptions/${wish.requestId}/transition`,{method:'POST',body:{status:'approved'}},403);
  for(const note of ['x'.repeat(301),{text:'invalid'},null,'line\nbreak','control\u0000']){
    await manager.denied(`/redemptions/${wish.requestId}/transition`,{method:'POST',body:{status:'approved',note}},409);
    assert.equal((await learner.ok('/student')).requests[0].history.length,1);
  }
  const approved=await manager.ok(`/redemptions/${wish.requestId}/transition`,{method:'POST',body:{status:'approved',note:'Đ'.repeat(300)}});
  assert.equal(approved.history.at(-1).note,'Đ'.repeat(300));
  await manager.ok(`/redemptions/${wish.requestId}/transition`,{method:'POST',body:{status:'fulfilled'}});
  assert.deepEqual((await learner.ok('/student')).balance,{earned:3,available:1,pending:0,redeemed:2});
  const reset=await manager.ok(`/students/${created.student.id}/reset-password`,{method:'POST'});
  await learner.denied('/student',{},401);await learner.denied('/login',{method:'POST',body:{username:'cloud-learner',password:studentPassword}},401);
  await login(learner,'cloud-learner',reset.password);const oldCookie=learner.cookie;await learner.ok('/logout',{method:'POST'});
  learner.cookie=oldCookie;await learner.denied('/me',{},401);
});

test('cloud private media stays assigned and tenant scoped, deduplicates concurrent uploads and supports rich exercises',async t=>{
  const f=await fixture(t),manager=await bootstrap(f),cls=await classroom(manager),otherClass=await classroom(manager,'Lớp chưa giao');
  await student(manager,cls.id,'rich-cloud-learner');await student(manager,otherClass.id,'unassigned-cloud-learner');
  const learner=f.client(),unassigned=f.client();await login(learner,'rich-cloud-learner');await login(unassigned,'unassigned-cloud-learner');
  const png=await readFile(new URL('../public/icons/bao-an-192.png',import.meta.url)),wav=waveFixture();
  const upload={name:'illustration.png',mime:'image/png',base64:png.toString('base64')};
  const images=await Promise.all([manager.ok('/media',{method:'POST',body:upload}),manager.ok('/media',{method:'POST',body:upload})]);
  assert.equal(images[0].id,images[1].id);assert.equal(f.objects.size,1);
  const image=images[0],audio=await manager.ok('/media',{method:'POST',body:{name:'greeting.wav',mime:'audio/wav',base64:wav.toString('base64')}});
  await f.client().denied(`/media/${image.id}`,{},401);await learner.denied(`/media/${image.id}`,{},404);
  await manager.denied('/media',{method:'POST',body:{name:'fake.png',mime:'image/png',base64:Buffer.from('<svg><script>alert(1)</script></svg>').toString('base64')}},400);
  await manager.denied('/media',{method:'POST',body:{name:'mismatch.wav',mime:'audio/wav',base64:png.toString('base64')}},400);
  await learner.denied('/media',{method:'POST',body:upload},403);
  const publishedAt='2026-10-15T00:00:00.000Z',common={objectiveId:'RICH3.CLOUD',hint:'Đọc hoặc nghe lại đề.',explanation:'Đối chiếu nội dung đã học.'};
  const source={id:'cloud-rich-exercises',version:1,title:'Đủ dạng bài',subject:'thinking',grade:3,source:'local',publishedAt,kind:'learning',contentFormatVersion:2,
    passages:[{passageId:'reading-cloud',title:'Vườn nhà',body:'Vườn nhà có hai cây xanh.',source:'Tự biên soạn',rights:'Được phép dùng',approvedAt:publishedAt}],
    media:[{mediaId:audio.id,kind:'audio',url:`/audio/${audio.id}.wav`,sha256:audio.sha256,transcript:'Hello. My name is Lucy. I am nine.',source:'Tự biên soạn',rights:'Được phép dùng',approvedAt:publishedAt}],
    items:[
      {...common,id:'number',kind:'numeric-answer',prompt:'Hai cây được viết bằng số nào?',answer:'2',media:{imageId:image.id,imageAlt:'Hình minh họa cây xanh'}},
      {...common,id:'fill',kind:'fill-blank',prompt:'Điền hai từ: Trong vườn có ___.',acceptedAnswers:['cây xanh'],caseSensitive:false},
      {...common,id:'reading',kind:'reading-choice',prompt:'Vườn có bao nhiêu cây?',passageId:'reading-cloud',options:['Một','Hai','Ba','Bốn'],correctIndex:1},
      {...common,id:'listen',kind:'listening-choice',prompt:'Bạn nhỏ có tên gì?',audioId:audio.id,options:['Mai','Lucy','Nam','Peter'],correctIndex:1},
      {...common,id:'gap',kind:'listening-gap',prompt:'Nghe và điền tên: My name is ___.',audioId:audio.id,acceptedAnswers:['Lucy'],caseSensitive:false},
    ]};
  const week=await manager.ok('/weeks',{method:'POST',body:{requestId:'rich-cloud-week',title:'Tuần đủ dạng',classId:cls.id,sets:[{subjectLabel:'Tổng hợp',pack:source}]}});
  assert.deepEqual(week.sets[0].games.map(row=>row.id),['math-quest']);
  const whole=await learner.request(`/media/${image.id}`,{binary:true});assert.equal(whole.status,200);assert.deepEqual(whole.data,png);
  const range=await learner.request(`/media/${audio.id}`,{headers:{Range:'bytes=0-15'},binary:true});assert.equal(range.status,206);assert.deepEqual(range.data,wav.subarray(0,16));
  const head=await learner.request(`/media/${audio.id}`,{method:'HEAD',binary:true});assert.equal(head.status,200);assert.equal(head.data.length,0);
  await unassigned.denied(`/media/${audio.id}`,{},404);
  const workspaceId=randomUUID(),userId=randomUUID(),managerRow=await f.store.findUserByUsername('manager');
  await f.pool.query('INSERT INTO bao_an.workspaces(id,name,created_at) VALUES($1,$2,$3)',[workspaceId,'Đơn vị khác',publishedAt]);
  await f.pool.query("INSERT INTO bao_an.users(id,workspace_id,username,password_hash,role,created_at) VALUES($1,$2,$3,$4,'admin',$5)",[userId,workspaceId,'other-cloud-manager',managerRow.password_hash,publishedAt]);
  const foreign=f.client();await login(foreign,'other-cloud-manager',managerPassword);await foreign.denied(`/media/${image.id}`,{},404);assert.equal((await foreign.ok('/media')).length,0);
  const play=await learner.ok('/play',{method:'POST',body:{requestId:'rich-cloud-play',moduleId:'math-quest',packId:source.id,contentVersion:1}});
  const responses=[{kind:'text',value:'+0002,00'},{kind:'text',value:'CÂY   XANH'},{kind:'choice',choiceIndex:1},{kind:'choice',choiceIndex:1},{kind:'text',value:'lucy'}];
  for(const[index,item]of play.presentation.items.entries())assert.equal((await learner.ok(`/play/${play.session.sessionId}/attempt`,{method:'POST',body:{attemptKey:`answer-${index}`,itemId:item.id,response:responses[index],hintsUsed:0,elapsedMs:100}})).event.correct,true);
  assert.equal((await learner.ok(`/play/${play.session.sessionId}/complete`,{method:'POST'})).gained,3);
  const objectPath=(await f.store.getMedia({id:managerRow.id,workspaceId:managerRow.workspace_id,username:managerRow.username,role:'admin'},audio.id)).object_path;
  const saved=f.objects.get(objectPath);f.objects.set(objectPath,{...saved,bytes:Buffer.from('corrupt media')});
  await learner.denied(`/media/${audio.id}`,{},502);f.objects.set(objectPath,saved);
});

test('cloud concurrent initial setup creates exactly one management workspace',async t=>{
  const f=await fixture(t),first=f.client(),second=f.client(),body={token:setupToken,name:'One workspace',username:'manager',password:managerPassword};
  const attempts=await Promise.all([first.request('/setup',{method:'POST',body}),second.request('/setup',{method:'POST',body})]);
  assert.deepEqual(attempts.map(row=>row.status).sort(),[201,409]);
  assert.equal(Number((await f.pool.query('SELECT count(*) AS n FROM bao_an.workspaces')).rows[0].n),1);
});
