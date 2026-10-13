import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=f=>readFileSync(f,'utf8');
const math=read('src/games/MathQuest.tsx');
const memory=read('src/games/MemoryMatch.tsx');
const sentence=read('src/games/SentenceBuilder.tsx');
const completion=read('src/games/GameCompletion.tsx');
const fx=read('src/games/FeedbackEffects.tsx');
const css=read('src/styles/premium280.css');
const main=read('src/main.tsx');

test('Alpha 2.8: success/retry tones play only after successfully persisted attempts',()=>{
  for(const [name,source] of [['Math',math],['Memory',memory],['Sentence',sentence]]) {
    const awaitPos=source.indexOf('await onAttempt(');
    const tonePos=source.indexOf('playFeedbackTone(');
    assert.ok(awaitPos>=0 && tonePos>awaitPos,`${name}: feedback sound must follow saved attempt`);
  }
});
test('Alpha 2.8: visual reactions do not write learning data',()=>{
  assert.doesNotMatch(fx,/storage|onAttempt|onComplete|fetch\(/);
  assert.match(fx,/aria-hidden="true"/);
  assert.match(fx,/eventKey/);
});
test('Alpha 2.8: every game has a persisted-result visual feedback state',()=>{
  for(const code of [math,memory,sentence]) assert.match(code,/FeedbackEffects/);
  assert.match(math,/result=\{selected===null\?null/);
  assert.match(sentence,/result=\{feedback===/);
  assert.match(memory,/result=\{lastOutcome===null/);
});
test('Alpha 2.8: completion remains an overlay and focuses a real exit action',()=>{
  assert.match(completion,/reward-curtain/);
  assert.match(completion,/focus\(\{preventScroll:true\}\)/);
  assert.match(completion,/premium-reward-stars/);
  assert.match(completion,/playCompletionFanfare/);
  for(const code of [math,memory,sentence]) assert.match(code,/GameCompletion/);
});
test('Alpha 2.8: all game mascots reflect success and retry without image duplication',()=>{
  const mascot=read('src/games/GameMascot.tsx');
  assert.match(mascot,/mood = 'idle'/);
  assert.match(mascot,/onError=\{\(\) => setFailed\(true\)\}/);
  for(const code of [math,memory,sentence]) assert.match(code,/mood=\{/);
});
test('Alpha 2.8: animation is transform/opacity only and cannot intercept buttons',()=>{
  assert.match(css,/\.game-reaction\{[^}]*pointer-events:none/s);
  assert.match(css,/position:absolute/);
  assert.match(css,/translate/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css,/html\[data-motion="off"\]/);
});
test('Alpha 2.8: premium stylesheet is last to preserve animation and responsive overrides',()=>{
  assert.ok(main.indexOf("world277.css")<main.indexOf("premium280.css"));
});
test('Alpha 2.8: celebratory audio is opt-in, not tied to cloud or game state',()=>{
  const audio=read('src/core/experience.ts');
  assert.match(audio,/export function playCompletionFanfare/);
  assert.match(audio,/document\.documentElement\.dataset\.sound !== 'on'/);
});
test('Alpha 2.8: transition is bound to the next question ID',()=>{
  assert.match(math,/quest-scroll" key=\{question\.id\}/);
  assert.match(sentence,/sentence-prompt" key=\{item\.id\}/);
});
