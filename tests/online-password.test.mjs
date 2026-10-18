import {prepareSuccessfulAttempt,registerStorePlay,fixtureQuestion} from './helpers/secure-play.mjs';
import {threeSubjectSets} from './helpers/planned-weeks.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createOnlineServer} from '../server/online-server.mjs';
import {createCloudApi} from '../server/cloud-api.mjs';
import {createPostgresFixture} from './helpers/postgres-fixture.mjs';

const setupToken='password-tests-private-setup-2026';
const managerPassword='Manager-password-test-2026!';
const studentPassword='Student-password-test-2026!';
const nextPassword=' New-student-password-2026! ';

class Client{
  constructor(fixture){this.fixture=fixture;this.origin=fixture.origin;this.cookie='';this.csrf='';}
  async request(route,{method='GET',body,csrf=this.csrf,origin=this.fixture.origin}={}){
    const mutable=!['GET','HEAD'].includes(method),headers={'X-Bao-An-Question-Protocol':'1'};if(this.cookie)headers.Cookie=this.cookie;
    if(mutable){headers['Content-Type']='application/json';if(origin!==null)headers.Origin=origin;if(csrf)headers['X-CSRF-Token']=csrf;}
    const response=await this.fixture.request(route,{method,headers,...(mutable?{body:JSON.stringify(body??{})}:{})});
    const cookies=response.headers.getSetCookie();if(cookies.length)this.cookie=cookies.map(value=>value.split(';',1)[0]).join('; ');
    assert.match(response.headers.get('cache-control')??'',/no-store/);
    const data=await response.json();if(response.ok&&typeof data.csrfToken==='string')this.csrf=data.csrfToken;
    return{status:response.status,headers:response.headers,data};
  }
  async ok(route,options){await prepareSuccessfulAttempt(this,route,options);const result=await this.request(route,options);assert.ok(result.status<300,`${route}: ${result.status} ${JSON.stringify(result.data)}`);if(['/play','/play/compact'].includes(route))await registerStorePlay(this,result.data,this.fixture.store);return result.data;}
  async denied(route,options,status){const result=await this.request(route,options);assert.equal(result.status,status,`${route}: ${JSON.stringify(result.data)}`);return result;}
}

async function fixture(t,backend){
  let f;
  if(backend==='sqlite'){
    const server=createOnlineServer({databasePath:':memory:',setupToken,secureCookies:false});server.listen(0,'127.0.0.1');await once(server,'listening');
    const origin=`http://127.0.0.1:${server.address().port}`,store=server.onlineStore;
    t.after(async()=>{server.closeAllConnections();await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));server.onlineClose();});
    f={origin,store,request:(route,options)=>fetch(`${origin}/api/online${route}`,options),
      rows:(sql,values=[])=>store.db.prepare(sql.replaceAll('bao_an.','').replace(/\$\d+/g,'?')).all(...values),
      exec:(sql,values=[])=>store.db.prepare(sql.replaceAll('bao_an.','').replace(/\$\d+/g,'?')).run(...values)};
  }else{
    const pg=await createPostgresFixture(t,{bootstrap:false}),origin='https://password.example.test';
    const api=createCloudApi({store:pg.store,storage:{},publicOrigin:origin,setupToken});
    f={...pg,origin,request:(route,options)=>api(new Request(`${origin}/api/online${route}`,options),{ip:'192.0.2.111'}),
      rows:(sql,values=[])=>pg.store.rows(sql,values),exec:(sql,values=[])=>pg.store.exec(sql,values)};
  }
  f.client=()=>new Client(f);f.manager=f.client();
  await f.manager.ok('/setup',{method:'POST',body:{token:setupToken,name:'Password test class',username:'manager',password:managerPassword}});
  const cls=await f.manager.ok('/classes',{method:'POST',body:{name:'Lớp 3',grade:3}});
  f.student=await f.manager.ok('/students',{method:'POST',body:{classId:cls.id,name:'Học sinh',username:'child',password:studentPassword}});
  f.classId=cls.id;f.learner=f.client();await f.learner.ok('/login',{method:'POST',body:{username:'child',password:studentPassword}});
  return f;
}

