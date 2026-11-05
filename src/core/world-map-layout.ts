import type { MapRegionId } from './world-map-contracts';

export interface PointPercent {
  x: number; // percentage 0 - 100
  y: number; // percentage 0 - 100
}

export interface RegionAnchorConfig {
  wide: PointPercent;
  tall: PointPercent;
}

export const WORLD_MAP_ANCHORS: Record<MapRegionId | 'center', RegionAnchorConfig> = {
  math: {
    wide: { x: 24, y: 27 },
    tall: { x: 27, y: 24 },
  },
  vietnamese: {
    wide: { x: 75, y: 27 },
    tall: { x: 73, y: 24 },
  },
  center: {
    wide: { x: 50, y: 50 },
    tall: { x: 50, y: 46 },
  },
  english: {
    wide: { x: 24, y: 73 },
    tall: { x: 27, y: 70 },
  },
  computing: {
    wide: { x: 75, y: 73 },
    tall: { x: 73, y: 70 },
  },
  discovery: {
    wide: { x: 50, y: 50 },
    tall: { x: 50, y: 46 },
  },
};

export const REGION_SLOT_ANCHORS: Record<number, RegionAnchorConfig> = {
  1: {
    wide: { x: 12, y: 72 },
    tall: { x: 26, y: 82 },
  },
  2: {
    wide: { x: 24, y: 50 },
    tall: { x: 67, y: 72 },
  },
  3: {
    wide: { x: 38, y: 70 },
    tall: { x: 30, y: 60 },
  },
  4: {
    wide: { x: 50, y: 44 },
    tall: { x: 68, y: 49 },
  },
  5: {
    wide: { x: 63, y: 66 },
    tall: { x: 31, y: 37 },
  },
  6: {
    wide: { x: 77, y: 40 },
    tall: { x: 69, y: 25 },
  },
  7: {
    wide: { x: 89, y: 62 },
    tall: { x: 45, y: 13 },
  },
};

export const REGION_CUSTOM_SLOT_ANCHORS: Partial<Record<MapRegionId, Record<number, RegionAnchorConfig>>> = {
  math: REGION_SLOT_ANCHORS,
  vietnamese: REGION_SLOT_ANCHORS,
  english: REGION_SLOT_ANCHORS,
  computing: REGION_SLOT_ANCHORS,
  discovery: REGION_SLOT_ANCHORS,
};

export function getRegionSlotConfig(slot: number, regionId?: MapRegionId): RegionAnchorConfig {
  if (regionId && REGION_CUSTOM_SLOT_ANCHORS[regionId]?.[slot]) {
    return REGION_CUSTOM_SLOT_ANCHORS[regionId]![slot];
  }
  return REGION_SLOT_ANCHORS[slot] || REGION_SLOT_ANCHORS[1];
}

export function getRegionSlotAnchor(slot: number, isTall: boolean, regionId?: MapRegionId): PointPercent {
  const config = getRegionSlotConfig(slot, regionId);
  return isTall ? config.tall : config.wide;
}

export function getWorldRegionAnchor(regionId: MapRegionId | 'center', isTall: boolean): PointPercent {
  const config = WORLD_MAP_ANCHORS[regionId] || WORLD_MAP_ANCHORS.center;
  return isTall ? config.tall : config.wide;
}
