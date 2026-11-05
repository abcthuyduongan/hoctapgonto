import '../styles/game-base.css';
import { saveFailureMessage } from './save-failure-message';
import GameMascot from './GameMascot';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AttemptInput, GameHostProps, PairsPack } from '../core/contracts';
import { shuffle } from '../core/utils';
import { playFeedbackTone } from '../core/experience';
import GameCompletion from './GameCompletion';
import FeedbackEffects from './FeedbackEffects';
import { useQuestionLayout } from './useQuestionLayout';
import { createPairRounds, initialPairRoundLimit } from './pair-rounds';

type ChestCard = {
  id: string;
  pairId: string;
  side: 'left' | 'right';
  label: string;
  objectiveId: string;
};

type PendingMove = {
  input: AttemptInput;
  card: ChestCard;
  move: number;
  revealedAt: number;
};

export default function TreasureFlip({
  pack,
  onAttempt,
  onComplete,
  onExit,
  questionMode = false,
}: GameHostProps) {
  const content = pack as PairsPack;
  const [rounds] = useState(() => createPairRounds(content.items, initialPairRoundLimit()));
  const [roundIndex, setRoundIndex] = useState(0);
  const roundItems = rounds[roundIndex] ?? [];
  const layout = useQuestionLayout({
    kind: 'memory-match',
    questionKey: `${content.id}@${content.version}:${roundIndex}`,
    textLength: Math.max(0, ...roundItems.flatMap((item) => [item.left.length, item.right.length])),
    hasImage: roundItems.some((item) => !!item.media?.imageId),
    itemCount: roundItems.length,
  });

  const deck = useMemo<ChestCard[]>(
    () =>
      shuffle(
        roundItems.flatMap((item) => [
          { id: `${item.id}-L`, pairId: item.id, side: 'left' as const, label: item.left, objectiveId: item.objectiveId },
          { id: `${item.id}-R`, pairId: item.id, side: 'right' as const, label: item.right, objectiveId: item.objectiveId },
        ])
      ),
    [roundItems]
  );

  const [first, setFirst] = useState<string | null>(null);
  const [second, setSecond] = useState<string | null>(null);
  const [matched, setMatched] = useState<string[]>([]);
  const [moves, setMoves] = useState(0);
  const [lastOutcome, setLastOutcome] = useState<'correct' | 'retry' | null>(null);
  const [status, setStatus] = useState<'playing' | 'done'>('playing');
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState('');
  const [finishing, setFinishing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState<PendingMove | null>(null);
  const pendingRef = useRef<PendingMove | null>(null);
  const started = useRef(performance.now());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countRef = useRef(0);
  const busyRef = useRef(false);
  const firstRef = useRef<string | null>(null);
  const moveRef = useRef(0);
  const closed = useRef(false);
  const roundDone = roundItems.every((item) => matched.includes(item.id));

  function nextRound() {
    if (!roundDone || roundIndex >= rounds.length - 1 || busyRef.current || saving || locked || error || finishing) return;
    firstRef.current = null;
    setFirst(null);
    setSecond(null);
    setLastOutcome(null);
    setRoundIndex((index) => index + 1);
  }

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

  const choose = useCallback(
    async (card: ChestCard, retrying = false) => {
      if (
        busyRef.current ||
        status === 'done' ||
        (!(retrying && pendingRef.current) && (locked || !!error || firstRef.current === card.id || matched.includes(card.pairId)))
      )
        return;

      if (!firstRef.current) {
        firstRef.current = card.id;
        setFirst(card.id);
        return;
      }

      const previous = deck.find((c) => c.id === firstRef.current)!;
      busyRef.current = true;
      setError('');
      setSecond(card.id);
      setLocked(true);
      setSaving(true);

      const stored = questionMode ? pendingRef.current : null;
      const revealedAt = stored?.revealedAt ?? performance.now();
      const move = stored?.move ?? ++moveRef.current;
      const input: AttemptInput = stored?.input ?? {
        attemptKey: `move-${move}`,
        itemId: card.pairId,
        objectiveId: card.objectiveId,
        correct: previous.pairId === card.pairId && previous.side !== card.side,
        hintsUsed: 0,
        elapsedMs: Math.max(0, Math.round(performance.now() - started.current)),
        response: {
          kind: 'pair',
          first: { itemId: previous.pairId, side: previous.side },
          second: { itemId: card.pairId, side: card.side },
        },
      };

      const correct = input.correct;
      if (questionMode) {
        const nextPending = { input, card, move, revealedAt };
        pendingRef.current = nextPending;
        setPending(nextPending);
      }
      setMoves(move);

      try {
        await onAttempt(input);
      } catch (failure) {
        if (!closed.current) {
          setLastOutcome(null);
          setError(saveFailureMessage(failure));
          if (!questionMode) {
            firstRef.current = null;
            setFirst(null);
            setSecond(null);
            setLocked(false);
            moveRef.current--;
            setMoves(moveRef.current);
          }
          setSaving(false);
        }
        busyRef.current = false;
        return;
      }

      if (closed.current) return;
      pendingRef.current = null;
      setPending(null);
      setSaving(false);
      setLastOutcome(correct ? 'correct' : 'retry');
      playFeedbackTone(correct ? 'success' : 'retry');

      if (correct) {
        countRef.current++;
        setMatched((prev) => [...prev, card.pairId]);
        firstRef.current = null;
        setFirst(null);
        setSecond(null);
        setLocked(false);
        busyRef.current = false;

        if (countRef.current === content.items.length) {
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
          if (!closed.current) {
            firstRef.current = null;
            setFirst(null);
            setSecond(null);
            setLocked(false);
            setLastOutcome(null);
            busyRef.current = false;
          }
        }, 900);
      }
    },
    [content.items.length, deck, error, locked, matched, onAttempt, onComplete, questionMode, status]
  );

  return (
    <section ref={layout.ref} {...layout.layoutProps} className="game-card treasure-flip-board play-panel">
      <div className="game-card-header">
        <div className="game-meta">
          <button type="button" className="meta-badge clickable" onClick={onExit}>
            🚪 Thoát
          </button>
          <span className="meta-badge">💎 Lật Thẻ Kho Báu</span>
          <span className="meta-badge">
            Kho báu: {matched.length}/{content.items.length}
          </span>
          <span className="meta-badge">Lượt lật: {moves}</span>
        </div>
        <GameMascot
          alt="Cáo tìm kho báu"
          mood={lastOutcome === 'correct' ? 'happy' : lastOutcome === 'retry' ? 'encourage' : 'idle'}
          reactionKey={matched.length}
        />
      </div>

      <FeedbackEffects
        result={lastOutcome === null ? null : lastOutcome === 'correct' ? 'success' : 'retry'}
        eventKey={`treasure-${moves}`}
      />

      {error && (
        <div className="game-error-banner" role="alert">
          {error}
          {pending && (
            <button type="button" className="button-secondary" onClick={() => choose(pending.card, true)}>
              Thử lưu lại
            </button>
          )}
        </div>
      )}

      {status === 'done' ? (
        <GameCompletion
          title="Kho Báu Đã Khai Mở!"
          summary={`Bé đã xuất sắc mở toàn bộ ${content.items.length} cặp thẻ kho báu chỉ sau ${moves} lượt!`}
          onExit={onExit}
          questionMode={questionMode}
        />
      ) : (
        <div className="treasure-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', padding: '16px 0' }}>
          {deck.map((card) => {
            const isRevealed = card.id === first || card.id === second || matched.includes(card.pairId);
            const isMatched = matched.includes(card.pairId);
            return (
              <button
                key={card.id}
                type="button"
                className={`card-interactive treasure-chest ${isRevealed ? 'open' : 'closed'} ${isMatched ? 'matched' : ''}`}
                style={{
                  minHeight: '110px',
                  borderRadius: '16px',
                  border: isMatched ? '2px solid #10b981' : isRevealed ? '2px solid #f59e0b' : '2px solid #d97706',
                  background: isMatched ? '#ecfdf5' : isRevealed ? '#fffbeb' : 'linear-gradient(135deg, #d97706, #b45309)',
                  color: isRevealed ? '#1f2937' : '#ffffff',
                  fontSize: '15px',
                  fontWeight: 600,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '10px',
                  cursor: isMatched ? 'default' : 'pointer',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                  transition: 'all 0.2s ease',
                }}
                onClick={() => choose(card)}
                disabled={isMatched || locked || saving}
              >
                {isRevealed ? (
                  <>
                    <span style={{ fontSize: '20px', marginBottom: '4px' }}>{isMatched ? '✨' : '💎'}</span>
                    <span style={{ textAlign: 'center', wordBreak: 'break-word' }}>{card.label}</span>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: '28px', marginBottom: '4px' }}>🧰</span>
                    <span style={{ fontSize: '12px', opacity: 0.9 }}>Mở rương</span>
                  </>
                )}
              </button>
            );
          })}
        </div>
      )}

      {roundDone && roundIndex < rounds.length - 1 && (
        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <button type="button" className="button-primary" onClick={nextRound}>
            Sang phòng kho báu tiếp theo ➜
          </button>
        </div>
      )}
    </section>
  );
}