function source(){return{id:'password-progress-pack',version:1,title:'Bảo toàn tiến độ',subject:'thinking',grade:3,source:'local',publishedAt:'2026-10-17T00:00:00.000Z',kind:'pairs',items:[['Cây','Lá'],['Chim','Cánh'],['Cá','Vây'],['Mặt trời','Ánh sáng']].map(([left,right],i)=>({id:`password-item-${i}`,objectiveId:'NATURE3.PASSWORD',kind:'pair',left,right}))};}
async function award(f){
  const pack=source();await f.manager.ok('/weeks',{method:'POST',body:{requestId:'password-week',title:'Tuần 1',classId:f.classId,sets:threeSubjectSets([{subjectLabel:'Tự nhiên',pack}])}});
  const play=await f.learner.ok('/play',{method:'POST',body:{requestId:'password-completed',moduleId:'math-quest',packId:pack.id,contentVersion:1}});
  for(const item of play.presentation.items)await f.learner.ok(`/play/${play.session.sessionId}/attempt`,{method:'POST',body:{attemptKey:item.id,itemId:item.id,response:{kind:'choice',choiceIndex:fixtureQuestion(play,item).correctIndex},hintsUsed:0,elapsedMs:100}});
  await f.learner.ok(`/play/${play.session.sessionId}/complete`,{method:'POST'});
  return f.learner.ok('/play',{method:'POST',body:{requestId:'password-active',moduleId:'math-quest',packId:pack.id,contentVersion:1}});
}

