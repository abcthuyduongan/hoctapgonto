import {threeSubjectSets} from './helpers/planned-weeks.mjs';
import {seedLegacyWeek} from './helpers/legacy-weeks.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';
import {PostgresStore} from '../server/postgres-store.mjs';
import {createPostgresFixture as fixture,authFor,postgresMigration as migration} from './helpers/postgres-fixture.mjs';

const hash=value=>createHash('sha256').update(value).digest('hex');
const verification=await readFile(new URL('../supabase/verify.sql',import.meta.url),'utf8');
async function student(f,name='learner',classroom){
  const cls=classroom??await f.store.createClass(f.admin,{name:'Lớp tự nhiên',grade:3});
  const row=await f.store.createStudent(f.admin,{name:'Học sinh',classId:cls.id,username:name},'salt:student-hash',name);
  return{classroom:cls,student:row,auth:authFor(await f.store.findUserByUsername(name))};
}
function pack(id='nature-questions',version=1){return{id,version,title:'Khám phá thiên nhiên',subject:'thinking',grade:3,kind:'pairs',source:'local',publishedAt:'2026-10-15T00:00:00.000Z',items:[['Cây cần gì?','Ánh sáng'],['Vật gì có cánh?','Máy bay'],['Nước đông thành gì?','Nước đá'],['Chúng ta sống ở đâu?','Trái Đất']].map(([left,right],index)=>({id:`item-${index}`,kind:'pair',objectiveId:'NATURE3.PRACTICE',left,right}))};}
const week=(classId,source=pack(),requestId='week-one')=>({requestId,classId,title:'Tuần khám phá',sets:[{subjectLabel:'Tự nhiên',pack:source}]});
async function finish(store,auth,source=pack(),requestId='play-one',moduleId='math-quest'){
  const play=await store.startPlay(auth,{requestId,moduleId,packId:source.id,contentVersion:source.version});
  for(const item of play.presentation.items){const response=play.presentation.kind==='quiz'?{kind:'choice',choiceIndex:item.correctIndex}:{kind:'pair',first:{itemId:item.id,side:'left'},second:{itemId:item.id,side:'right'}};
    await store.attempt(auth,play.session.sessionId,{attemptKey:`answer-${item.id}`,itemId:item.id,response,hintsUsed:0,elapsedMs:100});}
  return{play,result:await store.finishPlay(auth,play.session.sessionId)};
}
async function secondTenant(f){
  const workspaceId=randomUUID(),userId=randomUUID(),at=new Date().toISOString();
  await f.pool.query('INSERT INTO bao_an.workspaces(id,name,created_at) VALUES($1,$2,$3)',[workspaceId,'Đơn vị khác',at]);
  const row=(await f.pool.query("INSERT INTO bao_an.users(id,workspace_id,username,password_hash,role,created_at) VALUES($1,$2,$3,$4,'admin',$5) RETURNING *",[userId,workspaceId,'other-manager','salt:other-hash',at])).rows[0];
  return authFor(row);
}
const denied=(promise,status)=>assert.rejects(promise,error=>error.status===status);

test('PostgreSQL migration is repeatable, private, tenant constrained and stores media metadata only',async t=>{
  const f=await fixture(t);await f.db.exec(migration);
  const tables=(await f.pool.query("SELECT c.relname,c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='bao_an' AND c.relkind='r'")).rows;
  assert.ok(tables.length>=16);assert.ok(tables.every(table=>table.relrowsecurity));
  const columns=(await f.pool.query("SELECT column_name FROM information_schema.columns WHERE table_schema='bao_an' AND table_name='media'")).rows.map(row=>row.column_name);
  assert.ok(columns.includes('object_path'));assert.ok(!columns.includes('bytes'));assert.ok(!columns.includes('data'));
  for(const browserRole of['anon','authenticated']){
    const allowed=(await f.pool.query('SELECT has_schema_privilege($1,\'bao_an\',\'USAGE\') AS allowed',[browserRole])).rows[0].allowed;
    assert.equal(allowed,false);
  }
  assert.equal(await f.store.configured(),true);
  await denied(f.store.createWorkspaceAdmin({name:'Another',username:'another',passwordHash:'salt:hash'}),409);
});

