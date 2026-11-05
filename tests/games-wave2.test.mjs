import test from 'node:test';
import assert from 'node:assert/strict';
import { GAME_REGISTRY, getGame } from '../src/core/registry.ts';
import { validatePack } from '../src/core/validation.ts';
import { gamePresentation } from '../src/core/game-presentation.ts';
import { onlineGameCompatibility } from '../src/core/game-compatibility.ts';

test('Tuần 9 Cổng C9: GAME_REGISTRY contains >= 8 registered playable games', () => {
  assert.ok(
    GAME_REGISTRY.length >= 8,
    `GAME_REGISTRY must contain at least 8 games, currently has ${GAME_REGISTRY.length}`
  );

  const expectedGames = [
    'math-quest',
    'memory-match',
    'sentence-builder',
    'word-connect',
    'sequence-trail',
    'balance-scale',
    'basket-sort',
    'treasure-flip',
    'fox-kitchen',
    'boat-race',
  ];

  for (const id of expectedGames) {
    const game = getGame(id);
    assert.ok(game, `Game ${id} must be registered`);
    assert.equal(game.id, id);
    assert.ok(game.label.length > 0);
    assert.ok(game.description.length > 0);
    assert.ok(game.icon.length > 0);
  }

  const treasure = getGame('treasure-flip');
  assert.equal(treasure.contentKind, 'pairs');
  assert.equal(treasure.label, 'Lật Thẻ Kho Báu');

  const kitchen = getGame('fox-kitchen');
  assert.equal(kitchen.contentKind, 'sentences');
  assert.equal(kitchen.label, 'Bếp Nhỏ Của Cáo');

  const boat = getGame('boat-race');
  assert.equal(boat.contentKind, 'quiz');
  assert.equal(boat.label, 'Đua Thuyền Rồng');
});

test('Tuần 9 Cổng C9: Presentation conversion and validation for Wave 2 games', () => {
  // 1. Pairs pack can present as treasure-flip
  const pairsPack = {
    id: 'pack-pairs-wave2',
    version: 1,
    title: 'Từ vựng tiếng Anh chủ đề Đại Dương',
    kind: 'pairs',
    subject: 'english',
    grade: 3,
    source: 'local',
    publishedAt: '2026-11-05T00:00:00.000Z',
    items: [
      { id: 'p1', objectiveId: 'ENG.VOCAB', kind: 'pair', left: 'Dolphin', right: 'Cá heo' },
      { id: 'p2', objectiveId: 'ENG.VOCAB', kind: 'pair', left: 'Whale', right: 'Cá voi' },
      { id: 'p3', objectiveId: 'ENG.VOCAB', kind: 'pair', left: 'Turtle', right: 'Rùa biển' },
      { id: 'p4', objectiveId: 'ENG.VOCAB', kind: 'pair', left: 'Octopus', right: 'Bạch tuộc' },
    ],
  };
  assert.deepEqual(validatePack(pairsPack), []);
  const treasurePres = gamePresentation('treasure-flip', pairsPack);
  assert.ok(treasurePres);
  assert.equal(treasurePres.kind, 'pairs');

  // 2. Sentences pack can present as fox-kitchen
  const sentencePack = {
    id: 'pack-sentence-wave2',
    version: 1,
    title: 'Công thức nấu súp cà rốt',
    kind: 'sentences',
    subject: 'vietnamese',
    grade: 3,
    source: 'local',
    publishedAt: '2026-11-05T00:00:00.000Z',
    items: [
      {
        id: 's1',
        objectiveId: 'VIE.SENTENCE',
        kind: 'sentence',
        prompt: 'Nấu súp cà rốt thơm ngon',
        hint: 'Bắt đầu bằng từ Đầu bếp',
        words: ['Đầu', 'bếp', 'nấu', 'súp', 'cà', 'rốt'],
      },
      {
        id: 's2',
        objectiveId: 'VIE.SENTENCE',
        kind: 'sentence',
        prompt: 'Rửa sạch rau củ tươi',
        hint: 'Bắt đầu bằng từ Cáo',
        words: ['Cáo', 'rửa', 'sạch', 'cà', 'chua'],
      },
    ],
  };
  assert.deepEqual(validatePack(sentencePack), []);
  const kitchenPres = gamePresentation('fox-kitchen', sentencePack);
  assert.ok(kitchenPres);
  assert.equal(kitchenPres.kind, 'sentences');

  // 3. Quiz pack can present as boat-race
  const quizPack = {
    id: 'pack-quiz-wave2',
    version: 1,
    title: 'Phép nhân 7 và 8',
    kind: 'quiz',
    subject: 'math',
    grade: 3,
    source: 'local',
    publishedAt: '2026-11-05T00:00:00.000Z',
    items: [
      {
        id: 'q1',
        objectiveId: 'MATH.MULT',
        kind: 'multiple-choice',
        prompt: '7 × 8 = ?',
        options: ['54', '56', '58', '64'],
        correctIndex: 1,
        explanation: '7 nhân 8 bằng 56.',
      },
      {
        id: 'q2',
        objectiveId: 'MATH.MULT',
        kind: 'multiple-choice',
        prompt: '8 × 9 = ?',
        options: ['72', '64', '81', '70'],
        correctIndex: 0,
        explanation: '8 nhân 9 bằng 72.',
      },
    ],
  };
  assert.deepEqual(validatePack(quizPack), []);
  const boatPres = gamePresentation('boat-race', quizPack);
  assert.ok(boatPres);
  assert.equal(boatPres.kind, 'quiz');
});

test('Tuần 9 Cổng C9: Compatibility matrix covers all 10 registered games without crash', () => {
  const samplePacks = [
    {
      id: 'p-quiz',
      version: 1,
      title: 'Đố vui',
      kind: 'quiz',
      subject: 'math',
      grade: 3,
      source: 'local',
      publishedAt: '2026-11-05T00:00:00.000Z',
      items: [
        {
          id: 'q1',
          objectiveId: 'M1',
          kind: 'multiple-choice',
          prompt: '1 + 1 = ?',
          options: ['1', '2', '3', '4'],
          correctIndex: 1,
        },
      ],
    },
    {
      id: 'p-pairs',
      version: 1,
      title: 'Ghép cặp',
      kind: 'pairs',
      subject: 'english',
      grade: 3,
      source: 'local',
      publishedAt: '2026-11-05T00:00:00.000Z',
      items: [
        { id: 'pr1', objectiveId: 'E1', kind: 'pair', left: 'Sun', right: 'Mặt trời' },
        { id: 'pr2', objectiveId: 'E1', kind: 'pair', left: 'Moon', right: 'Mặt trăng' },
        { id: 'pr3', objectiveId: 'E1', kind: 'pair', left: 'Star', right: 'Ngôi sao' },
        { id: 'pr4', objectiveId: 'E1', kind: 'pair', left: 'Cloud', right: 'Đám mây' },
      ],
    },
    {
      id: 'p-sentences',
      version: 1,
      title: 'Xếp từ',
      kind: 'sentences',
      subject: 'vietnamese',
      grade: 3,
      source: 'local',
      publishedAt: '2026-11-05T00:00:00.000Z',
      items: [
        { id: 'st1', objectiveId: 'V1', kind: 'sentence', prompt: 'Xếp câu', words: ['Bảo', 'An', 'học', 'giỏi'] },
      ],
    },
  ];

  for (const pack of samplePacks) {
    const matrix = onlineGameCompatibility(pack);
    assert.ok(matrix.games.length >= 10);
    // Every game returned has a defined label
    for (const g of matrix.games) {
      assert.ok(g.label, `Game ${g.id} must have a label`);
    }
  }
});
