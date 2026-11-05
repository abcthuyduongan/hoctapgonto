import { useState, useCallback, type CSSProperties } from 'react';
import type { MapRegionId, RegionMapView } from '../core/world-map-contracts';
import { REGION_METADATA } from '../core/world-map-regions';
import { getRegionSlotConfig } from '../core/world-map-layout';

export interface RegionMapProps {
  regionId: MapRegionId;
  regionView: RegionMapView;
  selectedWeekId: string | null;
  onSelectWeek: (weekId: string) => void;
  onChangeChapter: (chapter: number) => void;
  onBackToWorld: () => void;
  disabled?: boolean;
}

const REGION_LANDMARKS: Record<MapRegionId, string[]> = {
  math: [
    '/art/landmarks/place-math-number-house.webp',
    '/art/landmarks/place-math-garden.webp',
    '/art/landmarks/place-math-market.webp',
  ],
  vietnamese: [
    '/art/landmarks/place-vietnamese-library.webp',
    '/art/landmarks/place-vietnamese-word-tree.webp',
    '/art/landmarks/place-vietnamese-story-house.webp',
  ],
  english: [
    '/art/landmarks/place-english-harbor.webp',
    '/art/landmarks/place-english-lighthouse.webp',
    '/art/landmarks/place-english-cafe.webp',
  ],
  computing: [
    '/art/landmarks/place-computing-workshop.webp',
    '/art/landmarks/place-computing-keyboard-garden.webp',
    '/art/landmarks/place-computing-info-station.webp',
  ],
  discovery: [
    '/art/landmarks/place-math-number-house.webp',
    '/art/landmarks/place-vietnamese-library.webp',
    '/art/landmarks/place-computing-workshop.webp',
  ],
};

export function getLandmark(regionId: MapRegionId, slot: number): string {
  const list = REGION_LANDMARKS[regionId] || REGION_LANDMARKS.discovery;
  const index = Math.max(0, (slot - 1) % list.length);
  return list[index];
}

