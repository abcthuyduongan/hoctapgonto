import type { LearnerProfile, QuizPack } from '../../../src/core/contracts';
import type { CurriculumSnapshot, LearningSession, LessonEvent, SessionResult } from '../../../src/core/learning-contracts';

/** Small editorial fixture with disjoint practice, assessment and review items. */
export function learningStorageFixture(prefix: string, profileId = `${prefix}-learner`) {
  const publishedAt = '2026-10-12T09:00:00.000Z';
  const pack: QuizPack = {
    id: `${prefix}-addition`, version: 1, kind: 'quiz', title: 'QA cộng trong phạm vi 30', subject: 'math', grade: 3, source: 'local', publishedAt,
    items: Array.from({ length: 15 }, (_, index) => {
      const left = index + 2, answer = left + 3;
      return { id: `${prefix}-item-${index}`, objectiveId: `${prefix}-addition`, kind: 'multiple-choice' as const, prompt: `${left} + 3 = ?`,
        options: [String(answer), String(answer + 3), String(answer - 1), String(answer + 2)] as [string, string, string, string], correctIndex: 0 as const,
        explanation: `${left} + 3 = ${answer}.` };
    }),
  };
  const curriculum: CurriculumSnapshot = {
    schemaVersion: 1, curriculumId: `${prefix}-curriculum`, revision: 1, title: 'QA Toán lớp 3', subject: 'math', grade: 3, publishedAt,
    topics: [{ topicId: `${prefix}-topic`, title: 'Phép cộng', subject: 'math', grade: 3, lessonIds: [`${prefix}-lesson`] }],
    policies: [{ policyId: `${prefix}-policy`, revision: 1, passPercent: 80, minIndependentItems: 5, reviewDelayHours: 24, timeZone: 'Asia/Ho_Chi_Minh' }],
    lessons: [{ lessonId: `${prefix}-lesson`, revision: 1, rewardGroupId: `${prefix}-reward`, topicId: `${prefix}-topic`, subject: 'math', grade: 3,
      title: 'Cộng thêm ba', objectiveIds: [`${prefix}-addition`], prerequisiteLessonIds: [], policyId: `${prefix}-policy`, policyRevision: 1,
      steps: [{ stepId: `${prefix}-step`, title: 'Cộng thêm ba', body: 'Đếm thêm ba đơn vị từ số ban đầu.', example: '2 + 3 = 5.' }],
      forms: (['practice', 'assessment', 'review'] as const).map((role, formIndex) => ({ formId: `${prefix}-${role}`, revision: 1, role,
        blueprint: { blueprintId: `${prefix}-blueprint`, revision: 1, minimumItems: 5, objectives: [{ objectiveId: `${prefix}-addition`, minimumItems: 5 }], allowReadAloud: true },
        itemRefs: pack.items.slice(formIndex * 5, formIndex * 5 + 5).map(item => ({ packId: pack.id, contentVersion: 1, itemId: item.id })),
        equivalenceGroupId: `${prefix}-equivalence`, approvedAt: publishedAt, activityId: role === 'practice' ? 'practice-runner' : role === 'assessment' ? 'lesson-assessment' : 'lesson-review',
      })),
    }], media: [],
  };
  const profile: LearnerProfile = { profileId, name: 'Bảo An storage QA', avatar: 'owl', grade: 3, colorTheme: 'teal', createdAt: publishedAt, updatedAt: publishedAt,
    learningSettings: { schemaVersion: 1, enrollments: [{ curriculumId: curriculum.curriculumId, curriculumRevision: 1, enrolledAt: publishedAt, manualUnlocks: [] }], preferredSubjects: ['math'] } };
  const lesson = curriculum.lessons[0], form = lesson.forms[0];
  const scope = { profileId, curriculumId: curriculum.curriculumId, curriculumRevision: 1, lessonId: lesson.lessonId, lessonRevision: 1, policyId: lesson.policyId, policyRevision: 1 };
  const sessionId = `${prefix}-practice-session`;
  const completedAt = '2026-10-12T10:01:00.000Z';
  const events: LessonEvent[] = form.itemRefs.map((itemRef, index) => ({ schemaVersion: 1, eventId: `${sessionId}:answer-${index}`, attemptKey: `answer-${index}`,
    sessionId, profileId, scope, itemRef, objectiveId: `${prefix}-addition`, sequence: index + 1, submissionIndex: 1, response: { version: 1, kind: 'choice', selectedIndex: 0 },
    correct: true, hintsUsed: 0, elapsedMs: 1000, occurredAt: `2026-10-12T10:00:${String(index + 10).padStart(2, '0')}.000Z` }));
  const itemKey = (ref: { packId: string; contentVersion: number; itemId: string }) => JSON.stringify([ref.packId, ref.contentVersion, ref.itemId]);
  const session: LearningSession = { schemaVersion: 1, sessionId, profileId, mode: 'lesson-practice', activityId: 'practice-runner', activityVersion: '1.0.0', scope,
    rewardGroupId: lesson.rewardGroupId, formId: form.formId, formRevision: 1, blueprint: form.blueprint, startedAt: '2026-10-12T10:00:00.000Z', endedAt: completedAt,
    status: 'completed', checkpoint: { schemaVersion: 1, stepIndex: 1, readStepIds: [lesson.steps[0].stepId], formId: form.formId, formRevision: 1, seed: `${prefix}-seed`,
      itemOrder: form.itemRefs, receipts: events.map(event => ({ attemptKey: event.attemptKey, eventId: event.eventId, itemKey: itemKey(event.itemRef), submissionIndex: event.submissionIndex, committedAt: event.occurredAt })),
      exposedItemKeys: events.map(event => itemKey(event.itemRef)), updatedAt: completedAt }, sourcePracticeResultIds: [] };
  const result: SessionResult = { schemaVersion: 1, resultId: `result:${sessionId}`, sessionId, profileId, scope, rewardGroupId: lesson.rewardGroupId, mode: session.mode,
    formId: form.formId, formRevision: 1, blueprintId: form.blueprint.blueprintId, blueprintRevision: 1, completed: true, passed: false, independent: false, starTier: 1,
    firstAttemptCorrect: 5, totalItems: 5, coverage: [{ objectiveId: `${prefix}-addition`, answered: 5, firstAttemptCorrect: 5 }], eventIds: events.map(event => event.eventId),
    itemKeys: events.map(event => itemKey(event.itemRef)), readStepIds: [lesson.steps[0].stepId], practiceCorrected: true, hintsUsed: 0, sourcePracticeResultIds: [], completedAt, localDay: '2026-10-12' };
  return { pack, curriculum, profile, session, events, result };
}

