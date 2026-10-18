/** Isolated local regression measurement; this does not estimate Netlify capacity. */
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {once} from 'node:events';
import {mkdir,writeFile} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import {createOnlineServer} from '../server/online-server.mjs';
import {adminSummary,adminWeek,adminWeekCheck} from '../server/admin-data.mjs';
import {createWeeklyPlan} from '../src/core/weekly-plan.ts';
import {seedLegacyWeek} from '../tests/helpers/legacy-weeks.mjs';

const bytes=value=>Buffer.byteLength(JSON.stringify(value)),results=[];
const source=(id,n=12)=>({id,version:1,title:'Bộ '+id,kind:'quiz',subject:'thinking',grade:3,source:'local',publishedAt:'2026-10-17T00:00:00.000Z',items:Array.from({length:n},(_,i)=>({id:'q'+i,kind:'multiple-choice',objectiveId:'LOAD.FIXTURE',prompt:`${id} câu ${i}`,options:[`Đúng ${id}.${i}`,'Sai B','Sai C','Sai D'],correctIndex:0,explanation:'Đáp án đầu tiên.'}))});
async function measure(action){const started=performance.now(),data=await action();return{ms:Math.round((performance.now()-started)*100)/100,bytes:bytes(data),data};}
for(const subjectCount of [3,4]){
 const server=createOnlineServer({databasePath:':memory:',secureCookies:false,setupToken:'benchmark-not-public'}),store=server.onlineStore,workspaceId=randomUUID(),id=randomUUID(),at=new Date().toISOString();
 store.db.prepare('INSERT INTO workspaces(id,name,created_at) VALUES(?,?,?)').run(workspaceId,'Isolated load fixture',at);store.db.prepare('INSERT INTO users(id,workspace_id,username,password_hash,role,created_at) VALUES(?,?,?,?,?,?)').run(id,workspaceId,'benchmark.admin','fixture-hash','admin',at);const admin={id,workspaceId,role:'admin',username:'benchmark.admin'},cls=store.createClass(admin,{name:'52 tuần thử',grade:3});
 server.listen(0,'127.0.0.1');await once(server,'listening');const origin='http://127.0.0.1:'+server.address().port;
 try{
  for(let w=1;w<=52;w++){const sets=['Toán','Tiếng Việt','Tiếng Anh','Khoa học'].slice(0,subjectCount).map((subjectLabel,s)=>({subjectLabel,pack:source(`load-${subjectCount}-${w}-${s}`)})),week=seedLegacyWeek(store,admin,{requestId:'load-week-'+w,title:'Tuần '+w,classId:cls.id,sets});store.audit(admin,'week.policy',JSON.stringify({weekId:week.id,plan:createWeeklyPlan(sets)}));}
  const legacy=seedLegacyWeek(store,admin,{requestId:'legacy-140',title:'Tuần cũ 140 câu',classId:cls.id,sets:Array.from({length:5},(_,i)=>({subjectLabel:'Môn cũ '+i,pack:source('legacy-'+subjectCount+'-'+i,28)}))});assert.equal(legacy.plan,undefined);
  const learners=Array.from({length:30},(_,i)=>{const username='load.child.'+i,student=store.createStudent(admin,{classId:cls.id,name:'Học sinh '+i,username},'fixture-hash',username),user=store.db.prepare('SELECT user_id FROM students WHERE id=?').get(student.id),token='load-token-'+subjectCount+'-'+i;store.db.prepare('INSERT INTO auth_sessions VALUES(?,?,?,?)').run(createHash('sha256').update(token).digest('hex'),user.user_id,'load-csrf',Date.now()+600000);return{token,auth:{id:user.user_id,workspaceId,role:'student',studentId:student.id,username}};});
  const baseline=await measure(()=>store.dashboard(admin)),summary=await measure(()=>adminSummary(store,admin,{classId:cls.id,section:'weeks'})),first=summary.data.weeks[0],detail=await measure(()=>adminWeek(store,admin,first.id));
  assert.equal(summary.data.weeks.length,20);assert.equal(JSON.stringify(summary.data).includes('"items"'),false);assert.equal(detail.data.sets.reduce((n,set)=>n+set.pack.items.length,0),12*subjectCount);assert.ok(summary.bytes<baseline.bytes/5);
  const preview=await measure(()=>adminWeekCheck(store,admin,{classId:cls.id,title:first.title,sets:detail.data.sets.map(({subjectLabel,pack})=>({subjectLabel,pack}))}));assert.equal(preview.data.duplicateWeek.id,first.id);
  const concurrency=[];for(const n of [10,30]){const started=performance.now(),responses=await Promise.all(learners.slice(0,n).map(async learner=>{const response=await fetch(origin+'/api/online/student/summary',{headers:{Cookie:'baoan_online_session='+learner.token}}),text=await response.text();assert.equal(response.status,200);assert.equal(text.includes('"items"'),false);return Buffer.byteLength(text);}));concurrency.push({sessions:n,totalMs:Math.round(performance.now()-started),maxResponseBytes:Math.max(...responses),errors:0});}
  const cycles=[];for(let i=0;i<20;i++){const result=await measure(()=>store.startPlay(learners[0].auth,{requestId:'cycle-'+i,moduleId:'math-quest',packId:first.sets[0].pack.id,contentVersion:1},true));store.finishPlay(learners[0].auth,result.data.session.sessionId,true,true);global.gc?.();cycles.push({iteration:i+1,openMs:result.ms,bytes:result.bytes,heapBytes:process.memoryUsage().heapUsed});}assert.equal(store.db.prepare("SELECT count(*) AS n FROM plays WHERE json_extract(json,'$.status')='active'").get().n,0);
  results.push({subjects:subjectCount,weeks:52,plannedQuestions:52*subjectCount*12,legacyQuestions:140,baseline:{ms:baseline.ms,bytes:baseline.bytes},adminList:{ms:summary.ms,bytes:summary.bytes},oneWeek:{ms:detail.ms,bytes:detail.bytes},preview:{ms:preview.ms,bytes:preview.bytes},concurrency,cycles});
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));server.onlineClose();}
}
await mkdir('test-results',{recursive:true});await writeFile('test-results/rc9-load-benchmark.json',JSON.stringify({environment:'isolated local SQLite; HTTP 10/30 sessions; not production capacity',gcAvailable:typeof global.gc==='function',results},null,2));console.log(JSON.stringify(results.map(({cycles,...result})=>({...result,heapAfterWarmup:cycles[4].heapBytes,heapAfter20:cycles[19].heapBytes,maxOpenMs:Math.max(...cycles.map(c=>c.openMs))}))));