for(const backend of ['sqlite','postgres']){
  test(`${backend}: student password change preserves progress, abandons play and revokes every session`,async t=>{
    const f=await fixture(t,backend),play=await award(f),before=await f.learner.ok('/student'),second=f.client();
    await second.ok('/login',{method:'POST',body:{username:'child',password:studentPassword}});
    const firstCookie=f.learner.cookie,secondCookie=second.cookie;
    const response=await f.learner.request('/account/password',{method:'POST',body:{currentPassword:studentPassword,newPassword:nextPassword}});
    assert.equal(response.status,200);assert.deepEqual(response.data,{changed:true,reauthenticate:true});assert.match(response.headers.get('set-cookie'),/Max-Age=0/);
    const userId=(await f.rows("SELECT id FROM bao_an.users WHERE username='child'"))[0].id;
    assert.equal((await f.rows('SELECT token_hash FROM bao_an.auth_sessions WHERE user_id=$1',[userId])).length,0);
    f.learner.cookie=firstCookie;await f.learner.denied('/me',{},401);second.cookie=secondCookie;await second.denied('/me',{},401);
    await f.learner.denied('/login',{method:'POST',body:{username:'child',password:studentPassword}},401);
    await f.learner.denied('/login',{method:'POST',body:{username:'child',password:nextPassword.trim()}},401);
    await f.learner.ok('/login',{method:'POST',body:{username:'child',password:nextPassword}});
    const after=await f.learner.ok('/student');assert.deepEqual(after,before);assert.equal(after.balance.earned,3);
    await f.learner.denied(`/play/${play.session.sessionId}/complete`,{method:'POST'},409);
    assert.equal((await f.rows("SELECT action FROM bao_an.audit WHERE action='student.change-password'")).length,1);
    const user=(await f.rows("SELECT password_hash FROM bao_an.users WHERE username='child'"))[0];assert.match(user.password_hash,/^[a-f0-9]+:[a-f0-9]+$/);assert.notEqual(user.password_hash,nextPassword);
  });

  test(`${backend}: password change validates the current user, origin, CSRF and untrimmed password bounds`,async t=>{
    const f=await fixture(t,backend),input={currentPassword:studentPassword,newPassword:nextPassword};
    await f.client().denied('/account/password',{method:'POST',body:input},401);
    await f.manager.denied('/account/password',{method:'POST',body:input},403);
    await f.learner.denied('/account/password',{method:'POST',body:input,origin:'https://foreign.invalid'},403);
    await f.learner.denied('/account/password',{method:'POST',body:input,csrf:'invalid'},403);
    const wrong=await f.learner.denied('/account/password',{method:'POST',body:{...input,currentPassword:'Wrong-current-password-2026'}},400);assert.match(wrong.data.error,/hiện tại/);
    assert.equal((await f.learner.ok('/me')).user.username,'child');
    for(const body of [{...input,newPassword:studentPassword},{...input,newPassword:'short'},{...input,newPassword:'x'.repeat(129)},{...input,newPassword:null},{...input,currentPassword:10},{...input,studentId:'other-student'}])await f.learner.denied('/account/password',{method:'POST',body},400);
    const exact=' '+ 'x'.repeat(8)+' ';await f.learner.ok('/account/password',{method:'POST',body:{currentPassword:studentPassword,newPassword:exact}});
    await f.learner.ok('/login',{method:'POST',body:{username:'child',password:exact}});
  });

  test(`${backend}: password attempts have a shared per-student quota separate from login`,async t=>{
    const f=await fixture(t,backend),second=f.client();await second.ok('/login',{method:'POST',body:{username:'child',password:studentPassword}});
    for(let i=0;i<12;i++)await(i%2?second:f.learner).denied('/account/password',{method:'POST',body:{currentPassword:'Incorrect-password-2026',newPassword:nextPassword}},400);
    await f.learner.denied('/account/password',{method:'POST',body:{currentPassword:studentPassword,newPassword:nextPassword}},429);
    assert.equal((await f.learner.ok('/me')).user.username,'child');
    await second.ok('/login',{method:'POST',body:{username:'child',password:studentPassword}});
  });

  test(`${backend}: logout or a changed password during verification cannot commit a new password`,async t=>{
    const f=await fixture(t,backend),original=f.store.changeOwnPassword.bind(f.store),oldHash=(await f.rows("SELECT password_hash FROM bao_an.users WHERE username='child'"))[0].password_hash;
    f.store.changeOwnPassword=backend==='sqlite'?function(auth,...args){f.exec('DELETE FROM bao_an.auth_sessions WHERE token_hash=$1',[auth.tokenHash]);return original(auth,...args);}:async function(auth,...args){await f.store.revokeSession(auth.tokenHash);return original(auth,...args);};
    await f.learner.denied('/account/password',{method:'POST',body:{currentPassword:studentPassword,newPassword:nextPassword}},401);
    assert.equal((await f.rows("SELECT password_hash FROM bao_an.users WHERE username='child'"))[0].password_hash,oldHash);
    await f.learner.ok('/login',{method:'POST',body:{username:'child',password:studentPassword}});
    f.store.changeOwnPassword=backend==='sqlite'?function(auth,...args){f.exec('UPDATE bao_an.users SET password_hash=$1 WHERE id=$2',['changed:by-reset',auth.id]);return original(auth,...args);}:async function(auth,...args){await f.exec('UPDATE bao_an.users SET password_hash=$1 WHERE id=$2',['changed:by-reset',auth.id]);return original(auth,...args);};
    await f.learner.denied('/account/password',{method:'POST',body:{currentPassword:studentPassword,newPassword:nextPassword}},409);
    assert.equal((await f.rows("SELECT password_hash FROM bao_an.users WHERE username='child'"))[0].password_hash,'changed:by-reset');
    assert.equal((await f.rows("SELECT action FROM bao_an.audit WHERE action='student.change-password'")).length,0);
  });

  test(`${backend}: password update and session revocation roll back together on failure`,async t=>{
    const f=await fixture(t,backend),before=(await f.rows("SELECT password_hash FROM bao_an.users WHERE username='child'"))[0].password_hash;
    f.store.audit=()=>{throw new Error('Injected audit failure');};
    await f.learner.denied('/account/password',{method:'POST',body:{currentPassword:studentPassword,newPassword:nextPassword}},500);
    assert.equal((await f.rows("SELECT password_hash FROM bao_an.users WHERE username='child'"))[0].password_hash,before);
    assert.equal((await f.learner.ok('/me')).user.username,'child');
  });
}
