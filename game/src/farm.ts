import { exposedTrait, getClimate, traitIds, traitNames, type Trait } from './climate.ts';
import { shellDefinitions, shellForSpot, shellIds, shellSpotCount, type ShellId } from './tide.ts';
import { getShoalFindAt, hasShoal, shoalDefinitions, shoalFindIds, type ShoalFindId } from './shoal.ts';
import { fishingSpecies, type FishingLoot } from './fishing-model.ts';

export const cropIds = ['carrot', 'cabbage', 'beetroot', 'tomato', 'pumpkin', 'wheat', 'leafyGreens'] as const;
export type CropId = typeof cropIds[number];

type CropDefinition = {
  name: string;
  days: number;
  seedPrice: number;
  sellPrice: number;
  yield: number;
};

export const cropDefinitions: Record<CropId, CropDefinition> = {
  carrot: { name: 'Carrot', days: 1, seedPrice: 4, sellPrice: 2, yield: 3 },
  cabbage: { name: 'Cabbage', days: 2, seedPrice: 6, sellPrice: 5, yield: 2 },
  beetroot: { name: 'Beetroot', days: 2, seedPrice: 5, sellPrice: 4, yield: 2 },
  tomato: { name: 'Tomato', days: 3, seedPrice: 7, sellPrice: 5, yield: 3 },
  pumpkin: { name: 'Pumpkin', days: 3, seedPrice: 8, sellPrice: 9, yield: 2 },
  wheat: { name: 'Wheat', days: 2, seedPrice: 4, sellPrice: 3, yield: 3 },
  leafyGreens: { name: 'Leafy greens', days: 1, seedPrice: 4, sellPrice: 3, yield: 2 },
};

export const waterCapacity = 6;
export const expandedWaterCapacity = 10;
export const canUpgradePrice = 35;
export const seedPackSize = 3;
export const feedBagSize = 2;
export const feedBagPrice = 4;
export const eggPrice = 3;
export const eggsPerBasket = 3;
const eggBasketPrice = 13;
export const eggsPerCrate = 5;
const eggCratePrice = 24;
export const boatPrice = 52;
export const seaSaltPrice = 4;
export const treeSlotCount = 3;
export const chickenCount = 4;
export const maxFlockSize = chickenCount + 1;
export const incubationDays = 2;
const rainCapacityBonus = 4;
export const maxChickenHappiness = 5;
export const fishDailyLimit = 3;
export const capeFlowerSlotCount = 3;
export const honeyPrice = 7;
export const windHoneyPrice = 18;
export const beeswaxPrice = 6;
export type CapeLevel = 1 | 2 | 3;

export const orchardIslandIds = ['home', 'grove'] as const;
export type OrchardIslandId = typeof orchardIslandIds[number];
export const islandIds = [...orchardIslandIds, 'cape', 'village'] as const;
export type IslandId = typeof islandIds[number];

export const treeIds = ['apple', 'pear', 'peach'] as const;
export type TreeId = typeof treeIds[number];
export type TreeSlot = { tree: TreeId; age: number; fruitReady: number; trait?: Trait };
export const treeDefinitions: Record<TreeId, { name: string; days: number; saplingPrice: number; sellPrice: number }> = {
  apple: { name: 'Apple', days: 2, saplingPrice: 9, sellPrice: 4 },
  pear: { name: 'Pear', days: 3, saplingPrice: 11, sellPrice: 6 },
  peach: { name: 'Peach', days: 3, saplingPrice: 13, sellPrice: 7 },
};

const resourceGroups = { crops: cropIds, orchard: treeIds, coop: ['egg'] } as const;
export type ArchiveGroup = keyof typeof resourceGroups | 'shore' | 'bay';
const resourceIds = [...cropIds, ...treeIds, 'egg'] as const;
type ResourceId = typeof resourceIds[number];
const discoveryIds = ['regular', ...traitIds] as const;
type DiscoveryId = typeof discoveryIds[number];
type Collection<K extends string, V> = Partial<Record<ResourceId, Partial<Record<K, V>>>>;

function resourceDefinition(id: ResourceId) {
  if (id === 'egg') return { name: 'Egg', icon: 'egg', sellPrice: eggPrice };
  if (isId(treeIds, id)) {
    const icons: Record<TreeId, string> = { apple: 'apple', pear: 'ui-pear', peach: 'ui-tree-peach' };
    return { ...treeDefinitions[id], icon: icons[id] };
  }
  return { ...cropDefinitions[id], icon: id };
}

export function variantLabel(id: ResourceId, trait: Trait) {
  const { name, icon } = resourceDefinition(id);
  return { name: `${traitNames[trait]} ${name.toLowerCase()}`, image: icon };
}

type ArchiveItem = { id: DiscoveryId | 'moon' | ShoalFindId | BayDiscoveryId; name: string; icon: string; discovered: boolean; trait?: Trait };

export function getArchive(farm: FarmState, group: ArchiveGroup): { id: string; name: string; items: ArchiveItem[] }[] {
  if (group === 'bay') return [
    { id: 'fish', name: 'Bay fish', items: fishIds.map((id) => ({ id, name: fishDefinitions[id].name, icon: 'fish', discovered: farm.bayDiscoveries.includes(id) })) },
    { id: 'fruit', name: 'Orchard fruit', items: treeIds.map((id) => ({ id, ...resourceDefinition(id), discovered: farm.bayDiscoveries.includes(id) })) },
    { id: 'dishes', name: 'Kitchen dishes', items: dishIds.map((id) => ({ id, name: dishDefinitions[id].name, icon: id, discovered: farm.bayDiscoveries.includes(id) })) },
    { id: 'honey', name: 'Cape honey', items: [
      { id: 'honey', name: 'Flower honey', icon: 'honey', discovered: farm.bayDiscoveries.includes('honey') },
      { id: 'windHoney', name: 'Wind honey', icon: 'windHoney', discovered: farm.bayDiscoveries.includes('windHoney') },
      { id: 'beeswax', name: 'Beeswax', icon: 'beeswax', discovered: farm.bayDiscoveries.includes('beeswax') },
    ] },
  ];
  if (group === 'shore') return [{
    id: 'shell', name: 'Seashell',
    items: shellIds.map((id) => ({
      id, name: id === 'regular' ? 'Regular' : 'Moon shell', icon: shellDefinitions[id].icon,
      discovered: farm.shellDiscoveries.includes(id),
    })),
  }, {
    id: 'tidepool', name: 'Tidepool finds',
    items: shoalFindIds.map((id) => ({
      id, name: shoalDefinitions[id].name, icon: shoalDefinitions[id].icon, discovered: farm.shoalDiscoveries.includes(id),
    })),
  }];
  return resourceGroups[group].map((id) => {
    const { name, icon } = resourceDefinition(id);
    return {
      id, name,
      items: discoveryIds.map((variant) => ({
        id: variant, name: variant === 'regular' ? 'Regular' : traitNames[variant], icon,
        trait: variant === 'regular' ? undefined : variant,
        discovered: farm.discoveries[id]?.[variant] === true,
      })),
    };
  });
}

export const fishIds = fishingSpecies;
export type FishId = typeof fishIds[number];
export const fishDefinitions: Record<FishId, { name: string; sellPrice: number }> = {
  perch: { name: 'Perch', sellPrice: 5 },
  seaBass: { name: 'Sea bass', sellPrice: 10 },
  moonfish: { name: 'Moonfish', sellPrice: 18 },
  lanternfish: { name: 'Lanternfish', sellPrice: 26 },
};
const islandFish: Record<OrchardIslandId, FishId> = { home: 'perch', grove: 'seaBass' };

export const buildingIds = ['farmhouse', 'coop', 'well'] as const;
export type BuildingId = typeof buildingIds[number];
type BuildingLevel = 1 | 2 | 3;
export const buildingDefinitions: Record<BuildingId, { name: string; upgradePrice: number; benefit: string }> = {
  farmhouse: { name: 'Farmhouse', upgradePrice: 24, benefit: 'Jam, grilled fish and kitchen orders' },
  coop: { name: 'Chicken coop', upgradePrice: 22, benefit: 'Egg baskets and coop orders' },
  well: { name: 'Well', upgradePrice: 18, benefit: 'Row watering and harvest orders' },
};

export const specializationIds = ['bakery', 'preserves'] as const;
export type SpecializationId = typeof specializationIds[number];

const coopSpecializationIds = ['hatchery', 'packing'] as const;
const wellSpecializationIds = ['rain', 'pipes'] as const;
export const facilityBranchIds = [...coopSpecializationIds, ...wellSpecializationIds] as const;
export type CoopSpecialization = typeof coopSpecializationIds[number];
export type WellSpecialization = typeof wellSpecializationIds[number];
export type FacilityBranch = typeof facilityBranchIds[number];
export const facilitySpecializations = {
  coop: {
    hatchery: { name: 'Hatchery', price: 48 },
    packing: { name: 'Packing House', price: 48 },
  },
  well: {
    rain: { name: 'Rain Cistern', price: 44 },
    pipes: { name: 'Irrigation Pipes', price: 44 },
  },
} as const;

export const capeDishIds = ['honeyBiscuits', 'honeyPear', 'windParfait'] as const;
export const dishIds = ['orchardTart', 'grilledFish', 'appleJam', 'farmhouseBread', 'orchardPreserves', 'honeyCake', ...capeDishIds] as const;
export type DishId = typeof dishIds[number];
export const bayDiscoveryIds = [...fishIds, ...treeIds, ...dishIds, 'honey', 'windHoney', 'beeswax'] as const;
export type BayDiscoveryId = typeof bayDiscoveryIds[number];
export const specializationDefinitions: Record<SpecializationId, { name: string; price: number; dish: DishId }> = {
  bakery: { name: 'Bakery', price: 58, dish: 'farmhouseBread' },
  preserves: { name: 'Preserves kitchen', price: 58, dish: 'orchardPreserves' },
};
export const workshopShapes = ['round', 'folded', 'long'] as const;
export type WorkshopShape = typeof workshopShapes[number];
export const workshopDefinitions: Record<WorkshopShape, { name: string; sellPrice: number }> = {
  round: { name: 'Round bun', sellPrice: 18 },
  folded: { name: 'Folded pastry', sellPrice: 20 },
  long: { name: 'Long loaf', sellPrice: 22 },
};
export const residentIds = ['bea', 'finn'] as const;
export type ResidentId = typeof residentIds[number];
export const residentDefinitions: Record<ResidentId, { name: string; role: string; benefit: string }> = {
  bea: { name: 'Bea', role: 'Baker', benefit: 'Bakes three pastries from a discovered pattern once a day.' },
  finn: { name: 'Finn', role: 'Fisher', benefit: 'Scouts one fishing trip for a larger, sturdier hook once a day.' },
};
export type FishingTripConfig = { capacity: number; depth: number; resilience: number; scouted: boolean };
type FishingTrip = { token: number; day: number; island: OrchardIslandId; config: FishingTripConfig };
export type VillageState = {
  built: boolean;
  supplies: Record<string, number>;
  residents: [ResidentId | null, ResidentId | null];
  meals: number;
  mealOn: number;
  serviceOn: Record<ResidentId, number>;
  scouting: boolean;
};

export type StockItem = Readonly<(
  | { kind: 'produce'; item: CropId }
  | { kind: 'fruit'; item: TreeId }
  | { kind: 'fish'; item: FishId }
  | { kind: 'dishes'; item: DishId }
  | { kind: 'handmade'; item: WorkshopShape }
  | { kind: 'shells'; item: ShellId }
  | { kind: 'shoalFinds'; item: ShoalFindId }
  | { kind: 'variants'; item: ResourceId; trait: Trait }
  | { kind: 'eggs' | 'eggBaskets' | 'eggCrates' | 'seaSalt' | 'honey' | 'windHoney' | 'beeswax' }
) & { quantity: number }>;

export const capeUpgradeDefinitions: Record<2 | 3, { name: string; coins: number; items: readonly StockItem[] }> = {
  2: { name: 'Flower Apiary', coins: 48, items: [{ kind: 'honey', quantity: 3 }] },
  3: { name: 'Honey Kitchen', coins: 68, items: [{ kind: 'beeswax', quantity: 3 }, { kind: 'seaSalt', quantity: 2 }] },
};

type DishDefinition = {
  name: string;
  sellPrice: number;
  requiredLevel: BuildingLevel;
  specialization?: SpecializationId;
  capeLevel?: 3;
  ingredientLabel: string;
  ingredients: readonly StockItem[];
};

export const dishDefinitions: Record<DishId, DishDefinition> = {
  orchardTart: {
    name: 'Orchard tart', sellPrice: 25, requiredLevel: 1, ingredientLabel: '2 apples, 1 wheat, 1 egg',
    ingredients: [
      { kind: 'fruit', item: 'apple', quantity: 2 }, { kind: 'produce', item: 'wheat', quantity: 1 }, { kind: 'eggs', quantity: 1 },
    ],
  },
  grilledFish: {
    name: 'Grilled fish', sellPrice: 32, requiredLevel: 2, ingredientLabel: '1 sea bass, 1 sea salt, 1 carrot',
    ingredients: [
      { kind: 'fish', item: 'seaBass', quantity: 1 }, { kind: 'seaSalt', quantity: 1 }, { kind: 'produce', item: 'carrot', quantity: 1 },
    ],
  },
  appleJam: {
    name: 'Apple jam', sellPrice: 14, requiredLevel: 2, ingredientLabel: '2 apples',
    ingredients: [{ kind: 'fruit', item: 'apple', quantity: 2 }],
  },
  farmhouseBread: {
    name: 'Farmhouse bread', sellPrice: 15, requiredLevel: 3, specialization: 'bakery', ingredientLabel: '2 wheat, 1 egg',
    ingredients: [{ kind: 'produce', item: 'wheat', quantity: 2 }, { kind: 'eggs', quantity: 1 }],
  },
  orchardPreserves: {
    name: 'Orchard preserves', sellPrice: 16, requiredLevel: 3, specialization: 'preserves', ingredientLabel: '1 apple, 1 pear',
    ingredients: [{ kind: 'fruit', item: 'apple', quantity: 1 }, { kind: 'fruit', item: 'pear', quantity: 1 }],
  },
  honeyCake: {
    name: 'Honey cake', sellPrice: 20, requiredLevel: 1, ingredientLabel: '2 wheat, 1 flower honey',
    ingredients: [{ kind: 'produce', item: 'wheat', quantity: 2 }, { kind: 'honey', quantity: 1 }],
  },
  honeyBiscuits: {
    name: 'Honey biscuits', sellPrice: 28, requiredLevel: 1, capeLevel: 3, ingredientLabel: '1 flower honey, 2 wheat, 1 egg',
    ingredients: [{ kind: 'honey', quantity: 1 }, { kind: 'produce', item: 'wheat', quantity: 2 }, { kind: 'eggs', quantity: 1 }],
  },
  honeyPear: {
    name: 'Honey pear', sellPrice: 30, requiredLevel: 1, capeLevel: 3, ingredientLabel: '1 flower honey, 2 pears, 1 sea salt',
    ingredients: [{ kind: 'honey', quantity: 1 }, { kind: 'fruit', item: 'pear', quantity: 2 }, { kind: 'seaSalt', quantity: 1 }],
  },
  windParfait: {
    name: 'Wind parfait', sellPrice: 42, requiredLevel: 1, capeLevel: 3, ingredientLabel: '1 wind honey, 1 peach, 1 egg',
    ingredients: [{ kind: 'windHoney', quantity: 1 }, { kind: 'fruit', item: 'peach', quantity: 1 }, { kind: 'eggs', quantity: 1 }],
  },
};

