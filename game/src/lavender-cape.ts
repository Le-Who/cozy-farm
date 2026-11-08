import type { Occluder } from './occlusion';

// Bounds and anchors use the generated plate's native pixels before world placement.
export const lavenderCapePlate = {
  path: 'lavender/cape-plate',
  bounds: { x: 0, y: 0, w: 1586, h: 992 },
};

export const lavenderCapeAnchors = {
  flowers: [{ x: 514, y: 477 }, { x: 779, y: 477 }, { x: 1040, y: 477 }],
  hive: { x: 1242, y: 284 },
  hiveStop: { x: 1204, y: 406 },
  dockEntry: { x: 391, y: 694 },
  dockStop: { x: 391, y: 819 },
  boat: { x: 561, y: 887 },
  shoreMinY: 290,
} as const;

// The hive sits against the planted back border, beyond the walkable meadow.
export const lavenderCapeOccluders: readonly Occluder[] = [];
