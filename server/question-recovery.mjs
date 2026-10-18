import {fail} from './online-errors.mjs';
import {onlineAward,onlineEvidenceErrors,onlinePresentation,onlineScoreResponse} from '../src/core/online-exercises.ts';
import {initializeQuestionRewardLedger,applyQuestionRewardCandidates,questionRewardCandidates,questionRewardProgress,v2QuestionCompletionErrors} from '../src/core/question-rewards.ts';
import {inferJourney} from './question-journey.mjs';
import {protocolEvidenceErrors} from './question-protocol.mjs';

const key=(...values)=>JSON.stringify(values);
const canonical=value=>JSON.stringify(value,(_key,row)=>row&&typeof row==='object'&&!Array.isArray(row)?Object.fromEntries(Object.entries(row).sort(([a],[b])=>a.localeCompare(b))):row);
const validTime=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
const bad=message=>fail(400,message);

/** Rebuild every credit from pinned raw responses. Active and abandoned sessions
 * keep their already committed question credits; completion creates no second credit. */
export function inspectQuestionRewardEvidence(db,packs,events){
  const actions=[],legacyBest=new Map(),legacyBySession=new Map(),sessions=[];let activePlays=0;
  for(const row of db.prepare('SELECT rowid AS storage_order,id,workspace_id,student_id,json FROM plays ORDER BY rowid').iterate()){
    const session=JSON.parse(row.json),pack=packs.get(key(row.workspace_id,session.packId,session.contentVersion)),rows=events.get(key(row.workspace_id,row.id))??[];
    if(session.sessionId!==row.id||session.profileId!==row.student_id||![1,2].includes(session.rewardPolicyVersion)||!['active','completed','abandoned'].includes(session.status)||!pack||onlineEvidenceErrors(session,rows,pack,session.status==='completed'&&session.rewardPolicyVersion===1).length)bad('Phiên chơi hoặc đáp án trong bản sao không hợp lệ.');
    if(protocolEvidenceErrors(session,pack,rows).length)bad('Giao thức câu hỏi, biên nhận gợi ý hoặc âm thanh trong bản sao không hợp lệ.');
    if(session.status==='active')activePlays++;
    const owner=key(row.workspace_id,row.student_id),sourceKey=key(row.workspace_id,row.student_id,pack.id);sessions.push({...row,session,pack,events:rows});
    if(session.rewardPolicyVersion===1){
      const award=onlineAward(session,rows,pack);if(award){const previous=legacyBest.get(sourceKey);if(!previous||award.starTier>previous.starTier)legacyBest.set(sourceKey,award);legacyBySession.set(key(row.workspace_id,row.id),award);const auditOrder=db.prepare("SELECT rowid AS n FROM audit WHERE workspace_id=? AND action='play.complete' AND target_id=? ORDER BY rowid LIMIT 1").get(row.workspace_id,row.id)?.n??0;actions.push({owner,sourceKey,pack,at:award.completedAt,kind:'legacy',award,order:row.storage_order,auditOrder});}
      continue;
    }
    if(!session.requiredItemIds||!session.journeyWeekId||!session.questionClocks||typeof session.questionClocks!=='object'||Array.isArray(session.questionClocks))bad('Lượt chơi sao từng câu thiếu mã tuần, phạm vi câu hỏi hoặc đồng hồ.');
    const presentation=onlinePresentation(session.moduleId,pack),timed=['quiz','learning'].includes(presentation?.kind);
    for(const [itemId,at]of Object.entries(session.questionClocks))if(!timed||!session.requiredItemIds.includes(itemId)||!validTime(at)||at<session.startedAt||session.endedAt&&at>session.endedAt)bad('Đồng hồ câu hỏi trong bản sao không hợp lệ.');
    for(const event of rows){
      if(timed){const clock=Object.hasOwn(session.questionClocks,event.itemId)&&session.questionClocks[event.itemId];if(!clock||event.elapsedMs!==Date.parse(event.occurredAt)-Date.parse(clock))bad('Thời gian trả lời không khớp đồng hồ câu hỏi đã lưu.');}
      else if(event.elapsedMs!==0)bad('Trò ghép hoặc xếp không được dùng thời gian do thiết bị gửi lên để tính sao.');
    }
    // The end time still bounds the raw events when treating an exited session as active.
    const historical={...session,status:session.status==='abandoned'?'active':session.status};
    const candidates=questionRewardCandidates(historical,rows,pack);
    if(v2QuestionCompletionErrors({...historical,status:'completed'},rows,pack).length&&session.status==='completed')bad('Lượt chơi từng câu chưa trả lời đúng đầy đủ các câu đã chọn.');
    // Validate subsets even when no correct response exists yet.
    const required=session.requiredItemIds;if(!Array.isArray(required)||required.length<1||required.length>30||new Set(required).size!==required.length||required.some(id=>!pack.items.some(item=>item.id===id)))bad('Phạm vi câu hỏi học lại không hợp lệ.');
    if(rows.some(event=>onlineScoreResponse(pack,session.moduleId,event.itemId,event.response).touchedItemIds.some(itemId=>!required.includes(itemId))))bad('Câu trả lời nằm ngoài phạm vi học lại.');
    for(const event of rows.filter(event=>event.correct))actions.push({owner,sourceKey,pack,session,event,at:event.occurredAt,kind:'question',candidates:candidates.filter(candidate=>candidate.eventId===event.eventId),order:row.storage_order+event.gameSequence/10000});
  }
  actions.sort((a,b)=>a.at.localeCompare(b.at)||a.order-b.order);
  const expected=new Map(),timelines=new Map();
  for(const action of actions){
    const prior=expected.get(action.sourceKey),initial=prior?.questionLedger??initializeQuestionRewardLedger(action.pack.id,0),result=applyQuestionRewardCandidates(initial,action.kind==='question'?action.candidates:[],action.kind==='legacy'?action.award.starTier:initial.legacyStars);
    if(action.kind==='question'&&canonical(initial)===canonical(result.ledger))continue;
    const base=action.kind==='legacy'?action.award:prior??{profileId:action.session.profileId,packId:action.pack.id,sessionId:action.session.sessionId,completedAt:action.event.occurredAt,totalItems:action.pack.items.length,firstTryCorrect:0};
    const value={...base,starTier:Math.max(1,questionRewardProgress(action.pack,result.ledger).bestTier),questionLedger:result.ledger};expected.set(action.sourceKey,value);
    const timeline=timelines.get(action.owner)??[];timeline.push({at:action.at,gained:result.gained});timelines.set(action.owner,timeline);
  }
  const earned=new Map();let awardRows=0;
  for(const row of db.prepare('SELECT workspace_id,student_id,pack_id,tier,json FROM awards').iterate()){
    const sourceKey=key(row.workspace_id,row.student_id,row.pack_id),award=JSON.parse(row.json),wanted=expected.get(sourceKey);let stars;
    if(award.questionLedger){if(!wanted||row.tier!==wanted.starTier||canonical(award)!==canonical(wanted))bad('Sổ sao từng câu không khớp đáp án và thời gian đã lưu.');stars=wanted.questionLedger.earnedStars;}
    else{const old=legacyBest.get(sourceKey),pinned=legacyBySession.get(key(row.workspace_id,award.sessionId));if(!old||row.tier!==old.starTier||canonical(pinned)!==canonical(award)||wanted&&Object.keys(wanted.questionLedger.questionTiers).length)bad('Số sao không khớp bằng chứng học tập trong bản sao.');stars=row.tier;}
    const owner=key(row.workspace_id,row.student_id);earned.set(owner,(earned.get(owner)??0)+stars);awardRows++;
  }
  if(awardRows!==expected.size)bad('Bản sao thiếu sổ sao đã được xác nhận.');
  validateJourneyAudit(db,packs,actions,sessions);
  return{earned,timelines,activePlays};
}

