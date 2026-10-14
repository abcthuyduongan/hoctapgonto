/** Shared carousel geometry; renderer-independent so any number of islands can join. */
export interface IslandPose {
  x: number;
  y: number;
  z: number;
  scale: number;
}

const TAU = Math.PI * 2;

/** A neutral entrance gives every island the same height, depth, and size. */
export function neutralSlots<T extends string>(
  ids: readonly T[], spacing: number, y = 0, z = 0, scale = 1,
): Record<T, IslandPose> {
  const middle = (ids.length - 1) / 2;
  return Object.fromEntries(ids.map((id, index) => [id, {
    x: (index - middle) * spacing, y, z, scale,
  }])) as Record<T, IslandPose>;
}

/** Angle zero is the front of the orbit, toward the camera at positive z. */
export function orbitSlots<T extends string>(
  ids: readonly T[], rotation: number, radiusX: number, radiusZ: number,
  centerZ = 0, scale = 1, y = 0,
): Record<T, IslandPose> {
  return Object.fromEntries(ids.map((id, index) => {
    const angle = index * TAU / ids.length + rotation;
    return [id, {
      x: Math.sin(angle) * radiusX,
      y,
      z: centerZ + Math.cos(angle) * radiusZ,
      scale,
    }];
  })) as Record<T, IslandPose>;
}

/** Keep rotation unwrapped so retargeting always follows the shortest arc. */
export function targetRotationForIndex(index: number, count: number, currentRotation = 0): number {
  if (count === 0) return currentRotation;
  if (!Number.isInteger(count) || count < 0 || !Number.isInteger(index) || index < 0 || index >= count) {
    throw new RangeError('Island index must belong to a non-negative integer island count.');
  }
  const delta = -index * TAU / count - currentRotation;
  const shortestDelta = ((delta + Math.PI) % TAU + TAU) % TAU - Math.PI;
  return currentRotation + shortestDelta;
}

/** Clamped ease-in/out shared by the entrance transition and guide jump. */
export function smoothStep(progress: number): number {
  const t = Math.max(0, Math.min(1, progress));
  return t * t * (3 - 2 * t);
}

/** Start from the actual current pose when a transition is interrupted. */
export function blendPose(from: IslandPose, to: IslandPose, progress: number): IslandPose {
  const t = smoothStep(progress);
  if (t === 0) return { ...from };
  if (t === 1) return { ...to };
  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
    z: from.z + (to.z - from.z) * t,
    scale: from.scale + (to.scale - from.scale) * t,
  };
}
