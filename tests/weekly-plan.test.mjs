import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {OnlineStore} from '../server/online-store.mjs';
import {createPostgresFixture,authFor} from './helpers/postgres-fixture.mjs';
import {weeklySubjectId,weeklyPlanErrors,createWeeklyPlan,validateWeeklyPlan,summarizeWeeklySubjects} from '../src/core/weekly-plan.ts';
import {adminSummary,adminWeek,adminMedia,adminWeekCheck} from '../server/admin-data.mjs';
import {createCloudApi} from '../server/cloud-api.mjs';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import {snapshotOnlineDatabase,inspectOnlineBackup,restoreOnlineDatabase} from '../server/online-recovery.mjs';

const at='2026-10-17T00:00:00.000Z';
function pack(id,n=2){return{id,version:1,title:'Bộ '+id,subject:'thinking',grade:3,kind:'quiz',source:'local',publishedAt:at,items:Array.from({length:n},(_,i)=>({id:`q${i}`,kind:'multiple-choice',objectiveId:'WEEK.PLAN',prompt:`${id}: yêu cầu ${i}`,options:[`${id} đúng ${i}`,`${id} sai A ${i}`,`${id} sai B ${i}`,`${id} sai C ${i}`],correctIndex:0,explanation:'Đáp án thứ nhất.',metadata:{knowledgeId:'WEEK.PLAN',difficulty:['easy','medium','hard'][i%3],contentRole:'practice',source:'Mẫu thử',rights:'Tự biên soạn',reviewStatus:'draft'}}))};}
function sets(prefix='source',count=3,n=2){return['Toán','Tiếng Việt','Tiếng Anh','Khoa học','Công nghệ'].slice(0,count).map((subjectLabel,i)=>({subjectLabel,pack:pack(`${prefix}-${i}`,n)}));}
test('weekly subject IDs normalize known names, count every source set and retain explicit difficulty',()=>{
  assert.equal(weeklySubjectId('  TOÁN '),'math');assert.equal(weeklySubjectId('toan'),'math');assert.notEqual(weeklySubjectId('Công nghệ'),weeklySubjectId('Khoa học'));
  const source=sets('pure',3,12),plan=createWeeklyPlan(source);assert.equal(summarizeWeeklySubjects(source).length,3);assert.deepEqual(summarizeWeeklySubjects(source)[0],{id:'math',label:'Toán',questions:12,easy:4,medium:4,hard:4,sets:1});assert.equal(validateWeeklyPlan(plan,source),true);
  assert.match(weeklyPlanErrors([...sets('a',3),{subjectLabel:'TOÁN',pack:pack('extra',11)}]).join(' '),/13 câu/);
  assert.match(weeklyPlanErrors(sets('b',2)).join(' '),/3–4 môn/);assert.match(weeklyPlanErrors(sets('c',5)).join(' '),/3–4 môn/);
  assert.equal(validateWeeklyPlan({...plan,assignments:{}},source),false);assert.match(weeklyPlanErrors(sets().map((set,i)=>({...set,subjectId:i?'english':'fake-math'}))).join(' '),/mã math/);
});
async function fixture(t,engine){let store,admin;if(engine==='PostgreSQL'){({store,admin}=await createPostgresFixture(t));}else{store=new OnlineStore(':memory:');t.after(()=>store.close());const workspaceId=randomUUID(),id=randomUUID();store.db.prepare('INSERT INTO workspaces(id,name,created_at) VALUES(?,?,?)').run(workspaceId,'Kế hoạch tuần',at);store.db.prepare('INSERT INTO users(id,workspace_id,username,password_hash,role,created_at) VALUES(?,?,?,?,?,?)').run(id,workspaceId,'manager','fixture-hash','admin',at);admin={id,workspaceId,role:'admin',username:'manager'};}
  const cls=await store.createClass(admin,{name:'Lớp kế hoạch',grade:3});let seq=0;const publish=(source,title='Tuần '+ ++seq,replaceWeekId)=>store.publishWeek(admin,{requestId:randomUUID(),classId:cls.id,title,sets:source,...(replaceWeekId?{replaceWeekId}:{})});return{store,admin,cls,publish};}
