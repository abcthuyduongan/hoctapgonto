import test from 'node:test';
import assert from 'node:assert/strict';
import {createPairRounds} from '../src/games/pair-rounds.ts';
import {activateQuestionAudio,forgetQuestionAudio,releaseQuestionAudio,stopQuestionAudio} from '../src/core/question-audio.ts';

test('pair rounds cover every immutable source item once within the screen limit',()=>{
  for(const count of [2,3,4,6,7,10,13,30])for(const limit of [4,6]){
    const items=Array.from({length:count},(_,i)=>Object.freeze({id:`pair-${i}`,left:`left-${i}`,right:`right-${i}`}));
    Object.freeze(items);
    const rounds=createPairRounds(items,limit);
    assert.deepEqual(rounds.flat(),items);
    assert.ok(rounds.every(round=>round.length>=2&&round.length<=limit));
    assert.ok(Math.max(...rounds.map(round=>round.length))-Math.min(...rounds.map(round=>round.length))<=1);
    rounds.flat().forEach((item,index)=>assert.equal(item,items[index]));
  }
  assert.deepEqual(createPairRounds([1,2,3,4,5,6,7],6).map(round=>round.length),[4,3]);
  assert.deepEqual(createPairRounds(Array.from({length:13},(_,i)=>i),6).map(round=>round.length),[5,4,4]);
  assert.deepEqual(createPairRounds(Array.from({length:30},(_,i)=>i),6).map(round=>round.length),[6,6,6,6,6]);
  assert.deepEqual(createPairRounds([],6),[]);
  assert.throws(()=>createPairRounds([1,2],1),RangeError);
});

test('question audio switches player ownership and releases detached audio resources',()=>{
  const fake=()=>({pauses:0,loads:0,src:'authenticated-media',pause(){this.pauses++;},removeAttribute(name){assert.equal(name,'src');this.src=null;},load(){this.loads++;}});
  const first=fake(),second=fake();
  activateQuestionAudio(first);activateQuestionAudio(second);
  assert.equal(first.pauses,1);assert.equal(second.pauses,0);
  // A delayed pause from the old player must not forget the new one.
  forgetQuestionAudio(first);stopQuestionAudio();assert.equal(second.pauses,1);
  activateQuestionAudio(first);releaseQuestionAudio(first);
  assert.equal(first.src,null);assert.equal(first.loads,1);
  const pauses=first.pauses;stopQuestionAudio();assert.equal(first.pauses,pauses);
});