test('Supabase SQL starts empty and read-only verification detects actual privilege drift',async t=>{
  const f=await fixture(t,{bootstrap:false});
  await f.db.exec('CREATE ROLE service_role BYPASSRLS;');
  await f.db.exec(migration);
  assert.equal(await f.store.configured(),false);
  const checked=await f.db.exec(verification);
  assert.ok(checked[0].rows.length>=10);
  assert.deepEqual(checked[0].rows.filter(row=>!row.passed),[]);
  assert.ok(checked[1].rows.every(row=>Number(row.row_count)===0));
  assert.equal((await f.pool.query('SELECT count(*) AS count FROM bao_an.schema_version')).rows[0].count,1);

  await f.db.exec('GRANT USAGE ON SCHEMA bao_an TO authenticated; GRANT SELECT(username) ON bao_an.users TO authenticated;');
  const columnOnly=(await f.pool.query("SELECT has_table_privilege('authenticated','bao_an.users','SELECT') AS table_allowed,has_any_column_privilege('authenticated','bao_an.users','SELECT') AS column_allowed")).rows[0];
  assert.deepEqual(columnOnly,{table_allowed:false,column_allowed:true});
  const drift=(await f.db.exec(verification))[0].rows;
  assert.equal(drift.find(row=>row.check_name==='api_roles_cannot_use_or_create_schema').passed,false);
  assert.equal(drift.find(row=>row.check_name==='api_roles_have_no_table_or_column_access').passed,false);
  await f.db.exec(migration);
  assert.deepEqual((await f.db.exec(verification))[0].rows.filter(row=>!row.passed),[]);
  assert.equal(await f.store.configured(),false);
});

test('Supabase API roles cannot query private data even with BYPASSRLS; reapplying preserves real data',async t=>{
  const f=await fixture(t),s=await student(f);await seedLegacyWeek(f.store,f.admin,week(s.classroom.id));
  await finish(f.store,s.auth);
  await f.db.exec('CREATE ROLE service_role BYPASSRLS;');
  const before=await f.store.dashboard(f.admin),state=await f.store.studentState(s.auth);
  // Simulate a mistaken manual setup. Reapply must remove grants, including a
  // Storage service role's table grants, without resetting any real records.
  await f.db.exec('GRANT USAGE ON SCHEMA bao_an TO anon,authenticated,service_role; GRANT ALL ON ALL TABLES IN SCHEMA bao_an TO anon,authenticated,service_role; GRANT SELECT(username),INSERT(username),UPDATE(username),REFERENCES(username) ON bao_an.users TO anon,authenticated,service_role,PUBLIC; ALTER DEFAULT PRIVILEGES IN SCHEMA bao_an GRANT SELECT ON TABLES TO anon,authenticated,service_role;');
  await f.db.exec(migration);
  assert.deepEqual(await f.store.dashboard(f.admin),before);
  assert.deepEqual(await f.store.studentState(s.auth),state);
  assert.deepEqual((await f.db.exec(verification))[0].rows.filter(row=>!row.passed),[]);
  const columnGrants=(await f.pool.query("SELECT a.attacl FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='bao_an' AND c.relname='users' AND a.attname='username'")).rows[0];
  assert.ok(!columnGrants.attacl?.length,'REVOKE ALL ON TABLES must also remove API-role and PUBLIC column ACLs');
  for(const role of ['anon','authenticated','service_role']){
    const client=await f.pool.connect();
    try{
      await client.query(`SET ROLE ${role}`);
      await assert.rejects(client.query('SELECT username,password_hash FROM bao_an.users'),error=>error.code==='42501');
      await assert.rejects(client.query('CREATE TABLE bao_an.unauthorized (id integer)'),error=>error.code==='42501');
    }finally{await client.query('RESET ROLE');client.release();}
  }
  await f.db.exec('CREATE TABLE bao_an.future_private_table(id integer);');
  for(const role of ['anon','authenticated','service_role']){
    const row=(await f.pool.query("SELECT has_table_privilege($1,'bao_an.future_private_table','SELECT') AS allowed",[role])).rows[0];
    assert.equal(row.allowed,false);
  }
  await f.db.exec('DROP TABLE bao_an.future_private_table;');
});

