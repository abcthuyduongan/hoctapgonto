import {useRef,useState} from 'react';
import type {AttemptInput,AttemptFeedback,GameHostProps,GameResponse,StudentLearningPack,RichLearningItem} from '../core/contracts';
import {normalizedNumber,normalizedWord} from '../core/rich-content';
import QuestionMedia from '../components/QuestionMedia';
import GameCompletion from '../games/GameCompletion';
import {useQuestionLayout} from '../games/useQuestionLayout';
import {questionClockText,useQuestionClock} from '../games/useQuestionClock';

const names:Record<RichLearningItem['kind'],string>={'numeric-answer':'Điền đáp án số','fill-blank':'Điền từ / cụm từ','reading-choice':'Đọc hiểu & chọn đáp án','listening-choice':'Nghe & chọn đáp án','listening-gap':'Nghe & điền từ'};
function correctAnswer(item:RichLearningItem,response:GameResponse){
  if(item.kind==='reading-choice'||item.kind==='listening-choice')return response.kind==='choice'&&response.choiceIndex===item.correctIndex;
  if(response.kind!=='text')return false;
  if(item.kind==='numeric-answer')return normalizedNumber(response.value)!==undefined&&normalizedNumber(response.value)===normalizedNumber(item.answer);
  return item.acceptedAnswers.some(answer=>normalizedWord(answer,item.caseSensitive)===normalizedWord(response.value,item.caseSensitive));
}
function expectedAnswer(item:RichLearningItem){return item.kind==='reading-choice'||item.kind==='listening-choice'?item.options[item.correctIndex]:item.kind==='numeric-answer'?`${item.answer}${item.unit?` ${item.unit}`:''}`:item.acceptedAnswers.join(' / ');}

