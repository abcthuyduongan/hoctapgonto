import { WebGLRenderer, PerspectiveCamera, Vector2, Vector3, Raycaster,
  ACESFilmicToneMapping, SRGBColorSpace, PCFSoftShadowMap, Mesh, Group, Box3,
  BoxGeometry, CylinderGeometry, IcosahedronGeometry, ConeGeometry, TorusGeometry, SphereGeometry, MeshStandardMaterial,
  type Quaternion, type Object3D, type AnimationClip } from 'three';
import type { WorldId } from '../engine';
import type { RendererInitOptions, RenderTier, RenderStats, WorldRenderer, QualityChoice,
  GuideMood, GuideViewport } from './types';
import { AssetLoader } from './assetLoader';
import { loadCatalog } from './loadCatalog';
import { ShadowUpdates } from './shadowUpdates';
import { disposeScene, estimateTextureBytes } from './disposeScene';
import { PerformanceMetrics } from './performanceMetrics';
import { QualityManager, QUALITY } from './qualityManager';
import { buildWorld } from '../scenes/buildWorld';
import { carouselLayout } from '../scenes/worldLayout';
import { WorldCarouselController } from '../scenes/WorldCarouselController';
import { MascotController } from '../scenes/mascotController';
import { buildGameEnvironments } from '../scenes/gameEnvironments';
import { fitGuideViewport } from '../scenes/guideViewport';
import type { GeometryLod } from '../scenes/geometryLod';

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
  private shadowUpdates = new ShadowUpdates();
  private lod?: GeometryLod;
  private lodState: 'idle' | 'preparing' | 'ready' | 'unavailable' = 'idle';
  private lodError?: string;
  private lodTimer = 0;
  private hasDrawn = false;
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
    this.renderer.shadowMap.autoUpdate = false;
    this.opts.signal.addEventListener('abort', this.abortFromHost, { once: true });
    this.opts.canvas.addEventListener('webglcontextlost', this.onLoss);
    this.opts.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.opts.canvas.addEventListener('pointerup', this.onPointerUp);
    this.opts.canvas.addEventListener('pointercancel', this.onPointerCancel);
    this.resizeObserver = new ResizeObserver(this.resize);
    this.resizeObserver.observe(this.opts.canvas);
    this.applyQuality();
    this.resize();
    // Every self-contained asset is decoded once, with at most two in flight.
    const catalog = ['math-world', 'fox-guide', 'memory-world', 'language-world', 'environment'];
    const results = await loadCatalog(catalog.map(id => `/models/${id}.glb`),
      path => this.loader.load(path), this.controller.signal);
    if (this.disposed || this.opts.signal.aborted) {
      results.forEach(result => { if (result.status === 'fulfilled') result.value.scenes.forEach(disposeScene); });
      throw new DOMException('Cancelled', 'AbortError');
    }
    results.forEach((result, index) => {
      if (result.status === 'rejected') this.errors.push(`${catalog[index]}: ${String(result.reason)}`);
    });
    // Dispose every successfully decoded asset if any required asset failed.
    if (this.errors.length) {
      results.forEach(result => { if (result.status === 'fulfilled') result.value.scenes.forEach(disposeScene); });
      throw new Error(this.errors.join('; '));
    }
    const decoded = results.map(result => (result as PromiseFulfilledResult<Awaited<ReturnType<AssetLoader['load']>>>).value);
    const [, fox, , , environment] = decoded;
    for (const [id, index] of [['math-quest', 0], ['memory-match', 2], ['sentence-builder', 3]] as const) {
      const group = this.world.worlds.get(id)!;
      group.children.forEach(disposeScene); group.clear(); group.add(decoded[index].scene);
    }

    // Island 4: word-connect (Đảo Nối Từ) - Celestial Word Link Arch & Twin Obelisk Towers
    const wordConnectScene = decoded[3].scene.clone(true);
    wordConnectScene.name = 'word-connect-scene';
    // Remove the windmill, library building, and giant open books so this island has its own unique architecture
    wordConnectScene.traverse(node => {
      if (node instanceof Mesh && /(library|eaves|roof|quill|door|brass|glazing|book|blossoms)/i.test(node.name || '')) {
        node.visible = false;
      }
    });

    const wordLandmark = new Group(); wordLandmark.name = 'Word connect grand arch landmark';
    const marbleMat = new MeshStandardMaterial({ color: 0xfffcf0, roughness: 0.35, metalness: 0.1 });
    const goldMat = new MeshStandardMaterial({ color: 0xffb703, roughness: 0.25, metalness: 0.5, emissive: 0xff8800, emissiveIntensity: 0.2 });
    const linkRuneMat = new MeshStandardMaterial({ color: 0xffd166, roughness: 0.2, emissive: 0xff9900, emissiveIntensity: 0.7 });
    const coreGemMat = new MeshStandardMaterial({ color: 0xffe66d, roughness: 0.15, emissive: 0xffaa00, emissiveIntensity: 0.9 });
    const autumnBarkMat = new MeshStandardMaterial({ color: 0x5a3825, roughness: 0.9 });
    const autumnLeafMat1 = new MeshStandardMaterial({ color: 0xf77f00, roughness: 0.8 });
    const autumnLeafMat2 = new MeshStandardMaterial({ color: 0xfcbf49, roughness: 0.8 });

    // Twin Grand Obelisk Towers (Left & Right)
    for (const side of [-1.5, 1.5]) {
      const tower = new Group();
      tower.position.set(side, 0, -0.4);
      const base1 = new Mesh(new BoxGeometry(0.85, 0.25, 0.85), marbleMat); base1.position.y = 0.12;
      const base2 = new Mesh(new BoxGeometry(0.7, 0.2, 0.7), marbleMat); base2.position.y = 0.32;
      const shaft = new Mesh(new CylinderGeometry(0.24, 0.28, 2.7, 12), marbleMat); shaft.position.y = 1.68;
      const ring1 = new Mesh(new TorusGeometry(0.27, 0.045, 8, 20), goldMat);
      ring1.rotation.x = Math.PI / 2; ring1.position.y = 1.0;
      const ring2 = new Mesh(new TorusGeometry(0.26, 0.045, 8, 20), goldMat);
      ring2.rotation.x = Math.PI / 2; ring2.position.y = 2.0;
      const cap = new Mesh(new BoxGeometry(0.6, 0.2, 0.6), marbleMat); cap.position.y = 3.05;
      const spire = new Mesh(new ConeGeometry(0.32, 0.85, 8), goldMat); spire.position.y = 3.55;
      tower.add(base1, base2, shaft, ring1, ring2, cap, spire);
      wordLandmark.add(tower);
    }

    // Grand Semicircular Skybridge Arch spanning between the twin towers
    const archCurve = new Mesh(new TorusGeometry(1.5, 0.12, 12, 36, Math.PI), marbleMat);
    archCurve.position.set(0, 1.6, -0.4);
    wordLandmark.add(archCurve);

    const archTrim = new Mesh(new TorusGeometry(1.5, 0.05, 8, 36, Math.PI), goldMat);
    archTrim.position.set(0, 1.6, -0.38);
    wordLandmark.add(archTrim);

    // Hovering Interlocking Chain Link 🔗 at the apex (The universal symbol of Word Connect)
    const linkNexus = new Group();
    linkNexus.position.set(0, 3.1, -0.4);
    const linkRing1 = new Mesh(new TorusGeometry(0.38, 0.075, 12, 28), linkRuneMat);
    const linkRing2 = new Mesh(new TorusGeometry(0.38, 0.075, 12, 28), linkRuneMat);
    linkRing2.rotation.y = Math.PI / 2;
    const coreGem = new Mesh(new IcosahedronGeometry(0.22, 0), coreGemMat);
    linkNexus.add(linkRing1, linkRing2, coreGem);
    wordLandmark.add(linkNexus);

    // Paired Word Connector Tablets on the ground
    for (const [x1, x2, z] of [[-1.0, -0.4, 0.8], [0.4, 1.0, 0.8]] as const) {
      const pad1 = new Mesh(new BoxGeometry(0.42, 0.1, 0.42), marbleMat); pad1.position.set(x1, 0.05, z);
      const pad2 = new Mesh(new BoxGeometry(0.42, 0.1, 0.42), marbleMat); pad2.position.set(x2, 0.05, z);
      const connectorBeam = new Mesh(new BoxGeometry(Math.abs(x2 - x1), 0.04, 0.1), linkRuneMat);
      connectorBeam.position.set((x1 + x2) / 2, 0.07, z);
      wordLandmark.add(pad1, pad2, connectorBeam);
    }

    // Warm Golden Autumn Trees along the rear rim
    for (const [tx, tz, h, mat] of [
      [-2.2, -1.2, 1.3, autumnLeafMat1],
      [-1.8, -2.1, 1.6, autumnLeafMat2],
      [1.8, -2.1, 1.5, autumnLeafMat1],
      [2.2, -1.2, 1.3, autumnLeafMat2],
    ] as const) {
      const tree = new Group(); tree.position.set(tx, 0, tz);
      const trunk = new Mesh(new CylinderGeometry(0.09, 0.16, h, 6), autumnBarkMat);
      trunk.position.y = h / 2;
      const foliage1 = new Mesh(new SphereGeometry(0.55, 7, 6), mat);
      foliage1.position.set(0, h + 0.2, 0);
      const foliage2 = new Mesh(new SphereGeometry(0.4, 6, 5), mat === autumnLeafMat1 ? autumnLeafMat2 : autumnLeafMat1);
      foliage2.position.set(0.15, h + 0.5, -0.1);
      tree.add(trunk, foliage1, foliage2);
      wordLandmark.add(tree);
    }
    wordConnectScene.add(wordLandmark);
    const wcGroup = this.world.worlds.get('word-connect');
    if (wcGroup) { wcGroup.children.forEach(disposeScene); wcGroup.clear(); wcGroup.add(wordConnectScene); }

    // Island 5: sequence-trail (Bậc Thang Quy Luật) - Celestial Logic Ziggurat & Harmonic Monoliths 📶
    const sequenceScene = decoded[0].scene.clone(true);
    sequenceScene.name = 'sequence-trail-scene';
    // Remove the castle, battlements, blue conical roofs, and cottages
    sequenceScene.traverse(node => {
      if (node instanceof Mesh && /(masonry|sculptures|castle|roof|recess|windows|banner|door|coral)/i.test(node.name || '')) {
        node.visible = false;
      }
    });

    const logicLandmark = new Group(); logicLandmark.name = 'Sequence trail ziggurat landmark';
    const stairMarbleMat = new MeshStandardMaterial({ color: 0xf0f8ff, roughness: 0.35, metalness: 0.1 });
    const summitDiamondMat = new MeshStandardMaterial({ color: 0x90e0ef, roughness: 0.15, emissive: 0x00f0ff, emissiveIntensity: 0.85 });
    const orbitRingMat = new MeshStandardMaterial({ color: 0x48cae4, roughness: 0.3, emissive: 0x0077b6, emissiveIntensity: 0.4 });
    const logicPineBark = new MeshStandardMaterial({ color: 0x3d5a80, roughness: 0.9 });
    const logicPineFoliage = new MeshStandardMaterial({ color: 0x0077b6, roughness: 0.7 });

    // Terraced Ascending Ziggurat Staircase (6 Levels climbing from front to apex)
    const tiers = [
      { w: 1.8, d: 1.4, h: 0.22, x: -0.6, y: 0.11, z: 0.7 },
      { w: 1.5, d: 1.2, h: 0.22, x: -0.4, y: 0.33, z: 0.4 },
      { w: 1.3, d: 1.0, h: 0.22, x: -0.2, y: 0.55, z: 0.1 },
      { w: 1.1, d: 0.9, h: 0.22, x: 0.0, y: 0.77, z: -0.2 },
      { w: 0.9, d: 0.8, h: 0.22, x: 0.2, y: 0.99, z: -0.5 },
      { w: 0.7, d: 0.7, h: 0.22, x: 0.4, y: 1.21, z: -0.8 },
    ];
    tiers.forEach((t, i) => {
      const stepMesh = new Mesh(new BoxGeometry(t.w, t.h, t.d), stairMarbleMat);
      stepMesh.position.set(t.x, t.y, t.z);
      const edgeStrip = new Mesh(new BoxGeometry(t.w + 0.04, 0.05, 0.08),
        new MeshStandardMaterial({ color: 0x00b4d8, emissive: 0x0077b6, emissiveIntensity: 0.3 + i * 0.1 }));
      edgeStrip.position.set(t.x, t.y + t.h / 2, t.z + t.d / 2);
      logicLandmark.add(stepMesh, edgeStrip);
    });

    // 5 Ascending Spectral Crystal Monoliths (📶 1, 2, 3, 4, 5)
    const monolithData = [
      { h: 0.9, x: -1.4, z: 0.7, color: 0x48cae4, emissive: 0x00b4d8 }, // 1: Aqua
      { h: 1.35, x: -1.1, z: 0.2, color: 0x00b4d8, emissive: 0x0096c7 }, // 2: Cyan
      { h: 1.85, x: -0.8, z: -0.3, color: 0x0096c7, emissive: 0x0077b6 }, // 3: Ocean
      { h: 2.35, x: -0.4, z: -0.8, color: 0x0077b6, emissive: 0x023e8a }, // 4: Cobalt
      { h: 2.9, x: 0.0, z: -1.3, color: 0x023e8a, emissive: 0x0077b6 },  // 5: Sapphire
    ];
    monolithData.forEach(m => {
      const pillarGroup = new Group();
      pillarGroup.position.set(m.x, 0, m.z);
      const mat = new MeshStandardMaterial({ color: m.color, roughness: 0.2, emissive: m.emissive, emissiveIntensity: 0.45 });
      const shaft = new Mesh(new CylinderGeometry(0.16, 0.2, m.h, 6), mat);
      shaft.position.y = m.h / 2;
      const cap = new Mesh(new ConeGeometry(0.2, 0.4, 6), mat);
      cap.position.y = m.h + 0.2;
      const ring = new Mesh(new TorusGeometry(0.25, 0.035, 8, 20),
        new MeshStandardMaterial({ color: 0xffffff, emissive: m.color, emissiveIntensity: 0.8 }));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = m.h * 0.75;
      pillarGroup.add(shaft, cap, ring);
      logicLandmark.add(pillarGroup);
    });

    // Summit Hovering Logic Diamond Star above Apex
    const summitGroup = new Group();
    summitGroup.position.set(0.4, 2.1, -0.8);
    const diamond = new Mesh(new IcosahedronGeometry(0.36, 0), summitDiamondMat);
    const orbitRing1 = new Mesh(new TorusGeometry(0.55, 0.04, 8, 32), orbitRingMat);
    orbitRing1.rotation.x = Math.PI / 3;
    const orbitRing2 = new Mesh(new TorusGeometry(0.55, 0.04, 8, 32), orbitRingMat);
    orbitRing2.rotation.y = Math.PI / 3;
    summitGroup.add(diamond, orbitRing1, orbitRing2);
    logicLandmark.add(summitGroup);

    // Crystalline Blue Fir Trees on peripheral edge
    for (const [px, pz] of [[1.5, -0.3], [1.7, 0.6], [1.2, 1.2], [-1.7, -1.0]] as const) {
      const pine = new Group(); pine.position.set(px, 0, pz);
      const trunk = new Mesh(new CylinderGeometry(0.08, 0.12, 0.8, 6), logicPineBark);
      trunk.position.y = 0.4;
      const c1 = new Mesh(new ConeGeometry(0.65, 0.8, 6), logicPineFoliage); c1.position.y = 0.9;
      const c2 = new Mesh(new ConeGeometry(0.48, 0.7, 6), logicPineFoliage); c2.position.y = 1.35;
      const c3 = new Mesh(new ConeGeometry(0.32, 0.6, 6), logicPineFoliage); c3.position.y = 1.75;
      pine.add(trunk, c1, c2, c3);
      logicLandmark.add(pine);
    }
    sequenceScene.add(logicLandmark);
    const stGroup = this.world.worlds.get('sequence-trail');
    if (stGroup) { stGroup.children.forEach(disposeScene); stGroup.clear(); stGroup.add(sequenceScene); }

    // Cloud geometry is part of the same authored environment; moving its nodes
    // into an existing group allows subtle motion without rotating the landscape.
    this.world.scenery.add(environment.scene);
    const clouds: Object3D[] = [];
    environment.scene.traverse(node => {
      const mesh = node as Mesh;
      if (!mesh.isMesh) return;
      mesh.userData.noShadow = true;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      if (materials.some(material => material.userData.baoAnRole === 'cloud')) clouds.push(mesh);
    });
    clouds.forEach(node => this.world.clouds.add(node));
    fox.scene.position.set(0, 0, 0); fox.scene.scale.setScalar(.9);
    this.guideBounds.setFromObject(fox.scene);
    this.guideAnchor.add(fox.scene); this.world.scene.add(this.guideAnchor);
    // Adopt every decoded scene before a later validation can throw; disposal
    // then reaches all resources, including assets not used by that validation.
    for (const [id, index] of [['math-quest', 0], ['memory-match', 2], ['sentence-builder', 3]] as const) {
      const { missing } = this.gameEnvironments.applyWorldMaterials(id, decoded[index].scene);
      if (missing.length) throw new Error(`${id}: missing foreground materials ${missing.map(item => item.name).join(', ')}`);
    }
    this.gameEnvironments.applyWorldMaterials('word-connect', wordConnectScene);
    this.gameEnvironments.applyWorldMaterials('sequence-trail', sequenceScene);
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
    // Compile both lighting variants asynchronously while DOM gameplay remains
    // available. The first quality change then reuses linked shader programs.
    const shaderStarted = performance.now();
    this.parallelShaderCompile = this.renderer.extensions.has('KHR_parallel_shader_compile');
    for (const shadows of [false, true]) {
      this.renderer.shadowMap.enabled = shadows;
      this.world.sunlight.castShadow = shadows;
      await this.renderer.compileAsync(this.world.scene, this.camera);
      this.controller.signal.throwIfAborted();
    }
    this.shaderPreparationMs = performance.now() - shaderStarted;
    this.renderer.shadowMap.enabled = QUALITY[this.quality.tier].shadows;
    this.world.sunlight.castShadow = QUALITY[this.quality.tier].shadows;
    this.readyAssets = catalog;
    this.textureBytes = estimateTextureBytes(this.world.scene);
    this.initialized = true;
    this.resize();
    this.invalidate();
    // The first rendered frame queues optional LOD work if low detail is needed.
  }
  private queueLod() {
    if (this.disposed || this.paused || !this.hasDrawn || this.lodState !== 'idle' || this.lodTimer) return;
    this.lodTimer = window.setTimeout(() => {
      this.lodTimer = 0;
      if (!this.disposed && !this.paused) void this.prepareLod();
    }, 0);
  }
  private async prepareLod() {
    if (this.lodState !== 'idle' || this.disposed) return;
    this.lodState = 'preparing';
    try {
      const { createGeometryLod } = await import('../scenes/geometryLod');
      if (this.disposed) return;
      const lod = await createGeometryLod([...this.world.worlds.values(),
        this.world.scenery, this.world.clouds], this.controller.signal);
      if (this.disposed) { lod.disposeOwnedGeometries(); return; }
      this.lod = lod;
      this.lodState = lod.stats.simplifiedGeometries > 0 ? 'ready' : 'unavailable';
      lod.setEnabled(this.quality.tier === 'low');
      this.shadowUpdates.request(); this.publishDiagnostics(); this.invalidate();
    } catch (error) {
      if (this.disposed || this.controller.signal.aborted) return;
      // Detail optimization is optional; the decoded originals stay usable.
      this.lodState = 'unavailable'; this.lodError = String(error);
      this.publishDiagnostics();
    }
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
    this.lod?.setEnabled(this.quality.tier === 'low');
    if (this.initialized && this.quality.tier === 'low') this.queueLod();
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
      this.world.clouds.position.x = Math.sin(now * .00006) * .16;
      if (!this.gameWorld && !this.carousel.selected && !this.carousel.moving && this.world.worlds.size > 3) {
        let idx = 0;
        for (const [, root] of this.world.worlds) {
          root.position.y = Math.sin(now * 0.0018 + idx * 1.26) * 0.06;
          idx++;
        }
      }
      if (this.quality.observe(frameMs, now)) this.applyQuality();
    }
    this.camera.lookAt(this.target);
    this.renderer.shadowMap.needsUpdate = this.shadowUpdates.shouldUpdate(now,
      this.quality.tier, !!this.gameWorld, this.motion);
    this.renderer.render(this.world.scene, this.camera);
    this.hasDrawn = true;
    if (this.quality.tier === 'low') this.queueLod();
    if (!this.motion || now - this.lastStats > 1000) {
      this.lastStats = now;
      this.opts.canvas.dataset.diagnostics = JSON.stringify(this.getDiagnostics());
    }
    if (this.motion) this.invalidate();
  };
  focusOn(id: WorldId | null) {
    if (this.gameWorld) return;
    if (!this.carousel.select(id, this.motion)) return;
    this.shadowUpdates.request();
    if (this.motion) this.mascot?.play('Cheer');
    this.invalidate();
  }
  setPaused(paused: boolean) {
    this.paused = paused;
    cancelAnimationFrame(this.raf); this.raf = 0;
    this.lastTime = 0; this.metrics.resetClock();
    this.publishDiagnostics();
    if (!paused) { this.shadowUpdates.request(); this.invalidate(); }
  }
  setMotion(enabled: boolean) {
    this.motion = enabled; this.lastTime = 0; this.metrics.resetClock();
    this.shadowUpdates.request();
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
      this.gameEnvironments.setWorld(id);
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
      geometryDetail: this.quality.tier === 'low' && this.lodState === 'ready' ? 'reduced' : 'full',
      lodState: this.lodState, lodError: this.lodError,
      lodMasterTriangles: this.lod?.stats.sourceTriangles,
      lodReducedTriangles: this.lod?.stats.lowTriangles,
      lodMeshes: this.lod?.stats.simplifiedGeometries,
      lodPreparationMs: this.lod?.stats.preparationMs,
      lodCpuPreparationMs: this.lod?.stats.cpuPreparationMs,
      lodMaxMeshPreparationMs: this.lod?.stats.maxMeshPreparationMs,
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
    window.clearTimeout(this.lodTimer); this.lodTimer = 0;
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
    this.lod?.disposeOwnedGeometries(); this.lod = undefined;
    this.gameEnvironments.dispose();
    disposeScene(this.world.scene);
    this.renderer?.dispose(); this.renderer?.forceContextLoss();
  }
}

export async function createPremiumRenderer(options: RendererInitOptions): Promise<WorldRenderer> {
  const renderer = new PremiumWorldRenderer(options);
  try { await renderer.initialize(); return renderer; }
  catch (error) { renderer.dispose(); throw error; }
}
