import {saveFailureMessage} from './save-failure-message';
import QuestionMedia from '../components/QuestionMedia';
import GameMascot from './GameMascot';
import { useEffect, useRef, useState } from 'react';
import { playFeedbackTone } from '../core/experience';
import GameCompletion from './GameCompletion';
import FeedbackEffects from './FeedbackEffects';
import type { GameHostProps, QuizPack } from '../core/contracts';
import { speakText, stopSpeaking } from '../core/speech';

export default function MathQuest({pack,onAttempt,onComplete,onExit}:GameHostProps) {
  const content = pack as QuizPack;
  const [index,setIndex] = useState(0);
  const [selected,setSelected] = useState<number|null>(null);
  const [correctCount,setCorrectCount] = useState(0);
  const [hints,setHints] = useState(0);
  const [status,setStatus] = useState<'playing'|'done'>('playing');
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const answerLock = useRef(false);
  const nextLock = useRef(false);
  const [started,setStarted] = useState(() => performance.now());
  const question = content.items[index];
  useEffect(() => {
    setStarted(performance.now());
    return () => { stopSpeaking(); };
  },[index]);

  async function answer(choice:number) {
    if (answerLock.current || busy || selected !== null || status === 'done') return;
    answerLock.current=true;
    setError('');setBusy(true);
    const correct = choice === question.correctIndex;
    try {
      await onAttempt({attemptKey:question.id,itemId:question.id,objectiveId:question.objectiveId,correct,hintsUsed:hints,elapsedMs:Math.max(0,Math.round(performance.now()-started)),response:{kind:'choice',choiceIndex:choice}});
      setSelected(choice);
      playFeedbackTone(correct ? 'success' : 'retry');
      if (correct) setCorrectCount(v => v+1);
    } catch(failure) {setError(saveFailureMessage(failure));}
    finally {setBusy(false);answerLock.current=false;}
  }

  async function next() {
    if (nextLock.current || busy || selected === null) return;
    nextLock.current=true;
    if (index < content.items.length-1) {
      setIndex(v=>v+1);setSelected(null);setHints(0);
      // Release only after the next paint, so rapid taps cannot skip questions.
      requestAnimationFrame(()=>{nextLock.current=false;});
    } else {
      setBusy(true);
      try {await onComplete();setStatus('done');}
      catch {setError('Không thể lưu kết quả hoàn thành.');}
      finally {setBusy(false);nextLock.current=false;}
    }
  }

  return <section className="play-panel math-panel world-stage world-math">
    <div className="stage-backdrop" aria-hidden="true"/>
    <div className="stage-overlay" aria-hidden="true"/>
    <div className="world-hud"><span className="hud-label"><span className="ba37-hud-symbol" aria-hidden="true">∑</span> ĐẢO TOÁN HỌC</span><span className="hud-score"><span aria-hidden="true">✓</span> {correctCount} câu đúng</span></div>
    <div className="math-adventure-layout">
      <aside className="world-guide"><div className="guide-figure"><GameMascot alt="Cáo nhỏ đồng hành" mood={selected===null?'idle':selected===question.correctIndex?'happy':'encourage'}/></div><div className="guide-speech">{selected===null ? "Con cứ suy nghĩ kỹ rồi chọn nhé! 🌟" : (selected===question.correctIndex ? "Cậu làm tốt lắm! 🎉" : "Sai cũng là một cách học nhé! 🌱")}</div></aside>
      <div className="challenge-card">
        <div className="quest-progress"><span>THỬ THÁCH {index+1} / {content.items.length}</span><span>{Math.round((index+(selected!==null?1:0))/content.items.length*100)}% hành trình</span></div>
        <div className="progress-track"><div style={{width:`${(index+(selected!==null?1:0))/content.items.length*100}%`}}/></div>
        <div className="quest-scroll" key={question.id}>
          <div className="quest-prompt-kicker">
            <span>CÂU ĐỐ HÔM NAY</span>
            <button type="button" className="speech-trigger-btn" onClick={() => speakText(question.prompt, { lang: pack.subject === 'english' ? 'en-US' : 'vi-VN' })} aria-label="Nghe đọc câu hỏi" title="Nghe đọc câu hỏi">🔊</button>
          </div>
          <h2 className="quiz-question">{question.prompt}</h2>
          <QuestionMedia key={question.id} media={question.media} showTranscript={selected!==null}/>
        </div>
        {error && <div className="notice error" role="alert">{error} <button onClick={()=>setError('')}>Đóng</button></div>}
        <div className="answer-grid">
          {question.options.map((optionText,i) => <button key={i} className={`answer-option ${selected !== null && i === question.correctIndex ? 'correct':''} ${selected === i && i !== question.correctIndex?'incorrect':''}`} onClick={() => void answer(i)} disabled={selected !== null || busy || !!error}>
            <span className="answer-index">{String.fromCharCode(65+i)}</span><span>{optionText}</span>
          </button>)}
        </div>
        <div className={`stable-response-zone ${selected !== null ? 'has-result' : 'is-waiting'}`} aria-live="polite" aria-atomic="true">
          <FeedbackEffects result={selected===null?null:selected===question.correctIndex?'success':'retry'} eventKey={question.id}/>
          <div className="stable-response-body">
            {selected !== null ? <div className={`answer-feedback ${selected===question.correctIndex?'feedback-win':'feedback-retry'}`}>
              <div className="result-copy"><strong>{selected === question.correctIndex ? '🌟 Chính xác! Thật xuất sắc!':'💡 Cùng học từ câu này nhé!'}</strong><p>{question.explanation}</p></div>
              <button className="button primary result-next" onClick={() => void next()} disabled={busy}>{busy?'Đang lưu…':index === content.items.length-1?'Nhận phần thưởng ⭐':'Đến trạm kế tiếp ➜'}</button>
            </div> : <div className="game-help">
              <button className="button text-button" onClick={() => setHints(h => Math.min(1,h+1))} disabled={!!error}>💡 {hints>0?'Đã xem gợi ý':'Cần một gợi ý?'}</button>
              <p className="hint-text">{hints > 0 ? 'Hãy thử loại bỏ các đáp án con chắc chắn là không đúng.' : 'Con có thể suy nghĩ thoải mái trước khi chọn đáp án.'}</p>
            </div>}
          </div>
        </div>
      </div>
    </div>
    {status === 'done' && <GameCompletion title="Chinh phục hòn đảo!" summary={`Con trả lời đúng ${correctCount}/${content.items.length} câu ở lượt đầu. Một hành trình thật đáng nhớ!`} onExit={onExit}/>}
    <div className="world-stage-bottom"><span>🌿 Học từ từ • không cần vội vàng</span><span>✦ Bảo An Game World</span></div>
    <div className="world-particles" aria-hidden="true"><i/><i/><i/><i/><i/><i/></div>
  </section>;
}
