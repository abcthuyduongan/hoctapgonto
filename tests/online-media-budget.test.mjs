import test from 'node:test';
import assert from 'node:assert/strict';
import {assertQuestionMediaSelectionBudget,MAX_IMPORT_MEDIA_BYTES,MAX_IMPORT_MEDIA_FILES} from '../src/core/online-media-check.ts';

test('media selection accepts exact count and byte boundaries without reading any file',()=>{
  let reads=0;
  const files=Array.from({length:MAX_IMPORT_MEDIA_FILES},(_,index)=>({size:index===0?MAX_IMPORT_MEDIA_BYTES:0,arrayBuffer(){reads++;throw Error('Must not read selection contents');}}));
  assert.doesNotThrow(()=>assertQuestionMediaSelectionBudget(files));
  assert.equal(reads,0);
  assert.doesNotThrow(()=>assertQuestionMediaSelectionBudget([]));
});

test('media selection rejects aggregate limits before decoding, including combined additions',()=>{
  assert.throws(()=>assertQuestionMediaSelectionBudget(Array.from({length:101},()=>({size:1}))),/100.*32 MB/);
  const pending=[{size:16*1024*1024}],addition=[{size:16*1024*1024+1}];
  assert.throws(()=>assertQuestionMediaSelectionBudget([...pending,...addition]),/chia nhỏ/);
  assert.equal(pending[0].size,16*1024*1024);
  for(const size of [-1,NaN,Infinity,0.5])assert.throws(()=>assertQuestionMediaSelectionBudget([{size}]),/Kích thước/);
});
