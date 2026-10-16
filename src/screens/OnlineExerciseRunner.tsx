import {useRef,useState} from 'react';
import type {AttemptInput,GameHostProps,GameResponse,LearningPack,RichLearningItem} from '../core/contracts';
import {normalizedNumber,normalizedWord} from '../core/rich-content';
import QuestionMedia from '../components/QuestionMedia';
import GameCompletion from '../games/GameCompletion';

const names:Record<RichLearningItem['kind'],string>={'numeric-answer':'Điền đáp án số','fill-blank':'Điền từ / cụm từ','reading-choice':'Đọc hiểu & chọn đáp án','listening-choice':'Nghe & chọn đáp án','listening-gap':'Nghe & điền từ'};
function correctAnswer(item:RichLearningItem,response:GameResponse){
  if(item.kind==='reading-choice'||item.kind==='listening-choice')return response.kind==='choice'&&response.choiceIndex===item.correctIndex;
  if(response.kind!=='text')return false;
  if(item.kind==='numeric-answer')return normalizedNumber(response.value)!==undefined&&normalizedNumber(response.value)===normalizedNumber(item.answer);
  return item.acceptedAnswers.some(answer=>normalizedWord(answer,item.caseSensitive)===normalizedWord(response.value,item.caseSensitive));
}
function expectedAnswer(item:RichLearningItem){return item.kind==='reading-choice'||item.kind==='listening-choice'?item.options[item.correctIndex]:item.kind==='numeric-answer'?`${item.answer}${item.unit?` ${item.unit}`:''}`:item.acceptedAnswers.join(' / ');}

