import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AttemptInput, ContentPack, GameHostProps, LearningEvent, ModuleId, PlaySession } from './core/contracts';
import { BUILTIN_PACKS } from './core/seed';
import { getGame } from './core/registry';
import { assertModuleContract, makeLearningEvent } from './core/sdk';
import { storage } from './core/storage';
import { compatible, packKey, validatePack } from './core/validation';
import { newId } from './core/utils';
import StudentScreen from './screens/StudentScreen';
import ParentScreen from './screens/ParentScreen';
import CreatorScreen from './screens/CreatorScreen';

import { GAME_COMPONENTS } from './games/loaders';
const TimesTable = lazy(() => import('./miniapps/TimesTable'));

type Page = 'student' | 'parent' | 'creator';
type Active = {session: PlaySession,pack:ContentPack};
const menus:{id:Page,label:string,icon:string}[] = [
  {id:'student',label:'Thế giới game',icon:'🏠'},
  {id:'parent',label:'Góc phụ huynh',icon:'📊'},
  {id:'creator',label:'Xưởng học liệu',icon:'📚'}
];

export default function App() {
  const [page,setPage] = useState<Page>('student');
  const [soundOn,setSoundOn] = useState(() => {try{return localStorage.getItem('ba.sound')==='on';}catch{return false;}});
  const [motionOn,setMotionOn] = useState(() => {try{return localStorage.getItem('ba.motion')!=='off';}catch{return true;}});
  useEffect(()=>{document.documentElement.dataset.sound=soundOn?'on':'off';document.documentElement.dataset.motion=motionOn?'on':'off';try{localStorage.setItem('ba.sound',soundOn?'on':'off');localStorage.setItem('ba.motion',motionOn?'on':'off');}catch{/* storage unavailable */}},[soundOn,motionOn]);
  const [packs,setPacks] = useState<ContentPack[]>(BUILTIN_PACKS);
  const [events,setEvents] = useState<LearningEvent[]>([]);
  const [sessions,setSessions] = useState<PlaySession[]>([]);
  const [active,setActive] = useState<Active|null>(null);
  const [miniOpen,setMiniOpen] = useState(false);
  const [loading,setLoading] = useState(true);
  const [starting,setStarting] = useState(false);
  const [error,setError] = useState('');
  const completionFlag = useRef(false);
  const closing = useRef(false);
  const previousFocus = useRef<HTMLElement|null>(null);
  const gameDialog = useRef<HTMLDivElement|null>(null);

  // Keep the page behind the game fixed; never snap the page when feedback arrives.
  useEffect(() => {
    if (!active && !miniOpen) return;
    const oldOverflow = document.body.style.overflow;
    const oldGutter = document.documentElement.style.scrollbarGutter;
    document.body.style.overflow = 'hidden';
    // A reserved root scrollbar column must not clip the full-width game.
    if (active) document.documentElement.style.scrollbarGutter = 'auto';
    if (active) gameDialog.current?.focus({preventScroll:true});
    return () => {
      document.body.style.overflow = oldOverflow;
      document.documentElement.style.scrollbarGutter = oldGutter;
    };
  }, [active?.session.sessionId, miniOpen]);

  const refresh = useCallback(async () => {
    const [local,savedEvents,savedSessions] = await Promise.all([storage.listPacks(),storage.listEvents(),storage.listSessions()]);
    const combined = [...BUILTIN_PACKS,...local];
    const seen = new Set<string>();
    setPacks(combined.filter(pack=>{
      const key = packKey(pack);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }));
    setEvents(savedEvents);setSessions(savedSessions);
  },[]);

  useEffect(()=>{
    let mounted = true;
    (async()=>{
      try {
        const previous = await storage.listSessions();
        // Bản alpha không hỗ trợ resume: phiên dở từ lần mở trước được đánh dấu abandoned.
        await Promise.all(previous.filter(s=>s.status==='active').map(s=>storage.endSession(s.sessionId,'abandoned')));
        if(mounted) await refresh();
      } catch(e) {if(mounted) setError(e instanceof Error?e.message:'Không thể mở bộ nhớ thiết bị.');}
      finally {if(mounted) setLoading(false);}
    })();
    return ()=>{mounted=false;};
  },[refresh]);

  async function startGame(id: ModuleId,pack:ContentPack) {
    if(starting||active||miniOpen||closing.current) return;
    const problems = validatePack(pack);
    if(problems.length || !compatible(id,pack)) {setError(`Học liệu không hợp lệ: ${problems[0]??'Không tương thích module'}`);return;}
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setError('');setStarting(true);
    const manifest = getGame(id);
    try {assertModuleContract(manifest,pack);} catch(e){setError(e instanceof Error?e.message:'Game SDK không tương thích.');setStarting(false);return;}
    const session:PlaySession = {
      sessionId:newId(),packId:pack.id,contentVersion:pack.version,moduleId:id,moduleVersion:manifest.version,
      startedAt:new Date().toISOString(),status:'active'
    };
    try {await storage.createSession(session);completionFlag.current=false;setActive({session,pack});await refresh();}
    catch(e){setError(e instanceof Error?e.message:'Không thể mở trò chơi.');}
    finally {setStarting(false);}
  }

  async function recordAttempt(input: AttemptInput) {
    if(!active) throw new Error('Không có phiên chơi đang hoạt động.');
    const {session,pack} = active;
    if(completionFlag.current) throw new Error('Phiên đã hoàn tất.');
    const event=makeLearningEvent(session,pack,input,new Date().toISOString());
    await storage.addEvent(event);
    // A single answer must not reload every content pack and session or jolt the play screen.
    setEvents(prev => prev.some(row=>row.eventId===event.eventId)?prev:[...prev,event]);
  }

  async function completeSession() {
    if(!active || completionFlag.current) return;
    await storage.endSession(active.session.sessionId,'completed');
    completionFlag.current=true;await refresh();
  }

  async function leaveGame() {
    if(!active)return;
    const {session}=active;
    if (closing.current) return;
    closing.current = true;
    try {if(!completionFlag.current) await storage.endSession(session.sessionId,'abandoned'); await refresh();setActive(null);
      requestAnimationFrame(()=>previousFocus.current?.focus({preventScroll:true}));}
    catch(e){setError(e instanceof Error?e.message:'Không lưu được trạng thái thoát.');}
    finally {closing.current=false;}
  }

  async function importContentPacks(incoming:ContentPack[]):Promise<number> {
    const existing = new Set(packs.map(packKey));
    const fresh = incoming.filter(pack=>!existing.has(packKey(pack)));
    fresh.forEach(pack=>{
      const problems=validatePack(pack);
      if(problems.length) throw new Error(problems[0]);
    });
    await storage.savePacks(fresh);
    if(fresh.length) await refresh();
    return fresh.length;
  }

  async function publish(pack:ContentPack) {
    const problems=validatePack(pack);
    if(problems.length) throw new Error(problems[0]);
    if(packs.some(p=>packKey(p)===packKey(pack))) throw new Error('Phiên bản đã tồn tại, không thể ghi đè.');
    await storage.savePack(pack);await refresh();
  }

  const activeTitle=useMemo(()=>active?.pack.title??'',[active]);
  const GameComponent = active ? GAME_COMPONENTS[active.session.moduleId] : null;
  const gameProps:GameHostProps | null=active?{
    pack:active.pack,onAttempt:recordAttempt,onComplete:completeSession,onExit:()=>{void leaveGame();}
  }:null;

  return <div className={`app-shell ${page === 'student' ? 'ba-frame-shell' : ''}`}>
    <header className="site-header"><div className="header-content"><a href="#home" className="brand" onClick={e=>{e.preventDefault();if(!active && !miniOpen)setPage('student');}} aria-label="Bảo An Learning, trang chủ"><div className="brand-mark"><span>✦</span></div><div className="brand-words"><strong>BẢO AN</strong><small>LEARNING <span>V3.7 RC1</span></small></div></a>
    <nav className="top-navigation" aria-label="Không gian ứng dụng">{menus.map(m=><button key={m.id} className={`nav-item ${page===m.id?'active':''}`} aria-current={page===m.id?'page':undefined} onClick={()=>setPage(m.id)} disabled={!!active||miniOpen}><span aria-hidden="true">{m.icon}</span> {m.label}</button>)}</nav>
    <div className="experience-controls" aria-label="Cài đặt trải nghiệm"><button type="button" className="control-pill" onClick={()=>setSoundOn(v=>!v)} aria-pressed={soundOn} title={soundOn?"Tắt âm thanh":"Bật âm thanh"}>{soundOn?"🔊":"🔇"}<span className="control-label">Âm thanh</span></button><button type="button" className="control-pill" onClick={()=>setMotionOn(v=>!v)} aria-pressed={motionOn} title={motionOn?"Giảm chuyển động":"Bật chuyển động"}>{motionOn?"✨":"◻"}<span className="control-label">Hiệu ứng</span></button></div></div></header>
    <main className={`site-main ${page === 'student' ? 'site-main-gameworld' : ''}`}>
      {error && <div className="notice error global-error" role="alert"><strong>Thông báo:</strong> {error}<button onClick={()=>setError('')} aria-label="Đóng thông báo">×</button></div>}
      {loading ? <div className="loading-state">Đang mở không gian học tập…</div> : <>
        {page==='student'&&<StudentScreen packs={packs} sessions={sessions} onPlay={startGame} onOpenMini={()=>setMiniOpen(true)} starting={starting||!!active||miniOpen||!!error} worldActive={!active&&!miniOpen&&page==='student'} motionOn={motionOn}/>}
        {page==='parent'&&<ParentScreen events={events} sessions={sessions}/>}
        {page==='creator'&&<CreatorScreen packs={packs} onPublish={publish} onImport={importContentPacks}/>}
      </>}
    </main>
    <footer className="site-footer"><div><strong>✦ Bảo An Learning V3.7 RC1</strong><span>Học vui · Hiểu sâu · Tiến bộ mỗi ngày</span></div><span>V3.7 RC1 • Lát cắt 3D thử nghiệm · Chưa có đăng nhập và đồng bộ cloud</span></footer>
    {miniOpen && <div className="overlay" role="presentation"><div className="game-dialog" role="dialog" aria-modal="true" aria-label="Bảng cửu chương tương tác">
      <div className="game-dialog-head"><div><span className="eyebrow">MINI APP CENTER</span><h2>Ứng dụng Toán học</h2></div><button className="button outline" onClick={()=>setMiniOpen(false)}>← Thoát ứng dụng</button></div>
      <Suspense fallback={<div className="loading-state">Đang tải ứng dụng nhỏ…</div>}><TimesTable onExit={()=>setMiniOpen(false)}/></Suspense>
    </div></div>}
    {active && gameProps && GameComponent && <div className="overlay immersive-overlay" role="presentation"><div className={`game-dialog adventure-dialog immersive-dialog dialog-${active.session.moduleId}`} ref={gameDialog} tabIndex={-1} role="dialog" aria-modal="true" aria-label={`Đang chơi ${activeTitle}`}>
      <div className="game-dialog-head"><div><span className="eyebrow">✦ GAME WORLD / {active.session.moduleId.toUpperCase()}</span><h2>{activeTitle}</h2></div><button className="button outline" onClick={()=>void leaveGame()}>← Thoát trò chơi</button></div>
      <Suspense fallback={<div className="loading-state">Đang tải trò chơi…</div>}>
        <GameComponent key={active.session.sessionId} {...gameProps}/>
      </Suspense>
    </div></div>}
  </div>;
}
