import {useModalFocus} from '../ui/useModalFocus';
// src/components/BadgeShowcaseDialog.tsx
import React, { useEffect, useRef, useState } from 'react';
import type { StudentBadgeStatus } from '../core/online-contracts';
import { EmptyState } from '../ui/EmptyState';
import '../styles/badges.css';

interface BadgeShowcaseDialogProps {
  badges: StudentBadgeStatus[] | undefined;
  onClose: () => void;
}

export const BadgeShowcaseDialog: React.FC<BadgeShowcaseDialogProps> = ({
  badges = [],
  onClose,
}) => {
  const [filter, setFilter] = useState<'all' | 'unlocked' | 'locked'>('all');
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

  const unlockedCount = badges.filter((b) => b.unlocked).length;
  const totalCount = badges.length;

  const filteredBadges = badges.filter((b) => {
    if (filter === 'unlocked') return b.unlocked;
    if (filter === 'locked') return !b.unlocked;
    return true;
  });

  const getBadgeEmoji = (icon: string) => {
    switch (icon) {
      case 'flame': return '🔥';
      case 'refresh-cw': return '🔄';
      case 'sparkles': return '✨';
      case 'crown': return '👑';
      case 'compass': return '🧭';
      case 'zap': return '⚡';
      case 'rocket': return '🚀';
      case 'target': return '🎯';
      case 'calculator': return '🧮';
      case 'book-open': return '📖';
      case 'globe': return '🌍';
      case 'shield': return '🛡️';
      default: return '🎖️';
    }
  };

  const getDifficultyLabel = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'Dễ';
      case 'medium': return 'Trung bình';
      case 'hard': return 'Khó';
      default: return difficulty;
    }
  };

  return (
    <div className="badge-modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="badge-dialog"
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="badge-dialog-title-id"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="badge-dialog-header">
          <div className="badge-dialog-title" id="badge-dialog-title-id">
            <span>🎖️</span>
            <span>Sổ Huy Hiệu Của Con</span>
            <span className="badge-count-badge">
              {unlockedCount} / {totalCount} Đạt được
            </span>
          </div>
          <button className="badge-close-btn" onClick={onClose} aria-label="Đóng sổ huy hiệu">✕</button>
        </div>

        <div className="badge-tabs">
          <button
            className={`badge-tab-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            Tất cả ({totalCount})
          </button>
          <button
            className={`badge-tab-btn ${filter === 'unlocked' ? 'active' : ''}`}
            onClick={() => setFilter('unlocked')}
          >
            Đã đạt ({unlockedCount})
          </button>
          <button
            className={`badge-tab-btn ${filter === 'locked' ? 'active' : ''}`}
            onClick={() => setFilter('locked')}
          >
            Chưa mở ({totalCount - unlockedCount})
          </button>
        </div>

        <div className="badge-grid-container">
          {filteredBadges.length === 0 ? (
            <EmptyState
              icon="badge"
              title="Chưa có huy hiệu phù hợp"
              message={filter === 'unlocked' ? 'Con chưa mở khóa huy hiệu nào. Hãy tiếp tục học và rèn luyện mỗi ngày nhé!' : 'Không có huy hiệu nào trong mục này.'}
              actionLabel={filter !== 'all' ? 'Xem tất cả huy hiệu' : 'Đi học ngay'}
              onAction={() => {
                if (filter !== 'all') setFilter('all');
                else onClose();
              }}
            />
          ) : filteredBadges.map((b) => (
            <div
              key={b.id}
              className={`badge-card ${b.unlocked ? 'unlocked' : 'locked'}`}
            >
              <div className="badge-card-top">
                <div className="badge-icon-wrap">
                  <span>{getBadgeEmoji(b.icon)}</span>
                  {!b.unlocked && <div className="badge-lock-overlay">🔒</div>}
                </div>
                <div className="badge-header-info">
                  <div className="badge-title">{b.title}</div>
                  <span className={`badge-difficulty-tag difficulty-${b.difficulty}`}>
                    {getDifficultyLabel(b.difficulty)}
                  </span>
                </div>
              </div>

              <div className="badge-desc">{b.description}</div>

              <div className="badge-progress-wrap">
                <div className="badge-progress-bar">
                  <div
                    className="badge-progress-fill"
                    style={{ width: `${b.percent}%` }}
                  />
                </div>
                <div className="badge-missing-text">{b.missingRequirement}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
