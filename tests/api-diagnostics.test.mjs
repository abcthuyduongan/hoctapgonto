import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createFailureReporter,ONLINE_RUNTIME_VERSION} from '../server/api-diagnostics.mjs';
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