const optionalOrderLanes = ['specialty', 'flock', 'waterworks', 'harbor', 'cape', 'apiary', 'honeyKitchen'] as const;
export const orderLanes = ['garden', 'pantry', 'grove', 'kitchen', 'coop', 'irrigation', ...optionalOrderLanes] as const;
export type OrderLane = typeof orderLanes[number];
type OrderLedger = Record<OrderLane, { completed: number; deliveredOn: number }>;
type Order = { name: string; reward: number; items: readonly StockItem[]; upgradedKitchen?: true };

const orderUpgrades: Partial<Record<OrderLane, BuildingId>> = {
  kitchen: 'farmhouse', coop: 'coop', irrigation: 'well',
};

const orderMenus: Record<Exclude<OrderLane, typeof optionalOrderLanes[number]>, readonly Order[]> = {
  garden: [
    { name: 'Garden basket', reward: 22, items: [{ kind: 'produce', item: 'cabbage', quantity: 2 }, { kind: 'produce', item: 'tomato', quantity: 1 }] },
    { name: 'Root box', reward: 21, items: [{ kind: 'produce', item: 'carrot', quantity: 3 }, { kind: 'produce', item: 'beetroot', quantity: 2 }] },
    { name: 'Autumn basket', reward: 21, items: [{ kind: 'produce', item: 'pumpkin', quantity: 1 }, { kind: 'produce', item: 'leafyGreens', quantity: 2 }] },
  ],
  pantry: [
    { name: 'Breakfast crate', reward: 14, items: [{ kind: 'eggs', quantity: 1 }, { kind: 'produce', item: 'wheat', quantity: 2 }] },
    { name: 'Bakery delivery', reward: 37, items: [{ kind: 'dishes', item: 'orchardTart', quantity: 1 }, { kind: 'fruit', item: 'apple', quantity: 1 }] },
    { name: 'Pier picnic', reward: 23, items: [{ kind: 'fish', item: 'perch', quantity: 2 }, { kind: 'eggs', quantity: 2 }] },
  ],
  grove: [
    { name: 'Saltwind catch', reward: 21, items: [{ kind: 'fish', item: 'seaBass', quantity: 1 }, { kind: 'seaSalt', quantity: 1 }] },
    { name: 'Grove basket', reward: 29, items: [{ kind: 'fruit', item: 'pear', quantity: 2 }, { kind: 'produce', item: 'beetroot', quantity: 2 }] },
    { name: 'Harbor supper', reward: 49, upgradedKitchen: true, items: [{ kind: 'dishes', item: 'grilledFish', quantity: 1 }, { kind: 'seaSalt', quantity: 1 }] },
  ],
  kitchen: [
    { name: 'Jam & grain', reward: 28, items: [{ kind: 'dishes', item: 'appleJam', quantity: 1 }, { kind: 'produce', item: 'wheat', quantity: 2 }] },
    { name: 'Orchard tea', reward: 53, items: [{ kind: 'dishes', item: 'appleJam', quantity: 1 }, { kind: 'dishes', item: 'orchardTart', quantity: 1 }] },
  ],
  coop: [
    { name: 'Morning hamper', reward: 28, items: [{ kind: 'eggBaskets', quantity: 1 }, { kind: 'produce', item: 'carrot', quantity: 3 }] },
    { name: 'Baker’s basket', reward: 29, items: [{ kind: 'eggBaskets', quantity: 1 }, { kind: 'produce', item: 'wheat', quantity: 3 }] },
  ],
  irrigation: [
    { name: 'Kitchen garden', reward: 28, items: [{ kind: 'produce', item: 'carrot', quantity: 4 }, { kind: 'produce', item: 'leafyGreens', quantity: 4 }] },
    { name: 'Mill harvest', reward: 38, items: [{ kind: 'produce', item: 'wheat', quantity: 5 }, { kind: 'produce', item: 'beetroot', quantity: 3 }] },
  ],
};

const specialtyMenus: Record<SpecializationId, readonly Order[]> = {
  bakery: [
    { name: 'Bread basket', reward: 29, items: [{ kind: 'dishes', item: 'farmhouseBread', quantity: 1 }, { kind: 'produce', item: 'wheat', quantity: 2 }] },
    { name: 'Baker’s table', reward: 48, items: [{ kind: 'dishes', item: 'farmhouseBread', quantity: 2 }, { kind: 'dishes', item: 'appleJam', quantity: 1 }] },
  ],
  preserves: [
    { name: 'Orchard preserves box', reward: 30, items: [{ kind: 'dishes', item: 'orchardPreserves', quantity: 1 }, { kind: 'fruit', item: 'apple', quantity: 2 }] },
    { name: 'Grove pantry', reward: 50, items: [{ kind: 'dishes', item: 'orchardPreserves', quantity: 2 }, { kind: 'dishes', item: 'appleJam', quantity: 1 }] },
  ],
};

const facilityMenus: Record<FacilityBranch, readonly Order[]> = {
  hatchery: [
    { name: 'Hatchery breakfast', reward: 28, items: [{ kind: 'eggs', quantity: 6 }] },
    { name: 'Henhouse hamper', reward: 38, items: [{ kind: 'eggBaskets', quantity: 2 }] },
  ],
  packing: [
    { name: 'Packed for market', reward: 36, items: [{ kind: 'eggCrates', quantity: 1 }, { kind: 'produce', item: 'wheat', quantity: 2 }] },
    { name: 'Breakfast shipment', reward: 62, items: [{ kind: 'eggCrates', quantity: 2 }] },
  ],
  rain: [
    { name: 'Rain garden basket', reward: 35, items: [{ kind: 'produce', item: 'leafyGreens', quantity: 4 }, { kind: 'produce', item: 'tomato', quantity: 3 }] },
    { name: 'Cistern harvest', reward: 41, items: [{ kind: 'produce', item: 'cabbage', quantity: 4 }, { kind: 'produce', item: 'pumpkin', quantity: 1 }] },
  ],
  pipes: [
    { name: 'Twin-row harvest', reward: 36, items: [{ kind: 'produce', item: 'carrot', quantity: 6 }, { kind: 'produce', item: 'beetroot', quantity: 4 }] },
    { name: 'Mill supper', reward: 43, items: [{ kind: 'produce', item: 'wheat', quantity: 6 }, { kind: 'produce', item: 'tomato', quantity: 3 }] },
  ],
};

const capeMenus: readonly Order[] = [
  { name: 'Flower Cape tea', reward: 28, items: [{ kind: 'dishes', item: 'honeyCake', quantity: 1 }] },
  { name: 'Honey Wind tasting', reward: 25, items: [{ kind: 'windHoney', quantity: 1 }] },
];

const apiaryMenus: readonly Order[] = [
  { name: 'Apiary parcel', reward: 40, items: [{ kind: 'beeswax', quantity: 3 }, { kind: 'honey', quantity: 2 }] },
  { name: 'Wax and preserves', reward: 34, items: [{ kind: 'beeswax', quantity: 2 }, { kind: 'dishes', item: 'appleJam', quantity: 1 }] },
];

const honeyKitchenMenus: readonly Order[] = [
  { name: 'Honey biscuit box', reward: 70, items: [{ kind: 'dishes', item: 'honeyBiscuits', quantity: 2 }] },
  { name: 'Cape tasting menu', reward: 88, items: [{ kind: 'dishes', item: 'honeyPear', quantity: 1 }, { kind: 'dishes', item: 'windParfait', quantity: 1 }] },
];

const marketStock: readonly StockItem[] = [
  ...cropIds.map((item) => ({ kind: 'produce', item, quantity: 1 }) as const),
  ...treeIds.map((item) => ({ kind: 'fruit', item, quantity: 1 }) as const),
  ...fishIds.map((item) => ({ kind: 'fish', item, quantity: 1 }) as const),
  ...dishIds.map((item) => ({ kind: 'dishes', item, quantity: 1 }) as const),
  ...workshopShapes.map((item) => ({ kind: 'handmade', item, quantity: 1 }) as const),
  { kind: 'eggs', quantity: 1 },
  { kind: 'eggBaskets', quantity: 1 },
  { kind: 'seaSalt', quantity: 1 },
  { kind: 'eggCrates', quantity: 1 },
  { kind: 'honey', quantity: 1 },
  { kind: 'windHoney', quantity: 1 },
  { kind: 'beeswax', quantity: 1 },
  ...shellIds.map((item) => ({ kind: 'shells', item, quantity: 1 }) as const),
  ...shoalFindIds.map((item) => ({ kind: 'shoalFinds', item, quantity: 1 }) as const),
  ...resourceIds.flatMap((item) => traitIds.map((trait) => ({ kind: 'variants', item, trait, quantity: 1 }) as const)),
];

export const projectIds = ['fair', 'dock'] as const;
export type ProjectId = typeof projectIds[number];
type ProjectLedger = Record<ProjectId, Record<string, number>>;
type ProjectDefinition = {
  name: string;
  island: IslandId;
  reward: number;
  items: readonly StockItem[];
};
const projectDefinitions: Record<ProjectId, ProjectDefinition> = {
  fair: {
    name: 'Market fair', island: 'home', reward: 65,
    items: [
      { kind: 'dishes', item: 'appleJam', quantity: 1 }, { kind: 'eggBaskets', quantity: 1 },
      { kind: 'produce', item: 'carrot', quantity: 4 }, { kind: 'produce', item: 'wheat', quantity: 3 },
    ],
  },
  dock: {
    name: 'Grove landing', island: 'grove', reward: 55,
    items: [
      { kind: 'dishes', item: 'appleJam', quantity: 1 }, { kind: 'fruit', item: 'pear', quantity: 2 },
      { kind: 'seaSalt', quantity: 2 },
    ],
  },
};

export const gardenRows = 4;
export const bedsPerRow = 4;
const bedCount = gardenRows * bedsPerRow;
const nestCapacity = 6;
const fruitPerHarvest = 2;

function getNestCapacity(coopLevel: BuildingLevel, flockSize: number): number {
  return nestCapacity + (coopLevel >= 2 ? 3 : 0) + (flockSize === maxFlockSize ? 3 : 0);
}

export type Bed =
  | { kind: 'empty' }
  | { kind: 'tilled' }
  | { kind: 'crop'; crop: CropId; growth: number; watered: boolean; wateredAt?: number; trait?: Trait };

export type BedStage = 'empty' | 'tilled' | 'seedling' | 'growing' | 'ripe';

export type BedAction = {
  kind: 'till' | 'plant' | 'water' | 'harvest' | 'wait';
  label: string;
  available: boolean;
};

type GoalId = 'till' | 'plant' | 'water' | 'rest' | 'harvest' | 'sell' | 'feed' | 'collect';

export type Goal = {
  id: GoalId;
  label: string;
  detail: string;
  target: number;
  reward: number;
};

const goals: readonly Goal[] = [
  { id: 'till', label: 'Prepare a garden bed', detail: 'Approach a bare bed and till the soil.', target: 1, reward: 3 },
  { id: 'plant', label: 'Sow your first seeds', detail: 'Carrots are ready after one watered night.', target: 1, reward: 3 },
  { id: 'water', label: 'Water a crop', detail: 'Water a planted bed so it can grow overnight.', target: 1, reward: 3 },
  { id: 'rest', label: 'Let the garden grow', detail: 'Rest at the farmhouse to start a new day.', target: 1, reward: 4 },
  { id: 'harvest', label: 'Harvest three ripe beds', detail: 'Look for mature crops in the garden.', target: 3, reward: 8 },
  { id: 'sell', label: 'Make your first sale', detail: 'Bring produce or eggs to the market stall.', target: 1, reward: 8 },
  { id: 'feed', label: 'Feed the chickens', detail: 'Visit the coop with a bag of feed.', target: 1, reward: 4 },
  { id: 'collect', label: 'Collect fresh eggs', detail: 'Check the coop for eggs. Fed chickens lay overnight.', target: 1, reward: 5 },
];

export type FarmState = {
  version: 1;
  day: number;
  workToday: number;
  coins: number;
  water: number;
  canUpgraded: boolean;
  selectedSeed: CropId;
  beds: Bed[];
  seeds: Record<CropId, number>;
  produce: Record<CropId, number>;
  feed: number;
  eggs: number;
  eggBaskets: number;
  eggCrates: number;
  eggsReady: number;
  eggTrait: Trait | null;
  chickensFed: boolean;
  island: IslandId;
  boatOwned: boolean;
  trees: Record<OrchardIslandId, (TreeSlot | null)[]>;
  saplings: Record<TreeId, number>;
  fruit: Record<TreeId, number>;
  fish: Record<FishId, number>;
  fishCaughtToday: Record<OrchardIslandId, number>;
  capeFlowers: (number | null)[];
  capeLevel: CapeLevel;
  capeHoneyOn: number;
  honey: number;
  windHoney: number;
  beeswax: number;
  bayDiscoveries: BayDiscoveryId[];
  guestServedOn: number;
  fairGuestsServed: number;
  handmade: Record<WorkshopShape, number>;
  workshopPatterns: WorkshopShape[];
  village: VillageState;
  fishingTripSerial: number;
  pendingFishingTrip: FishingTrip | null;
  seaSalt: number;
  saltGatheredToday: boolean;
  shells: Record<ShellId, number>;
  shellDiscoveries: ShellId[];
  shellsCollectedToday: number[];
  shoalFinds: Record<ShoalFindId, number>;
  shoalDiscoveries: ShoalFindId[];
  shoalCollectedToday: ShoalFindId[];
  dishes: Record<DishId, number>;
  buildingLevels: Record<BuildingId, BuildingLevel>;
  farmhouseSpecialization: SpecializationId | null;
  coopSpecialization: CoopSpecialization | null;
  wellSpecialization: WellSpecialization | null;
  flockSize: number;
  hatchDay: number | null;
  chickenHappiness: number;
  pettedChickens: number[];
  progress: Record<GoalId, number>;
  orientation: { collections: boolean; islands: boolean };
  orders: OrderLedger;
  projects: ProjectLedger;
  harborSupplies: Record<string, number>;
  variants: Collection<Trait, number>;
  discoveries: Collection<DiscoveryId, true>;
};