function validateJourneyAudit(db,packs,actions,sessions){
  const grouped=new Map();
  for(const row of db.prepare("SELECT rowid AS storage_order,* FROM audit WHERE action IN ('student.journey.init','student.journey.advance') ORDER BY at,rowid").iterate()){
    let marker;try{marker=JSON.parse(row.target_id);}catch{bad('Mốc hành trình không đọc được.');}
    const student=db.prepare('SELECT * FROM students WHERE workspace_id=? AND id=?').get(row.workspace_id,marker.studentId),cls=db.prepare('SELECT id FROM classes WHERE workspace_id=? AND id=?').get(row.workspace_id,marker.classId);
    if(!student||student.user_id!==row.user_id||!cls||!validTime(row.at)||typeof marker.weekId!=='string'||!Number.isSafeInteger(marker.position)||marker.position<1)bad('Mốc hành trình không thuộc học sinh, lớp hoặc tuần hợp lệ.');
    const weeks=db.prepare('SELECT id,position FROM weeks WHERE workspace_id=? AND class_id=? AND created_at<=? ORDER BY position').all(row.workspace_id,marker.classId,row.at),week=weeks.find(week=>week.id===marker.weekId);
    if(!week||week.position!==marker.position)bad('Mốc tuần không khớp thứ tự học.');
    const owner=key(row.workspace_id,student.id),groupKey=key(row.workspace_id,student.id,marker.classId),history=grouped.get(groupKey)??[];
    const before=actions.filter(action=>action.owner===owner&&(action.at<row.at||action.at===row.at&&(action.kind!=='legacy'||action.auditOrder<row.storage_order))),ledgerByPack=new Map();for(const action of before){const old=ledgerByPack.get(action.pack.id)??initializeQuestionRewardLedger(action.pack.id);ledgerByPack.set(action.pack.id,applyQuestionRewardCandidates(old,action.kind==='question'?action.candidates:[],action.kind==='legacy'?action.award.starTier:old.legacyStars).ledger);}
    if(row.action==='student.journey.init'){
      if(history.length)bad('Hành trình bị khởi tạo lại sau khi đã được chốt.');
      const initialWeeks=weeks.map(week=>({...week,sets:db.prepare('SELECT pack_id FROM week_sets WHERE workspace_id=? AND week_id=? ORDER BY position').all(row.workspace_id,week.id).map(set=>({pack:{id:set.pack_id}}))}));
      const legacy=[...ledgerByPack.values()].map(ledger=>({packId:ledger.packId,starTier:ledger.legacyStars})),expected=inferJourney(initialWeeks,legacy);if(expected?.weekId!==marker.weekId)bad('Tuần khởi tạo không khớp tiến độ cũ đã được xác nhận.');
    }else{
      const previous=history.at(-1),from=weeks.findIndex(week=>week.id===marker.fromWeekId);
      if(!previous||previous.marker.weekId!==marker.fromWeekId||weeks[from+1]?.id!==marker.weekId||typeof marker.requestId!=='string'||!marker.requestId.length||marker.requestId.length>100||history.some(entry=>entry.marker.requestId===marker.requestId))bad('Chuyển tuần bị lặp, quay lại hoặc bỏ qua một tuần.');
      const assigned=db.prepare('SELECT pack_id FROM week_sets WHERE workspace_id=? AND week_id=? ORDER BY position').all(row.workspace_id,marker.fromWeekId).map(set=>set.pack_id),mastered=marker.masteredPacks;
      if(!Array.isArray(mastered)||!mastered.length||mastered.length!==assigned.length||new Set(mastered.map(set=>set.packId)).size!==assigned.length||mastered.some(set=>!assigned.includes(set.packId)||!Number.isSafeInteger(set.contentVersion)))bad('Mốc chuyển tuần thiếu phiên bản các bộ đã hoàn thành.');
      for(const set of mastered){const pack=packs.get(key(row.workspace_id,set.packId,set.contentVersion)),ledger=ledgerByPack.get(set.packId)??initializeQuestionRewardLedger(set.packId);if(!pack||!questionRewardProgress(pack,ledger).done)bad('Có câu hỏi chưa đạt 2 sao tại thời điểm chuyển tuần.');}
    }
    history.push({row,marker});grouped.set(groupKey,history);
  }
  for(const {workspace_id,student_id,session,events}of sessions){if(session.rewardPolicyVersion!==2)continue;
    const matching=[...grouped.entries()].filter(([value])=>{const [workspace,student]=JSON.parse(value);return workspace===workspace_id&&student===student_id;}).flatMap(([,history])=>history).filter(entry=>entry.marker.weekId===session.journeyWeekId);
    const started=matching.find(entry=>entry.row.at<=session.startedAt);if(!started)bad('Lượt chơi từng câu không có tuần hiện tại được mở hợp lệ.');
    const group=grouped.get(key(workspace_id,student_id,started.marker.classId)),closed=group.find(entry=>entry.marker.fromWeekId===session.journeyWeekId);
    if(closed&&events.some(event=>event.occurredAt>closed.row.at))bad('Có câu trả lời được ghi nhận sau khi tuần đã đóng.');
  }
}
