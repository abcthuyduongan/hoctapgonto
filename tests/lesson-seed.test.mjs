import test from 'node:test';
import assert from 'node:assert/strict';
import { LESSON_CURRICULA, LESSON_PACKS } from '../src/core/lesson-seed.ts';
import { validateCurriculum } from '../src/core/curriculum.ts';
import { validatePack } from '../src/core/validation.ts';
import { reviewIsReady } from '../src/core/lesson-host.ts';

test('Lesson starter catalog has three subjects, four complete lesson slices and disjoint forms',()=>{
  assert.deepEqual(LESSON_CURRICULA.map(row=>row.subject),['math','vietnamese','english']);
  assert.equal(LESSON_CURRICULA.flatMap(row=>row.lessons).length,4);
  for(const pack of LESSON_PACKS)assert.deepEqual(validatePack(pack),[],pack.id);
  for(const curriculum of LESSON_CURRICULA)assert.deepEqual(validateCurriculum(curriculum,LESSON_PACKS),[],curriculum.curriculumId);
  for(const lesson of LESSON_CURRICULA.flatMap(row=>row.lessons)){
    assert.equal(lesson.forms.flatMap(form=>form.itemRefs).length,23);
    assert.deepEqual(lesson.forms.map(form=>form.role),['practice','assessment','assessment','review']);
  }
});
test('Every arithmetic answer and distractor in the multiplication slice is checked by calculation',()=>{
  for(const pack of LESSON_PACKS.filter(row=>row.id.startsWith('math-multiply-'))){
    for(const item of pack.items){const [_,a,operator,b]=item.prompt.match(/^(\d+) (×|:) (\d+) = \?$/);
      const expected=operator==='×'?Number(a)*Number(b):Number(a)/Number(b);
      assert.equal(Number(item.options[item.correctIndex]),expected,item.prompt);
      assert.equal(item.options.filter(option=>Number(option)===expected).length,1);
    }
  }
});
test('Review readiness checks elapsed time and Vietnam date without rounding or UTC-day assumptions',()=>{
  assert.equal(reviewIsReady('2026-10-14T18:30:00.000Z','2026-10-14','2026-10-14T18:29:59.999Z'),false);
  assert.equal(reviewIsReady('2026-10-14T18:30:00.000Z','2026-10-15','2026-10-14T18:30:00.000Z'),false);
  assert.equal(reviewIsReady('2026-10-14T18:30:00.000Z','2026-10-14','2026-10-14T18:30:00.000Z'),true);
});
