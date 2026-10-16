import type { LearningEvent, ModuleId, PlaySession, Subject } from './contracts.ts';

/** Additive contracts for the lesson host. The Game SDK v1 stays unchanged. */
export const LEARNING_SCHEMA_VERSION = 1 as const;
export type LearningSubject = Exclude<Subject, 'thinking'>;
export type LearningMode = 'lesson-practice' | 'lesson-assessment' | 'lesson-review' | 'free-practice' | 'contest-mock';
export type LearningActivityId = ModuleId | 'lesson-reader' | 'practice-runner' | 'lesson-assessment' | 'lesson-review' | 'contest-mock';
export type StarTier = 0 | 1 | 2 | 3;

/** Passed is scoped to the exact published curriculum, lesson and policy. */
export interface LessonPassScope {
  profileId: string;
  curriculumId: string;
  curriculumRevision: number;
  lessonId: string;
  lessonRevision: number;
  policyId: string;
  policyRevision: number;
}

export interface PackItemRef {
  packId: string;
  contentVersion: number;
  itemId: string;
}

export interface MasteryPolicy {
  policyId: string;
  revision: number;
  passPercent: number;
  minIndependentItems: number;
  reviewDelayHours: number;
  timeZone: 'Asia/Ho_Chi_Minh';
}

export interface LearningBlueprint {
  blueprintId: string;
  revision: number;
  minimumItems: number;
  objectives: { objectiveId: string; minimumItems: number }[];
  /** Reading the prompt may be restricted for a reading/listening assessment. */
  allowReadAloud: boolean;
}

export interface LessonForm {
  formId: string;
  revision: number;
  role: 'practice' | 'assessment' | 'review';
  blueprint: LearningBlueprint;
  itemRefs: PackItemRef[];
  /** Editorial assertion of equivalent objective/difficulty, checked before publishing. */
  equivalenceGroupId: string;
  approvedAt: string;
  activityId: LearningActivityId;
}

export interface LessonDefinition {
  usage?:'self-study'|'contest';
  lessonId: string;
  revision: number;
  rewardGroupId: string;
  topicId: string;
  subject: LearningSubject;
  grade: number;
  title: string;
  objectiveIds: string[];
  knowledgeIds?: string[];
  prerequisiteLessonIds: string[];
  policyId: string;
  policyRevision: number;
  steps: { stepId: string; title: string; body: string; example?: string }[];
  forms: LessonForm[];
  mediaIds?: string[];
}

export interface CurriculumTopic {
  topicId: string;
  title: string;
  subject: LearningSubject;
  grade: number;
  lessonIds: string[];
}

export interface LearningMedia {
  mediaId: string;
  kind: 'audio' | 'image';
  url: string;
  sha256: string;
  transcript?: string;
  source: string;
  rights: string;
  approvedAt: string;
}

export interface CurriculumSnapshot {
  schemaVersion: typeof LEARNING_SCHEMA_VERSION;
  curriculumId: string;
  revision: number;
  title: string;
  subject: LearningSubject;
  grade: number;
  publishedAt: string;
  topics: CurriculumTopic[];
  policies: MasteryPolicy[];
  lessons: LessonDefinition[];
  media: LearningMedia[];
  contestPreset?:ContestPreset;
}
export interface ContestPreset {
  presetId:string;revision:number;contest:'violympic'|'ioe'|'trang-nguyen';schoolYear:string;grade:number;
  title:string;durationSeconds:number;pointsPerCorrect:number;verification:'general-practice'|'verified-format';
  sourceUrl:string;verifiedAt:string;requiredCurriculumId:string;requiredLessonIds:string[];
}
export interface ContestSummary {
  presetId:string;presetRevision:number;score:number;maxScore:number;elapsedMs:number;
  finishReason:'completed'|'submitted'|'timeout';skippedItemKeys:string[];unansweredItemKeys:string[];
}

export interface CurriculumEnrollment {
  curriculumId: string;
  curriculumRevision: number;
  enrolledAt: string;
  /** Parent opening a lesson grants access only; it does not grant passed/stars. */
  manualUnlocks: { lessonId: string; reason: string; openedAt: string }[];
}

export interface LearnerSettings {
  schemaVersion: typeof LEARNING_SCHEMA_VERSION;
  enrollments: CurriculumEnrollment[];
  preferredSubjects: LearningSubject[];
  textbook?: string;
  accessibility?: { readAloud: boolean; largeText: boolean; reduceMotion: boolean };
  contestChecklist?: { contest: 'violympic' | 'ioe' | 'trang-nguyen'; label: string; confirmedAt: string; source: string }[];
  rewardWallet?: RewardWallet;
  /** Parent-selected, exact published pack version for each 3D game. */
  gameAssignments?: GameAssignments;
  gameJourney?: GameJourney;
}
export type GameAssignment={packId:string;contentVersion:number};
export type GameAssignments=Partial<Record<ModuleId,GameAssignment>>;
export interface GameJourney {
  schemaVersion:1;
  enabled:boolean;
  stages:{id:string;title:string;level:'basic'|'advanced';packs:Record<LearningSubject,GameAssignment>}[];
  /** Optional parent selection for revisiting an unlocked pack. Otherwise advance automatically. */
  selectedPack?:GameAssignment;
}

