import '../styles/games/primitives.css';
import '../styles/games/stage.css';
import '../styles/games/feedback.css';
import '../styles/games/boat-race.css';
import { saveFailureMessage } from './save-failure-message';
import GameMascot from './GameMascot';
import { useEffect, useRef, useState } from 'react';
import { playFeedbackTone } from '../core/experience';
import GameCompletion from './GameCompletion';
import FeedbackEffects from './FeedbackEffects';
import type { AttemptInput, AttemptOutcome, GameHostProps, QuizItem, StudentQuizPack } from '../core/contracts';
import { stopSpeaking } from '../core/speech';
import { useQuestionLayout } from './useQuestionLayout';
import { useQuestionClock } from './useQuestionClock';

export default function BoatRace({
  pack,
  onAttempt,
  onComplete,
  onExit,
  questionMode = false,
  onQuestionOpen,
  serverScored = false,
}: GameHostProps) {
  const content = pack as StudentQuizPack;
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [status, setStatus] = useState<'playing' | 'done'>('playing');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [outcome, setOutcome] = useState<AttemptOutcome | null>(null);

  const answerLock = useRef(false);
  const attemptNumber = useRef(1);
  const [started, setStarted] = useState(() => performance.now());
  const sourceQuestion = content.items[index];
  const legacyQuestion = sourceQuestion as QuizItem;

  const correctSelected = selected !== null && (serverScored ? outcome?.correct === true : selected === legacyQuestion.correctIndex);
  const clock = useQuestionClock({
    enabled: questionMode,
    itemId: sourceQuestion.id,
    canOpen: true,
    finished: correctSelected || status === 'done',
    onQuestionOpen,
    requireItem: serverScored,
  });

  const question = clock.item?.kind === 'multiple-choice' ? clock.item : sourceQuestion;
  const correctIndex = serverScored ? outcome?.feedback?.correctIndex : legacyQuestion.correctIndex;
  const explanation = serverScored ? outcome?.feedback?.explanation : legacyQuestion.explanation;
  const layout = useQuestionLayout({
    kind: 'quiz',
    questionKey: question.id,
    textLength: question.prompt.length + Math.max(0, ...question.options.map((option) => option.length)),
    hasImage: !!question.media?.imageId,
  });

  useEffect(() => {
    setStarted(performance.now());
    return () => {
      stopSpeaking();
    };
  }, [index]);

  const progressPercent = Math.round((index / content.items.length) * 100);

  async function answer(choice: number) {
    if (answerLock.current || busy || selected !== null || status === 'done' || !clock.ready) return;
    answerLock.current = true;
    setBusy(true);
    setError('');
    setSelected(choice);

    const isCorrect = serverScored ? false : choice === legacyQuestion.correctIndex;
    const elapsed = Math.max(0, Math.round(performance.now() - started));
    const presId = ('presentationId' in question && typeof (question as any).presentationId === 'string')
      ? (question as any).presentationId
      : (clock.item && 'presentationId' in clock.item && typeof (clock.item as any).presentationId === 'string')
      ? (clock.item as any).presentationId
      : undefined;
    const input: AttemptInput = {
      attemptKey: `race-${question.id}-${attemptNumber.current++}`,
      itemId: question.id,
      objectiveId: question.objectiveId,
      correct: isCorrect,
      hintsUsed: 0,
      elapsedMs: elapsed,
      response: { kind: 'choice', choiceIndex: choice },
      ...(presId ? { presentationId: presId } : {})
    };

    try {
      const result = await onAttempt(input);
      if (serverScored && result) {
        setOutcome(result);
      }
      const actualCorrect = serverScored ? result?.correct === true : isCorrect;
      playFeedbackTone(actualCorrect ? 'success' : 'retry');
      if (actualCorrect) {
        setCorrectCount((c) => c + 1);
      }
    } catch (failure) {
      setError(saveFailureMessage(failure));
      setBusy(false);
      answerLock.current = false;
      return;
    }

    setBusy(false);
  }

  async function nextQuestion() {
    if (index + 1 < content.items.length) {
      setIndex((i) => i + 1);
      setSelected(null);
      setOutcome(null);
      setError('');
      answerLock.current = false;
    } else {
      setStatus('done');
      try {
        await onComplete();
      } catch {
        setError('Lưu tiến độ hoàn thành thất bại.');
      }
    }
  }

  return (
    <section ref={layout.ref} {...layout.layoutProps} className="game-card boat-race-board play-panel">
      <div className="game-card-header">
        <div className="game-meta">
          <button type="button" className="meta-badge clickable" onClick={onExit}>
            🚪 Thoát
          </button>
          <span className="meta-badge">⛵ Đua Thuyền Rồng</span>
          <span className="meta-badge">
            Chặng: {index + 1}/{content.items.length}
          </span>
          <span className="meta-badge">Đúng: {correctCount}</span>
        </div>
        <GameMascot
          alt="Cáo chèo thuyền"
          mood={selected !== null && correctSelected ? 'happy' : selected !== null ? 'encourage' : 'idle'}
          reactionKey={index}
        />
      </div>

      <FeedbackEffects
        result={selected === null ? null : correctSelected ? 'success' : 'retry'}
        eventKey={`race-${index}`}
      />

      {/* River Race Track Visualization */}
      <div
        className="river-track-container"
        style={{
          margin: '12px 0 20px',
          padding: '12px 16px',
          background: 'linear-gradient(180deg, #e0f2fe, #bae6fd)',
          borderRadius: '20px',
          border: '2px solid #0284c7',
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 600, color: '#0369a1', marginBottom: '8px' }}>
          <span>🚩 Xuất phát</span>
          <span>Dòng sông kiến thức</span>
          <span>🗼 Ngọn Hải Đăng</span>
        </div>
        <div
          style={{
            height: '24px',
            background: '#0284c7',
            borderRadius: '12px',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${Math.max(8, progressPercent)}%`,
              background: 'linear-gradient(90deg, #38bdf8, #0ea5e9)',
              transition: 'width 0.4s ease',
            }}
          />
        </div>
        {/* Animated Boat Position */}
        <div
          style={{
            position: 'absolute',
            bottom: '8px',
            left: `calc(16px + (100% - 64px) * ${progressPercent / 100})`,
            fontSize: '26px',
            transition: 'left 0.4s ease',
          }}
        >
          ⛵
        </div>
      </div>

      {error && (
        <div className="game-error-banner" role="alert">
          {error}
        </div>
      )}

      {status === 'done' ? (
        <GameCompletion
          title="Về Đích Xuất Sắc!"
          summary={`Thuyền rồng của bé đã hoàn thành đường đua! Đúng ${correctCount}/${content.items.length} câu hỏi.`}
          onExit={onExit}
          questionMode={questionMode}
        />
      ) : (
        <div className="quiz-stage" style={{ textAlign: 'center', padding: '10px 0' }}>
          <div className="question-prompt" style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', marginBottom: '20px' }}>
            {question.prompt}
          </div>

          <div
            className="answer-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '12px',
              maxWidth: '600px',
              margin: '0 auto 20px',
            }}
          >
            {question.options.map((opt, i) => {
              const isPicked = selected === i;
              const isCorrectOpt = selected !== null && i === correctIndex;
              return (
                <button
                  key={`opt-${i}`}
                  type="button"
                  className={`card-interactive answer-option ${isPicked ? 'picked' : ''} ${isCorrectOpt ? 'correct' : ''}`}
                  onClick={() => answer(i)}
                  disabled={selected !== null || busy}
                  style={{
                    padding: '16px',
                    borderRadius: '16px',
                    border: isCorrectOpt
                      ? '2px solid #10b981'
                      : isPicked
                      ? '2px solid #ef4444'
                      : '2px solid #cbd5e1',
                    background: isCorrectOpt
                      ? '#ecfdf5'
                      : isPicked
                      ? '#fef2f2'
                      : '#ffffff',
                    color: '#0f172a',
                    fontWeight: 600,
                    fontSize: '16px',
                    cursor: selected !== null ? 'default' : 'pointer',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.06)',
                  }}
                >
                  <span style={{ marginRight: '8px', opacity: 0.7 }}>{['A', 'B', 'C', 'D'][i]}.</span>
                  <span>{opt}</span>
                </button>
              );
            })}
          </div>

          {selected !== null && (
            <div style={{ marginTop: '16px' }}>
              {explanation && (
                <div style={{ color: '#475569', fontSize: '15px', marginBottom: '12px' }}>
                  📖 Giải thích: {explanation}
                </div>
              )}
              <button
                type="button"
                className="button-primary"
                onClick={nextQuestion}
                style={{
                  background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                  color: '#ffffff',
                  padding: '10px 28px',
                  borderRadius: '16px',
                  fontWeight: 700,
                }}
              >
                {index + 1 < content.items.length ? 'Chèo tiếp chặng sau ➜' : 'Cán đích hải đăng 🏆'}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