export type ActionResult = { ok: boolean; message: string };

function cropBed(crop: CropId, growth: number): Bed {
  return { kind: 'crop', crop, growth, watered: false };
}

function collectResources(farm: FarmState, id: ResourceId, quantity: number, trait?: Trait): string {
  if (isId(treeIds, id)) discoverBay(farm, id);
  const discoveries = farm.discoveries[id] ??= {};
  const ordinary = quantity - Number(trait !== undefined);
  if (ordinary > 0) {
    discoveries.regular = true;
    if (id === 'egg') farm.eggs += ordinary;
    else if (isId(treeIds, id)) farm.fruit[id] += ordinary;
    else farm.produce[id] += ordinary;
  }
  if (!trait) return '';
  const found = discoveries[trait] === true;
  discoveries[trait] = true;
  const stock = farm.variants[id] ??= {};
  stock[trait] = (stock[trait] ?? 0) + 1;
  return ` ${found ? 'Found' : 'Discovered'} ${variantLabel(id, trait).name}.`;
}

function emptyProduce(): FarmState['produce'] {
  return { carrot: 0, cabbage: 0, beetroot: 0, tomato: 0, pumpkin: 0, wheat: 0, leafyGreens: 0 };
}

export function createFarm(): FarmState {
  return {
    version: 1,
    day: 1,
    workToday: 0,
    coins: 18,
    water: waterCapacity,
    canUpgraded: false,
    selectedSeed: 'carrot',
    beds: [
      { kind: 'empty' }, cropBed('carrot', 0), cropBed('cabbage', 2), cropBed('tomato', 3),
      cropBed('wheat', 2), cropBed('beetroot', 2), cropBed('leafyGreens', 0), cropBed('pumpkin', 3),
      { kind: 'empty' }, cropBed('carrot', 1), cropBed('cabbage', 1), cropBed('wheat', 1),
      cropBed('pumpkin', 2), { kind: 'tilled' }, cropBed('tomato', 0), cropBed('leafyGreens', 1),
    ],
    seeds: { carrot: 3, cabbage: 2, beetroot: 1, tomato: 1, pumpkin: 1, wheat: 2, leafyGreens: 1 },
    produce: emptyProduce(),
    feed: 2,
    eggs: 0,
    eggBaskets: 0,
    eggCrates: 0,
    eggsReady: 1,
    eggTrait: null,
    chickensFed: false,
    island: 'home',
    boatOwned: false,
    trees: {
      home: [{ tree: 'apple', age: treeDefinitions.apple.days, fruitReady: fruitPerHarvest }, null, null],
      grove: [{ tree: 'pear', age: treeDefinitions.pear.days, fruitReady: fruitPerHarvest }, null, null],
    },
    saplings: { apple: 1, pear: 0, peach: 0 },
    fruit: { apple: 0, pear: 0, peach: 0 },
    fish: { perch: 0, seaBass: 0, moonfish: 0, lanternfish: 0 },
    fishCaughtToday: { home: 0, grove: 0 },
    capeFlowers: Array.from({ length: capeFlowerSlotCount }, () => null),
    capeLevel: 1,
    capeHoneyOn: 0,
    honey: 0,
    windHoney: 0,
    beeswax: 0,
    bayDiscoveries: [],
    guestServedOn: 0,
    fairGuestsServed: 0,
    handmade: { round: 0, folded: 0, long: 0 },
    workshopPatterns: [],
    village: { built: false, supplies: {}, residents: [null, null], meals: 0, mealOn: 0,
      serviceOn: { bea: 0, finn: 0 }, scouting: false },
    fishingTripSerial: 0,
    pendingFishingTrip: null,
    seaSalt: 0,
    saltGatheredToday: false,
    shells: { regular: 0, moon: 0 },
    shellDiscoveries: [],
    shellsCollectedToday: [],
    shoalFinds: { glass: 0, pearl: 0 },
    shoalDiscoveries: [],
    shoalCollectedToday: [],
    dishes: { orchardTart: 0, grilledFish: 0, appleJam: 0, farmhouseBread: 0, orchardPreserves: 0, honeyCake: 0, honeyBiscuits: 0, honeyPear: 0, windParfait: 0 },
    buildingLevels: { farmhouse: 1, coop: 1, well: 1 },
    farmhouseSpecialization: null,
    coopSpecialization: null,
    wellSpecialization: null,
    flockSize: chickenCount,
    hatchDay: null,
    chickenHappiness: 0,
    pettedChickens: [],
    progress: { till: 0, plant: 0, water: 0, rest: 0, harvest: 0, sell: 0, feed: 0, collect: 0 },
    orientation: { collections: false, islands: false },
    orders: {
      garden: { completed: 0, deliveredOn: 0 },
      pantry: { completed: 0, deliveredOn: 0 },
      grove: { completed: 0, deliveredOn: 0 },
      kitchen: { completed: 0, deliveredOn: 0 },
      coop: { completed: 0, deliveredOn: 0 },
      irrigation: { completed: 0, deliveredOn: 0 },
      specialty: { completed: 0, deliveredOn: 0 },
      flock: { completed: 0, deliveredOn: 0 },
      waterworks: { completed: 0, deliveredOn: 0 },
      harbor: { completed: 0, deliveredOn: 0 },
      cape: { completed: 0, deliveredOn: 0 },
      apiary: { completed: 0, deliveredOn: 0 },
      honeyKitchen: { completed: 0, deliveredOn: 0 },
    },
    projects: { fair: {}, dock: {} },
    harborSupplies: {},
    variants: {},
    discoveries: {},
  };
}

export function getBedStage(bed: Bed): BedStage {
  if (bed.kind !== 'crop') return bed.kind;
  if (bed.growth >= cropDefinitions[bed.crop].days) return 'ripe';
  return bed.growth > 0 ? 'growing' : 'seedling';
}

export function getDayPhase(farm: FarmState): 'Morning' | 'Afternoon' | 'Evening' {
  if (farm.workToday < 5) return 'Morning';
  return farm.workToday < 10 ? 'Afternoon' : 'Evening';
}

export function getWaterCapacity(farm: Pick<FarmState, 'canUpgraded'> & Partial<Pick<FarmState, 'buildingLevels' | 'wellSpecialization'>>): number {
  const capacity = farm.canUpgraded ? expandedWaterCapacity : waterCapacity;
  const wellBonus = farm.buildingLevels && farm.buildingLevels.well >= 2 ? 2 : 0;
  return capacity + wellBonus + (farm.wellSpecialization === 'rain' ? rainCapacityBonus : 0);
}

export function getBedAction(farm: FarmState, index: number): BedAction {
  const bed = farm.beds[index];
  if (!bed || farm.island !== 'home') return { kind: 'wait', label: 'Choose a garden bed on your farm.', available: false };
  if (bed.kind === 'empty') return { kind: 'till', label: 'Till soil', available: true };
  if (bed.kind === 'tilled') {
    const name = cropDefinitions[farm.selectedSeed].name.toLowerCase();
    const available = farm.seeds[farm.selectedSeed] > 0;
    return { kind: 'plant', label: available ? `Plant ${name} seeds` : `Choose another seed. Out of ${name} seeds.`, available };
  }

  const name = cropDefinitions[bed.crop].name.toLowerCase();
  if (getBedStage(bed) === 'ripe') return { kind: 'harvest', label: `Harvest ${name}`, available: true };
  if (bed.watered) return { kind: 'wait', label: 'Watered today. Grows overnight.', available: false };
  const available = farm.water > 0;
  return { kind: 'water', label: available ? `Water ${name}` : 'Refill your can at the well.', available };
}

export function workBed(farm: FarmState, index: number, now = Date.now()): ActionResult {
  const action = getBedAction(farm, index);
  if (!action.available) return failure(action.label);
  const bed = farm.beds[index];

  if (action.kind === 'till') {
    farm.beds[index] = { kind: 'tilled' };
    return record(farm, 'till', 'The bed is ready for seeds.');
  }
  if (action.kind === 'plant') {
    const crop = farm.selectedSeed;
    farm.seeds[crop] -= 1;
    const { weather } = getClimate(farm.day);
    const trait = exposedTrait(farm.day, weather, index + 1);
    farm.beds[index] = { kind: 'crop', crop, growth: 0, watered: weather === 'rain', ...(trait ? { trait } : {}) };
    return record(farm, 'plant', `Planted ${cropDefinitions[crop].name.toLowerCase()} seeds.`);
  }
  if (bed.kind !== 'crop') return failure(action.label);
  if (action.kind === 'water') {
    farm.water -= 1;
    bed.watered = true;
    bed.wateredAt = now;
    return record(farm, 'water', 'Watered the crop.');
  }

  const crop = cropDefinitions[bed.crop];
  const found = collectResources(farm, bed.crop, crop.yield, bed.trait);
  farm.beds[index] = { kind: 'tilled' };
  return record(farm, 'harvest', `${crop.name} harvest added ${crop.yield} to your basket.${found}`);
}

export function selectSeed(farm: FarmState, crop: CropId): ActionResult {
  if (!isCropId(crop)) return failure('Choose a seed.');
  const name = cropDefinitions[crop].name;
  if (farm.seeds[crop] === 0) return failure(`Buy more ${name.toLowerCase()} seeds at the market.`);
  farm.selectedSeed = crop;
  return { ok: true, message: `${name} seeds selected.` };
}

export function refillWater(farm: FarmState): ActionResult {
  const capacity = getWaterCapacity(farm);
  if (farm.water === capacity) return failure('Your watering can is full.');
  farm.water = capacity;
  return { ok: true, message: 'Refilled the watering can.' };
}

export function getIrrigationRow(farm: FarmState, row: number) {
  const unlocked = farm.island === 'home' && farm.buildingLevels.well >= 2;
  const valid = Number.isInteger(row) && row >= 0 && row < gardenRows;
  const targets = valid
    ? Array.from({ length: bedsPerRow }, (_, column) => row * bedsPerRow + column)
      .filter((index) => getBedAction(farm, index).kind === 'water')
    : [];
  return { targets, available: unlocked && targets.length > 0 && farm.water >= targets.length };
}

export function irrigateRow(farm: FarmState, row: number, now = Date.now()): ActionResult {
  if (farm.island !== 'home' || farm.buildingLevels.well < 2) return failure('Irrigation requires the upgraded well.');
  const { targets, available } = getIrrigationRow(farm, row);
  if (targets.length === 0) return failure('No crops need water in that row.');
  if (!available) return failure('Refill the can to water this row.');
  return waterPlots(farm, targets, now);
}

export function getIrrigationPair(farm: FarmState, firstRow: number) {
  const unlocked = farm.island === 'home' && farm.wellSpecialization === 'pipes';
  const valid = Number.isInteger(firstRow) && firstRow >= 0 && firstRow < gardenRows - 1;
  const targets = valid
    ? [...getIrrigationRow(farm, firstRow).targets, ...getIrrigationRow(farm, firstRow + 1).targets]
    : [];
  return { targets, available: unlocked && targets.length > 0 && farm.water >= targets.length };
}

export function irrigatePair(farm: FarmState, firstRow: number, now = Date.now()): ActionResult {
  if (farm.island !== 'home' || farm.wellSpecialization !== 'pipes') return failure('Paired watering requires irrigation pipes.');
  const { targets, available } = getIrrigationPair(farm, firstRow);
  if (targets.length === 0) return failure('No crops need water in those rows.');
  if (!available) return failure('Refill the can to water both rows.');
  return waterPlots(farm, targets, now);
}

function waterPlots(farm: FarmState, targets: number[], now: number): ActionResult {
  const before = farm.coins;
  for (const index of targets) workBed(farm, index, now);
  const bonus = farm.coins - before;
  return { ok: true, message: `Watered ${targets.length} ${targets.length === 1 ? 'plot' : 'plots'}.${bonus ? ` Task bonus +${bonus} coins.` : ''}` };
}

export function upgradeCan(farm: FarmState): ActionResult {
  if (farm.canUpgraded) return failure('You already have the large watering can.');
  if (farm.coins < canUpgradePrice) return failure('Save more coins for a large watering can.');
  farm.coins -= canUpgradePrice;
  farm.canUpgraded = true;
  farm.water = getWaterCapacity(farm);
  return { ok: true, message: `Upgraded your watering can. It holds ${farm.water} servings.` };
}

export function feedChickens(farm: FarmState): ActionResult {
  if (farm.chickensFed) return failure('The chickens have eaten today.');
  if (farm.feed === 0) return failure('Buy chicken feed at the market.');
  farm.feed -= 1;
  farm.chickensFed = true;
  return record(farm, 'feed', 'The chickens will lay eggs overnight.');
}

export function collectEggs(farm: FarmState): ActionResult {
  const eggs = farm.eggsReady;
  if (eggs === 0) return failure('Check the nest tomorrow for eggs.');
  const found = collectResources(farm, 'egg', eggs, farm.eggTrait ?? undefined);
  farm.eggsReady = 0;
  farm.eggTrait = null;
  return record(farm, 'collect', (eggs === 1 ? 'Collected an egg.' : `Collected ${eggs} eggs.`) + found);
}

export function packEggBasket(farm: FarmState): ActionResult {
  if (farm.island !== 'home' || farm.buildingLevels.coop < 2) return failure('Egg baskets require the upgraded coop.');
  if (farm.eggs < eggsPerBasket) return failure(`An egg basket needs ${eggsPerBasket} eggs.`);
  farm.eggs -= eggsPerBasket;
  farm.eggBaskets += 1;
  farm.workToday += 1;
  return { ok: true, message: 'Packed an egg basket.' };
}

