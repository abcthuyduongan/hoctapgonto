import type {ContentPack,LearningEvent,ModuleId,PlaySession} from './contracts.ts';
import {onlineEvidenceErrors,onlineScoreResponse} from './online-exercises.ts';

export type QuestionStarTier=0|1|2|3;
export type QuestionRewardRule='speed'|'pair-mistakes'|'order-mistakes';
export type QuestionRewardThresholds={threeStarMs:number;twoStarMs:number;clockStartsAfterAudio:boolean};
export type QuestionRewardCandidate={
  policyVersion:2;packId:string;itemId:string;sourceKey:string;starTier:1|2|3;
  sessionId:string;eventId:string;moduleId:ModuleId;gameSequence:number;occurredAt:string;
  mistakes:number;hintsUsed:number;elapsedMs:number;effectiveElapsedMs:number;rule:QuestionRewardRule;
};
/** One ledger per original pack and learner. Game and content version are absent. */
export type QuestionRewardLedger={
  policyVersion:2;packId:string;legacyStars:number;
  questionTiers:Record<string,QuestionStarTier>;earnedStars:number;
};
export type QuestionRewardProgress={
  total:number;zero:number;one:number;two:number;three:number;done:boolean;
  bestTier:QuestionStarTier;earnedStars:number;questions:{itemId:string;tier:QuestionStarTier}[];
};

const tier=(value:unknown):value is QuestionStarTier=>Number.isInteger(value)&&Number(value)>=0&&Number(value)<=3;
const legacy=(value:number)=>{
  if(!Number.isSafeInteger(value)||value<0||value>3)throw new RangeError('Legacy pack stars must be from zero to three.');
  return value;
};
const validId=(value:string)=>typeof value==='string'&&value.length>0&&value.length<=80;

/** JSON tuple encoding avoids collisions when an author uses ':' in an ID. */
export function questionRewardSourceKey(packId:string,itemId:string):string {
  if(!validId(packId)||!validId(itemId))throw new TypeError('A reward needs its original pack and question IDs.');
  return JSON.stringify([packId,itemId]);
}

/** Shared policy constants for explanatory UI and authoritative server clocks.
 * Listening clocks must be opened by the server after the required audio ends. */
export function questionRewardThresholds(item:ContentPack['items'][number]):QuestionRewardThresholds {
  if(item.kind==='listening-choice'||item.kind==='listening-gap')return{threeStarMs:30_000,twoStarMs:60_000,clockStartsAfterAudio:true};
  if(item.kind==='reading-choice')return{threeStarMs:90_000,twoStarMs:180_000,clockStartsAfterAudio:false};
  if(item.kind==='numeric-answer'||item.kind==='fill-blank')return{threeStarMs:45_000,twoStarMs:90_000,clockStartsAfterAudio:false};
  return{threeStarMs:30_000,twoStarMs:60_000,clockStartsAfterAudio:false};
}

export function questionRewardRule(moduleId:ModuleId):QuestionRewardRule {
  if(moduleId==='memory-match'||moduleId==='word-connect')return'pair-mistakes';
  if(moduleId==='sentence-builder'||moduleId==='sequence-trail')return'order-mistakes';
  return'speed';
}

function requiredQuestionErrors(session:PlaySession,source:ContentPack):string[] {
  if(session.requiredItemIds===undefined)return[];
  const ids=session.requiredItemIds,known=new Set(source.items.map(item=>item.id));
  if(!Array.isArray(ids)||ids.length<1||ids.length>30||new Set(ids).size!==ids.length||ids.some(itemId=>typeof itemId!=='string'||!known.has(itemId)))
    return['Danh sách câu cần ôn phải có 1–30 mã câu khác nhau thuộc bộ nguồn.'];
  return[];
}

