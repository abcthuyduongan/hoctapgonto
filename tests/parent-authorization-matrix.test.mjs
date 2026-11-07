import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {resolve} from 'node:path';
import {createOnlineServer} from '../server/online-server.mjs';
import {createCloudApi} from '../server/cloud-api.mjs';
import {createPostgresFixture} from './helpers/postgres-fixture.mjs';
import {seedRewardJourney,earnRewardJourney} from './helpers/reward-journey.mjs';

const password = 'Audit-secure-password-2026!';
const token = 'audit-bootstrap-token-20261106';

for(const engine of ['SQLite HTTP','PostgreSQL cloud adapter'])test(`SafeTime parent scope [${engine}]: no PIN bypass, sibling pairing or workspace-wide disclosure`,async t=>{
 const h=await harness(t,engine),admin=client(h.send,h.origin),child=client(h.send,h.origin),parent=client(h.send,h.origin);
 const post=async(c,route,data)=>{const r=await c.request(route,'POST',data);assert.ok(r.status<300,JSON.stringify(r));return r.data;};
 await post(admin,'/setup',{token,name:'SafeTime scope',username:'scope.admin',password});
 const cls=await post(admin,'/classes',{name:'3A',grade:3});
 const a=(await post(admin,'/students',{classId:cls.id,name:'Child A',username:'scope.a',password})).student;
 const b=(await post(admin,'/students',{classId:cls.id,name:'Child B',username:'scope.b',password})).student;
 await post(child,'/login',{username:'scope.a',password});
 assert.equal((await child.request('/parent/safetime/status')).status,403,'a student without a configured PIN cannot manage integration');
 await post(admin,'/parent/setup-pin',{studentId:a.id,pin:'735291'});
 child.setParentToken((await post(child,'/parent/verify-pin',{pin:'735291'})).parentToken);
 assert.equal((await child.request('/parent/safetime/pair-code','POST',{studentIds:[b.id]})).status,403,'PIN for A cannot authorize B');
 await post(admin,'/parents',{name:'Parent A',username:'scope.parent',password,studentIds:[a.id]});
 await post(parent,'/login',{username:'scope.parent',password});
 assert.equal((await parent.request('/parent/safetime/pair-code','POST',{studentIds:[b.id]})).status,403,'linked parent cannot authorize another child');
 const own=await post(child,'/parent/safetime/pair-code',{studentIds:[a.id]});
 const other=await post(admin,'/parent/safetime/pair-code',{studentIds:[b.id]});
 const ca=await h.store.createIntegrationClient((await admin.request('/me')).data.workspace.id,{tokenHash:'scope-token-a',deviceId:'device-a',deviceName:'Device A',allowedStudentIds:[a.id]});
 const cb=await h.store.createIntegrationClient((await admin.request('/me')).data.workspace.id,{tokenHash:'scope-token-b',deviceId:'device-b',deviceName:'Device B',allowedStudentIds:[b.id]});
 const shared=await h.store.createIntegrationClient((await admin.request('/me')).data.workspace.id,{tokenHash:'scope-token-ab',deviceId:'device-ab',deviceName:'Shared',allowedStudentIds:[a.id,b.id]});
 for(const actor of [child,parent]){
  const status=await actor.request('/parent/safetime/status');assert.equal(status.status,200);
  assert.deepEqual(status.data.availableStudents.map(s=>s.id),[a.id]);
  assert.deepEqual(status.data.clients.map(c=>c.id),[ca.id]);
  assert.notEqual(status.data.activePairCode?.code,other.code,'never disclose the sibling pairing secret');
  assert.equal(status.data.canManageWorkspace,false);
  assert.equal((await actor.request('/parent/safetime/revoke-client','POST',{clientId:cb.id})).status,403);
  assert.equal((await actor.request('/parent/safetime/revoke-client','POST',{clientId:shared.id})).status,403);
  assert.equal((await actor.request('/parent/safetime/toggle','POST',{enabled:false})).status,403,'workspace switch requires administrator');
 }
 const workspaceId=(await admin.request('/me')).data.workspace.id;
 const single=await h.store.createIntegrationTicket(workspaceId,ca.id,a.id);
 const used=await Promise.allSettled([Promise.resolve().then(()=>h.store.consumeIntegrationTicket(single.ticket)),Promise.resolve().then(()=>h.store.consumeIntegrationTicket(single.ticket))]);
 assert.equal(used.filter(r=>r.status==='fulfilled').length,1,'SSO ticket is consumed at most once under concurrent requests');
 const unused=await h.store.createIntegrationTicket(workspaceId,ca.id,a.id);
 assert.ok(own.code);await post(child,'/parent/safetime/revoke-client',{clientId:ca.id});
 await assert.rejects(Promise.resolve().then(()=>h.store.consumeIntegrationTicket(unused.ticket)),/tắt|thu hồi/);
 assert.equal((await admin.request('/parent/safetime/status')).data.canManageWorkspace,true);
});

