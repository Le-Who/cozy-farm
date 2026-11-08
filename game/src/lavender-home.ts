import type { Occluder } from './occlusion';
import type { BuildingId, ProjectId } from './farm';

const asset = (name: string) => `${import.meta.env.BASE_URL}art/lavender/${name}.webp`;

export const lavenderHomePlate = { x: 0, y: 0, w: 1586, h: 992 } as const;

export const lavenderHomeBoat = { x: 544, y: 869, w: 160, h: 87, footY: 956 } as const;

export const lavenderHomeSails = {
  x: 816, y: 79, w: 178, h: 177, pivotX: 905.9, pivotY: 167.6, footY: 310,
} as const;

// Cutouts use the same pixel coordinates and source colors as the Home plate.
export const lavenderHomeOccluders: readonly (Occluder & { building?: BuildingId; project?: ProjectId })[] = [
  { url: asset('home-occluder-farmhouse'), x: 203, y: 66, w: 301, h: 320, footY: 382, building: 'farmhouse' },
  { url: asset('home-occluder-well'), x: 619, y: 157, w: 139, h: 191, footY: 345, building: 'well' },
  { url: asset('home-occluder-mill'), x: 816, y: 41, w: 178, h: 272, footY: 309 },
  { url: asset('home-occluder-market'), x: 1082, y: 178, w: 324, h: 211, footY: 386, project: 'fair' },
  { url: asset('home-occluder-coop'), x: 193, y: 403, w: 181, h: 215, footY: 614, building: 'coop' },
  { url: asset('home-occluder-pen-front'), x: 135, y: 663, w: 253, h: 85, footY: 744 },
  { url: asset('home-occluder-pen-gate'), x: 373, y: 643, w: 62, h: 91, footY: 731 },
  { url: asset('home-occluder-pen-left-side'), x: 142, y: 492, w: 46, h: 188, footY: 677 },
  { url: asset('home-occluder-pen-right-side'), x: 380, y: 492, w: 46, h: 171, footY: 660 },
  { url: asset('home-occluder-pen-back'), x: 176, y: 504, w: 217, h: 44, footY: 545 },
  { url: asset('home-occluder-dock-rails'), x: 390, y: 744, w: 154, h: 189, footY: 930 },
];