export function assessmentEvidence(fixture: ReturnType<typeof learningStorageFixture>) {
  const lesson = fixture.curriculum.lessons[0], form = lesson.forms.find(form => form.role === 'assessment')!;
  const sessionId = `${fixture.session.sessionId}-assessment`, completedAt = '2026-10-12T10:03:00.000Z';
  const itemKey = (ref: { packId: string; contentVersion: number; itemId: string }) => JSON.stringify([ref.packId, ref.contentVersion, ref.itemId]);
  const events: LessonEvent[] = form.itemRefs.map((itemRef, index) => ({ schemaVersion: 1, eventId: `${sessionId}:answer-${index}`, attemptKey: `answer-${index}`,
    sessionId, profileId: fixture.profile.profileId, scope: fixture.session.scope, itemRef, objectiveId: lesson.objectiveIds[0], sequence: index + 1, submissionIndex: 1,
    response: { version: 1, kind: 'choice', selectedIndex: 0 }, correct: true, hintsUsed: 0, elapsedMs: 1000, occurredAt: `2026-10-12T10:02:${String(index + 10).padStart(2, '0')}.000Z` }));
  const session: LearningSession = { ...structuredClone(fixture.session), sessionId, mode: 'lesson-assessment', activityId: 'lesson-assessment', formId: form.formId,
    formRevision: form.revision, blueprint: form.blueprint, startedAt: '2026-10-12T10:02:00.000Z', endedAt: completedAt,
    checkpoint: { ...structuredClone(fixture.session.checkpoint), formId: form.formId, formRevision: form.revision, seed: `${sessionId}-seed`, itemOrder: form.itemRefs,
      receipts: events.map(event => ({ attemptKey: event.attemptKey, eventId: event.eventId, itemKey: itemKey(event.itemRef), submissionIndex: event.submissionIndex, committedAt: event.occurredAt })),
      exposedItemKeys: [], updatedAt: completedAt }, sourcePracticeResultIds: [fixture.result.resultId] };
  const result: SessionResult = { ...structuredClone(fixture.result), resultId: `result:${sessionId}`, sessionId, mode: 'lesson-assessment', formId: form.formId, formRevision: form.revision,
    blueprintId: form.blueprint.blueprintId, blueprintRevision: form.blueprint.revision, passed: true, independent: true, starTier: 2,
    eventIds: events.map(event => event.eventId), itemKeys: events.map(event => itemKey(event.itemRef)), sourcePracticeResultIds: [fixture.result.resultId], completedAt };
  return { session, events, result };
}

