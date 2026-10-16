import test from 'node:test';
import assert from 'node:assert/strict';
import { CONTEST_CURRICULA } from '../src/core/contest-catalog.ts';
import { RICH_CURRICULA,RICH_PACKS } from '../src/core/lesson-seed.ts';
import { contestPrerequisiteErrors,contestSummary } from '../src/core/contest-runtime.ts';
import { buildLessonSession } from '../src/core/lesson-host.ts';
import { assertLessonStart,makeLessonSubmission,makeSessionResult } from '../src/core/learning-runtime.ts';
import { findRefItem,itemRefKey,rebuildLessonProgress,validateCurriculum,validateLearningSession,validateLessonEvent,validateSessionResult } from '../src/core/curriculum.ts';
import { parseLearningBackup,serializeLearningBackup } from '../src/core/backup-io.ts';

const base=Date.parse('2026-10-16T01:00:00.000Z');
const at=milliseconds=>new Date(base+milliseconds).toISOString();
const answerFor=item=>'options' in item?{version:1,kind:'choice',selectedIndex:item.correctIndex}:{version:1,kind:'text',value:item.answer??item.acceptedAnswers[0]};
function fixture(subject='math'){
  const context={curricula:[...RICH_CURRICULA,...CONTEST_CURRICULA],packs:RICH_PACKS,sessions:[],events:[],results:[]};
  const foundation=RICH_CURRICULA.find(row=>row.subject===subject),catalog=CONTEST_CURRICULA.find(row=>row.subject===subject);
  let time=0;
  for(const lesson of foundation.lessons)for(const role of ['practice','assessment']){
    const form=lesson.forms.find(row=>row.role===role);let session=buildLessonSession('contest-unit',foundation,lesson,form,context,'unit-owner',`foundation-${subject}-${lesson.lessonId}-${role}`,at(time));
    session.checkpoint.readStepIds=lesson.steps.map(row=>row.stepId);session.checkpoint.stepIndex=lesson.steps.length;
    assertLessonStart(session,context);const events=[];
    for(const [index,itemRef] of form.itemRefs.entries()){
      const submitted=makeLessonSubmission(session,events,{attemptKey:`answer-${index}`,itemRef,response:answerFor(findRefItem(itemRef,RICH_PACKS)),hintsUsed:0,elapsedMs:1000},at(time+index+1),context);
      session=submitted.session;events.push(submitted.event);
    }
    context.sessions.push(session);context.events.push(...events);
    const result=makeSessionResult(session,events,at(time+1000),context);context.results.push(result);
    Object.assign(session,{status:'completed',endedAt:result.completedAt,checkpoint:{...session.checkpoint,updatedAt:result.completedAt}});delete session.ownerTabId;time+=2000;
  }
  const lesson=catalog.lessons[0],form=lesson.forms[0],session=buildLessonSession('contest-unit',catalog,lesson,form,context,'unit-owner',`contest-${subject}`,at(60_000));
  session.mode='contest-mock';session.contestSource={curriculumId:foundation.curriculumId,curriculumRevision:foundation.revision};
  session.checkpoint.deadlineAt=at(60_000+catalog.contestPreset.durationSeconds*1000);session.checkpoint.skippedItemKeys=[];
  context.sessions.push(session);return {context,session,catalog,foundation};
}
function submit(f,index=0,offset=61_000){const itemRef=f.session.checkpoint.itemOrder[index],events=f.context.events.filter(row=>row.sessionId===f.session.sessionId);
  const submitted=makeLessonSubmission(f.session,events,{attemptKey:`contest-answer-${index}`,itemRef,response:answerFor(findRefItem(itemRef,f.context.packs)),hintsUsed:0,elapsedMs:1000},at(offset),f.context);
  Object.assign(f.session,submitted.session);f.context.events.push(submitted.event);return submitted.event;}
