import test from 'node:test';
import assert from 'node:assert/strict';
import {OnlineRequestTimeoutError,withOnlineDeadline} from '../src/core/online-request.ts';
import {build} from 'esbuild';
import {gunzipSync} from 'node:zlib';
import {randomBytes} from 'node:crypto';

const bundle=await build({entryPoints:['src/core/online-client.ts'],bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'});
const {onlineApi,OnlineError,subscribeOnlineSessionExpired}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].contents).toString('base64'));

test('API deadline releases a hung connection and aborts its transport',async()=>{
  let signal;
  await assert.rejects(withOnlineDeadline(async current=>{signal=current;return new Promise(()=>{});},20),OnlineRequestTimeoutError);
  assert.equal(signal.aborted,true);
});
test('API deadline includes a stalled response body after headers have arrived',async()=>{
  let headers=false,signal;
  await assert.rejects(withOnlineDeadline(async current=>{signal=current;headers=true;const body=new Promise(()=>{});return await body;},20),/phản hồi quá lâu/);
  assert.equal(headers,true);assert.equal(signal.aborted,true);
});
test('API deadline preserves successful data and original errors without replaying a mutation',async()=>{
  let calls=0,signal;
  assert.deepEqual(await withOnlineDeadline(async current=>{calls++;signal=current;return {saved:true};},100),{saved:true});
  assert.equal(calls,1);assert.equal(signal.aborted,false);
  const failure=new Error('CSRF validation rejected');
  await assert.rejects(withOnlineDeadline(async()=>{throw failure;},100),error=>error===failure);
});
test('student API releases its waiting state when the network never returns headers',async t=>{
  let signal,calls=0;
  t.mock.timers.enable({apis:['setTimeout']});
  t.mock.method(globalThis,'fetch',async(_path,options)=>{signal=options.signal;calls++;return new Promise(()=>{});});
  const rejected=assert.rejects(onlineApi.student(),error=>error instanceof OnlineError&&error.status===0&&/phản hồi quá lâu/.test(error.message));
  t.mock.timers.tick(30_000);await rejected;assert.equal(signal.aborted,true);assert.equal(calls,1);
});
test('answer API deadline includes stalled JSON and never resends the answer automatically',async t=>{
  let signal,calls=0;
  t.mock.timers.enable({apis:['setTimeout']});
  t.mock.method(globalThis,'fetch',async(_path,options)=>{signal=options.signal;calls++;return {ok:true,status:200,json:()=>new Promise(()=>{})};});
  const rejected=assert.rejects(onlineApi.attempt('play-one',{attemptKey:'question-one',itemId:'question-one',response:{kind:'choice',choiceIndex:0},hintsUsed:0,elapsedMs:100}),/phản hồi quá lâu/);
  await Promise.resolve();t.mock.timers.tick(30_000);await rejected;assert.equal(signal.aborted,true);assert.equal(calls,1);
});
test('bounded API preserves server validation errors and expires sessions on 401',async t=>{
  let expired=0;const unsubscribe=subscribeOnlineSessionExpired(()=>expired++);t.after(unsubscribe);
  t.mock.method(globalThis,'fetch',async()=>Response.json({error:'Phiên đăng nhập đã hết hạn.'},{status:401}));
  await assert.rejects(onlineApi.student(),error=>error instanceof OnlineError&&error.status===401&&/hết hạn/.test(error.message));assert.equal(expired,1);
  t.mock.method(globalThis,'fetch',async()=>Response.json({error:'Đáp án không hợp lệ.'},{status:400}));
  await assert.rejects(onlineApi.student(),error=>error instanceof OnlineError&&error.status===400&&error.message==='Đáp án không hợp lệ.');assert.equal(expired,1);
});
test('game APIs reject a mixed old Function response and send the supported protocol without replaying requests',async t=>{
 let calls=0,headers;const input={requestId:'protocol-one',moduleId:'math-quest',packId:'source-one',contentVersion:1};
 t.mock.method(globalThis,'fetch',async(_path,options)=>{calls++;headers=options.headers;return Response.json({session:{rewardPolicyVersion:2}});});
 await assert.rejects(onlineApi.playCompact(input),error=>error instanceof OnlineError&&error.status===409&&/cùng phiên bản/.test(error.message));assert.equal(calls,1);assert.equal(headers['X-Bao-An-Question-Protocol'],'1');
 const current={session:{questionProtocolVersion:1}};t.mock.method(globalThis,'fetch',async()=>Response.json(current,{headers:{'X-Bao-An-Question-Protocol':'1'}}));assert.deepEqual(await onlineApi.playCompact(input),current);
});

test('concurrent opens share one request but failed or finished opens can be requested again',async t=>{
 let calls=0,release;const held=new Promise(resolve=>{release=resolve;});
 t.mock.method(globalThis,'fetch',async()=>{calls++;await held;return Response.json({openedAt:'2026-11-02T00:00:00.000Z'},{headers:{'X-Bao-An-Question-Protocol':'1'}});});
 const first=onlineApi.openQuestion('dedup-play','question-1'),second=onlineApi.openQuestion('dedup-play','question-1');assert.equal(first,second);assert.equal(calls,1);release();await Promise.all([first,second]);
 await onlineApi.openQuestion('dedup-play','question-1');assert.equal(calls,2);
 t.mock.method(globalThis,'fetch',async()=>{calls++;return Response.json({error:'Temporarily unavailable'},{status:503});});
 await assert.rejects(onlineApi.openQuestion('dedup-play','question-1'),/Temporarily/);
 t.mock.method(globalThis,'fetch',async()=>{calls++;return Response.json({openedAt:'2026-11-02T00:00:00.000Z'},{headers:{'X-Bao-An-Question-Protocol':'1'}});});
 await onlineApi.openQuestion('dedup-play','question-1');assert.equal(calls,4);
});

test('media uploads negotiate lossless gzip and fall back to plain JSON for older servers',async t=>{
 let supported=true,encoded=0,plain=0;const file={name:'noise.png',mime:'image/png',base64:randomBytes(256*1024).toString('base64')};
 t.mock.method(globalThis,'fetch',async(path,options)=>{
  if(path.endsWith('/status'))return Response.json({available:true,configured:true,mediaMaxBytes:2097152,...(supported?{mediaUploadEncoding:'gzip'}:{})});
  if(options.headers['Content-Encoding']==='gzip'){
   encoded++;assert.ok(options.body instanceof Blob);const bytes=Buffer.from(await options.body.arrayBuffer());assert.ok(bytes.length<Buffer.byteLength(JSON.stringify(file))*.8);assert.deepEqual(JSON.parse(gunzipSync(bytes).toString('utf8')),file);
  }else{plain++;assert.equal(typeof options.body,'string');assert.deepEqual(JSON.parse(options.body),file);}
  return Response.json({id:'stored-image'});
 });
 await onlineApi.status();await onlineApi.uploadMedia(file);assert.equal(encoded,1);supported=false;await onlineApi.status();await onlineApi.uploadMedia(file);assert.equal(plain,1);
});
