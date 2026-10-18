import type { WorldId } from '../engine';

export type RenderTier = 'low' | 'balanced' | 'high';
export type QualityChoice = RenderTier | 'auto';
export type GuideMood = 'idle' | 'happy' | 'encourage' | 'victory';
/** Pixel coordinates relative to the single world canvas. */
export interface GuideViewport { x: number; y: number; width: number; height: number }
export interface RenderStats {
  engine: 'three-webgl' | 'legacy-webgl2' | 'canvas';
  fpsMedian?: number;
  fpsEstimate?: number;
  fpsP95FrameMs?: number;
  drawCalls?: number;
  triangles?: number;
  textureBytesEstimate?: number;
  geometryBytesEstimate?: number;
  activeAssetBytes?: number;
  renderPending?: boolean;
  gpuGeometries?: number;
  gpuTextures?: number;
  gpuPrograms?: number;
  shaderPreparationMs?: number;
  parallelShaderCompile?: boolean;
  shadowUpdates?: number;
  geometryDetail?: 'full' | 'reduced';
  lodState?: 'idle' | 'preparing' | 'ready' | 'unavailable';
  lodError?: string;
  lodMasterTriangles?: number;
  lodReducedTriangles?: number;
  lodMeshes?: number;
  lodPreparationMs?: number;
  lodCpuPreparationMs?: number;
  lodMaxMeshPreparationMs?: number;
  tier?: RenderTier;
  dpr?: number;
  frames?: number;
  assetErrors?: string[];
  animationClips?: string[];
  activeClip?: string;
  motion?: boolean;
  paused?: boolean;
  readyAssets?: string[];
  skeletalMeshes?: number;
  bones?: number;
  animationTime?: number;
  selectedWorld?: WorldId | null;
  carouselMoving?: boolean;
  rotation?: number;
  islands?: { id: WorldId; x: number; y: number; z: number; scale: number }[];
  mascotLocation?: 'waiting' | WorldId;
  mascotState?: 'waiting' | 'jumping' | 'on-island';
  mascotPosition?: { x: number; y: number; z: number };
  jumpProgress?: number;
  sceneMode?: 'home' | 'game';
  gameWorld?: WorldId | null;
  guideMood?: GuideMood;
  guideCue?: number;
  guideViewport?: GuideViewport | null;
  guideVisible?: boolean;
}
export interface WorldRenderer {
  focusOn(id: WorldId | null): void;
  setPaused(paused: boolean): void;
  setMotion(enabled: boolean): void;
  setQuality(tier: RenderTier): void;
  setQualityChoice?(choice: QualityChoice): void;
  setGameScene?(id: WorldId | null): void;
  setGuideMood?(mood: GuideMood, cue?: number): void;
  setGuideViewport?(box: GuideViewport | null): void;
  getDiagnostics(): RenderStats;
  dispose(): void;
}
export interface RendererInitOptions {
  canvas: HTMLCanvasElement;
  onSelect: (id: WorldId) => void;
  /** A second activation after the guide arrives can enter the selected game. */
  onEnterWorld?: (id: WorldId) => void;
  motionOn: boolean;
  paused: boolean;
  quality: QualityChoice;
  signal: AbortSignal;
  onContextLost: () => void;
}
