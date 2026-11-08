import { lavenderHomeBoat, lavenderHomeOccluders, lavenderHomePlate, lavenderHomeSails } from './lavender-home';
import { lavenderGroveAnchors, lavenderGroveOccluders, lavenderGrovePlate, lavenderShoalPlate } from './lavender-grove';
import { lavenderCapeAnchors, lavenderCapeOccluders, lavenderCapePlate } from './lavender-cape';
import { buildingIds } from './farm';
import { farmhouseUpgradeArt } from './upgrade-farmhouse-art';
import { coopUpgradeArt } from './upgrade-coop-art';
import { wellUpgradeArt } from './upgrade-well-art';
import { fairProjectArt } from './project-fair-art';
import { dockProjectArt } from './project-dock-art';
import { bakerySpecializationArt } from './specialization-bakery-art';
import { preservesSpecializationArt } from './specialization-preserves-art';
import { hatcherySpecializationArt, packingSpecializationArt } from './coop-specialization-art';
import { rainSpecializationArt, pipesSpecializationArt } from './well-specialization-art';
import { capeUpgradeArt } from './cape-upgrade-art';
import { lavenderVillagePlate, lavenderVillageAnchors } from './lavender-village';

const origin = { x: 125.25, y: 37 };
export const sceneScale = 0.75;

export function scenePoint(x: number, y: number) {
  return { x: origin.x + x * sceneScale, y: origin.y + y * sceneScale };
}

function sceneBox(box: { x: number; y: number; w: number; h: number }) {
  return { ...scenePoint(box.x, box.y), w: box.w * sceneScale, h: box.h * sceneScale };
}

function cutouts(masks: typeof lavenderHomeOccluders) {
  return masks.map((mask) => ({
    ...sceneBox(mask), url: mask.url, footY: scenePoint(0, mask.footY).y, building: mask.building, project: mask.project,
  }));
}

export const landscape = {
  village: { path: lavenderVillagePlate.path, bounds: sceneBox(lavenderVillagePlate.bounds), occluders: [], shoreY: scenePoint(0, 300).y },
  home: { path: 'lavender/home-plate', bounds: sceneBox(lavenderHomePlate), occluders: cutouts(lavenderHomeOccluders), shoreY: scenePoint(0, 318).y },
  grove: { path: lavenderGrovePlate.path, bounds: sceneBox(lavenderGrovePlate.bounds), occluders: cutouts(lavenderGroveOccluders), shoreY: scenePoint(0, lavenderGroveAnchors.shoreMinY).y },
  cape: { path: lavenderCapePlate.path, bounds: sceneBox(lavenderCapePlate.bounds), occluders: cutouts(lavenderCapeOccluders), shoreY: scenePoint(0, lavenderCapeAnchors.shoreMinY).y },
};
export const shoalPlate = { key: 'grove-shoal-plate', path: lavenderShoalPlate.path, bounds: sceneBox(lavenderShoalPlate.bounds) };

const nativeUpgradeArt = { farmhouse: farmhouseUpgradeArt, coop: coopUpgradeArt, well: wellUpgradeArt };
type NativeStage = {
  patch: { path: string; x: number; y: number; w: number; h: number };
  occluder: { path: string; x: number; y: number; w: number; h: number; footY: number };
};

function sceneStage(key: string, { patch, occluder }: NativeStage) {
  return {
    patch: { ...sceneBox(patch), path: patch.path, key: `${key}-patch` },
    mask: { ...sceneBox(occluder), footY: scenePoint(0, occluder.footY).y,
      path: occluder.path, key: `${key}-mask` },
  };
}

export const buildingUpgrades = buildingIds.map((building) => ({
  building, ...sceneStage(`upgrade-${building}`, nativeUpgradeArt[building]),
}));

export const projectStages = {
  fair: sceneStage('project-fair', fairProjectArt),
  dock: sceneStage('project-dock', dockProjectArt),
};

export const specializationStages = {
  bakery: sceneStage('specialization-bakery', bakerySpecializationArt),
  preserves: sceneStage('specialization-preserves', preservesSpecializationArt),
  hatchery: sceneStage('specialization-hatchery', hatcherySpecializationArt),
  packing: sceneStage('specialization-packing', packingSpecializationArt),
  rain: sceneStage('specialization-rain', rainSpecializationArt),
  pipes: sceneStage('specialization-pipes', pipesSpecializationArt),
};

