import React, { useState } from 'react';
import { Icon, type IconName } from './Icon';
import { Button } from './Button';
import { IconButton } from './IconButton';
import { Card } from './Card';
import { Dialog } from './Dialog';
import { Tabs } from './Tabs';
import { StatChip } from './StatChip';
import { ProgressBar } from './ProgressBar';
import { StarMeter } from './StarMeter';
import { SubjectBadge } from './SubjectBadge';
import { EmptyState } from './EmptyState';
import { Toast } from './Toast';
import { PinPad } from './PinPad';

export const UiShowcase: React.FC = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('components');
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [pinResult, setPinResult] = useState<string>('');

  const sampleIcons: IconName[] = [
    'map', 'mission', 'town', 'trophy', 'star', 'flame', 'clock', 'gift',
    'book', 'badge', 'volume', 'volume-mute', 'settings', 'lock', 'unlock',
    'check', 'cross', 'lightbulb', 'replay', 'back', 'parent', 'compass'
  ];

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: '32px 16px', fontFamily: 'var(--font-family)' }}>
      <header style={{ marginBottom: 32, borderBottom: '1px solid var(--c-line)', paddingBottom: 16 }}>
        <h1 style={{ fontSize: 'var(--t-h1-size)', color: 'var(--c-leaf)', margin: '0 0 8px 0' }}>
          Bảo An Learning 5.0 — Hệ thống thành phần chung (Design System Showcase)
        </h1>
        <p style={{ color: 'var(--c-ink-2)', margin: 0 }}>
          Trang kiểm chứng trực quan các thành phần UI theo quy chuẩn <code>02_DINH_HUONG_VA_HE_THONG_THIET_KE.md</code>.
        </p>
      </header>

      <div style={{ marginBottom: 24 }}>
        <Tabs
          items={[
            { id: 'components', label: 'Thành phần chung' },
            { id: 'icons', label: 'Bộ biểu tượng SVG' },
            { id: 'tokens', label: 'Màu sắc & Tokens' },
          ]}
          activeId={activeTab}
          onChange={setActiveTab}
        />
      </div>

      {activeTab === 'components' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          {/* 1. Nút bấm (Button) */}
          <Card>
            <h2 style={{ fontSize: 'var(--t-h2-size)', marginTop: 0 }}>1. Nút bấm (Button)</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', marginBottom: 16 }}>
              <Button variant="primary" size={64} icon={<Icon name="arrow-right" size={24} />}>
                Tiếp tục: Học Toán (64px)
              </Button>
              <Button variant="primary" size={56} icon={<Icon name="sparkles" size={20} />}>
                Bắt đầu học (56px)
              </Button>
              <Button variant="primary" size={44}>
                Nút chính (44px)
              </Button>
              <Button variant="secondary" size={44}>
                Nút viền (Secondary)
              </Button>
              <Button variant="subtle" size={44}>
                Nút chữ (Subtle)
              </Button>
              <Button variant="danger" size={44}>
                Nguy hiểm
              </Button>
            </div>
          </Card>

          {/* 2. Nút biểu tượng (IconButton) */}
          <Card>
            <h2 style={{ fontSize: 'var(--t-h2-size)', marginTop: 0 }}>2. Nút biểu tượng (IconButton - 44x44px)</h2>
            <div style={{ display: 'flex', gap: 12 }}>
              <IconButton name="volume" ariaLabel="Bật âm thanh" bordered />
              <IconButton name="settings" ariaLabel="Cài đặt" bordered />
              <IconButton name="parent" ariaLabel="Khu phụ huynh" bordered />
              <IconButton name="replay" ariaLabel="Chơi lại" bordered />
              <IconButton name="cross" ariaLabel="Đóng" bordered />
            </div>
          </Card>

          {/* 3. Thẻ chip trạng thái (StatChip) & Tiến độ */}
          <Card>
            <h2 style={{ fontSize: 'var(--t-h2-size)', marginTop: 0 }}>3. Trạng thái & Tiến độ</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', marginBottom: 16 }}>
              <StatChip icon="clock" label="18 phút hôm nay" />
              <StatChip icon="flame" label="5 ngày liên tục" />
              <StatChip icon="star" label="42 sao" />
              <StarMeter stars={2} maxStars={3} size={24} />
            </div>
            <div style={{ maxWidth: 400 }}>
              <p style={{ margin: '0 0 8px 0', fontSize: 'var(--t-small-size)', color: 'var(--c-ink-2)' }}>
                Tiến độ chặng tuần: 70%
              </p>
              <ProgressBar value={70} max={100} label="Tiến độ chặng" />
            </div>
          </Card>

          {/* 4. Huy hiệu môn học (SubjectBadge) */}
          <Card>
            <h2 style={{ fontSize: 'var(--t-h2-size)', marginTop: 0 }}>4. Môn học chuẩn hóa</h2>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <SubjectBadge subject="toan" />
              <SubjectBadge subject="tieng-viet" />
              <SubjectBadge subject="tieng-anh" />
              <SubjectBadge subject="tin-hoc" />
            </div>
          </Card>

          {/* 5. Hộp thoại mẫu (Dialog) & Bàn phím số (PinPad) */}
          <Card>
            <h2 style={{ fontSize: 'var(--t-h2-size)', marginTop: 0 }}>5. Hộp thoại (Dialog) & Bàn phím PIN 6 số</h2>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <Button variant="secondary" size={44} onClick={() => setDialogOpen(true)}>
                Mở hộp thoại thử nghiệm
              </Button>
              <Button
                variant="subtle"
                size={44}
                onClick={() => setToastMsg('Thông báo thử nghiệm: Con đã hoàn thành xuất sắc bài học!')}
              >
                Hiện Toast thông báo
              </Button>
            </div>

            <div style={{ marginTop: 24, padding: 16, backgroundColor: 'var(--c-cream)', borderRadius: 'var(--r-md)', maxWidth: 320 }}>
              <h3 style={{ fontSize: 'var(--t-h3-size)', margin: '0 0 12px 0' }}>Bàn phím PIN phụ huynh (6 số)</h3>
              <PinPad onComplete={(pin) => setPinResult(pin)} />
              {pinResult && (
                <p style={{ color: 'var(--c-success)', marginTop: 8, fontSize: 'var(--t-small-size)' }}>
                  Đã nhập PIN: {pinResult}
                </p>
              )}
            </div>
          </Card>

          {/* 6. Trạng thái rỗng (EmptyState) */}
          <Card>
            <h2 style={{ fontSize: 'var(--t-h2-size)', marginTop: 0 }}>6. Trạng thái rỗng (EmptyState)</h2>
            <EmptyState
              icon="gift"
              message="Kệ quà hiện chưa có món quà nào. Con hãy nhờ bố mẹ thêm phần thưởng nhé!"
              actionLabel="Hỏi bố mẹ thêm quà"
              onAction={() => setToastMsg('Đã gửi lời nhắn nhờ bố mẹ thêm quà!')}
            />
          </Card>
        </div>
      )}

      {activeTab === 'icons' && (
        <Card>
          <h2 style={{ fontSize: 'var(--t-h2-size)', marginTop: 0 }}>Bộ biểu tượng SVG chuẩn (~40 icons)</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 16 }}>
            {sampleIcons.map((name) => (
              <div
                key={name}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: 12,
                  border: '1px solid var(--c-line)',
                  borderRadius: 'var(--r-md)',
                  backgroundColor: 'var(--c-cream)',
                }}
              >
                <Icon name={name} size={32} />
                <span style={{ fontSize: 'var(--t-tiny-size)', color: 'var(--c-ink-2)', marginTop: 8 }}>
                  {name}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {activeTab === 'tokens' && (
        <Card>
          <h2 style={{ fontSize: 'var(--t-h2-size)', marginTop: 0 }}>Bảng màu Tokens chuẩn (Tokens palette)</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
            {[
              { name: '--c-leaf', hex: '#4E7250', desc: 'Xanh lá chính (5.5:1)' },
              { name: '--c-leaf-deep', hex: '#2F6F3A', desc: 'Nhấn / chữ lá (6.1:1)' },
              { name: '--c-ink', hex: '#183449', desc: 'Chữ chính (12.9:1)' },
              { name: '--c-cream', hex: '#FFFDF7', desc: 'Nền thế giới' },
              { name: '--c-paper', hex: '#F8F7EF', desc: 'Nền thẻ' },
              { name: '--c-math', hex: '#B45309', desc: 'Toán học (5.0:1)' },
              { name: '--c-viet', hex: '#3F7D3A', desc: 'Tiếng Việt (5.0:1)' },
              { name: '--c-eng', hex: '#0E7490', desc: 'Tiếng Anh (5.4:1)' },
              { name: '--c-tech', hex: '#6D28D9', desc: 'Tin học (7.1:1)' },
              { name: '--c-star', hex: '#E5A93C', desc: 'Sao phần thưởng' },
            ].map((c) => (
              <div
                key={c.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: 8,
                  border: '1px solid var(--c-line)',
                  borderRadius: 'var(--r-md)',
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 'var(--r-sm)',
                    backgroundColor: c.hex,
                    border: '1px solid rgba(0,0,0,0.1)',
                  }}
                />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 'var(--t-small-size)' }}>{c.name}</div>
                  <div style={{ fontSize: 'var(--t-tiny-size)', color: 'var(--c-ink-2)' }}>{c.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Dialog thử nghiệm */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Hộp thoại chuẩn Bảo An"
        iconName="sparkles"
        footer={
          <>
            <Button variant="secondary" size={44} onClick={() => setDialogOpen(false)}>
              Bỏ qua
            </Button>
            <Button
              variant="primary"
              size={44}
              onClick={() => {
                setDialogOpen(false);
                setToastMsg('Thành công!');
              }}
            >
              Đồng ý
            </Button>
          </>
        }
      >
        <p style={{ margin: '0 0 12px 0' }}>
          Đây là hộp thoại hợp nhất sử dụng thành phần <code>&lt;Dialog&gt;</code> dùng chung:
        </p>
        <ul style={{ paddingLeft: 20, margin: 0, color: 'var(--c-ink-2)' }}>
          <li>Nền kem dịu mắt, bóng đổ chuẩn <code>--shadow-2</code>.</li>
          <li>Nút đóng tròn 44x44px góc trên bên phải.</li>
          <li>Hỗ trợ phím Escape và click ngoài nền mờ để đóng.</li>
          <li>Tự động bẫy và phục hồi tiêu điểm bàn phím (focus trap).</li>
        </ul>
      </Dialog>

      {/* Toast thử nghiệm */}
      {toastMsg && (
        <Toast message={toastMsg} onDismiss={() => setToastMsg(null)} />
      )}
    </div>
  );
};

export default UiShowcase;
