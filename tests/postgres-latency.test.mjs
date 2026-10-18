import test from 'node:test';
import assert from 'node:assert/strict';
import {scryptSync,createHash} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {PostgresStore} from '../server/postgres-store.mjs';
import {createCloudApi} from '../server/cloud-api.mjs';
import {createPostgresFixture} from './helpers/postgres-fixture.mjs';
import {seedLegacyWeek} from './helpers/legacy-weeks.mjs';
import {createPerformanceReporter} from '../server/api-diagnostics.mjs';

const origin='https://latency.example.test',password='Latency-fixture-password!',salt='latency-test-salt';
const passwordHash=`${salt}:${scryptSync(password,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024}).toString('hex')}`;
const hash=value=>createHash('sha256').update(value).digest('hex');
const source={id:'latency-questions',version:1,title:'Câu hỏi kiểm tra độ trễ',kind:'pairs',subject:'thinking',grade:3,source:'local',publishedAt:'2026-10-18T00:00:00.000Z',items:[['Cây xanh','Lá'],['Bầu trời','Mây'],['Dòng sông','Nước'],['Khu rừng','Cành']].map(([left,right],i)=>({id:`q${i+1}`,kind:'pair',objectiveId:'LATENCY',left,right}))};

function countedPool(pool,{rttMs=0}={}){
  const queries=[];
  async function query(client,sql,values){queries.push(sql);if(rttMs)await delay(rttMs);return client.query(sql,values);}
  return{queries,query:(sql,values)=>query(pool,sql,values),async connect(){const client=await pool.connect();return{query:(sql,values)=>query(client,sql,values),release:()=>client.release()};}};
}

test('cloud login, week summary and secure game actions keep bounded database round trips',async t=>{
  const f=await createPostgresFixture(t),cls=await f.store.createClass(f.admin,{name:'Lớp kiểm tra độ trễ',grade:3});
  await f.store.createStudent(f.admin,{classId:cls.id,name:'An',username:'latency-child'},passwordHash,'latency-child');
  const imageBytes=Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0]),imageId='latency-private-image';
  await f.store.addMedia(f.admin,{id:imageId,name:'latency.png',mime:'image/png',bytes:imageBytes,objectPath:`${f.admin.workspaceId}/${imageId}`});
  await seedLegacyWeek(f.store,f.admin,{requestId:'latency-week',classId:cls.id,title:'Tuần 1',sets:[{subjectLabel:'Tự nhiên',pack:{...source,items:source.items.map((item,i)=>i?item:{...item,media:{imageId,imageAlt:'Ảnh kiểm tra độ trễ'}})}}]});
  const traces=[],performanceReporter=createPerformanceReporter({enabled:true,sampleEvery:1,logger:value=>traces.push(JSON.parse(value))});
  const rttMs=5,pool=countedPool(f.pool,{rttMs}),store=new PostgresStore({pool}),api=createCloudApi({store,storage:{download:async()=>imageBytes},publicOrigin:origin,performanceReporter}),measurements={};let cookie='',csrf='';
  async function request(name,route,body,budget){
    pool.queries.length=0;const started=performance.now(),method=body===undefined?'GET':'POST';
    const response=await api(new Request(origin+'/api/online'+route,{method,headers:{'X-Bao-An-Question-Protocol':'1',...(cookie?{Cookie:cookie}:{}),...(body===undefined?{}:{Origin:origin,'Content-Type':'application/json','X-CSRF-Token':csrf})},...(body===undefined?{}:{body:JSON.stringify(body)})}),{ip:'192.0.2.25'}),data=await response.json();
    assert.ok(response.ok,`${name}: ${response.status} ${JSON.stringify(data)}`);
    if(response.headers.has('set-cookie'))cookie=response.headers.get('set-cookie').split(';',1)[0];if(data.csrfToken)csrf=data.csrfToken;
    measurements[name]={queries:pool.queries.length,injectedRttMs:rttMs,injectedWaitMs:pool.queries.length*rttMs,elapsedMs:Math.round(performance.now()-started)};
    assert.ok(pool.queries.length<=budget,`${name}: ${pool.queries.length} queries exceeds budget ${budget}`);
    assert.equal(traces.at(-1).sqlCount,pool.queries.length,`${name}: timing count includes authentication and transaction control`);
    return data;
  }
  const login=await request('login','/login',{username:'latency-child',password},13);assert.equal(login.user.role,'student');assert.ok(traces.at(-1).passwordMs>0);
  const summary=await request('summary','/student/summary',undefined,4);assert.equal(summary.currentWeekSummary.total,4);assert.equal(summary.balance.earned,0);assert.equal(JSON.stringify(summary).includes('"items"'),false);
  pool.queries.length=0;const imageStarted=performance.now(),imageResponse=await api(new Request(origin+'/api/online/media/'+imageId,{headers:{Cookie:cookie}}));
  assert.equal(imageResponse.status,200);assert.match(imageResponse.headers.get('cache-control'),/no-store/);assert.deepEqual(Buffer.from(await imageResponse.arrayBuffer()),imageBytes);
  assert.equal(pool.queries.length,2);assert.equal(traces.at(-1).sqlCount,2);assert.ok(traces.at(-1).storageMs>=0);
  measurements.privateImage={queries:pool.queries.length,injectedRttMs:rttMs,injectedWaitMs:pool.queries.length*rttMs,elapsedMs:Math.round(performance.now()-imageStarted)};
  const input={requestId:'latency-play',moduleId:'math-quest',packId:source.id,contentVersion:1};
  const play=await request('firstGame','/play/compact',input,13);assert.equal(play.session.questionProtocolVersion,1);assert.equal(play.pack.items,undefined);
  const opened=await request('openQuestion',`/play/${play.session.sessionId}/question-open`,{itemId:'q1'},9);assert.equal(opened.item.id,'q1');assert.equal(opened.item.correctIndex,undefined);
  const answer={attemptKey:'latency-answer',itemId:'q1',response:{kind:'choice',choiceIndex:0},hintsUsed:0,elapsedMs:0};
  const receipt=await request('answer',`/play/${play.session.sessionId}/attempt`,answer,12);assert.equal(receipt.event.correct,true);assert.equal(receipt.questionRewards.gained,3);
  const duplicate=await request('duplicate',`/play/${play.session.sessionId}/attempt`,answer,10);assert.equal(duplicate.duplicate,true);assert.equal(duplicate.questionRewards.gained,0);
  const replay=await request('retryGame','/play/compact',input,9);assert.equal(replay.session.sessionId,play.session.sessionId);
  const next=await request('nextGame','/play/compact',{...input,requestId:'latency-second-game'},10);assert.notEqual(next.session.sessionId,play.session.sessionId);
  assert.equal((await store.studentSummary({...login.user,csrfToken:csrf,tokenHash:hash(cookie.split('=')[1])})).balance.earned,3);
  t.diagnostic(JSON.stringify(measurements));
  assert.doesNotMatch(JSON.stringify(traces),/latency-child|latency-private-image|latency-answer|latency-questions|SELECT |csrfToken|token_hash/);
});

