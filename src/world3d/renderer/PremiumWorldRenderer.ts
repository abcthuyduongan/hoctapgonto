import { WebGLRenderer, PerspectiveCamera, Vector2, Vector3, Raycaster,
  ACESFilmicToneMapping, SRGBColorSpace, PCFSoftShadowMap, Mesh, Group, Box3,
  CylinderGeometry, MeshStandardMaterial,
  type Quaternion, type Object3D, type AnimationClip } from 'three';
import type { WorldId } from '../engine';
import type { RendererInitOptions, RenderTier, RenderStats, WorldRenderer, QualityChoice,
  GuideMood, GuideViewport } from './types';
import { AssetLoader } from './assetLoader';
import { loadCatalog } from './loadCatalog';
import { ShadowUpdates } from './shadowUpdates';
import { disposeScene, estimateTextureBytes, estimateGeometryBytes } from './disposeScene';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import optimized from '../assets/optimized-manifest.json';
import { SelectedAsset } from './selectedAsset';
import { RenderSchedule } from './renderSchedule';
import { decorateWorld } from '../scenes/decorateWorld';
import { PerformanceMetrics } from './performanceMetrics';
import { QualityManager, QUALITY } from './qualityManager';
import { buildWorld } from '../scenes/buildWorld';
import { carouselLayout } from '../scenes/worldLayout';
import { WorldCarouselController } from '../scenes/WorldCarouselController';
import { MascotController } from '../scenes/mascotController';
import { fitGuideViewport } from '../scenes/guideViewport';

