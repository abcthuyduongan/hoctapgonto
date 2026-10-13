import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const root='docs/visual280/';
const results=JSON.parse(readFileSync(root+'layout-results.json','utf8'));
for(const row of results.filter(r=>Number.isFinite(r.width))) {
  test(`Alpha 2.8 preview ${row.width}px: answer and question positions are stable`,()=>{
    assert.equal(row.answerShift,0);
    assert.equal(row.questionShift,0);
    assert.ok(row.before.mascotLoaded && row.after.mascotLoaded);
    assert.ok(row.before.scrollWidth<=row.width && row.after.scrollWidth<=row.width);
    for(const state of ['waiting','feedback','reward'])assert.ok(existsSync(`${root}math-${state}-${row.width}.png`));
  });
}
test('Alpha 2.8 browser preview: motion reduced by system and manual setting',()=>{
  const row=results.find(r=>r.reducedMotionReactionDisplay);
  assert.equal(row?.reducedMotionReactionDisplay,'none');
  assert.equal(row?.motionOffReactionDisplay,'none');
});
