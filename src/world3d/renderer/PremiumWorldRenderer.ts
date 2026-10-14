import { WebGLRenderer, PerspectiveCamera, Vector2, Vector3, Raycaster,
  ACESFilmicToneMapping, SRGBColorSpace, PCFSoftShadowMap, Mesh, Group, type Object3D } from 'three';
import type { WorldId } from '../engine';
import type { RendererInitOptions, RenderTier, RenderStats, WorldRenderer, QualityChoice } from './types';
import { AssetLoader } from './assetLoader';
import { disposeScene, estimateTextureBytes } from './disposeScene';
import { PerformanceMetrics } from './performanceMetrics';
import { QualityManager, QUALITY } from './qualityManager';
import { buildWorld } from '../scenes/buildWorld';
import { carouselLayout, WORLD_IDS } from '../scenes/worldLayout';
import { WorldCarouselController } from '../scenes/WorldCarouselController';
import { MascotController } from '../scenes/mascotController';

class PremiumWorldRenderer implements WorldRenderer {
  private world = buildWorld();
  private guideAnchor = new Group();
  private carousel = new WorldCarouselController(this.world.worlds, this.guideAnchor, this.world.waitingPlatform);
  private camera = new PerspectiveCamera(32, 1, .1, 150);
  private renderer?: WebGLRenderer;
  private loader: AssetLoader;
  private controller = new AbortController();
  private metrics = new PerformanceMetrics();
  private quality: QualityManager;
  private mascot?: MascotController;
  private resizeObserver?: ResizeObserver;
  private raycaster = new Raycaster();
  private target = new Vector3(0, .3, 0);
  private raf = 0;
  private lastTime = 0;
  private lastStats = 0;
  private disposed = false;
  private initialized = false;
  private paused: boolean;
  private motion: boolean;
  private pointerStart?: { x: number; y: number };
  private errors: string[] = [];
  private readyAssets: string[] = [];
  private textureBytes = 0;
  private clips: string[] = [];
  private skeletalMeshes = 0;
  private bones = 0;
  private abortFromHost = () => this.dispose();
  private onLoss = (event: Event) => {
    event.preventDefault();
    if (this.disposed) return;
    this.setPaused(true);
    this.opts.onContextLost();
  };
  private onPointerDown = (event: PointerEvent) => {
    this.pointerStart = { x: event.clientX, y: event.clientY };
  };
  private onPointerUp = (event: PointerEvent) => {
    const start = this.pointerStart; this.pointerStart = undefined;
    if (!start || this.paused || Math.hypot(start.x - event.clientX, start.y - event.clientY) > 8) return;
    const box = this.opts.canvas.getBoundingClientRect();
    this.raycaster.setFromCamera(new Vector2((event.clientX - box.left) / box.width * 2 - 1,
      -(event.clientY - box.top) / box.height * 2 + 1), this.camera);
    const hits = this.raycaster.intersectObjects([...this.world.worlds.values()], true);
    let node: Object3D | undefined = hits[0]?.object;
    while (node && !node.userData.worldId) node = node.parent ?? undefined;
    const id = node?.userData.worldId as WorldId | undefined;
    if (id) { this.focusOn(id); this.opts.onSelect(id); }
  };
  private onPointerCancel = () => { this.pointerStart = undefined; };

