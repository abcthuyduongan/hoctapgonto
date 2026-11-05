import type {
  MaterialBalances,
  MaterialCost,
  MaterialType,
  PlacedBuilding,
} from './town-contracts.ts';
import {
  SUBJECT_MATERIAL_MAP,
  TOWN_BUILDING_MAP,
} from './town-contracts.ts';
import { resolveRegionId } from './world-map-regions.ts';

/**
 * Maps subject identifier or Vietnamese subject label to one of the 4 primary subjects.
 */
export function resolveTownSubject(subjectOrLabel: string | null | undefined): 'math' | 'vietnamese' | 'english' | 'computing' {
  const region = resolveRegionId(subjectOrLabel);
  if (region === 'discovery') {
    // Check raw substring fallback
    const raw = (subjectOrLabel || '').toLowerCase();
    if (raw.includes('toan') || raw.includes('math')) return 'math';
    if (raw.includes('viet')) return 'vietnamese';
    if (raw.includes('anh') || raw.includes('english')) return 'english';
    if (raw.includes('tin') || raw.includes('computing') || raw.includes('cong nghe')) return 'computing';
    return 'math'; // Default fallback
  }
  return region;
}

/**
 * Returns the material associated with a subject:
 * Math -> stone (Đá)
 * Vietnamese -> wood (Gỗ)
 * English -> fish (Cá)
 * Computing -> component (Linh kiện)
 */
export function getMaterialForSubject(subjectOrLabel: string | null | undefined): MaterialType {
  const subject = resolveTownSubject(subjectOrLabel);
  return SUBJECT_MATERIAL_MAP[subject] || 'stone';
}

/**
 * Pure calculation of total materials earned strictly from awards.
 * Each star gained in Math = 1 stone.
 * Each star gained in Vietnamese = 1 wood.
 * Each star gained in English = 1 fish.
 * Each star gained in Computing = 1 component.
 */
export function calculateEarnedMaterialsFromAwards(
  awards: readonly any[],
  packSubjectResolver: (packId: string) => string | null | undefined
): MaterialBalances {
  const totals: MaterialBalances = {
    stone: 0,
    wood: 0,
    fish: 0,
    component: 0,
  };

  for (const award of awards) {
    const packId = award.packId || award.pack_id;
    if (!packId) continue;

    // Stars earned for this pack (max 3)
    const stars = Number(award.questionLedger?.earnedStars ?? award.starTier ?? award.tier ?? 0);
    if (stars <= 0) continue;

    const subject = packSubjectResolver(packId);
    const material = getMaterialForSubject(subject);
    totals[material] += stars;
  }

  return totals;
}

/**
 * Sums the total materials spent across all placed buildings.
 */
export function calculateTotalSpentMaterials(buildings: readonly PlacedBuilding[]): MaterialBalances {
  const spent: MaterialBalances = {
    stone: 0,
    wood: 0,
    fish: 0,
    component: 0,
  };

  for (const placed of buildings) {
    const catalogItem = TOWN_BUILDING_MAP.get(placed.buildingId);
    if (!catalogItem) continue;

    const cost = catalogItem.cost;
    if (cost.stone) spent.stone += cost.stone;
    if (cost.wood) spent.wood += cost.wood;
    if (cost.fish) spent.fish += cost.fish;
    if (cost.component) spent.component += cost.component;
  }

  return spent;
}

/**
 * Calculates current available material balance: (earned - spent).
 */
export function calculateAvailableMaterials(
  earned: MaterialBalances,
  spent: MaterialBalances
): MaterialBalances {
  return {
    stone: Math.max(0, earned.stone - spent.stone),
    wood: Math.max(0, earned.wood - spent.wood),
    fish: Math.max(0, earned.fish - spent.fish),
    component: Math.max(0, earned.component - spent.component),
  };
}

/**
 * Checks if the student has sufficient materials to build a catalog item.
 */
export function canAffordBuilding(available: MaterialBalances, cost: MaterialCost): boolean {
  if (cost.stone && available.stone < cost.stone) return false;
  if (cost.wood && available.wood < cost.wood) return false;
  if (cost.fish && available.fish < cost.fish) return false;
  if (cost.component && available.component < cost.component) return false;
  return true;
}

/**
 * Deducts building cost from available materials.
 */
export function deductBuildingCost(available: MaterialBalances, cost: MaterialCost): MaterialBalances {
  return {
    stone: available.stone - (cost.stone || 0),
    wood: available.wood - (cost.wood || 0),
    fish: available.fish - (cost.fish || 0),
    component: available.component - (cost.component || 0),
  };
}
