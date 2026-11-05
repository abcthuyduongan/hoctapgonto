// src/components/StreakDialog.tsx
import React from 'react';
import type { StudentStreakState } from '../core/online-contracts';
import '../styles/streak.css';

interface StreakDialogProps {
  streak: StudentStreakState | null | undefined;
  onClose: () => void;
}

export const StreakDialog: React.FC<StreakDialogProps> = ({ streak, onClose }) => {
  const currentStreak = streak?.currentStreak ?? 0;
  const longestStreak = streak?.longestStreak ?? 0;
  const todayCorrect = streak?.todayCorrectCount ?? 0;
  const target = 5;
  const progressPercent = Math.min(100, Math.floor((todayCorrect / target) * 100));

  return (
    <div className="streak-dialog-backdrop" onClick={onClose}>
      <div className="streak-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="streak-dialog-flame">🔥</div>
        <div className="streak-dialog-title">{currentStreak} Ngày Liên Tiếp</div>
        <div className="streak-dialog-sub">Kỷ lục cao nhất: {longestStreak} ngày</div>

        <div className="streak-progress-box">
          <div className="streak-progress-label">
            <span>Mục tiêu hôm nay</span>
            <span>{todayCorrect} / {target} câu đúng</span>
          </div>
          <div className="streak-progress-track">
            <div className="streak-progress-bar" style={{ width: `${progressPercent}%` }} />
          </div>
          <div className="streak-status-msg">
            {streak?.statusMessage || 'Làm đúng 5 câu mỗi ngày để duy trì chuỗi học tập!'}
          </div>
        </div>

        <div className="streak-freeze-box">
          <span style={{ fontSize: '1.25rem' }}>🛡️</span>
          <span>
            {streak?.canUseFreezeThisWeek
              ? 'Con có 1 ngày nghỉ phép tuần này: nếu lỡ nghỉ 1 ngày, chuỗi sẽ không bị ngắt!'
              : 'Con đã sử dụng quyền nghỉ phép tuần này rồi. Hãy chăm chỉ học đều nhé!'}
          </span>
        </div>

        <button className="streak-dialog-close" onClick={onClose}>
          Con Đã Hiểu! Cố Lên!
        </button>
      </div>
    </div>
  );
};
