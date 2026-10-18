import type { ContentPack,GameResponse,LearningEvent,PlaySession } from './contracts.ts';
import type { StoredEvent,StoredSession } from './learning-contracts.ts';
import { isLearningSession,isLessonEvent } from './learning-contracts.ts';
import { compatible,validatePack } from './validation.ts';
import { sessionGamePack } from './game-presentation.ts';

export type GameRewardEvidence={sessions:StoredSession[];events:StoredEvent[];packs:ContentPack[]};
export type GameReward={profileId:string;packId:string;starTier:1|2|3;sessionId:string;completedAt:string;totalItems:number;firstTryCorrect:number;questionLedger?:import('./question-rewards.ts').QuestionRewardLedger};
const validTime=(value:unknown):value is string=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
const object=(value:unknown,keys:string[]):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype&&Reflect.ownKeys(value).every(key=>typeof key==='string'&&keys.includes(key)&&'value'in Object.getOwnPropertyDescriptor(value,key)!);
const normalize=(value:string)=>value.normalize('NFC').trim().replace(/\s+/g,' ').toLocaleLowerCase('vi');

/** Return the host's outcome; a game-provided correct flag is never the source of truth. */
export function scoreGameResponse(source:ContentPack,moduleId:PlaySession['moduleId'],itemId:string,input:unknown,presentationVersion?:1):{correct:boolean;touchedItemIds:string[]}{
  const pack=sessionGamePack({moduleId,presentationVersion},source);
  if(!pack)throw new Error('Bộ câu hỏi không dùng được với cách chơi này.');
  const item=pack.items.find(row=>row.id===itemId);
  if(!item||!compatible(moduleId,pack))throw new Error('Câu trả lời không thuộc bộ câu hỏi và game đang chơi.');
  if(pack.kind==='quiz'&&item.kind==='multiple-choice'&&object(input,['kind','choiceIndex'])&&input.kind==='choice'&&Number.isInteger(input.choiceIndex)&&Number(input.choiceIndex)>=0&&Number(input.choiceIndex)<=3){
    return {correct:input.choiceIndex===item.correctIndex,touchedItemIds:[itemId]};
  }
  if(pack.kind==='sentences'&&item.kind==='sentence'&&object(input,['kind','indices'])&&input.kind==='order'&&Array.isArray(input.indices)&&input.indices.length===item.words.length
    &&new Set(input.indices).size===item.words.length&&input.indices.every(index=>Number.isInteger(index)&&index>=0&&index<item.words.length)){
    return {correct:normalize(input.indices.map(index=>item.words[index]).join(' '))===normalize(item.words.join(' ')),touchedItemIds:[itemId]};
  }
  if(pack.kind==='pairs'&&object(input,['kind','first','second'])&&input.kind==='pair'){
    const first=input.first,second=input.second;
    const card=(value:unknown):value is {itemId:string;side:'left'|'right'}=>object(value,['itemId','side'])&&typeof value.itemId==='string'&&pack.items.some(row=>row.id===value.itemId)&&(value.side==='left'||value.side==='right');
    if(card(first)&&card(second)&&(first.itemId!==second.itemId||first.side!==second.side)
      &&(moduleId==='memory-match'?second.itemId===itemId:first.itemId===itemId&&first.side==='left'&&second.side==='right')){
      return {correct:first.itemId===second.itemId&&first.side!==second.side,touchedItemIds:[...new Set([first.itemId,second.itemId])]};
    }
  }
  throw new Error('Thiếu câu trả lời gốc hoặc câu trả lời không hợp lệ cho game.');
}

