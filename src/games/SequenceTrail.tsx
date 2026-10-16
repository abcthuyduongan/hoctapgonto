import {saveFailureMessage} from './save-failure-message';
import QuestionMedia from '../components/QuestionMedia';
import GameMascot from './GameMascot';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { GameHostProps, SentencePack } from '../core/contracts';
import { shuffle } from '../core/utils';
import { isCorrectSentence } from '../core/sdk';
import { playFeedbackTone } from '../core/experience';
import { speakText, stopSpeaking } from '../core/speech';
import GameCompletion from './GameCompletion';
import FeedbackEffects from './FeedbackEffects';

export default function SequenceTrail({ pack, onAttempt, onComplete, onExit }: GameHostProps) {
  const content = pack as SentencePack;
  const [index, setIndex] = useState(0);
  const [placed, setPlaced] = useState<number[]>([]);
  const [retries, setRetries] = useState(0);
  const [hint, setHint] = useState(false);
  const [feedback, setFeedback] = useState<'correct' | 'retry' | null>(null);
  const [firstTry, setFirstTry] = useState(0);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const started = useRef(performance.now());
  const submitting = useRef(false);
  const item = content.items[index];

  useEffect(() => {
    return () => { stopSpeaking(); };
  }, [index]);

  const shuffled = useMemo(() => {
    const shuffledIds = shuffle(item.words.map((_, i) => i));
    if (shuffledIds.length > 1 && shuffledIds.every((n, i) => n === i)) shuffledIds.reverse();
    return shuffledIds;
  }, [item]);

  const remaining = shuffled.filter(i => !placed.includes(i));

  async function check() {
    if (submitting.current || busy || feedback === 'correct' || placed.length !== item.words.length || done) return;
    setError('');
    submitting.current = true;
    setBusy(true);
    const correct = isCorrectSentence(item.words, placed);
    try {
      await onAttempt({
        attemptKey: `${item.id}:try:${retries + 1}`,
        itemId: item.id,
        objectiveId: item.objectiveId,
        correct,
        response: { kind: 'order', indices: [...placed] },
        hintsUsed: hint ? 1 : 0,
        elapsedMs: Math.max(0, Math.round(performance.now() - started.current))
      });
      setRetries(r => r + 1);
      setFeedback(correct ? 'correct' : 'retry');
      playFeedbackTone(correct ? 'success' : 'retry');
      if (correct && retries === 0 && !hint) setFirstTry(v => v + 1);
    } catch(failure) {
      setError(saveFailureMessage(failure));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  async function next() {
    if (submitting.current || busy || feedback !== 'correct') return;
    submitting.current = true;
    setBusy(true);
    if (index === content.items.length - 1) {
      try {
        await onComplete();
        setDone(true);
      } catch {
        setError('Không thể lưu kết quả hoàn thành.');
      }
    } else {
      setIndex(i => i + 1);
      setPlaced([]);
      setRetries(0);
      setFeedback(null);
      setHint(false);
      started.current = performance.now();
    }
    submitting.current = false;
    setBusy(false);
  }

  function resetPlaced() {
    setPlaced([]);
    setFeedback(null);
  }

  function insertToken(tokenIndex: number) {
    if (busy || feedback === 'correct' || placed.includes(tokenIndex)) return;
    setPlaced(prev => [...prev, tokenIndex]);
    setFeedback(null);
  }

  return (
    <section className="play-panel trail-panel world-stage world-math">
      <div className="stage-backdrop" aria-hidden="true" />
      <div className="stage-overlay" aria-hidden="true" />
      <div className="world-hud">
        <span className="hud-label">
          <span className="ba37-hud-symbol" aria-hidden="true">📶</span> ĐẢO TOÁN HỌC · BẬC THANG QUY LUẬT
        </span>
        <span className="hud-score">
          <span aria-hidden="true">★</span> {firstTry} bài đúng lần đầu
        </span>
      </div>

      <div className="trail-adventure-layout">
        <aside className="trail-guide">
          <GameMascot
            alt="Cáo nhỏ leo núi"
            mood={feedback === 'correct' ? 'happy' : feedback === 'retry' ? 'encourage' : 'idle'}
          />
          <div className="trail-speech">
            {feedback === 'correct'
              ? 'Tuyệt lắm! Con đã tìm đúng quy luật!'
              : 'Xếp các thẻ lên bậc thang theo đúng thứ tự nhé! ✨'}
          </div>
        </aside>

        <div className="trail-scroll">
          <div className="quest-progress">
            <span>BÀI {index + 1}/{content.items.length}</span>
            <span>📶 BẬC THANG LOGIC</span>
          </div>
          <div className="progress-track">
            <div style={{ width: `${((index + (feedback === 'correct' ? 1 : 0)) / content.items.length) * 100}%` }} />
          </div>

          <h2 className="trail-prompt" key={item.id}>
            {item.prompt}
            <button
              type="button"
              className="speech-trigger-btn"
              onClick={() => speakText(item.prompt, { lang: pack.subject === 'english' ? 'en-US' : 'vi-VN' })}
              aria-label="Nghe đọc đề bài"
              title="Nghe đọc đề bài"
            >
              🔊
            </button>
          </h2>
          <QuestionMedia key={`media-${item.id}`} media={item.media} showTranscript={feedback!==null}/><p className="trail-instruction">🏔️ Chạm hoặc kéo thẻ vào các bậc thang theo thứ tự quy luật</p>

          <div
            className="trail-mountain"
            aria-label="Bậc thang quy luật"
            onDragOver={e => e.preventDefault()}
            onDrop={e => {
              e.preventDefault();
              const rawIndex = e.dataTransfer.getData('text/plain');
              const indexToAdd = Number(rawIndex);
              if (/^(0|[1-9]\d*)$/.test(rawIndex) && Number.isInteger(indexToAdd) && indexToAdd >= 0 && indexToAdd < item.words.length) {
                insertToken(indexToAdd);
              }
            }}
          >
            {item.words.map((_, stepIdx) => {
              const placedWordIdx = placed[stepIdx];
              const hasWord = placedWordIdx !== undefined;
              return (
                <div key={stepIdx} className={`trail-step ${hasWord ? 'filled' : 'empty'} ${feedback === 'correct' ? 'step-correct' : ''}`}>
                  <span className="trail-step-num">Bậc {stepIdx + 1}</span>
                  {hasWord ? (
                    <button
                      type="button"
                      className="trail-tile placed"
                      aria-label={`Bỏ thẻ ${item.words[placedWordIdx]}`}
                      disabled={busy || feedback === 'correct'}
                      onClick={() => {
                        setPlaced(p => p.filter((_, j) => j !== stepIdx));
                        setFeedback(null);
                      }}
                    >
                      {item.words[placedWordIdx]} <span aria-hidden="true">×</span>
                    </button>
                  ) : (
                    <span className="trail-step-placeholder">…</span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="bank-label">🎒 TÚI THẺ QUY LUẬT CỦA CON</div>
          <div className="trail-bank" aria-label="Kho thẻ lựa chọn">
            {remaining.length === 0 && <span className="trail-empty-bank">✦ Tất cả thẻ đã được đặt lên bậc thang!</span>}
            {remaining.map(i => (
              <button
                key={i}
                type="button"
                draggable={!busy && feedback !== 'correct'}
                onDragStart={e => e.dataTransfer.setData('text/plain', String(i))}
                className="trail-tile in-bank"
                disabled={busy || feedback === 'correct'}
                onClick={() => insertToken(i)}
              >
                {item.words[i]}
              </button>
            ))}
          </div>

          <div className="trail-result-reserve" aria-live="polite" aria-atomic="true">
            <FeedbackEffects
              result={feedback === 'correct' ? 'success' : feedback === 'retry' ? 'retry' : null}
              eventKey={`${item.id}-${retries}`}
            />
            {error ? (
              <div className="notice error" role="alert">
                {error} <button onClick={() => setError('')}>Đóng</button> <button onClick={onExit}>Thoát</button>
              </div>
            ) : feedback === 'correct' ? (
              <div className="answer-feedback feedback-win">
                <strong>🌟 Chính xác! Quy luật hoàn toàn chuẩn xác!</strong>
                <p>
                  {item.words.join(' ➔ ')}{' '}
                  <button
                    type="button"
                    className="speech-trigger-btn"
                    onClick={() => speakText(item.words.join(', '), { lang: pack.subject === 'english' ? 'en-US' : 'vi-VN' })}
                    aria-label="Nghe đọc quy luật hoàn chỉnh"
                    title="Nghe đọc chuỗi"
                  >
                    🔊
                  </button>
                </p>
              </div>
            ) : feedback === 'retry' ? (
              <div className="answer-feedback feedback-retry">
                <strong>💡 Chưa đúng quy luật rồi.</strong>
                <p>Con quan sát kỹ mối liên hệ giữa các bước và thử sắp xếp lại nhé.</p>
              </div>
            ) : hint ? (
              <p className="trail-hint">💡 {item.hint}</p>
            ) : (
              <p className="trail-hint trail-empty-hint">✨ Đặt các thẻ theo đúng thứ tự quy luật để vượt qua thử thách.</p>
            )}
          </div>

          <div className="trail-actions stable-trail-actions">
            {feedback === 'correct' ? (
              <button
                className="button primary trail-main-action"
                onClick={() => void next()}
                disabled={busy}
              >
                {busy ? 'Đang lưu…' : index === content.items.length - 1 ? 'Nhận phần thưởng ⭐' : 'Bậc tiếp theo ➜'}
              </button>
            ) : feedback === 'retry' ? (
              <button className="button primary trail-main-action" onClick={resetPlaced}>
                ↺ Thử xếp lại
              </button>
            ) : (
              <>
                <button className="button outline" onClick={() => setHint(true)} disabled={hint || busy}>
                  💡 {hint ? 'Đã xem gợi ý' : 'Gợi ý'}
                </button>
                <button className="button outline" onClick={resetPlaced} disabled={busy || placed.length === 0}>
                  ↺ Xếp lại
                </button>
                <button
                  className="button primary trail-main-action"
                  onClick={() => void check()}
                  disabled={busy || placed.length !== item.words.length}
                >
                  {busy ? 'Đang lưu…' : '✓ Kiểm tra quy luật'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {done && (
        <GameCompletion
          title="Nhà thám hiểm quy luật!"
          summary={`${firstTry}/${content.items.length} bậc thang đúng ngay lần đầu. Con đã kiên trì chinh phục đỉnh núi tri thức!`}
          onExit={onExit}
        />
      )}
      <div className="world-particles" aria-hidden="true"><i/><i/><i/><i/><i/><i/></div>
      <div className="world-stage-bottom">
        <span>📶 Nhận diện quy luật • Tư duy logic • Chinh phục đỉnh cao</span>
        <span>✦ Bảo An Game World</span>
      </div>
    </section>
  );
}
