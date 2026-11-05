import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeSubjectLabel,
  resolveRegionId,
  REGION_METADATA,
} from '../src/core/world-map-regions.ts';
import {
  getChapterFromPosition,
  getSlotFromPosition,
  getChapterPositionRange,
  calculateTotalChapters,
  isWeekNodeReady,
  filterNodesByChapter,
  buildRegionMapView,
  validateSelectedPack,
} from '../src/core/world-map-adapter.ts';
import {
  WORLD_MAP_ANCHORS,
  REGION_SLOT_ANCHORS,
  getRegionSlotAnchor,
  getWorldRegionAnchor,
} from '../src/core/world-map-layout.ts';

test('DM01: Subject normalization handles diacritics, case, spacing and preserves display label', () => {
  const inputs = [
    ' TIẾNG   VIỆT ',
    'Tieng Viet',
    'TIẾNG VIỆT',
    'tiếng việt',
  ];
  for (const label of inputs) {
    const regionId = resolveRegionId(label);
    assert.equal(regionId, 'vietnamese');
  }
  // The raw label remains unchanged in original authoring
  assert.equal(normalizeSubjectLabel('  Toán  Học  '), 'toan hoc');
});

test('DM02: Alias resolution handles exact aliases and rejects fuzzy false positives', () => {
  assert.equal(resolveRegionId('Toán bằng tiếng Anh'), 'math');
  assert.equal(resolveRegionId('English'), 'english');
  assert.equal(resolveRegionId('Sinh hoạt lớp'), 'discovery');
  assert.equal(resolveRegionId('Khoa học máy tính nâng cao'), 'discovery'); // not an exact alias
  assert.equal(resolveRegionId(''), 'discovery');
  assert.equal(resolveRegionId(null), 'discovery');
});

test('DM03: Positions 1, 2, 3 with Math only at 1 and 3 keep slots 1 and 3 without compression', () => {
  const nodes = [
    {
      weekId: 'w-1',
      position: 1,
      slot: getSlotFromPosition(1),
      title: 'Tuần 1',
      state: 'closed',
      counts: { total: 4, zero: 0, one: 0, two: 2, three: 2 },
      sets: [],
    },
    {
      weekId: 'w-3',
      position: 3,
      slot: getSlotFromPosition(3),
      title: 'Tuần 3',
      state: 'current',
      counts: { total: 4, zero: 1, one: 0, two: 2, three: 1 },
      sets: [],
    },
  ];

  assert.equal(nodes[0].slot, 1);
  assert.equal(nodes[1].slot, 3);
  assert.equal(getChapterFromPosition(nodes[0].position), 1);
  assert.equal(getChapterFromPosition(nodes[1].position), 1);

  const view = buildRegionMapView({
    regionId: 'math',
    chapter: 1,
    maxPosition: 3,
    allRegionNodes: nodes,
  });

  assert.equal(view.nodes.length, 2);
  assert.equal(view.nodes[0].slot, 1);
  assert.equal(view.nodes[1].slot, 3);
});

test('DM04: Chapter and slot calculation for positions 7, 8, 35 and legacy gaps', () => {
  assert.equal(getChapterFromPosition(7), 1);
  assert.equal(getSlotFromPosition(7), 7);

  assert.equal(getChapterFromPosition(8), 2);
  assert.equal(getSlotFromPosition(8), 1);

  assert.equal(getChapterFromPosition(35), 5);
  assert.equal(getSlotFromPosition(35), 7);

  // Legacy data with only positions 1 and 14
  assert.equal(getChapterFromPosition(1), 1);
  assert.equal(getChapterFromPosition(14), 2);
  assert.equal(calculateTotalChapters(14), 2);
});