test('PostgreSQL setup, opaque sessions, reset snapshots and suspension are transactional',async t=>{
  const f=await fixture(t),s=await student(f);
  assert.equal((await f.store.findUserById(s.auth.id)).username,'learner');
  const tokenHash=hash('session-one');
  const created=await f.store.createSession({tokenHash,userId:s.auth.id,csrfToken:'csrf-test',expiresAt:Date.now()+60000,passwordHash:'salt:student-hash'});
  assert.equal(created.id,s.auth.id);assert.equal((await f.store.findSession(tokenHash)).csrf_token,'csrf-test');
  await f.store.resetStudentPassword(f.admin,s.student.id,'salt:new-hash');
  assert.equal(await f.store.findSession(tokenHash),undefined);
  await denied(f.store.createSession({tokenHash:hash('stale-password'),userId:s.auth.id,csrfToken:'csrf-test',expiresAt:Date.now()+60000,passwordHash:'salt:student-hash'}),401);
  await f.store.createSession({tokenHash:hash('new-password'),userId:s.auth.id,csrfToken:'csrf-new',expiresAt:Date.now()+60000,passwordHash:'salt:new-hash'});
  await f.store.updateStudent(f.admin,s.student.id,{active:false});
  assert.equal(await f.store.findSession(hash('new-password')),undefined);
  await denied(f.store.startPlay(s.auth,{requestId:'after-suspension',moduleId:'math-quest',packId:'nature-questions',contentVersion:1}),401);
  await f.store.revokeSession(hash('unknown'));
});

test('PostgreSQL login limits atomically persist account and address limits',async t=>{
  const f=await fixture(t),limit={addressHash:hash('ip:test'),userHash:hash('user:test'),now:1000000};
  const attempts=await Promise.allSettled(Array.from({length:13},()=>f.store.consumeLoginLimit(limit)));
  assert.equal(attempts.filter(row=>row.status==='fulfilled').length,12);
  assert.equal(attempts.find(row=>row.status==='rejected').reason.status,429);
  const reused=await new PostgresStore({pool:f.pool}).ready();await denied(reused.consumeLoginLimit(limit),429);
  await reused.clearLoginUserLimit(limit.userHash);await reused.consumeLoginLimit(limit);
  await reused.consumeLoginLimit({...limit,now:limit.now+900001});
});

test('PostgreSQL publication is immutable, atomic and idempotent under concurrent submissions',async t=>{
  const f=await fixture(t),s=await student(f),input=week(s.classroom.id);input.sets=threeSubjectSets(input.sets);
  const [a,b]=await Promise.all([f.store.publishWeek(f.admin,input),f.store.publishWeek(f.admin,input)]);assert.equal(a.id,b.id);
  assert.equal((await f.store.dashboard(f.admin)).weeks.length,1);
  const altered=pack();altered.items[0].right='Nội dung khác';
  await denied(f.store.publishWeek(f.admin,{...input,title:'Khác'}),409);
  await denied(f.store.publishWeek(f.admin,{...input,requestId:'atomic-failure',sets:[{subjectLabel:'Mới',pack:pack('rolled-back-pack')},{subjectLabel:'Tự nhiên',pack:altered}]}),409);
  assert.equal((await f.store.dashboard(f.admin)).stats.questions,8);
  assert.equal((await f.store.studentState(s.auth)).current.subjectLabel,'Tự nhiên');
});