function finish(f,offset){return makeSessionResult(f.session,f.context.events.filter(row=>row.sessionId===f.session.sessionId),at(offset),f.context);}
function finishedContext(f,result){const session={...f.session,status:'completed',endedAt:result.completedAt,checkpoint:{...f.session.checkpoint,updatedAt:result.completedAt}};delete session.ownerTabId;
  return {...f.context,sessions:f.context.sessions.map(row=>row.sessionId===session.sessionId?session:row),results:[...f.context.results,result]};}

test('All three contest catalogs pin grade, year, internal practice preset, two foundation lessons and exact ten-item blueprints',()=>{
  assert.equal(CONTEST_CURRICULA.length,3);
  for(const catalog of CONTEST_CURRICULA){assert.deepEqual(validateCurriculum(catalog,RICH_PACKS),[]);assert.equal(catalog.grade,3);assert.equal(catalog.contestPreset.schoolYear,'2026-2027');assert.equal(catalog.contestPreset.verification,'general-practice');assert.equal(catalog.contestPreset.requiredLessonIds.length,2);assert.equal(catalog.lessons[0].forms[0].itemRefs.length,10);}
  for(const [field,value] of [['durationSeconds',0],['pointsPerCorrect',0],['sourceUrl','javascript:alert(1)'],['schoolYear','2026']]){const changed=structuredClone(CONTEST_CURRICULA[0]);changed.contestPreset[field]=value;assert.ok(validateCurriculum(changed,RICH_PACKS).length,field);}
});
test('Contest prerequisite uses both exact pinned lesson passes from the same profile, published before start',()=>{
  const f=fixture();assert.deepEqual(contestPrerequisiteErrors(f.session,f.context),[]);assertLessonStart(f.session,f.context);
  const passes=f.context.results.filter(row=>row.starTier===2);assert.equal(passes.length,2);
  for(const modify of [row=>({...row,passed:false}),row=>({...row,starTier:1}),row=>({...row,scope:{...row.scope,profileId:'other'}}),row=>({...row,scope:{...row.scope,curriculumRevision:2}}),row=>({...row,completedAt:at(100_000)})]){
    const context={...f.context,results:f.context.results.map(row=>row.resultId===passes[1].resultId?modify(row):row)};assert.equal(contestPrerequisiteErrors(f.session,context).length,1);assert.throws(()=>assertLessonStart(f.session,context),/vượt qua/);
  }
});
test('Early submission separates deliberate skipped items from unanswered items, scores host evidence and never awards stars',()=>{
  const f=fixture();submit(f);f.session.checkpoint.skippedItemKeys=[itemRefKey(f.session.checkpoint.itemOrder[1])];const result=finish(f,65_000);
  assert.equal(result.firstAttemptCorrect,1);assert.equal(result.totalItems,10);assert.equal(result.starTier,0);assert.equal(result.passed,false);assert.equal(result.independent,false);
  assert.deepEqual(result.contest,{presetId:f.catalog.contestPreset.presetId,presetRevision:1,score:10,maxScore:100,elapsedMs:5000,finishReason:'submitted',skippedItemKeys:[itemRefKey(f.session.checkpoint.itemOrder[1])],unansweredItemKeys:f.session.checkpoint.itemOrder.slice(2).map(itemRefKey).sort()});
  assert.deepEqual(validateSessionResult(result,finishedContext(f,result)),[]);assert.equal(rebuildLessonProgress([result],f.context.curricula)[0].bestStars,0);
});
test('Timeout with zero answers is a valid zero-score immutable result; elapsed time is capped to original deadline',()=>{
  const f=fixture();const result=finish(f,900_000);assert.equal(result.eventIds.length,0);assert.equal(result.firstAttemptCorrect,0);assert.equal(result.contest.finishReason,'timeout');assert.equal(result.contest.elapsedMs,600_000);assert.equal(result.contest.unansweredItemKeys.length,10);assert.equal(result.starTier,0);
  assert.deepEqual(validateSessionResult(result,finishedContext(f,result)),[]);
});
test('A reply at the deadline, a repeated first response, a skipped response and a backward clock are rejected without new evidence',()=>{
  const f=fixture();submit(f);const first=f.session.checkpoint.itemOrder[0],input={attemptKey:'again',itemRef:first,response:answerFor(findRefItem(first,f.context.packs)),hintsUsed:0,elapsedMs:1};
  assert.throws(()=>makeLessonSubmission(f.session,f.context.events.filter(row=>row.sessionId===f.session.sessionId),input,at(62_000),f.context),/một câu trả lời/);
  const second=f.session.checkpoint.itemOrder[1];input.itemRef=second;input.response=answerFor(findRefItem(second,f.context.packs));
  assert.throws(()=>makeLessonSubmission(f.session,[],input,f.session.checkpoint.deadlineAt,f.context),/hết thời gian/);
  assert.throws(()=>makeLessonSubmission(f.session,[],input,at(60_500),f.context),/Đồng hồ/);
  f.session.checkpoint.skippedItemKeys=[itemRefKey(second)];assert.throws(()=>makeLessonSubmission(f.session,[],input,at(62_000),f.context),/bỏ qua/);assert.equal(f.context.events.filter(row=>row.sessionId===f.session.sessionId).length,1);
});
test('Pinned duration cannot be extended in a checkpoint or claimed as a normal lesson, and score tampering is rejected',()=>{
  const f=fixture();const extended=structuredClone(f.session);extended.checkpoint.deadlineAt=at(1_000_000);assert.ok(validateLearningSession(extended,f.context.curricula,f.context.packs).some(error=>error.includes('deadline')));
  const normal=structuredClone(f.session);normal.mode='lesson-practice';assert.ok(validateLearningSession(normal,f.context.curricula,f.context.packs).length);
  submit(f);const result=finish(f,65_000),context=finishedContext(f,result);
  for(const patch of [{score:100},{finishReason:'completed'},{elapsedMs:1},{unansweredItemKeys:[]}]){const changed=structuredClone(result);Object.assign(changed.contest,patch);assert.ok(validateSessionResult(changed,context).some(error=>error.includes('khớp evidence')));}
  const stars={...result,starTier:2,passed:true};assert.ok(validateSessionResult(stars,context).length);
});
test('Answering every item or skipping the remainder finishes the turn, with Vietnamese scoring pinned to 300 maximum',()=>{
  const f=fixture('vietnamese');submit(f);f.session.checkpoint.skippedItemKeys=f.session.checkpoint.itemOrder.slice(1).map(itemRefKey);
  const summary=contestSummary(f.session,f.context.events.filter(row=>row.sessionId===f.session.sessionId),at(65_000),f.catalog.contestPreset);assert.equal(summary.finishReason,'completed');assert.equal(summary.score,30);assert.equal(summary.maxScore,300);assert.deepEqual(summary.unansweredItemKeys,[]);assert.equal(finish(f,65_000).starTier,0);
});
test('Contest event validation rejects a hint or forged second submission even with a matching receipt',()=>{
  const f=fixture(),event=submit(f);assert.deepEqual(validateLessonEvent(event,f.session,f.context.curricula,f.context.packs),[]);
  const hinted={...event,hintsUsed:1};assert.ok(validateLessonEvent(hinted,f.session,f.context.curricula,f.context.packs).some(error=>error.includes('không dùng gợi ý')));
  const duplicate={...event,submissionIndex:2},session=structuredClone(f.session);session.checkpoint.receipts[0].submissionIndex=2;
  assert.ok(validateLessonEvent(duplicate,session,f.context.curricula,f.context.packs).some(error=>error.includes('câu trả lời đầu tiên')));
  assert.throws(()=>makeLessonSubmission(f.session,[event],{attemptKey:'hint-next',itemRef:f.session.checkpoint.itemOrder[1],response:answerFor(findRefItem(f.session.checkpoint.itemOrder[1],f.context.packs)),hintsUsed:1,elapsedMs:1},at(62_000),f.context),/không dùng gợi ý/);
});

