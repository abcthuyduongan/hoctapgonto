import { useState, useCallback, type CSSProperties } from 'react';
import type { MapOverviewResponse, MapRegionId } from '../core/world-map-contracts';
import { WORLD_REGION_ORDER, REGION_METADATA } from '../core/world-map-regions';
import { WORLD_MAP_ANCHORS } from '../core/world-map-layout';

export interface WorldMapProps {
  overview: MapOverviewResponse;
  onSelectRegion: (regionId: MapRegionId) => void;
  onContinueCurrent?: () => void;
  disabled?: boolean;
}

export default function WorldMap({
  overview,
  onSelectRegion,
  onContinueCurrent,
  disabled = false,
}: WorldMapProps) {
  const [imageError, setImageError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [lockedToast, setLockedToast] = useState<string | null>(null);

  const handleRetry = useCallback(() => {
    setImageError(false);
    setRetryKey(k => k + 1);
  }, []);

  const regionMap = new Map(overview.regions.map(r => [r.id, r]));

  return (
    <div className="world-map-container" aria-label="Bản đồ thế giới học tập">
      <div className="map-top-bar">
        <h2>
          <span aria-hidden="true">🗺️</span> Bản đồ thế giới học tập
        </h2>
        <div className="map-top-actions">
          {overview.currentWeek && onContinueCurrent && (
            <button
              type="button"
              className="map-nav-btn primary"
              disabled={disabled}
              onClick={onContinueCurrent}
              aria-label={`▶ Tiếp tục chuyến đi (${overview.currentWeek.title})`}
            >
              ▶ Tiếp tục chuyến đi ({overview.currentWeek.title})
            </button>
          )}
        </div>
      </div>

      <div className="map-view-wrapper">
        {!imageError ? (
          <picture key={retryKey} className="map-background-picture">
            <source
              media="(max-width: 768px)"
              srcSet="/art/maps/map-world-tall.webp"
              type="image/webp"
            />
            <img
              src="/art/maps/map-world-wide.webp"
              alt="Bản đồ các vùng học tập"
              className="map-background-img"
              onError={() => setImageError(true)}
              loading="eager"
            />
          </picture>
        ) : (
          <div className="map-fallback" role="alert">
            <p>Không thể tải hình ảnh bản đồ thế giới.</p>
            <button type="button" onClick={handleRetry}>
              Thử tải lại ảnh
            </button>
          </div>
        )}

        <div className="map-interactive-layer" role="group" aria-label="Các vùng học tập">
          {WORLD_REGION_ORDER.map((regionId: MapRegionId) => {
            const summary = regionMap.get(regionId);
            const meta = REGION_METADATA[regionId];
            const anchor = WORLD_MAP_ANCHORS[regionId];
            if (!anchor) return null;

            const assignedCount = summary?.assignedWeekCount ?? 0;
            const closedCount = summary?.closedWeekCount ?? 0;
            const hasCurrent = !!summary?.hasCurrentWeek;
            const isLocked = assignedCount === 0;
            const label = summary?.label || meta.label;

            const handleClick = () => {
              if (isLocked) {
                const msg = `Vùng ${label} chưa mở. Con hãy hoàn thành các bài học trước để mở nhé!`;
                setLockedToast(msg);
                setTimeout(() => {
                  setLockedToast(prev => (prev === msg ? null : prev));
                }, 3500);
              }
              onSelectRegion(regionId);
            };

            return (
              <button
                key={regionId}
                type="button"
                className={`map-region-anchor region-${regionId} ${hasCurrent ? 'has-current' : ''} ${
                  isLocked ? 'is-locked-region' : ''
                }`}
                style={
                  {
                    '--x-wide': `${anchor.wide.x}%`,
                    '--y-wide': `${anchor.wide.y}%`,
                    '--x-tall': `${anchor.tall.x}%`,
                    '--y-tall': `${anchor.tall.y}%`,
                  } as CSSProperties
                }
                disabled={disabled}
                onClick={handleClick}
              >
                <div className="map-region-badge">
                  <strong>
                    {hasCurrent && <span className="current-pulse" aria-hidden="true" />}
                    {isLocked && <span aria-hidden="true">🔒 </span>}
                    {label}
                  </strong>
                  <span>
                    {isLocked ? 'Chưa mở' : `${closedCount}/${assignedCount} tuần`}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {lockedToast && (
          <div className="map-locked-toast" role="status">
            <span>🔒</span> {lockedToast}
          </div>
        )}
      </div>
    </div>
  );
}