test('SafeTime HTTP: disabling or revoking a client blocks bearer calls and unused SSO tickets',async t=>{
 const h=await harness(t,'SQLite HTTP'),admin=client(h.send,h.origin);
 const post=async(route,data)=>{const r=await admin.request(route,'POST',data);assert.ok(r.status<300,JSON.stringify(r));return r.data;};
 await post('/setup',{token,name:'SafeTime stop',username:'stop.admin',password});
 const cls=await post('/classes',{name:'3A',grade:3});const s=(await post('/students',{classId:cls.id,name:'An',username:'stop.child',password})).student;
 const code=await post('/parent/safetime/pair-code',{studentIds:[s.id]});
 const integration=async(route,data,bearer)=>fetch(h.origin+'/api/integration/safetime/v1'+route,{method:data?'POST':'GET',redirect:'manual',headers:{...(data?{'Content-Type':'application/json'}:{}),...(bearer?{Authorization:'Bearer '+bearer}:{})},...(data?{body:JSON.stringify(data)}:{})});
 const paired=await(await integration('/pair',{code:code.code,deviceId:'stop-device',deviceName:'Stop device'})).json();assert.ok(paired.token);
 const login=await(await integration('/student-login',{username:'stop.child',password,studentId:s.id,remember:true},paired.token)).json();assert.ok(login.ticket);
 await post('/parent/safetime/toggle',{enabled:false});
 assert.equal((await integration('/students',null,paired.token)).status,403,'disable must stop an already paired client');
 assert.equal((await integration('/sso?ticket='+login.ticket)).status,400,'disabled integration cannot mint a browser session');
 await post('/parent/safetime/toggle',{enabled:true});
 const next=await(await integration('/student-login',{username:'stop.child',password,studentId:s.id},paired.token)).json();assert.ok(next.ticket);
 await post('/parent/safetime/revoke-client',{clientId:paired.clientId??(await admin.request('/parent/safetime/status')).data.clients[0].id});
 const denied=await integration('/sso?ticket='+next.ticket);assert.equal(denied.status,400);assert.equal(denied.headers.get('set-cookie'),null,'revocation must also invalidate unused SSO tickets');
});

function client(send, origin) {
  let cookie = '', csrf = '', parentToken = '';
  return {
    setParentToken(tok) { parentToken = tok; },
    clearParentToken() { parentToken = ''; },
    async request(route, method = 'GET', body) {
      const headers = {
        'X-Bao-An-Question-Protocol': '1',
        ...(cookie ? {Cookie: cookie} : {}),
        ...(parentToken ? {'X-Parent-Token': parentToken} : {}),
        ...(method !== 'GET' ? {Origin: origin, 'Content-Type': 'application/json', 'X-CSRF-Token': csrf} : {}),
      };
      const response = await send(new Request(origin + '/api/online' + route, {
        method,
        headers,
        ...(body !== undefined ? {body: JSON.stringify(body)} : {}),
      }));
      const cookies = response.headers.getSetCookie?.() ?? [];
      if (cookies.length) cookie = cookies.map(v => v.split(';', 1)[0]).join('; ');
      const data = await response.json();
      if (data.csrfToken) csrf = data.csrfToken;
      return {status: response.status, data};
    },
  };
}

