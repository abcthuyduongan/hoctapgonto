import {randomUUID} from 'node:crypto';
import {fail} from './online-errors.mjs';
import {onlinePresentation} from '../src/core/online-exercises.ts';
import {questionRewardThresholds} from '../src/core/question-rewards.ts';

export const isTimedPresentation=pack=>['quiz','learning'].includes(pack.kind);
const mediaView=media=>media?{...(media.imageId?{imageId:media.imageId,imageAlt:media.imageAlt??''}:{}),...(media.audioId?{audioId:media.audioId}:{})}:undefined;

/**
 * Pure shuffling algorithm for multiple choice options.
 * Guarantees that the new correct position is strictly distinct from lastCorrectPosition (for n >= 2).
 * Does not use a fixed predictable cycle (e.g. A->B->C->D).
 * Preserves correct option content and remaining option contents.
 */
export function shuffleQuestionOptions(options, correctIndex, lastCorrectPosition = null, rng = Math.random) {
  const n = options?.length ?? 0;
  if (!Array.isArray(options) || !Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= n || n < 2) {
    return {
      shuffledOptions: Array.isArray(options) ? [...options] : [],
      permutation: Array.isArray(options) ? options.map((_, i) => i) : [],
      displayedCorrectIndex: correctIndex ?? 0
    };
  }

  let allowedPositions = Array.from({length: n}, (_, i) => i);
  if (lastCorrectPosition !== null && Number.isInteger(lastCorrectPosition) && lastCorrectPosition >= 0 && lastCorrectPosition < n) {
    const filtered = allowedPositions.filter(p => p !== lastCorrectPosition);
    if (filtered.length > 0) {
      allowedPositions = filtered;
    }
  }

  const targetIdx = Math.floor(rng() * allowedPositions.length);
  const displayedCorrectIndex = allowedPositions[targetIdx];

  const otherPositions = Array.from({length: n}, (_, i) => i).filter(p => p !== displayedCorrectIndex);
  const otherOriginalIndices = Array.from({length: n}, (_, i) => i).filter(i => i !== correctIndex);

  for (let i = otherOriginalIndices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = otherOriginalIndices[i];
    otherOriginalIndices[i] = otherOriginalIndices[j];
    otherOriginalIndices[j] = tmp;
  }

  const permutation = new Array(n);
  permutation[displayedCorrectIndex] = correctIndex;
  for (let k = 0; k < otherPositions.length; k++) {
    permutation[otherPositions[k]] = otherOriginalIndices[k];
  }

  const shuffledOptions = permutation.map(origIdx => options[origIdx]);

  return {
    shuffledOptions,
    permutation,
    displayedCorrectIndex
  };
}

