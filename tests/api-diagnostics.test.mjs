import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createFailureReporter,createPerformanceReporter,measureApiSpan,measureApiSerialization,ONLINE_RUNTIME_VERSION} from '../server/api-diagnostics.mjs';
import {setTimeout as delay} from 'node:timers/promises';
test('failure diagnostics redact identifiers, queries, bodies and unknown routes',()=>{
 const logs=[],report=createFailureReporter({logger:s=>logs.push(s),now:()=>1000});assert.equal(report('/api/online/login','POST',401,10),undefined);
 const id=report('/api/online/play/PRIVATE_STUDENT_ID/attempt?token=PRIVATE_TOKEN','POST',500,12.5);assert.match(id,/^BA-[a-f0-9]{12}$/);assert.equal(JSON.parse(logs[0]).routeGroup,'play');assert.equal(JSON.parse(logs[0]).supportId,id);assert.equal(JSON.parse(logs[0]).elapsedMs,13);assert.doesNotMatch(logs.join(''),/PRIVATE_|token=|cookie|password/i);
 report('/api/online/PRIVATE_USER_NAME','SECRET_METHOD',503,1);assert.equal(JSON.parse(logs[1]).routeGroup,'other');assert.equal(JSON.parse(logs[1]).method,'OTHER');
});
test('failure diagnostics keep a bounded log budget and cannot break an API if logging fails',()=>{
 let now=1000;const logs=[],report=createFailureReporter({logger:s=>logs.push(s),now:()=>now,limit:2});for(let i=0;i<100;i++)report('/api/online/media/private','GET',502,1);assert.equal(logs.length,2);now+=60000;assert.ok(report('/api/online/media/private','GET',502,1));assert.equal(logs.length,3);
 assert.equal(createFailureReporter({logger(){throw Error('logging unavailable');}})('/api/online/play/id','POST',500,1),undefined);
});
test('diagnostics identify the same version as the application package',async()=>{const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));assert.equal(ONLINE_RUNTIME_VERSION,pkg.version);});

test('performance samples isolate overlapping requests and contain only allowlisted numbers and labels',async()=>{
 const logs=[],report=createPerformanceReporter({enabled:true,logger:s=>logs.push(JSON.parse(s)),sampleEvery:1});
 await Promise.all([
  report('/api/online/play/PRIVATE_ACCOUNT/attempt?token=SECRET','POST',async()=>{await measureApiSpan('sql',()=>measureApiSpan('lockingSql',()=>delay(8)));measureApiSerialization(()=>JSON.stringify({password:'SECRET'}));return new Response('{}',{status:201});}),
  report('/api/online/media/PRIVATE_MEDIA','GET',async()=>{await measureApiSpan('storage',()=>delay(2));await measureApiSpan('PRIVATE_LABEL',()=>delay(1));return new Response('image');}),
 ]);
 const play=logs.find(row=>row.routeGroup==='play'),media=logs.find(row=>row.routeGroup==='media');
 assert.equal(play.sqlCount,1);assert.equal(play.status,201);assert.ok(play.lockingSqlMs>0);assert.equal(play.storageMs,0);assert.equal(media.sqlCount,0);assert.ok(media.storageMs>0);
 assert.match(play.requestId,/^BT-[a-f0-9]{12}$/);assert.notEqual(play.requestId,media.requestId);
 assert.doesNotMatch(JSON.stringify(logs),/PRIVATE_|SECRET|"password":|cookie|token|SELECT/);
 assert.deepEqual(Object.keys(play).sort(),['event','version','requestId','at','routeGroup','method','status','elapsedMs','sqlMs','lockingSqlMs','poolMs','passwordMs','storageMs','serializeMs','sqlCount'].sort());
});

test('performance reporting is opt-in, sampled, bounded per minute and cannot change responses or errors',async()=>{
 let at=1000,calls=0;const logs=[],action=async()=>{calls++;return new Response('{}');};
 await createPerformanceReporter({enabled:false,logger:()=>assert.fail('disabled')})('/api/online/login','POST',action);
 const report=createPerformanceReporter({enabled:true,logger:s=>logs.push(s),now:()=>at,limit:2,sampleEvery:2});
 for(let i=0;i<12;i++)await report('/api/online/PRIVATE_NAME','SECRET_METHOD',action);
 assert.equal(calls,13);assert.equal(logs.length,2);assert.equal(JSON.parse(logs[0]).routeGroup,'other');assert.equal(JSON.parse(logs[0]).method,'OTHER');
 at+=60000;await report('/api/online/me','GET',action);await report('/api/online/me','GET',action);assert.equal(logs.length,3);
 const broken=createPerformanceReporter({enabled:true,logger(){throw Error('broken logger');},sampleEvery:1});
 assert.equal((await broken('/api/online/login','POST',action)).status,200);
 const expected=new Error('original error');await assert.rejects(broken('/api/online/login','POST',async()=>{throw expected;}),error=>error===expected);
});
