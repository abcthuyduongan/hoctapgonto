// src/screens/ContestMockScreen.tsx
// Màn hình Chế độ thi thử Violympic & IOE - Tuần 7 - Cổng C7

import React, { useState, useEffect, useRef } from 'react';
import type { ContentPack } from '../core/contracts';
import type { ContestPreset, ContestResult } from '../core/contest-matrix';
import { CONTEST_DISCLAIMER } from '../core/contest-matrix';
import type { ActiveContestSession, ContestHistoryAttempt } from '../core/online-contracts';
import { onlineApi } from '../core/online-client';
import '../styles/contest-mock.css';

interface ContestMockScreenProps {
  onClose: () => void;
  onStartPracticeWithPack?: (pack: ContentPack) => void;
  initialPresetId?: string;
}

export const ContestMockScreen: React.FC<ContestMockScreenProps> = ({
  onClose,
  onStartPracticeWithPack,
  initialPresetId
}) => {
  const [viewMode, setViewMode] = useState<'select' | 'exam' | 'result'>('select');
  const [presets, setPresets] = useState<ContestPreset[]>([]);
  const [history, setHistory] = useState<ContestHistoryAttempt[]>([]);
  const [readyForExam, setReadyForExam] = useState<boolean>(false);
  const [consecutiveCount, setConsecutiveCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Active exam state
  const [activeSession, setActiveSession] = useState<ActiveContestSession | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [skippedKeys, setSkippedKeys] = useState<string[]>([]);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const revisionRef = useRef<number>(0);
  const answersRef = useRef<Record<string, any>>({});
  const skippedKeysRef = useRef<string[]>([]);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState<boolean>(false);

  // Exam result state
  const [contestResult, setContestResult] = useState<ContestResult | null>(null);

  const timerRef = useRef<any>(null);

  // Load presets, history, and active exam on mount
  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        setLoading(true);
        const [presetList, activeRes, histRes] = await Promise.all([
          onlineApi.contestPresets(),
          onlineApi.activeContest().catch(() => ({ active: false as const, session: undefined, lastResult: undefined })),
          onlineApi.contestHistory().catch(() => ({ attempts: [], readyForExam: false, consecutiveCount: 0 }))
        ]);

        if (cancelled) return;
        setPresets(presetList);
        setHistory(histRes.attempts || []);
        setReadyForExam(!!histRes.readyForExam);
        setConsecutiveCount(histRes.consecutiveCount || 0);

        const act = activeRes as { active: boolean; session?: ActiveContestSession; lastResult?: ContestResult };
        if (act.active && act.session) {
          const sess = act.session;
          setActiveSession(sess);
          setRemainingSeconds(sess.remainingSeconds);
          setAnswers(sess.answers || {});
          answersRef.current = sess.answers || {};
          setSkippedKeys(sess.skippedKeys || []);
          skippedKeysRef.current = sess.skippedKeys || [];
          setViewMode('exam');
        } else if (initialPresetId && typeof document !== 'undefined') {
          setTimeout(() => {
            const card = document.getElementById(`preset-card-${initialPresetId}`);
            card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 100);
        } else if (act.lastResult) {
          setContestResult(act.lastResult);
          setViewMode('result');
        }
      } catch (err: any) {
        if (!cancelled) setErrorMsg(err.message || 'Không thể tải dữ liệu thi thử.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    init();
    return () => { cancelled = true; };
  }, []);

  // Countdown timer effect
  useEffect(() => {
    if (viewMode !== 'exam' || !activeSession) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setRemainingSeconds(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleTimeOutSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [viewMode, activeSession]);

  const handleTimeOutSubmit = async () => {
    if (!activeSession || submitting) return;
    try {
      setSubmitting(true);
      const res = await onlineApi.submitContest(activeSession.sessionId, { answers: answersRef.current });
      setContestResult(res);
      setViewMode('result');
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi tự động nộp bài hết giờ.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartPreset = async (presetId: string) => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const sess = await onlineApi.startContest({ presetId });
      setActiveSession(sess);
      setRemainingSeconds(sess.remainingSeconds);
      setAnswers(sess.answers || {});
      answersRef.current = sess.answers || {};
      setSkippedKeys(sess.skippedKeys || []);
      skippedKeysRef.current = sess.skippedKeys || [];
      setCurrentIndex(0);
      setViewMode('exam');
    } catch (err: any) {
      setErrorMsg(err.message || 'Không thể bắt đầu lượt thi.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAnswer = (itemId: string, val: any) => {
    const nextAnswers = { ...answersRef.current, [itemId]: val };
    answersRef.current = nextAnswers;
    setAnswers(nextAnswers);
    const nextSkipped = skippedKeysRef.current.filter(k => k !== itemId);
    skippedKeysRef.current = nextSkipped;
    setSkippedKeys(nextSkipped);
    if (activeSession) {
      revisionRef.current += 1;
      const currentRev = revisionRef.current;
      setSaveStatus('saving');
      onlineApi.saveContestProgress(activeSession.sessionId, {
        answers: nextAnswers,
        skippedKeys: nextSkipped,
        revision: currentRev,
        seq: currentRev
      }).then(() => {
        if (revisionRef.current === currentRev) setSaveStatus('saved');
      }).catch((err: any) => {
        setSaveStatus('error');
        setErrorMsg('Lỗi lưu bài tự động: ' + (err?.message || 'vui lòng kiểm tra mạng.'));
      });
    }
  };

  const handleSkipQuestion = (itemId: string) => {
    const nextSkipped = Array.from(new Set([...skippedKeysRef.current, itemId]));
    skippedKeysRef.current = nextSkipped;
    setSkippedKeys(nextSkipped);
    if (activeSession) {
      revisionRef.current += 1;
      const currentRev = revisionRef.current;
      setSaveStatus('saving');
      onlineApi.saveContestProgress(activeSession.sessionId, {
        answers: answersRef.current,
        skippedKeys: nextSkipped,
        revision: currentRev,
        seq: currentRev
      }).then(() => {
        if (revisionRef.current === currentRev) setSaveStatus('saved');
      }).catch((err: any) => {
        setSaveStatus('error');
        setErrorMsg('Lỗi lưu bài tự động: ' + (err?.message || 'vui lòng kiểm tra mạng.'));
      });
    }
    if (activeSession && currentIndex < activeSession.items.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleSubmitExam = async () => {
    if (!activeSession || submitting) return;
    try {
      setSubmitting(true);
      setShowSubmitConfirm(false);
      const res = await onlineApi.submitContest(activeSession.sessionId, { answers: answersRef.current });
      setContestResult(res);
      setViewMode('result');

      // Refresh history
      const histRes = await onlineApi.contestHistory().catch(() => null);
      if (histRes) {
        setHistory(histRes.attempts || []);
        setReadyForExam(!!histRes.readyForExam);
        setConsecutiveCount(histRes.consecutiveCount || 0);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Không thể nộp bài.');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePracticeMistakes = async () => {
    if (!contestResult) return;
    try {
      setLoading(true);
      const pack = await onlineApi.contestReviewPack(contestResult.sessionId);
      if (onStartPracticeWithPack) {
        onStartPracticeWithPack(pack);
      } else {
        alert('Đã sẵn sàng gói ôn tập ' + pack.title);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Không thể tạo gói ôn tập câu sai.');
    } finally {
      setLoading(false);
    }
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="contest-screen-root" data-testid="contest-screen-root">
      {/* 1. Sticky Disclaimer Banner */}
      <div className="contest-disclaimer-banner" role="note">
        <span aria-hidden="true">ℹ️</span>
        <strong>{CONTEST_DISCLAIMER}</strong>
      </div>

      {/* 2. Header */}
      <header className="contest-header">
        <div className="contest-header-left">
          <button className="contest-back-btn" onClick={onClose}>
            {viewMode === 'exam' ? '✕ Thoát phòng thi' : '← Về Bản đồ'}
          </button>
          <div className="contest-title-wrap">
            <h1>
              {viewMode === 'exam' && activeSession
                ? activeSession.preset.title
                : 'Phòng Thi Thử Học Sinh Giỏi'}
            </h1>
            {viewMode === 'exam' && activeSession && (
              <span className="contest-subject-tag">
                {activeSession.preset.subject === 'math' ? 'Toán học lớp 3' : 'Tiếng Anh lớp 3'}
              </span>
            )}
          </div>
        </div>

        {viewMode === 'exam' && (
          <div className="contest-header-right">
            <div className={`contest-timer-pill ${remainingSeconds < 180 ? 'urgent' : ''}`} data-testid="contest-timer-pill">
              ⏱ {formatTimer(remainingSeconds)}
            </div>
            <div className={`autosave-status-badge autosave-${saveStatus}`} role="status" aria-live="polite">
              {saveStatus === 'saving' && '⏳ Đang lưu…'}
              {saveStatus === 'saved' && '✓ Đã lưu'}
              {saveStatus === 'error' && '⚠️ Chưa lưu được'}
            </div>
            <button
              className="action-btn submit"
              onClick={() => setShowSubmitConfirm(true)}
              disabled={submitting}
            >
              🏁 Nộp bài
            </button>
          </div>
        )}
      </header>

      {errorMsg && (
        <div className="contest-error-banner" role="alert">
          {errorMsg}
        </div>
      )}

      {/* 3. Main Views */}
      {viewMode === 'select' && (
        <div className="contest-preset-container">
          <div className="contest-hero">
            <h2>Luyện thi Violympic &amp; IOE Lớp 3</h2>
            <p>Trải nghiệm áp lực phòng thi thật với đồng hồ đếm ngược, cấu trúc ma trận chuẩn và không dùng gợi ý.</p>
          </div>

          {/* Readiness Milestone Box */}
          <div className="contest-readiness-card">
            <div className="contest-readiness-left">
              <span className="readiness-icon">{readyForExam ? '🏆' : '🎯'}</span>
              <div className="readiness-text">
                <h3>{readyForExam ? 'Con Đã Sẵn Sàng Dự Thi!' : 'Mục Tiêu: Sẵn Sàng Dự Thi'}</h3>
                <p>
                  {readyForExam
                    ? 'Xuất sắc! Con đã hoàn thành liên tiếp 3 đề đạt từ 80% điểm trở lên.'
                    : `Cần đạt từ 80% điểm ở 3 đề thi liên tiếp. Hiện đạt: ${consecutiveCount}/3 đề.`}
                </p>
              </div>
            </div>
            <span className={`readiness-badge-pill ${readyForExam ? 'ready' : 'not-ready'}`}>
              {readyForExam ? '✓ Đã đạt mốc' : `${consecutiveCount}/3 đề liên tiếp`}
            </span>
          </div>

          {/* Preset Cards Grid */}
          <div className="contest-preset-grid">
            {presets.map(p => (
              <div
                key={p.id}
                id={`preset-card-${p.id}`}
                className={`contest-preset-card ${initialPresetId === p.id ? 'is-selected' : ''}`}
                data-testid={`preset-card-${p.id}`}
              >
                <div className="preset-card-header">
                  <div className={`preset-card-icon ${p.subject}`}>
                    {p.subject === 'math' ? '📐' : '🇬🇧'}
                  </div>
                  <div>
                    <h3>{p.title}</h3>
                    <span className="preset-contest-sub">
                      Kỳ thi: {p.contest.toUpperCase()}
                    </span>
                  </div>
                </div>

                <p className="preset-card-desc">{p.description}</p>

                <div className="preset-card-specs">
                  <div className="spec-item">
                    <span className="spec-label">Thời gian</span>
                    <span className="spec-val">{p.durationSeconds / 60} phút</span>
                  </div>
                  <div className="spec-item">
                    <span className="spec-label">Số câu</span>
                    <span className="spec-val">{p.totalQuestions} câu</span>
                  </div>
                  <div className="spec-item">
                    <span className="spec-label">Điểm tối đa</span>
                    <span className="spec-val">{p.maxScore} đ</span>
                  </div>
                  <div className="spec-item">
                    <span className="spec-label">Mốc đạt</span>
                    <span className="spec-val">{p.passPercent}%</span>
                  </div>
                </div>

                <button
                  className="preset-start-btn"
                  onClick={() => handleStartPreset(p.id)}
                  disabled={loading}
                >
                  🚀 Bắt đầu làm bài
                </button>
              </div>
            ))}
          </div>

          {/* Recent History Table */}
          {history.length > 0 && (
            <div className="contest-history-card">
              <h3>📊 Lịch sử các lần thi thử gần đây</h3>
              <div className="contest-history-list">
                {history.slice(0, 5).map((att, i) => (
                  <div key={i} className="contest-history-item">
                    <div>
                      <strong className="contest-history-title">{att.presetTitle}</strong>
                      <div className="contest-history-meta">
                        {new Date(att.submittedAt).toLocaleString('vi-VN')} · {Math.round(att.elapsedMs / 1000)} giây
                      </div>
                    </div>
                    <div>
                      <span className={`contest-history-score ${att.passed ? 'passed' : 'failed'}`}>
                        {att.score}/{att.maxScore} ({att.percent}%)
                      </span>
                      <div className={`contest-history-status ${att.passed ? 'passed' : 'failed'}`}>
                        {att.passed ? 'ĐẠT' : 'CHƯA ĐẠT'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. Active Exam View */}
      {viewMode === 'exam' && activeSession && (
        <div className="contest-exam-body">
          {/* Question Navigator Bar */}
          <div className="contest-question-strip" data-testid="contest-question-strip">
            {activeSession.items.map((item, idx) => {
              const isAnswered = answers[item.id] !== undefined && answers[item.id] !== '';
              const isSkipped = skippedKeys.includes(item.id);
              const isCurrent = idx === currentIndex;
              return (
                <button
                  key={item.id}
                  className={`question-nav-btn ${isCurrent ? 'current' : ''} ${isAnswered ? 'answered' : ''} ${isSkipped ? 'skipped' : ''}`}
                  onClick={() => setCurrentIndex(idx)}
                  title={`Câu ${idx + 1}`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          {/* Current Question Card */}
          {activeSession.items[currentIndex] && (
            <div className="contest-question-card" data-testid="contest-question-card">
              <div className="question-card-meta">
                <span className="question-number-pill">
                  Câu hỏi {currentIndex + 1} / {activeSession.items.length}
                </span>
                <span className="question-status-pill">
                  {answers[activeSession.items[currentIndex].id] !== undefined && answers[activeSession.items[currentIndex].id] !== ''
                    ? '✓ Đã chọn đáp án'
                    : skippedKeys.includes(activeSession.items[currentIndex].id)
                    ? '↷ Đã tạm bỏ qua'
                    : 'Chưa trả lời'}
                </span>
              </div>

              <div className="question-prompt-text">
                {activeSession.items[currentIndex].prompt}
              </div>

              {/* Render Choice Options */}
              {activeSession.items[currentIndex].kind === 'choice' && activeSession.items[currentIndex].options && (
                <div className="contest-options-grid">
                  {activeSession.items[currentIndex].options.map((opt, optIdx) => {
                    const letters = ['A', 'B', 'C', 'D'];
                    const isSelected = String(answers[activeSession.items[currentIndex].id]) === String(opt);
                    return (
                      <button
                        key={optIdx}
                        className={`contest-option-btn ${isSelected ? 'selected' : ''}`}
                        onClick={() => handleSelectAnswer(activeSession.items[currentIndex].id, opt)}
                      >
                        <span className="option-letter-badge">{letters[optIdx] || optIdx + 1}</span>
                        <span>{opt}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Render Fill Input */}
              {activeSession.items[currentIndex].kind === 'fill' && (
                <div className="contest-fill-box">
                  <input
                    type="text"
                    className="contest-fill-input"
                    placeholder="Nhập câu trả lời của con..."
                    value={answers[activeSession.items[currentIndex].id] ?? ''}
                    onChange={e => handleSelectAnswer(activeSession.items[currentIndex].id, e.target.value)}
                  />
                </div>
              )}

              {/* Bottom Actions Row */}
              <div className="contest-question-actions">
                <button
                  className="action-btn secondary"
                  onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                  disabled={currentIndex === 0}
                >
                  ⬅ Câu trước
                </button>

                <button
                  className="action-btn skip"
                  onClick={() => handleSkipQuestion(activeSession.items[currentIndex].id)}
                >
                  Bỏ qua câu này ↷
                </button>

                {currentIndex < activeSession.items.length - 1 ? (
                  <button
                    className="action-btn primary"
                    onClick={() => setCurrentIndex(currentIndex + 1)}
                  >
                    Câu sau ➡
                  </button>
                ) : (
                  <button
                    className="action-btn submit"
                    onClick={() => setShowSubmitConfirm(true)}
                  >
                    Hoàn thành bài thi 🏁
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Submit Confirmation Modal */}
      {showSubmitConfirm && activeSession && (
        <div className="contest-confirm-backdrop" role="dialog" aria-modal="true" aria-label="Xác nhận nộp bài thi">
          <div className="contest-confirm-dialog">
            <h3>Xác nhận nộp bài thi</h3>
            <p>
              Con đã trả lời {Object.keys(answers).filter(k => answers[k] !== undefined && answers[k] !== '').length} / {activeSession.items.length} câu hỏi.
              <br />
              Con có chắc chắn muốn nộp bài ngay bây giờ không?
            </p>
            <div className="contest-confirm-actions">
              <button
                className="action-btn secondary"
                onClick={() => setShowSubmitConfirm(false)}
                disabled={submitting}
              >
                Tiếp tục làm bài
              </button>
              <button
                className="action-btn submit"
                onClick={handleSubmitExam}
                disabled={submitting}
              >
                {submitting ? 'Đang nộp...' : 'Đồng ý nộp bài'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Results Screen */}
      {viewMode === 'result' && contestResult && (
        <div className="contest-results-main">
          <div className="contest-results-card" data-testid="contest-results-card">
            <div className={`results-status-badge ${contestResult.passed ? 'passed' : 'failed'}`}>
              {contestResult.passed ? '🎉 ĐẠT YÊU CẦU' : '💪 CẦN CỐ GẮNG THÊM'}
            </div>

            <div className="results-big-score">
              {contestResult.score} / {contestResult.maxScore}
            </div>
            <div className="results-score-subtitle">
              Đạt {contestResult.percent}% số điểm tối đa
            </div>

            <div className="results-metrics-row">
              <div className="metric-box">
                <div className="metric-val">{contestResult.correctCount} / {contestResult.totalItems}</div>
                <div className="metric-lbl">Số câu đúng</div>
              </div>
              <div className="metric-box">
                <div className="metric-val">{Math.round(contestResult.elapsedMs / 1000)}s</div>
                <div className="metric-lbl">Thời gian làm</div>
              </div>
              <div className="metric-box">
                <div className="metric-val">{contestResult.finishReason === 'timeout' ? 'Hết giờ' : 'Nộp bài'}</div>
                <div className="metric-lbl">Trạng thái kết thúc</div>
              </div>
            </div>

            {/* Badge Award Alert */}
            {contestResult.badgeAwarded && (
              <div className="contest-badge-award-alert">
                <span>🏅</span>
                <span>Chúc mừng con đã xuất sắc nhận được huy hiệu <strong>"Thí sinh"</strong>!</span>
              </div>
            )}

            {/* Readiness Milestone */}
            <div className="readiness-banner">
              🎯 <strong>Mốc sẵn sàng dự thi:</strong> {contestResult.readyForExam ? 'Đã đạt xuất sắc!' : 'Con cần 3 đề liên tiếp đạt >= 80% để chính thức sẵn sàng.'}
            </div>

            {/* Mistake Review Section */}
            {contestResult.mistakes.length > 0 && (
              <div className="contest-mistakes-container">
                <h3>🔍 Xem lại và chữa {contestResult.mistakes.length} câu làm sai:</h3>
                {contestResult.mistakes.map((m, idx) => (
                  <div key={idx} className="mistake-card">
                    <div className="mistake-prompt">Câu {idx + 1}: {m.prompt}</div>
                    <div className="mistake-answers-row">
                      <span className="mistake-user-ans">
                        Con chọn: <strong>{m.studentAnswer ?? '(Chưa chọn)'}</strong>
                      </span>
                      <span className="mistake-correct-ans">
                        Đáp án đúng: <strong>{m.correctAnswer}</strong>
                      </span>
                    </div>
                    <div className="mistake-explanation">
                      💡 <strong>Giải thích:</strong> {m.explanation}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Action Buttons */}
            <div className="results-action-buttons">
              {contestResult.mistakes.length > 0 && (
                <button
                  className="review-errors-btn"
                  onClick={handlePracticeMistakes}
                  data-testid="review-errors-btn"
                >
                  📝 Ôn các câu sai ngay
                </button>
              )}

              <button
                className="action-btn primary"
                onClick={() => setViewMode('select')}
              >
                🔄 Làm đề thi khác
              </button>

              <button
                className="action-btn secondary"
                onClick={onClose}
              >
                ← Quay về Bản đồ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