export default function OnlineExerciseRunner({pack,onAttempt,onComplete,onExit,questionMode=false,onQuestionOpen,serverScored=false,onQuestionHint,mediaPlayId}:GameHostProps){
  const content=pack as StudentLearningPack;
  const [index,setIndex]=useState(0),[value,setValue]=useState(''),[selected,setSelected]=useState<number|null>(null),[feedback,setFeedback]=useState<boolean|null>(null),[hints,setHints]=useState(false),[played,setPlayed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[correctCount,setCorrectCount]=useState(0),[done,setDone]=useState(false),[pending,setPending]=useState<AttemptInput|null>(null);
  const started=useRef(performance.now()),lock=useRef(false),pendingRef=useRef<AttemptInput|null>(null),attemptNumber=useRef(1);
  const [feedbackDetail,setFeedbackDetail]=useState<AttemptFeedback|undefined>(),[hintText,setHintText]=useState('');
  const sourceItem=content.items[index],listening=sourceItem.kind==='listening-choice'||sourceItem.kind==='listening-gap';
  const [imageReadyQuestion,setImageReadyQuestion]=useState<string|null>(null);
  const imageReady=!sourceItem.media?.imageId||imageReadyQuestion===sourceItem.id;
  const clock=useQuestionClock({enabled:questionMode,itemId:sourceItem.id,canOpen:imageReady&&(!listening||played),finished:feedback===true||done,onQuestionOpen,requireItem:serverScored});
  const item=clock.item&&clock.item.kind!=='multiple-choice'?clock.item:sourceItem;
  const correctIndex=serverScored?feedbackDetail?.correctIndex:'correctIndex'in item?item.correctIndex:undefined;
  const choices=item.kind==='reading-choice'||item.kind==='listening-choice'?item.options:null,passage=clock.passage??(item.kind==='reading-choice'?content.passages.find(row=>row.passageId===item.passageId):undefined);
  const audio=listening&&'audioId'in item?content.media.find(row=>row.mediaId===item.audioId):undefined;
  const media=listening&&'audioId'in item?{...item.media,audioId:item.audioId,audioTranscript:feedbackDetail?.audioTranscript??audio?.transcript??item.media?.audioTranscript}:feedbackDetail?.audioTranscript?{...item.media,audioTranscript:feedbackDetail.audioTranscript}:item.media;
  const layout=useQuestionLayout({kind:item.kind,questionKey:item.id,textLength:item.prompt.length+Math.max(0,...(choices??[]).map(option=>option.length)),hasImage:!!media?.imageId});
  const answerReady=clock.ready&&(!listening||played)&&(choices?selected!==null:!!value.trim());
  async function submit(){
    if(lock.current||feedback!==null||!clock.ready||(!pendingRef.current&&!answerReady))return;
    if(!pendingRef.current&&item.kind==='numeric-answer'&&normalizedNumber(value)===undefined){setError('Con nhập một số hợp lệ, dùng dấu phẩy hoặc dấu chấm cho phần thập phân.');return;}
    if(!pendingRef.current&&/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)){setError('Đáp án có ký tự không đọc được. Con nhập lại giúp nhé.');return;}
    lock.current=true;setBusy(true);setError('');
    const response:GameResponse=choices?{kind:'choice',choiceIndex:selected!}:{kind:'text',value};
    const input=pendingRef.current??{attemptKey:`${item.id}:answer:${questionMode?attemptNumber.current:1}`,itemId:item.id,objectiveId:item.objectiveId,response,correct:!serverScored&&correctAnswer(item as RichLearningItem,response),hintsUsed:hints?1:0,elapsedMs:Math.max(0,Math.round(performance.now()-started.current))};
    pendingRef.current=input;setPending(input);
    try{const result=await onAttempt(input);if(serverScored&&!result)throw new Error('Chưa nhận được kết quả chấm từ máy chủ. Con thử gửi lại nhé.');const correct=result?.correct??input.correct;setFeedback(correct);setFeedbackDetail(result?.feedback);if(correct)setCorrectCount(count=>count+1);if(questionMode)attemptNumber.current+=1;pendingRef.current=null;setPending(null);}catch(failure){setError(failure instanceof Error?failure.message:'Chưa gửi được đáp án. Bấm thử lại để gửi đúng lượt này.');}finally{lock.current=false;setBusy(false);}
  }
  async function next(){
    if(lock.current||feedback===null||questionMode&&!feedback)return;lock.current=true;setBusy(true);setError('');
    try{if(index===content.items.length-1){await onComplete();setDone(true);}else{setIndex(current=>current+1);setValue('');setSelected(null);setFeedback(null);setFeedbackDetail(undefined);setHints(false);setHintText('');setPlayed(false);pendingRef.current=null;setPending(null);attemptNumber.current=1;started.current=performance.now();}}
    catch(failure){setError(failure instanceof Error?failure.message:'Chưa lưu được kết quả hoàn thành. Bấm thử lại.');}finally{lock.current=false;setBusy(false);}
  }
  async function requestHint(){if(lock.current||hints||pendingRef.current||!clock.ready)return;lock.current=true;setBusy(true);setError('');try{if(serverScored){if(!onQuestionHint)throw new Error('Chưa kết nối được gợi ý.');const result=await onQuestionHint(item.id);setHintText(result.hint);}else setHintText((item as RichLearningItem).hint);setHints(true);}catch(error){setError(error instanceof Error?error.message:'Chưa tải được gợi ý.');}finally{lock.current=false;setBusy(false);}}
  return <section ref={layout.ref} {...layout.layoutProps} className="play-panel world-stage online-exercise"><div className="stage-backdrop" aria-hidden="true"/><div className="stage-overlay" aria-hidden="true"/><div className="world-hud"><span className="hud-label">✦ LUYỆN TẬP THEO HỌC LIỆU</span><span className="hud-score">{correctCount} câu đúng</span></div><div className="online-exercise-card"><div className="quest-progress"><span>CÂU {index+1} / {content.items.length}</span><span>{names[item.kind]}</span></div><div className="progress-track"><div style={{width:`${(index+((questionMode?feedback===true:feedback!==null)?1:0))/content.items.length*100}%`}}/></div>
    {questionMode&&(!listening||played)&&<div className="question-clock"><p>{!imageReady?'Đang tải hình câu hỏi, chưa tính giờ…':clock.ready?questionClockText(clock):clock.error?'Chưa mở được thời gian cho câu này.':'Đang mở câu hỏi và đồng hồ…'}</p>{clock.error&&<p className="online-notice online-error" role="alert">{clock.error} <button type="button" onClick={clock.retry}>Thử mở lại câu hỏi</button></p>}</div>}
    {passage&&<article className="online-reading" aria-label="Đoạn đọc"><h3>{passage.title}</h3><p>{passage.body}</p></article>}<h2>{item.prompt}</h2><QuestionMedia key={item.id} media={media} audioContext={serverScored&&mediaPlayId?{playId:mediaPlayId,itemId:item.id}:undefined} showTranscript={feedback!==null&&(!questionMode||feedback)} onAudioEnded={()=>setPlayed(true)} onImageReady={questionMode?()=>setImageReadyQuestion(item.id):undefined}/>{listening&&!played&&feedback===null&&<p className="online-audio-guide" role="status">Con nghe hết âm thanh để mở phần trả lời. Có thể nghe lại khi cần.</p>}
    <form className="online-form" onSubmit={event=>{event.preventDefault();void submit();}}><fieldset disabled={busy||feedback!==null||!!pending||listening&&!played||!clock.ready}>{choices?<div className="answer-grid">{choices.map((option,choice)=><button key={choice} type="button" aria-pressed={selected===choice} className={`answer-option ${selected===choice?'is-selected':''} ${feedback!==null&&(!questionMode||feedback)&&choice===correctIndex?'correct':''} ${feedback===false&&choice===selected?'incorrect':''}`} onClick={()=>setSelected(choice)}><span className="answer-index">{String.fromCharCode(65+choice)}</span><span>{option}</span></button>)}</div>:<label>Đáp án của con{item.kind==='numeric-answer'&&item.unit?` (${item.unit})`:''}<input key={item.id} autoComplete="off" spellCheck={false} inputMode={item.kind==='numeric-answer'?'decimal':'text'} maxLength={item.kind==='numeric-answer'?40:120} value={value} onChange={event=>setValue(event.target.value)}/></label>}</fieldset>
      {feedback===null&&<div className="online-actions"><button type="button" disabled={busy||hints||!!pending||!clock.ready} onClick={()=>void requestHint()}>{hints?'Đã xem gợi ý':'Xem gợi ý'}</button><button className="online-primary" disabled={busy||!clock.ready||(!pending&&!answerReady)}>{busy?'Đang gửi…':pending?'Thử gửi lại đáp án':'Kiểm tra đáp án'}</button></div>}
    </form>{hints&&feedback===null&&<p className="online-hint">{hintText}</p>}{error&&<p className="online-notice online-error" role="alert">{error}</p>}{feedback!==null&&<div className={`online-exercise-feedback ${feedback?'is-correct':'is-incorrect'}`} role="status"><strong>{feedback?'✓ Chính xác!':questionMode?'Chưa đúng. Con thử lại nhé.':'Cùng xem lại đáp án nhé.'}</strong>{questionMode&&!feedback?<><p>Đồng hồ của câu này vẫn tiếp tục. Con cần trả lời đúng để nhận sao và qua câu.</p><button type="button" className="online-primary" onClick={()=>{setFeedback(null);setError('');}} disabled={busy}>Trả lời lại</button></>:<><p>Đáp án: {serverScored?feedbackDetail?.answer:expectedAnswer(item as RichLearningItem)}</p><p>{serverScored?feedbackDetail?.explanation:(item as RichLearningItem).explanation}</p><button className="online-primary" onClick={()=>void next()} disabled={busy}>{busy?'Đang lưu…':index===content.items.length-1?'Hoàn thành & lưu thành tích':'Câu tiếp theo →'}</button></>}</div>}
    </div>{done&&<GameCompletion questionMode={questionMode} title="Hoàn thành lượt luyện tập!" summary={`Con trả lời đúng ${correctCount}/${content.items.length} câu. Máy chủ đã lưu kết quả của con.`} onExit={onExit}/>}</section>;
}
