import {BAO_AN_GIFT_PRESET} from '../core/gift-presets';
import {onlineMoney} from '../core/online-format';
import '../styles/gift-preset.css';

export default function GiftPresetPanel({busy,onInstall}:{busy:boolean;onInstall:()=>void}){
  return <details className="gift-preset-panel">
    <summary>Bộ 20 món quà dành cho Bảo An</summary>
    <p>Đồ ăn, đồ uống, truyện và đồ chơi. <strong>1 sao = 500 đồng.</strong> Số sao làm tròn lên; bố mẹ có thể sửa từng món sau khi thêm.</p>
    <p>Thêm lại sẽ giữ nguyên các món đã chỉnh và thành tích của con. Yêu cầu đổi thưởng cũ giữ tỷ lệ lúc gửi.</p>
    <button type="button" disabled={busy} onClick={onInstall}>Thêm bộ 20 quà · Đặt 1 sao = 500 đồng</button>
    <div className="gift-preset-grid">
      {BAO_AN_GIFT_PRESET.map(item=><article key={item.id}>
        <img src={item.imageUrl} alt={item.title} width={280} height={220} loading="lazy"/>
        <small>{item.category}</small>
        <h3>{item.title}</h3>
        <p>Giá tham khảo: <strong>{onlineMoney(item.referencePriceVnd)}</strong></p>
        <p className="gift-preset-stars">⭐ {item.priceStars} sao</p>
        <a href={item.sourceUrl} target="_blank" rel="noreferrer">Nguồn giá: {item.sourceName}</a>
      </article>)}
    </div>
  </details>;
}