async function harness(t, engine) {
  if (engine === 'SQLite HTTP') {
    const server = createOnlineServer({databasePath: ':memory:', staticRoot: resolve('dist'), setupToken: token, secureCookies: false});
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    t.after(async () => {
      server.closeAllConnections?.();
      await new Promise(res => server.close(res));
      server.onlineClose();
    });
    return {origin: 'http://127.0.0.1:' + server.address().port, send: request => fetch(request),store:server.onlineStore};
  }
  const f = await createPostgresFixture(t, {bootstrap: false});
  const origin = 'https://matrix-fixture.example.test';
  const api = createCloudApi({store: f.store, storage: {download: async () => Buffer.alloc(0), upload: async () => {}}, publicOrigin: origin, setupToken: token});
  return {origin, send: request => api(request, {ip: '192.0.2.120'}),store:f.store};
}

for (const engine of ['SQLite HTTP', 'PostgreSQL cloud adapter']) {
  test(`Parent Authorization Matrix [${engine}]: AU01-AU10 strict security controls`, async t => {
    const h = await harness(t, engine);
    const manager = client(h.send, h.origin);
    const childA = client(h.send, h.origin);
    const childB = client(h.send, h.origin);
    const parent = client(h.send, h.origin);

    // Bootstrap workspace
    const setupRes = await manager.request('/setup', 'POST', {token, name: 'Matrix Org', username: 'mgr.matrix', password});
    assert.equal(setupRes.status, 201);

    const clsRes = await manager.request('/classes', 'POST', {name: 'Class 3A', grade: 3});
    const cls = clsRes.data;

    const studentARes = await manager.request('/students', 'POST', {classId: cls.id, name: 'Student A', username: 'student.a', password});
    const studentA = studentARes.data.student;

    const studentBRes = await manager.request('/students', 'POST', {classId: cls.id, name: 'Student B', username: 'student.b', password});
    const studentB = studentBRes.data.student;

    // AU10: Setup PIN for Student A. Result must not expose pinHash or pinSalt
    const pinSetupRes = await manager.request('/parent/setup-pin', 'POST', {studentId: studentA.id, pin: '7342'});
    assert.equal(pinSetupRes.status, 200);
    assert.equal(pinSetupRes.data.success, true);
    assert.equal(pinSetupRes.data.pinHash, undefined);
    assert.equal(pinSetupRes.data.pinSalt, undefined);

    // Login as Student A
    const loginARes = await childA.request('/login', 'POST', {username: 'student.a', password});
    assert.equal(loginARes.status, 200);

    // AU01 & AU02: Student A without elevation attempts to read dashboard and modify settings -> 403 Forbidden
    const unverifiedDash = await childA.request('/parent/dashboard');
    assert.equal(unverifiedDash.status, 403, 'AU02: Student cannot view PIN-protected parent dashboard without elevation');

    const unverifiedSettings = await childA.request('/parent/settings', 'POST', {maxMinutesPerDay: 10, allowedStartHour: 8, allowedEndHour: 18});
    assert.equal(unverifiedSettings.status, 403, 'AU01: Student cannot update settings without elevation');

    // AU03: Wrong PIN verification fails and locks out after 5 attempts
    for (let i = 1; i <= 4; i++) {
      const wrongPin = await childA.request('/parent/verify-pin', 'POST', {pin: '0000'});
      assert.equal(wrongPin.status, 403);
      assert.match(wrongPin.data.error, /Sai mã PIN phụ huynh/);
    }
    const fifthWrongPin = await childA.request('/parent/verify-pin', 'POST', {pin: '0000'});
    assert.equal(fifthWrongPin.status, 429);
    assert.match(fifthWrongPin.data.error, /tạm khóa 15 phút/);

    // Even correct PIN is blocked when locked
    const correctWhileLocked = await childA.request('/parent/verify-pin', 'POST', {pin: '7342'});
    assert.equal(correctWhileLocked.status, 429);
    assert.match(correctWhileLocked.data.error, /tạm khóa/);

    // Admin resets PIN to unlock
    const adminReset = await manager.request('/parent/setup-pin', 'POST', {studentId: studentA.id, pin: '8888'});
    assert.equal(adminReset.status, 200);
    assert.equal(adminReset.data.success, true);

    // AU04: Verify correct PIN returns elevation token
    const correctPin = await childA.request('/parent/verify-pin', 'POST', {pin: '8888'});
    assert.equal(correctPin.status, 200);
    assert.ok(correctPin.data.parentToken, 'Elevation token issued');
    assert.equal(correctPin.data.pinHash, undefined);
    assert.equal(correctPin.data.pinSalt, undefined);

    // AU05: Provide elevation token -> Student can access dashboard and modify settings
    childA.setParentToken(correctPin.data.parentToken);
    const elevatedDash = await childA.request('/parent/dashboard');
    assert.equal(elevatedDash.status, 200);
    assert.equal(elevatedDash.data.controls.pinHash, undefined);
    assert.equal(elevatedDash.data.controls.pinSalt, undefined);

    const elevatedSettings = await childA.request('/parent/settings', 'POST', {maxMinutesPerDay: 45, allowedStartHour: 8, allowedEndHour: 20});
    assert.equal(elevatedSettings.status, 200);
    assert.equal(elevatedSettings.data.maxMinutesPerDay, 45);
    assert.equal(elevatedSettings.data.pinHash, undefined);
    assert.equal(elevatedSettings.data.pinSalt, undefined);

    // AU06: Changing PIN invalidates existing elevation tokens
    const changePinRes = await childA.request('/parent/setup-pin', 'POST', {pin: '9999'});
    assert.equal(changePinRes.status, 200);

    const staleTokenDash = await childA.request('/parent/dashboard');
    assert.equal(staleTokenDash.status, 403, 'AU06: Stale elevation token is rejected after PIN change');

    // Create a Parent user linked only to Student A
    const parentCreateRes = await manager.request('/parents', 'POST', {
      name: 'Parent of A',
      username: 'parent.a',
      password,
      studentIds: [studentA.id],
    });
    assert.equal(parentCreateRes.status, 201);

    const parentLoginRes = await parent.request('/login', 'POST', {username: 'parent.a', password});
    assert.equal(parentLoginRes.status, 200);

    // AU08: Linked parent can access student A without needing student elevation token
    const parentDashA = await parent.request(`/parent/dashboard?studentId=${studentA.id}`);
    assert.equal(parentDashA.status, 200);
    assert.equal(parentDashA.data.controls.pinHash, undefined);
    assert.equal(parentDashA.data.controls.pinSalt, undefined);

    const parentSettingsA = await parent.request('/parent/settings', 'POST', {
      studentId: studentA.id,
      maxMinutesPerDay: 50,
      allowedStartHour: 7,
      allowedEndHour: 21,
    });
    assert.equal(parentSettingsA.status, 200);
    assert.equal(parentSettingsA.data.maxMinutesPerDay, 50);

    // AU07: Parent trying to access Student B (unlinked) must receive 403 on both dashboard and settings
    const parentDashB = await parent.request(`/parent/dashboard?studentId=${studentB.id}`);
    assert.equal(parentDashB.status, 403, 'AU07: Unlinked parent denied reading dashboard of Student B');

    const parentSettingsB = await parent.request('/parent/settings', 'POST', {
      studentId: studentB.id,
      maxMinutesPerDay: 99,
      allowedStartHour: 0,
      allowedEndHour: 24,
    });
    assert.equal(parentSettingsB.status, 403, 'AU07: Unlinked parent denied modifying settings of Student B');

    // AU09: Admin can access any student without elevation token
    const adminDashB = await manager.request(`/parent/dashboard?studentId=${studentB.id}`);
    assert.equal(adminDashB.status, 200, 'AU09: Admin can access Student B dashboard');

    const adminSettingsB = await manager.request('/parent/settings', 'POST', {
      studentId: studentB.id,
      maxMinutesPerDay: 60,
      allowedStartHour: 8,
      allowedEndHour: 20,
    });
    assert.equal(adminSettingsB.status, 200, 'AU09: Admin can update Student B settings');
  });
}

