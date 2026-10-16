import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateQuality,
  computeNextReview,
  processAttemptForReview,
  isDueForReview,
  getDueReviewCards,
  DEFAULT_EASE_FACTOR,
  MIN_EASE_FACTOR
} from '../src/core/spacedRepetition.ts';
import { buildReviewUpdate, reviewCardKey } from '../src/core/spacedRepetition.ts';

test('calculateQuality: knowledge quality is independent of response speed', () => {
  assert.equal(calculateQuality(true, 0, 4500), 4);
  assert.equal(calculateQuality(true, 0, 9200), 4);
  // Correct answer with hints
  assert.equal(calculateQuality(true, 1, 3000), 3);
  assert.equal(calculateQuality(true, 2, 12000), 3);
  // Incorrect answer without hints (guess)
  assert.equal(calculateQuality(false, 0, 5000), 2);
  // Incorrect answer even with hints
  assert.equal(calculateQuality(false, 1, 5000), 1);
});

test('computeNextReview: SM-2 progression on repeated correct recalls', () => {
  const base = new Date('2026-10-14T00:00:00Z');

  // Review 1: First recall with quality 4 (ease stays 2.5)
  const r1 = computeNextReview({ repetitions: 0, intervalDays: 0, easeFactor: 2.5 }, 4, base);
  assert.equal(r1.repetitions, 1);
  assert.equal(r1.intervalDays, 1);
  assert.equal(r1.easeFactor, 2.5);
  assert.equal(r1.nextReviewDate, '2026-10-15');

  // Review 2: Second recall with quality 4 -> interval = 6 days
  const r2 = computeNextReview({ repetitions: r1.repetitions, intervalDays: r1.intervalDays, easeFactor: r1.easeFactor }, 4, new Date('2026-10-15T00:00:00Z'));
  assert.equal(r2.repetitions, 2);
  assert.equal(r2.intervalDays, 6);
  assert.equal(r2.easeFactor, 2.5);
  assert.equal(r2.nextReviewDate, '2026-10-21');

  // Review 3: Third recall with quality 5 -> interval = 6 * 2.6 = 15.6 -> 16 days
  const r3 = computeNextReview({ repetitions: r2.repetitions, intervalDays: r2.intervalDays, easeFactor: r2.easeFactor }, 5, new Date('2026-10-21T00:00:00Z'));
  assert.equal(r3.repetitions, 3);
  assert.equal(r3.intervalDays, 16);
  assert.equal(r3.easeFactor, 2.6);
});

test('computeNextReview: resets streak and interval to 1 day on recall failure', () => {
  const base = new Date('2026-10-14T00:00:00Z');
  // High streak card fails
  const failed = computeNextReview({ repetitions: 5, intervalDays: 30, easeFactor: 2.4 }, 2, base);
  assert.equal(failed.repetitions, 0);
  assert.equal(failed.intervalDays, 1);
  assert.ok(failed.easeFactor < 2.4, 'Ease factor drops on failure');
  assert.equal(failed.nextReviewDate, '2026-10-15');
});

test('computeNextReview: never allows ease factor to drop below minimum 1.3', () => {
  const base = new Date('2026-10-14T00:00:00Z');
  const result = computeNextReview({ repetitions: 0, intervalDays: 1, easeFactor: 1.35 }, 0, base);
  assert.equal(result.easeFactor, MIN_EASE_FACTOR);
});

test('processAttemptForReview: creates brand new card correctly', () => {
  const now = new Date('2026-10-14T10:00:00Z');
  const card = processAttemptForReview(
    undefined,
    'learner-1',
    'math-item-1',
    'math-grade-3',
    true,
    0,
    3000,
    now
  );
  assert.equal(card.cardId, '["learner-1","math-grade-3",1,"math-item-1"]');
  assert.equal(card.profileId, 'learner-1');
  assert.equal(card.itemId, 'math-item-1');
  assert.equal(card.packId, 'math-grade-3');
  assert.equal(card.repetitions, 0);
  assert.equal(card.intervalDays, 1);
  assert.equal(card.lastQuality, 4);
  assert.equal(card.evidenceKind, 'practice');
  assert.equal(card.nextReviewDate, '2026-10-15');
});

const evidence = (overrides = {}) => ({sessionId:'study-1',profileId:'learner-1',packId:'math3-pack',contentVersion:1,itemId:'sum-1',
  correct:true,hintsUsed:0,elapsedMs:4500,occurredAt:'2026-10-14T17:00:00.000Z',...overrides});

