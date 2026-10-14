import type { WorldId } from '../engine';

export const WORLD_LAYOUT: Record<WorldId, { x: number; y: number; z: number; scale: number; tint: number }> = {
  'math-quest': { x: -3.25, y: .05, z: 1.5, scale: 1.25, tint: 0x76cbd1 },
  'memory-match': { x: 1.3, y: .45, z: -2.8, scale: .9, tint: 0x79c994 },
  'sentence-builder': { x: 5, y: .7, z: -4.5, scale: .8, tint: 0xd8b57b },
};
export const MOBILE_WORLD_LAYOUT: typeof WORLD_LAYOUT = {
  'math-quest': { ...WORLD_LAYOUT['math-quest'], x: -1.4, y: 0, z: 1.6, scale: 1.15 },
  'memory-match': { ...WORLD_LAYOUT['memory-match'], x: 1.45, y: .35, z: -4, scale: .78 },
  'sentence-builder': { ...WORLD_LAYOUT['sentence-builder'], x: 3.65, y: .55, z: -7.2, scale: .72 },
};
/** Local coordinates on Math's grass; follows the same responsive transform. */
export const MASCOT_POSITION = [-1.14, .04, 1.12] as const;