for(const engine of ['SQLite HTTP','PostgreSQL cloud adapter'])test('Parent redemption authorization and frozen cash conversion ['+engine+']',async t=>{
 const h=await harness(t,engine),manager=client(h.send,h.origin),child=client(h.send,h.origin),other=client(h.send,h.origin),secondSession=client(h.send,h.origin),parent=client(h.send,h.origin);
 async function post(c,route,body){const r=await c.request(route,'POST',body);assert.ok(r.status<300,JSON.stringify(r));return r.data;}
 await post(manager,'/setup',{token,name:'Reward controls',username:'reward.manager',password});const cls=await post(manager,'/classes',{name:'Lớp 3',grade:3});
 const {student}=await post(manager,'/students',{classId:cls.id,name:'An',username:'reward.child',password});const {student:sibling}=await post(manager,'/students',{classId:cls.id,name:'Bạn',username:'reward.other',password});
 await post(manager,'/wallet',{enabled:true,rateVnd:500});await post(manager,'/parent/setup-pin',{studentId:student.id,pin:'735291'});
 const sets=await seedRewardJourney((route,body)=>post(manager,route,body),cls.id);await post(child,'/login',{username:'reward.child',password});await post(other,'/login',{username:'reward.other',password});await post(secondSession,'/login',{username:'reward.child',password});
 await earnRewardJourney((route,body)=>post(child,route,body),sets);assert.equal((await child.request('/student/summary?cursor=current')).data.balance.earned,18);
 await post(child,'/redemptions',{requestId:'cash-flow',title:'Tiết kiệm 1.000 đồng',goalVnd:1000});const route='/parent/redemptions/cash-flow/transition';
 assert.equal((await child.request(route,'POST',{status:'approved'})).status,403);
 const verified=await post(child,'/parent/verify-pin',{pin:'735291'});child.setParentToken(verified.parentToken);other.setParentToken(verified.parentToken);secondSession.setParentToken(verified.parentToken);
 assert.equal((await other.request(route,'POST',{status:'approved'})).status,403);assert.equal((await secondSession.request(route,'POST',{status:'approved'})).status,403);
 assert.equal((await child.request('/redemptions/cash-flow/transition','POST',{status:'approved'})).status,403,'PIN token does not confer manager access');
 assert.equal((await child.request(route,'POST',{status:'fulfilled'})).status,409,'approval is required before delivery');await post(child,route,{status:'approved',note:'Chờ cuối tuần'});
 await post(manager,'/wallet',{enabled:true,rateVnd:1000});const report=(await child.request('/parent/dashboard')).data.report.redemptions.find(r=>r.requestId==='cash-flow');assert.equal(report.stars,2);assert.equal(report.rateVnd,500);assert.equal(report.amountVnd,1000);assert.equal(report.note,'Chờ cuối tuần');
 await post(manager,'/parent/setup-pin',{studentId:student.id,pin:'826402'});assert.equal((await child.request(route,'POST',{status:'fulfilled'})).status,403,'changing PIN revokes old elevation');child.setParentToken((await post(child,'/parent/verify-pin',{pin:'826402'})).parentToken);
 const fulfilled=await post(child,route,{status:'fulfilled'});const repeated=await post(child,route,{status:'fulfilled'});assert.deepEqual(repeated,fulfilled);assert.equal(fulfilled.history.length,3);
 const balance=(await child.request('/student/summary?cursor=current')).data.balance;assert.equal(balance.available,16);assert.equal(balance.redeemed,2);assert.equal(balance.pending,0);
 await post(child,'/redemptions',{requestId:'cash-refund',title:'Tiết kiệm sau',goalVnd:1000});await post(child,'/parent/redemptions/cash-refund/transition',{status:'rejected'});assert.equal((await child.request('/student/summary?cursor=current')).data.balance.available,16);

 const gift=await post(manager,'/gifts',{title:'Quà kiểm tra hoàn kho',kind:'item',priceStars:1,stock:2});await post(child,'/student/redeem-gift',{requestId:'gift-refund',giftId:gift.id});const refundRoute='/parent/redemptions/gift-refund/transition';
 const refunds=await Promise.all([post(child,refundRoute,{status:'rejected'}),post(child,refundRoute,{status:'rejected'})]);assert.equal(refunds[0].history.length,2);assert.equal(refunds[1].history.length,2);assert.equal((await manager.request('/gifts')).data.find(g=>g.id===gift.id).stock,2,'repeat rejection restores stock once');assert.equal((await child.request('/student/summary?cursor=current')).data.balance.available,16);
 await post(manager,'/parents',{name:'Cha mẹ bạn khác',username:'reward.parent',password,studentIds:[sibling.id]});await post(parent,'/login',{username:'reward.parent',password});assert.equal((await parent.request(route,'POST',{status:'fulfilled'})).status,403);
});