export default function RegionMap({
  regionId,
  regionView,
  selectedWeekId,
  onSelectWeek,
  onChangeChapter,
  onBackToWorld,
  disabled = false,
}: RegionMapProps) {
  const [bgError, setBgError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [failedLandmarks, setFailedLandmarks] = useState<Record<string, boolean>>({});
  const [lockedToast, setLockedToast] = useState<string | null>(null);

  const meta = REGION_METADATA[regionId] ?? {
    id: regionId,
    label: 'Khám phá',
    shortLabel: 'Khám Phá',
    themeColor: '#405747',
    accentColor: '#F7F3E6',
    landmarkKeys: [
      'place-math-number-house',
      'place-vietnamese-library',
      'place-computing-workshop',
    ] as [string, string, string],
  };

  const handleRetry = useCallback(() => {
    setBgError(false);
    setFailedLandmarks({});
    setRetryKey(k => k + 1);
  }, []);

  const handleLandmarkError = useCallback((weekId: string) => {
    setFailedLandmarks(prev => ({ ...prev, [weekId]: true }));
  }, []);

  // Map background filenames: map-[regionId]-wide.webp / tall.webp
  const bgBase = regionId === 'discovery' ? 'world' : regionId;
  const bgWide = `/art/maps/map-${bgBase}-wide.webp`;
  const bgTall = `/art/maps/map-${bgBase}-tall.webp`;

  return (
    <div className="region-map-container" aria-label={`Bản đồ ${meta.label}`}>
      <div className="map-top-bar">
        <button
          type="button"
          className="map-nav-btn"
          disabled={disabled}
          onClick={onBackToWorld}
          aria-label="Trở về bản đồ thế giới"
        >
          ← Bản đồ thế giới
        </button>

        <h2>
          <span>{meta.label}</span>
        </h2>

        {regionView.totalChapters > 1 && (
          <nav className="chapter-nav-bar" aria-label="Chọn chương học">
            {Array.from({ length: regionView.totalChapters }, (_, i) => i + 1).map(ch => (
              <button
                key={ch}
                type="button"
                className={`chapter-btn ${ch === regionView.chapter ? 'active' : ''}`}
                disabled={disabled || ch === regionView.chapter}
                onClick={() => onChangeChapter(ch)}
                aria-label={`Chương ${ch}${ch === regionView.chapter ? ', đang chọn' : ''}`}
              >
                Chương {ch}
              </button>
            ))}
          </nav>
        )}
      </div>

      <div className="map-view-wrapper">
        {!bgError ? (
          <picture key={retryKey} className="map-background-picture">
            <source media="(max-width: 768px)" srcSet={bgTall} type="image/webp" />
            <img
              src={bgWide}
              alt={`Bản đồ môn ${meta.label}`}
              className="map-background-img"
              onError={() => setBgError(true)}
              loading="eager"
            />
          </picture>
        ) : (
          <div className="map-fallback" role="alert">
            <p>Không thể tải hình ảnh bản đồ môn {meta.label}.</p>
            <button type="button" onClick={handleRetry}>
              Thử tải lại ảnh
            </button>
          </div>
        )}

        <div className="map-interactive-layer" role="group" aria-label={`Các chặng môn ${meta.label}`}>
          {regionView.nodes.map(node => {
            const anchor = getRegionSlotConfig(node.slot, regionId);
            const isSelected = selectedWeekId === node.weekId;
            const landmarkSrc = getLandmark(regionId, node.slot);
            const landmarkFailed = !!failedLandmarks[node.weekId];

            const statusText =
              node.state === 'current'
                ? 'Đang khám phá'
                : node.state === 'closed'
                ? 'Đã hoàn thành'
                : 'Chưa mở';

            const statusPrefix =
              node.state === 'current' ? '▶ ' : node.state === 'closed' ? '✓ ' : '🔒 ';

            const qualified = node.counts.two + node.counts.three;
            const isCompleted = node.counts.total > 0 && qualified === node.counts.total;
            const isAllThreeStars = node.counts.total > 0 && node.counts.three === node.counts.total;

            const handleNodeClick = () => {
              if (node.state === 'locked') {
                const prevPos = node.position > 1 ? node.position - 1 : 1;
                const msg = `Hoàn thành tuần ${prevPos} để mở`;
                setLockedToast(msg);
                setTimeout(() => {
                  setLockedToast(prev => (prev === msg ? null : prev));
                }, 3500);
              }
              onSelectWeek(node.weekId);
            };

            return (
              <button
                key={node.weekId}
                type="button"
                className={`map-stage-node is-${node.state} ${isSelected ? 'is-selected' : ''} ${
                  isCompleted ? 'is-stage-completed' : ''
                } ${isAllThreeStars ? 'is-stage-gold-flag' : ''}`}
                style={
                  {
                    '--x-wide': `${anchor.wide.x}%`,
                    '--y-wide': `${anchor.wide.y}%`,
                    '--x-tall': `${anchor.tall.x}%`,
                    '--y-tall': `${anchor.tall.y}%`,
                  } as CSSProperties
                }
                disabled={disabled}
                onClick={handleNodeClick}
                aria-label={`${node.title}, ${statusText}. Đạt ${qualified}/${node.counts.total} câu.${
                  isAllThreeStars ? ' Đạt 3 sao toàn bộ.' : ''
                }`}
                aria-pressed={isSelected}
              >
                {!landmarkFailed ? (
                  <img
                    src={landmarkSrc}
                    alt=""
                    aria-hidden="true"
                    className="map-landmark-img"
                    onError={() => handleLandmarkError(node.weekId)}
                    loading="lazy"
                  />
                ) : (
                  <span className="map-landmark-fallback" aria-hidden="true" style={{ fontSize: '2.5rem' }}>
                    🚩
                  </span>
                )}
                {isAllThreeStars && (
                  <span className="map-stage-gold-badge" aria-label="Đạt 3 sao toàn bộ" title="Đạt 3 sao toàn bộ">
                    🚩
                  </span>
                )}
                {node.state === 'locked' && (
                  <div className="map-stage-fog" aria-hidden="true">
                    <span className="lock-symbol">🔒</span>
                  </div>
                )}
                <div className="map-stage-label">
                  <span>
                    {statusPrefix}
                    {node.title}
                  </span>
                  <small style={{ opacity: 0.85 }}>
                    ({qualified}/{node.counts.total})
                  </small>
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

        {regionView.nodes.length === 0 && (
          <div
            className="map-fallback"
            role="status"
            style={{ background: 'rgba(247, 243, 230, 0.88)' }}
          >
            <p>
              Chương {regionView.chapter} chưa có bài học được giao cho môn <strong>{meta.label}</strong>.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
