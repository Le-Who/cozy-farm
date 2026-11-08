import type { Occluder } from './occlusion';

const asset = (name: string) => `${import.meta.env.BASE_URL}art/lavender/${name}.webp`;

// Bounds and anchors use the edited plate's native pixels before world placement.
export const lavenderGrovePlate = {
  path: 'lavender/grove-plate',
  bounds: { x: 0, y: 0, w: 1585, h: 992 },
};
export const lavenderShoalPlate = {
  path: 'lavender/grove-shoal-plate',
  bounds: { x: 0, y: 0, w: 1740, h: 992 },
};

export const lavenderGroveAnchors = {
  treeSpots: [{ x: 776, y: 438 }, { x: 511, y: 464 }, { x: 1044, y: 464 }],
  mooring: { x: 358, y: 747, boatX: 542, boatY: 923 },
  dockEntry: { x: 363, y: 704 },
  fishingStop: { x: 355, y: 846 },
  fishingFloat: { x: 264, y: 907 },
  saltCove: { x: 1391, y: 691 },
  saltStop: { x: 1226, y: 675 },
  shellSpots: [{ x: 1155, y: 740 }, { x: 1270, y: 762 }, { x: 1365, y: 745 }],
  crab: { x: 1195, y: 716 },
  shoal: {
    entry: { x: 1350, y: 760 },
    path: [{ x: 1460, y: 828 }, { x: 1550, y: 876 }],
    glass: { x: 1450, y: 824 },
    pearl: { x: 1596, y: 876 },
    starfish: { x: 1619, y: 920 },
    look: { x: 1590, y: 879 },
    pools: [{ x: 1510, y: 794 }, { x: 1642, y: 902 }],
  },
  shoreMinY: 285,
};

export const lavenderGroveOccluders: readonly Occluder[] = [
  { url: asset('grove-occluder-left-tree'), x: 119, y: 88, w: 234, h: 249, footY: 333 },
  { url: asset('grove-occluder-inner-left-tree'), x: 411, y: 14, w: 225, h: 230, footY: 242 },
  { url: asset('grove-occluder-inner-right-tree'), x: 807, y: 14, w: 241, h: 233, footY: 245 },
  { url: asset('grove-occluder-right-tree'), x: 1149, y: 88, w: 243, h: 254, footY: 339 },
  { url: asset('grove-occluder-center-rocks'), x: 646, y: 664, w: 172, h: 92, footY: 751 },
];
