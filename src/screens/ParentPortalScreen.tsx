import { useState, useEffect } from 'react';
import { onlineApi } from '../core/online-client';
import type {
  ParentDashboardResponse,
  OnlineIdentity
} from '../core/online-contracts';
import '../styles/parent-portal.css';

interface ParentPortalScreenProps {
  identity?: OnlineIdentity;
  initialData?: ParentDashboardResponse;
  onLogout?: () => void;
  onClose?: () => void;
}

export default function ParentPortalScreen({
  identity,
  initialData,
  onLogout,
  onClose
}: ParentPortalScreenProps) {
  const [data, setData] = useState<ParentDashboardResponse | null>(initialData ?? null);
  const [activeTab, setActiveTab] = useState<'report' | 'gifts' | 'settings'>('report');
  const [selectedStudentId, setSelectedStudentId] = useState<string>(
    initialData?.student?.id ?? identity?.user?.studentId ?? ''
  );
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  // Settings form state
  const [maxMinutes, setMaxMinutes] = useState<number>(0);
  const [startHour, setStartHour] = useState<number>(6);
  const [endHour, setEndHour] = useState<number>(21);
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');
  const [pinChangeNotice, setPinChangeNotice] = useState('');
  const [pinChangeError, setPinChangeError] = useState('');

  // Redemption note state
  const [redemptionNotes, setRedemptionNotes] = useState<Record<string, string>>({});

  const isParentAccount = identity?.user?.role === 'parent';

  const loadDashboard = async (sId?: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await onlineApi.parentDashboard(sId);
      setData(res);
      setSelectedStudentId(res.student.id);
      setMaxMinutes(res.controls.maxMinutesPerDay || 0);
      setStartHour(res.controls.allowedStartHour ?? 0);
      setEndHour(res.controls.allowedEndHour ?? 24);
    } catch (err: any) {
      setError(err?.message || 'Không thể tải dữ liệu phụ huynh.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!initialData) {
      void loadDashboard(selectedStudentId || undefined);
    } else {
      setMaxMinutes(initialData.controls.maxMinutesPerDay || 0);
      setStartHour(initialData.controls.allowedStartHour ?? 0);
      setEndHour(initialData.controls.allowedEndHour ?? 24);
    }
  }, [initialData]);

  const handleStudentSwitch = (newStudentId: string) => {
    setSelectedStudentId(newStudentId);
    void loadDashboard(newStudentId);
  };

  const handleSaveSettings = async () => {
    if (endHour <= startHour && endHour !== 24 && startHour !== 0) {
      setError('Giờ kết thúc phải lớn hơn giờ bắt đầu.');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const updated = await onlineApi.updateParentSettings({
        studentId: selectedStudentId,
        maxMinutesPerDay: maxMinutes,
        allowedStartHour: startHour,
        allowedEndHour: endHour
      });
      setData(prev => prev ? { ...prev, controls: updated } : null);
      setNotice('Đã lưu cài đặt thời gian học thành công.');
    } catch (err: any) {
      setError(err?.message || 'Chưa lưu được cài đặt.');
    } finally {
      setBusy(false);
    }
  };

  const handleChangePin = async () => {
    if (!/^\d{4,6}$/.test(newPin)) {
      setPinChangeError('Mã PIN mới phải gồm từ 4 đến 6 chữ số.');
      return;
    }
    if (newPin !== confirmNewPin) {
      setPinChangeError('Mã PIN xác nhận không khớp.');
      return;
    }
    setBusy(true);
    setPinChangeError('');
    setPinChangeNotice('');
    try {
      await onlineApi.setupParentPin({
        pin: newPin,
        oldPin: oldPin || undefined,
        studentId: selectedStudentId
      });
      setPinChangeNotice('Đã đổi mã PIN phụ huynh thành công.');
      setOldPin('');
      setNewPin('');
      setConfirmNewPin('');
      setData(prev => prev ? {
        ...prev,
        controls: { ...prev.controls, hasPin: true }
      } : null);
    } catch (err: any) {
      setPinChangeError(err?.message || 'Chưa đổi được mã PIN.');
    } finally {
      setBusy(false);
    }
  };

  const handleRedemptionTransition = async (
    requestId: string,
    status: 'approved' | 'rejected' | 'fulfilled'
  ) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await onlineApi.transitionRedemption(requestId, {
        status,
        note: redemptionNotes[requestId]?.trim() || undefined
      });
      const actionText = status === 'approved' ? 'đã duyệt' : status === 'fulfilled' ? 'đã trao' : 'đã từ chối (và hoàn sao cho con)';
      setNotice(`Yêu cầu quà ${actionText} thành công.`);
      await loadDashboard(selectedStudentId);
    } catch (err: any) {
      setError(err?.message || 'Chưa cập nhật được trạng thái đổi quà.');
    } finally {
      setBusy(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="parent-portal-loading" role="status">
        <p>Đang tải thông tin phụ huynh…</p>
      </div>
    );
  }

  const report = data?.report;
  const student = data?.student;
  const children = data?.children || [];
  const redemptions = report?.redemptions || [];
  const pendingRedemptions = redemptions.filter(r => r.status === 'pending');
  const pastRedemptions = redemptions.filter(r => r.status !== 'pending');

  return (
    <div className="parent-portal-root">
      {/* Top Navigation Bar */}
      <header className="parent-header no-print">
        <div className="parent-header-brand">
          <span className="parent-brand-icon" aria-hidden="true">👨‍👩‍👧</span>
          <div>
            <h1>Khu Phụ Huynh Bảo An</h1>
            <p className="parent-brand-sub">Đồng hành và quản lý học tập cùng con</p>
          </div>
        </div>

        <div className="parent-header-controls">
          {children.length > 1 && (
            <div className="parent-student-switcher">
              <label htmlFor="child-select">Con yêu:</label>
              <select
                id="child-select"
                value={selectedStudentId}
                onChange={e => handleStudentSwitch(e.target.value)}
                disabled={busy}
              >
                {children.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.className})
                  </option>
                ))}
              </select>
            </div>
          )}

          {student && children.length <= 1 && (
            <div className="parent-student-badge">
              <span>Học sinh: <strong>{student.name}</strong> ({student.className})</span>
            </div>
          )}

          {onClose && (
            <button
              type="button"
              className="online-btn parent-btn-back"
              onClick={onClose}
              title="Quay lại thế giới học tập của con"
            >
              ➔ Trở lại học
            </button>
          )}

          {isParentAccount && onLogout && (
            <button
              type="button"
              className="online-btn parent-btn-logout"
              onClick={onLogout}
            >
              Đăng xuất
            </button>
          )}
        </div>
      </header>

      {/* Tab Navigation */}
      <nav className="parent-nav-tabs no-print" aria-label="Các mục khu phụ huynh">
        <button
          type="button"
          className={`parent-tab-btn ${activeTab === 'report' ? 'active' : ''}`}
          onClick={() => setActiveTab('report')}
          aria-selected={activeTab === 'report'}
        >
          📊 Báo cáo tuần
        </button>
        <button
          type="button"
          className={`parent-tab-btn ${activeTab === 'gifts' ? 'active' : ''}`}
          onClick={() => setActiveTab('gifts')}
          aria-selected={activeTab === 'gifts'}
        >
          🎁 Duyệt đổi quà {pendingRedemptions.length > 0 && <span className="parent-badge-count">{pendingRedemptions.length}</span>}
        </button>
        <button
          type="button"
          className={`parent-tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
          aria-selected={activeTab === 'settings'}
        >
          ⚙️ Giờ học & Mã PIN
        </button>
      </nav>

      {/* Global Alerts */}
      {error && (
        <div className="online-notice online-error no-print" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="online-notice online-success no-print" role="status">
          {notice}
        </div>
      )}

      {/* Main Content Area */}
      <main className="parent-main">
        {/* TAB 1: WEEKLY REPORT */}
        {activeTab === 'report' && report && (
          <div className="parent-report-view">
            <div className="report-action-bar no-print">
              <div className="report-period-info">
                <h2>{report.weekTitle || 'Báo cáo học tập'}</h2>
                <p>Tuần từ {report.startDateStr} đến {report.endDateStr}</p>
              </div>
              <button
                type="button"
                className="online-btn parent-btn-print"
                onClick={handlePrint}
                title="In hoặc lưu tệp PDF báo cáo tuần"
              >
                🖨️ In / Tải PDF
              </button>
            </div>

            {/* Print Header (Visible only when printing) */}
            <div className="print-header print-only">
              <h1>BẢO AN LEARNING - BÁO CÁO HỌC TẬP TUẦN</h1>
              <p>Học sinh: <strong>{report.studentName}</strong> | Lớp: <strong>{report.className}</strong></p>
              <p>Tuần học: {report.weekTitle} ({report.startDateStr} – {report.endDateStr})</p>
              <hr />
            </div>

            {/* Overview Metric Cards */}
            <section className="report-cards-grid" aria-label="Tổng quan tuần">
              <div className="report-stat-card">
                <span className="stat-card-icon" aria-hidden="true">⏱️</span>
                <div className="stat-card-content">
                  <span className="stat-card-value">{report.totalStudyMinutes}</span>
                  <span className="stat-card-label">Phút học trong tuần</span>
                </div>
              </div>

              <div className="report-stat-card">
                <span className="stat-card-icon" aria-hidden="true">📝</span>
                <div className="stat-card-content">
                  <span className="stat-card-value">{report.totalQuestionsCompleted}</span>
                  <span className="stat-card-label">Câu đã hoàn thành</span>
                </div>
              </div>

              <div className="report-stat-card">
                <span className="stat-card-icon" aria-hidden="true">🎯</span>
                <div className="stat-card-content">
                  <span className="stat-card-value">{report.overallFirstTryAccuracyPct}%</span>
                  <span className="stat-card-label">Đúng ngay lần đầu</span>
                </div>
              </div>

              <div className="report-stat-card">
                <span className="stat-card-icon" aria-hidden="true">🏅</span>
                <div className="stat-card-content">
                  <span className="stat-card-value">{report.newBadges.length}</span>
                  <span className="stat-card-label">Huy hiệu mới tuần này</span>
                </div>
              </div>
            </section>

            {/* Daily Study Minutes Chart / Breakdown */}
            <section className="report-section" aria-labelledby="daily-chart-title">
              <h3 id="daily-chart-title" className="section-title">📅 Thời gian học từng ngày (Thứ 2 – Chủ Nhật)</h3>
              <div className="daily-bars-container">
                {report.days.map(d => {
                  const maxM = Math.max(...report.days.map(x => x.studyMinutes), 30);
                  const heightPct = Math.round((d.studyMinutes / maxM) * 100);
                  return (
                    <div key={d.dateStr} className="daily-bar-item">
                      <span className="daily-bar-minutes">{d.studyMinutes}p</span>
                      <div className="daily-bar-track">
                        <div
                          className="daily-bar-fill"
                          style={{ height: `${Math.max(heightPct, 6)}%` }}
                        />
                      </div>
                      <span className="daily-bar-day">{d.dayOfWeek}</span>
                      <small className="daily-bar-date">{d.dateStr.slice(5)}</small>
                      <span className="daily-bar-count">{d.questionsCompleted} câu</span>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Subject Breakdown Table */}
            <section className="report-section" aria-labelledby="subjects-title">
              <h3 id="subjects-title" className="section-title">📚 Tỉ lệ đúng lần đầu theo môn học</h3>
              <div className="table-responsive">
                <table className="parent-table">
                  <thead>
                    <tr>
                      <th>Môn học</th>
                      <th>Số câu hoàn thành</th>
                      <th>Đúng ngay lần đầu</th>
                      <th>Tỉ lệ đúng (%)</th>
                      <th>Tổng lượt thử</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.subjects.map(s => (
                      <tr key={s.subjectLabel}>
                        <td><strong>{s.subjectLabel}</strong></td>
                        <td>{s.questionsAnswered}</td>
                        <td>{s.firstTryCorrect}</td>
                        <td>
                          <div className="accuracy-cell">
                            <span className="accuracy-pct">{s.firstTryAccuracyPct}%</span>
                            <div className="accuracy-bar-track">
                              <div
                                className="accuracy-bar-fill"
                                style={{ width: `${s.firstTryAccuracyPct}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td>{s.totalAttempts}</td>
                      </tr>
                    ))}
                    {report.subjects.length === 0 && (
                      <tr>
                        <td colSpan={5} className="table-empty">Tuần này con chưa làm bài tập môn nào.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Top 5 Mistakes */}
            <section className="report-section" aria-labelledby="mistakes-title">
              <h3 id="mistakes-title" className="section-title">💡 5 câu sai nhiều nhất (Cần cùng con ôn lại)</h3>
              {report.topMistakes.length > 0 ? (
                <div className="mistakes-list">
                  {report.topMistakes.map((m, idx) => (
                    <div key={m.itemId || idx} className="mistake-item">
                      <span className="mistake-rank">#{idx + 1}</span>
                      <div className="mistake-details">
                        <span className="mistake-subject">{m.subjectLabel}</span>
                        <p className="mistake-prompt">{m.prompt}</p>
                      </div>
                      <div className="mistake-count-badge">
                        <span>{m.errorCount} lần sai</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="report-empty-note">🎉 Tuyệt vời! Tuần này con làm rất chắc chắn, không có câu nào sai nhiều lần.</p>
              )}
            </section>

            {/* New Badges */}
            {report.newBadges.length > 0 && (
              <section className="report-section" aria-labelledby="badges-title">
                <h3 id="badges-title" className="section-title">🏅 Huy hiệu mới con đạt được trong tuần</h3>
                <div className="new-badges-grid">
                  {report.newBadges.map(b => (
                    <div key={b.badgeId} className="new-badge-card">
                      <span className="new-badge-icon" aria-hidden="true">{b.icon}</span>
                      <div>
                        <h4>{b.title}</h4>
                        <p>{b.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Print Footer */}
            <div className="print-footer print-only">
              <hr />
              <p>Báo An Learning – Ứng dụng Học tập Lớp 3 · Xuất ngày {new Date().toLocaleDateString('vi-VN')}</p>
            </div>
          </div>
        )}

        {/* TAB 2: GIFT APPROVAL */}
        {activeTab === 'gifts' && (
          <div className="parent-gifts-view">
            <div className="gifts-view-header">
              <h2>🎁 Duyệt đổi quà cho {student?.name}</h2>
              <p>Khi con tích đủ sao và chọn quà, yêu cầu sẽ chuyển về đây để ba mẹ phê duyệt và trao quà thực tế.</p>
            </div>

            {/* Pending Requests */}
            <section className="gifts-section" aria-labelledby="pending-gifts-title">
              <h3 id="pending-gifts-title" className="section-title">
                ⏳ Yêu cầu đang chờ duyệt ({pendingRedemptions.length})
              </h3>
              {pendingRedemptions.length > 0 ? (
                <div className="redemptions-cards-list">
                  {pendingRedemptions.map(r => (
                    <div key={r.requestId} className="redemption-card pending">
                      <div className="redemption-header">
                        <h4>{r.title}</h4>
                        <span className="redemption-stars">⭐ {r.stars} sao</span>
                      </div>
                      <p className="redemption-meta">
                        Thời gian con gửi: {new Date(r.requestedAt).toLocaleString('vi-VN')}
                      </p>
                      <div className="redemption-note-input">
                        <label htmlFor={`note-${r.requestId}`}>Lời nhắn của ba mẹ cho con (tùy chọn):</label>
                        <input
                          id={`note-${r.requestId}`}
                          type="text"
                          maxLength={120}
                          placeholder="Ví dụ: Đã mua quà cho con vào Chủ Nhật nhé!"
                          value={redemptionNotes[r.requestId] || ''}
                          onChange={e => setRedemptionNotes(prev => ({
                            ...prev,
                            [r.requestId]: e.target.value
                          }))}
                          disabled={busy}
                        />
                      </div>
                      <div className="redemption-actions">
                        <button
                          type="button"
                          className="online-btn btn-approve"
                          onClick={() => handleRedemptionTransition(r.requestId, 'approved')}
                          disabled={busy}
                        >
                          ✓ Duyệt quà
                        </button>
                        <button
                          type="button"
                          className="online-btn btn-fulfill"
                          onClick={() => handleRedemptionTransition(r.requestId, 'fulfilled')}
                          disabled={busy}
                        >
                          🎁 Đã trao quà cho con
                        </button>
                        <button
                          type="button"
                          className="online-btn btn-reject"
                          onClick={() => {
                            if (window.confirm('Từ chối quà này? Số sao đã trừ sẽ được hoàn lại đầy đủ cho con.')) {
                              handleRedemptionTransition(r.requestId, 'rejected');
                            }
                          }}
                          disabled={busy}
                        >
                          ✕ Từ chối (Hoàn sao)
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="report-empty-note">Hiện tại không có yêu cầu đổi quà nào đang chờ duyệt.</p>
              )}
            </section>

            {/* Past Requests History */}
            {pastRedemptions.length > 0 && (
              <section className="gifts-section" aria-labelledby="history-gifts-title">
                <h3 id="history-gifts-title" className="section-title">📜 Lịch sử đổi quà</h3>
                <div className="table-responsive">
                  <table className="parent-table">
                    <thead>
                      <tr>
                        <th>Tên quà</th>
                        <th>Số sao</th>
                        <th>Trạng thái</th>
                        <th>Ngày gửi</th>
                        <th>Ghi chú</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pastRedemptions.map(r => (
                        <tr key={r.requestId}>
                          <td><strong>{r.title}</strong></td>
                          <td>⭐ {r.stars}</td>
                          <td>
                            <span className={`status-pill status-${r.status}`}>
                              {r.status === 'approved' ? 'Đã duyệt' : r.status === 'fulfilled' ? 'Đã trao quà' : r.status === 'rejected' ? 'Đã từ chối' : r.status}
                            </span>
                          </td>
                          <td>{new Date(r.requestedAt).toLocaleDateString('vi-VN')}</td>
                          <td>{r.note || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </div>
        )}

        {/* TAB 3: CONTROLS & SETTINGS */}
        {activeTab === 'settings' && (
          <div className="parent-settings-view">
            <div className="settings-section">
              <h3 className="section-title">⏱️ Giới hạn thời gian học mỗi ngày</h3>
              <p className="settings-desc">
                Kiểm soát thời lượng con sử dụng ứng dụng. Khi hết thời lượng, con sẽ được lưu bài và hoàn tất câu đang làm mà không mất sao.
              </p>

              <div className="minute-presets" role="group" aria-label="Chọn thời lượng nhanh">
                {[0, 15, 30, 45, 60, 90, 120].map(m => (
                  <button
                    key={m}
                    type="button"
                    className={`preset-btn ${maxMinutes === m ? 'active' : ''}`}
                    onClick={() => setMaxMinutes(m)}
                    disabled={busy}
                  >
                    {m === 0 ? 'Không giới hạn' : `${m} phút`}
                  </button>
                ))}
              </div>

              <div className="settings-input-group">
                <label htmlFor="custom-minutes">Hoặc nhập số phút tùy chỉnh:</label>
                <div className="input-with-unit">
                  <input
                    id="custom-minutes"
                    type="number"
                    min={0}
                    max={480}
                    value={maxMinutes}
                    onChange={e => setMaxMinutes(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    disabled={busy}
                  />
                  <span>phút / ngày (0 = không giới hạn)</span>
                </div>
              </div>
            </div>

            <div className="settings-section">
              <h3 className="section-title">🌙 Khung giờ được phép học (Giờ giới nghiêm)</h3>
              <p className="settings-desc">
                Ngăn con thức quá khuya hoặc học vào giờ nghỉ ngơi của gia đình (theo giờ Việt Nam).
              </p>

              <div className="curfew-hours-row">
                <div className="curfew-field">
                  <label htmlFor="start-hour">Giờ bắt đầu:</label>
                  <select
                    id="start-hour"
                    value={startHour}
                    onChange={e => setStartHour(parseInt(e.target.value, 10))}
                    disabled={busy}
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>
                        {('0' + i).slice(-2)}:00
                      </option>
                    ))}
                  </select>
                </div>

                <span className="curfew-sep">đến</span>

                <div className="curfew-field">
                  <label htmlFor="end-hour">Giờ kết thúc:</label>
                  <select
                    id="end-hour"
                    value={endHour}
                    onChange={e => setEndHour(parseInt(e.target.value, 10))}
                    disabled={busy}
                  >
                    {Array.from({ length: 24 }, (_, i) => i + 1).map(i => (
                      <option key={i} value={i}>
                        {('0' + (i === 24 ? 24 : i)).slice(-2)}:00 {i === 24 ? '(Hết ngày)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <p className="curfew-preview-text">
                ⏰ Con chỉ có thể vào luyện tập từ <strong>{('0' + startHour).slice(-2)}:00</strong> đến <strong>{('0' + endHour).slice(-2)}:00</strong> mỗi ngày.
              </p>

              <div className="settings-save-row">
                <button
                  type="button"
                  className="online-btn online-primary btn-save-settings"
                  onClick={handleSaveSettings}
                  disabled={busy}
                >
                  {busy ? 'Đang lưu…' : 'Lưu cài đặt thời gian'}
                </button>
              </div>
            </div>

            <div className="settings-section pin-settings-section">
              <h3 className="section-title">🔒 Đổi mã PIN Phụ huynh</h3>
              <p className="settings-desc">
                Mã PIN gồm 4–6 chữ số để ngăn học sinh tự thay đổi giờ học hoặc tự duyệt quà.
              </p>

              {pinChangeError && (
                <div className="online-notice online-error" role="alert">
                  {pinChangeError}
                </div>
              )}
              {pinChangeNotice && (
                <div className="online-notice online-success" role="status">
                  {pinChangeNotice}
                </div>
              )}

              <div className="pin-change-form">
                {data?.controls?.hasPin && !isParentAccount && (
                  <div className="form-row">
                    <label htmlFor="old-pin">Mã PIN hiện tại:</label>
                    <input
                      id="old-pin"
                      type="password"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      value={oldPin}
                      onChange={e => setOldPin(e.target.value.replace(/\D/g, ''))}
                      disabled={busy}
                    />
                  </div>
                )}

                <div className="form-row">
                  <label htmlFor="new-pin">Mã PIN mới (4–6 số):</label>
                  <input
                    id="new-pin"
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={newPin}
                    onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))}
                    disabled={busy}
                  />
                </div>

                <div className="form-row">
                  <label htmlFor="confirm-new-pin">Xác nhận lại mã PIN mới:</label>
                  <input
                    id="confirm-new-pin"
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={confirmNewPin}
                    onChange={e => setConfirmNewPin(e.target.value.replace(/\D/g, ''))}
                    disabled={busy}
                  />
                </div>

                <button
                  type="button"
                  className="online-btn btn-change-pin"
                  onClick={handleChangePin}
                  disabled={busy || newPin.length < 4}
                >
                  {busy ? 'Đang cập nhật…' : 'Đổi mã PIN'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