class PremiumWorldRenderer implements WorldRenderer {
  private world = buildWorld();
  private guideAnchor = new Group();
  private carousel = new WorldCarouselController(this.world.worlds, this.guideAnchor, this.world.waitingPlatform);
  private placeholders = new Map<WorldId, Group>();
  private detail: SelectedAsset<{id:WorldId;gltf:GLTF}>;
  private schedule = new RenderSchedule();
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
  private shadowUpdates = new ShadowUpdates();
  private shaderPreparationMs = 0;
  private parallelShaderCompile = false;
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
  private geometryBytes = 0;
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
    if (event.button !== 0 || this.paused || this.gameWorld) { this.pointerStart = undefined; return; }
    this.opts.canvas.focus({ preventScroll: true });
    this.pointerStart = { x: event.clientX, y: event.clientY };
  };
  private onPointerUp = (event: PointerEvent) => {
    const start = this.pointerStart; this.pointerStart = undefined;
    if (!start || event.button !== 0 || this.paused || this.gameWorld || Math.hypot(start.x - event.clientX, start.y - event.clientY) > 8) return;
    const box = this.opts.canvas.getBoundingClientRect();
    this.raycaster.setFromCamera(new Vector2((event.clientX - box.left) / box.width * 2 - 1,
      -(event.clientY - box.top) / box.height * 2 + 1), this.camera);
    const roots = [...this.world.worlds.values()];
    if (this.opts.onEnterWorld) roots.push(this.guideAnchor);
    const hits = this.raycaster.intersectObjects(roots, true);
    // Hidden decorative variants must not cover the interactive, visible mesh.
    const visible = (object: Object3D) => {
      let ancestor: Object3D | null = object;
      while (ancestor) { if (!ancestor.visible) return false; ancestor = ancestor.parent; }
      return true;
    };
    let node: Object3D | undefined = hits.find(hit => visible(hit.object))?.object;
    let guideHit = false;
    for (let ancestor = node; ancestor; ancestor = ancestor.parent ?? undefined) {
      if (ancestor === this.guideAnchor) { guideHit = true; break; }
    }
    const arrived = this.carousel.selected && !this.carousel.moving && this.carousel.mascotState === 'on-island';
    if (guideHit) {
      if (arrived) this.opts.onEnterWorld?.(this.carousel.selected!);
      return;
    }
    while (node && !node.userData.worldId) node = node.parent ?? undefined;
    const id = node?.userData.worldId as WorldId | undefined;
    if (id) {
      if (id === this.carousel.selected && arrived && this.opts.onEnterWorld) this.opts.onEnterWorld(id);
      else { this.focusOn(id); this.opts.onSelect(id); }
    }
  };
  private onPointerCancel = () => { this.pointerStart = undefined; };

  constructor(private opts: RendererInitOptions) {
    this.motion = opts.motionOn; this.paused = opts.paused;
    this.quality = new QualityManager(opts.quality, window.innerWidth <= 700);
    this.loader = new AssetLoader(this.controller.signal);
    for(const [id,root] of this.world.worlds){
      const placeholder=new Group();placeholder.name='Lightweight selectable island';
      const colors:Record<WorldId,number>={'math-quest':0x8fc6be,'memory-match':0x84b68c,'sentence-builder':0xb3a7c9,'word-connect':0xe6b56f,'sequence-trail':0x83bfd9};
      const stone=new Mesh(new CylinderGeometry(1.65,1.15,.65,12),new MeshStandardMaterial({color:colors[id],roughness:.9}));stone.position.y=-.32;
      const top=new Mesh(new CylinderGeometry(1.65,1.65,.08,12),new MeshStandardMaterial({color:0xd4e5bd,roughness:.9}));
      placeholder.add(stone,top);root.add(placeholder);this.placeholders.set(id,placeholder);
    }
    this.detail=new SelectedAsset({
      load:async(id,signal)=>({id:id as WorldId,gltf:await new AssetLoader(AbortSignal.any([signal,this.controller.signal])).load(this.assetFor(id as WorldId).url)}),
      attach:(id,asset)=>{
        decorateWorld(id as WorldId,asset.gltf.scene);
        this.world.worlds.get(id as WorldId)!.add(asset.gltf.scene);
        this.placeholders.get(id as WorldId)!.visible=false;
        this.measureAssets();
        if(this.textureBytes+this.geometryBytes>32*1024*1024)throw new Error('Cảnh vượt ngân sách bộ nhớ 3D.');
        this.readyAssets=['fox-guide','environment',this.assetId(id as WorldId)];
        this.shadowUpdates.request();this.publishDiagnostics();this.invalidate();
      },
      release:asset=>{
        asset.gltf.scene.removeFromParent();asset.gltf.scenes.forEach(disposeScene);
        this.placeholders.get(asset.id)!.visible=true;
        this.readyAssets=['fox-guide','environment'];this.measureAssets();this.invalidate();
      },
      failed:(id,error)=>{this.errors=[...this.errors.slice(-9),id+': '+String(error)];this.measureAssets();this.publishDiagnostics();this.invalidate();},
    });
  }
  private assetId(id:WorldId){return id==='memory-match'?'memory-world':id==='sentence-builder'||id==='word-connect'?'language-world':'math-world';}
  private assetFor(id:WorldId){return optimized.assets[this.assetId(id)];}
  private measureAssets(){this.textureBytes=estimateTextureBytes(this.world.scene);this.geometryBytes=estimateGeometryBytes(this.world.scene);}
  async initialize() {
    this.opts.signal.throwIfAborted();
    this.renderer = new WebGLRenderer({ canvas: this.opts.canvas, alpha: true,
      antialias: this.quality.tier !== 'low', powerPreference: 'low-power' });
    this.renderer.outputColorSpace=SRGBColorSpace;this.renderer.toneMapping=ACESFilmicToneMapping;this.renderer.toneMappingExposure=1;
    this.renderer.shadowMap.type=PCFSoftShadowMap;this.renderer.shadowMap.autoUpdate=false;
    this.opts.signal.addEventListener('abort',this.abortFromHost,{once:true});
    this.opts.canvas.addEventListener('webglcontextlost',this.onLoss);
    this.opts.canvas.addEventListener('pointerdown',this.onPointerDown);
    this.opts.canvas.addEventListener('pointerup',this.onPointerUp);
    this.opts.canvas.addEventListener('pointercancel',this.onPointerCancel);
    this.resizeObserver=new ResizeObserver(this.resize);this.resizeObserver.observe(this.opts.canvas);
    this.applyQuality();this.resize();
    // Only the guide and shared environment are required for an overview.
    // Detailed islands are decoded one at a time after actual selection.
    const base=['fox-guide','environment'] as const;
    const results=await loadCatalog(base.map(id=>optimized.assets[id].url),path=>this.loader.load(path),this.controller.signal);
    const fulfilled=results.filter((r):r is PromiseFulfilledResult<GLTF>=>r.status==='fulfilled').map(r=>r.value);
    if(this.disposed||this.opts.signal.aborted||fulfilled.length!==base.length){
      fulfilled.forEach(asset=>asset.scenes.forEach(disposeScene));
      this.controller.signal.throwIfAborted();this.opts.signal.throwIfAborted();
      throw new Error('Chưa tải được nhân vật hoặc cảnh nền 3D.');
    }
    const [fox,environment]=fulfilled;
    this.world.scenery.add(environment.scene);
    const clouds:Object3D[]=[];
    environment.scene.traverse(node=>{
      const mesh=node as Mesh;if(!mesh.isMesh)return;mesh.userData.noShadow=true;
      if((Array.isArray(mesh.material)?mesh.material:[mesh.material]).some(material=>material.userData.baoAnRole==='cloud'))clouds.push(mesh);
    });
    clouds.forEach(node=>this.world.clouds.add(node));
    fox.scene.scale.setScalar(.9);this.guideBounds.setFromObject(fox.scene);
    this.guideAnchor.add(fox.scene);this.world.scene.add(this.guideAnchor);
    this.mascot=new MascotController(fox.scene,fox.animations);
    this.clips=fox.animations.map(clip=>clip.name);this.sourceClips=fox.animations;
    fox.scene.traverse(node=>{if('isSkinnedMesh'in node&&node.isSkinnedMesh)this.skeletalMeshes++;if('isBone'in node&&node.isBone)this.bones++;});
    this.world.scene.traverse(node=>{const mesh=node as Mesh;if(mesh.isMesh){mesh.castShadow=!mesh.userData.noShadow;mesh.receiveShadow=!mesh.userData.noShadow;}});
    const shaderStarted=performance.now();this.parallelShaderCompile=this.renderer.extensions.has('KHR_parallel_shader_compile');
    // Prepare the active quality only; toggling quality compiles on demand.
    await this.renderer.compileAsync(this.world.scene,this.camera);this.controller.signal.throwIfAborted();
    this.shaderPreparationMs=performance.now()-shaderStarted;this.readyAssets=[...base];
    this.measureAssets();this.initialized=true;this.schedule.react(performance.now(),1200);this.resize();this.invalidate();
  }
  private resize = () => {
    if (this.disposed || !this.renderer) return;
    this.shadowUpdates.request();
    const width = Math.max(1, this.opts.canvas.clientWidth);
    const height = Math.max(1, this.opts.canvas.clientHeight);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    const mobile = width <= 700;
    if (this.gameWorld) {
      if(this.world.scene.fog&&'near'in this.world.scene.fog){this.world.scene.fog.near=22;this.world.scene.fog.far=65;}
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
    const islandCount = this.world.worlds.size;
    const layout = carouselLayout(mobile, islandCount);
    // Frame the full entrance ring or row and the waiting guide.
    const span = islandCount > 3
      ? Math.max(layout.radiusX * 2 + 4.5 * layout.frontScale, 2 * (Math.abs(layout.waiting.x) + 1.25))
      : Math.max((islandCount - 1) * layout.spacing + 4.5 * layout.neutralScale,
          layout.radiusX * 2 + 4.5 * layout.frontScale,
          2 * (Math.abs(layout.waiting.x) + 1.25));
    let distance = Math.max(mobile ? 14 : 14.5, span / (2 * Math.tan(32 * Math.PI / 360) * this.camera.aspect) + 3);
    this.camera.updateProjectionMatrix();
    // The foreground perch is closer than the islands; fit its full volume,
    // not just its center, so tablet portrait and landscape cannot crop the fox.
    const waitingCorners = [-1.25, 1.25].flatMap(x => [-.4, 2.6].flatMap(y => [-1.15, 1.15].map(z =>
      new Vector3(layout.waiting.x + x, layout.waiting.y + y, layout.waiting.z + z))));
    for (let attempt = 0; attempt < 24; attempt++) {
      // A higher view separates the front and back islands on screen.
      this.camera.position.set(0, distance * .68 + 1, distance);
      this.camera.lookAt(this.target); this.camera.updateMatrixWorld();
      if (waitingCorners.every(corner => {
        const projected = corner.clone().project(this.camera);
        return Math.abs(projected.x) <= .94 && Math.abs(projected.y) <= .94;
      })) break;
      distance *= 1.035;
    }
    // Portrait fitting moves the camera beyond the old fixed fog distance.
    // Keep the playable islands clear while distant scenery remains atmospheric.
    if(this.world.scene.fog&&'near'in this.world.scene.fog){
      const viewDistance=this.camera.position.distanceTo(this.target);
      this.world.scene.fog.near=Math.max(12,viewDistance-5);
      this.world.scene.fog.far=viewDistance+40;
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
    if(!this.schedule.shouldDraw(now,this.quality.tier)){this.invalidate();return;}
    const delta = this.lastTime ? Math.max(0, Math.min((now - this.lastTime) / 1000, .05)) : 0;
    const frameMs = this.lastTime ? now - this.lastTime : 0;
    this.lastTime = now;
    if (this.motion) {
      this.metrics.record(now);
      if (!this.gameWorld) this.carousel.advance(delta);
      this.mascot?.update(delta);
      if (this.quality.observe(frameMs, now)) this.applyQuality();
    }
    this.camera.lookAt(this.target);
    this.renderer.shadowMap.needsUpdate = this.shadowUpdates.shouldUpdate(now,
      this.quality.tier, !!this.gameWorld, this.motion);
    this.renderer.render(this.world.scene, this.camera);
    if (!this.motion || now - this.lastStats > 1000) {
      this.lastStats = now;
      this.opts.canvas.dataset.diagnostics = JSON.stringify(this.getDiagnostics());
    }
    if(this.schedule.moving(now,this.carousel.moving,this.motion))this.invalidate();
    else {this.lastTime=0;this.metrics.resetClock();this.publishDiagnostics();}
  };
  focusOn(id: WorldId | null) {
    if (this.gameWorld) return;
    void this.detail.select(id);
    if (!this.carousel.select(id, this.motion)) return;
    this.schedule.react(performance.now());this.schedule.resetClock();this.lastTime=0;this.metrics.resetClock();
    this.shadowUpdates.request();
    if (this.motion) this.mascot?.play('Cheer');
    this.invalidate();
  }
  setPaused(paused: boolean) {
    this.paused = paused;
    cancelAnimationFrame(this.raf); this.raf = 0;
    this.lastTime = 0; this.metrics.resetClock();this.schedule.resetClock();
    this.publishDiagnostics();
    if (!paused) { this.shadowUpdates.request(); this.invalidate(); }
  }
  setMotion(enabled: boolean) {
    this.motion = enabled; this.lastTime = 0; this.metrics.resetClock();
    this.shadowUpdates.request();
    if (!enabled) {
      if (!this.gameWorld) this.carousel.settle();
      this.applyGuideMood();this.schedule.stop();
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
    this.frameShadowCamera(false);
    this.world.scene.fog?.color.setHex(0xd9eee9);
    this.carousel.configure(this.opts.canvas.clientWidth <= 700);
  }
  private frameShadowCamera(game: boolean) {
    const camera = this.world.sunlight.shadow.camera;
    // Interiors place their island landmark left of the DOM board. Expand the
    // shadow coverage there while preserving the shared direction of the light.
    Object.assign(camera, game ? { left: -24, right: 14, top: 14, bottom: -12 }
      : { left: -12, right: 12, top: 11, bottom: -9 });
    camera.updateProjectionMatrix();
    this.shadowUpdates.request();
  }
  setGameScene(id: WorldId | null) {
    if (id === this.gameWorld || (id && !this.world.worlds.has(id))) return;
    if (this.gameWorld) this.restoreHome();
    if (id) {
      this.guideViewport = undefined;
      void this.detail.select(id);
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
      this.world.waitingPlatform.visible = false;
      this.world.scene.fog?.color.setHex(0xe2e9d8);
      this.frameShadowCamera(true);
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
    if (!this.gameWorld) this.shadowUpdates.request();
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
    this.schedule.react(performance.now(),mood==='victory'?3200:2400);this.schedule.resetClock();
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
      shadowUpdates: this.shadowUpdates.updates,
      gpuGeometries: this.renderer?.info.memory.geometries,
      gpuTextures: this.renderer?.info.memory.textures,
      gpuPrograms: this.renderer?.info.programs?.length,
      shaderPreparationMs: this.shaderPreparationMs,
      parallelShaderCompile: this.parallelShaderCompile,
      geometryDetail:'reduced',lodState:'ready',geometryBytesEstimate:this.geometryBytes,
      activeAssetBytes:optimized.assets['fox-guide'].bytes+optimized.assets.environment.bytes+(this.detail.activeId?this.assetFor(this.detail.activeId as WorldId).bytes:0),
      renderPending:!!this.raf,
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
    this.detail.dispose();
    disposeScene(this.world.scene);
    this.renderer?.dispose(); this.renderer?.forceContextLoss();
  }
}

export async function createPremiumRenderer(options: RendererInitOptions): Promise<WorldRenderer> {
  const renderer = new PremiumWorldRenderer(options);
  try { await renderer.initialize(); return renderer; }
  catch (error) { renderer.dispose(); throw error; }
}
