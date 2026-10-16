import test from 'node:test';
import assert from 'node:assert/strict';
import {createPrivateStorage} from '../server/supabase-storage.mjs';

const endpoint='https://fixture-project.supabase.co',key='fixture-server-secret-not-a-real-key',bucket='bao-an-media';
const bucketPath=`/storage/v1/bucket/${bucket}`,objectPath=`/storage/v1/object/${bucket}`;
const object='workspace-id/media-id',bytes=Buffer.from('private media fixture bytes');
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
function mockStorageFetch(t,respond){
  const calls=[];
  t.mock.method(globalThis,'fetch',async(input,init={})=>{
    const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
    assert.equal(url.origin,endpoint,'Storage must use only the mocked Supabase endpoint');
    const call={url,method:init.method??'GET',headers:new Headers(init.headers),body:init.body,signal:init.signal};calls.push(call);
    return respond(call,calls);
  });
  return calls;
}
const storage=()=>createPrivateStorage({url:endpoint,key,bucket});
const sanitized=promise=>assert.rejects(promise,error=>error.status===502&&!error.message.includes('PRIVATE_BACKEND_DEBUG')&&!error.message.includes(key));

test('Supabase public bucket blocks upload and download before any object request',async t=>{
  const calls=mockStorageFetch(t,call=>{
    assert.equal(call.url.pathname,bucketPath);assert.equal(call.method,'GET');
    return json({id:bucket,name:bucket,public:true});
  });
  const files=storage();await sanitized(files.upload(object,bytes,'image/png'));await sanitized(files.download(object));
  assert.equal(calls.length,2);assert.ok(calls.every(call=>call.url.pathname===bucketPath));
});

test('Supabase private bucket is checked once across concurrent uploads and returns exact download bytes',async t=>{
  const calls=mockStorageFetch(t,call=>{
    assert.ok(call.signal instanceof AbortSignal);
    assert.equal(call.headers.get('apikey'),key);assert.equal(call.headers.get('authorization'),`Bearer ${key}`);
    if(call.url.pathname===bucketPath)return json({id:bucket,name:bucket,public:false});
    if(call.method==='POST'){
      assert.equal(call.url.pathname,`${objectPath}/${object}`);
      assert.equal(call.headers.get('content-type'),'image/png');assert.equal(call.headers.get('cache-control'),'max-age=0');assert.equal(call.headers.get('x-upsert'),'false');
      assert.deepEqual(Buffer.from(call.body),bytes);return json({Id:'media-id',Key:`${bucket}/${object}`});
    }
    if(call.method==='GET'){assert.equal(call.url.pathname,`${objectPath}/${object}`);return new Response(bytes,{headers:{'Content-Type':'image/png'}});}
    assert.equal(call.method,'DELETE');assert.equal(call.url.pathname,objectPath);assert.deepEqual(JSON.parse(call.body),{prefixes:[object]});return json([{name:object}]);
  });
  const files=storage();await Promise.all([files.upload(object,bytes,'image/png'),files.upload(object,bytes,'image/png')]);
  const downloaded=await files.download(object);assert.ok(Buffer.isBuffer(downloaded));assert.deepEqual(downloaded,bytes);
  await files.remove(object);
  assert.equal(calls.filter(call=>call.url.pathname===bucketPath).length,1);
  assert.equal(calls.filter(call=>call.method==='POST').length,2);
});

test('Supabase upload, download and removal API errors are sanitized',async t=>{
  mockStorageFetch(t,call=>call.url.pathname===bucketPath?json({id:bucket,name:bucket,public:false}):json({statusCode:'403',error:'Forbidden',message:`PRIVATE_BACKEND_DEBUG ${key}`},403));
  const files=storage();await sanitized(files.upload(object,bytes,'image/png'));await sanitized(files.download(object));await sanitized(files.remove(object));
});

test('Supabase oversized downloaded objects are rejected at the two MB boundary',async t=>{
  let length=2*1024*1024;
  mockStorageFetch(t,call=>call.url.pathname===bucketPath?json({id:bucket,name:bucket,public:false}):new Response(Buffer.alloc(length),{headers:{'Content-Type':'audio/wav'}}));
  const files=storage();assert.equal((await files.download(object)).length,length);
  length++;await sanitized(files.download(object));
});

test('Supabase failed private-bucket verification can retry without uploading before verification succeeds',async t=>{
  let checks=0,uploads=0;
  mockStorageFetch(t,call=>{
    if(call.url.pathname===bucketPath){checks++;return checks===1?json({statusCode:'503',error:'Unavailable',message:'PRIVATE_BACKEND_DEBUG'},503):json({id:bucket,name:bucket,public:false});}
    assert.equal(call.method,'POST');uploads++;return json({Id:'media-id',Key:`${bucket}/${object}`});
  });
  const files=storage();await sanitized(files.upload(object,bytes,'image/png'));assert.equal(uploads,0);
  await files.upload(object,bytes,'image/png');assert.equal(checks,2);assert.equal(uploads,1);
  await files.upload(object,bytes,'image/png');assert.equal(checks,2);assert.equal(uploads,2);
});
