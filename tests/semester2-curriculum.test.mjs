import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { validatePack } from '../src/core/validation.ts';

test('HK2 Curriculum: 8 approved weeks ready for Semester 2', () => {
  const curriculumFile = path.resolve('data/curriculum/hoc-ky-2-8-tuan.json');
  assert.ok(fs.existsSync(curriculumFile), 'Curriculum file hoc-ky-2-8-tuan.json must exist');

  const raw = fs.readFileSync(curriculumFile, 'utf-8');
  const curriculum = JSON.parse(raw);

  assert.equal(curriculum.schema, 'baoan-learning-semester2');
  assert.equal(curriculum.curriculumGrade, 3);
  assert.equal(curriculum.semester, 2);
  assert.equal(curriculum.status, 'approved_ready');
  assert.ok(curriculum.approvedBy, 'Must have approving body');
  assert.ok(curriculum.weeks.length >= 8, `Must have at least 8 weeks, got ${curriculum.weeks.length}`);

  const requiredSubjects = new Set(['math', 'vietnamese', 'english']);

  for (const week of curriculum.weeks) {
    assert.ok(week.weekNumber >= 19 && week.weekNumber <= 26, `Week number must be valid HK2 week (19-26), got ${week.weekNumber}`);
    assert.ok(week.title, 'Week must have title');
    assert.ok(week.discovery, 'Week must have discovery card');
    assert.ok(week.discovery.title, 'Discovery card must have title');
    assert.ok(week.discovery.text, 'Discovery card must have description text');

    const weekSubjects = new Set();
    for (const pack of week.packs) {
      weekSubjects.add(pack.subject);
      const errors = validatePack(pack);
      assert.deepEqual(errors, [], `Pack ${pack.id} must have 0 validation errors`);
    }

    for (const subj of requiredSubjects) {
      assert.ok(weekSubjects.has(subj), `Week ${week.weekNumber} must include subject ${subj}`);
    }
  }
});
