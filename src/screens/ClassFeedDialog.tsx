import React, { useEffect, useState } from 'react';
import { onlineApi } from '../core/online-client.ts';
import type { ClassFeedEvent } from '../core/class-feed.ts';
import '../styles/town.css';

interface ClassFeedDialogProps {
  onClose: () => void;
  classId?: string;
}

export const ClassFeedDialog: React.FC<ClassFeedDialogProps> = ({ onClose, classId }) => {
  const [loading, setLoading] = useState(true);
  const [feedEnabled, setFeedEnabled] = useState(true);
  const [events, setEvents] = useState<ClassFeedEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchFeed() {
      try {
        setLoading(true);
        setError(null);
        const res = await onlineApi.classFeed(classId);
        setFeedEnabled(res.enabled);
        setEvents(res.events || []);
      } catch (err: any) {
        setError(err?.message || 'Không thể tải bảng tin lớp học.');
      } finally {
        setLoading(false);
      }
    }
    fetchFeed();
  }, [classId]);

  const renderEventIcon = (event: ClassFeedEvent) => {
    switch (event.eventType) {
      case 'building_built':
        return event.details?.buildingIcon || '🏡';
      case 'badge_unlock':
        return event.details?.badgeIcon || '🏅';
      case 'week_complete':
        return '🌟';
      case 'cheer_received':
        return '🎉';
      default:
        return '📢';
    }
  };

  const renderEventDescription = (event: ClassFeedEvent) => {
    switch (event.eventType) {
      case 'building_built':
        return (
          <span>
            vừa xây xong <strong>{event.details?.buildingName || 'công trình mới'}</strong> tại thị trấn!
          </span>
        );
      case 'badge_unlock':
        return (
          <span>
            vừa mở khóa huy hiệu vinh dự <strong>{event.details?.badgeTitle || 'mới'}</strong>!
          </span>
        );
      case 'week_complete':
        return (
          <span>
            vừa hoàn thành xuất sắc <strong>{event.details?.weekTitle || `Tuần ${event.details?.weekPosition}`}</strong>!
          </span>
        );
      case 'cheer_received':
        return (
          <span>
            vừa nhận thêm tràng pháo tay cổ vũ nồng nhiệt từ bạn bè!
          </span>
        );
      default:
        return <span>có thành tích mới trên hành trình học tập!</span>;
    }
  };

  return (
    <div className="town-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="class-feed-title">
      <div className="town-modal-card class-feed-modal" style={{ maxWidth: '520px', width: '92%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 id="class-feed-title" style={{ margin: 0, fontSize: '20px', color: '#1e293b' }}>
            📢 Bảng Tin Lớp Học
          </h3>
          <button
            type="button"
            className="town-catalog-close"
            onClick={onClose}
            aria-label="Đóng bảng tin"
          >
            ✕
          </button>
        </div>

        <div style={{ maxHeight: '420px', overflowY: 'auto', paddingRight: '4px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
              Đang tải bảng tin lớp...
            </div>
          ) : error ? (
            <div className="town-conflict-notice" style={{ margin: '10px 0' }}>
              {error}
            </div>
          ) : !feedEnabled ? (
            <div
              style={{
                textAlign: 'center',
                padding: '40px 20px',
                background: '#f8fafc',
                borderRadius: '16px',
                border: '1px dashed #cbd5e1',
                color: '#64748b',
              }}
            >
              <span style={{ fontSize: '32px', display: 'block', marginBottom: '8px' }}>🔒</span>
              <strong>Bảng tin đang tạm đóng</strong>
              <p style={{ margin: '6px 0 0', fontSize: '14px' }}>
                Giáo viên đã tạm tắt bảng tin của lớp để các bạn tập trung làm bài nhé!
              </p>
            </div>
          ) : events.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '40px 20px',
                background: '#f8fafc',
                borderRadius: '16px',
                color: '#64748b',
              }}
            >
              <span style={{ fontSize: '32px', display: 'block', marginBottom: '8px' }}>🌱</span>
              <strong>Chưa có sự kiện nào gần đây</strong>
              <p style={{ margin: '6px 0 0', fontSize: '14px' }}>
                Hãy chăm chỉ học bài và xây dựng thị trấn để cùng chia sẻ niềm vui với cả lớp nhé!
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {events.map((ev) => (
                <div
                  key={ev.id}
                  className="class-feed-item"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 14px',
                    borderRadius: '14px',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <span style={{ fontSize: '24px' }}>{renderEventIcon(ev)}</span>
                  <div style={{ flex: 1, fontSize: '14px', lineHeight: 1.4 }}>
                    <strong style={{ color: '#0284c7' }}>{ev.studentName}</strong>{' '}
                    {renderEventDescription(ev)}
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                      {new Date(ev.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - {new Date(ev.createdAt).toLocaleDateString('vi-VN')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <button type="button" className="town-btn-cancel" onClick={onClose} style={{ width: '100%' }}>
            Đóng bảng tin
          </button>
        </div>
      </div>
    </div>
  );
};