function rewardEvidenceErrors(session:PlaySession,events:LearningEvent[],source:ContentPack):string[] {
  const errors=[...requiredQuestionErrors(session,source),...onlineEvidenceErrors(session,events,source)];
  if(errors.length||session.requiredItemIds===undefined)return errors;
  const required=new Set(session.requiredItemIds);
  if(events.some(event=>onlineScoreResponse(source,session.moduleId,event.itemId,event.response).touchedItemIds.some(itemId=>!required.has(itemId))))
    errors.push('Câu trả lời không thuộc các câu được chọn cho lượt ôn này.');
  return errors;
}

/** A retry session can require a subset while its pinned source stays complete.
 * Every required question must have a real correct response, including quizzes. */
export function v2QuestionCompletionErrors(session:PlaySession,events:LearningEvent[],source:ContentPack):string[] {
  if(session.rewardPolicyVersion!==2)return['Lượt chơi không dùng chính sách sao từng câu phiên bản 2.'];
  if(!['active','completed'].includes(session.status))return['Lượt chơi đã thoát hoặc không còn hoạt động.'];
  const errors=rewardEvidenceErrors(session,events,source);if(errors.length)return errors;
  const solved=new Set<string>();
  for(const event of events){const outcome=onlineScoreResponse(source,session.moduleId,event.itemId,event.response);if(outcome.correct)outcome.touchedItemIds.forEach(itemId=>solved.add(itemId));}
  const required=session.requiredItemIds??source.items.map(item=>item.id);
  if(required.some(itemId=>!solved.has(itemId)))errors.push('Con cần trả lời đúng tất cả câu được chọn trước khi hoàn tất lượt chơi.');
  return errors;
}

/** Only validated, committed, raw responses can produce candidates. A caller must
 * replace elapsedMs with its persisted question clock before passing events here.
 * Returning every first-correct candidate makes retries safe; the ledger keeps max.
 * Completion of the whole pack is deliberately not required by policy version 2. */
export function questionRewardCandidates(session:PlaySession,events:LearningEvent[],source:ContentPack):QuestionRewardCandidate[] {
  if(session.rewardPolicyVersion!==2||!['active','completed'].includes(session.status)
    ||rewardEvidenceErrors(session,events,source).length)return[];
  const items=new Map(source.items.map(item=>[item.id,item])),solved=new Set<string>();
  const mistakes=new Map<string,number>(),hints=new Map<string,number>(),candidates:QuestionRewardCandidate[]=[];
  const rule=questionRewardRule(session.moduleId);
  for(const event of [...events].sort((a,b)=>a.gameSequence!-b.gameSequence!)){
    // Score again from the pinned source rather than trusting an outcome flag.
    const outcome=onlineScoreResponse(source,session.moduleId,event.itemId,event.response);
    const touched=[...new Set(outcome.touchedItemIds)];
    for(const itemId of touched){
      if(solved.has(itemId))continue;
      hints.set(itemId,Math.max(hints.get(itemId)??0,event.hintsUsed));
      if(!outcome.correct){mistakes.set(itemId,(mistakes.get(itemId)??0)+1);continue;}
      solved.add(itemId);
      const item=items.get(itemId)!;const wrong=mistakes.get(itemId)??0,usedHints=hints.get(itemId)??0;
      const effectiveElapsedMs=event.elapsedMs+wrong*15_000+usedHints*30_000;
      const limits=questionRewardThresholds(item);
      const starTier:1|2|3=rule==='speed'?(effectiveElapsedMs<=limits.threeStarMs?3:effectiveElapsedMs<=limits.twoStarMs?2:1)
        :Math.max(1,3-wrong-(rule==='order-mistakes'?usedHints:0)) as 1|2|3;
      candidates.push({policyVersion:2,packId:source.id,itemId,sourceKey:questionRewardSourceKey(source.id,itemId),starTier,
        sessionId:session.sessionId,eventId:event.eventId,moduleId:session.moduleId,gameSequence:event.gameSequence!,occurredAt:event.occurredAt,
        mistakes:wrong,hintsUsed:usedHints,elapsedMs:event.elapsedMs,effectiveElapsedMs,rule});
    }
  }
  return candidates;
}