export function packEggCrate(farm: FarmState): ActionResult {
  if (farm.island !== 'home' || farm.coopSpecialization !== 'packing') return failure('Egg crates require the Packing House.');
  if (farm.eggs < eggsPerCrate) return failure(`An egg crate needs ${eggsPerCrate} eggs.`);
  farm.eggs -= eggsPerCrate;
  farm.eggCrates += 1;
  farm.workToday += 1;
  return { ok: true, message: 'Packed an egg crate.' };
}

export function incubateEgg(farm: FarmState): ActionResult {
  if (farm.island !== 'home' || farm.coopSpecialization !== 'hatchery') return failure('Incubation requires the Hatchery.');
  if (farm.flockSize === maxFlockSize) return failure('Your flock is full.');
  if (farm.hatchDay !== null) return failure('An egg is already incubating.');
  if (farm.eggs < 1) return failure('Collect an egg to start incubation.');
  farm.eggs -= 1;
  farm.hatchDay = farm.day + incubationDays;
  farm.workToday += 1;
  return { ok: true, message: `An egg is incubating. Expect a new hen on day ${farm.hatchDay}.` };
}

export function buySeeds(farm: FarmState, crop: CropId): ActionResult {
  if (!isCropId(crop)) return failure('Choose a seed pack.');
  const definition = cropDefinitions[crop];
  if (farm.coins < definition.seedPrice) return failure('You need more coins for this seed pack.');
  farm.coins -= definition.seedPrice;
  farm.seeds[crop] += seedPackSize;
  return { ok: true, message: `Bought ${seedPackSize} ${definition.name.toLowerCase()} seeds.` };
}

export function buyFeed(farm: FarmState): ActionResult {
  if (farm.coins < feedBagPrice) return failure('You need more coins for chicken feed.');
  farm.coins -= feedBagPrice;
  farm.feed += feedBagSize;
  return { ok: true, message: `Bought ${feedBagSize} servings of chicken feed.` };
}

export function getFishLimit(farm: Pick<FarmState, 'island' | 'projects'>, island = farm.island): number {
  if (!isId(orchardIslandIds, island)) return 0;
  return fishDailyLimit + Number(island === 'grove' && isProjectComplete(farm, 'dock'));
}

export function getFishAction(farm: FarmState): { available: boolean; label: string } {
  if (!isId(orchardIslandIds, farm.island)) return { available: false, label: 'Fish at Home or Saltwind Grove.' };
  if (farm.fishCaughtToday[farm.island] >= getFishLimit(farm)) {
    return { available: false, label: 'This spot needs a rest. Come back tomorrow.' };
  }
  return { available: true, label: 'Cast your line' };
}

export function catchFish(farm: FarmState, hit: boolean): ActionResult {
  if (!isId(orchardIslandIds, farm.island)) return failure('Fish at the farm or Saltwind Grove.');
  const action = getFishAction(farm);
  if (!action.available) return failure(action.label);
  if (!hit) return failure('The fish slipped away. Try another cast.');
  const fish = islandFish[farm.island];
  farm.fish[fish] += 1;
  discoverBay(farm, fish);
  farm.fishCaughtToday[farm.island] += 1;
  farm.workToday += 1;
  return { ok: true, message: `Caught a ${fishDefinitions[fish].name.toLowerCase()}.` };
}

export function getFishingTripConfig(farm: FarmState): FishingTripConfig {
  const scouted = farm.village.scouting;
  return { capacity: scouted ? 3 : 2, depth: 120, resilience: scouted ? 4 : 2, scouted };
}

export function beginFishingTrip(farm: FarmState): ActionResult & { token?: number; config?: FishingTripConfig } {
  const action = getFishAction(farm);
  if (!action.available || !isId(orchardIslandIds, farm.island)) return failure(action.label);
  if (farm.fishingTripSerial === Number.MAX_SAFE_INTEGER) return failure('Your fishing log is full.');
  const config = getFishingTripConfig(farm);
  const token = ++farm.fishingTripSerial;
  farm.pendingFishingTrip = { token, day: farm.day, island: farm.island, config: { ...config } };
  farm.village.scouting = false;
  return { ok: true, message: 'Guide the hook down, then bring your catch home.', token, config: { ...config } };
}

export function finishFishingTrip(farm: FarmState, token: number, catchResult: number | readonly FishingLoot[]): ActionResult {
  const trip = farm.pendingFishingTrip;
  if (!trip || token !== trip.token) return failure('That fishing trip has already ended.');
  if (typeof catchResult === 'number' ? !isQuantity(catchResult) : !Array.isArray(catchResult)
    || !catchResult.every((item: unknown) => isRecord(item) && (
      item.kind === 'fish' && isId(fishIds, item.species) && (item.variant === 'regular' || item.variant === 'rare')
      || item.kind === 'shell' && isId(shellIds, item.variant)
      || item.kind === 'junk' && (item.item === 'boot' || item.item === 'weed' || item.item === 'rock')))) return failure('Choose a valid catch.');
  farm.pendingFishingTrip = null;
  if (trip.day !== farm.day || trip.island !== farm.island) return failure('Return to your fishing spot for a new trip.');
  const catches: readonly FishingLoot[] = typeof catchResult === 'number'
    ? Array.from({ length: Math.min(catchResult, trip.config.capacity) }, (): FishingLoot => ({ kind: 'fish', species: islandFish[trip.island], variant: 'regular' }))
    : catchResult.slice(0, trip.config.capacity);
  const remaining = Math.max(0, getFishLimit(farm, trip.island) - farm.fishCaughtToday[trip.island]);
  let fishCount = 0, junk = 0;
  const brought: string[] = [];
  for (const item of catches) {
    if (item.kind === 'fish') {
      if (fishCount >= remaining) continue;
      farm.fish[item.species] += 1;
      discoverBay(farm, item.species);
      fishCount++;
      brought.push(fishDefinitions[item.species].name.toLowerCase());
    } else if (item.kind === 'shell') {
      farm.shells[item.variant] += 1;
      if (!farm.shellDiscoveries.includes(item.variant)) farm.shellDiscoveries.push(item.variant);
      brought.push(shellDefinitions[item.variant].name.toLowerCase());
    } else junk++;
  }
  farm.fishCaughtToday[trip.island] += fishCount;
  if (catches.length) farm.workToday += 1;
  const message = brought.length ? `Brought home ${brought.join(', ')}.` : junk ? 'Cleared the water.' : 'The hook returned empty. Try another trip.';
  return { ok: true, message: message + (junk ? ` Removed ${junk} ${junk === 1 ? 'piece' : 'pieces'} of litter.` : '') };
}

export function cancelFishingTrip(farm: FarmState, token?: number): ActionResult {
  const trip = farm.pendingFishingTrip;
  if (!trip || token !== undefined && token !== trip.token) return failure('That fishing trip has already ended.');
  farm.pendingFishingTrip = null;
  return { ok: true, message: 'Put the fishing line away.' };
}

export function getTreeAction(farm: FarmState, slot: number): { kind: 'pick' | 'plant' | 'wait'; available: boolean; label: string } {
  if (!isId(orchardIslandIds, farm.island)) return { kind: 'wait', available: false, label: 'Visit the Home or Grove orchard.' };
  const tree = farm.trees[farm.island][slot];
  if (tree === undefined) return { kind: 'wait', available: false, label: 'Choose an orchard spot.' };
  if (tree === null) {
    const available = treeIds.some((id) => farm.saplings[id] > 0);
    return { kind: 'plant', available, label: available ? 'Plant a sapling' : 'Buy a sapling at the market.' };
  }
  const definition = treeDefinitions[tree.tree];
  if (tree.fruitReady > 0) return { kind: 'pick', available: true, label: `Pick ${definition.name.toLowerCase()} fruit` };
  if (tree.age < definition.days) {
    const nights = definition.days - tree.age;
    return { kind: 'wait', available: false, label: `${definition.name} sapling needs ${nights} more ${nights === 1 ? 'night' : 'nights'}.` };
  }
  return { kind: 'wait', available: false, label: 'Fresh fruit grows overnight.' };
}

export function pickFruit(farm: FarmState, slot: number): ActionResult {
  if (!isId(orchardIslandIds, farm.island)) return failure('Visit an orchard to pick fruit.');
  const action = getTreeAction(farm, slot);
  if (action.kind !== 'pick' || !action.available) return failure(action.label);
  const tree = farm.trees[farm.island][slot];
  if (!tree) return failure('Choose a fruit tree.');
  const quantity = tree.fruitReady;
  const found = collectResources(farm, tree.tree, quantity, tree.trait);
  tree.fruitReady = 0;
  delete tree.trait;
  farm.workToday += 1;
  return { ok: true, message: `Picked ${quantity} ${treeDefinitions[tree.tree].name.toLowerCase()} fruit.${found}` };
}

export function plantTree(farm: FarmState, slot: number, tree: TreeId): ActionResult {
  if (!isId(orchardIslandIds, farm.island)) return failure('Visit an orchard to plant saplings.');
  const orchard = farm.trees[farm.island];
  if (orchard[slot] !== null) return failure('Choose an open orchard spot.');
  if (!isId(treeIds, tree) || farm.saplings[tree] === 0) return failure('Choose a sapling from your pack.');
  farm.saplings[tree] -= 1;
  orchard[slot] = { tree, age: 0, fruitReady: 0 };
  farm.workToday += 1;
  return { ok: true, message: `Planted a ${treeDefinitions[tree].name.toLowerCase()} sapling.` };
}

export function buySapling(farm: FarmState, tree: TreeId): ActionResult {
  if (!isId(treeIds, tree)) return failure('Choose a sapling.');
  const { name, saplingPrice } = treeDefinitions[tree];
  if (farm.coins < saplingPrice) return failure('You need more coins for this sapling.');
  farm.coins -= saplingPrice;
  farm.saplings[tree] += 1;
  return { ok: true, message: `Bought a ${name.toLowerCase()} sapling.` };
}

export function buyAndPlantTree(farm: FarmState, slot: number, tree: TreeId): ActionResult {
  if (!isId(treeIds, tree) || !isId(orchardIslandIds, farm.island)
    || !Number.isInteger(slot) || slot < 0 || slot >= treeSlotCount || farm.trees[farm.island][slot] !== null) {
    return failure('Choose an empty orchard spot.');
  }
  if (farm.saplings[tree] === 0) {
    const purchase = buySapling(farm, tree);
    if (!purchase.ok) return purchase;
  }
  return plantTree(farm, slot, tree);
}

export function buyBoat(farm: FarmState): ActionResult {
  if (farm.boatOwned) return failure('Your boat is already tied at the dock.');
  if (farm.coins < boatPrice) return failure('Save more coins to buy a boat.');
  farm.coins -= boatPrice;
  farm.boatOwned = true;
  return { ok: true, message: 'Your boat is ready. Sail from the dock.' };
}

export function sail(farm: FarmState, island: IslandId): ActionResult {
  if (!isId(islandIds, island) || farm.island === island) return failure('Choose another island.');
  if (!farm.boatOwned) return failure('Buy a boat before you set sail.');
  if (!canSailTo(farm, island)) return failure(island === 'village' ? 'Complete Living Bay at the Home fair to open Lavender Harbour.' : 'Complete two orders at the Grove landing to open Flower Cape.');
  farm.island = island;
  const messages: Record<IslandId, string> = {
    home: 'Welcome back to the farm.', grove: 'You reached Saltwind Grove.', cape: 'You reached Flower Cape. Plant flowers to welcome the bees.',
    village: 'Welcome to Lavender Harbour. Your neighbours are waiting.',
  };
  return { ok: true, message: messages[island] };
}

export function canSailTo(farm: Pick<FarmState, 'boatOwned' | 'orders'> & Partial<Pick<FarmState, 'village'>>, destination: IslandId): boolean {
  return isId(islandIds, destination) && farm.boatOwned && (destination !== 'cape' || farm.orders.harbor.completed >= 2)
    && (destination !== 'village' || farm.village?.built === true);
}

export function isHoneyWind(day: number): boolean {
  return Number.isSafeInteger(day) && day >= 8 && (day - 8) % 5 === 0;
}

export function getCapeBloom(farm: Pick<FarmState, 'day' | 'capeFlowers'>, index: number): 'empty' | 'growing' | 'bloom' {
  const plantedOn = farm.capeFlowers[index];
  if (plantedOn === null || plantedOn === undefined) return 'empty';
  return farm.day > plantedOn ? 'bloom' : 'growing';
}

export function plantCapeFlower(farm: FarmState, index: number): ActionResult {
  if (farm.island !== 'cape' || !canSailTo(farm, 'cape')) return failure('Plant flowers on Flower Cape.');
  if (!Number.isInteger(index) || index < 0 || index >= capeFlowerSlotCount || farm.capeFlowers[index] !== null) {
    return failure('Choose an empty Cape flower bed.');
  }
  farm.capeFlowers[index] = farm.day;
  farm.workToday += 1;
  return { ok: true, message: 'Planted local flower seeds. They will bloom tomorrow.' };
}

export function getCapeHoney(farm: FarmState): { available: boolean; blooms: number; honey: number; windHoney: number } {
  const blooms = farm.capeFlowers.filter((_, index) => getCapeBloom(farm, index) === 'bloom').length;
  const windHoney = Number(blooms > 0 && isHoneyWind(farm.day));
  const apiaryHoney = Number(farm.capeLevel >= 2 && blooms === capeFlowerSlotCount);
  return {
    available: farm.island === 'cape' && canSailTo(farm, 'cape') && blooms > 0 && farm.capeHoneyOn !== farm.day,
    blooms, honey: blooms - windHoney + apiaryHoney, windHoney,
  };
}

export function getCapeWax(farm: FarmState): number {
  return Number(farm.capeLevel >= 2 && getCapeHoney(farm).blooms > 0);
}

export function getCapeUpgrade(farm: FarmState) {
  if (farm.capeLevel === 3) return undefined;
  const nextLevel = farm.capeLevel === 1 ? 2 : 3;
  const definition = capeUpgradeDefinitions[nextLevel];
  const reason = farm.island !== 'cape' ? 'Visit Flower Cape to build this upgrade.'
    : !canSailTo(farm, 'cape') ? 'Open the Flower Cape boat route first.'
    : nextLevel === 2 && getCapeHoney(farm).blooms !== capeFlowerSlotCount ? 'Grow all three Cape flower beds to full bloom.'
    : farm.coins < definition.coins ? 'You need more coins for this upgrade.'
    : !definition.items.every((item) => ingredientCount(farm, item) >= item.quantity) ? 'Gather the upgrade materials first.' : '';
  return { ...definition, nextLevel, available: reason === '', reason } as const;
}

