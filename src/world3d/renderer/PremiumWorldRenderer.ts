import { WebGLRenderer, PerspectiveCamera, Vector2, Vector3, Raycaster,
  ACESFilmicToneMapping, SRGBColorSpace, PCFSoftShadowMap, Mesh, Group, Box3,
  type Quaternion, type Object3D, type AnimationClip } from 'three';
import type { WorldId } from '../engine';
import type { RendererInitOptions, RenderTier, RenderStats, WorldRenderer, QualityChoice,
  GuideMood, GuideViewport } from './types';
import { AssetLoader } from './assetLoader';
import { disposeScene, estimateTextureBytes } from './disposeScene';
import { PerformanceMetrics } from './performanceMetrics';
import { QualityManager, QUALITY } from './qualityManager';
import { buildWorld } from '../scenes/buildWorld';
import { carouselLayout, WORLD_IDS } from '../scenes/worldLayout';
import { WorldCarouselController } from '../scenes/WorldCarouselController';
import { MascotController } from '../scenes/mascotController';
import { buildGameEnvironments } from '../scenes/gameEnvironments';
import { fitGuideViewport } from '../scenes/guideViewport';

class PremiumWorldRenderer implements WorldRenderer {
  private world = buildWorld();
  private guideAnchor = new Group();
  private carousel = new WorldCarouselController(this.world.worlds, this.guideAnchor, this.world.waitingPlatform);
  private gameEnvironments = buildGameEnvironments();
  private gameWorld: WorldId | null = null;
  private guideMood: GuideMood = 'idle';
  private guideCue: number | undefined;
  private guideViewport: GuideViewport | null | undefined;
  private guideBounds = new Box3(new Vector3(-.6, 0, -.4), new Vector3(.6, 2, .4));
  private homeTransforms: { node: Object3D; position: Vector3; scale: Vector3;
    quaternion: Quaternion; visible: boolean }[] = [];
  private guideShadowFlags = new Map<Mesh, boolean>();
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
  private sourceClips: AnimationClip[] = [];
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
    if (!start || this.paused || this.gameWorld || Math.hypot(start.x - event.clientX, start.y - event.clientY) > 8) return;
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
    this.world.scene.add(this.gameEnvironments.root);
    this.gameEnvironments.setQuality(this.quality.tier === 'high');
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
    this.guideBounds.setFromObject(fox.scene);
    this.guideAnchor.add(fox.scene); this.world.scene.add(this.guideAnchor);
    this.mascot = new MascotController(fox.scene, fox.animations);
    this.clips = fox.animations.map(clip => clip.name);
    this.sourceClips = fox.animations;
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
    this.resize();
    this.invalidate();
  }
  private resize = () => {
    if (this.disposed || !this.renderer) return;
    const width = Math.max(1, this.opts.canvas.clientWidth);
    const height = Math.max(1, this.opts.canvas.clientHeight);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    const mobile = width <= 700;
    if (this.gameWorld) {
      this.camera.fov = 38;
      const distance = Math.max(21, mobile ? 11 / this.camera.aspect : 21);
      this.camera.position.set(0, distance * .28 + .5, distance);
      this.target.set(0, .9, -4);
      this.camera.updateProjectionMatrix(); this.camera.lookAt(this.target);
      this.camera.updateMatrixWorld();
      this.placeGameGuide(); this.invalidate();
      return;
    }
    this.camera.fov = 32; this.target.set(0, .3, 0);
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
    this.gameEnvironments.setQuality(this.quality.tier === 'high');
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
      if (!this.gameWorld) this.carousel.advance(delta);
      this.mascot?.update(delta);
      if (!this.gameWorld) this.world.clouds.rotation.y += delta * .003;
      if (this.quality.observe(frameMs, now)) this.applyQuality();
    }
    this.camera.lookAt(this.target);
    this.renderer.render(this.world.scene, this.camera);
    if (!this.motion || now - this.lastStats > 1000) {
      this.lastStats = now;
      this.opts.canvas.dataset.diagnostics = JSON.stringify(this.getDiagnostics());
    }
    if (this.motion) this.invalidate();
  };
  focusOn(id: WorldId | null) {
    if (this.gameWorld) return;
    if (!this.carousel.select(id, this.motion)) return;
    if (this.motion) this.mascot?.play('Cheer');
    this.invalidate();
  }
  setPaused(paused: boolean) {
    this.paused = paused;
    cancelAnimationFrame(this.raf); this.raf = 0;
    this.lastTime = 0; this.metrics.resetClock();
    this.publishDiagnostics();
    if (!paused) this.invalidate();
  }
  setMotion(enabled: boolean) {
    this.motion = enabled; this.lastTime = 0; this.metrics.resetClock();
    if (!enabled) {
      if (!this.gameWorld) this.carousel.settle();
      this.applyGuideMood();
      cancelAnimationFrame(this.raf); this.raf = 0;
    }
    this.publishDiagnostics();
    this.invalidate();
  }
  setQuality(tier: RenderTier) { this.quality.setChoice(tier); this.applyQuality(); this.invalidate(); }
  setQualityChoice(choice: QualityChoice) { this.quality.setChoice(choice); this.applyQuality(); this.invalidate(); }
  private restoreHome() {
    this.homeTransforms.forEach(({ node, position, scale, quaternion, visible }) => {
      node.position.copy(position); node.scale.copy(scale); node.quaternion.copy(quaternion); node.visible = visible;
    });
    this.homeTransforms = []; this.gameWorld = null; this.guideViewport = undefined;
    this.guideShadowFlags.forEach((castShadow, mesh) => { mesh.castShadow = castShadow; });
    this.guideShadowFlags.clear();
    this.gameEnvironments.setWorld(null);
    this.world.scene.fog?.color.setHex(0xd9eee9);
    this.carousel.configure(this.opts.canvas.clientWidth <= 700);
  }
  setGameScene(id: WorldId | null) {
    if (id === this.gameWorld || (id && !this.world.worlds.has(id))) return;
    if (this.gameWorld) this.restoreHome();
    if (id) {
      this.guideViewport = undefined;
      this.carousel.select(id, false); this.carousel.settle();
      const homeNodes = [...this.world.worlds.values(), this.guideAnchor, this.world.waitingPlatform,
        this.world.clouds, this.world.scenery];
      this.homeTransforms = homeNodes.map(node => ({ node, position: node.position.clone(),
        scale: node.scale.clone(), quaternion: node.quaternion.clone(), visible: node.visible }));
      this.gameWorld = id;
      this.guideAnchor.traverse(node => {
        const mesh = node as Mesh;
        if (!mesh.isMesh) return;
        this.guideShadowFlags.set(mesh, mesh.castShadow);
        // The rig becomes a camera-space portrait in games; its shadow cannot
        // have a meaningful position on the island ground behind the DOM board.
        mesh.castShadow = false;
      });
      for (const [key, root] of this.world.worlds) root.visible = key === id;
      const landmark = this.world.worlds.get(id)!;
      // The guide column leaves the upper-left scenery visible; the reading
      // board occupies the center/right, so keep the island identity here.
      landmark.position.set(-12, .05, -10);
      landmark.scale.setScalar(id === 'math-quest' ? 1.8 : id === 'memory-match' ? 2 : 1.9);
      this.world.waitingPlatform.visible = this.world.clouds.visible = this.world.scenery.visible = false;
      this.world.scene.fog?.color.setHex(0xe2e9d8);
      this.gameEnvironments.setWorld(id);
    }
    this.guideMood = 'idle'; this.guideCue = undefined; this.applyGuideMood();
    this.lastTime = 0; this.metrics.resetClock();
    this.resize(); this.publishDiagnostics(); this.invalidate();
  }
  private placeGameGuide() {
    if (!this.gameWorld) return;
    if (this.guideViewport === null) { this.guideAnchor.visible = false; return; }
    const width = Math.max(1, this.opts.canvas.clientWidth), height = Math.max(1, this.opts.canvas.clientHeight);
    const box = this.guideViewport ?? { x: width * .035, y: height * .56,
      width: width * (width <= 700 ? .22 : .16), height: height * .37 };
    fitGuideViewport(this.guideAnchor, this.guideBounds, this.camera, box, width, height);
    if (this.guideMood === 'encourage') this.guideAnchor.rotateZ(-.045);
  }
  private applyGuideMood() {
    const clip = this.guideMood === 'happy' ? 'Cheer' : this.guideMood === 'victory' ? 'Victory' : 'Idle';
    this.mascot?.play(clip);
    if (!this.motion && this.mascot) {
      // Remove fades tied to an earlier mixer clock so a single static reaction
      // remains visible even after the animated scene has been running awhile.
      for (const source of this.sourceClips) {
        const action = this.mascot.mixer.existingAction(source);
        if (!action) continue;
        action.enabled = source.name === clip;
        action.stopFading(); action.setEffectiveWeight(1);
        if (action.enabled) action.play();
      }
      this.mascot.mixer.setTime(clip === 'Idle' ? 0 : .42);
    }
    if (this.gameWorld) this.placeGameGuide();
  }
  setGuideMood(mood: GuideMood, cue?: number) {
    const nextCue = cue !== undefined && Number.isFinite(cue) ? cue : undefined;
    if (mood === this.guideMood && nextCue === this.guideCue) return;
    this.guideMood = mood; this.guideCue = nextCue;
    this.applyGuideMood(); this.publishDiagnostics(); this.invalidate();
  }
  setGuideViewport(box: GuideViewport | null) {
    this.guideViewport = box && [box.x, box.y, box.width, box.height].every(Number.isFinite)
      && box.width > 0 && box.height > 0 ? { ...box } : null;
    this.placeGameGuide(); this.publishDiagnostics(); this.invalidate();
  }
  private publishDiagnostics() {
    if (this.initialized && !this.disposed) this.opts.canvas.dataset.diagnostics = JSON.stringify(this.getDiagnostics());
  }
  getDiagnostics(): RenderStats {
    return { engine: 'three-webgl', ...this.metrics.snapshot(), tier: this.quality.tier,
      ...this.carousel.snapshot(),
      dpr: this.renderer?.getPixelRatio(), drawCalls: this.renderer?.info.render.calls,
      triangles: this.renderer?.info.render.triangles, textureBytesEstimate: this.textureBytes,
      assetErrors: [...this.errors], readyAssets: [...this.readyAssets],
      animationClips: [...this.clips], skeletalMeshes: this.skeletalMeshes,
      bones: this.bones, animationTime: this.mascot?.mixer.time,
      activeClip: this.mascot?.activeClip, motion: this.motion, paused: this.paused,
      sceneMode: this.gameWorld ? 'game' : 'home', gameWorld: this.gameWorld,
      mascotPosition: { x: this.guideAnchor.position.x, y: this.guideAnchor.position.y, z: this.guideAnchor.position.z },
      guideMood: this.guideMood, guideCue: this.guideCue,
      guideViewport: this.guideViewport ?? null, guideVisible: this.guideAnchor.visible };
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
    this.guideShadowFlags.clear(); this.homeTransforms = [];
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
