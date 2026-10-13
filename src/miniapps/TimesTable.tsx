import { useState } from 'react';

/** Mini-app tương tác không chấm điểm; không khởi tạo phiên game hay dùng Phaser. */
export default function TimesTable({onExit}:{onExit:()=>void}) {
  const [number,setNumber] = useState(2);
  const [revealed,setRevealed] = useState<number[]>([]);
  const toggle = (n:number) => setRevealed(p => p.includes(n) ? p.filter(x=>x!==n) : [...p,n]);
  return <section className="play-panel times-panel">
    <div className="eyebrow">MINI APP / TOÁN TIỂU HỌC</div>
    <h2>Khám phá bảng cửu chương</h2>
    <p className="muted">Chọn một bảng nhân, sau đó chạm vào từng ô để mở kết quả. Không tính điểm, con học theo tốc độ riêng.</p>
    <div className="times-tabs" aria-label="Chọn bảng nhân">{Array.from({length:8},(_,i)=>i+2).map(n=><button key={n} className={number===n?'chosen':''} aria-pressed={number===n} onClick={()=>{setNumber(n);setRevealed([]);}}>×{n}</button>)}</div>
    <div className="times-grid">{Array.from({length:10},(_,i)=>i+1).map(i=><button key={`${number}-${i}`} className={revealed.includes(i)?'revealed':''} onClick={()=>toggle(i)} aria-label={`${number} nhân ${i}, ${revealed.includes(i)?`bằng ${number*i}`:'chạm để xem kết quả'}`}><span>{number} × {i}</span><strong>{revealed.includes(i)?`= ${number*i}`:'= ?'}</strong></button>)}</div>
    <div className="times-actions"><button className="button outline" onClick={()=>setRevealed([])}>Ẩn tất cả</button><button className="button primary" onClick={()=>setRevealed(Array.from({length:10},(_,i)=>i+1))}>Hiện tất cả kết quả</button><button className="button outline" onClick={onExit}>Đóng ứng dụng</button></div>
  </section>;
}
