import test from 'node:test';
import assert from 'node:assert/strict';
import { GAME_REGISTRY, getGame } from '../src/core/registry.ts';
import { BUILTIN_PACKS } from '../src/core/seed.ts';
import { assertModuleContract, makeLearningEvent, sameAttempt, isCorrectSentence } from '../src/core/sdk.ts';
import { compatible, validatePack } from '../src/core/validation.ts';

const pack = BUILTIN_PACKS.find(p=>p.kind==='sentences');
const session = {sessionId:'test-session',packId:pack.id,contentVersion:pack.version,moduleId:'sentence-builder',moduleVersion:'0.1.0',status:'active',startedAt:'2026-10-12T00:00:00Z'};
const attempt = {attemptKey:'sentence-1:try:1',itemId:pack.items[0].id,objectiveId:pack.items[0].objectiveId,correct:true,hintsUsed:0,elapsedMs:1200};

test('Registry: 5 game đều đúng SDK và đủ runtime / content-kind',()=>{
  assert.equal(GAME_REGISTRY.length,5);
  assert.equal(new Set(GAME_REGISTRY.map(g=>g.id)).size,5);
  for (const manifest of GAME_REGISTRY) {
    assert.equal(manifest.sdkVersion,1);
    const p = BUILTIN_PACKS.find(x=>x.kind===manifest.contentKind);
    assert.ok(p);
    assert.doesNotThrow(()=>assertModuleContract(manifest,p));
    assert.ok(compatible(manifest.id,p));
  }
});
test('SDK: phản hồi có eventId tất định cho cùng một lượt',()=>{
  const a=makeLearningEvent(session,pack,attempt,'2026-10-12T00:00:00Z');
  const b=makeLearningEvent(session,pack,{...attempt,elapsedMs:1250},'2026-10-12T00:00:01Z');
  assert.equal(a.eventId,'test-session:sentence-1:try:1');
  assert.ok(sameAttempt(a,b)); // retry may have a different elapsedMs
  assert.ok(!sameAttempt(a,{...b,correct:false}));
  assert.ok(!sameAttempt(a,{...b,profileId:'another-learner'}));
  assert.ok(sameAttempt(a,{...b,profileId:'default-learner'}));
});
test('SDK: không cho item không thuộc bộ được ghi sự kiện',()=>{
  assert.throws(()=>makeLearningEvent(session,pack,{...attempt,itemId:'fake'},'2026-10-12T00:00:00Z'),/không thuộc/);
});
test('SDK: không ghi sự kiện từ phiên đã kết thúc hoặc bị tráo bộ',()=>{
  assert.throws(()=>makeLearningEvent({...session,status:'completed'},pack,attempt,'x'),/không khớp/);
  assert.throws(()=>makeLearningEvent(session,{...pack,version:2},attempt,'x'),/không khớp/);
});
test('SDK: chặn số liệu, khóa lượt trả lời bị lỗi',()=>{
  for(const bad of [{...attempt,attemptKey:'!'}, {...attempt,hintsUsed:-1},{...attempt,elapsedMs:NaN},{...attempt,correct:'yes'}]){
    assert.throws(()=>makeLearningEvent(session,pack,bad,'x'));
  }
});
test('SDK: chặn game dùng sai loại học liệu hoặc sai protocol',()=>{
  assert.throws(()=>assertModuleContract(getGame('math-quest'),pack),/không tương thích/);
  assert.throws(()=>assertModuleContract({...getGame('sentence-builder'),sdkVersion:2},pack),/Game SDK/);
});
test('Sentence Builder: chấm đúng thứ tự cả khi từ lặp xuất hiện',()=>{
  assert.equal(isCorrectSentence(['I','think','I','can.'],[0,1,2,3]),true);
  assert.equal(isCorrectSentence(['I','think','I','can.'],[2,1,0,3]),true);
  assert.equal(isCorrectSentence(['I','think','I','can.'],[3,1,2,0]),false);
});
test('Sentence Builder: bác bỏ thiếu từ, lặp chỉ số, chỉ số giả',()=>{
  assert.equal(isCorrectSentence(['I','am','fine.'],[0,0,2]),false);
  assert.equal(isCorrectSentence(['I','am','fine.'],[0,2]),false);
  assert.equal(isCorrectSentence(['I','am','fine.'],[0,1,99]),false);
});
test('Sentence Builder: học liệu demo đã được kiểm tra và có ít nhất 2 câu',()=>{
  assert.ok(pack.items.length>=2);
  assert.deepEqual(validatePack(pack),[]);
});
test('Sentence Builder: phát hiện câu trùng, gợi ý thiếu và câu thiếu từ',()=>{
  const bad = structuredClone(pack);
  bad.items[1].words=[...bad.items[0].words];
  bad.items[0].hint='';
  bad.items[2].words=['Hello','world.'];
  const messages=validatePack(bad).join(' ');
  assert.match(messages,/trùng/);
  assert.match(messages,/gợi ý/);
  assert.match(messages,/3–15/);
});