  constructor(private opts: RendererInitOptions) {
    this.motion = opts.motionOn; this.paused = opts.paused;
    this.quality = new QualityManager(opts.quality, window.innerWidth <= 700);
    this.loader = new AssetLoader(this.controller.signal);
  }
  async initialize() {
    this.opts.signal.throwIfAborted();
    this.renderer = new WebGLRenderer({ canvas: this.opts.canvas, alpha: true,
      antialias: this.quality.tier !== 'low', powerPreference: 'low-power' });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.opts.signal.addEventListener('abort', this.abortFromHost, { once: true });
    this.opts.canvas.addEventListener('webglcontextlost', this.onLoss);
    this.opts.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.opts.canvas.addEventListener('pointerup', this.onPointerUp);
    this.opts.canvas.addEventListener('pointercancel', this.onPointerCancel);
    this.resizeObserver = new ResizeObserver(this.resize);
    this.resizeObserver.observe(this.opts.canvas);
    this.applyQuality();
    this.resize();
    // One vertical slice first. Remaining islands are clearly provisional.
    // Parallel fetch is bounded to two self-contained GLBs, reused on focus.
    const results = await Promise.allSettled([
      this.loader.load('/models/math-world.glb'), this.loader.load('/models/fox-guide.glb'),
    ]);
    if (this.disposed || this.opts.signal.aborted) {
      results.forEach(result => { if (result.status === 'fulfilled') result.value.scenes.forEach(disposeScene); });
      throw new DOMException('Cancelled', 'AbortError');
    }
    results.forEach((result, index) => {
      if (result.status === 'rejected') this.errors.push(`${index === 0 ? 'math-world' : 'fox-guide'}: ${String(result.reason)}`);
    });
    // Dispose successfully decoded assets if the other required asset failed.
    if (this.errors.length) {
      results.forEach(result => { if (result.status === 'fulfilled') result.value.scenes.forEach(disposeScene); });
      throw new Error(this.errors.join('; '));
    }
    const math = (results[0] as PromiseFulfilledResult<Awaited<ReturnType<AssetLoader['load']>>>).value;
    const fox = (results[1] as PromiseFulfilledResult<Awaited<ReturnType<AssetLoader['load']>>>).value;
    // Attach both roots before validation so any subsequent failure cleans both.
    const group = this.world.worlds.get('math-quest')!;
    group.children.forEach(disposeScene); group.clear(); group.add(math.scene);
    fox.scene.position.set(0, 0, 0); fox.scene.scale.setScalar(.9);
    this.guideAnchor.add(fox.scene); this.world.scene.add(this.guideAnchor);
    this.mascot = new MascotController(fox.scene, fox.animations);
    this.clips = fox.animations.map(clip => clip.name);
    fox.scene.traverse(node => {
      if ('isSkinnedMesh' in node && node.isSkinnedMesh) this.skeletalMeshes++;
      if ('isBone' in node && node.isBone) this.bones++;
    });
    this.world.scene.traverse(node => {
      const mesh = node as Mesh;
      if (mesh.isMesh) { mesh.castShadow = !mesh.userData.noShadow; mesh.receiveShadow = !mesh.userData.noShadow; }
    });
    this.readyAssets = ['math-world', 'fox-guide'];
    this.textureBytes = estimateTextureBytes(this.world.scene);
    this.initialized = true;
    this.invalidate();
  }
  private resize = () => {
    if (this.disposed || !this.renderer) return;
    const width = Math.max(1, this.opts.canvas.clientWidth);
    const height = Math.max(1, this.opts.canvas.clientHeight);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    const mobile = width <= 700;
    this.carousel.configure(mobile);
    const layout = carouselLayout(mobile, WORLD_IDS.length);
    // Frame the full entrance row and the circle, including the waiting guide.
    const span = Math.max((WORLD_IDS.length - 1) * layout.spacing + 4.5 * layout.neutralScale,
      layout.radiusX * 2 + 4.5 * layout.frontScale,
      2 * (Math.abs(layout.waiting.x) + 1.25));
    let distance = Math.max(mobile ? 14 : 14.5, span / (2 * Math.tan(32 * Math.PI / 360) * this.camera.aspect) + 3);
    this.camera.updateProjectionMatrix();
    // The foreground perch is closer than the islands; fit its full volume,
    // not just its center, so tablet portrait and landscape cannot crop the fox.
    const waitingCorners = [-1.25, 1.25].flatMap(x => [-.4, 2.6].flatMap(y => [-1.15, 1.15].map(z =>
      new Vector3(layout.waiting.x + x, layout.waiting.y + y, layout.waiting.z + z))));
    for (let attempt = 0; attempt < 24; attempt++) {
      this.camera.position.set(0, distance * .38 + 1, distance);
      this.camera.lookAt(this.target); this.camera.updateMatrixWorld();
      if (waitingCorners.every(corner => {
        const projected = corner.clone().project(this.camera);
        return Math.abs(projected.x) <= .94 && Math.abs(projected.y) <= .94;
      })) break;
      distance *= 1.035;
    }
    this.invalidate();
  };
  private applyQuality() {
    if (!this.renderer) return;
    const config = QUALITY[this.quality.tier];
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, config.maxDpr));
    this.renderer.shadowMap.enabled = config.shadows;
    this.world.sunlight.castShadow = config.shadows;
    this.resize();
  }
  private invalidate() {
    if (this.initialized && !this.disposed && !this.paused && !this.raf) this.raf = requestAnimationFrame(this.draw);
  }
  private draw = (now: number) => {
    this.raf = 0;
    if (this.disposed || this.paused || !this.renderer) return;
    const delta = this.lastTime ? Math.max(0, Math.min((now - this.lastTime) / 1000, .05)) : 0;
    const frameMs = this.lastTime ? now - this.lastTime : 0;
    this.lastTime = now;
    if (this.motion) {
      this.metrics.record(now);
      this.carousel.advance(delta);
      this.mascot?.update(delta);
      this.world.clouds.rotation.y += delta * .003;
      if (this.quality.observe(frameMs, now)) this.applyQuality();
    }
    this.camera.lookAt(this.target);
    this.renderer.render(this.world.scene, this.camera);
    if (now - this.lastStats > 1000) {
      this.lastStats = now;
      this.opts.canvas.dataset.diagnostics = JSON.stringify(this.getDiagnostics());
    }
    if (this.motion) this.invalidate();
  };
  focusOn(id: WorldId | null) {
    if (!this.carousel.select(id, this.motion)) return;
    if (this.motion) this.mascot?.play('Cheer');
    this.invalidate();
  }
  setPaused(paused: boolean) {
    this.paused = paused;
    cancelAnimationFrame(this.raf); this.raf = 0;
    this.lastTime = 0; this.metrics.resetClock();
    if (!paused) this.invalidate();
  }
  setMotion(enabled: boolean) {
    this.motion = enabled; this.lastTime = 0; this.metrics.resetClock();
    if (!enabled) {
      this.carousel.settle();
      this.mascot?.play('Idle', false);
      this.mascot?.mixer.setTime(0);
      cancelAnimationFrame(this.raf); this.raf = 0;
    }
    this.invalidate();
  }
  setQuality(tier: RenderTier) { this.quality.setChoice(tier); this.applyQuality(); this.invalidate(); }
  setQualityChoice(choice: QualityChoice) { this.quality.setChoice(choice); this.applyQuality(); this.invalidate(); }
  getDiagnostics(): RenderStats {
    return { engine: 'three-webgl', ...this.metrics.snapshot(), tier: this.quality.tier,
      ...this.carousel.snapshot(),
      dpr: this.renderer?.getPixelRatio(), drawCalls: this.renderer?.info.render.calls,
      triangles: this.renderer?.info.render.triangles, textureBytesEstimate: this.textureBytes,
      assetErrors: [...this.errors], readyAssets: [...this.readyAssets],
      animationClips: [...this.clips], skeletalMeshes: this.skeletalMeshes,
      bones: this.bones, animationTime: this.mascot?.mixer.time,
      activeClip: this.mascot?.activeClip, motion: this.motion, paused: this.paused };
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true; this.controller.abort();
    this.opts.signal.removeEventListener('abort', this.abortFromHost);
    cancelAnimationFrame(this.raf); this.raf = 0;
    this.resizeObserver?.disconnect();
    this.opts.canvas.removeEventListener('webglcontextlost', this.onLoss);
    this.opts.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.opts.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.opts.canvas.removeEventListener('pointercancel', this.onPointerCancel);
    this.mascot?.dispose();
    this.world.sunlight.shadow.dispose();
    disposeScene(this.world.scene);
    this.renderer?.dispose(); this.renderer?.forceContextLoss();
  }
}

export async function createPremiumRenderer(options: RendererInitOptions): Promise<WorldRenderer> {
  const renderer = new PremiumWorldRenderer(options);
  try { await renderer.initialize(); return renderer; }
  catch (error) { renderer.dispose(); throw error; }
}
