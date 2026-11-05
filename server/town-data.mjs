import { OnlineError, fail } from './online-errors.mjs';
import {
  TOWN_BUILDING_CATALOG,
  TOWN_BUILDING_MAP,
} from '../src/core/town-contracts.ts';
import {
  calculateEarnedMaterialsFromAwards,
  calculateTotalSpentMaterials,
  calculateAvailableMaterials,
  canAffordBuilding,
  getMaterialForSubject,
  resolveTownSubject,
} from '../src/core/town-materials.ts';

const parse = (value) => (typeof value === 'string' ? JSON.parse(value) : (value ?? {}));
const json = (value) => JSON.stringify(value);

export {
  TOWN_BUILDING_CATALOG,
  TOWN_BUILDING_MAP,
  resolveTownSubject,
  getMaterialForSubject,
  calculateEarnedMaterialsFromAwards,
  calculateTotalSpentMaterials,
  calculateAvailableMaterials,
  canAffordBuilding,
};

/**
 * Creates default initial town state for a student
 */
export function defaultTownState(studentId, nowIso) {
  return {
    gridWidth: 10,
    gridHeight: 10,
    revision: 1,
    buildings: [],
    updatedAt: nowIso,
  };
}

/**
 * Validates placement and returns updated town state and deductions.
 * Throws with HTTP-equivalent status code or message if invalid.
 */
export function evaluateBuildingPlacement({
  currentTownState,
  buildingId,
  x,
  y,
  expectedRevision,
  availableMaterials,
  nowIso,
  placementId,
}) {
  const catalogItem = TOWN_BUILDING_MAP.get(buildingId);
  if (!catalogItem) {
    throw new OnlineError(400, 'Mã công trình không hợp lệ.');
  }

  const ix = Number(x);
  const iy = Number(y);
  if (!Number.isInteger(ix) || !Number.isInteger(iy) || ix < 0 || ix >= 10 || iy < 0 || iy >= 10) {
    throw new OnlineError(400, 'Tọa độ công trình không hợp lệ (lưới 10 × 10 từ 0 đến 9).');
  }

  // Optimistic concurrency check: revision must match
  if (expectedRevision !== undefined && Number(expectedRevision) !== Number(currentTownState.revision)) {
    const error = new OnlineError(409, 'Thị trấn đã được cập nhật từ thiết bị khác. Vui lòng tải lại trang.');
    error.code = 'REVISION_CONFLICT';
    error.currentRevision = currentTownState.revision;
    throw error;
  }

  // Cell collision check
  const existing = (currentTownState.buildings || []).find((b) => b.x === ix && b.y === iy);
  if (existing) {
    throw new OnlineError(400, 'Vị trí này đã có công trình khác.');
  }

  // Material sufficiency check
  if (!canAffordBuilding(availableMaterials, catalogItem.cost)) {
    throw new OnlineError(400, 'Không đủ vật liệu để xây công trình này.');
  }

  const newBuilding = {
    id: placementId,
    buildingId,
    x: ix,
    y: iy,
    placedAt: nowIso,
  };

  const updatedTownState = {
    gridWidth: currentTownState.gridWidth || 10,
    gridHeight: currentTownState.gridHeight || 10,
    revision: Number(currentTownState.revision || 1) + 1,
    buildings: [...(currentTownState.buildings || []), newBuilding],
    updatedAt: nowIso,
  };

  return {
    updatedTownState,
    placedBuilding: newBuilding,
    cost: catalogItem.cost,
  };
}
