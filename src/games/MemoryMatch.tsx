import {saveFailureMessage} from './save-failure-message';
import QuestionMedia from '../components/QuestionMedia';
import GameMascot from './GameMascot';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GameHostProps, PairsPack } from '../core/contracts';
import { shuffle } from '../core/utils';
import { playFeedbackTone } from '../core/experience';
import GameCompletion from './GameCompletion';
import FeedbackEffects from './FeedbackEffects';

type Card = {id: string; pairId: string; side: 'left' | 'right'; label: string; objectiveId: string};

export default function MemoryMatch({pack, onAttempt, onComplete, onExit}: GameHostProps) {
  const content = pack as PairsPack;
  const deck = useMemo<Card[]>(() => shuffle(content.items.flatMap(item => ([
    {id: `${item.id}-L`,pairId:item.id,side:'left' as const,label:item.left,objectiveId:item.objectiveId},
    {id: `${item.id}-R`,pairId:item.id,side:'right' as const,label:item.right,objectiveId:item.objectiveId}
  ]))),[content]);
  const [first,setFirst] = useState<string|null>(null);
  const [second,setSecond] = useState<string|null>(null);
  const [matched,setMatched] = useState<string[]>([]);
  const [moves,setMoves] = useState(0);
  const [lastOutcome,setLastOutcome] = useState<'correct'|'retry'|null>(null);
  const [status,setStatus] = useState<'playing'|'done'>('playing');
  const [locked,setLocked] = useState(false);
  const [error,setError] = useState('');
  const [finishing,setFinishing] = useState(false);
  const [saving,setSaving] = useState(false);
  const started = useRef(performance.now());
  const timerRef = useRef<ReturnType<typeof setTimeout>|null>(null);
  const countRef = useRef(0);
  const busyRef = useRef(false);
  const firstRef = useRef<string|null>(null);
  const moveRef = useRef(0);
  const closed = useRef(false);

  // React.StrictMode deliberately performs setup → cleanup → setup in development.
  // The old cleanup set closed=true permanently, so after selecting two cards
  // the first await returned without unlocking the board. Reset on each setup.
  useEffect(() => {
    closed.current = false;
    busyRef.current = false;
    firstRef.current = null;
    return () => {
      closed.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, []);

  const choose = useCallback(async (card: Card) => {
    if (busyRef.current || locked || !!error || status === 'done' || firstRef.current === card.id || matched.includes(card.pairId)) return;
    if (!firstRef.current) {firstRef.current=card.id;setFirst(card.id); return;}
    const previous = deck.find(c => c.id === firstRef.current)!;
    busyRef.current=true;
    setSecond(card.id);
    setLocked(true);
    setSaving(true);
    const correct = previous.pairId === card.pairId && previous.side !== card.side;
    const move=++moveRef.current;
    setMoves(move);
    try {
      await onAttempt({attemptKey:`move-${move}`,itemId:card.pairId,objectiveId:card.objectiveId,correct,hintsUsed:0,elapsedMs:Math.max(0,Math.round(performance.now()-started.current)),response:{kind:'pair',first:{itemId:previous.pairId,side:previous.side},second:{itemId:card.pairId,side:card.side}}});
    } catch(failure) {
      if (!closed.current) {
        setLastOutcome(null);
        setError(saveFailureMessage(failure));
        firstRef.current=null;setFirst(null);setSecond(null);setLocked(false);moveRef.current--;setMoves(moveRef.current);
      }
      setSaving(false);
      busyRef.current=false;
      return;
    }
    if (closed.current) return;
    setSaving(false);
    setLastOutcome(correct?'correct':'retry');
    playFeedbackTone(correct?'success':'retry');
    if (correct) {
      countRef.current++;
      setMatched(prev => [...prev,card.pairId]);
      firstRef.current=null;setFirst(null);setSecond(null);setLocked(false);busyRef.current=false;
      if (countRef.current === content.items.length) {
        setFinishing(true);
        try {await onComplete();if (!closed.current) setStatus('done');}
        catch {if (!closed.current) setError('Chưa thể lưu trạng thái hoàn thành. Bấm Thử lưu lại để hoàn tất.');}
        finally {if (!closed.current) setFinishing(false);}
      }
    } else {
      // Both cards remain visible briefly, then the board unlocks automatically.
      timerRef.current = setTimeout(() => {
        if (closed.current) return;
        firstRef.current=null;setFirst(null);setSecond(null);setLocked(false);busyRef.current=false;
        timerRef.current = null;
      },700);
    }
  },[locked,status,matched,deck,onAttempt,onComplete,content.items.length,error]);

  async function retryCompletion() {
    if (finishing || status === 'done') return;
    setFinishing(true);setError('');
    try {await onComplete();if (!closed.current) setStatus('done');}
    catch {if (!closed.current) setError('Vẫn chưa lưu được. Con có thể thử lại.');}
    finally {setFinishing(false);}
  }

  return <section className="play-panel memory-panel world-stage world-memory">
    <div className="stage-backdrop" aria-hidden="true"/><div className="stage-overlay" aria-hidden="true"/>
    <div className="world-hud"><span className="hud-label"><span className="ba37-hud-symbol" aria-hidden="true">◇</span> KHU RỪNG TRÍ NHỚ</span><span className="hud-score"><span aria-hidden="true">★</span> {matched.length}/{content.items.length} cặp</span></div>
    <div className="memory-feedback-slot" aria-live="polite">
      <FeedbackEffects result={lastOutcome===null?null:lastOutcome==='correct'?'success':'retry'} eventKey={`memory-${moves}`}/>
      {error ? <div className="notice error" role="alert">{error} <button type="button" onClick={()=>setError('')}>Đóng</button>{matched.length===content.items.length && <button type="button" onClick={()=>void retryCompletion()} disabled={finishing}>Thử lưu lại</button>}</div>
      : <span className="memory-feedback-message">{saving ? '⏳ Đang lưu lượt chọn…' : locked && second && lastOutcome==='retry' ? '🌿 Hai thẻ chưa khớp — sắp úp lại để con thử tiếp.' : matched.length===content.items.length ? 'Hoàn tất các cặp thẻ! Nếu chưa hiện phần thưởng, hãy bấm Thử hoàn tất.' : lastOutcome==='correct' ? '✨ Tuyệt lắm! Con đã ghép đúng một cặp thẻ!' : lastOutcome==='retry' ? '🌱 Chưa khớp rồi, mình thử lại nhé!' : '🌿 Quan sát, ghi nhớ và tìm hai thẻ cùng một cặp nhé!'}</span>}
      {matched.length===content.items.length && status!=='done' && <button type="button" className="button primary memory-finish-button" disabled={finishing} onClick={()=>void retryCompletion()}>{finishing?'Đang lưu…':'⭐ Thử hoàn tất'}</button>}
    </div>
    <div className="memory-adventure-layout">
      <aside className="forest-guide"><GameMascot alt="Cáo nhỏ đồng hành khu rừng" className="forest-mascot" mood={lastOutcome==='correct'?'happy':lastOutcome==='retry'?'encourage':'idle'} reactionKey={matched.length}/><div className="forest-speech">Mỗi lần lật là thêm một cơ hội ghi nhớ!</div></aside>
      <div className="forest-board">
        <div className="memory-topline"><span>✦ BẢNG THẺ THẦN KỲ</span><strong>{moves} lượt thử</strong></div>
        <div className="memory-board-subline" aria-live="polite">{saving ? 'Đang ghi kết quả…' : locked ? 'Đang xem cặp thẻ…' : first ? 'Chọn thêm một thẻ để kiểm tra cặp nhé!' : 'Lật hai thẻ để tìm cặp tương ứng'}</div>
        <div className="pair-question-audio" aria-label="Âm thanh thẻ đang mở">{content.items.filter(item=>first===item.id+'-L'||second===item.id+'-L'||matched.includes(item.id)).map(item=><QuestionMedia key={item.id} media={item.media} audioOnly showTranscript={matched.includes(item.id)}/>)}</div>
        <div className="memory-grid" aria-label="Bảng thẻ ghi nhớ">
          {deck.map(card => {
            const revealed = card.id === first || card.id === second || matched.includes(card.pairId);
            return <button key={card.id} className={`memory-card ${revealed?'revealed':''} ${matched.includes(card.pairId)?'found':''}`} disabled={locked || matched.includes(card.pairId) || !!error} onClick={() => void choose(card)} aria-label={revealed ? card.label : 'Thẻ úp, chọn để lật'} aria-pressed={revealed}>
              <span className="memory-inner"><span className="memory-face memory-back" aria-hidden="true">✦</span><span className="memory-face memory-front">{revealed&&card.side==='left'&&<QuestionMedia media={content.items.find(item=>item.id===card.pairId)?.media} imageOnly/>}<span>{card.label}</span></span></span>
            </button>;
          })}
        </div>
      </div>
    </div>
    {status === 'done' && <GameCompletion title="Giải mã khu rừng!" summary={`Con đã ghép ${content.items.length} cặp sau ${moves} lượt thử. Tuyệt vời!`} onExit={onExit}/>}
    <div className="world-particles" aria-hidden="true"><i/><i/><i/><i/><i/><i/></div>
    <div className="world-stage-bottom"><span>🦋 Quan sát • ghi nhớ • khám phá</span><span>✦ Bảo An Game World</span></div>
  </section>;
}
