import test from 'node:test';
import assert from 'node:assert/strict';
import { GAME_REGISTRY, getGame } from '../src/core/registry.ts';
import { validatePack } from '../src/core/validation.ts';
import { gamePresentation } from '../src/core/game-presentation.ts';
import { scoreGameResponse } from '../src/core/game-rewards.ts';
import { questionRewardRule, questionRewardThresholds } from '../src/core/question-rewards.ts';
import { onlineGameCompatibility } from '../src/core/game-compatibility.ts';

const meta = () => ({
  knowledgeId: 'MATH.COMPARE',
  difficulty: 'medium',
  contentRole: 'practice',
  source: 'Tự biên soạn',
  rights: 'Tự do sử dụng',
  reviewStatus: 'reviewed',
});

test('Tuần 5: GAME_REGISTRY contains balance-scale and basket-sort with valid manifests', () => {
  const balance = getGame('balance-scale');
  assert.ok(balance, 'balance-scale must be registered in GAME_REGISTRY');
  assert.equal(balance.id, 'balance-scale');
  assert.equal(balance.icon, '⚖️');
  assert.equal(balance.contentKind, 'compare');
  assert.equal(balance.label, 'Cân Thăng Bằng');

  const basket = getGame('basket-sort');
  assert.ok(basket, 'basket-sort must be registered in GAME_REGISTRY');
  assert.equal(basket.id, 'basket-sort');
  assert.equal(basket.icon, '🧺');
  assert.equal(basket.contentKind, 'categorize');
  assert.equal(basket.label, 'Phân Loại Vào Giỏ');

  // Verify all 5 featured games are registered in GAME_REGISTRY
  const expectedModules = ['math-quest', 'word-connect', 'sentence-builder', 'balance-scale', 'basket-sort'];
  for (const id of expectedModules) {
    const game = getGame(id);
    assert.ok(game, `Module ${id} must be registered in GAME_REGISTRY`);
    assert.ok(game.label.length > 0);
  }
});

test('Tuần 5: Content Pack Validation for compare and categorize packs', () => {
  // 1. Valid compare pack
  const validCompare = {
    id: 'pack-compare-1',
    version: 1,
    title: 'So sánh số học lớp 3',
    kind: 'compare',
    subject: 'math',
    grade: 3,
    source: 'local',
    publishedAt: '2026-11-05T00:00:00.000Z',
    items: [
      {
        id: 'c1',
        kind: 'compare',
        objectiveId: 'MATH.COMPARE',
        prompt: 'So sánh hai biểu thức',
        left: '25 + 15',
        right: '50 - 10',
        operator: '=',
        explanation: '40 = 40',
        metadata: meta(),
      },
      {
        id: 'c2',
        kind: 'compare',
        objectiveId: 'MATH.COMPARE',
        left: '7 × 8',
        right: '60',
        operator: '<',
        explanation: '56 < 60',
        metadata: meta(),
      },
    ],
  };
  assert.deepEqual(validatePack(validCompare), []);

  // 2. Invalid compare pack: bad operator, missing left/right
  const invalidCompare = {
    ...validCompare,
    items: [
      {
        id: 'bad-1',
        kind: 'compare',
        objectiveId: 'MATH.COMPARE',
        left: '',
        right: '10',
        operator: '!=',
        explanation: 'Sai cú pháp',
        metadata: meta(),
      },
      {
        id: 'bad-2',
        kind: 'compare',
        objectiveId: 'MATH.COMPARE',
        left: '20',
        right: '',
        operator: '>',
        explanation: '',
        metadata: meta(),
      },
    ],
  };
  const compareErrors = validatePack(invalidCompare);
  assert.ok(compareErrors.length >= 2, 'Must report errors for invalid compare items');
  assert.ok(compareErrors.some(e => e.includes('hai vế so sánh') || e.includes('dấu so sánh')));

  // 3. Valid categorize pack
  const validCategorize = {
    id: 'pack-cat-1',
    version: 1,
    title: 'Phân loại từ ngữ',
    kind: 'categorize',
    subject: 'vietnamese',
    grade: 3,
    source: 'local',
    publishedAt: '2026-11-05T00:00:00.000Z',
    items: [
      {
        id: 'cat-1',
        kind: 'categorize',
        objectiveId: 'VIET.WORD_TYPES',
        prompt: 'Phân loại Từ chỉ sự vật và Từ chỉ hoạt động',
        categories: ['Từ chỉ sự vật', 'Từ chỉ hoạt động'],
        elements: [
          { id: 'el-1', text: 'Bàn ghế', category: 'Từ chỉ sự vật' },
          { id: 'el-2', text: 'Chạy nhảy', category: 'Từ chỉ hoạt động' },
          { id: 'el-3', text: 'Thầy cô', category: 'Từ chỉ sự vật' },
          { id: 'el-4', text: 'Hát ca', category: 'Từ chỉ hoạt động' },
        ],
        explanation: 'Bàn ghế, Thầy cô là sự vật; Chạy nhảy, Hát ca là hoạt động.',
        metadata: meta(),
      },
      {
        id: 'cat-2',
        kind: 'categorize',
        objectiveId: 'VIET.WORD_TYPES',
        prompt: 'Phân loại Động vật và Thực vật',
        categories: ['Động vật', 'Thực vật'],
        elements: [
          { id: 'el-5', text: 'Hổ', category: 'Động vật' },
          { id: 'el-6', text: 'Cây thông', category: 'Thực vật' },
        ],
        explanation: 'Hổ là động vật, cây thông là thực vật.',
        metadata: meta(),
      },
    ],
  };
  assert.deepEqual(validatePack(validCategorize), []);

  // 4. Invalid categorize pack: less than 2 categories or element assigned to non-existent category
  const invalidCategorize = {
    ...validCategorize,
    items: [
      {
        id: 'bad-cat-1',
        kind: 'categorize',
        objectiveId: 'VIET.WORD_TYPES',
        prompt: 'Thiếu nhóm',
        categories: ['Một nhóm duy nhất'],
        elements: [{ id: 'el-1', text: 'Thẻ 1', category: 'Một nhóm duy nhất' }],
        explanation: 'Sai',
        metadata: meta(),
      },
      {
        id: 'bad-cat-2',
        kind: 'categorize',
        objectiveId: 'VIET.WORD_TYPES',
        prompt: 'Nhóm ma',
        categories: ['Nhóm A', 'Nhóm B'],
        elements: [{ id: 'el-2', text: 'Thẻ 2', category: 'Nhóm C không tồn tại' }],
        explanation: 'Sai',
        metadata: meta(),
      },
    ],
  };
  const catErrors = validatePack(invalidCategorize);
  assert.ok(catErrors.length >= 2, 'Must report errors for invalid categorize pack');
  assert.ok(catErrors.some(e => e.includes('2–6 nhóm') || e.includes('thuộc đúng các nhóm')));
});