/** Allowlist, rather than deleting known answer keys from authored objects. */
export function questionView(item,{shell=false,presentation=null}={}){
 const value={id:item.id,kind:item.kind,objectiveId:item.objectiveId,prompt:shell?'Đang mở câu hỏi…':item.prompt};
 if(item.media)value.media=mediaView(item.media);
 if('options'in item){
   if(shell){
     value.options=[];
   }else if(presentation&&Array.isArray(presentation.permutation)){
     value.options=presentation.permutation.map(i=>item.options[i]);
     value.presentationId=presentation.presentationId;
   }else{
     value.options=[...item.options];
   }
 }
 if('audioId'in item)value.audioId=item.audioId;
 if('passageId'in item)value.passageId=item.passageId;
 if(item.kind==='numeric-answer'&&item.unit)value.unit=item.unit;
 return value;
}
export function safePresentation(pack){
 if(pack.kind==='sentences')return {...pack,items:pack.items.map(item=>({id:item.id,kind:item.kind,objectiveId:item.objectiveId,prompt:item.prompt,words:[...item.words],...(item.media?{media:mediaView(item.media)}:{})}))};
 if(!isTimedPresentation(pack))return pack;
 return {id:pack.id,version:pack.version,title:pack.title,kind:pack.kind,subject:pack.subject,grade:pack.grade,source:pack.source,publishedAt:pack.publishedAt,
   items:pack.items.map(item=>questionView(item,{shell:true})),...(pack.kind==='learning'?{contentFormatVersion:2,passages:[],media:[]}:{} )};
}
export function publicSession(session){
  if(!session||typeof session!=='object')return session;
  const view={
    sessionId:session.sessionId,
    packId:session.packId,
    contentVersion:session.contentVersion,
    moduleId:session.moduleId,
    status:session.status,
    startedAt:session.startedAt
  };
  if(session.studentId!==undefined)view.studentId=session.studentId;
  if(session.moduleVersion!==undefined)view.moduleVersion=session.moduleVersion;
  if(session.endedAt!==undefined)view.endedAt=session.endedAt;
  if(session.rewardPolicyVersion!==undefined)view.rewardPolicyVersion=session.rewardPolicyVersion;
  if(session.questionProtocolVersion!==undefined)view.questionProtocolVersion=session.questionProtocolVersion;
  if(session.journeyWeekId!==undefined)view.journeyWeekId=session.journeyWeekId;
  if(session.currentSequence!==undefined)view.currentSequence=session.currentSequence;
  if(Array.isArray(session.requiredItemIds))view.requiredItemIds=[...session.requiredItemIds];
  if(session.questionClocks&&typeof session.questionClocks==='object'){
    view.questionClocks={...session.questionClocks};
  }
  return view;
}
function currentProtocolQuestion(session,source,events,itemId){
 const presentation=onlinePresentation(session.moduleId,source);
 if(!presentation||!isTimedPresentation(presentation)&&presentation.kind!=='sentences')fail(400,'Trò chơi này không dùng gợi ý từng câu.');
 const ids=session.requiredItemIds??presentation.items.map(item=>item.id),done=new Set(events.filter(event=>(session.rewardPolicyVersion===2||session.questionProtocolVersion===1)?event.correct:true).map(event=>event.itemId));
 const current=ids.find(id=>!done.has(id));
 if(current!==itemId)fail(409,'Hãy hoàn thành câu hiện tại trước khi mở câu tiếp theo.');
 const item=presentation.items.find(item=>item.id===itemId);if(!item)fail(400,'Câu hỏi không thuộc lượt chơi.');return{item,presentation};
}
export function currentTimedQuestion(session,source,events,itemId){const current=currentProtocolQuestion(session,source,events,itemId);if(!isTimedPresentation(current.presentation))fail(400,'Câu hỏi không dùng bộ đếm thời gian.');return current;}
export function openProtocolQuestion(session,source,events,itemId,time=Date.now(),lastCorrectPos=null,rng=Math.random){
 const{item,presentation}=currentTimedQuestion(session,source,events,itemId);
 if(item.kind==='listening-choice'||item.kind==='listening-gap'){
  const delivery=session.audioReceipts?.[itemId];
  if(!delivery||delivery.mediaId!==item.audioId)fail(409,'Con cần tải và nghe hết âm thanh của câu này trước khi trả lời.');
  if(time<Date.parse(delivery.readyAt))fail(409,'Âm thanh chưa đủ thời lượng. Con nghe hết rồi thử mở lại câu hỏi.');
 }
 session.questionClocks??={};if(!Object.hasOwn(session.questionClocks,itemId))Object.defineProperty(session.questionClocks,itemId,{value:new Date(time).toISOString(),enumerable:true,writable:true,configurable:true});

 session.questionPresentations??={};
 let questionPres = session.questionPresentations[itemId];
 const priorAttempts = events.filter(e => e.itemId === itemId);
 const lastAttempt = priorAttempts.at(-1);

 const needsNewPresentation = !questionPres || (lastAttempt && (!questionPres.openedAt || lastAttempt.occurredAt >= questionPres.openedAt));

 if (needsNewPresentation && Array.isArray(item.options) && item.options.length >= 2) {
   const prevPos = questionPres?.displayedCorrectIndex ?? lastCorrectPos;
   const { permutation, displayedCorrectIndex } = shuffleQuestionOptions(
     item.options,
     item.correctIndex,
     prevPos,
     rng
   );
   questionPres = {
     presentationId: randomUUID(),
     itemId,
     permutation,
     displayedCorrectIndex,
     openedAt: new Date(time).toISOString()
   };
   session.questionPresentations[itemId] = questionPres;
 }

 const passage=item.kind==='reading-choice'?presentation.passages.find(row=>row.passageId===item.passageId):undefined;
 return{openedAt:session.questionClocks[itemId],serverNow:new Date(time).toISOString(),...questionRewardThresholds(item),item:questionView(item,{presentation:questionPres}),...(passage?{passage:{passageId:passage.passageId,title:passage.title,body:passage.body}}:{})};
}
export function protocolAudioDelivery(session,source,events,itemId,mediaId,durationMs,time=Date.now()){
 if(Object.hasOwn(session.audioReceipts??{},itemId)&&session.audioReceipts[itemId].mediaId===mediaId)return;
 const{item}=currentTimedQuestion(session,source,events,itemId);
 if(!['listening-choice','listening-gap'].includes(item.kind)||item.audioId!==mediaId)fail(400,'Âm thanh không thuộc câu nghe hiện tại.');
 if(!Number.isFinite(durationMs)||durationMs<=0||durationMs>600000)fail(422,'Không xác minh được thời lượng âm thanh. Hãy nhờ giáo viên thay tệp hợp lệ.');
 session.audioReceipts??={};if(!Object.hasOwn(session.audioReceipts,itemId))Object.defineProperty(session.audioReceipts,itemId,{value:{mediaId,startedAt:new Date(time).toISOString(),readyAt:new Date(time+durationMs).toISOString(),durationMs},enumerable:true,writable:true,configurable:true});
}
export function protocolHint(session,source,events,itemId){
 const{item,presentation}=currentProtocolQuestion(session,source,events,itemId);
 if(isTimedPresentation(presentation)&&!Object.hasOwn(session.questionClocks??{},itemId))fail(409,'Hãy mở câu hỏi trước khi xem gợi ý.');
 session.questionHints??={};if(!Object.hasOwn(session.questionHints,itemId))Object.defineProperty(session.questionHints,itemId,{value:{used:1,requestedAt:new Date().toISOString(),afterSequence:events.length},enumerable:true,writable:true,configurable:true});
 return{hint:item.hint??'Hãy thử loại bỏ các đáp án con chắc chắn là không đúng.',hintsUsed:1};
}
export function answerFeedback(source,session,event){
 if(!event.correct)return undefined;
 const item=onlinePresentation(session.moduleId,source)?.items.find(item=>item.id===event.itemId);
 if(!item||!('prompt'in item))return undefined;
 const audio='audioId'in item&&source.kind==='learning'?source.media.find(row=>row.mediaId===item.audioId):undefined;
 const transcript=audio?.transcript??item.media?.audioTranscript;
 const pres=session?.questionPresentations?.[event.itemId];
 const displayedCorrectIndex=pres?pres.displayedCorrectIndex:item.correctIndex;
 return{explanation:item.explanation??'',...('options'in item?{answer:item.options[item.correctIndex],correctIndex:displayedCorrectIndex}:{}),...(item.kind==='numeric-answer'?{answer:`${item.answer}${item.unit?' '+item.unit:''}`}:'acceptedAnswers'in item?{answer:item.acceptedAnswers.join(' / ')}:{}),...(transcript?{audioTranscript:transcript}:{})};
}
/** Additional backup evidence, independent from the current application's UI. */
export function protocolEvidenceErrors(session,source,events){
 if(session.questionProtocolVersion===undefined)return[];
 const errors=[],time=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value,record=value=>value&&typeof value==='object'&&!Array.isArray(value);
 if(session.questionProtocolVersion!==1||!record(session.questionClocks)||!record(session.questionHints)||!record(session.audioReceipts))return['Giao thức câu hỏi trong bản sao không hợp lệ.'];
 const view=onlinePresentation(session.moduleId,source),items=new Map(view.items.map(item=>[item.id,item]));
 for(const [id,hint]of Object.entries(session.questionHints)){
  if(!items.has(id)||!isTimedPresentation(view)&&view.kind!=='sentences'||!hint||hint.used!==1||!time(hint.requestedAt)||hint.requestedAt<session.startedAt||!Number.isInteger(hint.afterSequence)||hint.afterSequence<0||hint.afterSequence>events.length||isTimedPresentation(view)&&(!Object.hasOwn(session.questionClocks,id)||hint.requestedAt<session.questionClocks[id])||session.endedAt&&hint.requestedAt>session.endedAt||events.some(e=>e.itemId===id&&e.correct&&e.gameSequence<=hint.afterSequence))errors.push('Biên nhận gợi ý trong bản sao không hợp lệ.');
 }
 for(const [id,receipt]of Object.entries(session.audioReceipts)){
  const item=items.get(id);
  if(!item||!['listening-choice','listening-gap'].includes(item.kind)||receipt?.mediaId!==item.audioId||!Number.isInteger(receipt.durationMs)||receipt.durationMs<=0||receipt.durationMs>600000||!time(receipt.startedAt)||!time(receipt.readyAt)||receipt.startedAt<session.startedAt||Date.parse(receipt.readyAt)-Date.parse(receipt.startedAt)!==receipt.durationMs||session.endedAt&&receipt.startedAt>session.endedAt)errors.push('Biên nhận âm thanh trong bản sao không hợp lệ.');
 }
 for(const event of events){
  const item=items.get(event.itemId);if(!item)continue;
  const hint=Object.hasOwn(session.questionHints,event.itemId)?session.questionHints[event.itemId]:null;
  if(event.hintsUsed!==(hint&&event.gameSequence>hint.afterSequence?1:0))errors.push('Số gợi ý không khớp biên nhận máy chủ.');
  if(isTimedPresentation(view)){
   const clock=session.questionClocks[event.itemId];if(!time(clock)||event.elapsedMs!==Date.parse(event.occurredAt)-Date.parse(clock))errors.push('Đồng hồ không khớp câu trả lời.');
   if(['listening-choice','listening-gap'].includes(item.kind)){const audio=session.audioReceipts[event.itemId];if(!audio||!clock||clock<audio.readyAt)errors.push('Câu nghe chưa đủ thời lượng trước khi mở đồng hồ.');}
  }
 }
 return errors;
}
