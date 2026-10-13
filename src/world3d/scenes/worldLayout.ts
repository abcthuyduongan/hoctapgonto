import type { WorldId } from '../engine';

export const WORLD_LAYOUT: Record<WorldId, { x: number; z: number; tint: number }> = {
  'math-quest': { x: -4.8, z: 0, tint: 0x76cbd1 },
  'memory-match': { x: 0, z: -.8, tint: 0x79c994 },
  'sentence-builder': { x: 4.8, z: 0, tint: 0xd8b57b },
};
export const MASCOT_POSITION = [-6, 0, 1.1] as const;
