import { useState, useRef, useEffect } from 'react';
import type { OnlineIdentity, OnlineStudentSummary } from '../core/online-contracts';
import { Icon } from '../ui/Icon';

export interface StudentHeaderProps {
  identity: OnlineIdentity;
  state: OnlineStudentSummary | null;
  mapMode: 'map' | 'list';
  activeSection?: 'map' | 'town' | 'contest';
  isMobile?: boolean;
  onToggleMap: () => void;
  onOpenTown: () => void;
  onOpenContest: () => void;
  onOpenStreak: () => void;
  onOpenMissions: () => void;
  onOpenBadges: () => void;
  onOpenNotebook: () => void;
  onOpenParentPin: () => void;
  onOpenWallet: () => void;
  soundOn: boolean;
  onToggleSound: () => void;
  motionOn: boolean;
  onToggleMotion: () => void;
  onOpenPassword: () => void;
  onLogout: () => Promise<void>;
  unlockedDiscoveryCount: number;
  disabled?: boolean;
  inert?: boolean;
}

export function StudentHeader({
  identity,
  state,
  mapMode,
  activeSection = 'map',
  isMobile = false,
  onToggleMap,
  onOpenTown,
  onOpenContest,
  onOpenStreak,
  onOpenMissions,
  onOpenBadges,
  onOpenNotebook,
  onOpenParentPin,
  onOpenWallet,
  soundOn,
  onToggleSound,
  motionOn,
  onToggleMotion,
  onOpenPassword,
  onLogout,
  unlockedDiscoveryCount,
  disabled = false,
  inert = false,
}: StudentHeaderProps) {
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const accountButtonRef = useRef<HTMLButtonElement>(null);
  const closeAccountMenu = () => {
    setAccountMenuOpen(false);
    accountButtonRef.current?.focus({preventScroll:true});
  };

  useEffect(() => {
    if (!accountMenuOpen) return;
    menuRef.current?.querySelector<HTMLButtonElement>('.account-menu-popover button:not(:disabled)')?.focus();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {e.preventDefault();closeAccountMenu();}
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [accountMenuOpen]);

  const studentName = state?.student.name ?? identity.user.username;
  const className = state?.className ? ` · ${state.className}` : '';
  const missionsCompleted = state?.dailyMissions?.filter(m => m.completed).length ?? 0;
  const badgesUnlocked = state?.badges?.filter(b => b.unlocked).length ?? 0;
  const badgesTotal = state?.badges?.length ?? 12;

  return (
    <header className="student-topbar" inert={inert}>
      <div className="student-brand-group">
        <a href="?online=1" className="student-brand" aria-label="Bảo An Learning - Về trang chủ">
          ✦ BẢO AN <span>LEARNING</span>
        </a>
        <div className="student-identity-meta">
          <strong>{identity.workspace.name}</strong>
          <span>{studentName}{className}</span>
        </div>
      </div>

      {/* Central Navigation Tabs on Desktop (64px) */}
      {!isMobile && (
        <nav className="student-desktop-nav" aria-label="Điều hướng chính">
          <button
            type="button"
            className={`student-nav-btn ${activeSection === 'map' && mapMode === 'map' ? 'is-active' : ''}`}
            onClick={onToggleMap}
            disabled={disabled}
          >
            <Icon name="map" size={18} />
            <span>Bản đồ</span>
          </button>

          {state?.dailyMissions && (
            <button
              type="button"
              className="student-nav-btn missions-pill-btn"
              onClick={onOpenMissions}
              disabled={disabled}
              title="Xem nhiệm vụ ngày"
            >
              <Icon name="star" size={18} />
              <span>Nhiệm vụ ({missionsCompleted}/3)</span>
            </button>
          )}

          <button
            type="button"
            className={`student-nav-btn town-pill-btn ${activeSection === 'town' ? 'is-active' : ''}`}
            onClick={onOpenTown}
            disabled={disabled}
            title="Thị trấn của con"
            aria-label="Mở thị trấn của con"
          >
            <Icon name="town" size={18} />
            <span>Thị trấn</span>
          </button>

          <button
            type="button"
            className={`student-nav-btn contest-pill-btn ${activeSection === 'contest' ? 'is-active' : ''}`}
            onClick={onOpenContest}
            disabled={disabled}
            title="Phòng luyện thi thử Violympic & IOE"
            aria-label="Mở phòng thi thử"
          >
            <Icon name="sparkles" size={18} />
            <span>Thi thử</span>
          </button>
        </nav>
      )}

      {/* Right Actions & Status Chips */}
      <div className="student-actions-group">
        {state && (
          <button
            type="button"
            className="student-stat-pill star-pill"
            onClick={onOpenWallet}
            disabled={disabled}
            title="Xem ví đổi sao của con"
            aria-label={`Số sao của con: ${state.balance.available} sao`}
          >
            <span aria-hidden="true">⭐</span>
            <strong>{state.balance.available} sao</strong>
          </button>
        )}

        {state?.streak && (
          <button
            type="button"
            className="student-stat-pill streak-pill-btn"
            onClick={onOpenStreak}
            disabled={disabled}
            title="Xem chuỗi ngày học tập"
            aria-label={`Chuỗi ${state.streak.currentStreak} ngày học tập`}
          >
            <span className="streak-flame-icon" aria-hidden="true">🔥</span>
            <span>{state.streak.currentStreak} Ngày</span>
          </button>
        )}

        {!isMobile && (
          <>
            <button
              type="button"
              className="student-stat-pill online-notebook-btn"
              onClick={onOpenNotebook}
              disabled={disabled}
              title="Mở Sổ khám phá"
              aria-label="Mở Sổ khám phá"
            >
              <Icon name="book" size={18} />
              <span>Sổ khám phá{unlockedDiscoveryCount > 0 ? ` (${unlockedDiscoveryCount})` : ''}</span>
            </button>

            <button
              type="button"
              className="student-stat-pill parent-portal-pill-btn"
              onClick={onOpenParentPin}
              disabled={disabled}
              title="Khu vực dành cho Phụ huynh"
              aria-label="Mở khu phụ huynh"
            >
              <Icon name="parent" size={18} />
              <span>Phụ huynh</span>
            </button>
          </>
        )}

        {/* Account Menu Popover (Desktop & Mobile) */}
        <div className="account-menu-wrapper" ref={menuRef}>
          <button
            ref={accountButtonRef}
            type="button"
            className="account-menu-trigger"
            onClick={() => setAccountMenuOpen(prev => !prev)}
            aria-expanded={accountMenuOpen}
            aria-controls="student-account-options"
            title="Menu tài khoản và cài đặt của con"
            aria-label={`Mở tùy chọn tài khoản ${studentName}`}
          >
            <Icon name="user" size={18} aria-hidden="true" />
            <span>{studentName} <span aria-hidden="true">▾</span></span>
          </button>

          {accountMenuOpen && (
            <>
              <div
                className="account-menu-backdrop"
                onClick={closeAccountMenu}
                aria-hidden="true"
              />
              <div id="student-account-options" className="account-menu-popover" aria-label="Tùy chọn tài khoản">
                <div className="account-menu-header">
                  <strong>{studentName}</strong>
                  <span>{identity.workspace.name}{className}</span>
                </div>

                <div className="account-menu-actions">
                  {isMobile && (
                    <>
                      <button
                        type="button"
                        className="account-menu-item online-notebook-btn"
                        disabled={disabled}
                        onClick={() => {
                          closeAccountMenu();
                          onOpenNotebook();
                        }}
                        aria-label="Mở Sổ khám phá"
                      >
                        <Icon name="book" size={18} />
                        <span>Sổ khám phá{unlockedDiscoveryCount > 0 ? ` (${unlockedDiscoveryCount})` : ''}</span>
                      </button>

                      <button
                        type="button"
                        className="account-menu-item parent-portal-pill-btn"
                        disabled={disabled}
                        onClick={() => {
                          closeAccountMenu();
                          onOpenParentPin();
                        }}
                        aria-label="Mở khu phụ huynh"
                      >
                        <Icon name="parent" size={18} />
                        <span>Khu phụ huynh</span>
                      </button>
                    </>
                  )}

                  {state?.badges && (
                    <button
                      type="button"
                      className="account-menu-item badges-pill-btn"
                      disabled={disabled}
                      onClick={() => {
                        closeAccountMenu();
                        onOpenBadges();
                      }}
                    >
                      <Icon name="badge" size={18} />
                      <span>Sổ huy hiệu ({badgesUnlocked}/{badgesTotal})</span>
                    </button>
                  )}

                  <button
                    type="button"
                    className="account-menu-item"
                    onClick={onToggleSound}
                    aria-pressed={soundOn}
                  >
                    <Icon name={soundOn ? 'volume' : 'volume-mute'} size={18} />
                    <span>{soundOn ? '🔊' : '🔇'} Âm thanh</span>
                  </button>

                  <button
                    type="button"
                    className="account-menu-item"
                    onClick={onToggleMotion}
                    aria-pressed={motionOn}
                  >
                    <Icon name="sparkles" size={18} />
                    <span>Hiệu ứng {motionOn ? 'bật' : 'tắt'}</span>
                  </button>

                  <button
                    type="button"
                    className="account-menu-item"
                    onClick={() => {
                      closeAccountMenu();
                      onOpenPassword();
                    }}
                  >
                    <Icon name="lock" size={18} />
                    <span>Đổi mật khẩu</span>
                  </button>

                  <button
                    type="button"
                    className="account-menu-item danger-item"
                    onClick={() => {
                      closeAccountMenu();
                      void onLogout();
                    }}
                  >
                    <Icon name="logout" size={18} />
                    <span>Đăng xuất</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export default StudentHeader;
