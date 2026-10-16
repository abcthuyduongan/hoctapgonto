import test from 'node:test';
import assert from 'node:assert/strict';
import { LESSON_CURRICULA,LESSON_PACKS,LIBRARY_CURRICULA,LIBRARY_PACKS,PILOT_CURRICULA,PILOT_PACKS,learnerCurricula } from '../src/core/lesson-seed.ts';
import { validateCurriculum,findRefItem,scoreLearningResponse } from '../src/core/curriculum.ts';
import { validatePack } from '../src/core/validation.ts';

test('Pilot has six grade-three lessons and 228 verified references: 8 practice, 4 assessments and 2 reviews each',()=>{
  const lessons=PILOT_CURRICULA.flatMap(row=>row.lessons);assert.equal(lessons.length,6);
  assert.equal(lessons.flatMap(row=>row.forms.flatMap(form=>form.itemRefs)).length,228);
  for(const curriculum of PILOT_CURRICULA){assert.equal(curriculum.lessons.length,2);assert.deepEqual(validateCurriculum(curriculum,PILOT_PACKS),[]);}
  for(const pack of PILOT_PACKS)assert.deepEqual(validatePack(pack),[],pack.id);
  for(const lesson of lessons){assert.equal(lesson.grade,3);assert.equal(lesson.forms.filter(form=>form.role==='assessment').length,4);assert.equal(lesson.forms.filter(form=>form.role==='review').length,2);
    assert.equal(lesson.forms.find(form=>form.role==='practice').itemRefs.length,8);
    for(const form of lesson.forms)for(const ref of form.itemRefs){const item=findRefItem(ref,PILOT_PACKS);assert.ok(item);assert.equal(scoreLearningResponse(ref,{version:1,kind:'choice',selectedIndex:item.correctIndex},PILOT_PACKS),true);
      for(let index=0;index<4;index++)if(index!==item.correctIndex)assert.equal(scoreLearningResponse(ref,{version:1,kind:'choice',selectedIndex:index},PILOT_PACKS),false);}
  }
});
test('Published starter packs and forms are unchanged; revision-two enrollments never arise from a revision-one pin',()=>{
  for(const pack of LESSON_PACKS)assert.deepEqual(PILOT_PACKS.find(row=>row.id===pack.id&&row.version===pack.version),pack);
  for(const old of LESSON_CURRICULA.flatMap(row=>row.lessons))assert.deepEqual(PILOT_CURRICULA.flatMap(row=>row.lessons).find(row=>row.lessonId===old.lessonId).forms.slice(0,4),old.forms);
  assert.equal(PILOT_PACKS.length,42);assert.ok(LIBRARY_PACKS.length>=42);assert.ok(LIBRARY_CURRICULA.length>=6);
  const math=LESSON_CURRICULA[0],chosen=learnerCurricula(LIBRARY_CURRICULA,[{curriculumId:math.curriculumId,curriculumRevision:1}]);
  assert.equal(chosen.find(row=>row.subject==='math').revision,1);assert.equal(chosen.find(row=>row.subject==='english').revision,Math.max(...LIBRARY_CURRICULA.filter(row=>row.subject==='english').map(row=>row.revision)));
});
test('All multiplication and one-step word-problem results agree with independent calculation',()=>{
  for(const pack of PILOT_PACKS.filter(row=>row.subject==='math'))for(const item of pack.items){
    const values=item.prompt.match(/\d+/g).map(Number),divide=item.prompt.includes(':')||item.prompt.includes('chia đều'),expected=divide?values[0]/values[1]:values[0]*values[1];
    assert.equal(Number(item.options[item.correctIndex]),expected,item.prompt);assert.equal(item.options.filter(option=>Number(option)===expected).length,1);
  }
});
test('Every reading answer is supported by its passage; all forms cover who/when/where/what/why without reading support in assessment',()=>{
  const reading=PILOT_CURRICULA.flatMap(row=>row.lessons).find(row=>row.lessonId==='vi-reading');
  const endings=['Ai thực hiện hoạt động?','Hoạt động diễn ra khi nào?','Hoạt động diễn ra ở đâu?','Bạn đã làm việc gì?','Vì sao bạn làm việc đó?'];
  for(const form of reading.forms){assert.equal(form.blueprint.allowReadAloud,false);
    const questions=form.itemRefs.map(ref=>findRefItem(ref,PILOT_PACKS));for(const ending of endings)assert.ok(questions.some(item=>item.prompt.endsWith(ending)),`${form.formId}: ${ending}`);
    for(const item of questions){const ending=endings.find(value=>item.prompt.endsWith(value)),passage=item.prompt.slice(0,-ending.length).toLocaleLowerCase('vi');assert.ok(passage.includes(item.options[item.correctIndex].toLocaleLowerCase('vi').replace(/^để /,'')),item.prompt);
      assert.ok(!item.prompt.includes('ở ở '));}
  }
});
