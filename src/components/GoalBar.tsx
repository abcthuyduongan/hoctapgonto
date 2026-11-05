import type {StudentGoal} from '../core/online-contracts';
import '../styles/goal-bar.css';

interface GoalBarProps {
  goal: StudentGoal | null;
  availableStars: number;
  onOpenShelf: () => void;
  disabled?: boolean;
}

export default function GoalBar({goal, availableStars, onOpenShelf, disabled}: GoalBarProps) {
  const currentStars = availableStars;
  const targetStars = goal?.gift?.priceStars ?? goal?.targetStars ?? 0;
  const giftTitle = goal?.gift?.title ?? goal?.giftTitle ?? '';
  const remaining = Math.max(0, targetStars - currentStars);
  const percent = targetStars > 0 ? Math.min(100, Math.round((currentStars / targetStars) * 100)) : 0;
  const isReached = goal !== null && targetStars > 0 && remaining === 0;

  return (
    <section className="student-goal-bar" aria-label="Mục tiêu quà tặng của con">
      <div className="goal-bar-container">
        <div className="goal-bar-info">
          <span className="goal-bar-icon" aria-hidden="true">
            {goal ? '🎯' : '🎁'}
          </span>
          <div className="goal-bar-copy">
            {goal && giftTitle ? (
              <>
                <div className="goal-bar-title-line">
                  <span className="goal-bar-kicker">MỤC TIÊU PHẤN ĐẤU:</span>
                  <strong className="goal-bar-target-name">{giftTitle}</strong>
                </div>
                <p className="goal-bar-status-text">
                  {isReached ? (
                    <span className="goal-reached-text">🎉 Tuyệt vời! Con đã đủ {targetStars} sao để đổi quà rồi!</span>
                  ) : (
                    <span>Còn <strong>{remaining}</strong> sao nữa là đổi được món quà này!</span>
                  )}
                </p>
              </>
            ) : (
              <>
                <span className="goal-bar-kicker">CHƯA CHỌN MỤC TIÊU</span>
                <p className="goal-bar-status-text">
                  Ghim một món quà trên <strong>Kệ quà</strong> để cùng phấn đấu mỗi ngày nhé!
                </p>
              </>
            )}
          </div>
        </div>

        {goal && targetStars > 0 && (
          <div className="goal-bar-progress-wrap" aria-label={`Tiến độ: ${currentStars}/${targetStars} sao (${percent}%)`}>
            <div className="goal-bar-meter-track">
              <div
                className={`goal-bar-meter-fill ${isReached ? 'is-complete' : ''}`}
                style={{width: `${percent}%`}}
              />
              <span className="goal-bar-meter-sparkle" style={{left: `${percent}%`}} aria-hidden="true">
                ⭐
              </span>
            </div>
            <span className="goal-bar-fraction">
              {currentStars} / {targetStars} ⭐ ({percent}%)
            </span>
          </div>
        )}

        <div className="goal-bar-action">
          <button
            type="button"
            className={`goal-bar-btn ${isReached ? 'goal-btn-redeem' : 'goal-btn-shelf'}`}
            onClick={onOpenShelf}
            disabled={disabled}
            aria-label={isReached ? `Đổi ngay ${giftTitle}` : 'Mở Kệ quà tặng'}
          >
            {isReached ? '🎁 Đổi quà ngay' : '🎁 Kệ quà'}
          </button>
        </div>
      </div>
    </section>
  );
}
