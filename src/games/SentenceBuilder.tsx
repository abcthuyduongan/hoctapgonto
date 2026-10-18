import {useQuestionSpeech} from './useQuestionSpeech';
import {saveFailureMessage} from './save-failure-message';
import QuestionMedia from '../components/QuestionMedia';
import GameMascot from './GameMascot';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { AttemptInput, GameHostProps, SentencePack } from '../core/contracts';
import { shuffle } from '../core/utils';
import { isCorrectSentence } from '../core/sdk';
import { playFeedbackTone } from '../core/experience';
import { stopSpeaking } from '../core/speech';
import GameCompletion from './GameCompletion';
import FeedbackEffects from './FeedbackEffects';
import {useQuestionLayout} from './useQuestionLayout';

/** SDK V1 game: only receives pack and host callbacks, never imports storage. */
export default function SentenceBuilder({pack,onAttempt,onComplete,onExit,questionMode=false,serverScored=false,onQuestionHint}: GameHostProps) {
  const content = pack as SentencePack;
  const [index,setIndex] = useState(0);
  const [placed,setPlaced] = useState<number[]>([]);
  const [retries,setRetries] = useState(0);
  const [hint,setHint] = useState(false);
  const [hintText,setHintText] = useState('');
  const [feedback,setFeedback] = useState<'correct'|'retry'|null>(null);
  const [firstTry,setFirstTry] = useState(0);
  const [done,setDone] = useState(false);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [pending,setPending]=useState<AttemptInput|null>(null);
  const pendingRef=useRef<AttemptInput|null>(null);
  const started = useRef(performance.now());
  const submitting = useRef(false);
  const item = content.items[index];
  const speech=useQuestionSpeech(pack.subject,item.id);
  const layout=useQuestionLayout({kind:'sentence-builder',questionKey:item.id,textLength:item.prompt.length+item.words.join(' ').length,hasImage:!!item.media?.imageId,itemCount:item.words.length});

  useEffect(() => {
    return () => { stopSpeaking(); };
  }, [index]);
  const shuffled = useMemo(() => {
    const shuffledIds = shuffle(item.words.map((_,i)=>i));
    if (shuffledIds.length > 1 && shuffledIds.every((n,i)=>n===i)) shuffledIds.reverse();
    return shuffledIds;
  },[item]);
  const remaining = shuffled.filter(i=>!placed.includes(i));

  async function showHint() {
    if(submitting.current||busy||hint||done||pendingRef.current||feedback==='correct')return;
    submitting.current=true;setBusy(true);setError('');
    try {
      if(serverScored&&!onQuestionHint)throw new Error('Hãy tải lại trang để cập nhật phần gợi ý.');
      setHintText(onQuestionHint?(await onQuestionHint(item.id)).hint:item.hint);setHint(true);
    } catch(failure){setError(saveFailureMessage(failure));}
    finally{submitting.current=false;setBusy(false);}
  }

  async function check() {
    if (submitting.current || busy || feedback === 'correct' || placed.length !== item.words.length || done) return;
    setError('');submitting.current = true;setBusy(true);
    const input:AttemptInput=questionMode&&pendingRef.current?pendingRef.current:{attemptKey:`${item.id}:try:${retries+1}`,itemId:item.id,objectiveId:item.objectiveId,
      correct:isCorrectSentence(item.words,placed),hintsUsed:hint?1:0,elapsedMs:Math.max(0,Math.round(performance.now()-started.current)),response:{kind:'order',indices:[...placed]}};
    const correct=input.correct;
    if(questionMode){pendingRef.current=input;setPending(input);}
    try {
      await onAttempt(input);
      if(questionMode){pendingRef.current=null;setPending(null);}
      setRetries(r=>r+1);
      setFeedback(correct?'correct':'retry');
      playFeedbackTone(correct?'success':'retry');
      if (correct && retries === 0 && input.hintsUsed===0) setFirstTry(v=>v+1);
    } catch(failure) {
      setError(saveFailureMessage(failure));
    } finally {submitting.current=false;setBusy(false);}
  }

  async function next() {
    if (submitting.current || busy || feedback !== 'correct') return;
    submitting.current = true;setBusy(true);
    if (index === content.items.length-1) {
      try {await onComplete();setDone(true);}
      catch {setError('Không thể lưu kết quả hoàn thành.');}
    } else {
      setIndex(i=>i+1);setPlaced([]);setRetries(0);setFeedback(null);setHint(false);setHintText('');pendingRef.current=null;setPending(null);
      started.current=performance.now();
    }
    submitting.current=false;setBusy(false);
  }
  function retry() {if(pendingRef.current)return;setPlaced([]);setFeedback(null);}

  function insertWord(wordIndex:number) {
    if (busy || !!pendingRef.current || feedback === 'correct' || placed.includes(wordIndex)) return;
    setPlaced(prev=>[...prev,wordIndex]);setFeedback(null);
  }
  return <section ref={layout.ref} {...layout.layoutProps} className="play-panel sentence-panel world-stage world-sentence">
    <div className="stage-backdrop" aria-hidden="true"/><div className="stage-overlay" aria-hidden="true"/>
    {speech.notice&&<p className="notice speech-notice" role="status">{speech.notice}</p>}
    <div className="world-hud"><span className="hud-label"><span className="ba37-hud-symbol" aria-hidden="true">Aa</span> XƯỞNG NGÔN TỪ</span><span className="hud-score"><span aria-hidden="true">★</span> {firstTry} câu đúng lần đầu</span></div>
    <div className="sentence-adventure-layout"><aside className="sentence-guide"><GameMascot alt="Cáo nhỏ dẫn đường" mood={feedback==='correct'?'happy':feedback==='retry'?'encourage':'idle'}/><div className="guide-speech">Chạm hoặc kéo từ vào ô để tạo câu nhé! ✨</div></aside>
      <div className="sentence-scroll">
        <div className="quest-progress"><span>CÂU {index+1}/{content.items.length}</span><span>✎ GHÉP CÂU VUI</span></div>
        <div className="progress-track"><div style={{width:`${(index+(feedback==='correct'?1:0))/content.items.length*100}%`}}/></div>
        <h2 className="sentence-prompt" key={item.id}>
          {item.prompt}
          <button type="button" className="speech-trigger-btn" onClick={() => speech.read(item.prompt)} aria-label="Nghe đọc yêu cầu" title="Nghe đọc yêu cầu">🔊</button>
        </h2>
        <QuestionMedia key={`media-${item.id}`} media={item.media} showTranscript={feedback!==null&&(!questionMode||feedback==='correct')}/><p className="sentence-instruction">🧩 Xếp các từ theo thứ tự để tạo câu đúng</p>
        <div className="sentence-drop" aria-label="Câu đang sắp xếp" onDragOver={e=>e.preventDefault()} onDrop={e=>{
          e.preventDefault();const rawIndex=e.dataTransfer.getData('text/plain');const indexToAdd=Number(rawIndex);
          if (/^(0|[1-9]\d*)$/.test(rawIndex)&&Number.isInteger(indexToAdd)&&indexToAdd>=0&&indexToAdd<item.words.length) insertWord(indexToAdd);
        }}>
          {placed.length === 0 && <span className="sentence-placeholder">✦ Kéo hoặc chạm vào từ để bắt đầu…</span>}
          {placed.map((wordIndex,i)=><button type="button" key={wordIndex} className="word-tile selected" aria-label={`Bỏ từ ${item.words[wordIndex]}`} disabled={busy||!!pending||feedback==='correct'} onClick={()=>{setPlaced(p=>p.filter((_,j)=>j!==i));setFeedback(null);}}>{item.words[wordIndex]} <span aria-hidden="true">×</span></button>)}
        </div>
        <div className="bank-label">🎒 KHO TỪ CỦA CON</div>
        <div className="sentence-bank" aria-label="Kho từ">
          {remaining.map(i=><button key={i} type="button" draggable={!busy&&!pending&&feedback!=='correct'} onDragStart={e=>e.dataTransfer.setData('text/plain',String(i))} className="word-tile" disabled={busy||!!pending||feedback==='correct'} onClick={()=>insertWord(i)}>{item.words[i]}</button>)}
        </div>
        <div className="sentence-result-reserve" aria-live="polite" aria-atomic="true">
          <FeedbackEffects result={feedback==='correct'?'success':feedback==='retry'?'retry':null} eventKey={`${item.id}-${retries}`}/>
          {error ? <div className="notice error" role="alert">{error} {!pending&&<button onClick={()=>setError('')}>Đóng</button>} <button onClick={onExit}>Thoát</button></div>
          : feedback === 'correct' ? <div className="answer-feedback feedback-win"><strong>🌟 Chính xác! Xuất sắc!</strong><p>{item.words.join(' ')} <button type="button" className="speech-trigger-btn" onClick={() => speech.read(item.words.join(' '))} aria-label="Nghe đọc câu hoàn chỉnh" title="Nghe đọc câu">🔊</button></p></div>
          : feedback === 'retry' ? <div className="answer-feedback feedback-retry"><strong>💡 Chưa khớp đáp án mẫu.</strong><p>Con thử cách sắp xếp khác nhé.</p></div>
          : hint ? <p className="sentence-hint">💡 {hintText}</p>
          : <p className="sentence-hint sentence-empty-hint">✨ Con hãy chọn các từ để tạo câu hoàn chỉnh.</p>}
        </div>
        <div className="sentence-actions stable-sentence-actions">
          {pending?<button type="button" className="button primary sentence-main-action" onClick={()=>void check()} disabled={busy}>{busy?'Đang lưu…':'Thử gửi lại kết quả'}</button>:feedback==='correct' ? <button className="button primary sentence-main-action" onClick={()=>void next()} disabled={busy}>{busy?'Đang lưu…':index===content.items.length-1?(questionMode?'Hoàn thành bộ câu hỏi':'Nhận phần thưởng ⭐'):'Câu tiếp theo ➜'}</button>
          : feedback==='retry' ? <button className="button primary sentence-main-action" onClick={retry}>↺ Thử xếp lại</button>
          : <>
            <button className="button outline" onClick={()=>void showHint()} disabled={hint||busy}>💡 {hint?'Đã xem gợi ý':'Gợi ý'}</button>
            <button className="button outline" onClick={retry} disabled={busy||placed.length===0}>↺ Xếp lại</button>
            <button className="button primary sentence-main-action" onClick={()=>void check()} disabled={busy||placed.length!==item.words.length}>{busy?'Đang lưu…':'✓ Kiểm tra câu'}</button>
          </>}
        </div>
        <p className="small-note">{questionMode?'Sao riêng từng câu: 3 sao khi đúng ngay và không xem gợi ý; mỗi lần sai hoặc xem gợi ý giảm 1 mức, tối thiểu 1 sao khi đúng. ':' '}Hệ thống đang sử dụng một đáp án mẫu, chưa đánh giá đầy đủ các biến thể ngôn ngữ.</p>
      </div>
    </div>
    {done && <GameCompletion questionMode={questionMode} title="Nhà thám hiểm ngôn từ!" summary={`${firstTry}/${content.items.length} câu đúng ngay lần đầu và không cần gợi ý. Con đã kiên trì hoàn thành các câu còn lại.`} onExit={onExit}/>}
    <div className="world-particles" aria-hidden="true"><i/><i/><i/><i/><i/><i/></div>
    <div className="world-stage-bottom"><span>🌈 Từng từ một, con sẽ tạo nên điều hay!</span><span>✦ Bảo An Game World</span></div>
  </section>;
}