test('Tuần 5: Bidirectional presentation bridges between new kinds and classic games', () => {
  // A: compare pack presented in math-quest -> transforms into multiple choice options (>, <, =)
  const comparePack = {
    id: 'pack-compare-bridge',
    version: 1,
    title: 'So sánh số',
    kind: 'compare',
    subject: 'math',
    grade: 3,
    source: 'local',
    publishedAt: '2026-11-05T00:00:00.000Z',
    items: [
      {
        id: 'cp-1',
        kind: 'compare',
        objectiveId: 'MATH.COMPARE',
        prompt: 'So sánh 45 + 10 và 60',
        left: '45 + 10',
        right: '60',
        operator: '<',
        explanation: '55 < 60',
        metadata: meta(),
      },
    ],
  };
  const mathQuestPresentation = gamePresentation('math-quest', comparePack);
  assert.ok(mathQuestPresentation, 'compare pack must be presentable in math-quest');
  assert.equal(mathQuestPresentation.items.length, 1);
  const mqItem = mathQuestPresentation.items[0];
  assert.equal(mqItem.id, 'cp-1');
  assert.deepEqual(mqItem.options, ['>', '<', '=', 'Không xác định']);
  assert.equal(mqItem.correctIndex, 1); // '<' is index 1

  // B: pairs pack presented in basket-sort -> creates baskets from unique rights, cards from lefts
  const pairPack = {
    id: 'pack-pair-bridge',
    version: 1,
    title: 'Ghép cặp từ trái nghĩa',
    kind: 'pairs',
    subject: 'vietnamese',
    grade: 3,
    source: 'local',
    publishedAt: '2026-11-05T00:00:00.000Z',
    items: [
      { id: 'p1', kind: 'pair', objectiveId: 'VIET.ANT', left: 'To lớn', right: 'Khổng lồ', metadata: meta() },
      { id: 'p2', kind: 'pair', objectiveId: 'VIET.ANT', left: 'Nhỏ bé', right: 'Tí hon', metadata: meta() },
      { id: 'p3', kind: 'pair', objectiveId: 'VIET.ANT', left: 'Vĩ đại', right: 'Khổng lồ', metadata: meta() },
      { id: 'p4', kind: 'pair', objectiveId: 'VIET.ANT', left: 'Tí xíu', right: 'Tí hon', metadata: meta() },
    ],
  };
  const basketPresentation = gamePresentation('basket-sort', pairPack);
  assert.ok(basketPresentation, 'pairs pack must be presentable in basket-sort');
  assert.equal(basketPresentation.items.length, 1);
  const bsItem = basketPresentation.items[0];
  assert.deepEqual(bsItem.categories, ['Khổng lồ', 'Tí hon']);
  assert.equal(bsItem.elements.length, 4);
  assert.equal(bsItem.elements.find((e) => e.text === 'To lớn')?.category, 'Khổng lồ');
  assert.equal(bsItem.elements.find((e) => e.text === 'Nhỏ bé')?.category, 'Tí hon');
});

