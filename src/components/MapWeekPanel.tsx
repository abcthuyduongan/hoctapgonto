import type { ModuleId } from '../core/contracts';
import type {
  OnlinePackSummary,
  OnlineStudentSummary,
} from '../core/online-contracts';
import type { MapWeekNode } from '../core/world-map-contracts';
import OnlineQuestionStars from '../screens/OnlineQuestionStars';
import { GAME_CARD_IMAGES } from '../screens/StudentScreen';

export interface MapWeekPanelProps {
  node: MapWeekNode;
  summaryWeek?: OnlineStudentSummary['weeks'][number] | null;
  onPlayGame: (gameId: ModuleId, pack: OnlinePackSummary, reviewItemIds?: string[]) => void;
  onChooseGames: (pack: OnlinePackSummary) => Promise<void>;
  onAdvanceWeek?: () => void;
  onClose?: () => void;
  disabled?: boolean;
  reviewEpoch?: number;
}

export default function MapWeekPanel({
  node,
  summaryWeek,
  onPlayGame,
  onChooseGames,
  onAdvanceWeek,
  onClose,
  disabled = false,
  reviewEpoch = 0,
}: MapWeekPanelProps) {
  const isCurrent = node.state === 'current';
  const isClosed = node.state === 'closed';
  const isLocked = node.state === 'locked';

  const qualified = node.counts.two + node.counts.three;
  const isReady = node.counts.total > 0 && node.counts.zero === 0 && node.counts.one === 0;

  // Find corresponding full sets from student summary
  const summarySets = summaryWeek?.sets ?? [];

  return (
    <aside className="map-week-panel" aria-label={`Chi tiết tuần ${node.title}`}>
      <div className="map-week-panel-header">
        <div>
          <h3>{node.title}</h3>
          <span className={`map-week-status-tag ${node.state}`}>
            {isCurrent ? '⭐ Đang khám phá' : isClosed ? '🔒 Đã hoàn thành' : '🔒 Chưa mở'}
          </span>
        </div>

        {onClose && (
          <button
            type="button"
            className="map-nav-btn"
            onClick={onClose}
            aria-label="Đóng bảng chi tiết"
          >
            Đóng ✕
          </button>
        )}
      </div>

      <div className="online-week-progress" style={{ margin: '0.75rem 0' }}>
        <strong>
          Tiến độ: {qualified}/{node.counts.total} câu đạt chuẩn (≥ 2 sao)
        </strong>
        <p>
          {node.counts.two} câu 2 sao · {node.counts.three} câu 3 sao
          {node.counts.zero + node.counts.one > 0 &&
            ` · ${node.counts.zero + node.counts.one} câu cần làm thêm`}
        </p>

        {isCurrent && isReady && (
          <div style={{ marginTop: '0.5rem' }}>
            <p className="online-muted">
              🎉 Con đã hoàn thành tất cả câu hỏi của tuần!
              {node.counts.two > 0 && ' Con có thể ôn lại để đạt tối đa 3 sao.'}
            </p>
            {onAdvanceWeek && (
              <button
                type="button"
                className="online-primary"
                disabled={disabled}
                onClick={onAdvanceWeek}
                style={{ marginTop: '0.4rem' }}
              >
                Sang tuần học tiếp theo →
              </button>
            )}
          </div>
        )}

        {isClosed && (
          <p className="online-muted">
            Tuần này đã đóng sau khi chuyển tuần. Thành tích và sao của con đã được lưu đầy đủ trên máy chủ.
          </p>
        )}

        {isLocked && (
          <p className="online-muted">
            Tuần này đang khóa. Con hãy hoàn thành tuần học hiện tại trước khi mở tiếp nhé.
          </p>
        )}
      </div>

      <div className="map-sets-list">
        {node.sets.map(nodeSet => {
          const matchedSummarySet = summarySets.find(
            s => s.pack.id === nodeSet.packId && s.pack.version === nodeSet.contentVersion
          );

          const pack: OnlinePackSummary = matchedSummarySet?.pack ?? {
            id: nodeSet.packId,
            version: nodeSet.contentVersion,
            title: nodeSet.title,
            kind: (nodeSet.kind as OnlinePackSummary['kind']) || 'quiz',
            itemCount: nodeSet.itemCount,
            subject: 'math',
            grade: 1,
          };

          const setQualified = (nodeSet.counts?.two ?? 0) + (nodeSet.counts?.three ?? 0);
          const setTotal = nodeSet.counts?.total ?? nodeSet.itemCount;

          return (
            <div key={`${nodeSet.packId}@${nodeSet.contentVersion}`} className="map-set-card">
              <div className="map-set-title">
                <span>{nodeSet.subjectLabel}</span> · {nodeSet.title}
              </div>
              <div className="map-set-meta">
                <span>{nodeSet.itemCount} câu hỏi</span>
                <span> · {setQualified}/{setTotal} đạt chuẩn</span>
              </div>

              {isCurrent && matchedSummarySet ? (
                <>
                  <OnlineQuestionStars
                    set={matchedSummarySet}
                    disabled={disabled}
                    reviewEpoch={reviewEpoch}
                    onChooseGames={() => onChooseGames(pack)}
                    onPlay={(gameId, ids) => onPlayGame(gameId, pack, ids)}
                  />

                  {matchedSummarySet.games.length > 0 && (
                    <div className="map-set-games">
                      {matchedSummarySet.games.map(g => (
                        <button
                          key={g.id}
                          type="button"
                          className="map-play-btn"
                          disabled={disabled}
                          onClick={() => onPlayGame(g.id, pack)}
                          aria-label={`Bắt đầu chơi ${g.label} cho bài ${nodeSet.title}`}
                        >
                          {GAME_CARD_IMAGES[g.id] && (
                            <img
                              src={GAME_CARD_IMAGES[g.id]}
                              alt=""
                              className="map-game-card-thumb"
                              aria-hidden="true"
                              loading="lazy"
                            />
                          )}
                          <span>▶ {g.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : isCurrent && !matchedSummarySet ? (
                <div className="online-actions">
                  <button
                    type="button"
                    className="map-play-btn"
                    disabled={disabled}
                    onClick={() => void onChooseGames(pack)}
                  >
                    Chọn trò để học
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