export function gameSessionEvidenceErrors(session:PlaySession,events:LearningEvent[],pack:ContentPack,requireComplete=false):string[]{
  const errors:string[]=[];
  if(!validTime(session.startedAt)||session.endedAt!==undefined&&(!validTime(session.endedAt)||session.endedAt<session.startedAt))return ['Thời gian phiên game không hợp lệ.'];
  const presentation=sessionGamePack(session,pack);
  if(pack.id!==session.packId||pack.version!==session.contentVersion||!presentation||validatePack(pack).length||validatePack(presentation).length)return ['Bộ câu hỏi không khớp phiên game.'];
  const sorted=[...events].sort((a,b)=>(a.gameSequence??0)-(b.gameSequence??0));
  const answered=new Set<string>(),solved=new Set<string>(),ids=new Set<string>();let previous=session.startedAt;
  for(const [index,event]of sorted.entries()){
    if(!event||event.gameSequence!==index+1||ids.has(event.eventId)||!event.eventId.startsWith(`${session.sessionId}:`)
      ||event.sessionId!==session.sessionId||event.packId!==pack.id||event.contentVersion!==pack.version||event.moduleId!==session.moduleId||event.moduleVersion!==session.moduleVersion
      ||(event.profileId??'default-learner')!==(session.profileId??'default-learner')||!validTime(event.occurredAt)||event.occurredAt<previous||session.endedAt!==undefined&&event.occurredAt>session.endedAt
      ||!Number.isSafeInteger(event.hintsUsed)||event.hintsUsed<0||event.hintsUsed>20||!Number.isFinite(event.elapsedMs)||event.elapsedMs<0||event.elapsedMs>14_400_000){errors.push('Thứ tự, thời gian hoặc metadata lượt chơi không khớp.');continue;}
    ids.add(event.eventId);previous=event.occurredAt;
    try{const item=pack.items.find(row=>row.id===event.itemId),outcome=scoreGameResponse(pack,session.moduleId,event.itemId,event.response,session.presentationVersion);
      if(!item||item.objectiveId!==event.objectiveId||outcome.correct!==event.correct)throw new Error('Đáp án đã bị thay đổi.');
      outcome.touchedItemIds.forEach(id=>answered.add(id));if(outcome.correct)outcome.touchedItemIds.forEach(id=>solved.add(id));
    }catch{errors.push('Câu trả lời gốc không khớp kết quả đã lưu.');}
  }
  const complete=pack.items.every(item=>(presentation.kind==='quiz'?answered:solved).has(item.id));
  if(requireComplete&&!complete)errors.push('Con cần hoàn thành tất cả câu/cặp trong bộ trước khi nhận sao.');
  return errors;
}

/** Immutable completion + ordered, host-checked answers are the only game award evidence. */
export function gameRewardAwards(evidence:GameRewardEvidence,profileId?:string,at?:string):GameReward[]{
  const packs=new Map(evidence.packs.map(pack=>[`${pack.id}@${pack.version}`,pack]));
  const eventsBySession=new Map<string,LearningEvent[]>();
  for(const event of evidence.events)if(!isLessonEvent(event)){const rows=eventsBySession.get(event.sessionId)??[];rows.push(event);eventsBySession.set(event.sessionId,rows);}
  const awards:GameReward[]=[];
  for(const session of evidence.sessions){
    if(isLearningSession(session)||session.rewardPolicyVersion!==1||session.status!=='completed'||!session.endedAt||profileId&&(session.profileId??'default-learner')!==profileId||at&&session.endedAt>at)continue;
    const pack=packs.get(`${session.packId}@${session.contentVersion}`),events=eventsBySession.get(session.sessionId)??[];
    if(!pack||!events.length||gameSessionEvidenceErrors(session,events,pack,true).length)continue;
    const first=new Map<string,boolean>();
    for(const event of [...events].sort((a,b)=>a.gameSequence!-b.gameSequence!)){
      const outcome=scoreGameResponse(pack,session.moduleId,event.itemId,event.response,session.presentationVersion);
      for(const id of outcome.touchedItemIds)if(!first.has(id))first.set(id,outcome.correct&&event.hintsUsed===0);
    }
    const firstTryCorrect=pack.items.filter(item=>first.get(item.id)).length,totalItems=pack.items.length;
    awards.push({profileId:session.profileId??'default-learner',packId:pack.id,sessionId:session.sessionId,completedAt:session.endedAt,totalItems,firstTryCorrect,starTier:firstTryCorrect===totalItems?3:firstTryCorrect*100>=totalItems*80?2:1});
  }
  return awards;
}
export function bestGameRewards(evidence:GameRewardEvidence,profileId:string,at?:string):GameReward[]{
  const best=new Map<string,GameReward>();
  for(const row of gameRewardAwards(evidence,profileId,at).sort((a,b)=>a.completedAt.localeCompare(b.completedAt)||a.sessionId.localeCompare(b.sessionId))){
    const prior=best.get(row.packId);if(!prior||row.starTier>prior.starTier)best.set(row.packId,row);
  }
  return [...best.values()];
}
export const earnedGameStars=(evidence:GameRewardEvidence,profileId:string,at?:string)=>bestGameRewards(evidence,profileId,at).reduce((sum,row)=>sum+row.starTier,0);

/** Validate the optional response in backup data before interpreting its nested values. */
export function isGameResponse(value:unknown):value is GameResponse{
  if(object(value,['kind','choiceIndex'])&&value.kind==='choice')return Number.isInteger(value.choiceIndex)&&Number(value.choiceIndex)>=0&&Number(value.choiceIndex)<=3;
  if(object(value,['kind','indices'])&&value.kind==='order')return Array.isArray(value.indices)&&value.indices.length<=15&&value.indices.every(index=>Number.isInteger(index)&&index>=0&&index<15)&&new Set(value.indices).size===value.indices.length;
  if(object(value,['kind','first','second'])&&value.kind==='pair')return [value.first,value.second].every(card=>object(card,['itemId','side'])&&typeof card.itemId==='string'&&/^[a-zA-Z0-9._:-]{1,80}$/.test(card.itemId)&&(card.side==='left'||card.side==='right'));
  return false;
}