export type RewardRequestStatus='pending'|'approved'|'fulfilled'|'cancelled'|'rejected';
export interface RewardRequest {
  requestId:string;title:string;goalVnd:number;stars:number;rateVnd:number;amountVnd:number;requestedAt:string;
  history:{status:RewardRequestStatus;at:string;note?:string}[];
}
/** Local family reward ledger. Achievement stars remain immutable. */
export interface RewardWallet {schemaVersion:1;enabled:boolean;rateVnd:number;updatedAt:string;requests:RewardRequest[]}

export type LearningResponse =
  | { version: 1; kind: 'choice'; selectedIndex: number }
  | { version: 1; kind: 'pair'; selectedItemId: string }
  | { version: 1; kind: 'sentence'; chosenIndices: number[] }
  | { version: 1; kind: 'text'; value: string };

export interface AttemptReceipt {
  attemptKey: string;
  eventId: string;
  itemKey: string;
  submissionIndex: number;
  committedAt: string;
}

export interface LessonCheckpoint {
  schemaVersion: typeof LEARNING_SCHEMA_VERSION;
  stepIndex: number;
  readStepIds: string[];
  formId: string;
  formRevision: number;
  seed: string;
  itemOrder: PackItemRef[];
  receipts: AttemptReceipt[];
  exposedItemKeys: string[];
  deadlineAt?: string;
  updatedAt: string;
  mediaPlayback?:{mediaId:string;sha256:string;completedAt:string}[];
  skippedItemKeys?:string[];
}

/** The evidence already known on this device when the host created the session. */
export interface ExposureSources {
  resultIds: string[];
  sessionIds: string[];
  itemKeys: string[];
  /** Optional for older snapshots; legacy games can reveal answers without granting stars. */
  legacyEventIds?: string[];
}

export interface LearningSession {
  schemaVersion: typeof LEARNING_SCHEMA_VERSION;
  sessionId: string;
  profileId: string;
  mode: LearningMode;
  activityId: LearningActivityId;
  activityVersion: string;
  scope: LessonPassScope;
  rewardGroupId: string;
  formId: string;
  formRevision: number;
  blueprint: LearningBlueprint;
  startedAt: string;
  endedAt?: string;
  status: 'active' | 'paused' | 'completed' | 'abandoned';
  /** Volatile marker, stripped from backup just like the legacy ownership marker. */
  ownerTabId?: string;
  checkpoint: LessonCheckpoint;
  sourcePracticeResultIds: string[];
  sourcePassResultId?: string;
  exposureSources?: ExposureSources;
  /** A knowledge hint permanently converts the independent attempt to guided practice. */
  guidedFrom?: 'lesson-assessment' | 'lesson-review';
  contestSource?:{curriculumId:string;curriculumRevision:number};
}

export interface LessonAttemptInput {
  attemptKey: string;
  itemRef: PackItemRef;
  response: LearningResponse;
  hintsUsed: number;
  elapsedMs: number;
}

export interface LessonAttemptCommit {
  event: LessonEvent;
  session: LearningSession;
  duplicate: boolean;
}

export interface LessonCompletionCommit {
  result: SessionResult;
  progress: LessonProgress;
  newStars: number;
  duplicate: boolean;
}

export interface LessonEvent {
  schemaVersion: typeof LEARNING_SCHEMA_VERSION;
  eventId: string;
  attemptKey: string;
  sessionId: string;
  profileId: string;
  scope: LessonPassScope;
  itemRef: PackItemRef;
  objectiveId: string;
  sequence: number;
  submissionIndex: number;
  response: LearningResponse;
  /** Host-scored value; independent scoring never trusts a component's boolean. */
  correct: boolean;
  hintsUsed: number;
  elapsedMs: number;
  occurredAt: string;
}

export interface SessionResult {
  schemaVersion: typeof LEARNING_SCHEMA_VERSION;
  resultId: string;
  sessionId: string;
  profileId: string;
  scope: LessonPassScope;
  rewardGroupId: string;
  mode: LearningMode;
  formId: string;
  formRevision: number;
  blueprintId: string;
  blueprintRevision: number;
  completed: boolean;
  passed: boolean;
  independent: boolean;
  starTier: StarTier;
  firstAttemptCorrect: number;
  totalItems: number;
  coverage: { objectiveId: string; answered: number; firstAttemptCorrect: number }[];
  eventIds: string[];
  itemKeys: string[];
  readStepIds: string[];
  practiceCorrected: boolean;
  hintsUsed: number;
  sourcePracticeResultIds: string[];
  sourcePassResultId?: string;
  completedAt: string;
  localDay: string;
  contest?:ContestSummary;
}

/** Reconstructable cache. SessionResult is the source of evidence. */
export interface LessonProgress {
  schemaVersion: typeof LEARNING_SCHEMA_VERSION;
  progressId: string;
  profileId: string;
  scope: LessonPassScope;
  rewardGroupId: string;
  bestStars: StarTier;
  passed: boolean;
  resultIds: string[];
  sourcePracticeResultIds: string[];
  sourcePassResultId?: string;
  sourceReviewResultId?: string;
  reviewEligibleAt?: string;
  updatedAt: string;
}

export type StoredSession = PlaySession | LearningSession;
export type StoredEvent = LearningEvent | LessonEvent;
export const isLearningSession = (value: unknown): value is LearningSession => !!value && typeof value === 'object'
  && 'schemaVersion' in value && value.schemaVersion === 1 && 'mode' in value;
export const isLessonEvent = (value: unknown): value is LessonEvent => !!value && typeof value === 'object'
  && 'schemaVersion' in value && value.schemaVersion === 1 && 'itemRef' in value;
