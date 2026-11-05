import test from 'node:test';
import assert from 'node:assert/strict';
import {createAudioDurationReader,audioDurationMs} from '../server/audio-duration.mjs';
import {waveFixture} from './helpers/media-fixture.mjs';
test('verified audio duration coalesces identical bytes and MIME while preserving per-call size checks',async()=>{
 let calls=0;const read=createAudioDurationReader({parse:async()=>{calls++;return{format:{duration:1.1251}};}}),bytes=Buffer.alloc(20);
 assert.deepEqual(await Promise.all([read(bytes,'audio/wav'),read(Buffer.from(bytes),'audio/wav')]),[1126,1126]);assert.equal(calls,1);
 await assert.rejects(read(bytes,'audio/wav',12),error=>error.status===422);assert.equal(calls,1);
 await read(bytes,'audio/ogg');assert.equal(calls,2);bytes[0]=1;await read(bytes,'audio/wav');assert.equal(calls,3);
});
test('duration cache expires, is bounded and never remembers invalid audio',async()=>{
 let time=0,calls=0,bad=false;const read=createAudioDurationReader({maxEntries:1,ttlMs:10,now:()=>time,parse:async()=>{calls++;if(bad)throw Error('invalid');return{format:{duration:1}};}}),a=Buffer.alloc(20),b=Buffer.alloc(21);
 await read(a,'audio/wav');await read(b,'audio/wav');await read(a,'audio/wav');assert.equal(calls,3);time=11;await read(a,'audio/wav');assert.equal(calls,4);
 bad=true;await assert.rejects(read(b,'audio/wav'),error=>error.status===422);await assert.rejects(read(b,'audio/wav'),error=>error.status===422);assert.equal(calls,6);
});
test('actual WAV parsing still derives the server duration and rejects corrupt bytes',async()=>{
 assert.ok(await audioDurationMs(waveFixture(),'audio/wav')>0);
 await assert.rejects(audioDurationMs(Buffer.alloc(20),'audio/wav'),error=>error.status===422);
});
