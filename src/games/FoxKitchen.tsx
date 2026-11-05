import '../styles/game-base.css';
import { saveFailureMessage } from './save-failure-message';
import GameMascot from './GameMascot';
import { useMemo, useRef, useState } from 'react';
import type { AttemptInput, GameHostProps, SentencePack } from '../core/contracts';
import { shuffle } from '../core/utils';
import { isCorrectSentence } from '../core/sdk';
import { playFeedbackTone } from '../core/experience';
import GameCompletion from './GameCompletion';
import FeedbackEffects from './FeedbackEffects';
import { useQuestionLayout } from './useQuestionLayout';

const INGREDIENT_ICONS = ['🥕', '🍄', '🍅', '🧅', '🥦', '🌽', '🥔', '🧀', '🧄', '🌿'];

export default function FoxKitchen({
  pack,
  onAttempt,
  onComplete,
  onExit,
  questionMode = false,
  serverScored = false,
  onQuestionHint,
}: GameHostProps) {
  const content = pack as SentencePack;
  const [index, setIndex] = useState(0);
  const [placed, setPlaced] = useState<number[]>([]);
  const [retries, setRetries] = useState(0);
  const [hint, setHint] = useState(false);
  const [hintText, setHintText] = useState('');
  const [feedback, setFeedback] = useState<'correct' | 'retry' | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState<AttemptInput | null>(null);
  const pendingRef = useRef<AttemptInput | null>(null);
  const started = useRef(performance.now());
  const submitting = useRef(false);
  const item = content.items[index];
  const layout = useQuestionLayout({
    kind: 'sequence-trail',
    questionKey: item.id,
    textLength: item.prompt.length + item.words.join(' ').length,
    hasImage: !!item.media?.imageId,
    itemCount: item.words.length,
  });

  const shuffled = useMemo(() => {
    const shuffledIds = shuffle(item.words.map((_, i) => i));
    if (shuffledIds.length > 1 && shuffledIds.every((n, i) => n === i)) shuffledIds.reverse();
    return shuffledIds;
  }, [item]);

  const remaining = shuffled.filter((i) => !placed.includes(i));

  async function showHint() {
    if (submitting.current || busy || hint || done || pendingRef.current || feedback === 'correct') return;
    submitting.current = true;
    setBusy(true);
    setError('');
    try {
      if (serverScored && onQuestionHint) {
        const res = await onQuestionHint(item.id);
        setHintText(res.hint || `Thử chọn: ${item.words[placed.length]}`);
      } else {
        setHintText(`Gợi ý nguyên liệu kế tiếp: "${item.words[placed.length]}"`);
      }
      setHint(true);
    } catch {
      setError('Chưa tải được gợi ý.');
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  function addIngredient(i: number) {
    if (busy || feedback === 'correct' || placed.length >= item.words.length) return;
    setPlaced((prev) => [...prev, i]);
  }

  function removeIngredient(position: number) {
    if (busy || feedback === 'correct') return;
    setPlaced((prev) => prev.filter((_, idx) => idx !== position));
  }

  async function submitCook(retrying = false) {
    if (submitting.current || busy || done) return;
    if (placed.length < item.words.length && !retrying) {
      setError('Bé hãy cho đủ các nguyên liệu vào nồi súp nhé!');
      return;
    }

    submitting.current = true;
    setBusy(true);
    setError('');

    const isCorrect = isCorrectSentence(item.words, placed);
    const attempt: AttemptInput = pendingRef.current ?? {
      attemptKey: `cook-${index}-${retries + 1}`,
      itemId: item.id,
      objectiveId: item.objectiveId,
      correct: isCorrect,
      hintsUsed: hint ? 1 : 0,
      elapsedMs: Math.max(0, Math.round(performance.now() - started.current)),
      response: {
        kind: 'order',
        indices: placed,
      },
    };

    if (questionMode) {
      pendingRef.current = attempt;
      setPending(attempt);
    }

    try {
      await onAttempt(attempt);
    } catch (failure) {
      setError(saveFailureMessage(failure));
      submitting.current = false;
      setBusy(false);
      return;
    }

    pendingRef.current = null;
    setPending(null);
    setFeedback(isCorrect ? 'correct' : 'retry');
    playFeedbackTone(isCorrect ? 'success' : 'retry');

    if (isCorrect) {
      setTimeout(() => {
        if (index + 1 < content.items.length) {
          setIndex((i) => i + 1);
          setPlaced([]);
          setRetries(0);
          setHint(false);
          setHintText('');
          setFeedback(null);
          started.current = performance.now();
          submitting.current = false;
          setBusy(false);
        } else {
          setDone(true);
          onComplete().catch(() => setError('Lưu kết quả hoàn thành thất bại.'));
        }
      }, 1000);
    } else {
      setRetries((r) => r + 1);
      setTimeout(() => {
        setFeedback(null);
        submitting.current = false;
        setBusy(false);
      }, 1200);
    }
  }

  return (
    <section ref={layout.ref} {...layout.layoutProps} className="game-card fox-kitchen-board play-panel">
      <div className="game-card-header">
        <div className="game-meta">
          <button type="button" className="meta-badge clickable" onClick={onExit}>
            🚪 Thoát
          </button>
          <span className="meta-badge">🍲 Bếp Nhỏ Của Cáo</span>
          <span className="meta-badge">
            Món ăn: {index + 1}/{content.items.length}
          </span>
        </div>
        <GameMascot
          alt="Đầu bếp Cáo"
          mood={feedback === 'correct' ? 'happy' : feedback === 'retry' ? 'encourage' : 'idle'}
          reactionKey={index}
        />
      </div>

      <FeedbackEffects
        result={feedback === null ? null : feedback === 'correct' ? 'success' : 'retry'}
        eventKey={`cook-${index}-${retries}`}
      />

      {error && (
        <div className="game-error-banner" role="alert">
          {error}
          {pending && (
            <button type="button" className="button-secondary" onClick={() => submitCook(true)}>
              Thử lưu lại
            </button>
          )}
        </div>
      )}

      {done ? (
        <GameCompletion
          title="Bữa Tiệc Súp Thơm Lừng!"
          summary={`Bé đã nấu thành công toàn bộ ${content.items.length} món ngon cùng Đầu bếp Cáo!`}
          onExit={onExit}
          questionMode={questionMode}
        />
      ) : (
        <div className="kitchen-stage" style={{ padding: '16px 0', textAlign: 'center' }}>
          <div className="recipe-prompt" style={{ fontSize: '18px', fontWeight: 600, color: '#9a3412', marginBottom: '16px' }}>
            📜 Công thức: {item.prompt}
          </div>

          {/* Cooking Pot Area */}
          <div
            className="soup-pot"
            style={{
              minHeight: '120px',
              padding: '16px',
              borderRadius: '24px',
              background: 'linear-gradient(180deg, #ffedd5, #fed7aa)',
              border: '3px dashed #ea580c',
              marginBottom: '20px',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '10px',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            {placed.length === 0 ? (
              <span style={{ color: '#c2410c', fontStyle: 'italic' }}>
                🍲 Nồi súp đang sôi lăn tăn... Bé hãy chạm các nguyên liệu bên dưới để cho vào nồi!
              </span>
            ) : (
              placed.map((wordIndex, pos) => (
                <button
                  key={`pot-${pos}`}
                  type="button"
                  onClick={() => removeIngredient(pos)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '16px',
                    background: '#ffffff',
                    border: '2px solid #f97316',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    fontWeight: 600,
                    fontSize: '16px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                  title="Chạm để lấy ra khỏi nồi"
                >
                  <span>{INGREDIENT_ICONS[wordIndex % INGREDIENT_ICONS.length]}</span>
                  <span>{item.words[wordIndex]}</span>
                  <span style={{ fontSize: '12px', color: '#dc2626' }}>✕</span>
                </button>
              ))
            )}
          </div>

          {/* Pantry / Remaining Ingredients */}
          <div
            className="pantry-shelf"
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '12px',
              justifyContent: 'center',
              marginBottom: '20px',
            }}
          >
            {remaining.map((wordIndex) => (
              <button
                key={`pantry-${wordIndex}`}
                type="button"
                onClick={() => addIngredient(wordIndex)}
                disabled={busy}
                style={{
                  padding: '10px 18px',
                  borderRadius: '18px',
                  background: 'linear-gradient(135deg, #fff7ed, #ffedd5)',
                  border: '2px solid #ea580c',
                  color: '#9a3412',
                  fontSize: '16px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 3px 5px rgba(0,0,0,0.08)',
                }}
              >
                <span style={{ fontSize: '20px' }}>{INGREDIENT_ICONS[wordIndex % INGREDIENT_ICONS.length]}</span>
                <span>{item.words[wordIndex]}</span>
              </button>
            ))}
          </div>

          {hint && (
            <div style={{ color: '#ea580c', fontWeight: 600, marginBottom: '14px' }}>
              💡 {hintText}
            </div>
          )}

          {/* Kitchen Action Bar */}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button
              type="button"
              className="button-secondary"
              onClick={showHint}
              disabled={hint || busy}
            >
              💡 Gợi ý
            </button>
            <button
              type="button"
              className="button-primary"
              onClick={() => submitCook()}
              disabled={placed.length !== item.words.length || busy}
              style={{
                background: 'linear-gradient(135deg, #ea580c, #c2410c)',
                color: '#ffffff',
                padding: '10px 24px',
                borderRadius: '16px',
                fontWeight: 700,
              }}
            >
              🍲 Nấu súp ngay!
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
