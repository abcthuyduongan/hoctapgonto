import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateReport } from '../src/core/reports.ts';

const e=(correct,objectiveId='ENG3.FAMILY',hintsUsed=0)=>({correct,objectiveId,hintsUsed});
test('Báo cáo không đồng nhất tỷ lệ đúng với mức độ thành thạo',()=>{
  const r=calculateReport([e(true),e(false),e(true,'MATH3.MULTIPLY',1)],[]);
  assert.equal(r.attempts,3);
  assert.equal(r.correct,2);
  assert.equal(r.accuracy,67);
  assert.equal(r.completed,0);
  assert.equal(r.objectives.find(o=>o.id==='MATH3.MULTIPLY').hints,1);
});
test('Chỉ tính phiên chơi đã completed',()=>{
  const r=calculateReport([], [{status:'completed'}, {status:'abandoned'}, {status:'active'}]);
  assert.equal(r.completed,1);
  assert.equal(r.accuracy,0);
});
