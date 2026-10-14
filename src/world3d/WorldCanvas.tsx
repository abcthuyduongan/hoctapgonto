import { useEffect, useRef, useState } from 'react';
import type { WorldId } from './engine';
import type { QualityChoice, WorldRenderer } from './renderer/types';
import { createWorldRenderer } from './renderer/rendererFactory';

interface Props {
  selected: WorldId | null;
  onSelect: (id: WorldId) => void;
  active: boolean;
  motionOn: boolean;
  quality?: QualityChoice;
}

export default function WorldCanvas({ selected, onSelect, active, motionOn, quality = 'auto' }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const runtime = useRef<WorldRenderer | null>(null);
  const current = useRef({ selected, onSelect, active, motionOn, quality });
  current.current = { selected, onSelect, active, motionOn, quality };
  const [state, setState] = useState<'loading' | 'ready' | 'fallback' | 'unavailable'>('loading');
  const [recovery, setRecovery] = useState(0);
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
      runtime.current?.setPaused(!settings.active || document.hidden);
      runtime.current?.focusOn(settings.selected);
    };
    const updateDiagnostics = () => {
      const stats = runtime.current?.getDiagnostics();
      if (stats) {
        container.dataset.engine = stats.engine;
        container.dataset.diagnostics = JSON.stringify(stats);
      }
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
      const engine = renderer.getDiagnostics().engine;
      setState(engine === 'three-webgl' ? 'ready' : 'fallback');
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
  }, [recovery]);
  useEffect(() => { runtime.current?.focusOn(selected); }, [selected]);
  useEffect(() => { runtime.current?.setPaused(!active || document.hidden); }, [active]);
  useEffect(() => {
    runtime.current?.setMotion(motionOn && !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, [motionOn]);
  useEffect(() => { runtime.current?.setQualityChoice?.(quality); }, [quality]);
  return <>
    <div ref={host} className="ba3d-render-host" data-state={state} data-premium="true" />
    {state === 'loading' && <div className="ba3d-render-status" role="status">Đang mở thế giới 3D… Con có thể bắt đầu chơi ngay.</div>}
    {(state === 'fallback' || state === 'unavailable') && <div className="ba3d-render-status" role="status">
      {state === 'fallback' ? 'Đang dùng cảnh dự phòng.' : 'Cảnh 3D không khả dụng.'} Chọn trò chơi bằng các nút Bắt đầu.
    </div>}
  </>;
}