test('batched login counters roll back both keys on rejection and reset after expiry',async t=>{
  const f=await createPostgresFixture(t),pool=countedPool(f.pool),store=new PostgresStore({pool}),limit={addressHash:hash('ip:counter-audit'),userHash:hash('user:counter-audit'),now:1000000};
  for(let i=0;i<12;i++)await store.consumeLoginLimit(limit);
  assert.deepEqual((await store.rows('SELECT key,count FROM bao_an.login_limits ORDER BY key')).map(row=>row.count),[12,12]);
  const freshAddress=hash('ip:fresh-counter-audit');pool.queries.length=0;
  await assert.rejects(store.consumeLoginLimit({...limit,addressHash:freshAddress}),error=>error.status===429);
  assert.equal(pool.queries.length,4);assert.equal(await store.one('SELECT key FROM bao_an.login_limits WHERE key=$1',[freshAddress]),undefined);
  assert.equal((await store.one('SELECT count FROM bao_an.login_limits WHERE key=$1',[limit.userHash])).count,12);
  await store.consumeLoginLimit({...limit,now:limit.now+900001});
  assert.deepEqual((await store.rows('SELECT count FROM bao_an.login_limits ORDER BY key')).map(row=>row.count),[1,1]);
  const timeouts=await store.transaction(client=>store.one("SELECT current_setting('statement_timeout') AS statement,current_setting('lock_timeout') AS lock",[],client));
  assert.equal(timeouts.statement,'15s');assert.equal(timeouts.lock,'10s');
  const outside=await store.one("SELECT current_setting('statement_timeout') AS statement,current_setting('lock_timeout') AS lock");
  assert.equal(outside.statement,'0');assert.equal(outside.lock,'0');
});
