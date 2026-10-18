import type {ContentPack,LearningEvent,ModuleId,PlaySession} from './contracts.ts';
import type {GameReward} from './game-rewards.ts';
import {gameRewardAwards,gameSessionEvidenceErrors,scoreGameResponse} from './game-rewards.ts';
import {gamePresentation} from './game-presentation.ts';
import {normalizedNumber,normalizedWord} from './rich-content.ts';
import {validatePack} from './validation.ts';
import {gameAllowedByAuthor} from './game-policy.ts';

/** Rich exercises use the question island; matching and ordering retain their native hosts. */
export function onlinePresentation(moduleId:ModuleId,pack:ContentPack):ContentPack|undefined{
  if(!gameAllowedByAuthor(moduleId,pack))return;
  return pack.kind==='learning'?(moduleId==='math-quest'?pack:undefined):gamePresentation(moduleId,pack);
}

function responseObject(value:unknown,allowed:string[]):value is Record<string,unknown>{
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  if(![Object.prototype,null].includes(Object.getPrototypeOf(value)))return false;
  return Reflect.ownKeys(value).every(key=>{
    const descriptor=Object.getOwnPropertyDescriptor(value,key);
    return typeof key==='string'&&allowed.includes(key)&&!!descriptor&&'value'in descriptor&&descriptor.enumerable;
  });
}
const rawText=(value:unknown):value is string=>typeof value==='string'&&value.length<=120&&!!value.trim()
  &&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value);
const validTime=(value:unknown):value is string=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;

/** The server scores a raw answer against its pinned pack, never a caller's correct flag. */
export function onlineScoreResponse(pack:ContentPack,moduleId:ModuleId,itemId:string,response:unknown):{correct:boolean;touchedItemIds:string[]}{
  if(pack.kind!=='learning')return scoreGameResponse(pack,moduleId,itemId,response,1);
  if(moduleId!=='math-quest')throw new Error('Dạng bài mở rộng chỉ dùng trong đảo câu hỏi.');
  const item=pack.items.find(row=>row.id===itemId);
  if(!item)throw new Error('Câu trả lời không thuộc bộ câu hỏi đang chơi.');
  if((item.kind==='reading-choice'||item.kind==='listening-choice')
    &&responseObject(response,['kind','choiceIndex'])&&response.kind==='choice'
    &&Number.isInteger(response.choiceIndex)&&Number(response.choiceIndex)>=0&&Number(response.choiceIndex)<=3){
    return{correct:response.choiceIndex===item.correctIndex,touchedItemIds:[itemId]};
  }
  if((item.kind==='numeric-answer'||item.kind==='fill-blank'||item.kind==='listening-gap')
    &&responseObject(response,['kind','value'])&&response.kind==='text'&&rawText(response.value)){
    if(item.kind==='numeric-answer'){
      const value=normalizedNumber(response.value);
      if(value===undefined)throw new Error('Câu trả lời số cần dùng chữ số, dấu thập phân và dấu âm/dương hợp lệ.');
      return{correct:value===normalizedNumber(item.answer),touchedItemIds:[itemId]};
    }
    return{correct:item.acceptedAnswers.some(answer=>normalizedWord(answer,item.caseSensitive)===normalizedWord(response.value as string,item.caseSensitive)),touchedItemIds:[itemId]};
  }
  throw new Error('Thiếu câu trả lời gốc hoặc câu trả lời không đúng dạng bài.');
}

/** Check committed evidence using server identity, exact content version, order and clock. */
export function onlineEvidenceErrors(session:PlaySession,events:LearningEvent[],pack:ContentPack,requireComplete=false):string[]{
  if(pack.kind!=='learning')return gameSessionEvidenceErrors(session,events,pack,requireComplete);
  if(!validTime(session.startedAt)||session.endedAt!==undefined&&(!validTime(session.endedAt)||session.endedAt<session.startedAt))return['Thời gian phiên game không hợp lệ.'];
  try{
    if(pack.id!==session.packId||pack.version!==session.contentVersion||!onlinePresentation(session.moduleId,pack)||validatePack(pack).length)return['Bộ câu hỏi không khớp phiên game.'];
  }catch{return['Bộ câu hỏi không khớp phiên game.'];}
  const errors:string[]=[],answered=new Set<string>(),ids=new Set<string>();
  const sorted=[...events].sort((a,b)=>(a?.gameSequence??0)-(b?.gameSequence??0));
  let previous=session.startedAt;
  for(const[index,event]of sorted.entries()){
    if(!event||event.gameSequence!==index+1||typeof event.eventId!=='string'||ids.has(event.eventId)||!event.eventId.startsWith(`${session.sessionId}:`)
      ||event.sessionId!==session.sessionId||event.packId!==pack.id||event.contentVersion!==pack.version||event.moduleId!==session.moduleId||event.moduleVersion!==session.moduleVersion
      ||(event.profileId??'default-learner')!==(session.profileId??'default-learner')||!validTime(event.occurredAt)||event.occurredAt<previous||session.endedAt!==undefined&&event.occurredAt>session.endedAt
      ||!Number.isSafeInteger(event.hintsUsed)||event.hintsUsed<0||event.hintsUsed>20||!Number.isFinite(event.elapsedMs)||event.elapsedMs<0||event.elapsedMs>14_400_000){
      errors.push('Thứ tự, thời gian hoặc metadata lượt chơi không khớp.');continue;
    }
    ids.add(event.eventId);previous=event.occurredAt;
    try{
      const item=pack.items.find(row=>row.id===event.itemId),outcome=onlineScoreResponse(pack,session.moduleId,event.itemId,event.response);
      if(!item||event.objectiveId!==item.objectiveId||event.correct!==outcome.correct)throw new Error('Kết quả không khớp câu trả lời gốc.');
      answered.add(event.itemId);
    }catch{errors.push('Câu trả lời gốc không khớp kết quả đã lưu.');}
  }
  if(requireComplete&&pack.items.some(item=>!answered.has(item.id)))errors.push('Con cần trả lời tất cả câu trong bộ trước khi nhận sao.');
  return errors;
}

/** A session earns one tier; the store keeps only the highest tier per original pack. */
export function onlineAward(session:PlaySession,events:LearningEvent[],pack:ContentPack):GameReward|undefined{
  if(pack.kind!=='learning')return gameRewardAwards({sessions:[session],events,packs:[pack]},session.profileId??'default-learner')[0];
  if(session.rewardPolicyVersion!==1||session.status!=='completed'||!session.endedAt||onlineEvidenceErrors(session,events,pack,true).length)return;
  const first=new Map<string,boolean>();
  for(const event of[...events].sort((a,b)=>a.gameSequence!-b.gameSequence!)){
    if(!first.has(event.itemId))first.set(event.itemId,event.correct&&event.hintsUsed===0);
  }
  const totalItems=pack.items.length,firstTryCorrect=pack.items.filter(item=>first.get(item.id)).length;
  return{profileId:session.profileId??'default-learner',packId:pack.id,sessionId:session.sessionId,completedAt:session.endedAt,totalItems,firstTryCorrect,
    starTier:firstTryCorrect===totalItems?3:firstTryCorrect*100>=totalItems*80?2:1};
}
