import type { RendererInitOptions, WorldRenderer } from './types.ts';

type Loader = (options: RendererInitOptions) => WorldRenderer | Promise<WorldRenderer>;
interface FactoryOptions extends RendererInitOptions {
  premium3DEnabled: boolean;
  /** Online lessons return to their lightweight DOM hub instead of a second renderer. */
  fallbackToLegacy?:boolean;
  replaceCanvas: () => HTMLCanvasElement;
}
const defaults = {
  premium: async (opts: RendererInitOptions) => (await import('./PremiumWorldRenderer')).createPremiumRenderer(opts),
  legacy: async (opts: RendererInitOptions) => (await import('./legacyAdapter')).createLegacyRenderer(opts),
};

export async function createWorldRenderer(opts: FactoryOptions,
  loaders: { premium: Loader; legacy: Loader } = defaults): Promise<WorldRenderer> {
  opts.signal.throwIfAborted();
  let canvas = opts.canvas;
  const create = async (loader: Loader) => {
    opts.signal.throwIfAborted();
    const renderer = await loader({ ...opts, canvas });
    if (opts.signal.aborted) { renderer.dispose(); opts.signal.throwIfAborted(); }
    return renderer;
  };
  if (opts.premium3DEnabled) {
    try { return await create(loaders.premium); }
    catch (error) {
      opts.signal.throwIfAborted();
      if(opts.fallbackToLegacy===false)throw error;
      console.warn('Bảo An: dùng renderer dự phòng', error);
      // A canvas that acquired WebGL cannot later acquire a different context.
      // The premium loader owns cleanup on failure; the host owns replacement.
      canvas = opts.replaceCanvas();
    }
  }
  return create(loaders.legacy);
}
