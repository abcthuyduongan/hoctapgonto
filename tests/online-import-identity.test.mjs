import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {OnlineStore} from '../server/online-store.mjs';
import {createPostgresFixture} from './helpers/postgres-fixture.mjs';
import {onlineIdentityHash,onlineGeneratedItemId,onlineGeneratedPackId,onlineSourceCode} from '../src/core/online-import-identity.ts';

test('Portable SHA-256 source identities match independent Node cryptographic vectors',()=>{
  for(const value of ['', 'abc','Tiếng Việt có dấu và 😀','x'.repeat(4001)])assert.equal(onlineIdentityHash(value),createHash('sha256').update(value).digest('hex'));
  assert.equal(onlineGeneratedItemId({id:'old',prompt:'Câu tự soạn',answer:'A'}),onlineGeneratedItemId({answer:'A',prompt:'Câu tự soạn',id:'different'}));
  assert.equal(onlineGeneratedPackId(onlineSourceCode('Tuần tự chọn'),'Tên môn','quiz'),onlineGeneratedPackId(onlineSourceCode('Tuần tự chọn'),'Tên môn','quiz'));
});

for(const [name,fixture] of [['SQLite',sqliteFixture],['PostgreSQL',createPostgresFixture]])test(`${name}: explicit week revision pins old plays/media, advances future plays and preserves the source star ceiling`,async t=>{
  const {store,admin}=await fixture(t),classroom=await store.createClass(admin,{name:'Lớp cập nhật',grade:3});
  async function learner(username){const row=await store.createStudent(admin,{name:username,classId:classroom.id,username},'salt:student',username);
    const user=name==='SQLite'?store.db.prepare('SELECT * FROM users WHERE username=?').get(username):await store.findUserByUsername(username);
    return{id:user.id,workspaceId:admin.workspaceId,username,role:'student',studentId:row.id};}
  const completed=await learner('completed-learner'),active=await learner('active-learner'),observer=await learner('observer-learner');
  async function upload(file){const bytes=await readFile(new URL(`../public/icons/${file}`,import.meta.url));
    if(name==='SQLite')return store.uploadMedia(admin,{name:file,mime:'image/png',base64:bytes.toString('base64')});
    const mediaId=randomUUID();return store.addMedia(admin,{id:mediaId,name:file,mime:'image/png',bytes,objectPath:`${admin.workspaceId}/${mediaId}.png`});}
  const beforeMedia=await upload('bao-an-192.png'),afterMedia=await upload('bao-an-512.png');
  const source=quiz();source.items[0].media={imageId:beforeMedia.id,imageAlt:'Hình trước khi sửa'};
  const original={requestId:'revision-initial',classId:classroom.id,title:'Tuần cần cập nhật',sets:[{subjectLabel:'Môn do tác giả đặt',pack:source}]};
  const published=await store.publishWeek(admin,original);
  async function start(auth,requestId,version){return store.startPlay(auth,{requestId,moduleId:'math-quest',packId:source.id,contentVersion:version});}
  async function finish(auth,play){for(const item of play.presentation.items)await store.attempt(auth,play.session.sessionId,{attemptKey:`answer-${item.id}`,itemId:item.id,response:{kind:'choice',choiceIndex:item.correctIndex},hintsUsed:0,elapsedMs:100});return store.finishPlay(auth,play.session.sessionId);}
  const completedPlay=await start(completed,'completed-before-revision',1);assert.equal((await finish(completed,completedPlay)).gained,3);
  const activePlay=await start(active,'active-before-revision',1);
  const changed=structuredClone(source);changed.version=2;changed.items[0].correctIndex=0;changed.items[0].explanation='Lời giải phiên bản mới';changed.items[0].media={imageId:afterMedia.id,imageAlt:'Hình sau khi sửa'};
  const revision={requestId:'explicit-week-revision',replaceWeekId:published.id,classId:classroom.id,title:'Tuần đã cập nhật',sets:[{subjectLabel:'Môn do tác giả đặt',pack:changed}]};
  const revised=await store.publishWeek(admin,revision);assert.equal(revised.id,published.id);assert.equal(revised.position,published.position);assert.equal(revised.createdAt,published.createdAt);assert.equal(revised.title,'Tuần đã cập nhật');
  assert.equal(revised.sets[0].pack.id,source.id);assert.equal(revised.sets[0].pack.version,2);
  const oldCompleted=await store.play(completed,completedPlay.session.sessionId),oldActive=await store.play(active,activePlay.session.sessionId);
  assert.equal(oldCompleted.pack.version,1);assert.equal(oldActive.pack.items[0].correctIndex,2);assert.equal(oldActive.pack.items[0].media.imageId,beforeMedia.id);
  assert.ok(await store.readMedia(completed,beforeMedia.id));assert.ok(await store.readMedia(active,beforeMedia.id));
  await assert.rejects(Promise.resolve().then(()=>store.readMedia(observer,beforeMedia.id)),error=>error.status===404);
  assert.ok(await store.readMedia(observer,afterMedia.id));
  assert.equal((await finish(active,activePlay)).gained,3);
  const future=await start(completed,'future-after-revision',2);assert.equal(future.pack.version,2);assert.equal(future.presentation.items[0].correctIndex,0);
  assert.equal((await finish(completed,future)).gained,0);assert.equal((await store.studentState(completed)).balance.earned,3);
  await assert.rejects(Promise.resolve().then(()=>start(observer,'new-play-old-version',1)),error=>error.status===403);
  const retry=structuredClone(revision);retry.sets[0].pack.items.reverse();assert.equal((await store.publishWeek(admin,retry)).id,published.id);
  const binding=structuredClone(revision);binding.sets[0].pack.items[0].correctIndex=1;await assert.rejects(Promise.resolve().then(()=>store.publishWeek(admin,binding)),error=>error.status===409);
  const stale={...binding,requestId:'stale-revision'};await assert.rejects(Promise.resolve().then(()=>store.publishWeek(admin,stale)),error=>error.status===409&&/phiên bản 3/.test(error.message));
  await assert.rejects(Promise.resolve().then(()=>store.publishWeek(admin,{...revision,requestId:'wrong-week',replaceWeekId:randomUUID()})),error=>error.status===404);
  const added={...revision,requestId:'changed-groups',sets:[...revision.sets,{subjectLabel:'Nhóm mới',pack:pairs()}]};await assert.rejects(Promise.resolve().then(()=>store.publishWeek(admin,added)),error=>error.status===409);
  const wrongKind={...revision,requestId:'changed-kind',sets:[{subjectLabel:'Môn do tác giả đặt',pack:{...pairs(),id:source.id,version:3}}]};await assert.rejects(Promise.resolve().then(()=>store.publishWeek(admin,wrongKind)),error=>error.status===409);
  assert.equal((await store.dashboard(admin)).weeks.length,1);assert.equal((await store.studentState(completed)).balance.earned,3);
  const saved=await store.play(active,activePlay.session.sessionId);assert.equal(saved.session.status,'completed');assert.equal(saved.pack.version,1);
});
function quiz(id='legacy-random-source',version=1){return{id,version,title:'Bộ câu hỏi gốc',subject:'thinking',grade:3,kind:'quiz',source:'local',publishedAt:'2026-10-15T00:00:00.000Z',items:[
  {id:'author-01',kind:'multiple-choice',objectiveId:'AUTHOR.OWN',prompt:'Câu hỏi đầu tiên?',options:['Mây','Gió','Nắng','Mưa'],correctIndex:2,explanation:'Giải thích đầu tiên.'},
  {id:'author-02',kind:'multiple-choice',objectiveId:'AUTHOR.OWN',prompt:'Câu hỏi thứ hai?',options:['Hoa','Lá','Cành','Rễ'],correctIndex:1,explanation:'Giải thích thứ hai.'},
]};}
function pairs(){return{id:'second-source',version:1,title:'Bộ cặp gốc',subject:'thinking',grade:3,kind:'pairs',source:'local',publishedAt:'2026-10-15T00:00:00.000Z',items:[
  {id:'pair-author-1',kind:'pair',objectiveId:'AUTHOR.OWN',left:'Trước một',right:'Sau một'},
  {id:'pair-author-2',kind:'pair',objectiveId:'AUTHOR.OWN',left:'Trước hai',right:'Sau hai'},
]};}
async function sqliteFixture(t){
  const store=new OnlineStore(':memory:'),workspaceId=randomUUID(),userId=randomUUID(),at=new Date().toISOString();
  store.db.prepare('INSERT INTO workspaces(id,name,created_at) VALUES(?,?,?)').run(workspaceId,'Đơn vị SQLite',at);
  store.db.prepare("INSERT INTO users(id,workspace_id,username,password_hash,role,created_at) VALUES(?,?,?,?,'admin',?)").run(userId,workspaceId,'manager','salt:manager',at);
  t.after(()=>store.close());return{store,admin:{id:userId,workspaceId,username:'manager',role:'admin'}};
}
for(const [name,fixture] of [['SQLite',sqliteFixture],['PostgreSQL',createPostgresFixture]])test(`${name}: a shared source retains its published grade across class assignment, revision and transfer`,async t=>{
  const {store,admin}=await fixture(t),classes=[];
  for(const grade of [3,3,4])classes.push(await store.createClass(admin,{name:`Lớp ${classes.length}`,grade}));
  const input={title:'Tuần ôn tập dùng chung',sets:[{subjectLabel:'Ôn tập',pack:quiz()}]},weeks=[];
  for(const [index,cls]of classes.entries())weeks.push(await store.publishWeek(admin,{...structuredClone(input),classId:cls.id,requestId:`shared-${index}`}));
  for(const week of weeks)assert.deepEqual(week.sets[0].pack,weeks[0].sets[0].pack);
  const student=await store.createStudent(admin,{name:'An',classId:classes[0].id,username:'shared.learner'},'salt:student','shared.learner');
  const user=name==='SQLite'?store.db.prepare("SELECT * FROM users WHERE username='shared.learner'").get():await store.findUserByUsername('shared.learner');
  const learner={id:user.id,workspaceId:admin.workspaceId,username:user.username,role:'student',studentId:student.id};
  async function finish(requestId,version){const play=await store.startPlay(learner,{requestId,moduleId:'math-quest',packId:quiz().id,contentVersion:version});
    for(const item of play.presentation.items)await store.attempt(learner,play.session.sessionId,{attemptKey:`answer-${item.id}`,itemId:item.id,response:{kind:'choice',choiceIndex:item.correctIndex},hintsUsed:0,elapsedMs:100});
    return store.finishPlay(learner,play.session.sessionId);}
  assert.equal((await finish('before-transfer',1)).gained,3);
  await store.updateStudent(admin,student.id,{classId:classes[2].id});
  assert.equal((await store.studentState(learner)).profile.grade,4);
  assert.equal((await finish('after-transfer',1)).gained,0);
  const revised=quiz(undefined,2);revised.grade=4;revised.items[0].explanation='Giải thích đã cập nhật';
  const revision={requestId:'shared-revision-4',replaceWeekId:weeks[2].id,classId:classes[2].id,title:input.title,sets:[{subjectLabel:'Ôn tập',pack:revised}]};
  const updated=await store.publishWeek(admin,revision);assert.equal(updated.sets[0].pack.grade,3);
  await store.publishWeek(admin,{...revision,requestId:'shared-revision-3',replaceWeekId:weeks[0].id,classId:classes[0].id});
  assert.equal((await finish('after-revision',2)).gained,0);
  const invalid=structuredClone(revision);invalid.requestId='changed-without-version';invalid.sets[0].pack.items[0].correctIndex=0;
  await assert.rejects(Promise.resolve().then(()=>store.publishWeek(admin,invalid)),e=>e.status===409);
  const copy=structuredClone(input);copy.sets[0].pack.id='copied-for-another-grade';
  await assert.rejects(Promise.resolve().then(()=>store.publishWeek(admin,{...copy,title:'Tuần sao chép',requestId:'grade-copy',classId:classes[2].id})),e=>e.status===409);
  const state=await store.studentState(learner);assert.equal(state.balance.earned,3);assert.equal((await store.dashboard(admin)).weeks.length,3);
});
for(const [name,fixture] of [['SQLite',sqliteFixture],['PostgreSQL',createPostgresFixture]])test(`${name}: reimport is source-stable, immutable, atomic and cannot mint stars through copied IDs`,async t=>{
  const {store,admin}=await fixture(t),classroom=await store.createClass(admin,{name:'Lớp nhập học liệu',grade:3});
  const student=await store.createStudent(admin,{name:'An',classId:classroom.id,username:'learner'},'salt:student','learner');
  const user=name==='SQLite'?store.db.prepare("SELECT * FROM users WHERE username='learner'").get():await store.findUserByUsername('learner');
  const learner={id:user.id,workspaceId:admin.workspaceId,username:'learner',role:'student',studentId:student.id};
  const original={requestId:'first-preview',classId:classroom.id,title:'Tuần nhập đầu tiên',sets:[{subjectLabel:'Môn tự chọn',pack:quiz()},{subjectLabel:'Môn khác',pack:pairs()}]};
  const published=await store.publishWeek(admin,original);
  const replay=structuredClone(original);replay.requestId='another-preview';replay.sets.reverse();
  for(const set of replay.sets){set.pack.id='copy-'+randomUUID();set.pack.items.reverse();set.pack.items.forEach(item=>{item.id='copied-'+randomUUID();});set.pack.publishedAt=new Date().toISOString();}
  const [a,b]=await Promise.all([Promise.resolve().then(()=>store.publishWeek(admin,replay)),Promise.resolve().then(()=>store.publishWeek(admin,{...replay,requestId:'concurrent-preview'}))]);
  assert.equal(a.id,published.id);assert.equal(b.id,published.id);assert.equal(a.sets[0].pack.id,'legacy-random-source');assert.equal(a.sets[0].pack.items[0].id,'author-01');
  assert.equal((await store.dashboard(admin)).weeks.length,1);assert.equal((await store.dashboard(admin)).stats.questions,4);
  const play=await store.startPlay(learner,{requestId:'learner-original',moduleId:'math-quest',packId:quiz().id,contentVersion:1});
  for(const item of play.presentation.items)await store.attempt(learner,play.session.sessionId,{attemptKey:`answer-${item.id}`,itemId:item.id,response:{kind:'choice',choiceIndex:item.correctIndex},hintsUsed:0,elapsedMs:100});
  assert.equal((await store.finishPlay(learner,play.session.sessionId)).gained,3);
  await store.publishWeek(admin,{...replay,requestId:'after-earned'});assert.equal((await store.studentState(learner)).balance.earned,3);
  const assertConflict=async input=>{await assert.rejects(Promise.resolve().then(()=>store.publishWeek(admin,input)),error=>error.status===409);assert.equal((await store.dashboard(admin)).weeks.length,1);assert.equal((await store.studentState(learner)).balance.earned,3);};
  await assertConflict({...replay,requestId:'renamed-copy',title:'Đổi tên tuần để nhận lại sao'});
  const changed=structuredClone(original);changed.requestId='changed-question';changed.sets[0].pack.items[0].options[2]='Đáp án đã sửa';await assertConflict(changed);
  const partial=structuredClone(changed);partial.requestId='atomic-correction';partial.sets.unshift({subjectLabel:'Mới',pack:{...quiz('new-not-inserted'),title:'Câu khác',items:quiz().items.map(item=>({...item,prompt:item.prompt+' nội dung mới'}))}});await assertConflict(partial);
  assert.equal((await store.dashboard(admin)).stats.questions,4);
  const later=await store.createClass(admin,{name:'Lớp nhận phiên bản mới',grade:3}),revision=quiz(undefined,2);revision.items[0].options[2]='Đáp án phiên bản hai';
  const revised=await store.publishWeek(admin,{requestId:'explicit-revision-new-class',classId:later.id,title:'Tuần phiên bản hai',sets:[{subjectLabel:'Môn tự chọn',pack:revision}]});
  assert.equal(revised.sets[0].pack.id,'legacy-random-source');assert.equal(revised.sets[0].pack.version,2);
  const old=(await store.dashboard(admin)).weeks.find(week=>week.id===published.id);assert.equal(old.sets[0].pack.version,1);assert.equal(old.sets[0].pack.items[0].options[2],'Nắng');
  assert.equal((await store.studentState(learner)).balance.earned,3);
  const pairRevision=pairs();pairRevision.version=2;
  const updated=await store.publishWeek(admin,{requestId:'revise-group-order',replaceWeekId:published.id,classId:classroom.id,title:original.title,sets:[{subjectLabel:'Môn khác',pack:pairRevision},{subjectLabel:'Môn tự chọn',pack:revision}]});
  assert.deepEqual(updated.sets.map(set=>set.pack.id),published.sets.map(set=>set.pack.id));assert.ok(updated.sets.every(set=>set.pack.version===2));
  const concurrent=label=>({requestId:`revision-${label}`,replaceWeekId:published.id,classId:classroom.id,title:original.title,sets:updated.sets.map(set=>({subjectLabel:set.subjectLabel,pack:{...structuredClone(set.pack),version:3,...(set.pack.kind==='quiz'?{items:set.pack.items.map((item,index)=>({...item,...(index===0?{explanation:`Giải thích ${label}`}:{})}))}:{})}}))});
  const race=await Promise.allSettled(['a','b'].map(label=>Promise.resolve().then(()=>store.publishWeek(admin,concurrent(label)))));
  assert.equal(race.filter(row=>row.status==='fulfilled').length,1);assert.equal(race.find(row=>row.status==='rejected').reason.status,409);
  const latest=(await store.dashboard(admin)).weeks.find(week=>week.id===published.id);assert.ok(latest.sets.every(set=>set.pack.version===3));assert.equal((await store.studentState(learner)).balance.earned,3);
});