test('Tuần 5: Scoring and reward calculation for balance-scale and basket-sort', () => {
  // 1. Scoring compare in balance-scale
  const compareItem = {
    id: 'c-score',
    kind: 'compare',
    objectiveId: 'M1',
    left: '12 + 8',
    right: '20',
    operator: '=',
    explanation: '20 = 20',
    metadata: meta(),
  };
  const comparePack = {
    id: 'pack-c',
    version: 1,
    title: 'So sánh',
    kind: 'compare',
    subject: 'math',
    grade: 3,
    source: 'local',
    publishedAt: '2026-11-05T00:00:00.000Z',
    items: [compareItem, { ...compareItem, id: 'c-score-2' }],
  };

  const correctCompare = scoreGameResponse(comparePack, 'balance-scale', 'c-score', { kind: 'compare', operator: '=' });
  assert.equal(correctCompare.correct, true);

  const wrongCompare = scoreGameResponse(comparePack, 'balance-scale', 'c-score', { kind: 'compare', operator: '>' });
  assert.equal(wrongCompare.correct, false);

  // 2. Scoring categorize in basket-sort
  const categorizeItem = {
    id: 'cat-score',
    kind: 'categorize',
    objectiveId: 'V1',
    prompt: 'Phân loại',
    categories: ['Chim', 'Thú'],
    elements: [
      { id: 'e-1', text: 'Đại bàng', category: 'Chim' },
      { id: 'e-2', text: 'Sư tử', category: 'Thú' },
    ],
    explanation: 'Đại bàng là chim, sư tử là thú.',
    metadata: meta(),
  };
  const catPack = {
    id: 'pack-cat',
    version: 1,
    title: 'Phân loại',
    kind: 'categorize',
    subject: 'vietnamese',
    grade: 3,
    source: 'local',
    publishedAt: '2026-11-05T00:00:00.000Z',
    items: [categorizeItem, { ...categorizeItem, id: 'cat-score-2' }],
  };

  const correctCat = scoreGameResponse(catPack, 'basket-sort', 'cat-score', { kind: 'categorize', elementId: 'e-1', category: 'Chim' });
  assert.equal(correctCat.correct, true);

  const wrongCat = scoreGameResponse(catPack, 'basket-sort', 'cat-score', { kind: 'categorize', elementId: 'e-1', category: 'Thú' });
  assert.equal(wrongCat.correct, false);

  // 3. Reward rules & thresholds
  // balance-scale: rule is 'speed', thresholds 30s / 60s
  assert.equal(questionRewardRule('balance-scale'), 'speed');
  const compThresholds = questionRewardThresholds(compareItem);
  assert.equal(compThresholds.threeStarMs, 30000);
  assert.equal(compThresholds.twoStarMs, 60000);

  // basket-sort: rule is 'order-mistakes', thresholds 60s / 120s
  assert.equal(questionRewardRule('basket-sort'), 'order-mistakes');
  const catThresholds = questionRewardThresholds(categorizeItem);
  assert.equal(catThresholds.threeStarMs, 60000);
  assert.equal(catThresholds.twoStarMs, 120000);
});

test('Tuần 5: onlineGameCompatibility correctly detects compatible game modes for new packs', () => {
  const comparePack = {
    id: 'pack-comp-compat',
    version: 1,
    title: 'So sánh số',
    kind: 'compare',
    subject: 'math',
    grade: 3,
    source: 'local',
    publishedAt: '2026-11-05T00:00:00.000Z',
    items: [
      { id: 'c1', kind: 'compare', objectiveId: 'M', left: '10', right: '20', operator: '<', explanation: '10 < 20', metadata: meta() },
      { id: 'c2', kind: 'compare', objectiveId: 'M', left: '30', right: '25', operator: '>', explanation: '30 > 25', metadata: meta() },
    ],
  };

  const compCompat = onlineGameCompatibility(comparePack);
  const compAllowed = compCompat.games.filter(g => g.allowed).map(g => g.id);
  assert.ok(compAllowed.includes('balance-scale'), 'balance-scale must be allowed for compare pack');
  assert.ok(compAllowed.includes('math-quest'), 'math-quest must be allowed for compare pack');

  const categorizePack = {
    id: 'pack-cat-compat',
    version: 1,
    title: 'Phân loại',
    kind: 'categorize',
    subject: 'vietnamese',
    grade: 3,
    source: 'local',
    publishedAt: '2026-11-05T00:00:00.000Z',
    items: [
      {
        id: 'cat-1',
        kind: 'categorize',
        objectiveId: 'V',
        prompt: 'Phân loại',
        categories: ['A', 'B'],
        elements: [
          { id: 'e1', text: '1', category: 'A' },
          { id: 'e2', text: '2', category: 'B' },
        ],
        explanation: 'A và B',
        metadata: meta(),
      },
      {
        id: 'cat-2',
        kind: 'categorize',
        objectiveId: 'V',
        prompt: 'Phân loại 2',
        categories: ['X', 'Y'],
        elements: [
          { id: 'e3', text: '3', category: 'X' },
          { id: 'e4', text: '4', category: 'Y' },
        ],
        explanation: 'X và Y',
        metadata: meta(),
      },
    ],
  };

  const catCompat = onlineGameCompatibility(categorizePack);
  const catAllowed = catCompat.games.filter(g => g.allowed).map(g => g.id);
  assert.ok(catAllowed.includes('basket-sort'), 'basket-sort must be allowed for categorize pack');
});
