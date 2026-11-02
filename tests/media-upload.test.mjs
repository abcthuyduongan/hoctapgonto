import test from 'node:test';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {parseJsonBody} from '../server/json-body.mjs';
import {cloudBrowserFixture} from './helpers/cloud-browser-fixture.mjs';
import {waveFixture} from './helpers/media-fixture.mjs';

test('compressed JSON preserves exact media data while decoded limits and malformed encodings are enforced',async()=>{
 const value={name:'media.wav',base64:waveFixture(1).toString('base64')},raw=Buffer.from(JSON.stringify(value)),compressed=gzipSync(raw);
 assert.deepEqual(await parseJsonBody(compressed,'gzip',raw.length),value);assert.deepEqual(await parseJsonBody(raw,undefined,raw.length),value);assert.ok(compressed.length<raw.length*.8);
 await assert.rejects(parseJsonBody(compressed,'gzip',raw.length-1),error=>error.status===413);
 await assert.rejects(parseJsonBody(Buffer.from('corrupt'),'gzip',100),error=>error.status===400);
 await assert.rejects(parseJsonBody(raw,'br',raw.length),error=>error.status===415);
 await assert.rejects(parseJsonBody(Buffer.from('[]'),undefined,10),error=>error.status===400);
});

test('a real HTTP cloud adapter accepts compressed image/audio uploads and keeps their exact hashes and deduplication',async t=>{
 const f=await cloudBrowserFixture();t.after(()=>f.close());
 const setup=await fetch(f.origin+'/api/online/setup',{method:'POST',headers:{Origin:f.origin,'Content-Type':'application/json'},body:JSON.stringify({token:f.token,name:'Upload fixture',username:'upload.admin',password:f.password})});
 assert.equal(setup.status,201);const admin=await setup.json(),cookie=setup.headers.get('set-cookie').split(';')[0];
 const image=await readFile('public/icons/bao-an-192.png'),audio=waveFixture(3),files=[{name:'upload.png',mime:'image/png',base64:image.toString('base64')},{name:'upload.wav',mime:'audio/wav',base64:audio.toString('base64')}],raw=Buffer.from(JSON.stringify({files})),compressed=gzipSync(raw);
 const send=body=>fetch(f.origin+'/api/online/media/batch',{method:'POST',headers:{Origin:f.origin,Cookie:cookie,'X-CSRF-Token':admin.csrfToken,'Content-Type':'application/json','Content-Encoding':'gzip'},body});
 const result=await send(compressed);assert.equal(result.status,201);const assets=await result.json();assert.equal(assets.length,2);
 for(const[at,bytes]of[image,audio].entries())assert.equal(assets[at].sha256,createHash('sha256').update(bytes).digest('hex'));
 const replay=await send(compressed);assert.equal(replay.status,201);assert.deepEqual((await replay.json()).map(row=>row.id),assets.map(row=>row.id));assert.equal(f.objects.size,2);
 const corrupt=await send(Buffer.from('bad gzip'));assert.equal(corrupt.status,400);assert.equal(f.objects.size,2);
 t.diagnostic(JSON.stringify({originalRequestBytes:raw.length,compressedRequestBytes:compressed.length,ratio:Number((compressed.length/raw.length).toFixed(3)),mediaHashesUnchanged:true}));
});