test('Contest source must be an enrolled foundation revision when the profile is known',()=>{
  const f=fixture(),profile={profileId:f.session.profileId,learningSettings:{enrollments:[{curriculumId:f.catalog.curriculumId,curriculumRevision:f.catalog.revision}]}};
  assert.ok(validateLearningSession(f.session,f.context.curricula,f.context.packs,[profile]).some(error=>error.includes('lộ trình nền')));
  profile.learningSettings.enrollments.push({curriculumId:f.foundation.curriculumId,curriculumRevision:f.foundation.revision});
  assert.deepEqual(validateLearningSession(f.session,f.context.curricula,f.context.packs,[profile]),[]);
});

test('An unfinished contest backup still requires both immutable foundation pass results',()=>{
  const f=fixture(),profile={profileId:'contest-unit',name:'Bảo An QA',avatar:'owl',grade:3,colorTheme:'teal',createdAt:at(0),updatedAt:at(70_000),learningSettings:{schemaVersion:1,enrollments:[f.foundation,f.catalog].map(row=>({curriculumId:row.curriculumId,curriculumRevision:row.revision,enrolledAt:at(0),manualUnlocks:[]})),preferredSubjects:['math']}};
  const source={packs:f.context.packs,curricula:f.context.curricula,sessions:f.context.sessions,events:f.context.events,profiles:[profile],reviews:[],sessionResults:f.context.results,lessonProgress:rebuildLessonProgress(f.context.results,f.context.curricula)};
  const valid=serializeLearningBackup(source,at(80_000));assert.equal(parseLearningBackup(valid).sessions.find(row=>row.sessionId===f.session.sessionId).status,'active');
  const tampered=JSON.parse(valid),removed=f.context.results.at(-1);tampered.sessionResults=tampered.sessionResults.filter(row=>row.resultId!==removed.resultId);tampered.sessions=tampered.sessions.filter(row=>row.sessionId!==removed.sessionId);tampered.events=tampered.events.filter(row=>row.sessionId!==removed.sessionId);tampered.lessonProgress=rebuildLessonProgress(tampered.sessionResults,tampered.curricula);
  assert.throws(()=>parseLearningBackup(JSON.stringify(tampered)),/vượt qua/);
});

