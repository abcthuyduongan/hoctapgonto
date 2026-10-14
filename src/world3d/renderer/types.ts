import type { WorldId } from '../engine';

export type RenderTier = 'low' | 'balanced' | 'high';
export type QualityChoice = RenderTier | 'auto';
export interface RenderStats {
  engine: 'three-webgl' | 'legacy-webgl2' | 'canvas';
  fpsMedian?: number;
  fpsEstimate?: number;
  fpsP95FrameMs?: number;
  drawCalls?: number;
  triangles?: number;
  textureBytesEstimate?: number;
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
}
export interface WorldRenderer {
  focusOn(id: WorldId | null): void;
  setPaused(paused: boolean): void;
  setMotion(enabled: boolean): void;
  setQuality(tier: RenderTier): void;
  setQualityChoice?(choice: QualityChoice): void;
  getDiagnostics(): RenderStats;
  dispose(): void;
}
export interface RendererInitOptions {
  canvas: HTMLCanvasElement;
  onSelect: (id: WorldId) => void;
  motionOn: boolean;
  paused: boolean;
  quality: QualityChoice;
  signal: AbortSignal;
  onContextLost: () => void;
}