export function upgradeCape(farm: FarmState): ActionResult {
  const upgrade = getCapeUpgrade(farm);
  if (!upgrade) return failure('The Honey Kitchen is already complete.');
  if (!upgrade.available) return failure(upgrade.reason);
  farm.coins -= upgrade.coins;
  for (const item of upgrade.items) removeStock(farm, item);
  farm.capeLevel = upgrade.nextLevel;
  return { ok: true, message: `${upgrade.name} opened.` };
}

export function collectCapeHoney(farm: FarmState): ActionResult {
  const harvest = getCapeHoney(farm);
  if (!harvest.available) return failure('Visit blooming Cape flowers. The hive fills once each day.');
  const wax = getCapeWax(farm);
  farm.honey += harvest.honey;
  farm.windHoney += harvest.windHoney;
  farm.beeswax += wax;
  farm.capeHoneyOn = farm.day;
  if (harvest.honey > 0) discoverBay(farm, 'honey');
  if (harvest.windHoney > 0) discoverBay(farm, 'windHoney');
  if (wax > 0) discoverBay(farm, 'beeswax');
  farm.workToday += 1;
  return { ok: true, message: `Collected ${harvest.honey} flower honey${harvest.windHoney ? ', 1 wind honey' : ''}${wax ? ', 1 beeswax' : ''}.` };
}

function discoverBay(farm: FarmState, id: BayDiscoveryId): void {
  if (!farm.bayDiscoveries.includes(id)) farm.bayDiscoveries.push(id);
}

export function hasBayDisplay(farm: Pick<FarmState, 'bayDiscoveries' | 'projects'>): boolean {
  return isProjectComplete(farm, 'dock') && (['perch', 'seaBass'] as const).every((id) => farm.bayDiscoveries.includes(id));
}

export function getFairGuest(farm: FarmState) {
  if (!isProjectComplete(farm, 'fair')) return undefined;
  const harbor = farm.orders.harbor;
  const capeKnownBeforeToday = canSailTo(farm, 'cape') && (harbor.completed > 2 || harbor.deliveredOn < farm.day);
  const requests: readonly { name: string; item: StockItem; crop: CropId }[] = [
    { name: 'Mara', item: { kind: 'fruit', item: 'apple', quantity: 2 }, crop: 'carrot' },
    { name: 'Poppy', item: { kind: 'dishes', item: 'appleJam', quantity: 1 }, crop: 'wheat' },
    { name: 'Finn', item: { kind: 'produce', item: 'wheat', quantity: 3 }, crop: 'leafyGreens' },
    { name: 'Bea', item: capeKnownBeforeToday ? { kind: 'dishes', item: 'honeyCake', quantity: 1 }
      : { kind: 'produce', item: 'wheat', quantity: 3 }, crop: 'wheat' },
  ];
  const request = requests[(farm.day - 1) % requests.length];
  return {
    name: request.name, item: request.item, reward: unitPrice(request.item, farm) * request.item.quantity + 3,
    seeds: { crop: request.crop, count: 2 }, served: farm.guestServedOn === farm.day,
  };
}

export function serveFairGuest(farm: FarmState): ActionResult {
  const guest = getFairGuest(farm);
  if (farm.island !== 'home' || !guest) return failure('Meet the visitor at the completed Home fair.');
  if (guest.served) return failure('Today’s visitor has already been served.');
  if (ingredientCount(farm, guest.item) < guest.item.quantity) return failure('Bring the visitor’s requested item.');
  removeStock(farm, guest.item);
  farm.coins += guest.reward;
  farm.seeds[guest.seeds.crop] += guest.seeds.count;
  farm.guestServedOn = farm.day;
  farm.fairGuestsServed += 1;
  farm.workToday += 1;
  return { ok: true, message: `${guest.name} thanks you and leaves ${guest.reward} coins and ${guest.seeds.count} ${cropDefinitions[guest.seeds.crop].name.toLowerCase()} seeds.` };
}

const workshopIngredients: readonly StockItem[] = [
  { kind: 'produce', item: 'wheat', quantity: 2 }, { kind: 'eggs', quantity: 1 },
];

export function getWorkshopAction(farm: FarmState): { available: boolean; label: string } {
  if (!isProjectComplete(farm, 'fair')) return { available: false, label: 'Complete the Market fair to open the pastry workshop.' };
  if (farm.island !== 'home' && !(farm.island === 'village' && farm.village.built)) return { available: false, label: 'Visit the Home or Lavender Harbour pastry workshop.' };
  if (!workshopIngredients.every((item) => ingredientCount(farm, item) >= item.quantity)) {
    return { available: false, label: 'Bring 2 wheat and 1 egg to shape a pastry.' };
  }
  return { available: true, label: 'Shape and bake a pastry' };
}

export function bakeWorkshop(farm: FarmState, shape: WorkshopShape): ActionResult {
  if (!isId(workshopShapes, shape)) return failure('Shape a round bun, folded pastry or long loaf.');
  const action = getWorkshopAction(farm);
  if (!action.available) return failure(action.label);
  for (const item of workshopIngredients) removeStock(farm, item);
  farm.handmade[shape] += 1;
  if (!farm.workshopPatterns.includes(shape)) farm.workshopPatterns.push(shape);
  farm.workToday += 1;
  return { ok: true, message: `Baked a ${workshopDefinitions[shape].name.toLowerCase()}. Pattern saved.` };
}

const villageRequirements: readonly StockItem[] = [
  { kind: 'handmade', item: 'round', quantity: 2 },
  { kind: 'fish', item: 'seaBass', quantity: 2 },
  { kind: 'honey', quantity: 2 },
];
const villagePrice = 80;

export function getVillageHomeCount(farm: FarmState): number {
  return farm.village.built ? farm.village.meals >= 2 ? 2 : 1 : 0;
}

export function getVillageProject(farm: FarmState) {
  const unlocked = isProjectComplete(farm, 'fair') && farm.fairGuestsServed >= 3;
  const items = supplyProgress(farm, villageRequirements, farm.village.supplies, farm.village.built);
  const supplied = items.every(({ item, delivered }) => delivered === item.quantity);
  const status: 'locked' | 'waiting' | 'ready' | 'completed' = farm.village.built ? 'completed'
    : !unlocked || farm.island !== 'home' ? 'locked'
    : items.some(({ available }) => available > 0) || supplied && farm.coins >= villagePrice ? 'ready' : 'waiting';
  return { name: 'Living Bay', coins: villagePrice, items, status, unlocked, homes: getVillageHomeCount(farm) } as const;
}

export function contributeVillage(farm: FarmState): ActionResult {
  const project = getVillageProject(farm);
  if (project.status === 'completed') return failure('Living Bay is already open.');
  if (project.status === 'locked') return failure('Serve three Fair visitors, then build Living Bay at Home.');
  if (project.status !== 'ready') return failure('Bring the remaining supplies and 80 coins.');
  const donated = depositSupplies(farm, project.items, farm.village.supplies);
  const supplied = villageRequirements.every((item) => farm.village.supplies[marketKey(item)] === item.quantity);
  if (supplied && farm.coins >= villagePrice) {
    farm.coins -= villagePrice;
    farm.village.built = true;
    return { ok: true, message: 'Living Bay is open! Invite a neighbour to the first cottage.' };
  }
  return { ok: true, message: `Delivered ${donated} supplies.${supplied ? ' Bring 80 coins to finish the cottages.' : ''}` };
}

export function inviteResident(farm: FarmState, id: ResidentId | null, slot: number): ActionResult {
  if (farm.island !== 'village' || !isQuantity(slot) || slot >= getVillageHomeCount(farm)) return failure('Choose an open Lavender Harbour cottage.');
  if (id !== null && !isId(residentIds, id)) return failure('Choose a neighbour to invite.');
  const oldSlot = id === null ? -1 : farm.village.residents.indexOf(id);
  if (oldSlot === slot) return failure('This neighbour already lives here.');
  if (oldSlot >= 0) farm.village.residents[oldSlot] = farm.village.residents[slot];
  farm.village.residents[slot] = id;
  return { ok: true, message: id ? `${residentDefinitions[id].name} has moved into the cottage.` : 'The cottage is ready for another neighbour.' };
}

export function getVillageMeal(farm: FarmState, shape: WorkshopShape = farm.workshopPatterns[0] ?? 'round') {
  const fish: FishId = farm.village.residents.includes('finn') ? 'seaBass' : 'perch';
  const items: readonly StockItem[] = [{ kind: 'handmade', item: shape, quantity: 1 }, { kind: 'fish', item: fish, quantity: 1 }];
  const served = farm.village.mealOn === farm.day;
  const available = farm.island === 'village' && farm.village.built && !served && isId(workshopShapes, shape)
    && items.every((item) => ingredientCount(farm, item) >= item.quantity);
  return { available, served, items, shape, fish, meals: farm.village.meals,
    label: served ? 'The neighbours enjoyed today’s meal.' : 'Share 1 handmade pastry and 1 fish at the communal table.' };
}

export function serveVillageMeal(farm: FarmState, shape: WorkshopShape): ActionResult {
  if (!isId(workshopShapes, shape)) return failure('Choose a handmade pastry.');
  const meal = getVillageMeal(farm, shape);
  if (!meal.available) return failure(meal.label);
  for (const item of meal.items) removeStock(farm, item);
  farm.village.meals += 1;
  farm.village.mealOn = farm.day;
  farm.workToday += 1;
  return { ok: true, message: `Shared a warm meal with the neighbours.${farm.village.meals === 2 ? ' The second cottage is ready!' : ''}` };
}

export function getResidentService(farm: FarmState, id: ResidentId, shape: WorkshopShape = farm.workshopPatterns[0] ?? 'round') {
  const present = isId(residentIds, id) && farm.island === 'village' && farm.village.built && farm.village.residents.includes(id);
  const used = isId(residentIds, id) && farm.village.serviceOn[id] === farm.day;
  const known = isId(workshopShapes, shape) && farm.workshopPatterns.includes(shape);
  const ingredients = farm.produce.wheat >= 4 && farm.eggs >= 2;
  const available = present && !used && (id === 'finn' ? !farm.village.scouting : known && ingredients);
  const label = !present ? 'Invite this neighbour to a Lavender Harbour cottage.' : used ? 'Your neighbour has helped today.'
    : id === 'finn' ? farm.village.scouting ? 'Scouting is ready for your next fishing trip.' : 'Scout the next fishing trip'
    : !known ? 'Discover this pastry pattern in the workshop first.' : !ingredients ? 'Bring 4 wheat and 2 eggs for three pastries.' : 'Ask Bea to bake three pastries';
  return { available, label, used, shape };
}

export function runResidentService(farm: FarmState, id: ResidentId, shape: WorkshopShape = farm.workshopPatterns[0] ?? 'round'): ActionResult {
  const action = getResidentService(farm, id, shape);
  if (!action.available) return failure(action.label);
  farm.village.serviceOn[id] = farm.day;
  if (id === 'finn') farm.village.scouting = true;
  else {
    farm.produce.wheat -= 4;
    farm.eggs -= 2;
    farm.handmade[shape] += 3;
  }
  farm.workToday += 1;
  return { ok: true, message: id === 'finn' ? 'Finn scouted a safer route. Your next hook holds one extra fish.'
    : `Bea baked three ${workshopDefinitions[shape].name.toLowerCase()} pastries.` };
}

export function gatherSeaSalt(farm: FarmState): ActionResult {
  if (farm.island !== 'grove') return failure('Sea salt gathers in the Saltwind Grove tidal pools.');
  if (farm.saltGatheredToday) return failure('More sea salt will gather overnight.');
  farm.saltGatheredToday = true;
  farm.seaSalt += 2;
  farm.workToday += 1;
  return { ok: true, message: 'Gathered 2 sea salt from the tidal pool.' };
}

function isShellSpot(spot: unknown): spot is number {
  return isQuantity(spot) && spot < shellSpotCount;
}

export function getShellAt(farm: Pick<FarmState, 'day' | 'shellsCollectedToday'>, spot: number): ShellId | undefined {
  if (isShellSpot(spot) && !farm.shellsCollectedToday.includes(spot)) return shellForSpot(farm.day, spot);
  return undefined;
}

export type ShoreTarget = { kind: 'shell'; index: number } | { kind: 'shoal-find'; id: ShoalFindId };

export function getShoreItem(farm: FarmState, target: ShoreTarget) {
  if (target.kind === 'shell') {
    const id = getShellAt(farm, target.index);
    return id ? shellDefinitions[id] : undefined;
  }
  const id = getShoalFindAt(farm, target.id);
  return id ? shoalDefinitions[id] : undefined;
}

export function collectShell(farm: FarmState, spot: number): ActionResult {
  if (farm.island !== 'grove') return failure('Look for shells on Saltwind Grove.');
  const shell = getShellAt(farm, spot);
  if (!shell) return failure('This part of the beach is clear.');
  farm.shellsCollectedToday.push(spot);
  farm.shells[shell] += 1;
  farm.workToday += 1;
  const discovered = !farm.shellDiscoveries.includes(shell);
  if (discovered) farm.shellDiscoveries.push(shell);
  const message = `${discovered ? 'Discovered' : 'Collected'} ${shellDefinitions[shell].name.toLowerCase()}.`;
  return { ok: true, message: discovered && hasShoal(farm) ? `${message} Moonpool Shoal opened.` : message };
}

export function collectShoalFind(farm: FarmState, id: ShoalFindId): ActionResult {
  if (farm.island !== 'grove' || !getShoalFindAt(farm, id)) return failure('Look for finds on Moonpool Shoal.');
  farm.shoalCollectedToday.push(id);
  farm.shoalFinds[id] += 1;
  farm.workToday += 1;
  const discovered = !farm.shoalDiscoveries.includes(id);
  if (discovered) farm.shoalDiscoveries.push(id);
  return { ok: true, message: `${discovered ? 'Discovered' : 'Collected'} ${shoalDefinitions[id].name.toLowerCase()}.` };
}

