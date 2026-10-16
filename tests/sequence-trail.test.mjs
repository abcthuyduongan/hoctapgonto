import test from 'node:test';
import assert from 'node:assert/strict';
import { GAME_REGISTRY, getGame } from '../src/core/registry.ts';
import { BUILTIN_PACKS } from '../src/core/seed.ts';
import { assertModuleContract, makeLearningEvent, isCorrectSentence } from '../src/core/sdk.ts';
import { compatible } from '../src/core/validation.ts';
import { getSceneForModule, getSceneTheme } from '../src/world3d/scenes/sceneCatalog.ts';

const sentencePack = BUILTIN_PACKS.find(p => p.id === 'logic3-sequence') ?? BUILTIN_PACKS.find(p => p.kind === 'sentences');
const pairsPack = BUILTIN_PACKS.find(p => p.kind === 'pairs');

test('SequenceTrail: manifest tuân thủ Game SDK V1', () => {
  const manifest = getGame('sequence-trail');
  assert.equal(manifest.id, 'sequence-trail');
  assert.equal(manifest.runtime, 'react');
  assert.equal(manifest.contentKind, 'sentences');
  assert.equal(manifest.sdkVersion, 1);
  assert.ok(manifest.label.length > 0);
  assert.ok(manifest.description.length > 0);
});

test('SequenceTrail: tương thích đúng chuẩn với SentencePack và từ chối PairsPack', () => {
  const manifest = getGame('sequence-trail');
  assert.ok(sentencePack, 'Cần có ít nhất 1 SentencePack trong seed data');
  assert.ok(compatible('sequence-trail', sentencePack));
  assert.equal(compatible('sequence-trail', pairsPack), false);

  assert.doesNotThrow(() => assertModuleContract(manifest, sentencePack));
  assert.throws(() => assertModuleContract(manifest, pairsPack), /không tương thích/);
});

test('SequenceTrail: ánh xạ 3D Scene tương ứng Bậc Thang Quy Luật', () => {
  const sceneId = getSceneForModule('sequence-trail');
  assert.equal(sceneId, 'sequence-trail');
  const theme = getSceneTheme(sceneId);
  assert.equal(theme.world, 'Bậc Thang Quy Luật');
});

test('SequenceTrail: xác thực chuỗi thứ tự bậc thang chuẩn xác', () => {
  const words = ['5', '10', '15', '20', '25'];
  assert.equal(isCorrectSentence(words, [0, 1, 2, 3, 4]), true);
  assert.equal(isCorrectSentence(words, [0, 2, 1, 3, 4]), false);
  assert.equal(isCorrectSentence(words, [4, 3, 2, 1, 0]), false);
  assert.equal(isCorrectSentence(words, [0, 1, 2]), false);
});

test('SequenceTrail: tạo sự kiện học tập chuẩn deterministic', () => {
  const session = {
    sessionId: 'session-trail-1',
    packId: sentencePack.id,
    contentVersion: sentencePack.version,
    moduleId: 'sequence-trail',
    moduleVersion: '0.2.7',
    status: 'active',
    startedAt: '2026-10-14T10:00:00Z'
  };
  const item = sentencePack.items[0];
  const attempt = {
    attemptKey: 'trail-1:try:1',
    itemId: item.id,
    objectiveId: item.objectiveId,
    correct: true,
    hintsUsed: 0,
    elapsedMs: 1400
  };

  const event = makeLearningEvent(session, sentencePack, attempt, '2026-10-14T10:00:02Z');
  assert.equal(event.eventId, 'session-trail-1:trail-1:try:1');
  assert.equal(event.moduleId, 'sequence-trail');
  assert.equal(event.correct, true);
  assert.equal(event.elapsedMs, 1400);
});