export function initializeQuestionRewardLedger(packId:string,legacyStars=0):QuestionRewardLedger {
  if(!validId(packId))throw new TypeError('A reward ledger needs its original pack ID.');
  return{policyVersion:2,packId,legacyStars:legacy(legacyStars),questionTiers:{},earnedStars:legacyStars};
}

function canonicalLedger(ledger:QuestionRewardLedger):QuestionRewardLedger {
  if(ledger?.policyVersion!==2||!validId(ledger.packId)||!ledger.questionTiers||typeof ledger.questionTiers!=='object'||Array.isArray(ledger.questionTiers))
    throw new TypeError('Question reward ledger is invalid.');
  const entries=Object.entries(ledger.questionTiers);
  if(entries.some(([itemId,value])=>!validId(itemId)||!tier(value)))throw new TypeError('Question reward tiers must be from zero to three.');
  const legacyStars=legacy(ledger.legacyStars),questionTiers=Object.fromEntries(entries) as Record<string,QuestionStarTier>;
  return{policyVersion:2,packId:ledger.packId,legacyStars,questionTiers,earnedStars:Math.max(legacyStars,entries.reduce((sum,[,value])=>sum+value,0))};
}

/** Apply under the store's learner/pack transaction. Replays, simultaneous games,
 * repeated receipts and content versions never add more than a question's max.
 * The legacy pool preserves already-earned wallet stars without inventing tiers. */
export function applyQuestionRewardCandidates(ledger:QuestionRewardLedger,candidates:readonly QuestionRewardCandidate[],legacyStars=ledger.legacyStars):{ledger:QuestionRewardLedger;gained:number} {
  const next=canonicalLedger(ledger),before=next.earnedStars;
  next.legacyStars=Math.max(next.legacyStars,legacy(legacyStars));
  for(const candidate of candidates){
    if(candidate.policyVersion!==2||candidate.packId!==next.packId||!validId(candidate.itemId)
      ||candidate.sourceKey!==questionRewardSourceKey(next.packId,candidate.itemId)||!tier(candidate.starTier)||Number(candidate.starTier)===0)
      throw new TypeError('Question reward candidate does not belong to this source.');
    const prior=Object.hasOwn(next.questionTiers,candidate.itemId)?next.questionTiers[candidate.itemId]:0;
    // defineProperty also handles an author ID such as '__proto__' as ordinary data.
    Object.defineProperty(next.questionTiers,candidate.itemId,{value:Math.max(prior,candidate.starTier),enumerable:true,writable:true,configurable:true});
  }
  next.earnedStars=Math.max(next.legacyStars,Object.values(next.questionTiers).reduce<number>((sum,value)=>sum+value,0));
  return{ledger:next,gained:next.earnedStars-before};
}

export function earnedQuestionRewardStars(rewards:readonly {starTier:number;questionLedger?:QuestionRewardLedger}[]):number {
  return rewards.reduce((sum,reward)=>sum+(reward.questionLedger?canonicalLedger(reward.questionLedger).earnedStars:reward.starTier),0);
}

/** Week mastery uses every current source question, independently of legacy cash. */
export function questionRewardProgress(source:Pick<ContentPack,'id'|'items'>,ledger:QuestionRewardLedger):QuestionRewardProgress {
  const value=canonicalLedger(ledger);if(source.id!==value.packId)throw new TypeError('Question progress does not belong to this source.');
  const questions=source.items.map(item=>({itemId:item.id,tier:Object.hasOwn(value.questionTiers,item.id)?value.questionTiers[item.id]:0 as QuestionStarTier}));
  const counts=[0,0,0,0];for(const question of questions)counts[question.tier]++;
  const bestTier=(questions.length?Math.min(...questions.map(question=>question.tier)):0) as QuestionStarTier;
  return{total:questions.length,zero:counts[0],one:counts[1],two:counts[2],three:counts[3],done:questions.length>0&&bestTier>=2,bestTier,earnedStars:value.earnedStars,questions};
}
