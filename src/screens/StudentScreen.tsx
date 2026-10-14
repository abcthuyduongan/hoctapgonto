import { useEffect, useRef, useState } from 'react';
import type { ContentPack, ModuleId, PlaySession } from '../core/contracts';
import { GAME_REGISTRY } from '../core/registry';
import { titleSubject } from '../core/utils';
import { compatible } from '../core/validation';
import WorldCanvas, { type SceneInfo } from '../world3d/WorldCanvas';
import type { WorldId } from '../world3d/engine';
import type { GuideMood, QualityChoice } from '../world3d/renderer/types';

interface Props {
  packs: ContentPack[];
  sessions: PlaySession[];
  onPlay: (id:ModuleId,pack:ContentPack)=>Promise<void>;
  starting: boolean;
  onOpenMini: () => void;
  worldActive: boolean;
  motionOn: boolean;
  gameWorld: WorldId | null;
  guideMood: GuideMood;
  guideCue: number;
  onSceneChange: (info: SceneInfo) => void;
}
const themes:Record<string,{world:string,symbol:string,num:string,description:string}>= {
  'math-quest': {world:'Đảo Toán Học',symbol:'∑',num:'01',description:'Từng phép tính, một khám phá mới'},
  'memory-match': {world:'Khu Rừng Trí Nhớ',symbol:'◇',num:'02',description:'Quan sát tinh mắt, ghi nhớ thật lâu'},
  'sentence-builder': {world:'Xưởng Ngôn Từ',symbol:'Aa',num:'03',description:'Ghép những từ nhỏ thành câu hay'}
};
export default function StudentScreen({packs,sessions,onPlay,starting,onOpenMini,worldActive,motionOn,gameWorld,guideMood,guideCue,onSceneChange}:Props){
  const [chosen,setChosen]=useState<Record<string,string>>({});
  const [focused,setFocused]=useState<WorldId|null>(null);
  const overview = useRef<HTMLDivElement>(null);
  useEffect(() => { if (gameWorld) setFocused(gameWorld); }, [gameWorld]);
  const [quality,setQuality]=useState<QualityChoice>('auto');
  const completed=sessions.filter(s=>s.status==='completed').length;
  const stars=Math.min(completed*3,999);
  return <div className="ba3d-home premium-world" id="home">
    <section className="ba3d-world" aria-label="Bảo An Learning: thế giới game 3D tương tác">
      <div className="ba3d-sky" aria-hidden="true" />
      <WorldCanvas selected={focused} onSelect={setFocused} active={worldActive} motionOn={motionOn}
        quality={quality} gameWorld={gameWorld} guideMood={guideMood} guideCue={guideCue} onSceneChange={onSceneChange}/>
      <div className="ba3d-render-controls" aria-label="Cài đặt cảnh 3D">
        <label>Chất lượng <select aria-label="Chất lượng cảnh 3D" value={quality} onChange={event=>setQuality(event.target.value as QualityChoice)}>
          <option value="auto">Tự động</option><option value="low">Nhẹ</option><option value="balanced">Cân bằng</option><option value="high">Cao</option>
        </select></label>
      </div>
      <div className="ba3d-softlight" aria-hidden="true" />
      <div className="ba3d-greeter" aria-label="Lời chào của nhân vật đồng hành"><span className="ba3d-hello">Chào nhà thám hiểm!</span><span>Chọn một đảo để cùng khám phá ✨</span></div>
      <div className="ba3d-hero-title">
        <span className="ba3d-edition">MỖI NGÀY MỘT KHÁM PHÁ</span>
        <h1><span className="ba3d-title-lead">Khám phá </span><span>Thế giới học tập</span></h1>
        <p>Ba miền tri thức. Một hành trình lớn lên cùng con.</p>
      </div>
      <aside className="ba3d-achievement" aria-label="Tiến độ học tập">
        <div className="ba3d-wood-head">⭐ Hành trình của con</div>
        <div className="ba3d-progress-track"><div style={{width:`${Math.min(100,stars/9*100)}%`}}/></div>
        <strong>{stars} ngôi sao</strong><small>{completed} lượt chơi hoàn thành</small>
      </aside>
      <div ref={overview} tabIndex={-1} role="group" aria-label="Tổng quan các đảo" className={`ba3d-island-overview${focused?' has-selection':''}`}>
        <span className="ba3d-island-status" role="status">{focused?`Đã chọn ${themes[focused].world}`:'Chọn một đảo để cùng khám phá'}</span>
        {focused&&<button type="button" className="ba3d-overview-reset" onClick={()=>{setFocused(null);overview.current?.focus();}}>Xem tất cả các đảo <span aria-hidden="true">↻</span></button>}
      </div>
      <div className="ba3d-anchors" aria-label="Chọn trò chơi 3D">
        {GAME_REGISTRY.map(game=>{
          const options=packs.filter(p=>compatible(game.id,p));
          const pack=options.find(p=>`${p.id}@${p.version}`===chosen[game.id])??options[0];
          const theme=themes[game.id];
          return <article className={`ba3d-island-control ba3d-${game.id} ${focused===game.id?'ba3d-selected':''}`} key={game.id}>
            <button type="button" className="ba3d-world-name" onClick={()=>setFocused(game.id as WorldId)} onFocus={()=>setFocused(game.id as WorldId)} aria-pressed={focused===game.id} aria-label={`Xem đảo ${theme.world}`}>
              <span className="ba3d-world-number"><span className="ba3d-world-symbol" aria-hidden="true">{theme.symbol}</span><span className="ba3d-world-index">{theme.num}</span></span><strong>{game.label}</strong><small>{theme.world}</small>
            </button>
            <p className="ba3d-world-description">{theme.description}</p>
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
      <p className="ba3d-footnote">Chọn một đảo · Chọn bộ học liệu và bắt đầu chơi</p>
    </section>
  </div>
}
