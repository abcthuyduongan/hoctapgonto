import type { WorldId } from '../engine';
import { neutralSlots } from './islandCarousel.ts';

/** Add future landmarks here; carousel spacing and angles use this list's length. */
export const WORLD_ISLANDS: readonly { id: WorldId; tint: number; landing: readonly [number, number, number] }[] = [
  { id: 'math-quest', tint: 0x76cbd1, landing: [-1.14, .04, 1.12] },
  { id: 'memory-match', tint: 0x79c994, landing: [-.95, .04, 1.25] },
  { id: 'sentence-builder', tint: 0xd8b57b, landing: [.95, .04, 1.05] },
];
export const WORLD_IDS = WORLD_ISLANDS.map(island => island.id);
export function carouselLayout(mobile: boolean, count = WORLD_ISLANDS.length) {
  const radius = Math.max(4.6, count * 4.5 / (Math.PI * 2));
  const orbitScale = mobile ? .7 : .88;
  const frontScale = mobile ? 1.04 : 1.18;
  // Grow both axes with count, including clearance for the promoted island.
  const clearanceRadius = count > 1 ? 2.25 * (frontScale + orbitScale) / (2 * Math.sin(Math.PI / count)) : 0;
  return {
    spacing: mobile ? 3.35 : 4.6,
    neutralScale: mobile ? .73 : 1,
    orbitScale, frontScale,
    radiusX: Math.max(mobile ? radius * .66 : radius, clearanceRadius),
    radiusZ: Math.max(mobile ? 2.65 : 3.4, clearanceRadius),
    centerZ: -1.1,
    // A separate foreground perch at the left leaves the island row unobstructed.
    waiting: { x: mobile ? -3.7 : -7.4, y: .12, z: mobile ? 4.2 : 4.8 },
    jumpHeight: mobile ? 1.7 : 2.1,
    transitionSeconds: 1.05,
  };
}
const initial = neutralSlots(WORLD_IDS, carouselLayout(false).spacing, 0, -1, 1);
export const WORLD_LAYOUT = Object.fromEntries(WORLD_ISLANDS.map(island => [island.id,
  { ...initial[island.id], tint: island.tint },
])) as Record<WorldId, typeof initial[WorldId] & { tint: number }>;
