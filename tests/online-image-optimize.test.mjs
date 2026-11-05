import test from 'node:test';
import assert from 'node:assert/strict';
import {optimizeQuestionImage} from '../src/core/online-media-check.ts';

const bitmap=(width,height)=>({width,height,closed:false,close(){this.closed=true;}});
const file=(name,size)=>Object.assign(new Blob([new Uint8Array(size)]),{name});
test('large photos are shrunk to 1024 px WebP, keeping their aspect ratio',async()=>{
  let asked;const decoded=bitmap(4000,3000);
  const result=await optimizeQuestionImage(file('anh-lon.jpg',3_000_000),{decode:async()=>decoded,encode:async(_b,w,h,type,quality)=>{asked={w,h,type,quality};return new Blob([new Uint8Array(90_000)],{type:'image/webp'});}});
  assert.deepEqual(asked,{w:1024,h:768,type:'image/webp',quality:0.82});assert.equal(result.type,'image/webp');assert.equal(result.size,90_000);assert.equal(decoded.closed,true);
});
test('small images, exported files and audio stay byte for byte',async()=>{
  let encoded=0;const encode=async()=>{encoded++;return new Blob([new Uint8Array(10)],{type:'image/webp'});};
  assert.equal(await optimizeQuestionImage(file('nho.png',120_000),{decode:async()=>bitmap(800,600),encode}),null);
  assert.equal(await optimizeQuestionImage(file('bai-nghe.mp3',900_000),{decode:async()=>bitmap(1,1),encode}),null);
  assert.equal(encoded,0);
});
test('the original is kept when re-encoding would not help or the browser cannot write WebP',async()=>{
  const big=file('so-do.png',400_000),decode=async()=>bitmap(2000,1000);
  assert.equal(await optimizeQuestionImage(big,{decode,encode:async()=>new Blob([new Uint8Array(500_000)],{type:'image/webp'})}),null);
  assert.equal(await optimizeQuestionImage(big,{decode,encode:async()=>new Blob([new Uint8Array(1000)],{type:'image/png'})}),null);
  assert.equal(await optimizeQuestionImage(big,{decode:async()=>{throw new Error('broken');}}),null);
});