export function reviewEvidence(fixture: ReturnType<typeof learningStorageFixture>, assessment = assessmentEvidence(fixture)) {
  const lesson = fixture.curriculum.lessons[0], form = lesson.forms.find(form => form.role === 'review')!;
  const sessionId = `${fixture.session.sessionId}-review`, completedAt = '2026-10-13T11:03:00.000Z';
  const itemKey = (ref: { packId: string; contentVersion: number; itemId: string }) => JSON.stringify([ref.packId, ref.contentVersion, ref.itemId]);
  const events: LessonEvent[] = form.itemRefs.map((itemRef, index) => ({ schemaVersion: 1, eventId: `${sessionId}:answer-${index}`, attemptKey: `answer-${index}`,
    sessionId, profileId: fixture.profile.profileId, scope: fixture.session.scope, itemRef, objectiveId: lesson.objectiveIds[0], sequence: index + 1, submissionIndex: 1,
    response: { version: 1, kind: 'choice', selectedIndex: 0 }, correct: true, hintsUsed: 0, elapsedMs: 1000, occurredAt: `2026-10-13T11:02:${String(index + 10).padStart(2, '0')}.000Z` }));
  const session: LearningSession = { ...structuredClone(assessment.session), sessionId, mode: 'lesson-review', activityId: 'lesson-review', formId: form.formId,
    formRevision: form.revision, blueprint: form.blueprint, startedAt: '2026-10-13T11:02:00.000Z', endedAt: completedAt,
    checkpoint: { ...structuredClone(assessment.session.checkpoint), formId: form.formId, formRevision: form.revision, seed: `${sessionId}-seed`, itemOrder: form.itemRefs,
      receipts: events.map(event => ({ attemptKey: event.attemptKey, eventId: event.eventId, itemKey: itemKey(event.itemRef), submissionIndex: event.submissionIndex, committedAt: event.occurredAt })),
      exposedItemKeys: [], updatedAt: completedAt }, sourcePassResultId: assessment.result.resultId };
  const result: SessionResult = { ...structuredClone(assessment.result), resultId: `result:${sessionId}`, sessionId, mode: 'lesson-review', formId: form.formId, formRevision: form.revision,
    blueprintId: form.blueprint.blueprintId, blueprintRevision: form.blueprint.revision, starTier: 3,
    eventIds: events.map(event => event.eventId), itemKeys: events.map(event => itemKey(event.itemRef)), sourcePassResultId: assessment.result.resultId, completedAt, localDay: '2026-10-13' };
  return { session, events, result };
}
