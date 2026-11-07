import { Icon } from '../ui/Icon';
import type { DailyMission } from '../core/online-contracts';

export interface StudentBottomNavProps {
  activeTab?: 'map' | 'town' | 'contest' | 'missions' | 'shelf';
  onNavigateHome: () => void;
  onOpenMissions: () => void;
  onOpenTown: () => void;
  onOpenGiftShelf: () => void;
  onOpenContest: () => void;
  missions?: DailyMission[];
  disabled?: boolean;
  inert?: boolean;
}

export function StudentBottomNav({
  activeTab = 'map',
  onNavigateHome,
  onOpenMissions,
  onOpenTown,
  onOpenGiftShelf,
  onOpenContest,
  missions,
  disabled = false,
  inert = false,
}: StudentBottomNavProps) {
  const completedMissions = missions?.filter(m => m.completed).length ?? 0;

  return (
    <nav className="student-bottom-nav" aria-label="Thanh điều hướng học sinh" inert={inert}>
      <button
        type="button"
        className={`bottom-nav-item ${activeTab === 'map' ? 'is-active' : ''}`}
        aria-current={activeTab==='map'?'page':undefined}
        onClick={onNavigateHome}
        disabled={disabled}
        aria-label="Trang chủ và bản đồ học tập"
      >
        <span className="bottom-nav-icon" aria-hidden="true">
          <Icon name="map" size={22} />
        </span>
        <span className="bottom-nav-label">Bản đồ</span>
      </button>

      <button
        type="button"
        className={`bottom-nav-item missions-pill-btn ${activeTab==='missions'?'is-active':''}`}
        aria-current={activeTab==='missions'?'page':undefined}
        onClick={onOpenMissions}
        disabled={disabled}
        aria-label={`Xem nhiệm vụ ngày, đã hoàn thành ${completedMissions}/3`}
      >
        <span className="bottom-nav-icon" aria-hidden="true">
          <Icon name="star" size={22} />
        </span>
        <span className="bottom-nav-label">Nhiệm vụ</span>
        {completedMissions > 0 && (
          <span className="bottom-nav-badge" aria-hidden="true">
            {completedMissions}
          </span>
        )}
      </button>

      <button
        type="button"
        className={`bottom-nav-item town-pill-btn ${activeTab==='town'?'is-active':''}`}
        aria-current={activeTab==='town'?'page':undefined}
        onClick={onOpenTown}
        disabled={disabled}
        aria-label="Mở thị trấn của con"
      >
        <span className="bottom-nav-icon" aria-hidden="true">
          <Icon name="town" size={22} />
        </span>
        <span className="bottom-nav-label">Thị trấn</span>
      </button>

      <button
        type="button"
        className={`bottom-nav-item gifts-pill-btn ${activeTab==='shelf'?'is-active':''}`}
        aria-current={activeTab==='shelf'?'page':undefined}
        onClick={onOpenGiftShelf}
        disabled={disabled}
        aria-label="Mở Kệ quà và đổi thưởng"
      >
        <span className="bottom-nav-icon" aria-hidden="true">
          <Icon name="gift" size={22} />
        </span>
        <span className="bottom-nav-label">Kệ quà</span>
      </button>

      <button
        type="button"
        className={`bottom-nav-item contest-pill-btn ${activeTab==='contest'?'is-active':''}`}
        aria-current={activeTab==='contest'?'page':undefined}
        onClick={onOpenContest}
        disabled={disabled}
        aria-label="Mở phòng thi thử"
      >
        <span className="bottom-nav-icon" aria-hidden="true">
          <Icon name="sparkles" size={22} />
        </span>
        <span className="bottom-nav-label">Thi thử</span>
      </button>
    </nav>
  );
}

export default StudentBottomNav;
