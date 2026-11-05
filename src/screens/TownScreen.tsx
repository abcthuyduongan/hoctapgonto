import React, { useState, useEffect, useCallback } from 'react';
import { onlineApi } from '../core/online-client.ts';
import type {
  TownSummaryResponse,
  BuildingCatalogItem,
  MaterialType,
  PlacedBuilding,
} from '../core/online-contracts.ts';
import {
  MATERIAL_LABELS,
  MATERIAL_ICONS,
  TOWN_BUILDING_MAP,
} from '../core/town-contracts.ts';
import { canAffordBuilding } from '../core/town-materials.ts';
import { validateAnimalName } from '../core/animal-neighbors.ts';
import { ClassFeedDialog } from './ClassFeedDialog.tsx';
import '../styles/town.css';

interface TownScreenProps {
  onBack: () => void;
  studentId?: string;
}

interface VisitingState {
  studentId: string;
  studentName: string;
  town: TownSummaryResponse['town'];
  animals: any[];
  cheersCount: number;
}

export const TownScreen: React.FC<TownScreenProps> = ({ onBack, studentId }) => {
  const [data, setData] = useState<TownSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<BuildingCatalogItem | null>(null);
  const [targetCell, setTargetCell] = useState<{ x: number; y: number } | null>(null);
  const [isPlacing, setIsPlacing] = useState(false);
  const [conflictNotice, setConflictNotice] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Tuần 9 Social & Social Feed States
  const [showAnimalsModal, setShowAnimalsModal] = useState(false);
  const [animalsData, setAnimalsData] = useState<{ animals: any[]; completedWeeksCount: number } | null>(null);
  const [namingTarget, setNamingTarget] = useState<any | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [namingError, setNamingError] = useState<string | null>(null);
  const [namingLoading, setNamingLoading] = useState(false);

  const [showClassmatesModal, setShowClassmatesModal] = useState(false);
  const [classmatesList, setClassmatesList] = useState<any[]>([]);
  const [classmatesLoading, setClassmatesLoading] = useState(false);

  const [visiting, setVisiting] = useState<VisitingState | null>(null);
  const [cheerLoading, setCheerLoading] = useState(false);
  const [cheeredToday, setCheeredToday] = useState(false);

  const [showFeedDialog, setShowFeedDialog] = useState(false);

  const fetchTown = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setConflictNotice(null);
      const res = await onlineApi.townSummary(studentId);
      setData(res);
    } catch (err: any) {
      setError(err?.message || 'Không thể tải thông tin thị trấn.');
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    fetchTown();
  }, [fetchTown]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleCellClick = (x: number, y: number) => {
    if (visiting) {
      const occupied = visiting.town.buildings.find((b) => b.x === x && b.y === y);
      if (occupied) {
        const item = TOWN_BUILDING_MAP.get(occupied.buildingId);
        showToast(`Công trình của ${visiting.studentName}: ${item?.name || occupied.buildingId}`);
      } else {
        showToast(`Ô đất (${x}, ${y}) của ${visiting.studentName}`);
      }
      return;
    }

    if (!data) return;
    const occupied = data.town.buildings.find((b) => b.x === x && b.y === y);
    if (occupied) {
      const item = TOWN_BUILDING_MAP.get(occupied.buildingId);
      showToast(`Công trình: ${item?.name || occupied.buildingId} (${x}, ${y})`);
      return;
    }

    if (selectedBuilding) {
      setTargetCell({ x, y });
    } else {
      setTargetCell({ x, y });
      showToast(`Đã chọn ô (${x}, ${y}). Hãy chọn một công trình từ danh sách để xây!`);
    }
  };

  const handleConfirmPlacement = async () => {
    if (!data || !selectedBuilding || !targetCell) return;
    try {
      setIsPlacing(true);
      const requestId = 'req_' + Math.random().toString(36).slice(2) + Date.now();
      const res = await onlineApi.buildBuilding({
        buildingId: selectedBuilding.id,
        x: targetCell.x,
        y: targetCell.y,
        expectedRevision: data.town.revision,
        requestId,
        studentId,
      });

      if (res.ok) {
        setData((prev) =>
          prev
            ? {
                ...prev,
                town: res.town,
                materials: res.materials,
              }
            : null
        );
        showToast(`🎉 Xây dựng thành công ${selectedBuilding.name}!`);
        setSelectedBuilding(null);
        setTargetCell(null);
      }
    } catch (err: any) {
      if (err?.status === 409 || err?.statusCode === 409) {
        setConflictNotice(
          'Thị trấn đã được cập nhật từ thiết bị khác. Vui lòng tải lại để xem bản đồ mới nhất!'
        );
      } else {
        showToast(`Lỗi: ${err?.message || 'Không thể xây công trình.'}`);
      }
    } finally {
      setIsPlacing(false);
    }
  };

  const handleRecalculate = async () => {
    try {
      showToast('Đang kiểm tra và tính lại vật liệu từ sổ sao...');
      const updatedMaterials = await onlineApi.recalculateMaterials(studentId);
      setData((prev) => (prev ? { ...prev, materials: updatedMaterials } : null));
      showToast('✅ Đã đồng bộ vật liệu thành công!');
    } catch (err: any) {
      showToast(`Lỗi: ${err?.message || 'Đồng bộ thất bại.'}`);
    }
  };

  // Open Animals Modal
  const openAnimalsModal = async () => {
    try {
      setShowAnimalsModal(true);
      const res = await onlineApi.townAnimals(studentId);
      setAnimalsData(res);
    } catch (err: any) {
      showToast(`Lỗi: ${err?.message || 'Chưa tải được danh sách động vật.'}`);
    }
  };

  const startNamingAnimal = (animal: any) => {
    setNamingTarget(animal);
    setNameInput(animal.name || animal.defaultName || '');
    setNamingError(null);
  };

  const saveAnimalName = async () => {
    if (!namingTarget) return;
    const validation = validateAnimalName(nameInput);
    if (!validation.valid) {
      setNamingError(validation.error || 'Tên chưa hợp lệ.');
      return;
    }

    try {
      setNamingLoading(true);
      setNamingError(null);
      const res = await onlineApi.nameTownAnimal({
        animalId: namingTarget.animalId,
        name: nameInput.trim(),
      });
      if (res.ok) {
        showToast(`🎉 Đã đặt tên bạn nhỏ là "${res.animal.name}"!`);
        setNamingTarget(null);
        // Refresh animals
        const updated = await onlineApi.townAnimals(studentId);
        setAnimalsData(updated);
      }
    } catch (err: any) {
      setNamingError(err?.message || 'Không thể lưu tên bạn nhỏ.');
    } finally {
      setNamingLoading(false);
    }
  };

  // Open Classmates Modal
  const openClassmatesModal = async () => {
    try {
      setShowClassmatesModal(true);
      setClassmatesLoading(true);
      const list = await onlineApi.classmatesTowns();
      setClassmatesList(list);
    } catch (err: any) {
      showToast(`Lỗi: ${err?.message || 'Chưa tải được danh sách bạn cùng lớp.'}`);
    } finally {
      setClassmatesLoading(false);
    }
  };

  // Visit a classmate
  const visitClassmate = async (c: any) => {
    try {
      setLoading(true);
      setShowClassmatesModal(false);
      const visitRes = await onlineApi.visitTown(c.studentId);
      setVisiting({
        studentId: c.studentId,
        studentName: visitRes.studentName,
        town: visitRes.town,
        animals: visitRes.animals || [],
        cheersCount: visitRes.cheersCount || 0,
      });
      setCheeredToday(false);
      showToast(`Đang ghé thăm thị trấn của bạn ${visitRes.studentName}!`);
    } catch (err: any) {
      showToast(`Lỗi: ${err?.message || 'Không thể ghé thăm bạn.'}`);
    } finally {
      setLoading(false);
    }
  };

  // Cheer current visited classmate
  const handleCheer = async () => {
    if (!visiting || cheerLoading || cheeredToday) return;
    try {
      setCheerLoading(true);
      const res = await onlineApi.cheerClassmate(visiting.studentId);
      if (res.ok) {
        setVisiting((prev) => (prev ? { ...prev, cheersCount: res.cheersCount } : null));
        setCheeredToday(true);
        showToast(`🎉 Đã gửi lời cổ vũ nồng nhiệt đến bạn ${visiting.studentName}!`);
      }
    } catch (err: any) {
      showToast(`Lỗi: ${err?.message || 'Chưa thể gửi lời cổ vũ.'}`);
    } finally {
      setCheerLoading(false);
    }
  };

  const returnToOwnTown = () => {
    setVisiting(null);
    setSelectedBuilding(null);
    setTargetCell(null);
  };

  if (loading && !data && !visiting) {
    return (
      <div className="town-screen-loading">
        <div className="town-spinner" />
        <p>Đang chuẩn bị thị trấn của con...</p>
      </div>
    );
  }

  if (error && !data && !visiting) {
    return (
      <div className="town-screen-error">
        <h2>Không thể mở Thị trấn</h2>
        <p>{error}</p>
        <button onClick={fetchTown}>Thử lại</button>
        <button onClick={onBack} style={{ marginLeft: '1rem' }}>
          Quay lại bản đồ
        </button>
      </div>
    );
  }

  const activeTown = visiting ? visiting.town : data?.town;
  const materials = data?.materials || { stone: 0, wood: 0, fish: 0, component: 0 };
  const catalog = data?.catalog || [];
  const walletAvailableStars = data?.walletAvailableStars || 0;

  // Build grid map lookup
  const buildingsByCoord = new Map<string, PlacedBuilding>();
  if (activeTown?.buildings) {
    for (const b of activeTown.buildings) {
      buildingsByCoord.set(`${b.x},${b.y}`, b);
    }
  }

  return (
    <div className="town-container">
      {/* Header bar */}
      <header className="town-header">
        <div className="town-header-left">
          <button className="town-back-btn" onClick={visiting ? returnToOwnTown : onBack}>
            {visiting ? '🏠 Về thị trấn của mình' : '← Quay lại bản đồ'}
          </button>
          <h1 className="town-title">
            {visiting ? `🏡 Thị trấn của bạn ${visiting.studentName}` : '🏡 Thị trấn của con'}
          </h1>
          {!visiting && (
            <div className="town-star-pill" title="Xây dựng thị trấn KHÔNG trừ vào ví sao đổi quà thật">
              ⭐ Ví sao: <strong>{walletAvailableStars}</strong> (An toàn 100%)
            </div>
          )}
        </div>

        {/* Materials Bar or Visiting Bar */}
        {!visiting ? (
          <div className="town-material-bar">
            {(['stone', 'wood', 'fish', 'component'] as MaterialType[]).map((mat) => (
              <div key={mat} className={`material-chip ${mat}`} title={`Vật liệu kiếm từ môn học`}>
                <span className="material-icon">{MATERIAL_ICONS[mat]}</span>
                <span className="material-label">
                  {MATERIAL_LABELS[mat]}
                  {mat === 'stone' && ' (Toán)'}
                  {mat === 'wood' && ' (Tiếng Việt)'}
                  {mat === 'fish' && ' (Tiếng Anh)'}
                  {mat === 'component' && ' (Tin học)'}
                  :
                </span>
                <span className="material-count">{materials[mat] || 0}</span>
              </div>
            ))}

            <button
              className="sync-materials-btn"
              onClick={handleRecalculate}
              title="Đồng bộ tính lại vật liệu từ sổ sao học tập"
            >
              🔄 Đồng bộ
            </button>
            <button
              className="sync-materials-btn"
              onClick={openAnimalsModal}
              title="Xem bạn động vật chuyển đến thị trấn"
            >
              🐾 Bạn nhỏ
            </button>
            <button
              className="sync-materials-btn"
              onClick={openClassmatesModal}
              title="Ghé thăm thị trấn của các bạn cùng lớp"
            >
              👥 Thăm bạn
            </button>
            <button
              className="sync-materials-btn"
              onClick={() => setShowFeedDialog(true)}
              title="Xem bảng tin sự kiện lớp học"
            >
              📢 Bảng tin
            </button>
          </div>
        ) : (
          <div className="town-material-bar" style={{ background: '#e0f2fe', borderColor: '#0284c7' }}>
            <span style={{ fontWeight: 600, color: '#0369a1', marginRight: '8px' }}>
              ❤️ Lượt cổ vũ: <strong>{visiting.cheersCount}</strong>
            </span>
            <button
              className="sync-materials-btn"
              onClick={handleCheer}
              disabled={cheerLoading || cheeredToday}
              style={{
                background: cheeredToday ? '#94a3b8' : 'linear-gradient(135deg, #f43f5e, #e11d48)',
                color: '#ffffff',
                border: 'none',
              }}
            >
              {cheeredToday ? '✓ Đã cổ vũ hôm nay' : '🎉 Cổ vũ bạn ngay!'}
            </button>
          </div>
        )}
      </header>

      {/* Conflict banner */}
      {conflictNotice && (
        <div className="conflict-alert" role="alert">
          <span>{conflictNotice}</span>
          <button onClick={fetchTown}>Tải lại ngay</button>
        </div>
      )}

      {/* Toast popup */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            top: '80px',
            right: '20px',
            background: '#2e7d32',
            color: '#fff',
            padding: '0.6rem 1.25rem',
            borderRadius: '12px',
            boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
            zIndex: 100,
            fontWeight: 700,
          }}
        >
          {toastMessage}
        </div>
      )}

      <main className="town-body">
        {/* Left Arena: 10x10 Grid */}
        <section className="town-grid-card">
          <div className="town-grid-header">
            <h2>
              {visiting
                ? `Khu đất của ${visiting.studentName} (10 × 10) • ${activeTown?.buildings?.length || 0} công trình`
                : `Khu đất thị trấn (10 × 10) • ${activeTown?.buildings?.length || 0} công trình`}
            </h2>
            {selectedBuilding && !visiting && (
              <span className="selected-tip">
                Đang chọn: <strong>{selectedBuilding.name}</strong> • Hãy bấm ô đất trống để đặt!
              </span>
            )}
            {visiting && (
              <span style={{ fontSize: '0.85rem', color: '#0284c7', fontWeight: 600 }}>
                (Chế độ chỉ xem • Không thể chỉnh sửa thị trấn của bạn)
              </span>
            )}
          </div>

          <div className="grid-wrapper">
            <div className="town-grid-10" role="grid" aria-label="Bản đồ thị trấn 10x10">
              {Array.from({ length: 10 }, (_, y) =>
                Array.from({ length: 10 }, (_, x) => {
                  const key = `${x},${y}`;
                  const placed = buildingsByCoord.get(key);
                  const isTarget = targetCell?.x === x && targetCell?.y === y;
                  const item = placed ? TOWN_BUILDING_MAP.get(placed.buildingId) : null;

                  return (
                    <button
                      key={key}
                      className={`grid-cell ${placed ? 'occupied' : ''} ${
                        isTarget ? 'highlight-target' : ''
                      }`}
                      onClick={() => handleCellClick(x, y)}
                      title={
                        placed
                          ? `${item?.name || placed.buildingId} (${x}, ${y})`
                          : `Ô đất trống (${x}, ${y})`
                      }
                      aria-label={
                        placed
                          ? `${item?.name || placed.buildingId} tại ô ${x}, ${y}`
                          : `Ô trống ${x}, ${y}`
                      }
                    >
                      {placed && item ? (
                        <img
                          src={item.image}
                          alt={item.name}
                          className="building-sprite"
                          loading="lazy"
                        />
                      ) : (
                        <span className="empty-cell-hint">{`${x},${y}`}</span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </section>

        {/* Right Drawer: 12 Buildings Catalog or Visiting Sidebar */}
        {!visiting ? (
          <aside className="town-catalog-card">
            <div className="catalog-title">
              <span>🏛️ Danh mục xây dựng</span>
              <span style={{ fontSize: '0.85rem', color: '#2e7d32', fontWeight: 700 }}>
                12 công trình
              </span>
            </div>
            <p className="catalog-subtitle">
              Học đều các môn để kiếm đủ vật liệu xây công trình mơ ước!
            </p>

            <div className="building-list">
              {catalog.map((b) => {
                const affordable = canAffordBuilding(materials, b.cost);
                const isSelected = selectedBuilding?.id === b.id;

                return (
                  <div
                    key={b.id}
                    className={`building-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => setSelectedBuilding(b)}
                  >
                    <div className="building-top-row">
                      <img src={b.image} alt={b.name} className="building-thumb" />
                      <div className="building-info">
                        <div className="building-name">
                          {b.name}
                          {b.isLarge && <span className="large-badge">Công trình lớn</span>}
                        </div>
                        <p className="building-desc">{b.description}</p>
                      </div>
                    </div>

                    <div className="building-cost-row">
                      <div className="cost-tags">
                        {(Object.entries(b.cost) as [MaterialType, number][]).map(([mat, amt]) => {
                          const current = materials[mat] || 0;
                          const hasEnough = current >= amt;
                          return (
                            <span
                              key={mat}
                              className={`cost-tag ${hasEnough ? 'sufficient' : 'insufficient'}`}
                              title={`Cần ${amt} ${MATERIAL_LABELS[mat]} (Hiện có ${current})`}
                            >
                              {MATERIAL_ICONS[mat]} {amt}
                            </span>
                          );
                        })}
                      </div>

                      <button
                        className="build-btn"
                        disabled={!affordable}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedBuilding(b);
                          if (!targetCell) {
                            showToast(`Đã chọn ${b.name}! Hãy bấm một ô đất trống trên bản đồ.`);
                          }
                        }}
                      >
                        {isSelected ? 'Đang chọn' : affordable ? 'Chọn xây' : 'Thiếu vật liệu'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>
        ) : (
          <aside className="town-catalog-card">
            <div className="catalog-title">
              <span>🏡 Thông tin thị trấn bạn bè</span>
            </div>
            <div style={{ padding: '16px 0', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>
                {visiting.studentName}
              </div>
              <div style={{ fontSize: '14px', color: '#64748b', lineHeight: 1.6 }}>
                <div>🏛️ Công trình đã xây: <strong>{visiting.town.buildings.length}</strong></div>
                <div>❤️ Lượt cổ vũ nhận được: <strong>{visiting.cheersCount}</strong></div>
                <div>🐾 Bạn động vật: <strong>{visiting.animals.length}</strong></div>
              </div>
            </div>

            {visiting.animals.length > 0 && (
              <div style={{ marginTop: '16px' }}>
                <h4 style={{ margin: '0 0 10px', fontSize: '15px', color: '#334155' }}>
                  🐾 Hàng xóm động vật của bạn:
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {visiting.animals.map((an: any) => (
                    <div
                      key={an.animalId}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '8px 12px',
                        background: '#f8fafc',
                        borderRadius: '12px',
                        border: '1px solid #e2e8f0',
                      }}
                    >
                      <span style={{ fontSize: '24px' }}>{an.icon || '🐰'}</span>
                      <div>
                        <strong style={{ fontSize: '14px', color: '#1e293b' }}>{an.name}</strong>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>{an.species}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginTop: '24px' }}>
              <button
                type="button"
                className="button-primary"
                onClick={handleCheer}
                disabled={cheerLoading || cheeredToday}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '14px',
                  background: cheeredToday ? '#94a3b8' : 'linear-gradient(135deg, #f43f5e, #e11d48)',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '15px',
                  border: 'none',
                  cursor: cheeredToday ? 'default' : 'pointer',
                  marginBottom: '10px',
                }}
              >
                {cheeredToday ? '✓ Đã cổ vũ bạn hôm nay' : '🎉 Cổ vũ bạn ngay!'}
              </button>
              <button
                type="button"
                className="town-btn-cancel"
                onClick={returnToOwnTown}
                style={{ width: '100%' }}
              >
                Trở về thị trấn của mình
              </button>
            </div>
          </aside>
        )}
      </main>

      {/* Confirmation Modal when cell and building are both picked */}
      {selectedBuilding && targetCell && !visiting && (
        <div className="placement-modal-backdrop">
          <div className="placement-modal" role="dialog" aria-modal="true">
            <h3>Xác nhận xây dựng?</h3>
            <div style={{ margin: '1rem 0' }}>
              <img
                src={selectedBuilding.image}
                alt={selectedBuilding.name}
                style={{ width: '80px', height: '80px', objectFit: 'contain' }}
              />
            </div>
            <p>
              Bạn có muốn xây <strong>{selectedBuilding.name}</strong> tại ô đất (
              <strong>{targetCell.x}</strong>, <strong>{targetCell.y}</strong>)?
            </p>
            <div style={{ marginBottom: '1.25rem', fontSize: '0.85rem', color: '#666' }}>
              Vật liệu tiêu hao:{' '}
              {(Object.entries(selectedBuilding.cost) as [MaterialType, number][])
                .map(([m, a]) => `${MATERIAL_ICONS[m]} ${a} ${MATERIAL_LABELS[m]}`)
                .join(', ')}
            </div>
            <div className="modal-actions">
              <button
                className="modal-cancel-btn"
                onClick={() => {
                  setSelectedBuilding(null);
                  setTargetCell(null);
                }}
                disabled={isPlacing}
              >
                Hủy bỏ
              </button>
              <button
                className="modal-confirm-btn"
                onClick={handleConfirmPlacement}
                disabled={isPlacing}
              >
                {isPlacing ? 'Đang xây...' : 'Đồng ý xây'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Animal Neighbors */}
      {showAnimalsModal && (
        <div className="town-modal-backdrop" role="dialog" aria-modal="true">
          <div className="town-modal-card" style={{ maxWidth: '520px', width: '92%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '20px', color: '#1e293b' }}>
                🐾 Hàng Xóm Động Vật Của Con
              </h3>
              <button
                type="button"
                className="town-catalog-close"
                onClick={() => {
                  setShowAnimalsModal(false);
                  setNamingTarget(null);
                }}
              >
                ✕
              </button>
            </div>

            <p style={{ margin: '0 0 16px', fontSize: '14px', color: '#64748b', lineHeight: 1.5 }}>
              Mỗi khi hoàn thành 4 tuần học, một người bạn động vật đáng yêu sẽ chuyển đến sống tại thị trấn và con được tự tay đặt tên cho bạn ấy!
            </p>

            {animalsData?.animals && animalsData.animals.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '360px', overflowY: 'auto' }}>
                {animalsData.animals.map((animal) => (
                  <div
                    key={animal.animalId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 14px',
                      borderRadius: '16px',
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    <span style={{ fontSize: '32px' }}>{animal.icon || '🐰'}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>
                        {animal.name}
                        {animal.hasCustomName && (
                          <span style={{ fontSize: '11px', color: '#059669', marginLeft: '6px', fontWeight: 500 }}>
                            (Tên con đặt)
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>{animal.species} • Đến sau Tuần {animal.arrivedAtWeek}</div>
                      <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#475569' }}>{animal.description}</p>
                    </div>
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() => startNamingAnimal(animal)}
                      style={{ fontSize: '13px', padding: '6px 12px', borderRadius: '10px' }}
                    >
                      ✏️ Đổi tên
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div
                style={{
                  textAlign: 'center',
                  padding: '30px 20px',
                  background: '#f8fafc',
                  borderRadius: '16px',
                  color: '#64748b',
                }}
              >
                <span style={{ fontSize: '36px', display: 'block', marginBottom: '8px' }}>🏡</span>
                <strong>Chưa có bạn động vật nào chuyển đến</strong>
                <p style={{ margin: '6px 0 0', fontSize: '13px' }}>
                  Con đã hoàn thành {animalsData?.completedWeeksCount || 0}/4 tuần học. Hãy hoàn thành Tuần 4 để đón người bạn Thỏ Trắng đầu tiên nhé!
                </p>
              </div>
            )}

            {/* Inline naming dialog */}
            {namingTarget && (
              <div
                style={{
                  marginTop: '16px',
                  padding: '16px',
                  background: '#f0fdf4',
                  borderRadius: '16px',
                  border: '1px solid #bbf7d0',
                }}
              >
                <div style={{ fontWeight: 600, color: '#166534', marginBottom: '8px' }}>
                  🏷️ Đặt tên cho bạn {namingTarget.species}:
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => {
                      setNameInput(e.target.value);
                      setNamingError(null);
                    }}
                    placeholder="Nhập tên dễ thương (2-20 ký tự)..."
                    maxLength={20}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: '10px',
                      border: '1px solid #86efac',
                      fontSize: '14px',
                    }}
                  />
                  <button
                    type="button"
                    className="button-primary"
                    onClick={saveAnimalName}
                    disabled={namingLoading || !nameInput.trim()}
                    style={{ padding: '8px 16px', borderRadius: '10px' }}
                  >
                    {namingLoading ? 'Đang lưu...' : 'Lưu tên'}
                  </button>
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => setNamingTarget(null)}
                    style={{ padding: '8px 12px', borderRadius: '10px' }}
                  >
                    Hủy
                  </button>
                </div>
                {namingError && (
                  <div style={{ color: '#dc2626', fontSize: '12px', marginTop: '6px' }}>
                    ⚠️ {namingError}
                  </div>
                )}
              </div>
            )}

            <div style={{ marginTop: '20px', textAlign: 'center' }}>
              <button
                type="button"
                className="town-btn-cancel"
                onClick={() => {
                  setShowAnimalsModal(false);
                  setNamingTarget(null);
                }}
                style={{ width: '100%' }}
              >
                Đóng lại
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Classmates Towns */}
      {showClassmatesModal && (
        <div className="town-modal-backdrop" role="dialog" aria-modal="true">
          <div className="town-modal-card" style={{ maxWidth: '480px', width: '92%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '20px', color: '#1e293b' }}>
                👥 Thị Trấn Bạn Cùng Lớp
              </h3>
              <button
                type="button"
                className="town-catalog-close"
                onClick={() => setShowClassmatesModal(false)}
              >
                ✕
              </button>
            </div>

            <p style={{ margin: '0 0 16px', fontSize: '14px', color: '#64748b' }}>
              Ghé thăm thị trấn của bạn bè và gửi tặng lời cổ vũ khích lệ tinh thần học tập nhé!
            </p>

            <div style={{ maxHeight: '340px', overflowY: 'auto' }}>
              {classmatesLoading ? (
                <div style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                  Đang tải danh sách bạn cùng lớp...
                </div>
              ) : classmatesList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                  Chưa có bạn cùng lớp nào khác trong lớp của con.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {classmatesList.map((c) => (
                    <div
                      key={c.studentId}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 14px',
                        background: c.isSelf ? '#f0fdf4' : '#f8fafc',
                        borderRadius: '14px',
                        border: c.isSelf ? '1px solid #86efac' : '1px solid #e2e8f0',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '15px', fontWeight: 700, color: '#1e293b' }}>
                          {c.name} {c.isSelf && <span style={{ color: '#16a34a', fontSize: '12px' }}>(Con)</span>}
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                          🏛️ {c.buildingsCount} công trình • ❤️ {c.cheersCount} cổ vũ • 🐾 {c.animalsCount} bạn nhỏ
                        </div>
                      </div>

                      {!c.isSelf ? (
                        <button
                          type="button"
                          className="button-primary"
                          onClick={() => visitClassmate(c)}
                          style={{
                            padding: '8px 14px',
                            borderRadius: '12px',
                            fontSize: '13px',
                          }}
                        >
                          Ghé thăm ➜
                        </button>
                      ) : (
                        <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: 600 }}>Thị trấn của con</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ marginTop: '20px', textAlign: 'center' }}>
              <button
                type="button"
                className="town-btn-cancel"
                onClick={() => setShowClassmatesModal(false)}
                style={{ width: '100%' }}
              >
                Đóng lại
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Class Feed Dialog */}
      {showFeedDialog && (
        <ClassFeedDialog onClose={() => setShowFeedDialog(false)} />
      )}
    </div>
  );
};