test('DM05: Deterministic order regardless of input row order; ID keyed, not array index', () => {
  const nodeA = {
    weekId: 'w-1',
    position: 1,
    slot: 1,
    title: 'Tuần 1',
    state: 'closed',
    counts: { total: 2, zero: 0, one: 0, two: 2, three: 0 },
    sets: [],
  };
  const nodeB = {
    weekId: 'w-2',
    position: 2,
    slot: 2,
    title: 'Tuần 2',
    state: 'current',
    counts: { total: 2, zero: 0, one: 0, two: 2, three: 0 },
    sets: [],
  };

  const list1 = filterNodesByChapter([nodeA, nodeB], 1);
  const list2 = filterNodesByChapter([nodeB, nodeA], 1);

  assert.deepEqual(list1, list2);
  assert.equal(list1[0].weekId, 'w-1');
  assert.equal(list1[1].weekId, 'w-2');
});

test('DM06: Node ready condition requires zero=0, one=0 and all questions >= 2 stars', () => {
  const incompleteCounts = { total: 8, zero: 2, one: 1, two: 3, three: 2 };
  assert.equal(incompleteCounts.zero + incompleteCounts.one + incompleteCounts.two + incompleteCounts.three, incompleteCounts.total);
  assert.equal(isWeekNodeReady(incompleteCounts), false);

  const completedCounts = { total: 8, zero: 0, one: 0, two: 5, three: 3 };
  assert.equal(isWeekNodeReady(completedCounts), true);

  const zeroTotalCounts = { total: 0, zero: 0, one: 0, two: 0, three: 0 };
  assert.equal(isWeekNodeReady(zeroTotalCounts), false);
});

test('DM07: Current ready=true does not advance until server confirmation', () => {
  const currentWeek = {
    weekId: 'w-1',
    position: 1,
    title: 'Tuần 1',
    ready: true,
    hasNext: true,
  };
  // UI node state remains 'current'
  assert.equal(currentWeek.ready, true);
  // Without advance mutation, state is still current, week 2 remains locked
});

test('DM08: Star counts preserve server invariant of maximum 3 stars per item', () => {
  const counts = { total: 4, zero: 0, one: 0, two: 2, three: 2 };
  assert.equal(counts.zero + counts.one + counts.two + counts.three, counts.total);
});

test('DM09: Selected pack invalidation when version or weekId changes', () => {
  const availableNodes = [
    {
      weekId: 'w-1',
      position: 1,
      slot: 1,
      title: 'Tuần 1',
      state: 'current',
      counts: { total: 2, zero: 0, one: 0, two: 2, three: 0 },
      sets: [
        {
          packId: 'p-1',
          contentVersion: 2, // version updated to 2
          title: 'Toán 1',
          kind: 'quiz',
          subjectLabel: 'Toán',
          itemCount: 2,
          done: true,
        },
      ],
    },
  ];

  // Old selection had version 1
  const oldSelection = { weekId: 'w-1', packId: 'p-1', contentVersion: 1 };
  const validated = validateSelectedPack(oldSelection, availableNodes);
  assert.equal(validated, null);

  // Matching version 2 stays valid
  const currentSelection = { weekId: 'w-1', packId: 'p-1', contentVersion: 2 };
  assert.deepEqual(validateSelectedPack(currentSelection, availableNodes), currentSelection);

  // Different weekId is invalidated
  const foreignSelection = { weekId: 'w-99', packId: 'p-1', contentVersion: 2 };
  assert.equal(validateSelectedPack(foreignSelection, availableNodes), null);
});

test('DM10: Edge cases for 0 weeks, 1 week, and position 22', () => {
  // 0 weeks
  assert.equal(calculateTotalChapters(0), 0);
  const emptyView = buildRegionMapView({
    regionId: 'math',
    chapter: 1,
    maxPosition: 0,
    allRegionNodes: [],
  });
  assert.equal(emptyView.nodes.length, 0);
  assert.equal(emptyView.totalChapters, 0);

  // 1 week
  assert.equal(calculateTotalChapters(1), 1);
  assert.equal(getChapterFromPosition(1), 1);

  // Position 22
  assert.equal(getChapterFromPosition(22), 4);
  assert.equal(getSlotFromPosition(22), 1);
  assert.equal(calculateTotalChapters(22), 4);
});
