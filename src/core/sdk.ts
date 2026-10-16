import type { AttemptInput, ContentPack, GameManifest, LearningEvent, PlaySession } from './contracts.ts';
import { GAME_SDK_VERSION } from './contracts.ts';
import { scoreGameResponse } from './game-rewards.ts';

/** The host validates identity and shape; local game correctness is NOT cheat-proof. */
export function assertModuleContract(manifest: GameManifest, pack: ContentPack): void {
  if (manifest.sdkVersion !== GAME_SDK_VERSION) throw new Error('Phiên bản Game SDK không tương thích.');
  if (manifest.contentKind !== pack.kind) throw new Error('Game không tương thích loại học liệu.');
}
export function makeLearningEvent(session: PlaySession, pack: ContentPack, input: AttemptInput, occurredAt: string): LearningEvent {
  if (session.status !== 'active' || session.packId !== pack.id || session.contentVersion !== pack.version) {
    throw new Error('Phiên chơi không khớp học liệu.');
  }
  const item = pack.items.find(i => i.id === input.itemId);
  if (!item || item.objectiveId !== input.objectiveId) throw new Error('Câu hỏi không thuộc phiên chơi.');
  if (typeof input.attemptKey !== 'string' || !/^[a-zA-Z0-9._:-]{1,120}$/.test(input.attemptKey)) {
    throw new Error('Khóa lượt thử không hợp lệ.');
  }
  if (typeof input.correct !== 'boolean' || !Number.isFinite(input.elapsedMs) || input.elapsedMs < 0 || input.elapsedMs > 14_400_000
    || !Number.isInteger(input.hintsUsed) || input.hintsUsed < 0 || input.hintsUsed > 20) {
    throw new Error('Dữ liệu lượt thử không hợp lệ.');
  }
  const {attemptKey, ...outcome} = input;
  if(input.response&&scoreGameResponse(pack,session.moduleId,input.itemId,input.response,session.presentationVersion).correct!==input.correct)throw new Error('Kết quả game không khớp câu trả lời gốc.');
  return {
    eventId:`${session.sessionId}:${attemptKey}`,
    sessionId:session.sessionId,
    ...(session.profileId ? {profileId: session.profileId} : {}),
    packId:pack.id,contentVersion:pack.version,
    moduleId:session.moduleId,moduleVersion:session.moduleVersion,
    occurredAt,...outcome
  };
}
export function sameAttempt(a: LearningEvent, b: LearningEvent): boolean {
  const responseKey=(value:unknown):string=>JSON.stringify(value,(_key,row)=>row&&typeof row==='object'&&!Array.isArray(row)?Object.fromEntries(Object.entries(row).sort(([left],[right])=>left.localeCompare(right))):row);
  return a.eventId === b.eventId && a.sessionId === b.sessionId && a.itemId === b.itemId
    && (a.profileId ?? 'default-learner') === (b.profileId ?? 'default-learner')
    && a.objectiveId === b.objectiveId && a.correct === b.correct
    && a.hintsUsed === b.hintsUsed
    && a.packId === b.packId && a.contentVersion === b.contentVersion
    && a.moduleId === b.moduleId && a.moduleVersion === b.moduleVersion
    && responseKey(a.response)===responseKey(b.response);
}
/** Token indices prevent problems when the exact same word appears twice. */
export function isCorrectSentence(words: string[], chosenIndices: number[]): boolean {
  if (!Array.isArray(words) || chosenIndices.length !== words.length) return false;
  if (new Set(chosenIndices).size !== words.length || chosenIndices.some(i=>!Number.isInteger(i) || i<0 || i>=words.length)) return false;
  const normalize = (s:string) => s.normalize('NFC').trim().replace(/\s+/g,' ').toLocaleLowerCase('vi');
  return normalize(chosenIndices.map(i=>words[i]).join(' ')) === normalize(words.join(' '));
}
