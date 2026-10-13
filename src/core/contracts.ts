/** Game SDK V1 — shared, data-only contracts. No game imports the persistence layer. */
export const GAME_SDK_VERSION = 1 as const;
export type Subject = 'math' | 'vietnamese' | 'english' | 'thinking';
export type ModuleId = 'math-quest' | 'memory-match' | 'sentence-builder';
export type ItemKind = 'multiple-choice' | 'pair' | 'sentence';

type BaseItem = { id: string; objectiveId: string };
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
};
export type QuizPack = PackBase & {kind: 'quiz'; items: QuizItem[]};
export type PairsPack = PackBase & {kind: 'pairs'; items: PairItem[]};
export type SentencePack = PackBase & {kind:'sentences'; items:SentenceItem[]};
export type ContentPack = QuizPack | PairsPack | SentencePack;
export type GameManifest = {
  id: ModuleId; label: string; description: string; runtime: 'react' | 'phaser';
  contentKind: ContentPack['kind']; version: string; sdkVersion: typeof GAME_SDK_VERSION;
  icon: string; color: string;
};
export type PlaySession = {
  sessionId: string; packId: string; contentVersion: number; moduleId: ModuleId;
  moduleVersion: string; startedAt: string; endedAt?: string;
  status: 'active' | 'completed' | 'abandoned';
};
export type LearningEvent = {
  eventId: string; sessionId: string; packId: string; contentVersion: number;
  moduleId: ModuleId; moduleVersion: string; itemId: string; objectiveId: string;
  correct: boolean; hintsUsed: number; elapsedMs: number; occurredAt: string;
};
/** attemptKey must be stable for a single logical submission, even on retry after failed storage. */
export type AttemptInput = Pick<LearningEvent, 'itemId' | 'objectiveId' | 'correct' | 'hintsUsed' | 'elapsedMs'> & {attemptKey:string};
export type GameHostProps = {
  pack: ContentPack;
  onAttempt: (attempt: AttemptInput) => Promise<void>;
  onComplete: () => Promise<void>;
  onExit: () => void;
};
