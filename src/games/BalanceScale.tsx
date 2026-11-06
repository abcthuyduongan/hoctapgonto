import '../styles/games/primitives.css';
import '../styles/games/stage.css';
import '../styles/games/feedback.css';
import '../styles/balance-scale.css';
import { useEffect, useRef, useState } from 'react';
import type { AttemptInput, AttemptOutcome, CompareItem, CompareOperator, ComparePack, GameHostProps } from '../core/contracts';
import { playFeedbackTone } from '../core/experience';
import GameCompletion from './GameCompletion';
import GameMascot from './GameMascot';
import { saveFailureMessage } from './save-failure-message';
import { questionClockText, useQuestionClock } from './useQuestionClock';
import { stopSpeaking } from '../core/speech';

export default function BalanceScale({
  pack,
  onAttempt,
  onComplete,
  onExit,
  questionMode = false,
  onQuestionOpen,
  serverScored = false,
  onQuestionHint
}: GameHostProps) {
  const content = pack as ComparePack;
  const [index, setIndex] = useState(0);
  const [selectedOp, setSelectedOp] = useState<CompareOperator | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [hints, setHints] = useState(0);
  const [hintText, setHintText] = useState('');
  const [status, setStatus] = useState<'playing' | 'done'>('playing');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [outcome, setOutcome] = useState<AttemptOutcome | null>(null);
  const [tiltClass, setTiltClass] = useState<'tilt-balanced' | 'tilt-left' | 'tilt-right'>('tilt-balanced');
  const [started, setStarted] = useState(() => performance.now());

  const answerLock = useRef(false);
  const nextLock = useRef(false);
  const attemptNumber = useRef(1);
  const pendingRef = useRef<AttemptInput | null>(null);

  const currentItem = content.items[index] as CompareItem;
  const correctSelected = selectedOp !== null && (serverScored ? outcome?.correct === true : selectedOp === currentItem.operator);

  const clock = useQuestionClock({
    enabled: questionMode,
    itemId: currentItem.id,
    canOpen: true,
    finished: correctSelected || status === 'done',
    onQuestionOpen,
    requireItem: serverScored
  });

  useEffect(() => {
    setStarted(performance.now());
    setSelectedOp(null);
    setOutcome(null);
    setTiltClass('tilt-balanced');
    return () => {
      stopSpeaking();
    };
  }, [index]);

  // Keyboard shortcut listener
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (selectedOp !== null || busy || answerLock.current || status === 'done') return;
      if (e.key === '>' || e.key === '1') {
        void answer('>');
      } else if (e.key === '=' || e.key === '2') {
        void answer('=');
      } else if (e.key === '<' || e.key === '3') {
        void answer('<');
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedOp, busy, status, index]);

  async function answer(op: CompareOperator) {
    if (answerLock.current || busy || selectedOp !== null || status === 'done' || (questionMode && !clock.ready)) return;
    answerLock.current = true;
    setError('');
    setBusy(true);
    setSelectedOp(op);

    // Set visual tilt
    if (op === '>') setTiltClass('tilt-left');
    else if (op === '<') setTiltClass('tilt-right');
    else setTiltClass('tilt-balanced');

    const isCorrectLocal = op === currentItem.operator;
    const input: AttemptInput = questionMode && pendingRef.current ? pendingRef.current : {
      attemptKey: questionMode ? `${currentItem.id}:answer:${attemptNumber.current}` : currentItem.id,
      itemId: currentItem.id,
      objectiveId: currentItem.objectiveId,
      correct: !serverScored && isCorrectLocal,
      hintsUsed: hints,
      elapsedMs: Math.max(0, Math.round(performance.now() - started)),
      response: { kind: 'compare', operator: op }
    };

    if (questionMode) pendingRef.current = input;

    try {
      const receipt = await onAttempt(input);
      if (serverScored && !receipt) throw new Error('Chưa nhận được kết quả chấm từ máy chủ. Con thử gửi lại nhé.');
      const correct = receipt?.correct ?? input.correct;
      setOutcome(receipt ?? { correct });

      if (questionMode) {
        attemptNumber.current += 1;
        pendingRef.current = null;
      }

      playFeedbackTone(correct ? 'success' : 'retry');
      if (correct) {
        setCorrectCount(v => v + 1);
      }
    } catch (failure) {
      setError(saveFailureMessage(failure));
    } finally {
      setBusy(false);
      answerLock.current = false;
    }
  }

  async function next() {
    if (nextLock.current || busy || selectedOp === null || (questionMode && !correctSelected)) return;
    nextLock.current = true;
    if (index < content.items.length - 1) {
      setIndex(v => v + 1);
      setSelectedOp(null);
      setOutcome(null);
      setTiltClass('tilt-balanced');
      setHints(0);
      setHintText('');
      attemptNumber.current = 1;
      pendingRef.current = null;
      requestAnimationFrame(() => {
        nextLock.current = false;
      });
    } else {
      try {
        await onComplete();
        setStatus('done');
      } catch (failure) {
        setError(saveFailureMessage(failure));
      } finally {
        nextLock.current = false;
      }
    }
  }

  async function requestHint() {
    if (busy || hints > 0) return;
    try {
      if (serverScored && onQuestionHint) {
        const res = await onQuestionHint(currentItem.id);
        setHintText(res.hint);
      } else {
        setHintText(currentItem.hint || 'Hãy tính nhẩm giá trị hai bên đĩa cân rồi so sánh nhé!');
      }
      setHints(h => h + 1);
    } catch {
      setHintText(currentItem.hint || 'Hãy tính nhẩm giá trị hai bên đĩa cân rồi so sánh nhé!');
      setHints(h => h + 1);
    }
  }

  if (status === 'done') {
    return (
      <GameCompletion
        title="Xuất sắc! Cân Thăng Bằng Hoàn Thành"
        summary={`Con đã hoàn thành đúng ${correctCount}/${content.items.length} câu so sánh!`}
        questionMode={questionMode}
        onExit={onExit}
      />
    );
  }

  return (
    <section className="balance-scale-stage" aria-label="Trò chơi Cân Thăng Bằng">
      {/* HUD Bar */}
      <div className="scale-hud">
        <span>CÂU {index + 1} / {content.items.length}</span>
        <span>{correctCount} câu đúng</span>
        {questionMode && <span>{clock.ready ? questionClockText(clock) : 'Đang mở đồng hồ…'}</span>}
      </div>

      {/* Prompt */}
      <div className="scale-prompt-box">
        <h2 className="scale-prompt-title">
          {currentItem.prompt || 'Quan sát hai đĩa cân và chọn dấu thích hợp:'}
        </h2>
      </div>

      {/* Visual Balance Scale Rig */}
      <div className="scale-rig-container" aria-hidden="true">
        <div className="scale-base-pillar" />
        <div className="scale-base-stand" />
        <div className="scale-fulcrum-pivot" />

        {/* Tilting Beam with Pans */}
        <div className={`scale-beam ${tiltClass}`}>
          {/* Left Pan */}
          <div className="scale-pan-arm arm-left">
            <div className="scale-pan-string" />
            <div className="scale-pan-dish">
              <span className="scale-expr-text">{currentItem.left}</span>
            </div>
          </div>

          {/* Right Pan */}
          <div className="scale-pan-arm arm-right">
            <div className="scale-pan-string" />
            <div className="scale-pan-dish">
              <span className="scale-expr-text">{currentItem.right}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Operator Buttons */}
      <div className="scale-controls-row" role="group" aria-label="Chọn dấu so sánh">
        {(['>', '=', '<'] as CompareOperator[]).map(op => {
          const isChosen = selectedOp === op;
          const isCorrectOp = currentItem.operator === op;
          let btnClass = 'scale-op-btn';
          if (isChosen) {
            btnClass += outcome?.correct ? ' is-correct' : outcome ? ' is-incorrect' : ' is-selected';
          } else if (selectedOp !== null && isCorrectOp && !outcome?.correct) {
            btnClass += ' is-correct';
          }
          return (
            <button
              key={op}
              type="button"
              className={btnClass}
              onClick={() => void answer(op)}
              disabled={busy || selectedOp !== null || (questionMode && !clock.ready)}
              aria-label={`Dấu ${op === '>' ? 'lớn hơn' : op === '<' ? 'bé hơn' : 'bằng'}`}
            >
              {op}
            </button>
          );
        })}
      </div>

      {/* Feedback & Actions */}
      {selectedOp !== null && (
        <div className={`scale-feedback-bar ${outcome?.correct ? 'correct' : 'incorrect'}`} role="status">
          <div>
            <strong>{outcome?.correct ? '✓ Tuyệt vời! Rất chính xác.' : 'Chưa chính xác.'}</strong>
            <p style={{ margin: '0.25rem 0 0' }}>{outcome?.feedback?.explanation || currentItem.explanation}</p>
          </div>
          {(!questionMode || correctSelected) ? (
            <button type="button" className="scale-next-btn" onClick={() => void next()}>
              {index === content.items.length - 1 ? 'Hoàn thành 🎉' : 'Câu tiếp theo →'}
            </button>
          ) : (
            <button
              type="button"
              className="scale-next-btn"
              onClick={() => {
                setSelectedOp(null);
                setOutcome(null);
                setTiltClass('tilt-balanced');
              }}
            >
              Thử lại
            </button>
          )}
        </div>
      )}

      {/* Hint & Mascot */}
      {selectedOp === null && (
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginTop: '0.5rem' }}>
          {hints === 0 ? (
            <button
              type="button"
              style={{
                background: 'transparent',
                border: '1px solid #10b981',
                color: '#065f46',
                padding: '0.4rem 0.8rem',
                borderRadius: '10px',
                cursor: 'pointer',
                fontWeight: 600
              }}
              onClick={() => void requestHint()}
            >
              💡 Xem gợi ý
            </button>
          ) : (
            <span style={{ color: '#047857', fontSize: '0.9rem', fontWeight: 600 }}>💡 {hintText}</span>
          )}
        </div>
      )}

      {error && <p className="online-notice online-error" role="alert">{error}</p>}
      <GameMascot alt="Bé Cáo đồng hành" mood={outcome?.correct ? 'happy' : outcome ? 'encourage' : 'idle'} />
    </section>
  );
}
