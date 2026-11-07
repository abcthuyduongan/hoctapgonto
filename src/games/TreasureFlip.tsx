import '../styles/games/primitives.css';
import '../styles/games/stage.css';
import '../styles/games/feedback.css';
import '../styles/games/treasure-flip.css';
import { saveFailureMessage } from './save-failure-message';
import GameMascot from './GameMascot';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AttemptInput, GameHostProps, PairsPack } from '../core/contracts';
import { shuffle } from '../core/utils';
import { playFeedbackTone } from '../core/experience';
import { stopSpeaking } from '../core/speech';
import { useQuestionSpeech } from './useQuestionSpeech';
import { getMascotLine } from './mascot-dialogue';
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
  const speech = useQuestionSpeech(pack.subject, `${pack.id}:${roundIndex}`);
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

  function handleReplay() {
    firstRef.current = null;
    setFirst(null);
    setSecond(null);
    setMatched([]);
    setMoves(0);
    moveRef.current = 0;
    countRef.current = 0;
    setLastOutcome(null);
    setStatus('playing');
    setLocked(false);
    setError('');
    setFinishing(false);
    setSaving(false);
    setRoundIndex(0);
  }

  useEffect(() => {
    closed.current = false;
    busyRef.current = false;
    firstRef.current = null;
    return () => {
      closed.current = true;
      stopSpeaking();
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
          if (closed.current) return;
          firstRef.current = null;
          setFirst(null);
          setSecond(null);
          setLocked(false);
          busyRef.current = false;
          timerRef.current = null;
        }, Math.max(0, 700 - (performance.now() - revealedAt)));
      }
    },
    [content.items.length, deck, error, locked, matched, onAttempt, onComplete, questionMode, status]
  );

  const mascotMood = lastOutcome === 'correct' ? 'happy' : lastOutcome === 'retry' ? 'encourage' : 'idle';
  const mascotSpeech = getMascotLine(mascotMood, moves);

  return (
    <section ref={layout.ref} {...layout.layoutProps} className="play-panel treasure-flip-stage world-stage world-math">
      <div className="stage-backdrop" aria-hidden="true" />
      <div className="stage-overlay" aria-hidden="true" />

      {speech.notice && <p className="notice speech-notice" role="status">{speech.notice}</p>}

      <div className="world-hud">
        <span className="hud-label">
          <span className="ba37-hud-symbol" aria-hidden="true">💎</span> LẬT THẺ KHO BÁU
        </span>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            type="button"
            className="speech-trigger-btn"
            onClick={() => speech.read('Lật các rương kho báu để tìm cặp từ tương ứng nhé!')}
            aria-label="Nghe đọc hướng dẫn"
            title="Nghe hướng dẫn"
          >
            🔊
          </button>
          <span className="hud-score">
            <span aria-hidden="true">★</span> {matched.length}/{content.items.length} kho báu
          </span>
        </div>
      </div>

      <div className="stable-response-zone" aria-live="polite">
        <FeedbackEffects
          result={lastOutcome === null ? null : lastOutcome === 'correct' ? 'success' : 'retry'}
          eventKey={`treasure-${moves}`}
        />
        {error ? (
          <div className="notice error" role="alert">
            {error}
            {pending && (
              <button type="button" className="button secondary" onClick={() => choose(pending.card, true)}>
                Thử lưu lại
              </button>
            )}
          </div>
        ) : (
          <span className="feedback-message">
            {saving
              ? '⏳ Đang lưu kết quả…'
              : locked && second && lastOutcome === 'retry'
              ? '🌱 Hai thẻ chưa khớp — hãy thử lại nhé!'
              : matched.length === content.items.length
              ? '🎉 Xuất sắc! Con đã mở toàn bộ rương kho báu!'
              : lastOutcome === 'correct'
              ? '✨ Tuyệt vời! Cặp rương mở ra kho báu!'
              : '💎 Chạm mở 2 rương để tìm các cặp ghép đôi.'}
          </span>
        )}
      </div>

      <div className="adventure-layout" style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start' }}>
        <aside className="world-guide">
          <div className="guide-figure">
            <GameMascot
              alt="Cáo tìm kho báu"
              mood={mascotMood}
              reactionKey={matched.length}
            />
          </div>
          <div className="guide-speech">{mascotSpeech}</div>
        </aside>

        <div style={{ flex: 1 }}>
          <div className="treasure-grid">
            {deck.map((card) => {
              const isRevealed = card.id === first || card.id === second || matched.includes(card.pairId);
              const isMatched = matched.includes(card.pairId);
              return (
                <button
                  key={card.id}
                  type="button"
                  className={`treasure-chest ${isRevealed ? 'open' : 'closed'} ${isMatched ? 'matched' : ''}`}
                  onClick={() => choose(card)}
                  disabled={isMatched || locked || saving}
                  aria-label={isRevealed ? card.label : 'Rương đóng, chạm để mở'}
                  aria-pressed={isRevealed}
                >
                  <span className="treasure-chest-icon" aria-hidden="true">
                    {isMatched ? '✨' : isRevealed ? '💎' : '🧰'}
                  </span>
                  <span className="treasure-chest-label">
                    {isRevealed ? card.label : 'Mở rương'}
                  </span>
                </button>
              );
            })}
          </div>

          {roundDone && roundIndex < rounds.length - 1 && (
            <div style={{ textAlign: 'center', marginTop: '16px' }}>
              <button type="button" className="button primary" onClick={nextRound}>
                Sang phòng kho báu tiếp theo ➜
              </button>
            </div>
          )}
        </div>
      </div>

      {status === 'done' && (
        <GameCompletion
          title="Kho Báu Đã Khai Mở!"
          summary={`Con đã xuất sắc mở toàn bộ ${content.items.length} cặp thẻ kho báu chỉ sau ${moves} lượt!`}
          onExit={onExit}
          questionMode={questionMode}
          onReplay={handleReplay}
        />
      )}

      <div className="world-stage-bottom">
        <span>💎 Lật thẻ chuẩn xác • Tìm kho báu trí tuệ</span>
        <span>✦ Bảo An Game World</span>
      </div>
    </section>
  );
}