test('practice schedules by Vietnamese day and never advances independent recall', () => {
  const first = buildReviewUpdate(undefined,evidence(),{evidence:'practice'});
  assert.equal(first.nextReviewDate,'2026-10-16');
  assert.equal(first.repetitions,0); assert.equal(first.easeFactor,2.5);
  assert.equal(first.lastEvidenceDay,undefined);
  const wrong = buildReviewUpdate(first,evidence({correct:false,occurredAt:'2026-10-14T17:01:00.000Z'}),{evidence:'practice'});
  assert.equal(wrong.nextReviewDate,'2026-10-15');
  const repaired = buildReviewUpdate(wrong,evidence({occurredAt:'2026-10-14T17:02:00.000Z'}),{evidence:'practice'});
  assert.equal(repaired.repetitions,0); assert.equal(repaired.nextReviewDate,'2026-10-16');
  assert.deepEqual(buildReviewUpdate(repaired,evidence({correct:false}),{evidence:'practice'}),repaired);
});

test('independent scheduling advances once per day/session and practice preserves its marker', () => {
  const first = buildReviewUpdate(undefined,evidence(),{evidence:'independent'});
  assert.equal(first.repetitions,1); assert.equal(first.lastEvidenceDay,'2026-10-15');
  const practiced = buildReviewUpdate(first,evidence({sessionId:'practice-2',occurredAt:'2026-10-14T18:00:00.000Z'}),{evidence:'practice'});
  assert.equal(practiced.lastEvidenceSessionId,'study-1'); assert.equal(practiced.evidenceKind,'practice');
  const repeated = buildReviewUpdate(practiced,evidence({sessionId:'study-2',occurredAt:'2026-10-14T19:00:00.000Z'}),{evidence:'independent'});
  assert.equal(repeated.repetitions,1);
  const next = buildReviewUpdate(repeated,evidence({sessionId:'study-3',occurredAt:'2026-10-15T17:00:00.000Z'}),{evidence:'independent'});
  assert.equal(next.repetitions,2); assert.equal(next.nextReviewDate,'2026-10-22');
  const sameSession = buildReviewUpdate(next,evidence({sessionId:'study-3',occurredAt:'2026-10-16T17:00:00.000Z'}),{evidence:'independent'});
  assert.equal(sameSession.repetitions,2);
  const hinted = buildReviewUpdate(undefined,evidence({hintsUsed:1}),{evidence:'independent'});
  assert.equal(hinted.repetitions,0); assert.equal(hinted.evidenceKind,'practice');
});

test('review identity distinguishes pack/version and colon-containing profile/item keys', () => {
  const a = {profileId:'a:b',packId:'math3-pack',contentVersion:1,itemId:'c'};
  const b = {...a,profileId:'a',itemId:'b:c'};
  assert.equal(`${a.profileId}:${a.itemId}`,`${b.profileId}:${b.itemId}`);
  assert.notEqual(reviewCardKey(a),reviewCardKey(b));
  assert.notEqual(reviewCardKey(a),reviewCardKey({...a,contentVersion:2}));
  assert.notEqual(reviewCardKey(a),reviewCardKey({...a,packId:'other-pack'}));
  assert.throws(()=>buildReviewUpdate(buildReviewUpdate(undefined,evidence(),{evidence:'practice'}),evidence({contentVersion:2}),{evidence:'practice'}),/không khớp/);
  assert.throws(()=>computeNextReview({repetitions:0,intervalDays:1,easeFactor:NaN},4),/không hợp lệ/);
});

test('isDueForReview and getDueReviewCards: filter and sort cards due today or overdue', () => {
  const cards = [
    { cardId: '1', nextReviewDate: '2026-10-12' }, // overdue
    { cardId: '2', nextReviewDate: '2026-10-14' }, // due today
    { cardId: '3', nextReviewDate: '2026-10-18' }, // future
    { cardId: '4', nextReviewDate: '2026-10-10' }  // very overdue
  ];

  const due = getDueReviewCards(cards, '2026-10-14');
  assert.equal(due.length, 3);
  assert.deepEqual(due.map(c => c.cardId), ['4', '1', '2']);
  assert.equal(isDueForReview(cards[0], '2026-10-14'), true);
  assert.equal(isDueForReview(cards[2], '2026-10-14'), false);
});