export default function OnlineExerciseRunner({pack,onAttempt,onComplete,onExit}:GameHostProps){
  const content=pack as LearningPack;
  const [index,setIndex]=useState(0),[value,setValue]=useState(''),[selected,setSelected]=useState<number|null>(null),[feedback,setFeedback]=useState<boolean|null>(null),[hints,setHints]=useState(false),[played,setPlayed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[correctCount,setCorrectCount]=useState(0),[done,setDone]=useState(false),[pending,setPending]=useState<AttemptInput|null>(null);
  const started=useRef(performance.now()),lock=useRef(false),pendingRef=useRef<AttemptInput|null>(null);
  const item=content.items[index],listening=item.kind==='listening-choice'||item.kind==='listening-gap',choices=item.kind==='reading-choice'||item.kind==='listening-choice'?item.options:null,passage=item.kind==='reading-choice'?content.passages.find(row=>row.passageId===item.passageId):undefined;
  const audio=listening?content.media.find(row=>row.mediaId===item.audioId):undefined;
  const media=listening?{...item.media,audioId:item.audioId,audioTranscript:audio?.transcript??item.media?.audioTranscript}:item.media;
  const answerReady=(!listening||played)&&(choices?selected!==null:!!value.trim());
  async function submit(){
    if(lock.current||feedback!==null||(!pendingRef.current&&!answerReady))return;
    if(!pendingRef.current&&item.kind==='numeric-answer'&&normalizedNumber(value)===undefined){setError('Con nhập một số hợp lệ, dùng dấu phẩy hoặc dấu chấm cho phần thập phân.');return;}
    if(!pendingRef.current&&/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)){setError('Đáp án có ký tự không đọc được. Con nhập lại giúp nhé.');return;}
    lock.current=true;setBusy(true);setError('');
    const response:GameResponse=choices?{kind:'choice',choiceIndex:selected!}:{kind:'text',value};
    const input=pendingRef.current??{attemptKey:`${item.id}:answer:1`,itemId:item.id,objectiveId:item.objectiveId,response,correct:correctAnswer(item,response),hintsUsed:hints?1:0,elapsedMs:Math.max(0,Math.round(performance.now()-started.current))};
    pendingRef.current=input;setPending(input);
    try{await onAttempt(input);setFeedback(input.correct);if(input.correct)setCorrectCount(count=>count+1);pendingRef.current=null;setPending(null);}catch(failure){setError(failure instanceof Error?failure.message:'Chưa gửi được đáp án. Bấm thử lại để gửi đúng lượt này.');}finally{lock.current=false;setBusy(false);}
  }
  async function next(){
    if(lock.current||feedback===null)return;lock.current=true;setBusy(true);setError('');
    try{if(index===content.items.length-1){await onComplete();setDone(true);}else{setIndex(current=>current+1);setValue('');setSelected(null);setFeedback(null);setHints(false);setPlayed(false);pendingRef.current=null;setPending(null);started.current=performance.now();}}
    catch(failure){setError(failure instanceof Error?failure.message:'Chưa lưu được kết quả hoàn thành. Bấm thử lại.');}finally{lock.current=false;setBusy(false);}
  }
  return <section className="play-panel world-stage online-exercise"><div className="stage-backdrop" aria-hidden="true"/><div className="stage-overlay" aria-hidden="true"/><div className="world-hud"><span className="hud-label">✦ LUYỆN TẬP THEO HỌC LIỆU</span><span className="hud-score">{correctCount} câu đúng</span></div><div className="online-exercise-card"><div className="quest-progress"><span>CÂU {index+1} / {content.items.length}</span><span>{names[item.kind]}</span></div><div className="progress-track"><div style={{width:`${(index+(feedback!==null?1:0))/content.items.length*100}%`}}/></div>
    {passage&&<article className="online-reading" aria-label="Đoạn đọc"><h3>{passage.title}</h3><p>{passage.body}</p></article>}<h2>{item.prompt}</h2><QuestionMedia key={item.id} media={media} showTranscript={feedback!==null} onAudioEnded={()=>setPlayed(true)}/>{listening&&!played&&feedback===null&&<p className="online-audio-guide" role="status">Con nghe hết âm thanh để mở phần trả lời. Có thể nghe lại khi cần.</p>}
    <form className="online-form" onSubmit={event=>{event.preventDefault();void submit();}}><fieldset disabled={busy||feedback!==null||!!pending||listening&&!played}>{choices?<div className="answer-grid">{choices.map((option,choice)=><button key={choice} type="button" aria-pressed={selected===choice} className={`answer-option ${selected===choice?'is-selected':''} ${feedback!==null&&choice===('correctIndex' in item?item.correctIndex:-1)?'correct':''} ${feedback===false&&choice===selected?'incorrect':''}`} onClick={()=>setSelected(choice)}><span className="answer-index">{String.fromCharCode(65+choice)}</span><span>{option}</span></button>)}</div>:<label>Đáp án của con{item.kind==='numeric-answer'&&item.unit?` (${item.unit})`:''}<input key={item.id} autoComplete="off" spellCheck={false} inputMode={item.kind==='numeric-answer'?'decimal':'text'} maxLength={item.kind==='numeric-answer'?40:120} value={value} onChange={event=>setValue(event.target.value)}/></label>}</fieldset>
      {feedback===null&&<div className="online-actions"><button type="button" disabled={busy||hints||!!pending} onClick={()=>setHints(true)}>{hints?'Đã xem gợi ý':'Xem gợi ý'}</button><button className="online-primary" disabled={busy||(!pending&&!answerReady)}>{busy?'Đang gửi…':pending?'Thử gửi lại đáp án':'Kiểm tra đáp án'}</button></div>}
    </form>{hints&&feedback===null&&<p className="online-hint">{item.hint}</p>}{error&&<p className="online-notice online-error" role="alert">{error}</p>}{feedback!==null&&<div className={`online-exercise-feedback ${feedback?'is-correct':'is-incorrect'}`} role="status"><strong>{feedback?'✓ Chính xác!':'Cùng xem lại đáp án nhé.'}</strong><p>Đáp án: {expectedAnswer(item)}</p><p>{item.explanation}</p><button className="online-primary" onClick={()=>void next()} disabled={busy}>{busy?'Đang lưu…':index===content.items.length-1?'Hoàn thành & lưu thành tích':'Câu tiếp theo →'}</button></div>}
    </div>{done&&<GameCompletion title="Hoàn thành lượt luyện tập!" summary={`Con trả lời đúng ${correctCount}/${content.items.length} câu. Máy chủ đã lưu kết quả của con.`} onExit={onExit}/>}</section>;
}
