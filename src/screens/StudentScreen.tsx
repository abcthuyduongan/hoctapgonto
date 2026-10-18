import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import type { ModuleId } from '../core/contracts';
import type {OnlinePackSummary} from '../core/online-contracts';
import { GAME_REGISTRY } from '../core/registry';
import type { SceneInfo } from '../world3d/WorldCanvas';
import AsyncBoundary from '../components/AsyncBoundary';
import type { WorldId } from '../world3d/engine';
import { getSceneForModule } from '../world3d/scenes/sceneCatalog';
import type { GuideMood, QualityChoice } from '../world3d/renderer/types';
import { playClickSound, playIslandSelectSound } from '../core/sound';
import '../styles/student-assigned-games.css';

const WorldCanvas=lazy(()=>import('../world3d/WorldCanvas'));
const displayKey='bao-an-display-mode-v1';
type DisplayMode='light'|'3d';
function initialDisplayMode():DisplayMode {
  try{return localStorage.getItem(displayKey)==='3d'?'3d':'light';}catch{return 'light';}
}

interface Props {
  availableStars: number;
  /** An online host supplies author-labelled content without a fixed subject curriculum. */
  practiceContext:{title:string;detail:string;pack:OnlinePackSummary|null;games:{id:ModuleId;label:string}[];complete:boolean};
  onPlay: (id:ModuleId,pack:OnlinePackSummary)=>Promise<void>;
  starting: boolean;
  onOpenWallet: () => void;
  worldActive: boolean;
  motionOn: boolean;
  gameWorld: WorldId | null;
  guideMood: GuideMood;
  guideCue: number;
  onSceneChange?: (info: SceneInfo) => void;
}
const themes:Record<string,{world:string,symbol:string,short:string,intro:string}>= {
  'math-quest': {world:'Đảo Toán Học',symbol:'∑',short:'Chọn đáp án',intro:'Vượt từng câu hỏi bằng cách chọn đáp án đúng.'},
  'memory-match': {world:'Khu Rừng Trí Nhớ',symbol:'◇',short:'Trí nhớ',intro:'Lật thẻ, nhớ vị trí và tìm hai nội dung đi cùng nhau.'},
  'sentence-builder': {world:'Xưởng Ghép Câu',symbol:'Aa',short:'Ghép câu',intro:'Xếp những từ bị đảo vị trí thành câu hoàn chỉnh.'},
  'word-connect': {world:'Đảo Nối Từ',symbol:'🔗',short:'Nối từ',intro:'Quan sát hai cột rồi nối câu hỏi với câu trả lời phù hợp.'},
  'sequence-trail': {world:'Bậc Thang Quy Luật',symbol:'▥',short:'Xếp thứ tự',intro:'Đặt các thẻ theo đúng thứ tự của câu hoặc dãy số.'}
};
export default function StudentScreen({availableStars,practiceContext,onPlay,starting,onOpenWallet,worldActive,motionOn,gameWorld,guideMood,guideCue,onSceneChange}:Props){
  const [focused,setFocused]=useState<WorldId|null>(null);
  const [displayMode,setDisplayMode]=useState<DisplayMode>(initialDisplayMode);
  const [simpleControls,setSimpleControls]=useState(()=>new URLSearchParams(window.location.search).get('controls')==='1');
  const [sceneState,setSceneState]=useState<SceneInfo['state']>('loading');
  const overview = useRef<HTMLDivElement>(null);
  useEffect(() => { if (gameWorld) setFocused(gameWorld); }, [gameWorld]);
  const [quality,setQuality]=useState<QualityChoice>('low');
  const assignedMode=true;
  const currentPack=practiceContext.pack;
  const worldName=(worldId:string)=>worldId==='math-quest'?'Đảo Câu Hỏi':themes[worldId].world;
  const playable=practiceContext.games;
  const assignedFallback=sceneState!=='ready';
  const selectIsland = (id: WorldId | null) => {
    if (id && id !== focused) playIslandSelectSound();
    setFocused(id);
  };
  function changeDisplayMode(mode:DisplayMode){
    setDisplayMode(mode);setSceneState('loading');
    try{localStorage.setItem(displayKey,mode);}catch{/* Display preferences are optional. */}
  }
  const sceneChanged=useCallback((info:SceneInfo)=>{
    setSceneState(info.state);onSceneChange?.(info);
    if(info.state==='fallback'||info.state==='unavailable'){
      setDisplayMode('light');
      try{localStorage.setItem(displayKey,'light');}catch{/* A failed scene must still fall back. */}
    }
  },[onSceneChange]);
  function packFor(gameId:ModuleId){return currentPack&&playable.some(game=>game.id===gameId)?currentPack:undefined;}
  const enterWorld=(id:WorldId)=>{const game=GAME_REGISTRY.find(row=>getSceneForModule(row.id)===id);if(!game||starting)return;const pack=packFor(game.id);if(pack)void onPlay(game.id,pack);};
  if(displayMode==='light')return <section id="home" className="game-hub student-light-hub" data-hub-mode="light" aria-label="Chọn trò chơi phù hợp">
    <div className="student-light-heading"><img className="student-light-guide" src="/art/fox-guide-common.webp" alt="Cáo nhỏ đồng hành" width="88" height="112" decoding="async"/><div><p className="online-eyebrow">HÀNH TRÌNH CỦA CON</p><h1>{practiceContext.title}</h1><p>{practiceContext.detail}</p></div><button type="button" className="game-wallet-button" aria-label="Ví đổi sao" onClick={onOpenWallet} disabled={starting}>⭐ {availableStars} sao · Đổi thưởng →</button></div>
    <section className="assigned-game-fallback student-light-games" aria-label="Trò chơi phù hợp bộ được giao"><strong>{currentPack?'Chọn trò để vào bộ được giao':practiceContext.complete?'Con đã hoàn thành học liệu được giao':'Đang chờ học liệu từ lớp'}</strong>{currentPack&&<p>{currentPack.title} · {currentPack.itemCount} câu</p>}<div>{playable.map(game=><button key={game.id} type="button" disabled={starting} aria-label={`Chơi ${game.label} bằng bộ được giao`} onClick={()=>currentPack&&void onPlay(game.id,currentPack)}><span aria-hidden="true">{themes[game.id].symbol}</span><span><strong>{game.label}</strong><small>{themes[game.id].intro}</small></span><span aria-hidden="true">→</span></button>)}</div>{!currentPack&&<p>{practiceContext.detail}</p>}</section>
    <div className="student-display-choice"><span>Chế độ nhẹ</span><button type="button" disabled={starting} onClick={()=>changeDisplayMode('3d')}>Khám phá 3D</button></div>
  </section>;
  return <div data-hub-mode="3d" className={`ba3d-home premium-world game-hub ${simpleControls?'':'immersive-world'} ${focused ? 'has-focused-island' : 'overview-mode'}`} id="home">
    <div className="student-display-choice student-display-choice-3d"><span>Khám phá 3D</span><button type="button" disabled={starting} onClick={()=>changeDisplayMode('light')}>Chế độ nhẹ</button></div>
    <section className="ba3d-world" aria-label="Bảo An Learning: thế giới game 3D tương tác">
      <div className="game-hub-top">
        <div className="game-journey-brief"><strong>{practiceContext.title}</strong><span>{practiceContext.detail}</span></div>
        <button type="button" className="game-wallet-button" aria-label="Ví đổi sao" onClick={onOpenWallet} disabled={starting}><span aria-hidden="true">⭐</span><strong>{availableStars} sao</strong><span>Đổi thưởng →</span></button>
      </div>
      {simpleControls&&<nav className="ba3d-island-picker" aria-label="Chọn đảo học tập">
        {GAME_REGISTRY.map(game => {
          const theme = themes[game.id];
          const sceneId = getSceneForModule(game.id);
          return <button type="button" key={game.id} className="ba3d-island-choice"
            aria-label={`Chọn ${worldName(game.id)}`} aria-pressed={focused === sceneId} disabled={starting}
            onClick={() => selectIsland(sceneId)}>
            <span aria-hidden="true">{theme.symbol}</span><span>{theme.short}</span>
          </button>;
        })}
      </nav>}
      <div className="game-hub-stage">
        {!gameWorld&&worldActive&&<AsyncBoundary label="cảnh 3D" onExit={()=>changeDisplayMode('light')}><Suspense fallback={<p className="online-loading" role="status">Đang mở cảnh 3D… Con vẫn có thể chọn trò bên dưới.</p>}><WorldCanvas selected={focused} onSelect={selectIsland} active={worldActive} motionOn={motionOn}
          quality={quality} gameWorld={gameWorld} guideMood={guideMood} guideCue={guideCue} onSceneChange={sceneChanged}
          onEnterWorld={enterWorld} onOverview={()=>selectIsland(null)}/></Suspense></AsyncBoundary>}
        <div ref={overview} tabIndex={-1} role="group" aria-label="Tổng quan các đảo" className="ba3d-island-overview">
          <span className="ba3d-sr-only" role="status">{focused?`Đã chọn ${worldName(focused)}`:'Chọn một trò ở phía trên hoặc chạm vào một đảo.'}</span>
          {focused&&<button type="button" className="ba3d-overview-reset" aria-label="Xem tất cả các đảo" onClick={()=>{playClickSound();setFocused(null);overview.current?.focus();}}><span aria-hidden="true">↻</span> Tổng quan</button>}
        </div>
        {!simpleControls&&<div className="game-character-hint" role="status" aria-live="polite">
          {focused&&<><strong>{worldName(focused)}</strong><span>{practiceContext&&focused==='math-quest'?'Đọc đề, xem hình hoặc nghe âm thanh rồi hoàn thành câu hỏi.':themes[focused].intro}</span></>}
          <span>{assignedMode&&!currentPack?(practiceContext.complete?'Con đã hoàn thành học liệu được giao. Con xem lại hành trình hoặc chờ lớp giao bộ tiếp theo nhé.':'Chưa có bộ ôn được giao. Nhờ người lớn kiểm tra dữ liệu lớp nhé.'):
            focused&&assignedMode&&!packFor(GAME_REGISTRY.find(game=>getSceneForModule(game.id)===focused)!.id)?`Bộ này chơi được ở: ${playable.map(game=>themes[game.id].short).join(', ')}. Hãy chọn đảo phù hợp nhé.`:
            focused?'Khi Cáo tới đảo, bấm lại đảo hoặc nhấn Enter để vào chơi.':'Bấm vào một đảo để Cáo dẫn đường.'}</span>
        </div>}
        {assignedFallback&&<section className="assigned-game-fallback" aria-label="Trò chơi phù hợp bộ được giao"><strong>{currentPack?'Chọn trò để vào bộ được giao':practiceContext?.complete?'Con đã hoàn thành học liệu được giao':'Đang chờ học liệu từ lớp'}</strong>{currentPack&&<p>{currentPack.title}</p>}{sceneState==='loading'&&<p>Cảnh đang tải. Con có thể vào bài ngay bằng các nút dưới đây.</p>}<div>{playable.map(game=><button key={game.id} type="button" disabled={starting} aria-label={`Chơi ${game.label} bằng bộ được giao`} onClick={()=>currentPack&&void onPlay(game.id,currentPack)}>{themes[game.id].symbol} {game.label} →</button>)}</div>{!currentPack&&<p>{practiceContext?.detail}</p>}</section>}
      </div>
      {simpleControls&&<div className="game-hub-bottom">
        {focused ? <div className="ba3d-anchors" aria-label="Chọn trò chơi 3D">
          {GAME_REGISTRY.map(game=>{
            if (focused !== getSceneForModule(game.id)) return null;
            const options=packFor(game.id)?[packFor(game.id)!]:[];
            const pack=packFor(game.id);
            return <article className={`ba3d-island-control ba3d-${game.id} ba3d-selected`} key={game.id} aria-label={`Học liệu ${worldName(game.id)}`}>
              <label htmlFor={`ba3d-pack-${game.id}`}>Bộ câu hỏi</label>
              <select id={`ba3d-pack-${game.id}`} aria-label={`Chọn bộ học liệu cho ${game.label}`} value={pack?`${pack.id}@${pack.version}`:''} disabled={!pack||starting}
                >
                {!pack&&<option value="">{assignedMode?'Bộ ôn chưa phù hợp đảo này':'Chưa có học liệu'}</option>}
                {options.map(p=><option key={`${p.id}@${p.version}`} value={`${p.id}@${p.version}`}>{p.title} · {p.itemCount} câu</option>)}
              </select>
              <button type="button" className="ba3d-play" disabled={!pack||starting} onClick={()=>pack&&void onPlay(game.id,pack)}>{starting?'Đang mở…':'Bắt đầu'} <span aria-hidden="true">▶</span></button>
            </article>;
          })}
        </div> : <p className="game-hub-prompt">Chọn một trò để bắt đầu nhé!</p>}
        <div className="game-hub-tools">
          <label>Hình ảnh <select aria-label="Chất lượng cảnh 3D" value={quality} onChange={event=>setQuality(event.target.value as QualityChoice)}><option value="auto">Tự động</option><option value="low">Nhẹ</option><option value="balanced">Cân bằng</option><option value="high">Cao</option></select></label>
        </div>
        <button type="button" className="game-return-character" onClick={()=>setSimpleControls(false)}>← Điều khiển bằng Cáo</button>
      </div>}
      {!simpleControls&&<div className="game-character-tools">
        <details className="game-world-help"><summary>ⓘ Cách chơi</summary><p>Bấm vào đảo muốn khám phá. Khi Cáo đã tới, bấm lại đảo hoặc bấm Cáo để vào trò.</p><p>Bàn phím: bấm vào cảnh, dùng ← → để chọn đảo, Enter để chơi, Esc để về tổng quan. Bộ câu hỏi do giáo viên giao cho lớp.</p><button type="button" onClick={()=>setSimpleControls(true)}>Chọn trò bằng nút</button><label>Hình ảnh <select aria-label="Chất lượng cảnh 3D" value={quality} onChange={event=>setQuality(event.target.value as QualityChoice)}><option value="auto">Tự động</option><option value="low">Nhẹ</option><option value="balanced">Cân bằng</option><option value="high">Cao</option></select></label></details>
        {(sceneState==='fallback'||sceneState==='unavailable')&&<button className="game-fallback-button" onClick={()=>setSimpleControls(true)}>Mở trò chơi bằng nút</button>}
      </div>}
    </section>
  </div>;
}