test('Backup round-trip keeps original contest preset, score, deadline, prerequisite evidence and family checklist without creating stars',()=>{
  const f=fixture();submit(f);const result=finish(f,65_000),context=finishedContext(f,result),profile={profileId:'contest-unit',name:'Bảo An QA',avatar:'owl',grade:3,colorTheme:'teal',createdAt:at(0),updatedAt:at(70_000),learningSettings:{schemaVersion:1,enrollments:[f.foundation,f.catalog].map(row=>({curriculumId:row.curriculumId,curriculumRevision:row.revision,enrolledAt:at(0),manualUnlocks:[]})),preferredSubjects:['math'],contestChecklist:[{contest:'violympic',label:'Gia đình đã kiểm tra tài khoản',source:f.catalog.contestPreset.sourceUrl,confirmedAt:at(70_000)}]}};
  const source={packs:context.packs,curricula:context.curricula,sessions:context.sessions,events:context.events,profiles:[profile],reviews:[],sessionResults:context.results,lessonProgress:rebuildLessonProgress(context.results,context.curricula)};
  const restored=parseLearningBackup(serializeLearningBackup(source,at(80_000)));assert.deepEqual(restored.sessionResults.find(row=>row.resultId===result.resultId),result);assert.deepEqual(restored.profiles[0].learningSettings.contestChecklist,profile.learningSettings.contestChecklist);assert.equal(restored.sessions.find(row=>row.sessionId===f.session.sessionId).checkpoint.deadlineAt,f.session.checkpoint.deadlineAt);assert.equal(restored.lessonProgress.filter(row=>row.scope.curriculumId===f.catalog.curriculumId)[0].bestStars,0);
});
