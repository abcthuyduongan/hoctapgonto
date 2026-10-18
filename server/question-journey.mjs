import {fail} from './online-errors.mjs';
import {initializeQuestionRewardLedger,questionRewardProgress} from '../src/core/question-rewards.ts';

/** Old wallets are preserved once; old pack stars never become stars on every question. */
export function inferJourney(weeks,awards){
  const legacy=new Map(awards.map(row=>[row.packId,row.questionLedger?.legacyStars??row.starTier??0]));
  const week=weeks.find(row=>!row.sets.every(set=>(legacy.get(set.pack.id)??0)>=2))??weeks.at(-1);
  return week?{weekId:week.id,position:week.position}:null;
}
export function journeyProgress(weeks,awards,marker){
  const rewards=new Map(awards.map(row=>[row.packId,row])),journey=marker??inferJourney(weeks,awards);
  let current=null,currentWeekSummary=null,priorSets=0;
  const progress=weeks.map((week,index)=>{
    const active=week.id===journey?.weekId,closed=!!journey&&week.position<journey.position;
    const sets=week.sets.map(set=>{
      const reward=rewards.get(set.pack.id),ids=set.pack.questionIds??set.pack.items?.map(item=>item.id)??[],ledger=reward?.questionLedger;
      const questionProgress=questionRewardProgress({id:set.pack.id,items:ids.map(id=>({id}))},ledger??initializeQuestionRewardLedger(set.pack.id,reward?.starTier??0));
      return{...set,stars:questionProgress.bestTier,done:questionProgress.done,questionProgress};
    });
    const counts=sets.reduce((sum,set)=>{for(const key of ['total','zero','one','two','three'])sum[key]+=set.questionProgress[key];return sum;},{total:0,zero:0,one:0,two:0,three:0});
    const done=counts.total>0&&counts.zero===0&&counts.one===0;
    if(active){const next=sets.find(set=>!set.done)??sets[0];if(next)current={weekId:week.id,weekTitle:week.title,...next};currentWeekSummary={weekId:week.id,title:week.title,position:week.position,cursor:String(priorSets),...counts,ready:done,hasNext:index<weeks.length-1,...(weeks[index+1]?{nextWeekId:weeks[index+1].id,nextWeekTitle:weeks[index+1].title}:{})};}priorSets+=sets.length;
    return{...week,sets,done,unlocked:active,current:active,closed,ready:done};
  });
  return{weeks:progress,current,currentWeekSummary,journey};
}
/** Explicit review keeps immutable source IDs and adds a matching anchor when needed. */
export function selectReviewItems(inputIds,source,presentation){
  if(inputIds===undefined)return source.items.map(item=>item.id);
  if(!Array.isArray(inputIds)||inputIds.length<1||inputIds.length>30||new Set(inputIds).size!==inputIds.length||inputIds.some(value=>typeof value!=='string'||!source.items.some(item=>item.id===value)))fail(400,'Danh sách câu cần học lại không hợp lệ.');
  const selected=source.items.filter(item=>inputIds.includes(item.id)).map(item=>item.id);
  if(presentation.kind==='pairs'&&selected.length===1){const anchor=source.items.find(item=>!selected.includes(item.id));if(!anchor)fail(400,'Trò ghép cặp cần ít nhất hai câu.');selected.push(anchor.id);}
  return selected;
}
export function filterPlayPresentation(session,source,presentation){
  if(!presentation)fail(400,'Dạng câu của bộ này chưa phù hợp với trò chơi đã chọn.');
  if(session.rewardPolicyVersion!==2||!session.requiredItemIds)return presentation;
  const selected=new Set(session.requiredItemIds);return{...presentation,items:presentation.items.filter(item=>selected.has(item.id))};
}
export function timedQuestion(session,presentation){return(session.rewardPolicyVersion===2||session.questionProtocolVersion===1)&&['quiz','learning'].includes(presentation.kind);}
