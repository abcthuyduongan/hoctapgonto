import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { WorldId } from './engine';
import type { GuideMood, GuideViewport, QualityChoice, RenderStats, WorldRenderer } from './renderer/types';
import { createWorldRenderer } from './renderer/rendererFactory';

export type SceneInfo = { state: 'loading' | 'ready' | 'fallback' | 'unavailable'; engine: RenderStats['engine'] | null };
interface Props {
  selected: WorldId | null;
  onSelect: (id: WorldId) => void;
  active: boolean;
  motionOn: boolean;
  quality?: QualityChoice;
  gameWorld?: WorldId | null;
  guideMood?: GuideMood;
  guideCue?: number;
  onSceneChange?: (info: SceneInfo) => void;
}

export default function WorldCanvas({ selected, onSelect, active, motionOn, quality = 'auto',
  gameWorld = null, guideMood = 'idle', guideCue = 0, onSceneChange }: Props) {
  const homeMount = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  // Keep one portal root, canvas, context and loaded asset set across modes.
  const [portalRoot] = useState(() => {
    const container = document.createElement('div');
    container.className = 'ba3d-render-portal'; container.style.display = 'contents';
    return container;
  });
  const runtime = useRef<WorldRenderer | null>(null);
  const current = useRef({ selected, onSelect, active, motionOn, quality, gameWorld, guideMood, guideCue, onSceneChange });
  current.current = { selected, onSelect, active, motionOn, quality, gameWorld, guideMood, guideCue, onSceneChange };
  const [state, setState] = useState<SceneInfo['state']>('loading');
  const [recovery, setRecovery] = useState(0);
  const updateDiagnostics = useCallback(() => {
    const stats = runtime.current?.getDiagnostics();
    if (stats && host.current) {
      host.current.dataset.engine = stats.engine;
      host.current.dataset.diagnostics = JSON.stringify(stats);
    }
  }, []);

  useLayoutEffect(() => {
    const destination = gameWorld ? document.getElementById('ba37-game-scene-slot') : homeMount.current;
    destination?.appendChild(portalRoot);
    runtime.current?.setGameScene?.(gameWorld);
    if (gameWorld) runtime.current?.setGuideMood?.(guideMood, guideCue);
    else runtime.current?.focusOn(selected);
    updateDiagnostics();
  }, [gameWorld, portalRoot, updateDiagnostics]);
  useEffect(() => () => { portalRoot.remove(); }, [portalRoot]);

  useEffect(() => {
    const container = host.current;
    if (!container) return;
    let cancelled = false;
    let recovering = false;
    const abort = new AbortController();
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const replaceCanvas = () => {
      const canvas = document.createElement('canvas');
      canvas.className = 'ba3d-canvas';
      canvas.setAttribute('role', 'img');
      canvas.setAttribute('aria-label', 'Thế giới học tập 3D: Toán học, Trí nhớ và Ngôn từ');
      container.replaceChildren(canvas);
      return canvas;
    };
    const sync = () => {
      const settings = current.current;
      runtime.current?.setMotion(settings.motionOn && !media.matches);
      runtime.current?.setGameScene?.(settings.gameWorld);
      if (settings.gameWorld) runtime.current?.setGuideMood?.(settings.guideMood, settings.guideCue);
      else runtime.current?.focusOn(settings.selected);
      // A legacy fallback has no in-game scene: pause that hidden canvas.
      const gameSupported = !settings.gameWorld || !!runtime.current?.setGameScene;
      runtime.current?.setPaused(!settings.active || document.hidden || !gameSupported);
    };
    const canvas = replaceCanvas();
    setState('loading');
    void createWorldRenderer({ canvas, premium3DEnabled: recovery === 0,
      replaceCanvas, onSelect: id => current.current.onSelect(id),
      motionOn: current.current.motionOn && !media.matches,
      paused: !current.current.active || document.hidden, quality: current.current.quality,
      signal: abort.signal, onContextLost: () => {
        if (!cancelled && !recovering) { recovering = true; setRecovery(value => value + 1); }
      },
    }).then(renderer => {
      if (cancelled) { renderer.dispose(); return; }
      runtime.current = renderer;
      renderer.setQualityChoice?.(current.current.quality);
      sync(); updateDiagnostics();
      setState(renderer.getDiagnostics().engine === 'three-webgl' ? 'ready' : 'fallback');
    }).catch(error => {
      if (!cancelled) { console.warn('Bảo An: cảnh 3D không khả dụng', error); setState('unavailable'); }
    });
    document.addEventListener('visibilitychange', sync);
    media.addEventListener('change', sync);
    const diagnosticsTimer = window.setInterval(updateDiagnostics, 1000);
    return () => {
      cancelled = true; abort.abort();
      runtime.current?.dispose(); runtime.current = null;
      document.removeEventListener('visibilitychange', sync);
      media.removeEventListener('change', sync);
      window.clearInterval(diagnosticsTimer);
      container.replaceChildren();
    };
  }, [recovery, updateDiagnostics]);

  useEffect(() => {
    onSceneChange?.({ state, engine: runtime.current?.getDiagnostics().engine ?? null });
  }, [state, onSceneChange]);
  useEffect(() => { if (!gameWorld) runtime.current?.focusOn(selected); }, [selected, gameWorld]);
  useEffect(() => {
    runtime.current?.setPaused(!active || document.hidden || (!!gameWorld && !runtime.current?.setGameScene));
  }, [active, gameWorld, state]);
  useEffect(() => {
    runtime.current?.setMotion(motionOn && !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, [motionOn]);
  useEffect(() => { runtime.current?.setQualityChoice?.(quality); }, [quality]);
  useEffect(() => {
    if (gameWorld) runtime.current?.setGuideMood?.(guideMood, guideCue);
    updateDiagnostics();
  }, [guideMood, guideCue, gameWorld, state, updateDiagnostics]);

  useEffect(() => {
    if (!gameWorld || state !== 'ready') return;
    const sceneSlot = document.getElementById('ba37-game-scene-slot');
    const dialog = sceneSlot?.closest('.premium-game');
    if (!dialog) return;
    let guide: Element | null = null;
    let last = '';
    const update = () => {
      const next = dialog.querySelector('.ba37-mascot-window');
      if (guide !== next) {
        if (guide) observer.unobserve(guide);
        guide = next; if (guide) observer.observe(guide);
      }
      const canvas = host.current?.querySelector('canvas');
      const visibleBox = guide?.getBoundingClientRect();
      const canvasBox = canvas?.getBoundingClientRect();
      const box: GuideViewport | null = visibleBox && canvasBox && visibleBox.width > 0 && visibleBox.height > 0
        ? { x: visibleBox.x - canvasBox.x, y: visibleBox.y - canvasBox.y, width: visibleBox.width, height: visibleBox.height } : null;
      const key = JSON.stringify(box);
      if (key !== last) { last = key; runtime.current?.setGuideViewport?.(box); }
    };
    const observer = new ResizeObserver(update);
    observer.observe(dialog);
    const mutation = new MutationObserver(update);
    mutation.observe(dialog, { childList: true, subtree: true });
    dialog.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    update();
    return () => {
      observer.disconnect(); mutation.disconnect();
      dialog.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [gameWorld, state]);

  return <><div ref={homeMount} className="ba3d-world-mount" style={{ display: 'contents' }}/>
    {createPortal(<>
      <div ref={host} className="ba3d-render-host" data-state={state} data-premium="true" />
      {!gameWorld && state === 'loading' && <div className="ba3d-render-status" role="status">Đang mở thế giới 3D… Con có thể bắt đầu chơi ngay.</div>}
      {!gameWorld && (state === 'fallback' || state === 'unavailable') && <div className="ba3d-render-status" role="status">
        {state === 'fallback' ? 'Đang dùng cảnh dự phòng.' : 'Cảnh 3D không khả dụng.'} Chọn trò chơi bằng các nút Bắt đầu.
      </div>}
    </>, portalRoot)}
  </>;
}
