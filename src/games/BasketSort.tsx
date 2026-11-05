import '../styles/game-base.css';
import '../styles/basket-sort.css';
import { useEffect, useRef, useState } from 'react';
import type { AttemptInput, CategorizeElement, CategorizeItem, CategorizePack, GameHostProps } from '../core/contracts';
import { playFeedbackTone } from '../core/experience';
import GameCompletion from './GameCompletion';
import GameMascot from './GameMascot';
import { saveFailureMessage } from './save-failure-message';
import { questionClockText, useQuestionClock } from './useQuestionClock';
import { stopSpeaking } from '../core/speech';

export default function BasketSort({
  pack,
  onAttempt,
  onComplete,
  onExit,
  questionMode = false,
  onQuestionOpen,
  serverScored = false,
  onQuestionHint
}: GameHostProps) {
  const content = pack as CategorizePack;
  const [qIndex, setQIndex] = useState(0);
  const [elemIndex, setElemIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [hints, setHints] = useState(0);
  const [hintText, setHintText] = useState('');
  const [status, setStatus] = useState<'playing' | 'done'>('playing');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [shaking, setShaking] = useState(false);
  const [activeBasket, setActiveBasket] = useState<string | null>(null);
  const [sortedCounts, setSortedCounts] = useState<Record<string, number>>({});
  const [started, setStarted] = useState(() => performance.now());

  const answerLock = useRef(false);
  const attemptNumber = useRef(1);

  const currentItem = content.items[qIndex] as CategorizeItem;
  const currentElement: CategorizeElement | undefined = currentItem.elements[elemIndex];
  const allElementsSorted = elemIndex >= currentItem.elements.length;

  const clock = useQuestionClock({
    enabled: questionMode,
    itemId: currentItem.id,
    canOpen: true,
    finished: allElementsSorted || status === 'done',
    onQuestionOpen,
    requireItem: serverScored
  });

  useEffect(() => {
    setStarted(performance.now());
    setElemIndex(0);
    setSortedCounts({});
    return () => {
      stopSpeaking();
    };
  }, [qIndex]);

  // Keyboard shortcut listener (1, 2, 3, 4)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (busy || answerLock.current || status === 'done' || !currentElement) return;
      const num = parseInt(e.key, 10);
      if (!isNaN(num) && num >= 1 && num <= currentItem.categories.length) {
        const cat = currentItem.categories[num - 1];
        void chooseBasket(cat);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [busy, status, currentElement, currentItem.categories]);

  async function chooseBasket(chosenCategory: string) {
    if (answerLock.current || busy || status === 'done' || !currentElement || (questionMode && !clock.ready)) return;
    answerLock.current = true;
    setError('');
    setBusy(true);
    setActiveBasket(chosenCategory);

    const isCorrectLocal = currentElement.category === chosenCategory;
    const input: AttemptInput = {
      attemptKey: `${currentItem.id}:elem:${currentElement.id}:try:${attemptNumber.current}`,
      itemId: currentItem.id,
      objectiveId: currentItem.objectiveId,
      correct: !serverScored && isCorrectLocal,
      hintsUsed: hints,
      elapsedMs: Math.max(0, Math.round(performance.now() - started)),
      response: { kind: 'categorize', elementId: currentElement.id, category: chosenCategory }
    };

    try {
      const receipt = await onAttempt(input);
      const isCorrect = receipt?.correct ?? input.correct;
      playFeedbackTone(isCorrect ? 'success' : 'retry');

      if (isCorrect) {
        setSortedCounts(prev => ({
          ...prev,
          [chosenCategory]: (prev[chosenCategory] || 0) + 1
        }));
        setCorrectCount(c => c + 1);
        attemptNumber.current = 1;

        // Advance to next element
        const nextElemIdx = elemIndex + 1;
        setElemIndex(nextElemIdx);

        if (nextElemIdx >= currentItem.elements.length) {
          // Finished all elements in this question
          await onCompleteQuestion();
        }
      } else {
        setShaking(true);
        attemptNumber.current += 1;
        setTimeout(() => setShaking(false), 500);
      }
    } catch (failure) {
      setError(saveFailureMessage(failure));
    } finally {
      setBusy(false);
      setActiveBasket(null);
      answerLock.current = false;
    }
  }

  async function onCompleteQuestion() {
    if (qIndex < content.items.length - 1) {
      setTimeout(() => {
        setQIndex(q => q + 1);
        setElemIndex(0);
        setSortedCounts({});
        setHints(0);
        setHintText('');
        attemptNumber.current = 1;
      }, 700);
    } else {
      try {
        await onComplete();
        setStatus('done');
      } catch (failure) {
        setError(saveFailureMessage(failure));
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
        setHintText(currentItem.hint || `Chú ý: Thẻ "${currentElement?.text}" thuộc nhóm "${currentElement?.category}"`);
      }
      setHints(h => h + 1);
    } catch {
      setHintText(currentItem.hint || 'Hãy xem kỹ đặc điểm của thẻ để xếp vào nhóm tương ứng nhé!');
      setHints(h => h + 1);
    }
  }

  if (status === 'done') {
    return (
      <GameCompletion
        title="Xuất sắc! Phân Loại Vào Giỏ Hoàn Thành"
        summary={`Con đã phân loại chính xác toàn bộ các thẻ kiến thức!`}
        questionMode={questionMode}
        onExit={onExit}
      />
    );
  }

  return (
    <section className="basket-sort-stage" aria-label="Trò chơi Phân Loại Vào Giỏ">
      {/* HUD Bar */}
      <div className="basket-hud">
        <span>CÂU {qIndex + 1} / {content.items.length}</span>
        <span>Thẻ: {Math.min(elemIndex + 1, currentItem.elements.length)} / {currentItem.elements.length}</span>
        <span>{correctCount} thẻ đúng</span>
        {questionMode && <span>{clock.ready ? questionClockText(clock) : 'Đang mở đồng hồ…'}</span>}
      </div>

      {/* Prompt */}
      <div className="basket-prompt-box">
        <h2 className="basket-prompt-title">
          {currentItem.prompt || 'Phân loại các thẻ vào đúng giỏ:'}
        </h2>
      </div>

      {/* Current Sorting Card Tray */}
      <div className="basket-card-tray">
        {currentElement ? (
          <div className={`sort-item-card ${shaking ? 'is-shaking' : ''}`}>
            {currentElement.text}
          </div>
        ) : (
          <div style={{ color: '#047857', fontWeight: 800, fontSize: '1.25rem' }}>
            ✓ Đã phân loại xong câu này! Đang chuyển tiếp…
          </div>
        )}
      </div>

      {/* Baskets Grid */}
      <div className="baskets-grid" role="group" aria-label="Danh sách các giỏ">
        {currentItem.categories.map((cat, idx) => {
          const isActive = activeBasket === cat;
          const count = sortedCounts[cat] || 0;
          return (
            <button
              key={cat}
              type="button"
              className={`basket-target ${isActive ? 'basket-active' : ''}`}
              onClick={() => void chooseBasket(cat)}
              disabled={busy || !currentElement || (questionMode && !clock.ready)}
              aria-label={`Giỏ ${cat}, phím số ${idx + 1}`}
            >
              <div className="basket-icon">🧺</div>
              <div className="basket-title">{cat}</div>
              <div className="basket-count-pill">{count} thẻ đã vào giỏ</div>
            </button>
          );
        })}
      </div>

      {/* Footer & Hint */}
      <div className="basket-footer-bar">
        {hints === 0 ? (
          <button
            type="button"
            style={{
              background: 'transparent',
              border: '1px solid #ea580c',
              color: '#9a3412',
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
          <span className="basket-hint-pill">💡 {hintText}</span>
        )}
      </div>

      {error && <p className="online-notice online-error" role="alert">{error}</p>}
      <GameMascot alt="Bé Cáo đồng hành" mood={shaking ? 'encourage' : currentElement ? 'idle' : 'happy'} />
    </section>
  );
}