for(const engine of ['SQLite','PostgreSQL']){
  test(`${engine}: new weeks enforce 3–4 subjects and 12 questions per subject in the authoritative store`,async t=>{
    const f=await fixture(t,engine);await assert.rejects(async()=>f.publish(sets('too-few',2)),/3–4 môn/);await assert.rejects(async()=>f.publish(sets('too-many',5)),/3–4 môn/);
    await assert.rejects(async()=>f.publish(sets('too-long',3,13)),/13 câu/);
    const source=sets('valid',3,12),week=await f.publish(source);assert.equal(week.plan.subjects.length,3);assert.equal(week.sets[0].subjectId,'math');assert.equal(validateWeeklyPlan(week.plan,week.sets),true);
    const four=await f.publish(sets('four',4,12));assert.equal(four.plan.subjects.length,4);assert.equal(four.sets.reduce((n,set)=>n+set.pack.items.length,0),48);
    const summary=await adminSummary(f.store,f.admin,{classId:f.cls.id,section:'weeks',offset:'0'});assert.equal(summary.weeks.length,2);assert.equal(summary.stats.questions,84);assert.equal(JSON.stringify(summary).includes('"items"'),false);assert.equal(summary.weeks[0].sets[0].pack.itemCount,12);
    const detail=await adminWeek(f.store,f.admin,week.id);assert.equal(detail.sets[0].pack.items.length,12);await assert.rejects(()=>adminWeek(f.store,{...f.admin,role:'student'},week.id),error=>error.status===403);
  });
  test(`${engine}: a closed week protects question meaning but permits editorial revisions and keeps its policy`,async t=>{
    const f=await fixture(t,engine),source=sets('closed'),week=await f.publish(source),next=await f.publish(sets('next'));
    const student=await f.store.createStudent(f.admin,{classId:f.cls.id,name:'Học sinh',username:'plan.child'},'fixture-hash','plan.child'),user=engine==='SQLite'?f.store.db.prepare('SELECT * FROM users WHERE id=?').get(student.userId??f.store.student(f.admin,student.id).user_id):await f.store.findUserByUsername('plan.child'),auth=engine==='SQLite'?{id:user.id,workspaceId:f.admin.workspaceId,studentId:student.id,role:'student',username:'plan.child'}:authFor(user);
    await f.store.ensureJourney(auth);for(const set of source){const play=await f.store.startPlay(auth,{requestId:randomUUID(),moduleId:'math-quest',packId:set.pack.id,contentVersion:1},true);for(const item of set.pack.items){await f.store.openQuestion(auth,play.session.sessionId,{itemId:item.id});await f.store.attempt(auth,play.session.sessionId,{attemptKey:item.id,itemId:item.id,response:{kind:'choice',choiceIndex:0},hintsUsed:0,elapsedMs:0});}}
    assert.equal((await f.store.studentSummary(auth)).balance.earned,18);await f.store.advanceWeek(auth,{weekId:week.id,requestId:'advance-plan'});assert.equal((await f.store.studentSummary(auth)).currentWeekSummary.weekId,next.id);
    const changed=source.map(set=>({...set,pack:{...set.pack,version:2,items:set.pack.items.map(item=>({...item,id:item.id+'-new',prompt:item.prompt+' thay nội dung'}))}}));await assert.rejects(async()=>f.publish(changed,week.title,week.id),/1 học sinh đã đóng tuần/);assert.match((await adminWeekCheck(f.store,f.admin,{classId:f.cls.id,title:week.title,replaceWeekId:week.id,sets:changed})).revisionError,/1 học sinh đã đóng tuần/);
    const editorial=source.map(set=>({...set,pack:{...set.pack,version:2,items:set.pack.items.map(item=>({...item,explanation:'Lời giải rõ hơn.'}))}}));const revised=await f.publish(editorial,week.title,week.id);assert.deepEqual(revised.plan,week.plan);assert.equal((await adminWeek(f.store,f.admin,week.id)).closedStudents,1);assert.equal((await f.store.studentSummary(auth)).balance.earned,18);
  });
}
test('SQLite media pagination still looks up a file beyond the visible library page',async t=>{const f=await fixture(t,'SQLite'),png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');for(let i=0;i<25;i++)f.store.uploadMedia(f.admin,{name:`image-${String(i).padStart(2,'0')}.png`,mime:'image/png',base64:png.toString('base64')});const page=await adminMedia(f.store,f.admin);assert.equal(page.assets.length,20);assert.equal(page.page.total,25);const lookup=await adminMedia(f.store,f.admin,{names:['IMAGE-24.PNG']});assert.equal(lookup.length,1);assert.equal(lookup[0].name,'image-24.png');});


for(const engine of ['SQLite','PostgreSQL'])test(engine+': admin pagination, search, media lookup and selected-week detail stay scoped',async t=>{
 const f=await fixture(t,engine);for(let i=0;i<25;i++)await f.store.createStudent(f.admin,{classId:f.cls.id,name:i===24?'BẠN 24':'Bạn '+String(i).padStart(2,'0'),username:'page.child.'+i},'fixture-hash','page.child.'+i);
 const first=await adminSummary(f.store,f.admin,{classId:f.cls.id});assert.equal(first.students.length,20);assert.equal(first.page.nextOffset,20);assert.equal(first.page.total,25);const second=await adminSummary(f.store,f.admin,{classId:f.cls.id,offset:'20'});assert.equal(second.students.length,5);assert.equal(new Set([...first.students,...second.students].map(s=>s.id)).size,25);
 const search=await adminSummary(f.store,f.admin,{classId:f.cls.id,query:'page.child.24'});assert.equal(search.students.length,1);assert.equal(search.students[0].username,'page.child.24');assert.equal((await adminSummary(f.store,f.admin,{classId:f.cls.id,query:'Bạn 24'})).students.length,1);
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64'),name='HÌNH-ẢNH.png'.normalize('NFD');if(engine==='SQLite')f.store.uploadMedia(f.admin,{name,mime:'image/png',base64:png.toString('base64')});else {const mediaId=randomUUID();await f.store.addMedia(f.admin,{id:mediaId,name,mime:'image/png',bytes:png,objectPath:f.admin.workspaceId+'/'+mediaId});}assert.equal((await adminMedia(f.store,f.admin,{names:['hình-ảnh.png']})).length,1);assert.equal((await adminSummary(f.store,f.admin,{classId:f.cls.id,query:'%'})).students.length,0);
 await assert.rejects(()=>adminSummary(f.store,f.admin,{classId:randomUUID()}),e=>e.status===404);await assert.rejects(()=>adminSummary(f.store,f.admin,{offset:'-1'}),e=>e.status===400);await assert.rejects(()=>adminMedia(f.store,{...f.admin,role:'student'}),e=>e.status===403);await assert.rejects(()=>adminMedia(f.store,f.admin,{names:Array(101).fill('a.png')}),e=>e.status===400);
 const week=await f.publish(sets('assignment'));const reassigned=week.sets.map((set,i)=>({subjectLabel:set.subjectLabel,pack:set.pack,subjectId:i===0?'english':set.subjectId}));await assert.rejects(()=>Promise.resolve().then(()=>f.publish(reassigned,week.title,week.id)),e=>e.status===409);
});

test('cloud admin endpoints enforce authentication, CSRF and authoritative week limits',async t=>{
 const f=await fixture(t,'PostgreSQL'),token='planned-api-session',csrf='planned-api-csrf',origin='https://weekly.example.test',user=await f.store.findUserById(f.admin.id);
 await f.store.createSession({tokenHash:createHash('sha256').update(token).digest('hex'),userId:user.id,csrfToken:csrf,expiresAt:Date.now()+600000,passwordHash:user.password_hash});
 const api=createCloudApi({store:f.store,storage:{},publicOrigin:origin,setupToken:'fixture-bootstrap'});
 const call=(route,{body,cookie=true,csrfToken=csrf}={})=>api(new Request(origin+'/api/online'+route,{method:body?'POST':'GET',headers:{Origin:origin,...(cookie?{Cookie:'baoan_online_session='+token}:{}),...(body?{'Content-Type':'application/json','X-CSRF-Token':csrfToken}:{})},...(body?{body:JSON.stringify(body)}:{})}));
 assert.equal((await call('/admin/summary',{cookie:false})).status,401);assert.equal((await call('/admin/media/lookup',{body:{names:['a.png']},csrfToken:'wrong'})).status,403);
 const input={requestId:'api-publish',classId:f.cls.id,title:'Tuần API',sets:sets('api',2)};assert.equal((await call('/weeks',{body:input})).status,400);input.sets=sets('api',3);const response=await call('/weeks',{body:input});assert.equal(response.status,201);const week=await response.json();assert.equal(week.plan.subjects.length,3);
 const summary=await(await call('/admin/summary?section=weeks&classId='+f.cls.id)).json();assert.equal(summary.weeks.length,1);assert.equal(JSON.stringify(summary).includes('"items"'),false);assert.equal((await call('/admin/weeks/'+randomUUID())).status,404);assert.equal((await(await call('/admin/weeks/'+week.id)).json()).sets[0].pack.items.length,2);
});

test('SQLite recovery retains a weekly policy snapshot and rejects corrupt or duplicate policy records',async t=>{
 const f=await fixture(t,'SQLite'),week=await f.publish(sets('backup')),root=path.resolve('test-results'),directory=await mkdtemp(path.join(root,'weekly-recovery-'));
 t.after(async()=>{assert.equal(path.dirname(path.resolve(directory)),root);assert.match(path.basename(directory),/^weekly-recovery-/);await rm(directory,{recursive:true,force:true});});
 const backup=path.join(directory,'weekly.sqlite'),preview=await snapshotOnlineDatabase(f.store.db,backup),target=path.join(directory,'restored','weekly.sqlite');await restoreOnlineDatabase({databasePath:target,backupPath:backup,expectedSha256:preview.sha256});const restored=new OnlineStore(target);try{assert.deepEqual(restored.weeks(f.admin,f.cls.id)[0].plan,week.plan);}finally{restored.close();}
 const db=new DatabaseSync(backup);try{const row=db.prepare("SELECT rowid,target_id FROM audit WHERE action='week.policy'").get(),marker=JSON.parse(row.target_id);marker.plan.maxQuestionsPerSubject=13;db.prepare('UPDATE audit SET target_id=? WHERE rowid=?').run(JSON.stringify(marker),row.rowid);}finally{db.close();}assert.throws(()=>inspectOnlineBackup(backup),e=>e.status===400&&/Cấu hình tuần/.test(e.message));
});