export function upgradeBuilding(farm: FarmState, building: BuildingId): ActionResult {
  if (!isId(buildingIds, building) || farm.island !== 'home') return failure('Choose a building on your farm.');
  const definition = buildingDefinitions[building];
  if (farm.buildingLevels[building] >= 2) return failure(`${definition.name} is already upgraded.`);
  if (farm.coins < definition.upgradePrice) return failure('You need more coins for this upgrade.');
  farm.coins -= definition.upgradePrice;
  farm.buildingLevels[building] = 2;
  if (building === 'well') farm.water = getWaterCapacity(farm);
  return { ok: true, message: `${definition.name} upgraded.` };
}

export function specializeFarmhouse(farm: FarmState, id: SpecializationId): ActionResult {
  if (farm.island !== 'home' || !isId(specializationIds, id)) return failure('Choose a specialization at the farmhouse.');
  if (farm.farmhouseSpecialization !== null) return failure('The farmhouse already has a specialization.');
  if (farm.buildingLevels.farmhouse !== 2) return failure('Upgrade the farmhouse to level 2 first.');
  const definition = specializationDefinitions[id];
  if (farm.coins < definition.price) return failure('You need more coins for this specialization.');
  farm.coins -= definition.price;
  farm.buildingLevels.farmhouse = 3;
  farm.farmhouseSpecialization = id;
  return { ok: true, message: `${definition.name} opened.` };
}

export function specializeFacility(farm: FarmState, branch: FacilityBranch): ActionResult {
  if (farm.island !== 'home' || !isId(facilityBranchIds, branch)) return failure('Choose a specialization on your farm.');
  const coop = isId(coopSpecializationIds, branch);
  const building = coop ? 'coop' : 'well';
  const name = buildingDefinitions[building].name;
  if (farm.buildingLevels[building] === 3) return failure(`${name} already has a specialization.`);
  if (farm.buildingLevels[building] !== 2) return failure(`Upgrade the ${name.toLowerCase()} to level 2 first.`);
  const definition = coop ? facilitySpecializations.coop[branch] : facilitySpecializations.well[branch];
  if (farm.coins < definition.price) return failure('You need more coins for this specialization.');
  farm.coins -= definition.price;
  farm.buildingLevels[building] = 3;
  if (coop) farm.coopSpecialization = branch;
  else farm.wellSpecialization = branch;
  return { ok: true, message: `${definition.name} opened.` };
}

export function getCookAction(farm: FarmState, dish: DishId): { available: boolean; label: string } {
  if (!isId(dishIds, dish)) return { available: false, label: 'Choose a recipe.' };
  const definition = dishDefinitions[dish];
  if (definition.capeLevel) {
    if (farm.island !== 'cape') return { available: false, label: 'Cook in the Flower Cape Honey Kitchen.' };
    if (farm.capeLevel < definition.capeLevel) return { available: false, label: 'Build the Honey Kitchen on Flower Cape to cook this dish.' };
  } else if (farm.island !== 'home') return { available: false, label: 'Cook in the farmhouse kitchen.' };
  if (dish === 'honeyCake' && !canSailTo(farm, 'cape')) return { available: false, label: 'Open the Flower Cape boat route to discover this recipe.' };
  if (definition.specialization && farm.farmhouseSpecialization !== definition.specialization) {
    return { available: false, label: `Requires the ${specializationDefinitions[definition.specialization].name.toLowerCase()}.` };
  }
  if (farm.buildingLevels.farmhouse < definition.requiredLevel) return { available: false, label: 'Upgrade the farmhouse to cook this dish.' };
  if (!definition.ingredients.every((ingredient) => ingredientCount(farm, ingredient) >= ingredient.quantity)) {
    return { available: false, label: 'Gather the ingredients first.' };
  }
  return { available: true, label: `Cook ${definition.name.toLowerCase()}` };
}

export function cookDish(farm: FarmState, dish: DishId): ActionResult {
  const action = getCookAction(farm, dish);
  if (!action.available) return failure(action.label);
  const definition = dishDefinitions[dish];
  for (const ingredient of definition.ingredients) removeStock(farm, ingredient);
  farm.dishes[dish] += 1;
  discoverBay(farm, dish);
  farm.workToday += 1;
  return { ok: true, message: `Cooked ${definition.name.toLowerCase()}.` };
}

export function ingredientCount(farm: FarmState, ingredient: StockItem): number {
  if ('item' in ingredient) {
    // The discriminant ties each item ID to its inventory.
    switch (ingredient.kind) {
      case 'produce': return farm.produce[ingredient.item];
      case 'fruit': return farm.fruit[ingredient.item];
      case 'fish': return farm.fish[ingredient.item];
      case 'dishes': return farm.dishes[ingredient.item];
      case 'handmade': return farm.handmade[ingredient.item];
      case 'shells': return farm.shells[ingredient.item];
      case 'shoalFinds': return farm.shoalFinds[ingredient.item];
      case 'variants': return farm.variants[ingredient.item]?.[ingredient.trait] ?? 0;
    }
  }
  return farm[ingredient.kind];
}

function removeStock(farm: FarmState, item: StockItem): void {
  switch (item.kind) {
    case 'produce': farm.produce[item.item] -= item.quantity; break;
    case 'fruit': farm.fruit[item.item] -= item.quantity; break;
    case 'fish': farm.fish[item.item] -= item.quantity; break;
    case 'dishes': farm.dishes[item.item] -= item.quantity; break;
    case 'handmade': farm.handmade[item.item] -= item.quantity; break;
    case 'shells': farm.shells[item.item] -= item.quantity; break;
    case 'shoalFinds': farm.shoalFinds[item.item] -= item.quantity; break;
    case 'variants': {
      const stock = farm.variants[item.item]!;
      const remaining = (stock[item.trait] ?? 0) - item.quantity;
      if (remaining > 0) stock[item.trait] = remaining;
      else delete stock[item.trait];
      break;
    }
    case 'eggs':
    case 'eggBaskets':
    case 'eggCrates':
    case 'honey':
    case 'windHoney':
    case 'beeswax':
    case 'seaSalt': farm[item.kind] -= item.quantity; break;
  }
}

function marketOrder(farm: FarmState, lane: OrderLane, menu: readonly Order[]) {
  const ledger = farm.orders[lane];
  const delivered = ledger.deliveredOn === farm.day;
  const order = menu[(ledger.completed - Number(delivered)) % menu.length];
  const status: 'delivered' | 'upgrade' | 'ready' | 'waiting' = delivered ? 'delivered'
    : order.upgradedKitchen && farm.buildingLevels.farmhouse < dishDefinitions.grilledFish.requiredLevel ? 'upgrade'
    : order.items.every((item) => ingredientCount(farm, item) >= item.quantity) ? 'ready' : 'waiting';
  return { ...order, lane, status } as const;
}

export function getMarketOrders(farm: FarmState) {
  return orderLanes.flatMap((lane) => {
    const menu = marketOrderMenu(farm, lane);
    return menu ? [marketOrder(farm, lane, menu)] : [];
  });
}

function marketOrderMenu(farm: FarmState, lane: OrderLane): readonly Order[] | undefined {
  if (lane === 'harbor') return undefined;
  if (lane === 'cape') return canSailTo(farm, 'cape') ? capeMenus : undefined;
  if (lane === 'apiary') return farm.capeLevel >= 2 ? apiaryMenus : undefined;
  if (lane === 'honeyKitchen') return farm.capeLevel === 3 ? honeyKitchenMenus : undefined;
  if (lane === 'specialty') return farm.farmhouseSpecialization ? specialtyMenus[farm.farmhouseSpecialization] : undefined;
  if (lane === 'flock') return farm.coopSpecialization ? facilityMenus[farm.coopSpecialization] : undefined;
  if (lane === 'waterworks') return farm.wellSpecialization ? facilityMenus[farm.wellSpecialization] : undefined;
  if (lane === 'grove' && !farm.boatOwned) return undefined;
  const building = orderUpgrades[lane];
  return !building || farm.buildingLevels[building] >= 2 ? orderMenus[lane] : undefined;
}

export function deliverMarketOrder(farm: FarmState, lane: OrderLane): ActionResult {
  if (farm.island !== 'home' || !isId(orderLanes, lane)) return failure('Order unavailable.');
  const menu = marketOrderMenu(farm, lane);
  if (!menu) return failure('Order unavailable.');
  const order = marketOrder(farm, lane, menu);
  if (order.status === 'delivered') return failure('Already delivered.');
  if (order.status === 'upgrade') return failure('Upgrade the farmhouse to level 2.');
  if (order.status !== 'ready') return failure('Some items are still missing.');
  for (const item of order.items) removeStock(farm, item);
  farm.coins += order.reward;
  farm.orders[lane].completed += 1;
  farm.orders[lane].deliveredOn = farm.day;
  return record(farm, 'sell', `Delivered for ${order.reward} coins.`);
}

export function petChicken(farm: FarmState, id: number): ActionResult {
  if (farm.island !== 'home' || !isChickenId(id, farm.flockSize)) return failure('Choose one of your hens.');
  if (farm.pettedChickens.includes(id)) return failure('This hen has had her cuddle today.');
  farm.pettedChickens.push(id);
  farm.chickenHappiness = Math.min(maxChickenHappiness, farm.chickenHappiness + 1);
  return { ok: true, message: 'Your hen clucks happily.' };
}

export function getSale(farm: FarmState): { items: number; coins: number } {
  let items = 0;
  let coins = 0;
  for (const item of marketStock) {
    const count = ingredientCount(farm, item);
    items += count;
    coins += count * unitPrice(item, farm);
  }
  return { items, coins };
}

function unitPrice(item: StockItem, farm: FarmState): number {
  switch (item.kind) {
    case 'produce': return cropDefinitions[item.item].sellPrice + Number(isProjectComplete(farm, 'fair'));
    case 'fruit': return treeDefinitions[item.item].sellPrice;
    case 'fish': return fishDefinitions[item.item].sellPrice;
    case 'dishes': return dishDefinitions[item.item].sellPrice;
    case 'handmade': return workshopDefinitions[item.item].sellPrice;
    case 'shells': return shellDefinitions[item.item].price;
    case 'shoalFinds': return shoalDefinitions[item.item].price;
    case 'variants': return resourceDefinition(item.item).sellPrice * 2
      + Number(isId(cropIds, item.item) && isProjectComplete(farm, 'fair'));
    case 'eggs': return eggPrice;
    case 'eggBaskets': return eggBasketPrice;
    case 'eggCrates': return eggCratePrice;
    case 'seaSalt': return seaSaltPrice;
    case 'honey': return honeyPrice;
    case 'windHoney': return windHoneyPrice;
    case 'beeswax': return beeswaxPrice;
  }
}

function marketKey(item: StockItem): string {
  if (item.kind === 'variants') return `variants:${item.item}:${item.trait}`;
  return 'item' in item ? `${item.kind}:${item.item}` : item.kind;
}

export function isProjectComplete(farm: Pick<FarmState, 'projects'>, id: ProjectId): boolean {
  return projectDefinitions[id].items.every((item) => farm.projects[id][marketKey(item)] === item.quantity);
}

function supplyProgress(farm: FarmState, requirements: readonly StockItem[], ledger: Record<string, number>, complete = false) {
  return requirements.map((item) => {
    const delivered = complete ? item.quantity : ledger[marketKey(item)] ?? 0;
    return { item, delivered, available: Math.min(item.quantity - delivered, ingredientCount(farm, item)) };
  });
}

export function getProject(farm: FarmState, id: ProjectId) {
  const definition = projectDefinitions[id];
  const items = supplyProgress(farm, definition.items, farm.projects[id]);
  const unlocked = id === 'fair' ? buildingIds.every((building) => farm.buildingLevels[building] >= 2) : farm.boatOwned;
  const status: 'locked' | 'waiting' | 'ready' | 'completed' = isProjectComplete(farm, id) ? 'completed'
    : !unlocked || farm.island !== definition.island ? 'locked'
    : items.some(({ available }) => available > 0) ? 'ready' : 'waiting';
  return { ...definition, id, items, status } as const;
}

export function deliverProject(farm: FarmState, id: ProjectId): ActionResult {
  if (!isId(projectIds, id)) return failure('Choose a project.');
  const project = getProject(farm, id);
  if (project.status === 'completed') return failure('Project complete.');
  if (project.status === 'locked') return failure('Project unavailable here.');
  if (project.status !== 'ready') return failure('No supplies to deliver.');
  const donated = depositSupplies(farm, project.items, farm.projects[id]);
  if (isProjectComplete(farm, id)) {
    farm.coins += project.reward;
    return { ok: true, message: `${project.name} complete. +${project.reward} coins.` };
  }
  return { ok: true, message: `Delivered ${donated} ${donated === 1 ? 'item' : 'items'}.` };
}

function depositSupplies(farm: FarmState, items: ReturnType<typeof supplyProgress>, ledger: Record<string, number>) {
  let donated = 0;
  for (const { item, delivered, available } of items) {
    if (available === 0) continue;
    removeStock(farm, { ...item, quantity: available });
    ledger[marketKey(item)] = delivered + available;
    donated += available;
  }
  farm.workToday += 1;
  return donated;
}

function harborMenu(branch: SpecializationId, index: number): Order {
  const meal = { kind: 'dishes', item: specializationDefinitions[branch].dish, quantity: 1 } as const;
  return index % 2 === 0
    ? { name: 'Harbor supper', reward: 36, items: [meal, { kind: 'fish', item: 'seaBass', quantity: 1 }] }
    : { name: 'Saltwind parcel', reward: 34, items: [meal, { kind: 'seaSalt', quantity: 2 }] };
}

export function getHarborOrder(farm: FarmState) {
  if (!farm.boatOwned || !farm.farmhouseSpecialization || !isProjectComplete(farm, 'dock')) return undefined;
  const ledger = farm.orders.harbor;
  const complete = ledger.deliveredOn === farm.day;
  const order = harborMenu(farm.farmhouseSpecialization, ledger.completed - Number(complete));
  const items = supplyProgress(farm, order.items, farm.harborSupplies, complete);
  const status = complete ? 'completed' : farm.island !== 'grove' ? 'locked'
    : items.some(({ available }) => available > 0) ? 'ready' : 'waiting';
  return { ...order, items, status } as const;
}

