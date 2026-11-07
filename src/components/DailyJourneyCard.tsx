import type { OnlineStudentSummary, OnlineSummarySet, OnlinePackSummary } from '../core/online-contracts';
import type { ModuleId } from '../core/contracts';
import { Icon } from '../ui/Icon';

export interface DailyJourneyCardProps {
  currentWeek: OnlineStudentSummary['currentWeekSummary'] | null;
  currentSet: OnlineSummarySet | null;
  allSets?: OnlineSummarySet[];
  onContinue: () => void;
  onPlayGame?: (moduleId: ModuleId, pack: OnlinePackSummary) => Promise<void>;
  onOpenListView: () => void;
  disabled?: boolean;
}

export function DailyJourneyCard({
  currentWeek,
  currentSet,
  onContinue,
  onPlayGame,
  onOpenListView,
  disabled = false,
}: DailyJourneyCardProps) {
  const currentPack = currentSet?.pack;
  
  // Suggested game for the active pack
  const suggestedGame = currentSet?.games?.[0] ?? { id: 'math-quest' as ModuleId, label: 'Đảo Câu Hỏi' };
  
  const passedCount = currentWeek ? (currentWeek.total - currentWeek.zero - currentWeek.one) : 0;
  const totalCount = currentWeek?.total ?? (currentPack?.itemCount ?? 1);
  const progressPercent = Math.min(100, Math.round((passedCount / Math.max(1, totalCount)) * 100));
  const isWeekReady = currentWeek?.ready ?? false;

  const discoveryTitle = currentPack?.discovery?.title ?? 'Mở khóa địa danh mới trên bản đồ';

  return (
    <section
      className="daily-journey-card"
      data-hub-mode="light"
      aria-labelledby="daily-journey-title"
    >
      <div className="daily-journey-header">
        <div className="daily-journey-tag">
          <span className="daily-tag-pulse" aria-hidden="true" />
          <Icon name="sparkles" size={16} />
          <span>HÀNH TRÌNH HÔM NAY</span>
        </div>
        {currentWeek && (
          <span className="daily-week-badge">
            <Icon name="flag" size={14} />
            <span>{currentWeek.title}</span>
          </span>
        )}
      </div>

      <div className="daily-journey-title-group">
        <h3 id="daily-journey-title">
          {currentPack ? currentPack.title : (currentWeek?.title ?? 'Chuyến đi khám phá')}
        </h3>
        <p className="daily-journey-sub">
          {currentSet ? `${currentSet.subjectLabel} · ` : ''}
          {isWeekReady
            ? 'Con đã hoàn thành mục tiêu tuần! Có thể ôn luyện để đạt 3 sao.'
            : `Tiến độ tuần: ${passedCount}/${totalCount} câu đạt ít nhất 2 sao.`}
        </p>
      </div>

      {/* 3-Step Journey Sequence: Học -> Khám phá -> Chơi */}
      <ol className="daily-steps-list" aria-label="3 bước hành trình">
        <li className={`daily-step-item ${passedCount > 0 ? 'is-in-progress' : 'is-current'}`}>
          <div className="daily-step-badge">
            <Icon name="book" size={16} />
          </div>
          <div className="daily-step-content">
            <span className="daily-step-num">BƯỚC 1: HỌC</span>
            <strong>{currentPack?.title ?? 'Bộ câu hỏi tuần'}</strong>
            <div className="daily-progress-meter" role="progressbar" aria-label="Tiến độ đạt 2 sao của tuần" aria-valuenow={progressPercent} aria-valuemin={0} aria-valuemax={100}>
              <div className="daily-progress-fill" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
        </li>

        <li className={`daily-step-item ${isWeekReady ? 'is-unlocked' : ''}`}>
          <div className="daily-step-badge">
            <Icon name="compass" size={16} />
          </div>
          <div className="daily-step-content">
            <span className="daily-step-num">BƯỚC 2: KHÁM PHÁ</span>
            <strong>{discoveryTitle}</strong>
            <small>{isWeekReady ? '✨ Đã mở khóa tri thức!' : 'Hoàn thành bài để mở thẻ'}</small>
          </div>
        </li>

        <li className="daily-step-item">
          <div className="daily-step-badge">
            <Icon name="trophy" size={16} />
          </div>
          <div className="daily-step-content">
            <span className="daily-step-num">BƯỚC 3: CHƠI</span>
            <strong>{suggestedGame.label}</strong>
            <small>Luyện tập vui, tích lũy thêm sao</small>
          </div>
        </li>
      </ol>

      {/* Primary Actions */}
      <div className="daily-journey-actions">
        {currentPack && onPlayGame && suggestedGame ? (
          <button
            type="button"
            className="daily-primary-btn"
            disabled={disabled}
            onClick={() => void onPlayGame(suggestedGame.id, currentPack)}
          >
            <span className="daily-btn-icon" aria-hidden="true">▶</span>
            <span className="daily-btn-text">
              <strong>Tiếp tục học ngay</strong>{' '}
              <small>Chơi {suggestedGame.label} · {currentPack.itemCount} câu trong bộ</small>
            </span>
          </button>
        ) : (
          <button
            type="button"
            className="daily-primary-btn"
            disabled={disabled}
            onClick={onContinue}
          >
            <span className="daily-btn-icon" aria-hidden="true">▶</span>
            <span className="daily-btn-text">
              <strong>Tiếp tục chuyến đi</strong>
              <small>{currentWeek?.title ?? 'Bắt đầu học'}</small>
            </span>
          </button>
        )}

        <button
          type="button"
          className="daily-secondary-btn"
          disabled={disabled}
          onClick={onOpenListView}
          aria-label="Xem toàn bộ bài học tuần"
        >
          <Icon name="map" size={16} />
          <span>📋 Xem toàn bộ bài học tuần</span>
        </button>
      </div>
    </section>
  );
}

export default DailyJourneyCard;
