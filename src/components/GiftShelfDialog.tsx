import {useCallback, useEffect, useRef, useState} from 'react';
import type {GiftItem, OnlineStudentSummary, StudentGoal} from '../core/online-contracts';
import {onlineApi} from '../core/online-client';
import {newId} from '../core/utils';
import {onlineRewardStatus, onlineTime} from '../core/online-format';
import {rewardStatus} from '../core/reward-wallet';
import {EmptyState} from '../ui/EmptyState';
import '../styles/gift-shelf.css';

interface GiftShelfDialogProps {
  state: OnlineStudentSummary;
  onRefresh: () => Promise<void>;
  onClose: () => void;
  onOpenLegacyWallet?: () => void;
  onAskParentsAddGift?: () => void;
}

const KIND_LABELS: Record<string, {label: string; icon: string}> = {
  item: {label: 'Vật phẩm', icon: '🎁'},
  experience: {label: 'Trải nghiệm', icon: '🎡'},
  privilege: {label: 'Đặc quyền', icon: '👑'},
  saving: {label: 'Tiết kiệm', icon: '💰'},
};

export default function GiftShelfDialog({state, onRefresh, onClose, onOpenLegacyWallet, onAskParentsAddGift}: GiftShelfDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [activeTab, setActiveTab] = useState<'shelf' | 'memorial'>('shelf');
  const [gifts, setGifts] = useState<GiftItem[]>([]);
  const [goal, setGoal] = useState<StudentGoal | null>(state.goal ?? null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const operating = useRef(false);

  useEffect(() => {
    const prevFocus = document.activeElement;
    dialogRef.current?.showModal();
    return () => {
      dialogRef.current?.close();
      if (prevFocus instanceof HTMLElement && prevFocus.isConnected) {
        prevFocus.focus({preventScroll: true});
      }
    };
  }, []);

  const fetchGiftsAndGoal = useCallback(async () => {
    try {
      setLoading(true);
      const [fetchedGifts, fetchedGoal] = await Promise.all([
        onlineApi.gifts(),
        onlineApi.studentGoal().catch(() => null),
      ]);
      setGifts(fetchedGifts);
      if (fetchedGoal) setGoal(fetchedGoal);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chưa tải được danh sách quà.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchGiftsAndGoal();
  }, [fetchGiftsAndGoal]);

  useEffect(() => {
    if (state.goal !== undefined) {
      setGoal(state.goal);
    }
  }, [state.goal]);

  async function handlePinGoal(gift: GiftItem) {
    if (operating.current) return;
    operating.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await onlineApi.setStudentGoal(gift.id);
      setGoal(res);
      setNotice(`Đã ghim "${gift.title}" làm mục tiêu phấn đấu!`);
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chưa ghim được mục tiêu.');
    } finally {
      operating.current = false;
      setBusy(false);
    }
  }

  async function handleRedeemGift(gift: GiftItem) {
    if (operating.current) return;
    if (!window.confirm(`Con muốn dùng ${gift.priceStars} sao để đổi "${gift.title}" chứ?`)) return;
    operating.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await onlineApi.redeemGift({requestId: newId(), giftId: gift.id});
      setNotice(`Chúc mừng con! Yêu cầu đổi "${gift.title}" đã được gửi tới thầy cô/bố mẹ.`);
      await Promise.all([onRefresh(), fetchGiftsAndGoal()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chưa đổi được quà.');
    } finally {
      operating.current = false;
      setBusy(false);
    }
  }

  async function handleConfirmReceived(requestId: string, title: string) {
    if (operating.current) return;
    if (!window.confirm(`Xác nhận con đã nhận được món quà "${title}"?`)) return;
    operating.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await onlineApi.confirmReceived(requestId);
      setNotice(`Hoan hô! Món quà "${title}" đã được lưu vào Tủ kỷ niệm của con! 🎉`);
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chưa xác nhận nhận quà được.');
    } finally {
      operating.current = false;
      setBusy(false);
    }
  }

  // Filter gift redemptions for Memorial Cabinet
  const giftRedemptions = state.requests.filter(r => !!r.giftId);

  return (
    <dialog
      className="online-dialog gift-shelf-dialog"
      ref={dialogRef}
      aria-labelledby="gift-shelf-title"
      onCancel={e => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      <header className="gift-shelf-header">
        <div className="gift-shelf-title-wrap">
          <h2 id="gift-shelf-title">🎁 Kệ quà của con</h2>
          <span className="gift-shelf-star-badge">⭐ {state.balance.available} sao khả dụng</span>
        </div>
        <button type="button" className="gift-shelf-close" onClick={onClose} disabled={busy} aria-label="Đóng Kệ quà">
          ✕
        </button>
      </header>

      <nav className="gift-shelf-tabs" aria-label="Các ngăn tủ">
        <button
          type="button"
          className={`gift-tab-btn ${activeTab === 'shelf' ? 'active' : ''}`}
          onClick={() => setActiveTab('shelf')}
          aria-pressed={activeTab === 'shelf'}
        >
          🎁 Kệ quà ({gifts.length})
        </button>
        <button
          type="button"
          className={`gift-tab-btn ${activeTab === 'memorial' ? 'active' : ''}`}
          onClick={() => setActiveTab('memorial')}
          aria-pressed={activeTab === 'memorial'}
        >
          🏆 Tủ kỷ niệm ({giftRedemptions.length})
        </button>
      </nav>

      {error && <p className="online-notice online-error" role="alert">{error}</p>}
      {notice && <p className="online-notice online-success" role="status">{notice}</p>}

      <div className="gift-shelf-body">
        {loading ? (
          <p className="gift-shelf-loading">Đang mở kệ quà…</p>
        ) : activeTab === 'shelf' ? (
          <div className="gift-shelf-grid">
            {gifts.length === 0 ? (
              <EmptyState
                icon="gift"
                title="Kệ quà đang được chuẩn bị"
                message="Thầy cô hoặc bố mẹ đang thêm các món quà hấp dẫn lên kệ. Con tích lũy sao trước nhé!"
                actionLabel="Hỏi bố mẹ thêm quà"
                onAction={() => {
                  onClose();
                  onAskParentsAddGift?.();
                }}
                className="gift-shelf-empty"
              />
            ) : (
              gifts.map(gift => {
                const kindInfo = KIND_LABELS[gift.kind] || KIND_LABELS.item;
                const isPinned = goal?.giftId === gift.id;
                const canAfford = state.balance.available >= gift.priceStars;
                const isOutOfStock = gift.stock === 0;
                const percent = Math.min(100, Math.round((state.balance.available / gift.priceStars) * 100));

                return (
                  <article key={gift.id} className={`gift-card ${isPinned ? 'is-pinned' : ''}`}>
                    <div className="gift-card-media">
                      {gift.imageMediaId||gift.imageUrl ? (
                        <img
                          src={gift.imageMediaId?`/api/online/media/${encodeURIComponent(gift.imageMediaId)}`:gift.imageUrl}
                          alt={gift.title}
                          className="gift-card-img"
                          loading="lazy"
                        />
                      ) : (
                        <span className="gift-card-fallback-icon" aria-hidden="true">
                          {kindInfo.icon}
                        </span>
                      )}
                      <span className="gift-kind-pill">{kindInfo.label}</span>
                    </div>

                    <div className="gift-card-content">
                      <h3 className="gift-card-title">{gift.title}</h3>
                      {gift.referencePriceVnd!==undefined&&<p className="gift-reference-price">Giá tham khảo: {gift.referencePriceVnd.toLocaleString('vi-VN')} ₫</p>}
                      <div className="gift-card-meta">
                        <span className="gift-price-tag">⭐ {gift.priceStars} sao</span>
                        <span className="gift-stock-tag">
                          {gift.stock !== null&&gift.stock>=0 ? (isOutOfStock ? 'Hết hàng' : `Còn ${gift.stock} món`) : 'Bố mẹ chuẩn bị quà'}
                        </span>
                      </div>

                      <div className="gift-progress-block">
                        <div className="gift-meter-track">
                          <div
                            className={`gift-meter-fill ${canAfford ? 'is-ready' : ''}`}
                            style={{width: `${percent}%`}}
                          />
                        </div>
                        <span className="gift-progress-text">
                          {canAfford ? 'Đã đủ sao!' : `${state.balance.available}/${gift.priceStars} sao (${percent}%)`}
                        </span>
                      </div>

                      <div className="gift-card-actions">
                        <button
                          type="button"
                          className={`gift-pin-btn ${isPinned ? 'is-active' : ''}`}
                          onClick={() => void handlePinGoal(gift)}
                          disabled={busy || isPinned}
                          aria-label={isPinned ? 'Món này đang được ghim' : `Ghim ${gift.title} làm mục tiêu`}
                        >
                          {isPinned ? '✓ Đang ghim' : '📌 Ghim mục tiêu'}
                        </button>
                        <button
                          type="button"
                          className="gift-redeem-btn"
                          onClick={() => void handleRedeemGift(gift)}
                          disabled={busy || !canAfford || isOutOfStock}
                          title={isOutOfStock ? 'Món quà đã hết hàng' : !canAfford ? 'Chưa đủ sao' : 'Đổi quà ngay'}
                        >
                          {isOutOfStock ? 'Hết hàng' : 'Đổi quà ngay'}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        ) : (
          <div className="memorial-cabinet">
            {giftRedemptions.length === 0 ? (
              <EmptyState
                icon="trophy"
                title="Tủ kỷ niệm chưa có món quà nào"
                message="Hãy phấn đấu tích sao và đổi quà để lưu giữ kỷ niệm vào tủ nhé!"
                actionLabel="Xem Kệ quà"
                onAction={() => setActiveTab('shelf')}
                className="gift-shelf-empty"
              />
            ) : (
              <ul className="memorial-list">
                {giftRedemptions.map(req => {
                  const status = rewardStatus(req);
                  const isReceived = !!req.receivedAt;
                  const isFulfilled = status === 'fulfilled';

                  return (
                    <li key={req.requestId} className={`memorial-item ${isReceived ? 'is-received' : ''}`}>
                      <div className="memorial-item-head">
                        <span className="memorial-item-icon" aria-hidden="true">
                          {isReceived ? '🎉' : '🎁'}
                        </span>
                        <div className="memorial-item-info">
                          <strong className="memorial-title">{req.title}</strong>
                          <span className="memorial-meta">
                            {req.stars} sao · Đổi lúc {onlineTime(req.requestedAt)}
                          </span>
                        </div>
                        <span className="online-badge">{onlineRewardStatus[status]}</span>
                      </div>

                      {req.history && req.history.length > 1 && (
                        <div className="memorial-history">
                          {req.history.slice(1).map((h, i) => (
                            <small key={i}>
                              {onlineRewardStatus[h.status]} lúc {onlineTime(h.at)}
                              {h.note ? ` (${h.note})` : ''}
                            </small>
                          ))}
                        </div>
                      )}

                      <div className="memorial-item-foot">
                        {isReceived ? (
                          <span className="memorial-received-badge">
                            ✓ Con đã nhận quà vào {onlineTime(req.receivedAt!)}
                          </span>
                        ) : (
                          <div className="memorial-receive-action">
                            {isFulfilled ? (
                              <button
                                type="button"
                                className="confirm-received-btn"
                                onClick={() => void handleConfirmReceived(req.requestId, req.title)}
                                disabled={busy}
                              >
                                🎉 Con đã nhận quà!
                              </button>
                            ) : (
                              <span className="memorial-waiting-text">
                                ⏳ Đang chờ người lớn trao quà thực tế cho con…
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>

      <footer className="gift-shelf-footer">
        <p className="gift-shelf-footer-note">
          Tích lũy sao từ các bài học để đổi những món quà tuyệt vời nhất!
        </p>
        {onOpenLegacyWallet && (
          <button
            type="button"
            className="legacy-wallet-link-btn"
            onClick={() => {
              onClose();
              onOpenLegacyWallet();
            }}
          >
            💰 Mở ví tiết kiệm heo đất
          </button>
        )}
      </footer>
    </dialog>
  );
}