export const windmillSails = {
  pivot: scenePoint(lavenderHomeSails.pivotX, lavenderHomeSails.pivotY),
  w: lavenderHomeSails.w * sceneScale,
  h: lavenderHomeSails.h * sceneScale,
  footY: scenePoint(0, lavenderHomeSails.footY).y,
  origin: (lavenderHomeSails.pivotX - lavenderHomeSails.x) / lavenderHomeSails.w,
  baseline: (lavenderHomeSails.pivotY - lavenderHomeSails.y) / lavenderHomeSails.h,
};

const grove = lavenderGroveAnchors;
const mapped = (point: { x: number; y: number }) => scenePoint(point.x, point.y);
export const village = {
  homes: lavenderVillageAnchors.homes.map(mapped), workshop: mapped(lavenderVillageAnchors.workshop),
  table: mapped(lavenderVillageAnchors.table), square: mapped(lavenderVillageAnchors.square), lookout: mapped(lavenderVillageAnchors.lookout),
};
export const cape = {
  flowers: lavenderCapeAnchors.flowers.map(mapped), hive: mapped(lavenderCapeAnchors.hive),
  hiveStop: mapped(lavenderCapeAnchors.hiveStop),
};
export const capeBuildings = {
  apiary: { ...capeUpgradeArt.apiary, ...mapped(capeUpgradeArt.apiary),
    key: 'cape-apiary', level: 2, w: capeUpgradeArt.apiary.w * sceneScale, h: capeUpgradeArt.apiary.h * sceneScale },
  kitchen: { ...capeUpgradeArt.kitchen, ...mapped(capeUpgradeArt.kitchen),
    key: 'cape-honey-kitchen', level: 3, w: capeUpgradeArt.kitchen.w * sceneScale, h: capeUpgradeArt.kitchen.h * sceneScale },
};
export const capeKitchenStop = mapped(capeUpgradeArt.kitchen.stop);
export const capeKitchenSteam = mapped(capeUpgradeArt.kitchen.steam);

export const orchard = {
  home: [scenePoint(1376, 553), scenePoint(1302, 646), scenePoint(1226, 742)],
  grove: grove.treeSpots.map(mapped),
};

export const docks = {
  village: { entry: mapped(lavenderVillageAnchors.dockEntry), end: mapped(lavenderVillageAnchors.dockStop),
    float: mapped(lavenderVillageAnchors.dockStop), boat: mapped(lavenderVillageAnchors.boat) },
  home: {
    entry: scenePoint(469, 754), end: scenePoint(461, 879), float: scenePoint(370, 923),
    boat: scenePoint(lavenderHomeBoat.x + lavenderHomeBoat.w / 2, lavenderHomeBoat.footY),
  },
  grove: {
    entry: mapped(grove.dockEntry), end: mapped(grove.fishingStop), float: mapped(grove.fishingFloat),
    boat: scenePoint(grove.mooring.boatX, grove.mooring.boatY + 7),
  },
  cape: {
    entry: mapped(lavenderCapeAnchors.dockEntry), end: mapped(lavenderCapeAnchors.dockStop),
    float: mapped(lavenderCapeAnchors.dockStop), boat: mapped(lavenderCapeAnchors.boat),
  },
};

export const saltCove = { foot: mapped(grove.saltCove), stop: mapped(grove.saltStop) };
export const beach = { shells: grove.shellSpots.map(mapped), crab: mapped(grove.crab) };
export const shoal = {
  entry: mapped(grove.shoal.entry), path: grove.shoal.path.map(mapped), glass: mapped(grove.shoal.glass),
  pearl: mapped(grove.shoal.pearl), starfish: mapped(grove.shoal.starfish),
  look: mapped(grove.shoal.look), pools: grove.shoal.pools.map(mapped),
};

const plotColumns = [565, 709, 850, 993];
const plotRows = [
  { middle: 436, foot: 452, aisle: 475, depth: 60 },
  { middle: 520, foot: 544, aisle: 567, depth: 71 },
  { middle: 612, foot: 634, aisle: 656, depth: 69 },
  { middle: 706, foot: 730, aisle: 758, depth: 76 },
];

export const plots = plotRows.flatMap((row) => plotColumns.map((x) => ({
  center: scenePoint(x, row.middle),
  foot: scenePoint(x, row.foot),
  stop: scenePoint(x + 36, row.aisle),
  w: 137 * sceneScale,
  h: row.depth * sceneScale,
})));
