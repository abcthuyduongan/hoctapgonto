import { LearningWorld3D } from '../engine';
import type { RendererInitOptions, RenderTier, WorldRenderer } from './types.ts';

export function createLegacyRenderer(opts: RendererInitOptions): WorldRenderer {
  opts.signal.throwIfAborted();
  const world = new LearningWorld3D(opts.canvas, {
    quality: opts.quality === 'low' || window.innerWidth <= 640 ? 'low' : 'full',
    reducedMotion: !opts.motionOn, onSelect: opts.onSelect,
  });
  if (!world.available) { world.dispose(); throw new Error('Legacy renderer unavailable'); }
  let tier: RenderTier = opts.quality === 'auto' ? 'balanced' : opts.quality;
  let disposed = false;
  const softwareRenderer = world.isSoftwareRenderer;
  const onLoss = (event: Event) => { event.preventDefault(); opts.onContextLost(); };
  opts.canvas.addEventListener('webglcontextlost', onLoss);
  world.setPaused(opts.paused);
  world.setRenderQuality(tier === 'high' ? 'sharp' : 'balanced');
  // Legacy resolution has two presets; low/balanced share the balanced preset.
  void world.loadGuideModel(world.isSoftwareRenderer?'/models/fox-guide-mobile.glb':'/models/fox-guide-prototype.glb');
  return {
    focusOn: id => world.focusOn(id), setPaused: value => world.setPaused(value),
    setMotion: value => world.setMotion(value),
    setQuality(value) { tier = value; world.setRenderQuality(value === 'high' ? 'sharp' : 'balanced'); },
    setQualityChoice(value) {
      tier = value === 'auto' ? (window.innerWidth <= 700 ? 'low' : 'balanced') : value;
      world.setRenderQuality(tier === 'high' ? 'sharp' : 'balanced');
    },
    getDiagnostics() {
      const data = world.getDiagnostics();
      return { engine: data.renderer === 'webgl2' ? 'legacy-webgl2' : 'canvas', tier,
        triangles: data.triangles, frames: data.samples,
        fpsEstimate: data.measuredFps ?? undefined };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      opts.canvas.removeEventListener('webglcontextlost', onLoss);
      world.dispose();
      if (!softwareRenderer) {
        opts.canvas.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext();
      }
    },
  };
}
