import test from 'node:test';
import assert from 'node:assert/strict';
import {setTimeout as tick} from 'node:timers/promises';
import {createQuestionImageLoader} from '../src/core/question-image-loader.ts';

const response=()=>new Response(new Uint8Array([1,2,3]),{headers:{'Content-Type':'image/png'}});
test('image requests coalesce within a play, isolate other plays and revoke blobs at scope cleanup',async()=>{
  let calls=0,created=0;const revoked=[],loader=createQuestionImageLoader({fetchImage:async()=>{calls++;return response();},createURL:()=>`blob:${++created}`,revokeURL:url=>revoked.push(url)});
  const first=loader.acquire('play-a','/image'),second=loader.acquire('play-a','/image');
  assert.equal(first.promise,second.promise);assert.equal(await first.promise,'blob:1');assert.equal(calls,1);
  first.release();second.release();const again=loader.acquire('play-a','/image');assert.equal(await again.promise,'blob:1');assert.equal(calls,1);again.release();
  const other=loader.acquire('play-b','/image');assert.equal(await other.promise,'blob:2');assert.equal(calls,2);
  loader.clear('play-a');assert.deepEqual(revoked,['blob:1']);assert.equal(loader.stats().entries,1);
  other.release();loader.clear();assert.deepEqual(revoked,['blob:1','blob:2']);assert.equal(loader.stats().bytes,0);
});
test('image loader bounds network concurrency and aborts both queued and active work on logout',async()=>{
  let active=0,max=0;const gates=[],loader=createQuestionImageLoader({fetchImage:async(_url,{signal})=>{
    active++;max=Math.max(max,active);
    try{await new Promise((resolve,reject)=>{gates.push(resolve);signal.addEventListener('abort',()=>reject(signal.reason),{once:true});});return response();}finally{active--;}
  },createURL:()=> 'blob:fixture',revokeURL:()=>{}});
  const requests=Array.from({length:8},(_,i)=>loader.acquire('one-play',`/image-${i}`));
  const outcomes=Promise.allSettled(requests.map(request=>request.promise));assert.equal(gates.length,4);
  gates[0]();gates[1]();await tick(0);assert.equal(gates.length,6);assert.equal(max,4);
  loader.clear();const result=await outcomes;assert.equal(result.filter(row=>row.status==='fulfilled').length,2);assert.equal(result.filter(row=>row.status==='rejected').length,6);
  await tick(0);assert.equal(loader.stats().entries,0);assert.equal(loader.stats().active,0);assert.equal(loader.stats().queued,0);
});
test('images use the private HTTP cache so a replay does not reach the server',async()=>{
  const seen=[],loader=createQuestionImageLoader({fetchImage:async(_url,init)=>{seen.push(init);return response();},createURL:()=>'blob:cached',revokeURL:()=>{}});
  const request=loader.acquire('play','/api/online/media/x');await request.promise;request.release();
  assert.equal(seen[0].cache,'default');assert.equal(seen[0].credentials,'include');loader.clear();
});
test('unused image memory obeys its budget and lifetime, and failed responses can be retried',async()=>{
  let time=0,calls=0,created=0;const revoked=[],loader=createQuestionImageLoader({maxBytes:4,ttlMs:10,now:()=>time,fetchImage:async()=>{calls++;return response();},createURL:()=>`blob:${++created}`,revokeURL:url=>revoked.push(url)});
  for(const name of ['a','b','c']){const request=loader.acquire('play',name);await request.promise;request.release();time++;}
  assert.ok(loader.stats().bytes<=4);assert.equal(revoked.length,2);time+=11;
  const request=loader.acquire('play','c');await request.promise;request.release();assert.equal(calls,4);loader.clear();assert.equal(loader.stats().bytes,0);
  let fail=true;const retry=createQuestionImageLoader({fetchImage:async()=>fail?new Response('failure',{status:503}):response(),createURL:()=> 'blob:retry',revokeURL:()=>{}});
  const bad=retry.acquire('play','one');await assert.rejects(bad.promise,/503/);bad.release();assert.equal(retry.stats().entries,0);fail=false;
  const good=retry.acquire('play','one');assert.equal(await good.promise,'blob:retry');good.release();retry.clear();
});