test('PostgreSQL week and student reads stay bounded while preserving class, order and pinned versions',async t=>{
  const f=await fixture(t),s=await student(f),otherClass=await f.store.createClass(f.admin,{name:'Lớp khác',grade:3}),emptyClass=await f.store.createClass(f.admin,{name:'Lớp trống',grade:3}),expected=[];
  for(let number=1;number<=3;number++){
    const sets=[0,1].map(index=>{const source=pack(`bounded-${number}-${index}`);source.items.forEach(item=>{item.right+=` tuần ${number} bộ ${index}`;});return{subjectLabel:`Chủ đề ${index}`,pack:source};});
    expected.push(await seedLegacyWeek(f.store,f.admin,{requestId:`bounded-week-${number}`,classId:s.classroom.id,title:`Tuần ${number}`,sets}));
  }
  const revised=expected[0].sets.map(set=>({subjectLabel:set.subjectLabel,pack:{...set.pack,version:2,items:set.pack.items.map(item=>({...item,id:item.id+'-v2',right:`${item.right} mới`}))}}));
  expected[0]=await f.store.publishWeek(f.admin,{requestId:'bounded-revision',replaceWeekId:expected[0].id,classId:s.classroom.id,title:'Tuần 1',sets:revised});
  // Another class keeps version 1 of the same source; a different workspace may
  // use the very same pack ID. Neither belongs in this student's week list.
  const v1=pack('bounded-1-0');v1.items.forEach(item=>{item.right+=' tuần 1 bộ 0';});
  await seedLegacyWeek(f.store,f.admin,{...week(otherClass.id,v1,'bounded-other-class'),sets:[{subjectLabel:'Chủ đề 0',pack:v1}]});
  const other=await secondTenant(f),foreignClass=await f.store.createClass(other,{name:'Đơn vị khác',grade:3});
  await seedLegacyWeek(f.store,other,week(foreignClass.id,pack('bounded-1-0'),'bounded-foreign'));
  await finish(f.store,s.auth,revised[0].pack,'bounded-complete');
  await f.store.configureWallet(f.admin,{enabled:true,rateVnd:1000});
  await f.store.requestReward(s.auth,{requestId:'bounded-wish',title:'Bút màu',goalVnd:2000});

  const statements=[],client={query(sql,values){statements.push(sql);return f.pool.query(sql,values);}};
  const actual=await f.store.weeks(s.auth,s.classroom.id,client),weekQueries=statements.splice(0).length;
  assert.deepEqual(actual,expected);
  assert.deepEqual(actual.map(row=>row.sets.map(set=>set.pack.version)),[[2,2],[1,1],[1,1]]);
  assert.deepEqual(await f.store.weeks(f.admin,emptyClass.id,client),[]);
  const emptyQueries=statements.splice(0).length;
  const state=await f.store.studentState(s.auth,client),stateQueries=statements.splice(0).length;
  assert.deepEqual(state.student,await f.store.publicStudent(s.auth,await f.store.student(s.auth,s.auth.studentId)));
  assert.deepEqual(state.weeks.map(({sets,done,unlocked,current,closed,ready,...row})=>({...row,sets:sets.map(({stars,done,questionProgress,...set})=>set)})),expected);
  assert.deepEqual(state.weeks.map(row=>row.unlocked),[true,false,false]);
  assert.deepEqual(state.balance,{earned:3,available:1,pending:2,redeemed:0});
  assert.deepEqual(state.student.balance,state.balance);
  assert.equal(state.current.pack.id,revised[0].pack.id,'legacy wallet stars do not invent mastery on every question');
  assert.equal(state.requests[0].requestId,'bounded-wish');
  assert.equal(state.rewards[0].packId,revised[0].pack.id);
  t.diagnostic(`3 weeks / 6 sets: week reads ${weekQueries}, empty class ${emptyQueries}, student state ${stateQueries}`);
  assert.deepEqual({weekQueries,emptyQueries,stateQueries},{weekQueries:2,emptyQueries:1,stateQueries:8});

  // The same loader also uses the caller's transaction client when a publish
  // or completion needs to see writes that are not committed yet.
  await f.store.transaction(async owned=>{
    await f.store.exec('UPDATE bao_an.weeks SET title=$3 WHERE workspace_id=$1 AND id=$2',[f.admin.workspaceId,expected[0].id,'Tuần đang cập nhật'],owned);
    assert.equal((await f.store.weeks(s.auth,s.classroom.id,owned))[0].title,'Tuần đang cập nhật');
  });
});

