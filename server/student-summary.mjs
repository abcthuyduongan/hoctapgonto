import {fail} from './online-errors.mjs';
import {publicSession,safePresentation} from './question-protocol.mjs';
/** Shared metadata-only journey. No question body, media catalogue or passage is retained. */
export function packSummary(pack){return{id:pack.id,version:pack.version,title:pack.title,kind:pack.kind,subject:pack.subject,grade:pack.grade,itemCount:pack.items.length};}
export function compactPlay(play){return{session:play.session.questionProtocolVersion===1?publicSession(play.session):play.session,pack:packSummary(play.pack),presentation:play.session.questionProtocolVersion===1?safePresentation(play.presentation):play.presentation};}
export function summaryWeeks(rows){
  const weeks=new Map();for(const row of rows){if(!weeks.has(row.week_id))weeks.set(row.week_id,{id:row.week_id,classId:row.class_id,title:row.week_title,position:row.week_position,createdAt:row.created_at,sets:[]});if(row.summary)weeks.get(row.week_id).sets.push({pack:typeof row.summary==='string'?JSON.parse(row.summary):row.summary,subjectLabel:row.subject_label,games:[]});}return[...weeks.values()];
}
export function summaryProgress(weeks,awards){
  const stars=new Map(awards.map(row=>[row.packId,row.starTier]));let previous=true,current=null;
  const progress=weeks.map(week=>{const sets=week.sets.map(set=>({...set,stars:stars.get(set.pack.id)??0,done:(stars.get(set.pack.id)??0)>=2})),done=sets.every(set=>set.done),unlocked=previous;
    if(unlocked&&!current){const next=sets.find(set=>!set.done);if(next)current={weekId:week.id,weekTitle:week.title,...next};}previous=previous&&done;return{...week,sets,done,unlocked};});
  return{weeks:progress,current};
}
export function summaryPage(progress,cursor='0'){
  if(cursor==='current')cursor=progress.currentWeekSummary?.cursor??'0';
  if(typeof cursor!=='string'||! /^(0|[1-9]\d{0,6})$/.test(cursor))fail(400,'Trang hành trình không hợp lệ.');
  const offset=Number(cursor),totalSets=progress.weeks.reduce((n,w)=>n+w.sets.length,0);if(offset>totalSets)fail(400,'Hành trình đã thay đổi. Hãy làm mới tiến độ.');
  let index=0;const weeks=progress.weeks.flatMap(week=>{const sets=week.sets.filter(()=>{const selected=index>=offset&&index<offset+20;index++;return selected;});return sets.length?[{...week,sets}]:[];});
  const publicSet=set=>{const{questionIds,...pack}=set.pack;void questionIds;return{...set,pack};};
  return{...progress,weeks:weeks.map(week=>({...week,sets:week.sets.map(publicSet)})),current:progress.current?publicSet(progress.current):null,page:{cursor,nextCursor:offset+20<totalSets?String(offset+20):null,totalSets,totalWeeks:progress.weeks.length,limit:20}};
}
