import GameMascot from './GameMascot';
import { useMemo, useRef, useState } from 'react';
import type { GameHostProps, SentencePack } from '../core/contracts';
import { shuffle } from '../core/utils';
import { isCorrectSentence } from '../core/sdk';
import { playFeedbackTone } from '../core/experience';
import GameCompletion from './GameCompletion';
import FeedbackEffects from './FeedbackEffects';

/** SDK V1 game: only receives pack and host callbacks, never imports storage. */
export default function SentenceBuilder({pack,onAttempt,onComplete,onExit}: GameHostProps) {
  const content = pack as SentencePack;
  const [index,setIndex] = useState(0);
  const [placed,setPlaced] = useState<number[]>([]);
  const [retries,setRetries] = useState(0);
  const [hint,setHint] = useState(false);
  const [feedback,setFeedback] = useState<'correct'|'retry'|null>(null);
  const [firstTry,setFirstTry] = useState(0);
  const [done,setDone] = useState(false);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const started = useRef(performance.now());
  const submitting = useRef(false);
  const item = content.items[index];
  const shuffled = useMemo(() => {
    const shuffledIds = shuffle(item.words.map((_,i)=>i));
    if (shuffledIds.length > 1 && shuffledIds.every((n,i)=>n===i)) shuffledIds.reverse();
    return shuffledIds;
  },[item]);
  const remaining = shuffled.filter(i=>!placed.includes(i));

  async function check() {
    if (submitting.current || busy || feedback === 'correct' || placed.length !== item.words.length || done) return;
    setError('');submitting.current = true;setBusy(true);
    const correct = isCorrectSentence(item.words,placed);
    try {
      await onAttempt({attemptKey:`${item.id}:try:${retries+1}`,itemId:item.id,objectiveId:item.objectiveId,
        correct,hintsUsed:hint?1:0,elapsedMs:Math.max(0,Math.round(performance.now()-started.current))});
      setRetries(r=>r+1);
      setFeedback(correct?'correct':'retry');
      playFeedbackTone(correct?'success':'retry');
      if (correct && retries === 0 && !hint) setFirstTry(v=>v+1);
    } catch {
      setError('Chưa thể lưu đáp án. Kiểm tra bộ nhớ trình duyệt rồi thử lại.');
    } finally {submitting.current=false;setBusy(false);}
  }

  async function next() {
    if (submitting.current || busy || feedback !== 'correct') return;
    submitting.current = true;setBusy(true);
    if (index === content.items.length-1) {
      try {await onComplete();setDone(true);}
      catch {setError('Không thể lưu kết quả hoàn thành.');}
    } else {
      setIndex(i=>i+1);setPlaced([]);setRetries(0);setFeedback(null);setHint(false);
      started.current=performance.now();
    }
    submitting.current=false;setBusy(false);
  }
  function retry() {setPlaced([]);setFeedback(null);}

  function insertWord(wordIndex:number) {
    if (busy || feedback === 'correct' || placed.includes(wordIndex)) return;
    setPlaced(prev=>[...prev,wordIndex]);setFeedback(null);
  }
  return <section className="play-panel sentence-panel world-stage world-sentence">
    <div className="stage-backdrop" aria-hidden="true"/><div className="stage-overlay" aria-hidden="true"/>
    <div className="world-hud"><span className="hud-label"><span className="ba37-hud-symbol" aria-hidden="true">Aa</span> XƯỞNG NGÔN TỪ</span><span className="hud-score"><span aria-hidden="true">★</span> {firstTry} câu đúng lần đầu</span></div>
    <div className="sentence-adventure-layout"><aside className="sentence-guide"><GameMascot alt="Cáo nhỏ dẫn đường" mood={feedback==='correct'?'happy':feedback==='retry'?'encourage':'idle'}/><div className="guide-speech">Chạm hoặc kéo từ vào ô để tạo câu nhé! ✨</div></aside>
      <div className="sentence-scroll">
        <div className="quest-progress"><span>CÂU {index+1}/{content.items.length}</span><span>✎ GHÉP CÂU VUI</span></div>
        <div className="progress-track"><div style={{width:`${(index+(feedback==='correct'?1:0))/content.items.length*100}%`}}/></div>
        <h2 className="sentence-prompt" key={item.id}>{item.prompt}</h2>
        <p className="sentence-instruction">🧩 Xếp các từ theo thứ tự để tạo câu đúng</p>
        <div className="sentence-drop" aria-label="Câu đang sắp xếp" onDragOver={e=>e.preventDefault()} onDrop={e=>{
          e.preventDefault();const rawIndex=e.dataTransfer.getData('text/plain');const indexToAdd=Number(rawIndex);
          if (/^(0|[1-9]\d*)$/.test(rawIndex)&&Number.isInteger(indexToAdd)&&indexToAdd>=0&&indexToAdd<item.words.length) insertWord(indexToAdd);
        }}>
          {placed.length === 0 && <span className="sentence-placeholder">✦ Kéo hoặc chạm vào từ để bắt đầu…</span>}
          {placed.map((wordIndex,i)=><button type="button" key={wordIndex} className="word-tile selected" aria-label={`Bỏ từ ${item.words[wordIndex]}`} disabled={busy||feedback==='correct'} onClick={()=>{setPlaced(p=>p.filter((_,j)=>j!==i));setFeedback(null);}}>{item.words[wordIndex]} <span aria-hidden="true">×</span></button>)}
        </div>
        <div className="bank-label">🎒 KHO TỪ CỦA CON</div>
        <div className="sentence-bank" aria-label="Kho từ">
          {remaining.map(i=><button key={i} type="button" draggable={!busy&&feedback!=='correct'} onDragStart={e=>e.dataTransfer.setData('text/plain',String(i))} className="word-tile" disabled={busy||feedback==='correct'} onClick={()=>insertWord(i)}>{item.words[i]}</button>)}
        </div>
        <div className="sentence-result-reserve" aria-live="polite" aria-atomic="true">
          <FeedbackEffects result={feedback==='correct'?'success':feedback==='retry'?'retry':null} eventKey={`${item.id}-${retries}`}/>
          {error ? <div className="notice error" role="alert">{error} <button onClick={()=>setError('')}>Đóng</button> <button onClick={onExit}>Thoát</button></div>
          : feedback === 'correct' ? <div className="answer-feedback feedback-win"><strong>🌟 Chính xác! Xuất sắc!</strong><p>{item.words.join(' ')}</p></div>
          : feedback === 'retry' ? <div className="answer-feedback feedback-retry"><strong>💡 Chưa khớp đáp án mẫu.</strong><p>Con thử cách sắp xếp khác nhé.</p></div>
          : hint ? <p className="sentence-hint">💡 {item.hint}</p>
          : <p className="sentence-hint sentence-empty-hint">✨ Con hãy chọn các từ để tạo câu hoàn chỉnh.</p>}
        </div>
        <div className="sentence-actions stable-sentence-actions">
          {feedback==='correct' ? <button className="button primary sentence-main-action" onClick={()=>void next()} disabled={busy}>{busy?'Đang lưu…':index===content.items.length-1?'Nhận phần thưởng ⭐':'Câu tiếp theo ➜'}</button>
          : feedback==='retry' ? <button className="button primary sentence-main-action" onClick={retry}>↺ Thử xếp lại</button>
          : <>
            <button className="button outline" onClick={()=>setHint(true)} disabled={hint||busy}>💡 {hint?'Đã xem gợi ý':'Gợi ý'}</button>
            <button className="button outline" onClick={()=>{setPlaced([]);setFeedback(null);}} disabled={busy||placed.length===0}>↺ Xếp lại</button>
            <button className="button primary sentence-main-action" onClick={()=>void check()} disabled={busy||placed.length!==item.words.length}>{busy?'Đang lưu…':'✓ Kiểm tra câu'}</button>
          </>}
        </div>
        <p className="small-note">Hệ thống đang sử dụng một đáp án mẫu, chưa đánh giá đầy đủ các biến thể ngôn ngữ.</p>
      </div>
    </div>
    {done && <GameCompletion title="Nhà thám hiểm ngôn từ!" summary={`${firstTry}/${content.items.length} câu đúng ngay lần đầu và không cần gợi ý. Con đã kiên trì hoàn thành các câu còn lại.`} onExit={onExit}/>}
    <div className="world-particles" aria-hidden="true"><i/><i/><i/><i/><i/><i/></div>
    <div className="world-stage-bottom"><span>🌈 Từng từ một, con sẽ tạo nên điều hay!</span><span>✦ Bảo An Game World</span></div>
  </section>;
}