test('PostgreSQL answer evidence loads its authorized play once and still rejects guessed plays',async t=>{
  const f=await fixture(t),s=await student(f),other=await student(f,'other-learner',s.classroom);
  await seedLegacyWeek(f.store,f.admin,week(s.classroom.id));
  const play=await f.store.startPlay(s.auth,{requestId:'bounded-attempt',moduleId:'math-quest',packId:pack().id,contentVersion:1}),item=play.presentation.items[0];
  const queries=[],countedPool={
    query(sql,values){queries.push(sql);return f.pool.query(sql,values);},
    async connect(){const client=await f.pool.connect();return{query(sql,values){queries.push(sql);return client.query(sql,values);},release(){client.release();}};},
  },store=new PostgresStore({pool:countedPool}),input={attemptKey:'first-answer',itemId:item.id,response:{kind:'choice',choiceIndex:item.correctIndex},hintsUsed:0,elapsedMs:100};
  const result=await store.attempt(s.auth,play.session.sessionId,input);
  assert.equal(result.event.correct,true);assert.equal(result.event.gameSequence,1);
  const playReads=queries.filter(sql=>/FROM bao_an\.plays WHERE/.test(sql)).length,packReads=queries.filter(sql=>/FROM bao_an\.packs WHERE/.test(sql)).length;
  t.diagnostic(`answer queries ${queries.length}, authorized play reads ${playReads}, pack reads ${packReads}`);
  assert.deepEqual({playReads,packReads},{playReads:1,packReads:1});
  await denied(store.events(other.auth,play.session.sessionId),404);
  await denied(store.attempt(other.auth,play.session.sessionId,{...input,attemptKey:'guessed-answer'}),404);
  assert.equal((await store.events(s.auth,play.session.sessionId)).length,1);
  assert.equal((await store.attempt(s.auth,play.session.sessionId,input)).duplicate,true);
});

test('PostgreSQL raw attempts, ordered evidence and completion award only the best original-pack tier',async t=>{
  const f=await fixture(t),s=await student(f);await seedLegacyWeek(f.store,f.admin,week(s.classroom.id));
  const play=await f.store.startPlay(s.auth,{requestId:'raw-play',moduleId:'math-quest',packId:pack().id,contentVersion:1}),item=play.presentation.items[0];
  await denied(f.store.finishPlay(s.auth,play.session.sessionId),400);
  const input={attemptKey:'stable-answer',itemId:item.id,response:{kind:'choice',choiceIndex:item.correctIndex},hintsUsed:0,elapsedMs:100};
  const receipts=await Promise.all([f.store.attempt(s.auth,play.session.sessionId,input),f.store.attempt(s.auth,play.session.sessionId,input)]);
  assert.deepEqual(receipts.map(row=>row.duplicate).sort(),[false,true]);assert.equal(receipts[0].event.eventId,receipts[1].event.eventId);
  await denied(f.store.attempt(s.auth,play.session.sessionId,{...input,response:{kind:'choice',choiceIndex:(item.correctIndex+1)%4}}),409);
  for(const next of play.presentation.items.slice(1))await f.store.attempt(s.auth,play.session.sessionId,{...input,attemptKey:`answer-${next.id}`,itemId:next.id,response:{kind:'choice',choiceIndex:next.correctIndex}});
  const completed=await Promise.all([f.store.finishPlay(s.auth,play.session.sessionId),f.store.finishPlay(s.auth,play.session.sessionId)]);
  assert.equal(completed.reduce((sum,row)=>sum+row.gained,0),3);assert.equal(completed[0].state.balance.earned,3);
  const replay=await finish(f.store,s.auth,pack(),'replay','word-connect');assert.equal(replay.result.gained,0);
  assert.equal((await f.store.events(s.auth,play.session.sessionId)).length,4);
});

