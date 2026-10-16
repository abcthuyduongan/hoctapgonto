import type { ContestPreset,ContestSummary,LearningSession,LessonEvent } from './learning-contracts.ts';
import { itemRefKey,lessonScopeKey,type ResultValidationContext } from './curriculum.ts';

export function contestSummary(session:LearningSession,events:LessonEvent[],completedAt:string,preset:ContestPreset):ContestSummary {
  const first=new Map<string,LessonEvent>();for(const event of [...events].sort((a,b)=>a.sequence-b.sequence))if(!first.has(itemRefKey(event.itemRef)))first.set(itemRefKey(event.itemRef),event);
  const keys=session.checkpoint.itemOrder.map(itemRefKey),skipped=[...(session.checkpoint.skippedItemKeys??[])].sort(),unanswered=keys.filter(key=>!first.has(key)&&!skipped.includes(key)).sort();
  const timeout=Date.parse(completedAt)>=Date.parse(session.checkpoint.deadlineAt!);
  return {presetId:preset.presetId,presetRevision:preset.revision,score:[...first.values()].filter(event=>event.correct).length*preset.pointsPerCorrect,maxScore:keys.length*preset.pointsPerCorrect,
    elapsedMs:Math.min(preset.durationSeconds*1000,Math.max(0,Date.parse(completedAt)-Date.parse(session.startedAt))),finishReason:timeout?'timeout':first.size+skipped.length===keys.length?'completed':'submitted',skippedItemKeys:skipped,unansweredItemKeys:unanswered};
}
export function contestPrerequisiteErrors(session:LearningSession,context:ResultValidationContext):string[]{
  const catalog=context.curricula.find(row=>row.curriculumId===session.scope.curriculumId&&row.revision===session.scope.curriculumRevision),preset=catalog?.contestPreset,source=session.contestSource;
  if(!preset||!source||source.curriculumId!==preset.requiredCurriculumId)return ['Thiếu preset hoặc lộ trình kiến thức nền đã ghim.'];
  const foundation=context.curricula.find(row=>row.curriculumId===source.curriculumId&&row.revision===source.curriculumRevision);
  if(!foundation||foundation.subject!==catalog.subject||foundation.grade!==preset.grade)return ['Lộ trình nền sai môn hoặc lớp.'];
  return preset.requiredLessonIds.flatMap(id=>{const lesson=foundation.lessons.find(row=>row.lessonId===id);if(!lesson)return ['Thiếu bài nền cần học trước khi luyện tổng hợp.'];
    const scope={profileId:session.profileId,curriculumId:foundation.curriculumId,curriculumRevision:foundation.revision,lessonId:id,lessonRevision:lesson.revision,policyId:lesson.policyId,policyRevision:lesson.policyRevision};
    return context.results.some(result=>lessonScopeKey(result.scope)===lessonScopeKey(scope)&&result.passed&&result.starTier>=2&&Date.parse(result.completedAt)<=Date.parse(session.startedAt))?[]:[`Con cần vượt qua “${lesson.title}” trước khi luyện tổng hợp.`];});
}