export function deliverHarborOrder(farm: FarmState): ActionResult {
  const order = getHarborOrder(farm);
  if (!order || farm.island !== 'grove') return failure('Deliver at the Grove landing.');
  if (order.status === 'completed') return failure('Already delivered.');
  if (order.status !== 'ready') return failure('No supplies to deliver.');
  const donated = depositSupplies(farm, order.items, farm.harborSupplies);
  if (order.items.every(({ item }) => farm.harborSupplies[marketKey(item)] === item.quantity)) {
    farm.coins += order.reward;
    farm.orders.harbor.completed += 1;
    farm.orders.harbor.deliveredOn = farm.day;
    farm.harborSupplies = {};
    return { ok: true, message: `Delivered for ${order.reward} coins.` };
  }
  return { ok: true, message: `Delivered ${donated} ${donated === 1 ? 'item' : 'items'}.` };
}

export function getMarketStock(farm: FarmState) {
  return marketStock.flatMap((item) => {
    const count = ingredientCount(farm, item);
    return (item.kind === 'variants' || item.kind === 'shells' || item.kind === 'shoalFinds') && count === 0 ? []
      : [{ item, key: marketKey(item), count, price: unitPrice(item, farm) }];
  });
}

export function sellMarketItem(farm: FarmState, key: string): ActionResult {
  if (farm.island !== 'home') return failure('Sell at the market.');
  const item = marketStock.find((entry) => marketKey(entry) === key);
  if (!item || ingredientCount(farm, item) < 1) return failure('That item is out of stock.');
  const price = unitPrice(item, farm);
  removeStock(farm, item);
  farm.coins += price;
  return record(farm, 'sell', `Sold for ${price} coins.`);
}

export function sellProduce(farm: FarmState): ActionResult {
  const { items, coins } = getSale(farm);
  if (items === 0) return failure('Bring something from your farm or the islands to sell.');
  farm.coins += coins;
  farm.produce = emptyProduce();
  farm.eggs = 0;
  farm.eggBaskets = 0;
  farm.eggCrates = 0;
  for (const tree of treeIds) farm.fruit[tree] = 0;
  for (const fish of fishIds) farm.fish[fish] = 0;
  for (const dish of dishIds) farm.dishes[dish] = 0;
  for (const shape of workshopShapes) farm.handmade[shape] = 0;
  farm.seaSalt = 0;
  farm.honey = 0;
  farm.windHoney = 0;
  farm.beeswax = 0;
  for (const shell of shellIds) farm.shells[shell] = 0;
  for (const item of shoalFindIds) farm.shoalFinds[item] = 0;
  farm.variants = {};
  return record(farm, 'sell', `Sold ${items} ${items === 1 ? 'item' : 'items'} for ${coins} coins.`);
}

export function endDay(farm: FarmState): ActionResult {
  if (farm.island !== 'home') return failure('Sail home to rest at the farmhouse.');
  farm.pendingFishingTrip = null;
  const tomorrow = farm.day + 1;
  const { weather } = getClimate(tomorrow);
  let cropsGrew = false;
  for (const [index, bed] of farm.beds.entries()) {
    if (bed.kind !== 'crop') continue;
    if (bed.watered) {
      bed.growth += 1;
      delete bed.wateredAt;
      cropsGrew = true;
    }
    bed.watered = weather === 'rain' && bed.growth < cropDefinitions[bed.crop].days;
    const trait = exposedTrait(tomorrow, weather, index + 1);
    if (!bed.trait && trait) bed.trait = trait;
  }
  for (const [islandIndex, island] of orchardIslandIds.entries()) {
    farm.fishCaughtToday[island] = 0;
    for (const [index, tree] of farm.trees[island].entries()) {
      if (!tree) continue;
      const maturity = treeDefinitions[tree.tree].days;
      tree.age = Math.min(maturity, tree.age + 1);
      if (tree.age === maturity) {
        tree.fruitReady = fruitPerHarvest;
        const trait = exposedTrait(tomorrow, weather, 100 + islandIndex * treeSlotCount + index);
        if (!tree.trait && trait) tree.trait = trait;
      }
    }
  }
  if (farm.chickensFed) {
    const upgraded = farm.buildingLevels.coop >= 2;
    const eggsLaid = 3 + Number(upgraded) + (farm.flockSize - chickenCount) + Math.floor(farm.chickenHappiness / 2);
    const before = farm.eggsReady;
    farm.eggsReady = Math.min(getNestCapacity(farm.buildingLevels.coop, farm.flockSize), farm.eggsReady + eggsLaid);
    if (farm.eggsReady > before) farm.eggTrait ??= exposedTrait(tomorrow, weather, 65) ?? null;
  }
  farm.chickenHappiness = Math.max(0, farm.chickenHappiness - 1);
  farm.pettedChickens = [];
  farm.saltGatheredToday = false;
  farm.shellsCollectedToday = [];
  farm.shoalCollectedToday = [];
  farm.chickensFed = false;
  farm.day = tomorrow;
  const hatched = farm.hatchDay === farm.day;
  if (hatched) {
    farm.flockSize = maxFlockSize;
    farm.hatchDay = null;
  }
  if (farm.wellSpecialization === 'rain') farm.water = getWaterCapacity(farm);
  farm.workToday = 0;
  const message = `Day ${farm.day} begins.${hatched ? ' A new hen hatched!' : ''}`;
  return cropsGrew ? record(farm, 'rest', message) : { ok: true, message };
}

export function getGoal(farm: FarmState): (Goal & { progress: number }) | undefined {
  const goal = goals.find(({ id, target }) => farm.progress[id] < target);
  return goal && { ...goal, progress: farm.progress[goal.id] };
}

function record(farm: FarmState, id: GoalId, message: string): ActionResult {
  if (id !== 'rest') farm.workToday += 1;
  farm.progress[id] += 1;
  const completed = goals.find((goal) => goal.id === id && goal.target === farm.progress[id]);
  if (!completed) return { ok: true, message };
  farm.coins += completed.reward;
  return { ok: true, message: `${message} Task bonus +${completed.reward} coins.` };
}