test('PostgreSQL concurrent redemptions cannot overspend and retain immutable rates and decisions',async t=>{
  const f=await fixture(t),s=await student(f);await seedLegacyWeek(f.store,f.admin,week(s.classroom.id));await finish(f.store,s.auth);
  await f.store.configureWallet(f.admin,{enabled:true,rateVnd:1000});
  const requests=await Promise.allSettled(['wish-a','wish-b'].map(requestId=>f.store.requestReward(s.auth,{requestId,title:'Bút màu',goalVnd:2000})));
  assert.equal(requests.filter(row=>row.status==='fulfilled').length,1);assert.equal(requests.find(row=>row.status==='rejected').reason.status,400);
  const request=requests.find(row=>row.status==='fulfilled').value;
  assert.deepEqual((await f.store.studentState(s.auth)).balance,{earned:3,available:1,pending:2,redeemed:0});
  const duplicate=await f.store.requestReward(s.auth,{requestId:request.requestId,title:'Bút màu',goalVnd:2000});assert.equal(duplicate.requestId,request.requestId);
  await f.store.configureWallet(f.admin,{enabled:true,rateVnd:5000});
  const approved=await f.store.transitionReward(f.admin,request.requestId,{status:'approved'});assert.equal(approved.rateVnd,1000);
  await denied(f.store.transitionReward(s.auth,request.requestId,{},true),409);
  await f.store.transitionReward(f.admin,request.requestId,{status:'fulfilled'});
  assert.deepEqual((await f.store.studentState(s.auth)).balance,{earned:3,available:1,pending:0,redeemed:2});
  const persisted=await new PostgresStore({pool:f.pool}).ready();assert.equal((await persisted.dashboard(f.admin)).redemptions[0].history.at(-1).status,'fulfilled');
});

test('PostgreSQL guessed identifiers, same pack IDs and student permissions remain tenant isolated',async t=>{
  const f=await fixture(t),a=await student(f),other=await secondTenant(f),classB=await f.store.createClass(other,{name:'Lớp B',grade:3});
  const rowB=await f.store.createStudent(other,{name:'B',classId:classB.id,username:'student-b'},'salt:b-hash','student-b'),authB=authFor(await f.store.findUserByUsername('student-b'));
  const packB=pack();packB.items[0].right='Ánh nắng khác';await seedLegacyWeek(f.store,f.admin,week(a.classroom.id));await seedLegacyWeek(f.store,other,week(classB.id,packB));
  assert.equal((await f.store.studentState(a.auth)).current.pack.items[0].right,'Ánh sáng');assert.equal((await f.store.studentState(authB)).current.pack.items[0].right,'Ánh nắng khác');
  await denied(f.store.updateStudent(f.admin,rowB.id,{name:'Foreign mutation'}),404);
  await denied(f.store.publishWeek(f.admin,week(classB.id,pack('foreign-class'),'foreign-week')),404);
  await denied(f.store.createClass(a.auth,{name:'Student class',grade:3}),403);
  const play=await f.store.startPlay(a.auth,{requestId:'tenant-play',moduleId:'math-quest',packId:pack().id,contentVersion:1});
  await denied(f.store.finishPlay(authB,play.session.sessionId),404);
  await denied(f.store.events(authB,play.session.sessionId),404);
  await denied(f.store.rewards(a.auth,rowB.id),404);await denied(f.store.requests(a.auth,rowB.id),404);
  await denied(f.store.abandonActive(a.auth,rowB.id),404);
  assert.equal((await f.store.dashboard(f.admin)).students.length,1);assert.equal((await f.store.dashboard(other)).students.length,1);
});

