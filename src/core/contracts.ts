/** Game SDK V1 — shared, data-only contracts. No game imports the persistence layer. */
import type { LearnerSettings,LearningMedia } from './learning-contracts';
export const GAME_SDK_VERSION = 1 as const;
export type Subject = 'math' | 'vietnamese' | 'english' | 'thinking';
export type ModuleId = 'math-quest' | 'memory-match' | 'sentence-builder' | 'word-connect' | 'sequence-trail';
export type ItemKind = 'multiple-choice' | 'pair' | 'sentence' | 'numeric-answer' | 'fill-blank' | 'reading-choice' | 'listening-choice' | 'listening-gap';

export type QuestionMetadata={knowledgeId:string;difficulty:'easy'|'medium'|'hard';contentRole:'unassigned'|'practice'|'assessment'|'review';source:string;rights:string;reviewStatus:'draft'|'reviewed';formId?:string;topicId?:string;level?:string};
export type QuestionTemplateInfo={schema:'baoan-question-template';templateVersion:1;contentFormatVersion:2;topicId:string;source:string;rights:string;reviewStatus:'draft'|'reviewed'};
export type QuestionMedia={imageId?:string;imageAlt?:string;audioId?:string;audioTranscript?:string};
type BaseItem = { id: string; objectiveId: string;metadata?:QuestionMetadata;media?:QuestionMedia };
export type QuizItem = BaseItem & {
  kind: 'multiple-choice'; prompt: string;
  options: [string, string, string, string]; correctIndex: 0 | 1 | 2 | 3; explanation: string;
};
export type PairItem = BaseItem & {kind: 'pair'; left: string; right: string};
/** words appear in the target sentence order; game shuffles indices, not strings. */
export type SentenceItem = BaseItem & {kind:'sentence'; prompt:string; words:string[]; hint:string};

type PackBase = {
  id: string; version: number; title: string; subject: Subject; grade: number;
  source: 'builtin' | 'local'; publishedAt: string;
  templateInfo?:QuestionTemplateInfo;
};
export type QuizPack = PackBase & {kind: 'quiz'; items: QuizItem[]};
export type PairsPack = PackBase & {kind: 'pairs'; items: PairItem[]};
export type SentencePack = PackBase & {kind:'sentences'; items:SentenceItem[]};
export type NumericItem=BaseItem&{kind:'numeric-answer';prompt:string;answer:string;unit?:string;explanation:string;hint:string};
export type FillBlankItem=BaseItem&{kind:'fill-blank';prompt:string;acceptedAnswers:string[];caseSensitive:boolean;explanation:string;hint:string};
export type ReadingChoiceItem=Omit<QuizItem,'kind'>&{kind:'reading-choice';passageId:string;hint:string};
export type ListeningChoiceItem=Omit<QuizItem,'kind'>&{kind:'listening-choice';audioId:string;hint:string};
export type ListeningGapItem=Omit<FillBlankItem,'kind'>&{kind:'listening-gap';audioId:string};
export type RichLearningItem=NumericItem|FillBlankItem|ReadingChoiceItem|ListeningChoiceItem|ListeningGapItem;
export type ReadingPassage={passageId:string;title:string;body:string;source:string;rights:string;approvedAt:string};
export type LearningPack=PackBase&{kind:'learning';contentFormatVersion:2;items:RichLearningItem[];passages:ReadingPassage[];media:LearningMedia[]};
export type ContentPack = QuizPack | PairsPack | SentencePack | LearningPack;
export type GameManifest = {
  id: ModuleId; label: string; description: string; runtime: 'react' | 'phaser';
  contentKind: ContentPack['kind']; version: string; sdkVersion: typeof GAME_SDK_VERSION;
  icon: string; color: string;
};
export type AvatarId = 'fox' | 'owl' | 'bear' | 'rabbit' | 'cat';

export interface LearnerProfile {
  profileId: string;
  name: string;
  avatar: AvatarId;
  grade: number; // 1 - 5
  colorTheme: string;
  createdAt: string;
  updatedAt: string;
  /** Optional for untouched legacy profiles; enrollment always pins a snapshot. */
  learningSettings?: LearnerSettings;
}

export type PlaySession = {
  sessionId: string; packId: string; contentVersion: number; moduleId: ModuleId;
  moduleVersion: string; startedAt: string; endedAt?: string;
  status: 'active' | 'completed' | 'abandoned';
  profileId?: string;
  /** Volatile ownership marker; not transferred in a backup. */
  ownerTabId?: string;
  /** New game sessions only; old boolean-only evidence never earns retroactive stars. */
  rewardPolicyVersion?: 1;
  /** Deterministic alternate view of the source pack, without duplicating rewards. */
  presentationVersion?: 1;
};
export type GameResponse = {kind:'choice';choiceIndex:number}
  | {kind:'text';value:string}
  | {kind:'order';indices:number[]}
  | {kind:'pair';first:{itemId:string;side:'left'|'right'};second:{itemId:string;side:'left'|'right'}};
export type LearningEvent = {
  eventId: string; sessionId: string; packId: string; contentVersion: number;
  moduleId: ModuleId; moduleVersion: string; itemId: string; objectiveId: string;
  correct: boolean; hintsUsed: number; elapsedMs: number; occurredAt: string;
  profileId?: string;
  /** Raw response is checked against the immutable pack by the host. */
  response?: GameResponse;
  /** Assigned by the storage transaction, never the game. */
  gameSequence?: number;
};
/** attemptKey must be stable for a single logical submission, even on retry after failed storage. */
export type AttemptInput = Pick<LearningEvent, 'itemId' | 'objectiveId' | 'correct' | 'hintsUsed' | 'elapsedMs' | 'response'> & {attemptKey:string};
export type GameHostProps = {
  pack: ContentPack;
  onAttempt: (attempt: AttemptInput) => Promise<void>;
  onComplete: () => Promise<void>;
  onExit: () => void;
};

export interface ReviewCard {
  schemaVersion?: 1;
  cardId: string; // Legacy keys are retained; new keys also pin pack/version.
  profileId: string;
  itemId: string;
  packId: string;
  contentVersion?: number;
  evidenceKind?: 'practice' | 'independent';
  /** Most recent independent evidence; guided practice must not overwrite it. */
  lastEvidenceDay?: string;
  lastEvidenceSessionId?: string;
  repetitions: number;
  intervalDays: number;
  easeFactor: number;
  lastQuality: number;
  lastReviewedAt: string;
  nextReviewDate: string; // YYYY-MM-DD
}

/** Returned only after the event and review transaction has committed. */
export interface AttemptCommitReceipt {
  event: LearningEvent;
  review?: ReviewCard;
  duplicate: boolean;
}
