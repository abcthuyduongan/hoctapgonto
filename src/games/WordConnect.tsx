import {saveFailureMessage} from './save-failure-message';
import QuestionMedia,{QuestionImageRecovery} from '../components/QuestionMedia';
import GameMascot from './GameMascot';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GameHostProps, PairsPack } from '../core/contracts';
import { shuffle } from '../core/utils';
import { playFeedbackTone } from '../core/experience';
import { speakText, stopSpeaking } from '../core/speech';
import GameCompletion from './GameCompletion';
import FeedbackEffects from './FeedbackEffects';

interface ConnectItem {
  id: string;
  label: string;
  objectiveId: string;
}

export default function WordConnect({ pack, onAttempt, onComplete, onExit }: GameHostProps) {
  const content = pack as PairsPack;

  const leftDeck = useMemo<ConnectItem[]>(() => 
    shuffle(content.items.map(item => ({
      id: item.id,
      label: item.left,
      objectiveId: item.objectiveId
    }))), [content]);

  const rightDeck = useMemo<ConnectItem[]>(() => 
    shuffle(content.items.map(item => ({
      id: item.id,
      label: item.right,
      objectiveId: item.objectiveId
    }))), [content]);

  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [selectedRight, setSelectedRight] = useState<string | null>(null);
  const [matched, setMatched] = useState<string[]>([]);
  const [moves, setMoves] = useState(0);
  const [feedback, setFeedback] = useState<'correct' | 'retry' | null>(null);
  const [status, setStatus] = useState<'playing' | 'done'>('playing');
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState('');
  const [finishing, setFinishing] = useState(false);
  const [saving, setSaving] = useState(false);

  const started = useRef(performance.now());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const busyRef = useRef(false);
  const closed = useRef(false);
  const moveRef = useRef(0);
  const matchedCountRef = useRef(0);

  useEffect(() => {
    closed.current = false;
    busyRef.current = false;
    return () => {
      closed.current = true;
      stopSpeaking();
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, []);

  const checkMatch = useCallback(async (leftId: string, rightId: string) => {
    busyRef.current = true;
    setLocked(true);
    setSaving(true);
    const correct = leftId === rightId;
    const move = ++moveRef.current;
    setMoves(move);

    const targetItem = content.items.find(item => item.id === leftId)!;
    try {
      await onAttempt({
        attemptKey: `connect-${move}`,
        itemId: targetItem.id,
        objectiveId: targetItem.objectiveId,
        correct,
        response: { kind: 'pair', first: { itemId: leftId, side: 'left' }, second: { itemId: rightId, side: 'right' } },
        hintsUsed: 0,
        elapsedMs: Math.max(0, Math.round(performance.now() - started.current))
      });
    } catch(failure) {
      if (!closed.current) {
        setFeedback(null);
        setError(saveFailureMessage(failure));
        setSelectedLeft(null);
        setSelectedRight(null);
        setLocked(false);
        moveRef.current--;
        setMoves(moveRef.current);
      }
      setSaving(false);
      busyRef.current = false;
      return;
    }

    if (closed.current) return;
    setSaving(false);
    setFeedback(correct ? 'correct' : 'retry');
    playFeedbackTone(correct ? 'success' : 'retry');

    if (correct) {
      matchedCountRef.current++;
      setMatched(prev => [...prev, leftId]);
      setSelectedLeft(null);
      setSelectedRight(null);
      setLocked(false);
      busyRef.current = false;

      if (matchedCountRef.current === content.items.length) {
        setFinishing(true);
        try {
          await onComplete();
          if (!closed.current) setStatus('done');
        } catch {
          if (!closed.current) setError('Chưa thể lưu trạng thái hoàn thành. Bấm Thử lưu lại để hoàn tất.');
        } finally {
          if (!closed.current) setFinishing(false);
        }
      }
    } else {
      timerRef.current = setTimeout(() => {
        if (closed.current) return;
        setSelectedLeft(null);
        setSelectedRight(null);
        setLocked(false);
        busyRef.current = false;
        timerRef.current = null;
      }, 700);
    }
  }, [content.items, onAttempt, onComplete]);

  const onSelectLeft = (item: ConnectItem) => {
    if (locked || busyRef.current || matched.includes(item.id) || status === 'done') return;
    if (selectedLeft === item.id) {
      setSelectedLeft(null);
      return;
    }
    setSelectedLeft(item.id);
    speakText(item.label, { lang: pack.subject === 'english' ? 'en-US' : 'vi-VN' });
    if (selectedRight) {
      void checkMatch(item.id, selectedRight);
    }
  };

  const onSelectRight = (item: ConnectItem) => {
    if (locked || busyRef.current || matched.includes(item.id) || status === 'done') return;
    if (selectedRight === item.id) {
      setSelectedRight(null);
      return;
    }
    setSelectedRight(item.id);
    speakText(item.label, { lang: 'vi-VN' });
    if (selectedLeft) {
      void checkMatch(selectedLeft, item.id);
    }
  };

  async function retryCompletion() {
    if (finishing || status === 'done') return;
    setFinishing(true);
    setError('');
    try {
      await onComplete();
      if (!closed.current) setStatus('done');
    } catch {
      if (!closed.current) setError('Vẫn chưa lưu được. Con có thể thử lại.');
    } finally {
      if (!closed.current) setFinishing(false);
    }
  }

  return (
    <section className="play-panel word-connect-panel world-stage world-sentence">
      <div className="stage-backdrop" aria-hidden="true" />
      <div className="stage-overlay" aria-hidden="true" />
      <div className="world-hud">
        <span className="hud-label">
          <span className="ba37-hud-symbol" aria-hidden="true">🔗</span> XƯỞNG NGÔN TỪ · NỐI TỪ
        </span>
        <span className="hud-score">
          <span aria-hidden="true">★</span> {matched.length}/{content.items.length} cặp đúng
        </span>
      </div>

      <div className="connect-feedback-slot" aria-live="polite">
        <FeedbackEffects
          result={feedback === null ? null : feedback === 'correct' ? 'success' : 'retry'}
          eventKey={`connect-${moves}`}
        />
        {error ? (
          <div className="notice error" role="alert">
            {error} <button type="button" onClick={() => setError('')}>Đóng</button>
            {matched.length === content.items.length && (
              <button type="button" onClick={() => void retryCompletion()} disabled={finishing}>
                Thử lưu lại
              </button>
            )}
          </div>
        ) : (
          <span className="connect-feedback-message">
            {saving
              ? '⏳ Đang lưu kết quả…'
              : locked && feedback === 'retry'
              ? '🌱 Hai từ chưa khớp — con hãy thử lại nhé!'
              : matched.length === content.items.length
              ? '🎉 Xuất sắc! Con đã nối đúng tất cả các từ!'
              : feedback === 'correct'
              ? '✨ Tuyệt vời! Cặp từ hoàn toàn chính xác!'
              : selectedLeft && !selectedRight
              ? '👉 Con hãy chọn thẻ tương ứng ở cột bên phải nhé!'
              : !selectedLeft && selectedRight
              ? '👈 Con hãy chọn thẻ tương ứng ở cột bên trái nhé!'
              : '🌟 Chạm chọn 1 thẻ bên trái và 1 thẻ tương ứng bên phải để nối cặp.'}
          </span>
        )}
      </div>

      <div className="connect-adventure-layout">
        <aside className="connect-guide">
          <GameMascot
            alt="Cáo nhỏ đồng hành xưởng ngôn từ"
            className="connect-mascot"
            mood={feedback === 'correct' ? 'happy' : feedback === 'retry' ? 'encourage' : 'idle'}
            reactionKey={matched.length}
          />
          <div className="connect-speech">
            {matched.length === content.items.length
              ? 'Con giỏi lắm! Hoàn thành xuất sắc!'
              : 'Nối từng cặp từ để mở rộng vốn tri thức!'}
          </div>
        </aside>

        <div className="connect-board">
          <div className="connect-topline">
            <span>✦ BẢNG NỐI TỪ TRÍ TUỆ</span>
            <strong>{moves} lượt nối</strong>
          </div>
          <div className="pair-question-audio" aria-label="Âm thanh câu hỏi đang chọn">{selectedLeft&&<QuestionMedia key={selectedLeft} media={content.items.find(item=>item.id===selectedLeft)?.media} audioOnly/>}</div>
          <QuestionImageRecovery><div className="connect-columns" aria-label="Bảng hai cột nối từ">
            <div className="connect-col connect-col-left" aria-label="Cột từ vựng bên trái">
              <div className="connect-col-header">CỘT A</div>
              {leftDeck.map(item => {
                const isMatched = matched.includes(item.id);
                const isSelected = selectedLeft === item.id;
                return (
                  <button
                    key={`L-${item.id}`}
                    type="button"
                    className={`connect-card ${isSelected ? 'selected' : ''} ${isMatched ? 'matched' : ''}`}
                    disabled={locked || isMatched || !!error}
                    onClick={() => onSelectLeft(item)}
                    aria-label={`Thẻ A: ${item.label}`}
                    aria-pressed={isSelected}
                  >
                    <QuestionMedia media={content.items.find(row=>row.id===item.id)?.media} imageOnly/><span className="connect-card-text">{item.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="connect-divider" aria-hidden="true">
              <span className="connect-sparkle">⇄</span>
            </div>

            <div className="connect-col connect-col-right" aria-label="Cột giải nghĩa bên phải">
              <div className="connect-col-header">CỘT B</div>
              {rightDeck.map(item => {
                const isMatched = matched.includes(item.id);
                const isSelected = selectedRight === item.id;
                return (
                  <button
                    key={`R-${item.id}`}
                    type="button"
                    className={`connect-card ${isSelected ? 'selected' : ''} ${isMatched ? 'matched' : ''}`}
                    disabled={locked || isMatched || !!error}
                    onClick={() => onSelectRight(item)}
                    aria-label={`Thẻ B: ${item.label}`}
                    aria-pressed={isSelected}
                  >
                    <span className="connect-card-text">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div></QuestionImageRecovery>
        </div>
      </div>

      {status === 'done' && (
        <GameCompletion
          title="Nhà thông thái nối từ!"
          summary={`Con đã hoàn thành ghép nối tất cả ${content.items.length} cặp thẻ sau ${moves} lượt! Rất xuất sắc!`}
          onExit={onExit}
        />
      )}
      <div className="world-particles" aria-hidden="true"><i/><i/><i/><i/><i/><i/></div>
      <div className="world-stage-bottom">
        <span>🔗 Nối từ ngữ • Khám phá tri thức • Nhớ lâu hơn</span>
        <span>✦ Bảo An Game World</span>
      </div>
    </section>
  );
}