function failure(message: string): ActionResult {
  return { ok: false, message };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isQuantity(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isId<Id extends string>(ids: readonly Id[], value: unknown): value is Id {
  return ids.some((id) => id === value);
}

function isCropId(value: unknown): value is CropId {
  return isId(cropIds, value);
}

function isChickenId(value: unknown, flockSize: number): value is number {
  return isQuantity(value) && value < flockSize;
}

function isBed(value: unknown): value is Bed {
  if (!isRecord(value)) return false;
  if (value.kind === 'empty' || value.kind === 'tilled') return value.trait === undefined;
  if (value.kind !== 'crop' || !isCropId(value.crop) || !isQuantity(value.growth) || typeof value.watered !== 'boolean') return false;
  if (value.wateredAt !== undefined && (!value.watered || !isQuantity(value.wateredAt))) return false;
  if (value.trait !== undefined && !isId(traitIds, value.trait)) return false;
  const ripeAt = cropDefinitions[value.crop].days;
  return value.watered ? value.growth < ripeAt : value.growth <= ripeAt;
}

function isInventory<Id extends string>(ids: readonly Id[], value: unknown): value is Record<Id, number> {
  return isRecord(value) && ids.every((id) => isQuantity(value[id]));
}

function isUniqueList<T>(value: unknown, valid: (entry: unknown) => entry is T): value is T[] {
  return Array.isArray(value) && Array.from(value).every(valid) && new Set(value).size === value.length;
}

function isTreeSlot(value: unknown): value is TreeSlot | null {
  if (value === null) return true;
  if (!isRecord(value) || !isId(treeIds, value.tree) || !isQuantity(value.age) || !isQuantity(value.fruitReady)) return false;
  if (value.trait !== undefined && (!isId(traitIds, value.trait) || value.fruitReady === 0)) return false;
  const maturity = treeDefinitions[value.tree].days;
  return value.age <= maturity && value.fruitReady <= (value.age === maturity ? fruitPerHarvest : 0);
}

function isOrchard(value: unknown): value is (TreeSlot | null)[] {
  return Array.isArray(value) && value.length === treeSlotCount && Array.from(value).every(isTreeSlot);
}

function isOrchardMap(value: unknown): value is FarmState['trees'] {
  return isRecord(value) && orchardIslandIds.every((island) => isOrchard(value[island]));
}

function isBuildingLevels(value: unknown): value is FarmState['buildingLevels'] {
  return isRecord(value) && buildingIds.every((id) => value[id] === 1 || value[id] === 2 || value[id] === 3);
}

function restoreOrderLedger(value: unknown, day: number, ledger: OrderLedger): OrderLedger | undefined {
  if (!isRecord(value)) return undefined;
  for (const lane of orderLanes) {
    const entry = value[lane];
    if (entry === undefined && (isId(optionalOrderLanes, lane) || orderUpgrades[lane])) continue;
    if (!isRecord(entry) || !isQuantity(entry.completed) || !isQuantity(entry.deliveredOn)
      || entry.completed > entry.deliveredOn || entry.deliveredOn > day
      || (entry.completed === 0) !== (entry.deliveredOn === 0)) return undefined;
    ledger[lane] = { completed: entry.completed, deliveredOn: entry.deliveredOn };
  }
  return ledger;
}

function restoreProjectLedger(value: unknown): ProjectLedger | undefined {
  if (!isRecord(value)) return undefined;
  const projects: ProjectLedger = { fair: {}, dock: {} };
  for (const id of projectIds) {
    const entry = value[id];
    if (entry === undefined) continue;
    if (!isRecord(entry)) return undefined;
    for (const item of projectDefinitions[id].items) {
      const key = marketKey(item);
      const amount = entry[key];
      if (amount === undefined) continue;
      if (!isQuantity(amount) || amount > item.quantity) return undefined;
      projects[id][key] = amount;
    }
  }
  return projects;
}

function restoreCollection<K extends string, V>(
  value: unknown, keys: readonly K[], valid: (entry: unknown) => entry is V,
): Collection<K, V> | undefined {
  if (!isRecord(value)) return undefined;
  const collection: Collection<K, V> = {};
  for (const [id, row] of Object.entries(value)) {
    if (!isId(resourceIds, id) || !isRecord(row)) return undefined;
    const restored: Partial<Record<K, V>> = {};
    for (const [key, entry] of Object.entries(row)) {
      if (!isId(keys, key) || !valid(entry)) return undefined;
      restored[key] = entry;
    }
    collection[id] = restored;
  }
  return collection;
}

function restoreLivingBay(value: Record<string, unknown>, day: number, fairComplete: boolean, defaults: FarmState) {
  const fairGuestsServed = value.fairGuestsServed ?? Number(isQuantity(value.guestServedOn) && value.guestServedOn > 0);
  const handmade = value.handmade === undefined ? defaults.handmade : value.handmade;
  const workshopPatterns = value.workshopPatterns === undefined ? defaults.workshopPatterns : value.workshopPatterns;
  const village = value.village === undefined ? defaults.village : value.village;
  const fishingTripSerial = value.fishingTripSerial ?? 0;
  const pending = value.pendingFishingTrip ?? null;
  if (!isQuantity(fairGuestsServed) || fairGuestsServed > day || fairGuestsServed > 0 && !fairComplete) return undefined;
  if (!isInventory(workshopShapes, handmade)
    || !isUniqueList(workshopPatterns, (shape): shape is WorkshopShape => isId(workshopShapes, shape))) return undefined;
  if (workshopShapes.some((shape) => handmade[shape] > 0 && !workshopPatterns.includes(shape))
    || workshopPatterns.length > 0 && !fairComplete) return undefined;
  if (!isRecord(village) || typeof village.built !== 'boolean' || !isRecord(village.supplies)
    || !isQuantity(village.meals) || village.meals > day || !isQuantity(village.mealOn) || village.mealOn > day
    || (village.meals === 0) !== (village.mealOn === 0) || village.meals > village.mealOn
    || !isRecord(village.serviceOn) || typeof village.scouting !== 'boolean') return undefined;
  const serviceOn = village.serviceOn;
  if (!residentIds.every((id) => isQuantity(serviceOn[id]) && serviceOn[id] <= day)) return undefined;
  const supplies: Record<string, number> = {};
  for (const [key, count] of Object.entries(village.supplies)) {
    const requirement = villageRequirements.find((item) => marketKey(item) === key);
    if (!requirement || !isQuantity(count) || count > requirement.quantity) return undefined;
    supplies[key] = count;
  }
  const unlocked = fairComplete && fairGuestsServed >= 3;
  if (!unlocked && (Object.keys(supplies).length > 0 || village.built)) return undefined;
  if (village.built && !villageRequirements.every((item) => supplies[marketKey(item)] === item.quantity)) return undefined;
  const residents = village.residents;
  if (!Array.isArray(residents) || residents.length !== 2
    || !residents.every((id) => id === null || isId(residentIds, id))
    || residents[0] !== null && residents[0] === residents[1]
    || village.meals < 2 && residents[1] !== null) return undefined;
  if (!village.built && (residents.some((id) => id !== null) || village.meals > 0
    || residentIds.some((id) => (serviceOn[id] as number) > 0) || village.scouting)) return undefined;
  if (village.scouting && village.serviceOn.finn === 0) return undefined;
  const restoredVillage: VillageState = {
    built: village.built, supplies, residents: [residents[0], residents[1]], meals: village.meals,
    mealOn: village.mealOn, serviceOn: { bea: village.serviceOn.bea as number, finn: village.serviceOn.finn as number }, scouting: village.scouting,
  };
  if (!isQuantity(fishingTripSerial)) return undefined;
  let pendingFishingTrip: FishingTrip | null = null;
  if (pending !== null) {
    if (!isRecord(pending) || !isQuantity(pending.token) || pending.token === 0 || pending.token !== fishingTripSerial
      || pending.day !== day || !isId(orchardIslandIds, pending.island) || !isRecord(pending.config)) return undefined;
    const config = pending.config;
    if (typeof config.scouted !== 'boolean' || config.depth !== 120
      || config.capacity !== (config.scouted ? 3 : 2)
      || config.resilience !== (config.scouted ? 4 : 2) && config.resilience !== (config.scouted ? 2 : 1)
      || config.scouted && (restoredVillage.serviceOn.finn === 0 || !restoredVillage.built)) return undefined;
    pendingFishingTrip = { token: pending.token, day, island: pending.island,
      config: { depth: 120, capacity: config.scouted ? 3 : 2, resilience: config.scouted ? 4 : 2, scouted: config.scouted } };
  }
  return { fairGuestsServed, handmade: { ...handmade }, workshopPatterns: [...workshopPatterns],
    village: restoredVillage, fishingTripSerial, pendingFishingTrip };
}

export function restoreFarm(value: unknown): FarmState | undefined {
  if (!isRecord(value) || value.version !== 1) return undefined;
  const restored = createFarm();
  const { day, coins, water, selectedSeed, beds, seeds, produce, feed, eggs, eggsReady, chickensFed, progress } = value;
  const {
    canUpgraded = restored.canUpgraded,
    workToday = restored.workToday,
    island = restored.island,
    boatOwned = restored.boatOwned,
    trees = restored.trees,
    saplings = restored.saplings,
    fruit = restored.fruit,
    fish: savedFish = restored.fish,
    fishCaughtToday = restored.fishCaughtToday,
    capeFlowers = restored.capeFlowers,
    capeLevel = restored.capeLevel,
    capeHoneyOn = restored.capeHoneyOn,
    honey = restored.honey,
    windHoney = restored.windHoney,
    beeswax = restored.beeswax,
    bayDiscoveries: savedBayDiscoveries = restored.bayDiscoveries,
    guestServedOn = restored.guestServedOn,
    seaSalt = restored.seaSalt,
    saltGatheredToday = restored.saltGatheredToday,
    shells = restored.shells,
    shellDiscoveries = restored.shellDiscoveries,
    shellsCollectedToday = restored.shellsCollectedToday,
    shoalFinds = restored.shoalFinds,
    shoalDiscoveries = restored.shoalDiscoveries,
    shoalCollectedToday = restored.shoalCollectedToday,
    dishes: savedDishes = restored.dishes,
    eggBaskets = restored.eggBaskets,
    eggCrates = restored.eggCrates,
    eggTrait = restored.eggTrait,
    buildingLevels = restored.buildingLevels,
    farmhouseSpecialization = restored.farmhouseSpecialization,
    coopSpecialization = restored.coopSpecialization,
    wellSpecialization = restored.wellSpecialization,
    flockSize = restored.flockSize,
    hatchDay = restored.hatchDay,
    chickenHappiness = restored.chickenHappiness,
    pettedChickens = restored.pettedChickens,
    orders: savedOrders = restored.orders,
    projects: savedProjects = restored.projects,
    harborSupplies: savedHarborSupplies = restored.harborSupplies,
    variants: savedVariants = restored.variants,
    discoveries: savedDiscoveries = restored.discoveries,
  } = value;
  if (!isRecord(savedFish)) return undefined;
  const fish = { moonfish: 0, lanternfish: 0, ...savedFish };
  if (!isQuantity(day) || day === 0 || !isQuantity(coins)) return undefined;
  const orders = restoreOrderLedger(savedOrders, day, restored.orders);
  const projects = restoreProjectLedger(savedProjects);
  const livingBay = projects && restoreLivingBay(value, day, isProjectComplete({ projects }, 'fair'), restored);
  if (!livingBay) return undefined;
  const variants = restoreCollection(savedVariants, traitIds, (entry): entry is number => isQuantity(entry) && entry > 0);
  const discoveries = restoreCollection(savedDiscoveries, discoveryIds, (entry): entry is true => entry === true);
  if (!orders || !projects || !variants || !discoveries || !isRecord(savedDishes)) return undefined;
  const dishes = { appleJam: 0, farmhouseBread: 0, orchardPreserves: 0, honeyCake: 0, honeyBiscuits: 0, honeyPear: 0, windParfait: 0, ...savedDishes };
  if (typeof canUpgraded !== 'boolean' || !isQuantity(workToday) || !isBuildingLevels(buildingLevels)) return undefined;
  if (farmhouseSpecialization !== null && !isId(specializationIds, farmhouseSpecialization)) return undefined;
  if (coopSpecialization !== null && !isId(coopSpecializationIds, coopSpecialization)) return undefined;
  if (wellSpecialization !== null && !isId(wellSpecializationIds, wellSpecialization)) return undefined;
  if ((buildingLevels.farmhouse === 3) !== (farmhouseSpecialization !== null)) return undefined;
  if ((buildingLevels.coop === 3) !== (coopSpecialization !== null)) return undefined;
  if ((buildingLevels.well === 3) !== (wellSpecialization !== null)) return undefined;
  if (farmhouseSpecialization === null && orders.specialty.completed > 0) return undefined;
  if (coopSpecialization === null && orders.flock.completed > 0) return undefined;
  if (wellSpecialization === null && orders.waterworks.completed > 0) return undefined;
  if (flockSize !== chickenCount && (coopSpecialization !== 'hatchery' || flockSize !== maxFlockSize)) return undefined;
  if (hatchDay !== null && (coopSpecialization !== 'hatchery' || flockSize !== chickenCount
    || !isQuantity(hatchDay) || hatchDay <= day || hatchDay - day > incubationDays)) return undefined;
  if (!isQuantity(water) || water > getWaterCapacity({ canUpgraded, buildingLevels, wellSpecialization }) || !isCropId(selectedSeed)) return undefined;
  if (!Array.isArray(beds) || beds.length !== bedCount || !Array.from(beds).every(isBed)) return undefined;
  if (!isInventory(cropIds, seeds) || !isInventory(cropIds, produce)) return undefined;
  if (!isQuantity(feed) || !isQuantity(eggs) || !isQuantity(eggBaskets) || !isQuantity(eggsReady)
    || eggsReady > getNestCapacity(buildingLevels.coop, flockSize)) return undefined;
  if (eggTrait !== null && (eggsReady === 0 || !isId(traitIds, eggTrait))) return undefined;
  if (!isQuantity(eggCrates) || (eggCrates > 0 && coopSpecialization !== 'packing')) return undefined;
  if (typeof chickensFed !== 'boolean' || !isRecord(progress)) return undefined;
  if (!isId(islandIds, island) || typeof boatOwned !== 'boolean' || (!boatOwned && island !== 'home')) return undefined;
  const capeUnlocked = canSailTo({ boatOwned, orders }, 'cape');
  if (!Array.isArray(capeFlowers) || capeFlowers.length !== capeFlowerSlotCount
    || !Array.from(capeFlowers).every((plantedOn) => plantedOn === null || isQuantity(plantedOn) && plantedOn > 0 && plantedOn <= day)) return undefined;
  if (capeLevel !== 1 && capeLevel !== 2 && capeLevel !== 3) return undefined;
  if (!isQuantity(capeHoneyOn) || capeHoneyOn > day || !isQuantity(honey) || !isQuantity(windHoney) || !isQuantity(beeswax)) return undefined;
  if (capeHoneyOn > 0 && !capeFlowers.some((plantedOn) => plantedOn !== null && plantedOn < capeHoneyOn)) return undefined;
  if (!isQuantity(guestServedOn) || guestServedOn > day || guestServedOn > 0 && !isProjectComplete({ projects }, 'fair')) return undefined;
  if ((guestServedOn > 0) !== (livingBay.fairGuestsServed > 0) || livingBay.fairGuestsServed > guestServedOn) return undefined;
  if (island === 'village' && !livingBay.village.built) return undefined;
  if (!isUniqueList(savedBayDiscoveries, (id): id is BayDiscoveryId => isId(bayDiscoveryIds, id))) return undefined;
  const apiaryGoods = beeswax > 0 || savedBayDiscoveries.includes('beeswax') || orders.apiary.completed > 0;
  const kitchenGoods = capeDishIds.some((id) => dishes[id] > 0 || savedBayDiscoveries.includes(id)) || orders.honeyKitchen.completed > 0;
  if (capeLevel > 1 && (capeHoneyOn === 0 || !capeFlowers.every((plantedOn) => plantedOn !== null && plantedOn < day))) return undefined;
  if (capeLevel < 2 && apiaryGoods || capeLevel < 3 && kitchenGoods) return undefined;
  if (!capeUnlocked && (island === 'cape' || capeFlowers.some((entry) => entry !== null) || capeHoneyOn > 0
    || capeLevel > 1 || apiaryGoods || kitchenGoods || honey > 0 || windHoney > 0 || dishes.honeyCake > 0 || orders.cape.completed > 0
    || savedBayDiscoveries.some((id) => id === 'honey' || id === 'windHoney' || id === 'honeyCake'))) return undefined;
  const capeStock = apiaryGoods || kitchenGoods || honey > 0 || windHoney > 0 || dishes.honeyCake > 0 || orders.cape.completed > 0
    || savedBayDiscoveries.some((id) => id === 'honey' || id === 'windHoney' || id === 'honeyCake');
  if (capeStock && capeHoneyOn === 0) return undefined;
  const lastWindDay = 8 + Math.floor((capeHoneyOn - 8) / 5) * 5;
  if ((windHoney > 0 || savedBayDiscoveries.includes('windHoney') || dishes.windParfait > 0 || savedBayDiscoveries.includes('windParfait')) && (capeHoneyOn < 8
    || !capeFlowers.some((plantedOn) => plantedOn !== null && plantedOn < lastWindDay))) return undefined;
  if (!isRecord(savedHarborSupplies)) return undefined;
  const harborLedger = orders.harbor;
  const harborItems = boatOwned && farmhouseSpecialization && isProjectComplete({ projects }, 'dock')
    ? harborMenu(farmhouseSpecialization, harborLedger.completed).items : [];
  const harborSupplies: FarmState['harborSupplies'] = {};
  if (!harborItems.length && harborLedger.completed > 0) return undefined;
  for (const [key, amount] of Object.entries(savedHarborSupplies)) {
    const item = harborItems.find((candidate) => marketKey(candidate) === key);
    if (!item || harborLedger.deliveredOn === day || !isQuantity(amount) || amount > item.quantity) return undefined;
    harborSupplies[key] = amount;
  }
  if (harborItems.length && harborItems.every((item) => harborSupplies[marketKey(item)] === item.quantity)) return undefined;
  if (!isOrchardMap(trees) || !isInventory(treeIds, saplings) || !isInventory(treeIds, fruit)) return undefined;
  if (!isInventory(fishIds, fish) || !isInventory(orchardIslandIds, fishCaughtToday)
    || orchardIslandIds.some((id) => fishCaughtToday[id] > getFishLimit({ island, projects }, id))) return undefined;
  if (!isQuantity(seaSalt) || typeof saltGatheredToday !== 'boolean' || !isInventory(dishIds, dishes)) return undefined;
  const isShoalFind = (id: unknown): id is ShoalFindId => isId(shoalFindIds, id);
  if (!isInventory(shellIds, shells) || !isUniqueList(shellDiscoveries, (id): id is ShellId => isId(shellIds, id))
    || !isUniqueList(shellsCollectedToday, isShellSpot) || !isInventory(shoalFindIds, shoalFinds)
    || !isUniqueList(shoalDiscoveries, isShoalFind) || !isUniqueList(shoalCollectedToday, isShoalFind)) return undefined;
  const knownShells = shellIds.filter((id) => shellDiscoveries.includes(id) || shells[id] > 0);
  if (!hasShoal({ shellDiscoveries: knownShells }) && (shoalCollectedToday.length || shoalDiscoveries.length
    || shoalFindIds.some((id) => shoalFinds[id] > 0))) return undefined;
  if (shoalCollectedToday.some((id) => !getShoalFindAt({ day, shellDiscoveries: knownShells, shoalCollectedToday: [] }, id))) return undefined;
  if (specializationIds.some((id) => id !== farmhouseSpecialization && dishes[specializationDefinitions[id].dish] > 0)) return undefined;
  if (!isQuantity(chickenHappiness) || chickenHappiness > maxChickenHappiness) return undefined;
  if (!Array.isArray(pettedChickens) || !Array.from(pettedChickens).every((id) => isChickenId(id, flockSize))
    || new Set(pettedChickens).size !== pettedChickens.length) return undefined;
  for (const { id } of goals) {
    const count = progress[id];
    if (!isQuantity(count)) return undefined;
    restored.progress[id] = count;
  }
  const orientation = value.orientation === undefined ? { collections: boatOwned, islands: boatOwned } : value.orientation;
  if (!isRecord(orientation) || typeof orientation.collections !== 'boolean' || typeof orientation.islands !== 'boolean') return undefined;
  for (const id of resourceIds) {
    const ordinary = id === 'egg' ? eggs : isId(treeIds, id) ? fruit[id] : produce[id];
    if (value.discoveries === undefined && ordinary > 0) (discoveries[id] ??= {}).regular = true;
    for (const trait of traitIds) {
      if (variants[id]?.[trait]) (discoveries[id] ??= {})[trait] = true;
    }
  }
  const bayDiscoveries = [...savedBayDiscoveries];
  if (value.bayDiscoveries === undefined) {
    for (const id of bayDiscoveryIds) {
      const count = isId(fishIds, id) ? fish[id] : isId(treeIds, id) ? fruit[id]
        : isId(dishIds, id) ? dishes[id] : id === 'honey' ? honey : id === 'windHoney' ? windHoney : beeswax;
      if (count > 0) bayDiscoveries.push(id);
    }
  }
  return {
    version: 1,
    ...livingBay,
    day,
    workToday,
    coins,
    water,
    canUpgraded,
    selectedSeed,
    beds: beds.map((bed) => ({ ...bed })),
    seeds: { ...seeds },
    produce: { ...produce },
    feed,
    eggs,
    eggBaskets,
    eggCrates,
    eggsReady,
    eggTrait,
    chickensFed,
    island,
    boatOwned,
    trees: {
      home: trees.home.map((tree) => tree && { ...tree }),
      grove: trees.grove.map((tree) => tree && { ...tree }),
    },
    saplings: { ...saplings },
    fruit: { ...fruit },
    fish: { ...fish },
    fishCaughtToday: { ...fishCaughtToday },
    capeFlowers: [...capeFlowers],
    capeLevel,
    capeHoneyOn,
    honey,
    windHoney,
    beeswax,
    bayDiscoveries,
    guestServedOn,
    seaSalt,
    saltGatheredToday,
    shells: { ...shells },
    shellDiscoveries: knownShells,
    shellsCollectedToday: [...shellsCollectedToday],
    shoalFinds: { ...shoalFinds },
    shoalDiscoveries: shoalFindIds.filter((id) => shoalDiscoveries.includes(id) || shoalFinds[id] > 0),
    shoalCollectedToday: [...shoalCollectedToday],
    dishes: { ...dishes },
    buildingLevels: { ...buildingLevels },
    farmhouseSpecialization,
    coopSpecialization,
    wellSpecialization,
    flockSize,
    hatchDay,
    chickenHappiness,
    pettedChickens: [...pettedChickens],
    progress: restored.progress,
    orientation: { collections: orientation.collections, islands: orientation.islands },
    orders,
    projects,
    harborSupplies,
    variants,
    discoveries,
  };
}
