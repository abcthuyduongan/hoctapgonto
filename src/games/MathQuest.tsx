import {useQuestionSpeech} from './useQuestionSpeech';
import {saveFailureMessage} from './save-failure-message';
import QuestionMedia from '../components/QuestionMedia';
import GameMascot from './GameMascot';
import { useEffect, useRef, useState } from 'react';
import { playFeedbackTone } from '../core/experience';
import GameCompletion from './GameCompletion';
import FeedbackEffects from './FeedbackEffects';
import type { AttemptInput, AttemptOutcome, GameHostProps, QuizItem, StudentQuizPack } from '../core/contracts';
import { stopSpeaking } from '../core/speech';
import {useQuestionLayout} from './useQuestionLayout';
import {questionClockText,useQuestionClock} from './useQuestionClock';

export default function MathQuest({pack,onAttempt,onComplete,onExit,questionMode=false,onQuestionOpen,serverScored=false,onQuestionHint}:GameHostProps) {
  const content = pack as StudentQuizPack;
  const [index,setIndex] = useState(0);
  const [selected,setSelected] = useState<number|null>(null);
  const [correctCount,setCorrectCount] = useState(0);
  const [hints,setHints] = useState(0);
  const [status,setStatus] = useState<'playing'|'done'>('playing');
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [pending,setPending] = useState<AttemptInput|null>(null);
  const [outcome,setOutcome]=useState<AttemptOutcome|null>(null),[hintBusy,setHintBusy]=useState(false),[hintText,setHintText]=useState('');
  const answerLock = useRef(false);
  const nextLock = useRef(false);
  const attemptNumber=useRef(1),pendingRef=useRef<AttemptInput|null>(null);
  const [started,setStarted] = useState(() => performance.now());
  const sourceQuestion = content.items[index],legacyQuestion=sourceQuestion as QuizItem;
  const [imageReadyQuestion,setImageReadyQuestion]=useState<string|null>(null);
  const imageReady=!sourceQuestion.media?.imageId||imageReadyQuestion===sourceQuestion.id;
  const correctSelected=selected!==null&&(serverScored?outcome?.correct===true:selected===legacyQuestion.correctIndex);
  const clock=useQuestionClock({enabled:questionMode,itemId:sourceQuestion.id,canOpen:imageReady,finished:correctSelected||status==='done',onQuestionOpen,requireItem:serverScored});
  const question=clock.item?.kind==='multiple-choice'?clock.item:sourceQuestion;
  const correctIndex=serverScored?outcome?.feedback?.correctIndex:legacyQuestion.correctIndex;
  const explanation=serverScored?outcome?.feedback?.explanation:legacyQuestion.explanation;
  const speech=useQuestionSpeech(pack.subject,question.id);
  const layout=useQuestionLayout({kind:'quiz',questionKey:question.id,textLength:question.prompt.length+Math.max(0,...question.options.map(option=>option.length)),hasImage:!!question.media?.imageId});
  useEffect(() => {
    setStarted(performance.now());
    return () => { stopSpeaking(); };
  },[index]);

  async function answer(choice:number) {
    if (answerLock.current || busy || hintBusy || selected !== null || status === 'done' || !clock.ready) return;
    answerLock.current=true;
    setError('');setBusy(true);
    const input:AttemptInput=questionMode&&pendingRef.current?pendingRef.current:{attemptKey:questionMode?`${question.id}:answer:${attemptNumber.current}`:question.id,itemId:question.id,objectiveId:question.objectiveId,correct:!serverScored&&choice===legacyQuestion.correctIndex,hintsUsed:hints,elapsedMs:Math.max(0,Math.round(performance.now()-started)),response:{kind:'choice',choiceIndex:choice}};
    if(questionMode){pendingRef.current=input;setPending(input);}
    try {
      const receipt=await onAttempt(input);if(serverScored&&!receipt)throw new Error('Chưa nhận được kết quả chấm từ máy chủ. Con thử gửi lại nhé.');
      const correct=receipt?.correct??input.correct;setOutcome(receipt??{correct});
      setSelected(input.response?.kind==='choice'?input.response.choiceIndex:choice);
      if(questionMode){attemptNumber.current+=1;pendingRef.current=null;setPending(null);}
      playFeedbackTone(correct ? 'success' : 'retry');
      if (correct) setCorrectCount(v => v+1);
    } catch(failure) {setError(saveFailureMessage(failure));}
    finally {setBusy(false);answerLock.current=false;}
  }

  async function next() {
    if (nextLock.current || busy || selected === null || questionMode&&!correctSelected) return;
    nextLock.current=true;
    if (index < content.items.length-1) {
      setIndex(v=>v+1);setSelected(null);setOutcome(null);setHints(0);setHintText('');attemptNumber.current=1;pendingRef.current=null;setPending(null);
      // Release only after the next paint, so rapid taps cannot skip questions.
      requestAnimationFrame(()=>{nextLock.current=false;});
    } else {
      setBusy(true);
      try {await onComplete();setStatus('done');}
      catch {setError('Không thể lưu kết quả hoàn thành.');}
      finally {setBusy(false);nextLock.current=false;}
    }
  }

  async function requestHint(){if(hintBusy||hints||pendingRef.current||busy||!clock.ready)return;setHintBusy(true);setError('');try{if(serverScored){if(!onQuestionHint)throw new Error('Chưa kết nối được gợi ý.');const result=await onQuestionHint(question.id);setHints(result.hintsUsed);setHintText(result.hint);}else{setHints(1);setHintText('Hãy thử loại bỏ các đáp án con chắc chắn là không đúng.');}}catch(error){setError(error instanceof Error?error.message:'Chưa tải được gợi ý.');}finally{setHintBusy(false);}}
  return <section ref={layout.ref} {...layout.layoutProps} className="play-panel math-panel world-stage world-math">
    <div className="stage-backdrop" aria-hidden="true"/>
    <div className="stage-overlay" aria-hidden="true"/>
    {speech.notice&&<p className="notice speech-notice" role="status">{speech.notice}</p>}
    <div className="world-hud"><span className="hud-label"><span className="ba37-hud-symbol" aria-hidden="true">∑</span> ĐẢO TOÁN HỌC</span><span className="hud-score"><span aria-hidden="true">✓</span> {correctCount} câu đúng</span></div>
    <div className="math-adventure-layout">
      <aside className="world-guide"><div className="guide-figure"><GameMascot alt="Cáo nhỏ đồng hành" mood={selected===null?'idle':correctSelected?'happy':'encourage'}/></div><div className="guide-speech">{selected===null ? "Con cứ suy nghĩ kỹ rồi chọn nhé! 🌟" : (correctSelected ? "Cậu làm tốt lắm! 🎉" : "Sai cũng là một cách học nhé! 🌱")}</div></aside>
      <div className="challenge-card">
        <div className="quest-progress"><span>THỬ THÁCH {index+1} / {content.items.length}</span><span>{Math.round((index+((questionMode?correctSelected:selected!==null)?1:0))/content.items.length*100)}% hành trình</span></div>
        <div className="progress-track"><div style={{width:`${(index+((questionMode?correctSelected:selected!==null)?1:0))/content.items.length*100}%`}}/></div>
        {questionMode&&<div className="question-clock"><p>{!imageReady?'Đang tải hình câu hỏi, chưa tính giờ…':clock.ready?questionClockText(clock):clock.error?'Chưa mở được thời gian cho câu này.':'Đang mở câu hỏi và đồng hồ…'}</p>{clock.error&&<p className="notice error" role="alert">{clock.error} <button type="button" onClick={clock.retry}>Thử mở lại câu hỏi</button></p>}</div>}
        <div className="quest-scroll" key={question.id}>
          <div className="quest-prompt-kicker">
            <span>CÂU ĐỐ HÔM NAY</span>
            <button type="button" className="speech-trigger-btn" onClick={() => speech.read(question.prompt)} aria-label="Nghe đọc câu hỏi" title="Nghe đọc câu hỏi">🔊</button>
          </div>
          <h2 className="quiz-question">{question.prompt}</h2>
          <QuestionMedia key={question.id} media={correctSelected&&outcome?.feedback?.audioTranscript?{...question.media,audioTranscript:outcome.feedback.audioTranscript}:question.media} showTranscript={selected!==null&&(!questionMode||correctSelected)} onImageReady={questionMode?()=>setImageReadyQuestion(question.id):undefined}/>
        </div>
        {error && <div className="notice error" role="alert">{error} {questionMode&&pending?<button type="button" disabled={busy} onClick={()=>void answer(pending.response?.kind==='choice'?pending.response.choiceIndex:0)}>Thử gửi lại đáp án</button>:<button onClick={()=>setError('')}>Đóng</button>}</div>}
        <div className="answer-grid">
          {question.options.map((optionText,i) => <button key={i} className={`answer-option ${selected !== null && (!questionMode||correctSelected) && i === correctIndex ? 'correct':''} ${selected === i && !correctSelected?'incorrect':''}`} onClick={() => void answer(i)} disabled={selected !== null || busy || hintBusy || !!error || !!pending || !clock.ready}>
            <span className="answer-index">{String.fromCharCode(65+i)}</span><span>{optionText}</span>
          </button>)}
        </div>
        <div className={`stable-response-zone ${selected !== null ? 'has-result' : 'is-waiting'}`} aria-live="polite" aria-atomic="true">
          <FeedbackEffects result={selected===null?null:correctSelected?'success':'retry'} eventKey={question.id}/>
          <div className="stable-response-body">
            {selected !== null ? <div className={`answer-feedback ${correctSelected?'feedback-win':'feedback-retry'}`}>
              <div className="result-copy"><strong>{correctSelected ? '🌟 Chính xác! Thật xuất sắc!':'💡 Cùng học từ câu này nhé!'}</strong><p>{questionMode&&!correctSelected?'Con chọn lại đáp án nhé. Đồng hồ của câu này vẫn tiếp tục.':explanation}</p></div>
              {questionMode&&!correctSelected?<button type="button" className="button primary result-next" onClick={()=>{setSelected(null);setError('');}} disabled={busy}>Trả lời lại</button>:<button className="button primary result-next" onClick={() => void next()} disabled={busy}>{busy?'Đang lưu…':index === content.items.length-1?(questionMode?'Hoàn thành bộ câu hỏi':'Nhận phần thưởng ⭐'):'Đến trạm kế tiếp ➜'}</button>}
            </div> : <div className="game-help">
              <button className="button text-button" onClick={()=>void requestHint()} disabled={hintBusy||hints>0||!!error||!!pending||!clock.ready}>💡 {hintBusy?'Đang tải gợi ý…':hints>0?'Đã xem gợi ý':'Cần một gợi ý?'}</button>
              <p className="hint-text">{hints > 0 ? hintText : questionMode?'Con trả lời đúng và nhanh để nâng sao của câu này.':'Con có thể suy nghĩ thoải mái trước khi chọn đáp án.'}</p>
            </div>}
          </div>
        </div>
      </div>
    </div>
    {status === 'done' && <GameCompletion questionMode={questionMode} title="Chinh phục hòn đảo!" summary={questionMode?`Con đã trả lời đúng ${correctCount}/${content.items.length} câu. Sao của từng câu đã được lưu.`:`Con trả lời đúng ${correctCount}/${content.items.length} câu ở lượt đầu. Một hành trình thật đáng nhớ!`} onExit={onExit}/>}
    <div className="world-stage-bottom"><span>{questionMode?'🌿 Mỗi câu có tối đa 3 sao • Chơi lại để nâng sao':'🌿 Học từ từ • không cần vội vàng'}</span><span>✦ Bảo An Game World</span></div>
    <div className="world-particles" aria-hidden="true"><i/><i/><i/><i/><i/><i/></div>
  </section>;
}
