import {useModalFocus} from '../ui/useModalFocus';
// src/components/DailyMissionDialog.tsx
import React, { useEffect, useRef, useState } from 'react';
import type { DailyMission, DailyRiddleQuestion } from '../core/online-contracts';
import { onlineApi } from '../core/online-client';
import '../styles/daily-missions.css';

interface DailyMissionDialogProps {
  missions: DailyMission[] | undefined;
  riddle: DailyRiddleQuestion | null | undefined;
  onClose: () => void;
  onRefreshSummary: () => void;
}

export const DailyMissionDialog: React.FC<DailyMissionDialogProps> = ({
  missions,
  riddle,
  onClose,
  onRefreshSummary,
}) => {
  const [showRiddle, setShowRiddle] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ correct: boolean; message: string } | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  useModalFocus(modalRef);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const handleAnswerSubmit = async () => {
    if (selectedAnswer === null || !riddle) return;
    setSubmitting(true);
    try {
      const res = await onlineApi.answerDailyRiddle(selectedAnswer);
      if (res.correct) {
        setFeedback({
          correct: true,
          message: '🎉 Chính xác! Con đã hoàn thành nhiệm vụ Câu đố hôm nay!',
        });
        onRefreshSummary();
      } else {
        setFeedback({
          correct: false,
          message: 'Chưa chính xác rồi, con hãy suy nghĩ kỹ và thử chọn lại nhé!',
        });
      }
    } catch (e: any) {
      setFeedback({
        correct: false,
        message: e?.message || 'Có lỗi xảy ra khi gửi đáp án.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="missions-modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="missions-dialog"
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="missions-dialog-title-id"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="missions-dialog-header">
          <div className="missions-dialog-title" id="missions-dialog-title-id">
            <span>📋</span>
            <span>Nhiệm Vụ Ngày (15 Phút)</span>
          </div>
          <button className="badge-close-btn" onClick={onClose} aria-label="Đóng nhiệm vụ ngày">✕</button>
        </div>

        <div className="missions-list">
          {(missions || []).map((m) => (
            <div key={m.id} className={`mission-card ${m.completed ? 'completed' : ''}`}>
              <div className="mission-status-icon">
                {m.completed ? '✓' : '⏳'}
              </div>
              <div className="mission-body">
                <div className="mission-title">{m.title}</div>
                <div className="mission-desc">{m.description}</div>
                <div className="mission-action-row">
                  <div className="mission-progress-label">
                    {m.completed
                      ? 'Đã hoàn thành'
                      : `Tiến độ: ${m.progressCount} / ${m.targetCount}`}
                  </div>
                  {m.type === 'daily_riddle' && !m.completed && riddle && !showRiddle && (
                    <button
                      className="mission-riddle-btn"
                      onClick={() => setShowRiddle(true)}
                    >
                      Giải đố ngay
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {showRiddle && riddle && (
            <div className="riddle-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.85rem', color: '#93c5fd', fontWeight: 700 }}>
                  🧩 Câu Đố Ngày: {riddle.packTitle}
                </span>
                <button
                  style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                  onClick={() => setShowRiddle(false)}
                >
                  Thu gọn ▲
                </button>
              </div>
              <div className="riddle-prompt">{riddle.prompt}</div>
              <div className="riddle-options-grid">
                {riddle.options.map((opt, idx) => (
                  <button
                    key={idx}
                    className={`riddle-option-btn ${selectedAnswer === idx ? 'selected' : ''}`}
                    disabled={submitting || feedback?.correct}
                    onClick={() => setSelectedAnswer(idx)}
                  >
                    {opt}
                  </button>
                ))}
              </div>

              {selectedAnswer !== null && !feedback?.correct && (
                <button
                  className="mission-riddle-btn"
                  style={{ marginTop: '0.75rem', width: '100%', padding: '0.6rem' }}
                  disabled={submitting}
                  onClick={handleAnswerSubmit}
                >
                  {submitting ? 'Đang kiểm tra...' : 'Nộp Đáp Án'}
                </button>
              )}

              {feedback && (
                <div className={`riddle-feedback ${feedback.correct ? 'correct' : 'wrong'}`}>
                  {feedback.message}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
