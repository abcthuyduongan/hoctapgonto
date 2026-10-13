import { useState } from 'react';
import type { ContentPack, ModuleId, PlaySession } from '../core/contracts';
import { GAME_REGISTRY } from '../core/registry';
import { titleSubject } from '../core/utils';
import { compatible } from '../core/validation';
import WorldCanvas from '../world3d/WorldCanvas';
import type { WorldId } from '../world3d/engine';

interface Props {
  packs: ContentPack[];
  sessions: PlaySession[];
  onPlay: (id:ModuleId,pack:ContentPack)=>Promise<void>;
  starting: boolean;
  onOpenMini: () => void;
  worldActive: boolean;
  motionOn: boolean;
}
const themes:Record<string,{world:string,icon:string,num:string,description:string}>= {
  'math-quest': {world:'Đảo Toán Học',icon:'✦',num:'01',description:'Vượt thử thách toán học'},
  'memory-match': {world:'Khu Rừng Trí Nhớ',icon:'❀',num:'02',description:'Tìm cặp thẻ bí mật'},
  'sentence-builder': {world:'Xưởng Ngôn Từ',icon:'✿',num:'03',description:'Ghép câu thông minh'}
};
export default function StudentScreen({packs,sessions,onPlay,starting,onOpenMini,worldActive,motionOn}:Props){
  const [chosen,setChosen]=useState<Record<string,string>>({});
  const [focused,setFocused]=useState<WorldId|null>(null);
  const completed=sessions.filter(s=>s.status==='completed').length;
  const stars=Math.min(completed*3,999);
  return <div className="ba3d-home" id="home">
    <section className="ba3d-world" aria-label="Bảo An Learning: thế giới game 3D tương tác">
      <div className="ba3d-sky" aria-hidden="true" />
      <WorldCanvas selected={focused} onSelect={setFocused} active={worldActive} motionOn={motionOn}/>
      <div className="ba3d-softlight" aria-hidden="true" />
      <div className="ba3d-greeter" aria-label="Lời chào của nhân vật đồng hành"><span className="ba3d-hello">Chào nhà thám hiểm!</span><span>Ba thế giới đang đợi con khám phá ✨</span></div>
      <div className="ba3d-hero-title">
        <span className="ba3d-edition">✦ REAL 3D GAME WORLD · V3.6.2 · RC2 ✦</span>
        <h1>Khám phá <span>Thế giới học tập</span></h1>
        <p>Học qua trò chơi · Khám phá tri thức · Lớn lên mỗi ngày</p>
      </div>
      <aside className="ba3d-achievement" aria-label="Tiến độ học tập">
        <div className="ba3d-wood-head">⭐ Hành trình của con</div>
        <div className="ba3d-progress-track"><div style={{width:`${Math.min(100,stars/9*100)}%`}}/></div>
        <strong>{stars} ngôi sao</strong><small>{completed} lượt chơi hoàn thành</small>
      </aside>
      <div className="ba3d-anchors" aria-label="Chọn trò chơi 3D">
        {GAME_REGISTRY.map(game=>{
          const options=packs.filter(p=>compatible(game.id,p));
          const pack=options.find(p=>`${p.id}@${p.version}`===chosen[game.id])??options[0];
          const theme=themes[game.id];
          return <article className={`ba3d-island-control ba3d-${game.id} ${focused===game.id?'ba3d-selected':''}`} key={game.id}
            onMouseEnter={()=>{if(motionOn)setFocused(game.id as WorldId)}} onMouseLeave={()=>setFocused(null)}>
            <button type="button" className="ba3d-world-name" onClick={()=>setFocused(game.id as WorldId)} aria-label={`Xem đảo ${theme.world}`}>
              <span className="ba3d-world-number">{theme.icon} {theme.num}</span><strong>{game.label}</strong><small>{theme.world}</small>
            </button>
            <label className="ba3d-sr-only" htmlFor={`ba3d-pack-${game.id}`}>Chọn bộ học liệu cho {game.label}</label>
            <select id={`ba3d-pack-${game.id}`} value={pack?`${pack.id}@${pack.version}`:''} disabled={!pack||starting}
              onChange={e=>setChosen(prev=>({...prev,[game.id]:e.target.value}))}>
              {!pack&&<option value="">Chưa có học liệu</option>}
              {options.map(p=><option key={`${p.id}@${p.version}`} value={`${p.id}@${p.version}`}>{p.title} · {titleSubject(p.subject)}</option>)}
            </select>
            <button type="button" className="ba3d-play" disabled={!pack||starting} onClick={()=>pack&&void onPlay(game.id,pack)}>Bắt đầu <span aria-hidden="true">▶</span></button>
          </article>;
        })}
      </div>
      <div className="ba3d-shortcuts"><button type="button" onClick={onOpenMini} disabled={starting}>🧩 Bảng cửu chương</button><span>⭐ {stars} sao đã nhận</span><span>🎮 {completed} lượt hoàn thành</span></div>
      <p className="ba3d-footnote">Chạm vào đảo để xoay góc nhìn · Chọn bộ học liệu và bắt đầu chơi</p>
    </section>
  </div>
}
