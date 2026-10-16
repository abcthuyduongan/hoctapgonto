import test from 'node:test';
import assert from 'node:assert/strict';
import { GAME_REGISTRY, getGame } from '../src/core/registry.ts';
import { BUILTIN_PACKS } from '../src/core/seed.ts';
import { assertModuleContract, makeLearningEvent } from '../src/core/sdk.ts';
import { compatible } from '../src/core/validation.ts';
import { getSceneForModule, getSceneTheme } from '../src/world3d/scenes/sceneCatalog.ts';

const pairsPack = BUILTIN_PACKS.find(p => p.kind === 'pairs');
const quizPack = BUILTIN_PACKS.find(p => p.kind === 'quiz');

test('WordConnect: manifest tuân thủ Game SDK V1', () => {
  const manifest = getGame('word-connect');
  assert.equal(manifest.id, 'word-connect');
  assert.equal(manifest.runtime, 'react');
  assert.equal(manifest.contentKind, 'pairs');
  assert.equal(manifest.sdkVersion, 1);
  assert.ok(manifest.label.length > 0);
  assert.ok(manifest.description.length > 0);
});

test('WordConnect: tương thích đúng chuẩn với PairsPack và từ chối QuizPack', () => {
  const manifest = getGame('word-connect');
  assert.ok(pairsPack, 'Cần có ít nhất 1 PairsPack trong seed data');
  assert.ok(compatible('word-connect', pairsPack));
  assert.equal(compatible('word-connect', quizPack), false);

  assert.doesNotThrow(() => assertModuleContract(manifest, pairsPack));
  assert.throws(() => assertModuleContract(manifest, quizPack), /không tương thích/);
});

test('WordConnect: ánh xạ 3D Scene tương ứng Đảo Nối Từ', () => {
  const sceneId = getSceneForModule('word-connect');
  assert.equal(sceneId, 'word-connect');
  const theme = getSceneTheme(sceneId);
  assert.equal(theme.world, 'Đảo Nối Từ');
});

test('WordConnect: tạo sự kiện học tập chuẩn deterministic', () => {
  const session = {
    sessionId: 'session-connect-1',
    packId: pairsPack.id,
    contentVersion: pairsPack.version,
    moduleId: 'word-connect',
    moduleVersion: '0.2.7',
    status: 'active',
    startedAt: '2026-10-14T10:00:00Z'
  };
  const item = pairsPack.items[0];
  const attempt = {
    attemptKey: 'connect-1',
    itemId: item.id,
    objectiveId: item.objectiveId,
    correct: true,
    hintsUsed: 0,
    elapsedMs: 850
  };

  const event = makeLearningEvent(session, pairsPack, attempt, '2026-10-14T10:00:01Z');
  assert.equal(event.eventId, 'session-connect-1:connect-1');
  assert.equal(event.moduleId, 'word-connect');
  assert.equal(event.correct, true);
  assert.equal(event.elapsedMs, 850);
});