test('PostgreSQL media records store no bytes and enforce tenant, assignment, MIME and object-path checks',async t=>{
  const f=await fixture(t),s=await student(f),other=await secondTenant(f);
  const bytes=await readFile(new URL('../public/icons/bao-an-192.png',import.meta.url)),mediaId=randomUUID();
  const media=await f.store.addMedia(f.admin,{id:mediaId,name:'nature.png',mime:'image/png',bytes,objectPath:`${f.admin.workspaceId}/${mediaId}.png`});
  assert.equal(media.sha256,hash(bytes));assert.equal(media.size,bytes.length);assert.equal(media.bytes,undefined);
  const row=await f.store.getMedia(f.admin,media.id);assert.equal(row.object_path,`${f.admin.workspaceId}/${mediaId}.png`);assert.equal(row.bytes,undefined);
  assert.equal(await f.store.hasMediaAccess(s.auth,media.id),false);assert.equal(await f.store.hasMediaAccess(other,media.id),false);
  await denied(f.store.getMedia(other,media.id),404);await denied(f.store.getMedia(s.auth,media.id),404);
  await denied(f.store.addMedia(f.admin,{id:randomUUID(),name:'fake.wav',mime:'audio/wav',bytes,objectPath:`${f.admin.workspaceId}/another`}),400);
  await denied(f.store.addMedia(f.admin,{id:randomUUID(),name:'bad.png',mime:'image/png',bytes,objectPath:`${other.workspaceId}/${mediaId}`}),400);
  const source=pack();source.items[0].media={imageId:media.id,imageAlt:'Hình vườn'};await seedLegacyWeek(f.store,f.admin,week(s.classroom.id,source));
  assert.equal(await f.store.hasMediaAccess(s.auth,media.id),true);
  const assigned=await f.store.getMedia(s.auth,media.id);assert.equal(assigned.sha256,media.sha256);
  assert.equal((await f.store.listMedia(other)).length,0);
});

test('PostgreSQL media authorization batches assigned weeks without granting other-class assets or unlocking games',async t=>{
  const f=await fixture(t),s=await student(f),other=await secondTenant(f),otherClass=await f.store.createClass(f.admin,{name:'Lớp hình khác',grade:3}),media=[];
  for(const size of[192,512]){
    const mediaId=randomUUID(),bytes=await readFile(new URL(`../public/icons/bao-an-${size}.png`,import.meta.url));
    media.push(await f.store.addMedia(f.admin,{id:mediaId,name:`bounded-${size}.png`,mime:'image/png',bytes,objectPath:`${f.admin.workspaceId}/${mediaId}.png`}));
  }
  const sources=[];
  for(let number=1;number<=3;number++){
    const source=pack(`media-week-${number}`);source.items[0].right+=` tuần ${number}`;
    if(number===3)source.items[0].media={imageId:media[0].id,imageAlt:'Hình đã giao'};
    sources.push(source);await seedLegacyWeek(f.store,f.admin,{...week(s.classroom.id,source,`media-week-${number}`),title:`Tuần hình ${number}`});
  }
  const foreignSource=pack('other-class-image');foreignSource.items[0].right+=' lớp khác';foreignSource.items[0].media={imageId:media[1].id,imageAlt:'Hình lớp khác'};
  await seedLegacyWeek(f.store,f.admin,week(otherClass.id,foreignSource,'other-class-image'));
  const statements=[],client={query(sql,values){statements.push(sql);return f.pool.query(sql,values);}};
  assert.equal(await f.store.hasMediaAccess(s.auth,media[0].id,client),true);
  const assignedQueries=statements.splice(0).length;
  assert.equal(await f.store.hasMediaAccess(s.auth,media[1].id,client),false);
  const otherClassQueries=statements.splice(0).length;
  assert.equal(await f.store.hasMediaAccess(other,media[0].id,client),false);
  const foreignQueries=statements.splice(0).length;
  assert.equal((await f.store.studentState(s.auth)).weeks[2].unlocked,false);
  await denied(f.store.startPlay(s.auth,{requestId:'locked-media-game',moduleId:'math-quest',packId:sources[2].id,contentVersion:1}),403);
  t.diagnostic(`media access across 3 weeks: assigned ${assignedQueries}, other class ${otherClassQueries}, foreign workspace ${foreignQueries}`);
  assert.deepEqual({assignedQueries,otherClassQueries,foreignQueries},{assignedQueries:3,otherClassQueries:4,foreignQueries:1});
});
