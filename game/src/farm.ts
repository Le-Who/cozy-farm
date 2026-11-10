import { createBayShop, restoreBayShop, advanceBayShopDay, syncBayShopProducts, type BayShopState } from './bay-shop-model.ts';
import { bayProductId } from './bay-product-id.ts';
import { createBayFestival, noteFestivalActivity, noteFestivalDelivery, restoreBayFestival, getBayFestivalChoices, getBayFestivalStatus, beginBayFestival, contributeBayFestival, finishBayFestival, type BayFestivalState, type FestivalContext, type FestivalTradition } from './bay-festival.ts';
import { createFreight, restoreFreight, advanceFreight, type BayFreightState } from './bay-freight-model.ts';
import { createBayMusicState, normalizeBayMusicState, type BayMusicState } from './bay-music-model.ts';
import { ruCount, traitLabel } from './ru.ts';
import { exposedTrait, getClimate, traitIds, type Trait } from './climate.ts';
import { shellDefinitions, shellForSpot, shellIds, shellSpotCount, type ShellId } from './tide.ts';
import { getShoalFindAt, hasShoal, shoalDefinitions, shoalFindIds, type ShoalFindId } from './shoal.ts';
import { fishingSpecies, type FishingLoot } from './fishing-model.ts';
import { projectHenToGround, type HenNativePoint } from './hen-roaming.ts';
import {createCulinary,restoreCulinary,isCookeryResult,copyCookeryResult,normalizeSignatureDraft,signatureIdentity,signatureSellPrice,signatureFruitNames,signatureRecipeLimit,validSignatureName,residentTastes,type CulinaryState,type CookeryResult,type SignatureDraft,type SignatureIngredient,type SignatureRecipe} from './culinary.ts';
import {createShoreline,restoreShoreline,settleCove,sameCove,isCoveChoices,getCoveEcology,isCoveFishingHabitat,copyCoveFishingHabitat,covePresets,coveObservationDefinitions,type ShorelineState,type CoveChoices,type CoveFishingHabitat} from './shoreline.ts';
import { createIntentOrders, restoreIntentOrders, intentIds, currentIntentIds, intentDefinitions, qualityNames, evaluateFood, type IntentId, type IntentOrderState, type FoodDescriptor, type FoodOfferId } from './intent-orders.ts';
import { createNeighborState, restoreNeighborState, prepareNeighbor, episodeFor, neighborEpisodes, validNeighborAssembly, type NeighborState, type NeighborAssembly } from './neighbor-plans.ts';
export type { FoodOfferId, IntentId } from './intent-orders.ts';
export type { NeighborAssembly } from './neighbor-plans.ts';
export {getCoveEcology,covePresets} from './shoreline.ts';

export const berryCropIds=['strawberry','blueberry','raspberry'] as const;
export const cropIds = ['carrot', 'cabbage', 'beetroot', 'tomato', 'pumpkin', 'wheat', 'leafyGreens',...berryCropIds] as const;
export type CropId = typeof cropIds[number];

type CropDefinition = {
  name: string;
  days: number;
  seedPrice: number;
  retainsWater?: boolean;
  sellPrice: number;
  yield: number;
};

export const cropDefinitions: Record<CropId, CropDefinition> = {
  carrot: { name: 'Морковь', days: 1, seedPrice: 4, sellPrice: 2, yield: 3 },
  cabbage: { name: 'Капуста', days: 2, seedPrice: 6, sellPrice: 5, yield: 2 },
  beetroot: { name: 'Свёкла', days: 2, seedPrice: 5, sellPrice: 4, yield: 2 },
  tomato: { name: 'Помидор', days: 3, seedPrice: 7, sellPrice: 5, yield: 3 },
  pumpkin: { name: 'Тыква', days: 3, retainsWater: true, seedPrice: 8, sellPrice: 9, yield: 2 },
  wheat: { name: 'Пшеница', days: 2, seedPrice: 4, sellPrice: 3, yield: 3 },
  leafyGreens: { name: 'Зелень', days: 1, seedPrice: 4, sellPrice: 3, yield: 2 },
  strawberry:{name:'Клубника',days:2,seedPrice:6,sellPrice:5,yield:3},
  blueberry: { name: 'Черника', days: 3, retainsWater: true, seedPrice: 7, sellPrice: 6, yield: 3 },
  raspberry:{name:'Малина',days:2,seedPrice:6,sellPrice:5,yield:3},
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
export const boatPrice = 36;
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
export const treeDefinitions: Record<TreeId, { name: string; treeName: string; saplingName: string; days: number; saplingPrice: number; sellPrice: number }> = {
  apple: { name: 'Яблоко', treeName: 'Яблоня', saplingName: 'Саженец яблони', days: 2, saplingPrice: 9, sellPrice: 4 },
  pear: { name: 'Груша', treeName: 'Грушевое дерево', saplingName: 'Саженец груши', days: 3, saplingPrice: 11, sellPrice: 6 },
  peach: { name: 'Персик', treeName: 'Персиковое дерево', saplingName: 'Саженец персика', days: 3, saplingPrice: 13, sellPrice: 7 },
};

const resourceGroups = { crops: cropIds, orchard: treeIds, coop: ['egg'] } as const;
export type ArchiveGroup = keyof typeof resourceGroups | 'shore' | 'bay';
const resourceIds = [...cropIds, ...treeIds, 'egg'] as const;
type ResourceId = typeof resourceIds[number];
const discoveryIds = ['regular', ...traitIds] as const;
type DiscoveryId = typeof discoveryIds[number];
type Collection<K extends string, V> = Partial<Record<ResourceId, Partial<Record<K, V>>>>;

function resourceDefinition(id: ResourceId) {
  if (id === 'egg') return { name: 'Яйцо', icon: 'egg', sellPrice: eggPrice };
  if (isId(treeIds, id)) {
    const icons: Record<TreeId, string> = { apple: 'apple', pear: 'ui-pear', peach: 'ui-peach-fruit' };
    return { ...treeDefinitions[id], icon: icons[id] };
  }
  return { ...cropDefinitions[id], icon: id };
}

export function variantLabel(id: ResourceId, trait: Trait) {
  const { name, icon } = resourceDefinition(id);
  return { name: `${traitLabel(trait, id)} ${name.toLowerCase()}`, image: icon };
}

type ArchiveItem = { id: DiscoveryId | 'moon' | ShoalFindId | BayDiscoveryId; name: string; icon: string; discovered: boolean; trait?: Trait };

export function getArchive(farm: FarmState, group: ArchiveGroup): { id: string; name: string; items: ArchiveItem[] }[] {
  if (group === 'bay') return [
    { id: 'fish', name: 'Рыбы бухты', items: fishIds.map((id) => ({ id, name: fishDefinitions[id].name, icon: id, discovered: farm.bayDiscoveries.includes(id) })) },
    { id: 'fruit', name: 'Садовые фрукты', items: treeIds.map((id) => ({ id, ...resourceDefinition(id), discovered: farm.bayDiscoveries.includes(id) })) },
    { id: 'dishes', name: 'Кухонные блюда', items: dishIds.map((id) => ({ id, name: dishDefinitions[id].name, icon: id, discovered: farm.bayDiscoveries.includes(id) })) },
    { id: 'honey', name: 'Мёд с мыса', items: [
      { id: 'honey', name: 'Цветочный мёд', icon: 'honey', discovered: farm.bayDiscoveries.includes('honey') },
      { id: 'windHoney', name: 'Ветреный мёд', icon: 'windHoney', discovered: farm.bayDiscoveries.includes('windHoney') },
      { id: 'beeswax', name: 'Пчелиный воск', icon: 'beeswax', discovered: farm.bayDiscoveries.includes('beeswax') },
    ] },
  ];
  if (group === 'shore') return [{
    id: 'shell', name: 'Ракушка',
    items: shellIds.map((id) => ({
      id, name: id === 'regular' ? 'Обычная' : 'Лунная ракушка', icon: shellDefinitions[id].icon,
      discovered: farm.shellDiscoveries.includes(id),
    })),
  }, {
    id: 'tidepool', name: 'Находки отмели',
    items: shoalFindIds.map((id) => ({
      id, name: shoalDefinitions[id].name, icon: shoalDefinitions[id].icon, discovered: farm.shoalDiscoveries.includes(id),
    })),
  }];
  return resourceGroups[group].map((id) => {
    const { name, icon } = resourceDefinition(id);
    return {
      id, name,
      items: discoveryIds.map((variant) => ({
        id: variant, name: variant === 'regular' ? (id === 'egg' || id === 'apple' ? 'Обычное' : ['tomato', 'peach'].includes(id) ? 'Обычный' : 'Обычная') : traitLabel(variant, id), icon,
        trait: variant === 'regular' ? undefined : variant,
        discovered: farm.discoveries[id]?.[variant] === true,
      })),
    };
  });
}

export const fishIds = fishingSpecies;
export type FishId = typeof fishIds[number];
export const fishDefinitions: Record<FishId, { name: string; sellPrice: number }> = {
  perch: { name: 'Окунь', sellPrice: 5 },
  seaBass: { name: 'Морской окунь', sellPrice: 10 },
  moonfish: { name: 'Лунная рыба', sellPrice: 18 },
  lanternfish: { name: 'Рыба-фонарь', sellPrice: 26 },
};
const islandFish: Record<OrchardIslandId, FishId> = { home: 'perch', grove: 'seaBass' };

export const buildingIds = ['farmhouse', 'coop', 'well'] as const;
export type BuildingId = typeof buildingIds[number];
type BuildingLevel = 1 | 2 | 3;
export const buildingDefinitions: Record<BuildingId, { name: string; upgradePrice: number; benefit: string }> = {
  farmhouse: { name: 'Фермерский дом', upgradePrice: 24, benefit: 'Варенье, рыба на гриле и кухонные заказы' },
  coop: { name: 'Курятник', upgradePrice: 22, benefit: 'Корзины яиц и заказы курятника' },
  well: { name: 'Колодец', upgradePrice: 18, benefit: 'Полив рядов и заказы урожая' },
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
    hatchery: { name: 'Инкубатор', price: 30 },
    packing: { name: 'Упаковочная', price: 48 },
  },
  well: {
    rain: { name: 'Дождевая цистерна', price: 44 },
    pipes: { name: 'Поливные трубы', price: 44 },
  },
} as const;

export const capeDishIds = ['honeyBiscuits', 'honeyPear', 'windParfait'] as const;
export const tartDishIds = ['orchardTart', 'strawberryTart', 'blueberryTart', 'raspberryTart'] as const;
export type TartDishId = typeof tartDishIds[number];
export function isTartDish(id: unknown): id is TartDishId { return tartDishIds.some(dish => dish === id); }
export const dishIds = [...tartDishIds, 'grilledFish', 'appleJam', 'farmhouseBread', 'orchardPreserves', 'honeyCake', ...capeDishIds] as const;
export type DishId = typeof dishIds[number];
export const bayDiscoveryIds = [...fishIds, ...treeIds, ...dishIds, 'honey', 'windHoney', 'beeswax'] as const;
export type BayDiscoveryId = typeof bayDiscoveryIds[number];
export const specializationDefinitions: Record<SpecializationId, { name: string; price: number; dish: DishId }> = {
  bakery: { name: 'Пекарня', price: 58, dish: 'farmhouseBread' },
  preserves: { name: 'Кухня заготовок', price: 58, dish: 'orchardPreserves' },
};
export const workshopShapes = ['round', 'folded', 'long'] as const;
export type WorkshopShape = typeof workshopShapes[number];
export const workshopDefinitions: Record<WorkshopShape, { name: string; sellPrice: number }> = {
  round: { name: 'Круглая булочка', sellPrice: 20 },
  folded: { name: 'Слойка', sellPrice: 20 },
  long: { name: 'Батон', sellPrice: 20 },
};
export const residentIds = ['bea', 'finn'] as const;
export type ResidentId = typeof residentIds[number];
export const residentDefinitions: Record<ResidentId, { name: string; role: string; benefit: string }> = {
  bea: { name: 'Беа', role: 'Пекарь', benefit: 'Раз в день печёт три изделия по знакомому образцу.' },
  finn: { name: 'Финн', role: 'Рыбак', benefit: 'Раз в день готовит к рыбалке вместительный и прочный крючок.' },
};
export type FishingTripConfig = { capacity: number; depth: number; resilience: number; scouted: boolean;habitat?:CoveFishingHabitat;picnic?:'bright';tasting?:boolean };
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
  2: { name: 'Цветочная пасека', coins: 48, items: [{ kind: 'honey', quantity: 3 }] },
  3: { name: 'Медовая кухня', coins: 68, items: [{ kind: 'beeswax', quantity: 3 }, { kind: 'seaSalt', quantity: 2 }] },
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
  strawberryTart: {
    name: 'Клубничный тарт', sellPrice: 33, requiredLevel: 2, ingredientLabel: '2 клубники, 1 пшеница, 1 яйцо',
    ingredients: [{ kind: 'produce', item: 'strawberry', quantity: 2 }, { kind: 'produce', item: 'wheat', quantity: 1 }, { kind: 'eggs', quantity: 1 }],
  },
  blueberryTart: {
    name: 'Черничный тарт', sellPrice: 35, requiredLevel: 2, ingredientLabel: '2 черники, 1 пшеница, 1 яйцо',
    ingredients: [{ kind: 'produce', item: 'blueberry', quantity: 2 }, { kind: 'produce', item: 'wheat', quantity: 1 }, { kind: 'eggs', quantity: 1 }],
  },
  raspberryTart: {
    name: 'Малиновый тарт', sellPrice: 33, requiredLevel: 2, ingredientLabel: '2 малины, 1 пшеница, 1 яйцо',
    ingredients: [{ kind: 'produce', item: 'raspberry', quantity: 2 }, { kind: 'produce', item: 'wheat', quantity: 1 }, { kind: 'eggs', quantity: 1 }],
  },
  orchardTart: {
    name: 'Фруктовый пирог', sellPrice: 25, requiredLevel: 1, ingredientLabel: '2 яблока, 1 пшеница, 1 яйцо',
    ingredients: [
      { kind: 'fruit', item: 'apple', quantity: 2 }, { kind: 'produce', item: 'wheat', quantity: 1 }, { kind: 'eggs', quantity: 1 },
    ],
  },
  grilledFish: {
    name: 'Рыба на гриле', sellPrice: 38, requiredLevel: 2, ingredientLabel: '1 морской окунь, 1 морская соль, 1 морковь',
    ingredients: [
      { kind: 'fish', item: 'seaBass', quantity: 1 }, { kind: 'seaSalt', quantity: 1 }, { kind: 'produce', item: 'carrot', quantity: 1 },
    ],
  },
  appleJam: {
    name: 'Яблочное варенье', sellPrice: 14, requiredLevel: 2, ingredientLabel: '2 яблока',
    ingredients: [{ kind: 'fruit', item: 'apple', quantity: 2 }],
  },
  farmhouseBread: {
    name: 'Домашний хлеб', sellPrice: 22, requiredLevel: 3, specialization: 'bakery', ingredientLabel: '2 пшеницы, 1 яйцо',
    ingredients: [{ kind: 'produce', item: 'wheat', quantity: 2 }, { kind: 'eggs', quantity: 1 }],
  },
  orchardPreserves: {
    name: 'Садовый конфитюр', sellPrice: 22, requiredLevel: 3, specialization: 'preserves', ingredientLabel: '1 яблоко, 1 груша',
    ingredients: [{ kind: 'fruit', item: 'apple', quantity: 1 }, { kind: 'fruit', item: 'pear', quantity: 1 }],
  },
  honeyCake: {
    name: 'Медовый кекс', sellPrice: 20, requiredLevel: 1, ingredientLabel: '2 пшеницы, 1 цветочный мёд',
    ingredients: [{ kind: 'produce', item: 'wheat', quantity: 2 }, { kind: 'honey', quantity: 1 }],
  },
  honeyBiscuits: {
    name: 'Медовое печенье', sellPrice: 28, requiredLevel: 1, capeLevel: 3, ingredientLabel: '1 цветочный мёд, 2 пшеницы, 1 яйцо',
    ingredients: [{ kind: 'honey', quantity: 1 }, { kind: 'produce', item: 'wheat', quantity: 2 }, { kind: 'eggs', quantity: 1 }],
  },
  honeyPear: {
    name: 'Груша с мёдом', sellPrice: 30, requiredLevel: 1, capeLevel: 3, ingredientLabel: '1 цветочный мёд, 2 груши, 1 морская соль',
    ingredients: [{ kind: 'honey', quantity: 1 }, { kind: 'fruit', item: 'pear', quantity: 2 }, { kind: 'seaSalt', quantity: 1 }],
  },
  windParfait: {
    name: 'Воздушное парфе', sellPrice: 42, requiredLevel: 1, capeLevel: 3, ingredientLabel: '1 ветреный мёд, 1 персик, 1 яйцо',
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
    { name: 'Огородная корзина', reward: 22, items: [{ kind: 'produce', item: 'cabbage', quantity: 2 }, { kind: 'produce', item: 'tomato', quantity: 1 }] },
    { name: 'Ящик корнеплодов', reward: 21, items: [{ kind: 'produce', item: 'carrot', quantity: 3 }, { kind: 'produce', item: 'beetroot', quantity: 2 }] },
    { name: 'Осенняя корзина', reward: 21, items: [{ kind: 'produce', item: 'pumpkin', quantity: 1 }, { kind: 'produce', item: 'leafyGreens', quantity: 2 }] },
  ],
  pantry: [
    { name: 'Ящик к завтраку', reward: 14, items: [{ kind: 'eggs', quantity: 1 }, { kind: 'produce', item: 'wheat', quantity: 2 }] },
    { name: 'Заказ пекарни', reward: 37, items: [{ kind: 'dishes', item: 'orchardTart', quantity: 1 }, { kind: 'fruit', item: 'apple', quantity: 1 }] },
    { name: 'Пикник у причала', reward: 23, items: [{ kind: 'fish', item: 'perch', quantity: 2 }, { kind: 'eggs', quantity: 2 }] },
  ],
  grove: [
    { name: 'Улов Солёной рощи', reward: 21, items: [{ kind: 'fish', item: 'seaBass', quantity: 1 }, { kind: 'seaSalt', quantity: 1 }] },
    { name: 'Корзина из рощи', reward: 29, items: [{ kind: 'fruit', item: 'pear', quantity: 2 }, { kind: 'produce', item: 'beetroot', quantity: 2 }] },
    { name: 'Ужин в гавани', reward: 49, upgradedKitchen: true, items: [{ kind: 'dishes', item: 'grilledFish', quantity: 1 }, { kind: 'seaSalt', quantity: 1 }] },
  ],
  kitchen: [
    { name: 'Варенье и зерно', reward: 28, items: [{ kind: 'dishes', item: 'appleJam', quantity: 1 }, { kind: 'produce', item: 'wheat', quantity: 2 }] },
    { name: 'Чаепитие в саду', reward: 53, items: [{ kind: 'dishes', item: 'appleJam', quantity: 1 }, { kind: 'dishes', item: 'orchardTart', quantity: 1 }] },
  ],
  coop: [
    { name: 'Утренняя корзина', reward: 28, items: [{ kind: 'eggBaskets', quantity: 1 }, { kind: 'produce', item: 'carrot', quantity: 3 }] },
    { name: 'Корзина пекаря', reward: 29, items: [{ kind: 'eggBaskets', quantity: 1 }, { kind: 'produce', item: 'wheat', quantity: 3 }] },
  ],
  irrigation: [
    { name: 'Кухонный огород', reward: 28, items: [{ kind: 'produce', item: 'carrot', quantity: 4 }, { kind: 'produce', item: 'leafyGreens', quantity: 4 }] },
    { name: 'Урожай для мельницы', reward: 38, items: [{ kind: 'produce', item: 'wheat', quantity: 5 }, { kind: 'produce', item: 'beetroot', quantity: 3 }] },
  ],
};

const specialtyMenus: Record<SpecializationId, readonly Order[]> = {
  bakery: [
    { name: 'Хлебная корзина', reward: 29, items: [{ kind: 'dishes', item: 'farmhouseBread', quantity: 1 }, { kind: 'produce', item: 'wheat', quantity: 2 }] },
    { name: 'Стол пекаря', reward: 48, items: [{ kind: 'dishes', item: 'farmhouseBread', quantity: 2 }, { kind: 'dishes', item: 'appleJam', quantity: 1 }] },
  ],
  preserves: [
    { name: 'Ящик садового конфитюра', reward: 30, items: [{ kind: 'dishes', item: 'orchardPreserves', quantity: 1 }, { kind: 'fruit', item: 'apple', quantity: 2 }] },
    { name: 'Кладовая рощи', reward: 50, items: [{ kind: 'dishes', item: 'orchardPreserves', quantity: 2 }, { kind: 'dishes', item: 'appleJam', quantity: 1 }] },
  ],
};

const facilityMenus: Record<FacilityBranch, readonly Order[]> = {
  hatchery: [
    { name: 'Завтрак в инкубаторе', reward: 28, items: [{ kind: 'eggs', quantity: 6 }] },
    { name: 'Корзина из курятника', reward: 38, items: [{ kind: 'eggBaskets', quantity: 2 }] },
  ],
  packing: [
    { name: 'На рынок', reward: 36, items: [{ kind: 'eggCrates', quantity: 1 }, { kind: 'produce', item: 'wheat', quantity: 2 }] },
    { name: 'Поставка к завтраку', reward: 62, items: [{ kind: 'eggCrates', quantity: 2 }] },
  ],
  rain: [
    { name: 'Корзина дождливого сада', reward: 35, items: [{ kind: 'produce', item: 'leafyGreens', quantity: 4 }, { kind: 'produce', item: 'tomato', quantity: 3 }] },
    { name: 'Урожай у цистерны', reward: 41, items: [{ kind: 'produce', item: 'cabbage', quantity: 4 }, { kind: 'produce', item: 'pumpkin', quantity: 1 }] },
  ],
  pipes: [
    { name: 'Урожай двух рядов', reward: 36, items: [{ kind: 'produce', item: 'carrot', quantity: 6 }, { kind: 'produce', item: 'beetroot', quantity: 4 }] },
    { name: 'Ужин на мельнице', reward: 43, items: [{ kind: 'produce', item: 'wheat', quantity: 6 }, { kind: 'produce', item: 'tomato', quantity: 3 }] },
  ],
};

const capeMenus: readonly Order[] = [
  { name: 'Чай на Цветочном мысе', reward: 28, items: [{ kind: 'dishes', item: 'honeyCake', quantity: 1 }] },
  { name: 'Дегустация ветреного мёда', reward: 25, items: [{ kind: 'windHoney', quantity: 1 }] },
];

const berryKitchenMenus: readonly Order[] = [
  { name: 'Клубничное чаепитие', reward: 45, items: [{ kind: 'dishes', item: 'strawberryTart', quantity: 1 }] },
  { name: 'Черничный полдник', reward: 47, items: [{ kind: 'dishes', item: 'blueberryTart', quantity: 1 }] },
  { name: 'Малиновый гостинец', reward: 45, items: [{ kind: 'dishes', item: 'raspberryTart', quantity: 1 }] },
];

const apiaryMenus: readonly Order[] = [
  { name: 'Посылка с пасеки', reward: 40, items: [{ kind: 'beeswax', quantity: 3 }, { kind: 'honey', quantity: 2 }] },
  { name: 'Воск и заготовки', reward: 34, items: [{ kind: 'beeswax', quantity: 2 }, { kind: 'dishes', item: 'appleJam', quantity: 1 }] },
];

const honeyKitchenMenus: readonly Order[] = [
  { name: 'Коробка медового печенья', reward: 70, items: [{ kind: 'dishes', item: 'honeyBiscuits', quantity: 2 }] },
  { name: 'Дегустация на мысе', reward: 88, items: [{ kind: 'dishes', item: 'honeyPear', quantity: 1 }, { kind: 'dishes', item: 'windParfait', quantity: 1 }] },
];

export const marketStock: readonly StockItem[] = [
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
    name: 'Сельская ярмарка', island: 'home', reward: 65,
    items: [
      { kind: 'dishes', item: 'appleJam', quantity: 1 }, { kind: 'eggBaskets', quantity: 1 },
      { kind: 'produce', item: 'carrot', quantity: 4 }, { kind: 'produce', item: 'wheat', quantity: 3 },
    ],
  },
  dock: {
    name: 'Причал Солёной рощи', island: 'grove', reward: 55,
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
  { id: 'till', label: 'Подготовьте грядку', detail: 'Подойдите к пустой грядке и вскопайте землю.', target: 1, reward: 3 },
  { id: 'plant', label: 'Посейте первые семена', detail: 'Полейте морковь — к утру она созреет.', target: 1, reward: 3 },
  { id: 'water', label: 'Полейте посадки', detail: 'Полейте засеянную грядку, чтобы за ночь растения подросли.', target: 1, reward: 3 },
  { id: 'rest', label: 'Дайте огороду подрасти', detail: 'Отдохните в доме, чтобы начать новый день.', target: 1, reward: 4 },
  { id: 'harvest', label: 'Соберите урожай с трёх грядок', detail: 'Найдите в огороде созревшие растения.', target: 3, reward: 8 },
  { id: 'sell', label: 'Продайте первый урожай', detail: 'Принесите овощи или яйца к рыночному прилавку.', target: 1, reward: 8 },
  { id: 'feed', label: 'Покормите кур', detail: 'Принесите корм в курятник.', target: 1, reward: 4 },
  { id: 'collect', label: 'Соберите свежие яйца', detail: 'Проверьте гнёзда. Сытые куры несут яйца к утру.', target: 1, reward: 5 },
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
  treeNursery: { id: number; tree: TreeSlot }[];
  treeNurserySerial: number;
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
  freight: BayFreightState;
  bayShop: BayShopState;
  musicGarden: BayMusicState;
  concertDay: number;
  festivals: BayFestivalState;
  culinary:CulinaryState;
  intentOrders:IntentOrderState;
  neighbors:NeighborState;
  shoreline:ShorelineState;
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
  henPositions: (HenNativePoint | null)[];
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
  return ` ${found ? 'Найдено' : 'Новое открытие'}: ${variantLabel(id, trait).name.toLowerCase()}.`;
}

function emptyProduce(): FarmState['produce'] {
  return { carrot: 0, cabbage: 0, beetroot: 0, tomato: 0, pumpkin: 0, wheat: 0, leafyGreens: 0,strawberry:0,blueberry:0,raspberry:0 };
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
    seeds: { carrot: 3, cabbage: 2, beetroot: 1, tomato: 1, pumpkin: 1, wheat: 2, leafyGreens: 1,strawberry:0,blueberry:0,raspberry:0 },
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
    treeNursery: [],
    treeNurserySerial: 0,
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
    freight: createFreight(), bayShop: createBayShop(), musicGarden: createBayMusicState(), concertDay: 0, festivals:createBayFestival(),
    culinary:createCulinary(),shoreline:createShoreline(),intentOrders:createIntentOrders(),neighbors:createNeighborState(),
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
    dishes: { strawberryTart: 0, blueberryTart: 0, raspberryTart: 0, orchardTart: 0, grilledFish: 0, appleJam: 0, farmhouseBread: 0, orchardPreserves: 0, honeyCake: 0, honeyBiscuits: 0, honeyPear: 0, windParfait: 0 },
    buildingLevels: { farmhouse: 1, coop: 1, well: 1 },
    farmhouseSpecialization: null,
    coopSpecialization: null,
    wellSpecialization: null,
    flockSize: chickenCount,
    henPositions: Array.from({ length: maxFlockSize }, () => null),
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

export function needsSeedChoice(farm: FarmState, index: number): boolean {
  const bed = farm.beds[index];
  return farm.island === 'home' && !!bed && bed.kind !== 'crop' && farm.seeds[farm.selectedSeed] === 0;
}

export function getBedAction(farm: FarmState, index: number): BedAction {
  const bed = farm.beds[index];
  if (!bed || farm.island !== 'home') return { kind: 'wait', label: 'Выберите грядку на ферме.', available: false };
  if (bed.kind === 'empty') return { kind: 'till', label: 'Вскопать землю', available: true };
  if (bed.kind === 'tilled') {
    const name = cropDefinitions[farm.selectedSeed].name.toLowerCase();
    const available = farm.seeds[farm.selectedSeed] > 0;
    return { kind: 'plant', label: available ? `Посеять: ${name}` : `Семена закончились: ${name}. Выберите другие.`, available };
  }

  const name = cropDefinitions[bed.crop].name.toLowerCase();
  if (getBedStage(bed) === 'ripe') return { kind: 'harvest', label: `Собрать урожай: ${name}`, available: true };
  if (bed.watered) return { kind: 'wait', label: 'Сегодня полито. За ночь подрастёт.', available: false };
  const available = farm.water > 0;
  return { kind: 'water', label: available ? `Полить: ${name}` : 'Наполните лейку у колодца.', available };
}

export function workBed(farm: FarmState, index: number, now = Date.now()): ActionResult {
  const action = getBedAction(farm, index);
  if (!action.available) return failure(action.label);
  const bed = farm.beds[index];

  if (action.kind === 'till') {
    farm.beds[index] = { kind: 'tilled' };
    return record(farm, 'till', 'Грядка готова к посеву.');
  }
  if (action.kind === 'plant') {
    const crop = farm.selectedSeed;
    farm.seeds[crop] -= 1;
    const { weather } = getClimate(farm.day);
    const trait = exposedTrait(farm.day, weather, index + 1);
    farm.beds[index] = { kind: 'crop', crop, growth: 0, watered: weather === 'rain', ...(trait ? { trait } : {}) };
    return record(farm, 'plant', `Посеяны семена: ${cropDefinitions[crop].name.toLowerCase()}.`);
  }
  if (bed.kind !== 'crop') return failure(action.label);
  if (action.kind === 'water') {
    farm.water -= 1;
    bed.watered = true;
    bed.wateredAt = now;
    return record(farm, 'water', 'Посадки политы.');
  }

  const crop = cropDefinitions[bed.crop];
  const bonus=farm.culinary.picnic?.day===farm.day&&farm.culinary.picnic.processing==='chunky',yieldCount=crop.yield+Number(bonus);
  const found = collectResources(farm, bed.crop, yieldCount, bed.trait);
  if(bonus)farm.culinary.picnic=null;
  farm.beds[index] = { kind: 'tilled' };
  return record(farm, 'harvest', `Урожай: ${crop.name.toLowerCase()} × ${yieldCount}.${found}`);
}

export function selectSeed(farm: FarmState, crop: CropId): ActionResult {
  if (!isCropId(crop)) return failure('Выберите семена.');
  const name = cropDefinitions[crop].name;
  if (farm.seeds[crop] === 0) return failure(`Купите семена на рынке: ${name.toLowerCase()}.`);
  farm.selectedSeed = crop;
  return { ok: true, message: `Выбраны семена: ${name.toLowerCase()}.` };
}

export function refillWater(farm: FarmState): ActionResult {
  const capacity = getWaterCapacity(farm);
  if (farm.water === capacity) return failure('Лейка уже полна.');
  farm.water = capacity;
  return { ok: true, message: 'Лейка наполнена.' };
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
  if (farm.island !== 'home' || farm.buildingLevels.well < 2) return failure('Сначала улучшите колодец для полива рядов.');
  const { targets, available } = getIrrigationRow(farm, row);
  if (targets.length === 0) return failure('В этом ряду всё полито.');
  if (!available) return failure('Наполните лейку для полива ряда.');
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
  if (farm.island !== 'home' || farm.wellSpecialization !== 'pipes') return failure('Установите трубы для полива двух рядов.');
  const { targets, available } = getIrrigationPair(farm, firstRow);
  if (targets.length === 0) return failure('В этих рядах всё полито.');
  if (!available) return failure('Наполните лейку для полива двух рядов.');
  return waterPlots(farm, targets, now);
}

function waterPlots(farm: FarmState, targets: number[], now: number): ActionResult {
  const before = farm.coins;
  for (const index of targets) workBed(farm, index, now);
  const bonus = farm.coins - before;
  return { ok: true, message: `Полито: ${ruCount(targets.length, 'грядка', 'грядки', 'грядок')}.${bonus ? ` Награда за задание: +${ruCount(bonus, 'монета', 'монеты', 'монет')}.` : ''}` };
}

export function upgradeCan(farm: FarmState): ActionResult {
  if (farm.canUpgraded) return failure('У вас уже есть большая лейка.');
  if (farm.coins < canUpgradePrice) return failure('Накопите монеты на большую лейку.');
  farm.coins -= canUpgradePrice;
  farm.canUpgraded = true;
  farm.water = getWaterCapacity(farm);
  return { ok: true, message: `Лейка улучшена. Вместимость: ${ruCount(farm.water, 'порция', 'порции', 'порций')}.` };
}

export function feedChickens(farm: FarmState): ActionResult {
  if (farm.chickensFed) return failure('Сегодня куры уже накормлены.');
  if (farm.feed === 0) return failure('Купите корм для кур на рынке.');
  farm.feed -= 1;
  farm.chickensFed = true;
  return record(farm, 'feed', 'К утру куры снесут яйца.');
}

export function collectEggs(farm: FarmState): ActionResult {
  const eggs = farm.eggsReady;
  if (eggs === 0) return failure('Загляните в гнёзда завтра.');
  const found = collectResources(farm, 'egg', eggs, farm.eggTrait ?? undefined);
  farm.eggsReady = 0;
  farm.eggTrait = null;
  return record(farm, 'collect', `Собрано: ${ruCount(eggs, 'яйцо', 'яйца', 'яиц')}.` + found);
}

export type PackingResult = { kind: 'basket' | 'crate'; placements: readonly { x: number; y: number }[]; settled: true };
function validPacking(result: PackingResult | undefined, kind: PackingResult['kind'], count: number): boolean {
  return result === undefined || isRecord(result) && result.kind === kind && result.settled === true
    && Array.isArray(result.placements) && result.placements.length === count
    && result.placements.every((point, index, points) => isRecord(point) && typeof point.x === 'number' && Number.isFinite(point.x) && Math.abs(point.x) <= 1
      && typeof point.y === 'number' && Number.isFinite(point.y) && Math.abs(point.y) <= 1
      && points.slice(0, index).every(other => Math.hypot((point.x as number) - other.x, (point.y as number) - other.y) >= .18));
}
export function packEggBasket(farm: FarmState, result?: PackingResult): ActionResult {
  if (!validPacking(result, 'basket', eggsPerBasket)) return failure('Уложите три яйца в разные места корзинки.');
  if (farm.island !== 'home' || farm.buildingLevels.coop < 2) return failure('Улучшите курятник для упаковки корзин.');
  if (farm.eggs < eggsPerBasket) return failure(`Для корзины нужно ${ruCount(eggsPerBasket, 'яйцо', 'яйца', 'яиц')}.`);
  if (!Number.isSafeInteger(farm.eggBaskets + 1) || !Number.isSafeInteger(farm.workToday + 1)) return failure('В кладовой пока нет места для новой корзинки.');
  farm.eggs -= eggsPerBasket;
  farm.eggBaskets += 1;
  farm.workToday += 1;
  return { ok: true, message: 'Корзина яиц упакована.' };
}

export function packEggCrate(farm: FarmState, result?: PackingResult): ActionResult {
  if (!validPacking(result, 'crate', eggsPerCrate)) return failure('Уложите пять яиц в разные ячейки ящика.');
  if (farm.island !== 'home' || farm.coopSpecialization !== 'packing') return failure('Постройте упаковочную для ящиков яиц.');
  if (farm.eggs < eggsPerCrate) return failure(`Для ящика нужно ${ruCount(eggsPerCrate, 'яйцо', 'яйца', 'яиц')}.`);
  if (!Number.isSafeInteger(farm.eggCrates + 1) || !Number.isSafeInteger(farm.workToday + 1)) return failure('В кладовой пока нет места для нового ящика.');
  farm.eggs -= eggsPerCrate;
  farm.eggCrates += 1;
  farm.workToday += 1;
  return { ok: true, message: 'Ящик яиц упакован.' };
}

export function incubateEgg(farm: FarmState): ActionResult {
  if (farm.island !== 'home' || farm.coopSpecialization !== 'hatchery') return failure('Постройте инкубатор, чтобы вырастить курицу.');
  if (farm.flockSize === maxFlockSize) return failure('В курятнике больше нет места.');
  if (farm.hatchDay !== null) return failure('Одно яйцо уже в инкубаторе.');
  if (farm.eggs < 1) return failure('Соберите яйцо для инкубатора.');
  farm.eggs -= 1;
  farm.hatchDay = farm.day + incubationDays;
  farm.workToday += 1;
  return { ok: true, message: `Яйцо в инкубаторе. Новая курочка появится в день ${farm.hatchDay}.` };
}

export function buySeeds(farm: FarmState, crop: CropId): ActionResult {
  if (!isCropId(crop)) return failure('Выберите пакет семян.');
  const definition = cropDefinitions[crop];
  if (farm.coins < definition.seedPrice) return failure('Не хватает монет на семена.');
  farm.coins -= definition.seedPrice;
  farm.seeds[crop] += seedPackSize;
  return { ok: true, message: `Куплены семена: ${definition.name.toLowerCase()} × ${seedPackSize}.` };
}

export function buyFeed(farm: FarmState): ActionResult {
  if (farm.coins < feedBagPrice) return failure('Не хватает монет на корм.');
  farm.coins -= feedBagPrice;
  farm.feed += feedBagSize;
  return { ok: true, message: `Куплено: ${ruCount(feedBagSize, 'порция', 'порции', 'порций')} корма.` };
}

export function getFishLimit(farm: Pick<FarmState, 'island' | 'projects'>, island = farm.island): number {
  if (!isId(orchardIslandIds, island)) return 0;
  return fishDailyLimit + Number(island === 'grove' && isProjectComplete(farm, 'dock'));
}

export function getFishAction(farm: FarmState): { available: boolean; label: string } {
  if (!isId(orchardIslandIds, farm.island)) return { available: false, label: 'Рыбачьте у Родного острова или в Солёной роще.' };
  if (farm.fishCaughtToday[farm.island] >= getFishLimit(farm)) {
    return { available: false, label: 'Здесь рыбе нужен отдых. Возвращайтесь завтра.' };
  }
  return { available: true, label: 'Закинуть удочку' };
}

export function catchFish(farm: FarmState, hit: boolean): ActionResult {
  if (!isId(orchardIslandIds, farm.island)) return failure('Рыбачьте у Родного острова или в Солёной роще.');
  const action = getFishAction(farm);
  if (!action.available) return failure(action.label);
  if (!hit) return failure('Рыба сорвалась. Закиньте удочку ещё раз.');
  const fish = islandFish[farm.island];
  farm.fish[fish] += 1;
  discoverBay(farm, fish);
  farm.fishCaughtToday[farm.island] += 1;
  noteFestivalActivity(farm.festivals,'fish');
  farm.workToday += 1;
  return { ok: true, message: `Улов: ${fishDefinitions[fish].name.toLowerCase()}.` };
}

export function getFishingTripConfig(farm: FarmState): FishingTripConfig {
  const scouted = farm.village.scouting;
  const picnic=farm.culinary.picnic?.day===farm.day&&farm.culinary.picnic.processing==='bright',tasting=scouted&&(farm.culinary.tastings.finn.bonus||farm.neighbors.finn.helpReady),habitat=getCoveHabitat(farm);
  return { capacity: (scouted ? 3 : 2)+Number(picnic), depth: 120, resilience: (scouted ? 4 : 2)+Number(tasting), scouted,...(habitat?{habitat}:{}),...(picnic?{picnic:'bright' as const}:{}),...(tasting?{tasting:true}:{}) };
}
function copyFishingTripConfig(config:FishingTripConfig):FishingTripConfig{return {...config,...(config.habitat?{habitat:copyCoveFishingHabitat(config.habitat)}:{})}}

export function beginFishingTrip(farm: FarmState): ActionResult & { token?: number; config?: FishingTripConfig } {
  const action = getFishAction(farm);
  if (!action.available || !isId(orchardIslandIds, farm.island)) return failure(action.label);
  if (farm.fishingTripSerial === Number.MAX_SAFE_INTEGER) return failure('Рыболовный журнал заполнен.');
  const config = getFishingTripConfig(farm);
  const token = ++farm.fishingTripSerial;
  farm.pendingFishingTrip = { token, day: farm.day, island: farm.island, config:copyFishingTripConfig(config) };
  farm.village.scouting = false;
  if(config.picnic)farm.culinary.picnic=null;
  if(config.tasting){farm.culinary.tastings.finn.bonus=false;farm.neighbors.finn.helpReady=false;}
  return { ok: true, message: 'Опустите крючок, а затем поднимите улов.', token, config:copyFishingTripConfig(config) };
}

export function finishFishingTrip(farm: FarmState, token: number, catchResult: number | readonly FishingLoot[]): ActionResult {
  const trip = farm.pendingFishingTrip;
  if (!trip || token !== trip.token) return failure('Эта рыбалка уже закончилась.');
  if (typeof catchResult === 'number' ? !isQuantity(catchResult) : !Array.isArray(catchResult)
    || !catchResult.every((item: unknown) => isRecord(item) && (
      item.kind === 'fish' && isId(fishIds, item.species) && (item.variant === 'regular' || item.variant === 'rare')
      || item.kind === 'shell' && isId(shellIds, item.variant)
      || item.kind === 'junk' && (item.item === 'boot' || item.item === 'weed' || item.item === 'rock')))) return failure('Выберите улов.');
  farm.pendingFishingTrip = null;
  if (trip.day !== farm.day || trip.island !== farm.island) return failure('Вернитесь к месту рыбалки и начните заново.');
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
  if(fishCount>0)noteFestivalActivity(farm.festivals,'fish');
  if(catches.some(item=>item.kind==='shell'))noteFestivalActivity(farm.festivals,'shore');
  if (catches.length) farm.workToday += 1;
  const message = brought.length ? `Улов принесён домой: ${brought.join(', ')}.` : junk ? 'Вода стала чище.' : 'Крючок пуст. Попробуйте ещё раз.';
  return { ok: true, message: message + (junk ? ` Убрано: ${ruCount(junk, 'предмет', 'предмета', 'предметов')} мусора.` : '') };
}

export function cancelFishingTrip(farm: FarmState, token?: number): ActionResult {
  const trip = farm.pendingFishingTrip;
  if (!trip || token !== undefined && token !== trip.token) return failure('Эта рыбалка уже закончилась.');
  farm.pendingFishingTrip = null;
  return { ok: true, message: 'Удочка убрана.' };
}

export function getTreeAction(farm: FarmState, slot: number): { kind: 'pick' | 'plant' | 'wait'; available: boolean; label: string } {
  if (!isId(orchardIslandIds, farm.island)) return { kind: 'wait', available: false, label: 'Посетите сад на Родном острове или в Солёной роще.' };
  const tree = farm.trees[farm.island][slot];
  if (tree === undefined) return { kind: 'wait', available: false, label: 'Выберите место в саду.' };
  if (tree === null) {
    const available = treeIds.some((id) => farm.saplings[id] > 0);
    return { kind: 'plant', available, label: available ? 'Посадить саженец' : 'Купите саженец на рынке.' };
  }
  const definition = treeDefinitions[tree.tree];
  if (tree.fruitReady > 0) return { kind: 'pick', available: true, label: `Собрать плоды: ${definition.name.toLowerCase()}` };
  if (tree.age < definition.days) {
    const nights = definition.days - tree.age;
    return { kind: 'wait', available: false, label: `Саженец (${definition.name.toLowerCase()}) подрастёт через ${ruCount(nights, 'ночь', 'ночи', 'ночей')}.` };
  }
  return { kind: 'wait', available: false, label: 'К утру вырастут новые фрукты.' };
}

export function pickFruit(farm: FarmState, slot: number): ActionResult {
  if (!isId(orchardIslandIds, farm.island)) return failure('Собирайте фрукты в саду.');
  const action = getTreeAction(farm, slot);
  if (action.kind !== 'pick' || !action.available) return failure(action.label);
  const tree = farm.trees[farm.island][slot];
  if (!tree) return failure('Выберите плодовое дерево.');
  const quantity = tree.fruitReady;
  const found = collectResources(farm, tree.tree, quantity, tree.trait);
  tree.fruitReady = 0;
  noteFestivalActivity(farm.festivals,'harvest');
  delete tree.trait;
  farm.workToday += 1;
  return { ok: true, message: `Собраны плоды: ${treeDefinitions[tree.tree].name.toLowerCase()} × ${quantity}.${found}` };
}

export function plantTree(farm: FarmState, slot: number, tree: TreeId): ActionResult {
  if (!isId(orchardIslandIds, farm.island)) return failure('Сажайте деревья в саду.');
  const orchard = farm.trees[farm.island];
  if (orchard[slot] !== null) return failure('Выберите свободное место в саду.');
  if (!isId(treeIds, tree) || farm.saplings[tree] === 0) return failure('Выберите саженец из сумки.');
  farm.saplings[tree] -= 1;
  orchard[slot] = { tree, age: 0, fruitReady: 0 };
  farm.workToday += 1;
  return { ok: true, message: `Посажен ${treeDefinitions[tree].saplingName.toLowerCase()}.` };
}

/** Nursery trees retain their exact state. Only planted trees grow or refill overnight. */
export function storeTree(farm: FarmState, slot: number): ActionResult {
  if (!isId(orchardIslandIds, farm.island)) return failure('Переносите деревья из сада.');
  if (!Number.isInteger(slot) || slot < 0 || slot >= treeSlotCount) return failure('Выберите дерево в саду.');
  const tree = farm.trees[farm.island][slot];
  if (!tree) return failure('На этом месте уже нет дерева.');
  if (farm.treeNurserySerial >= Number.MAX_SAFE_INTEGER) return failure('Сейчас нельзя перенести ещё одно дерево.');
  const id = ++farm.treeNurserySerial;
  farm.treeNursery.push({ id, tree: { ...tree } });
  farm.trees[farm.island][slot] = null;
  farm.workToday += 1;
  return { ok: true, message: `${treeDefinitions[tree.tree].treeName} в питомнике. Возраст и плоды сохранены. Место свободно.` };
}

export function returnNurseryTree(farm: FarmState, slot: number, nurseryId: number): ActionResult {
  if (!isId(orchardIslandIds, farm.island)) return failure('Верните дерево в сад на Родном острове или в Солёной роще.');
  if (!Number.isInteger(slot) || slot < 0 || slot >= treeSlotCount || farm.trees[farm.island][slot] !== null) {
    return failure('Сначала освободите место в саду: перенесите дерево в питомник.');
  }
  const index = farm.treeNursery.findIndex(entry => entry.id === nurseryId);
  if (index < 0) return failure('Это дерево уже возвращено в сад.');
  const [{ tree }] = farm.treeNursery.splice(index, 1);
  farm.trees[farm.island][slot] = { ...tree };
  farm.workToday += 1;
  return { ok: true, message: `Снова в саду: ${treeDefinitions[tree.tree].treeName.toLowerCase()}. Перенос бесплатный. Возраст и плоды сохранены.` };
}

export function buySapling(farm: FarmState, tree: TreeId): ActionResult {
  if (!isId(treeIds, tree)) return failure('Выберите саженец.');
  const { saplingName, saplingPrice } = treeDefinitions[tree];
  if (farm.coins < saplingPrice) return failure('Не хватает монет на саженец.');
  farm.coins -= saplingPrice;
  farm.saplings[tree] += 1;
  return { ok: true, message: `Куплен ${saplingName.toLowerCase()}.` };
}

export function buyAndPlantTree(farm: FarmState, slot: number, tree: TreeId): ActionResult {
  if (!isId(treeIds, tree) || !isId(orchardIslandIds, farm.island)
    || !Number.isInteger(slot) || slot < 0 || slot >= treeSlotCount || farm.trees[farm.island][slot] !== null) {
    return failure('Выберите свободное место в саду.');
  }
  if (farm.saplings[tree] === 0) {
    const purchase = buySapling(farm, tree);
    if (!purchase.ok) return purchase;
  }
  return plantTree(farm, slot, tree);
}

export function buyBoat(farm: FarmState): ActionResult {
  if (farm.boatOwned) return failure('Ваша лодка уже стоит у причала.');
  if (farm.coins < boatPrice) return failure('Накопите монеты на лодку.');
  farm.coins -= boatPrice;
  farm.boatOwned = true;
  return { ok: true, message: 'Лодка готова. Отправляйтесь от причала.' };
}

export function sail(farm: FarmState, island: IslandId): ActionResult {
  if (!isId(islandIds, island) || farm.island === island) return failure('Выберите другой остров.');
  if (!farm.boatOwned) return failure('Купите лодку для путешествий.');
  if (!canSailTo(farm, island)) return failure(island === 'village' ? 'Завершите проект «Живая бухта» на ярмарке Родного острова, чтобы открыть Лавандовую гавань.' : 'Восстановите причал Солёной рощи, чтобы открыть Цветочный мыс.');
  farm.island = island;
  const messages: Record<IslandId, string> = {
    home: 'С возвращением на ферму!', grove: 'Вы прибыли в Солёную рощу.', cape: 'Вы прибыли на Цветочный мыс. Посадите цветы для пчёл.',
    village: 'Добро пожаловать в Лавандовую гавань. Соседи ждут вас.',
  };
  return { ok: true, message: messages[island] };
}

export function canSailTo(farm: Pick<FarmState, 'boatOwned' | 'orders'> & Partial<Pick<FarmState, 'village' | 'projects'>>, destination: IslandId): boolean {
  return isId(islandIds, destination) && farm.boatOwned && (destination !== 'cape' || farm.orders.harbor.completed >= 2 || !!farm.projects && isProjectComplete({ projects: farm.projects }, 'dock'))
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
  if (farm.island !== 'cape' || !canSailTo(farm, 'cape')) return failure('Сажайте цветы на Цветочном мысе.');
  if (!Number.isInteger(index) || index < 0 || index >= capeFlowerSlotCount || farm.capeFlowers[index] !== null) {
    return failure('Выберите пустую клумбу на мысе.');
  }
  farm.capeFlowers[index] = farm.day;
  farm.workToday += 1;
  return { ok: true, message: 'Цветы посеяны. Завтра они распустятся.' };
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
  const reason = farm.island !== 'cape' ? 'Посетите Цветочный мыс для строительства.'
    : !canSailTo(farm, 'cape') ? 'Сначала откройте путь на Цветочный мыс.'
    : nextLevel === 2 && getCapeHoney(farm).blooms !== capeFlowerSlotCount ? 'Дождитесь цветения всех трёх клумб на мысе.'
    : farm.coins < definition.coins ? 'Не хватает монет на улучшение.'
    : !definition.items.every((item) => ingredientCount(farm, item) >= item.quantity) ? 'Сначала соберите материалы для улучшения.' : '';
  return { ...definition, nextLevel, available: reason === '', reason } as const;
}

export function upgradeCape(farm: FarmState): ActionResult {
  const upgrade = getCapeUpgrade(farm);
  if (!upgrade) return failure('Медовая кухня уже построена.');
  if (!upgrade.available) return failure(upgrade.reason);
  farm.coins -= upgrade.coins;
  for (const item of upgrade.items) removeStock(farm, item);
  farm.capeLevel = upgrade.nextLevel;
  return { ok: true, message: `Открыто: ${upgrade.name.toLowerCase()}.` };
}

export function collectCapeHoney(farm: FarmState): ActionResult {
  const harvest = getCapeHoney(farm);
  if (!harvest.available) return failure('Подойдите к цветущим клумбам на мысе. Мёд можно собрать раз в день.');
  const wax = getCapeWax(farm);
  farm.honey += harvest.honey;
  farm.windHoney += harvest.windHoney;
  farm.beeswax += wax;
  farm.capeHoneyOn = farm.day;
  if (harvest.honey > 0) discoverBay(farm, 'honey');
  if (harvest.windHoney > 0) discoverBay(farm, 'windHoney');
  if (wax > 0) discoverBay(farm, 'beeswax');
  farm.workToday += 1;
  return { ok: true, message: `Собран цветочный мёд × ${harvest.honey}${harvest.windHoney ? ', ветреный мёд × 1' : ''}${wax ? ', пчелиный воск × 1' : ''}.` };
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
  const capeKnownBeforeToday = farm.capeFlowers.some(plantedOn => plantedOn !== null && plantedOn < farm.day)
    || harbor.completed >= 2 && (harbor.completed > 2 || harbor.deliveredOn < farm.day);
  const requests: readonly { name: string; item: StockItem; crop: CropId }[] = [
    { name: 'Мара', item: { kind: 'fruit', item: 'apple', quantity: 2 }, crop: 'carrot' },
    { name: 'Поппи', item: { kind: 'dishes', item: 'appleJam', quantity: 1 }, crop: 'wheat' },
    { name: 'Финн', item: { kind: 'produce', item: 'wheat', quantity: 3 }, crop: 'leafyGreens' },
    { name: 'Беа', item: capeKnownBeforeToday ? { kind: 'dishes', item: 'honeyCake', quantity: 1 }
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
  if (farm.island !== 'home' || !guest) return failure('Встретьте гостя на готовой ярмарке Родного острова.');
  if (guest.served) return failure('Сегодня гость уже получил заказ.');
  if (ingredientCount(farm, guest.item) < guest.item.quantity) return failure('Принесите то, что просит гость.');
  removeStock(farm, guest.item);
  farm.coins += guest.reward;
  farm.seeds[guest.seeds.crop] += guest.seeds.count;
  farm.guestServedOn = farm.day;
  farm.fairGuestsServed += 1;
  farm.workToday += 1;
  return { ok: true, message: `${guest.name} благодарит вас. Награда: ${ruCount(guest.reward, 'монета', 'монеты', 'монет')} и семена (${cropDefinitions[guest.seeds.crop].name.toLowerCase()}) × ${guest.seeds.count}.` };
}

const workshopIngredients: readonly StockItem[] = [
  { kind: 'produce', item: 'wheat', quantity: 2 }, { kind: 'eggs', quantity: 1 },
];

export function getWorkshopAction(farm: FarmState): { available: boolean; label: string } {
  if (!isProjectComplete(farm, 'fair')) return { available: false, label: 'Завершите сельскую ярмарку, чтобы открыть пекарскую мастерскую.' };
  if (farm.island !== 'home' && !(farm.island === 'village' && farm.village.built)) return { available: false, label: 'Посетите пекарскую мастерскую на Родном острове или в Лавандовой гавани.' };
  if (!workshopIngredients.every((item) => ingredientCount(farm, item) >= item.quantity)) {
    return { available: false, label: 'Принесите 2 пшеницы и 1 яйцо для выпечки.' };
  }
  return { available: true, label: 'Слепить и испечь' };
}

export function bakeWorkshop(farm: FarmState, shape: WorkshopShape): ActionResult {
  if (!isId(workshopShapes, shape)) return failure('Слепите круглую булочку, слойку или батон.');
  const action = getWorkshopAction(farm);
  if (!action.available) return failure(action.label);
  for (const item of workshopIngredients) removeStock(farm, item);
  farm.handmade[shape] += 1;
  noteFestivalActivity(farm.festivals,'bake');
  if (!farm.workshopPatterns.includes(shape)) farm.workshopPatterns.push(shape);
  farm.workToday += 1;
  return { ok: true, message: `Готово: ${workshopDefinitions[shape].name.toLowerCase()}. Образец сохранён.` };
}

const villageRequirements: readonly StockItem[] = [
  { kind: 'handmade', item: 'round', quantity: 2 },
  { kind: 'fish', item: 'seaBass', quantity: 2 },
  { kind: 'honey', quantity: 2 },
];
export const villagePrice = 48;
export const villageGuestTarget = 1;

export function getVillageHomeCount(farm: FarmState): number {
  return farm.village.built ? farm.village.meals >= 2 ? 2 : 1 : 0;
}

function festivalContext(farm:FarmState):FestivalContext {
  return {...farm,count:item=>ingredientCount(farm,item),take:item=>removeStock(farm,item),value:item=>unitPrice(item,farm)*item.quantity};
}
function syncFestivalRewards(farm:FarmState):void {
  farm.freight.harvestStore=Math.min(3,farm.festivals.completed.harvest);
  farm.bayShop.festivalVisitors=Math.min(3,farm.festivals.completed.lights);
  farm.musicGarden.festivalLevel=Math.min(3,farm.festivals.completed.stage);
  farm.musicGarden.festivalUnlocked=farm.festivals.completed.stage>0;
}
export function getFestivalChoices(farm:FarmState) {return getBayFestivalChoices(farm.festivals,festivalContext(farm));}
export function getFestivalStatus(farm:FarmState) {return getBayFestivalStatus(farm.festivals,festivalContext(farm));}
export function beginFestival(farm:FarmState,id:FestivalTradition):ActionResult {return beginBayFestival(farm.festivals,festivalContext(farm),id);}
export function contributeFestival(farm:FarmState,requirementId?:string,alternativeId?:string):ActionResult {
  const result=contributeBayFestival(farm.festivals,festivalContext(farm),requirementId,alternativeId);
  if(result.ok)farm.workToday++;
  return result;
}
export function finishFestival(farm:FarmState):ActionResult {
  const status=getFestivalStatus(farm).active;
  if(!status?.canFinish||!Number.isSafeInteger(farm.coins+status.reward))return failure('Завершите приготовления и дождитесь следующего утра в гавани.');
  const result=finishBayFestival(farm.festivals,festivalContext(farm));
  if(result.ok){farm.coins+=result.reward??0;farm.workToday++;syncFestivalRewards(farm);}
  return result;
}

export function getVillageProject(farm: FarmState) {
  const unlocked = isProjectComplete(farm, 'fair') && farm.fairGuestsServed >= villageGuestTarget;
  const items = supplyProgress(farm, villageRequirements, farm.village.supplies, farm.village.built);
  const supplied = items.every(({ item, delivered }) => delivered === item.quantity);
  const status: 'locked' | 'waiting' | 'ready' | 'completed' = farm.village.built ? 'completed'
    : !unlocked || farm.island !== 'home' ? 'locked'
    : items.some(({ available }) => available > 0) || supplied && farm.coins >= villagePrice ? 'ready' : 'waiting';
  return { name: 'Живая бухта', coins: villagePrice, items, status, unlocked, homes: getVillageHomeCount(farm) } as const;
}

export function contributeVillage(farm: FarmState): ActionResult {
  const project = getVillageProject(farm);
  if (project.status === 'completed') return failure('Живая бухта уже открыта.');
  if (project.status === 'locked') return failure('Угостите первого гостя ярмарки, затем постройте Живую бухту на Родном острове.');
  if (project.status !== 'ready') return failure(`Принесите недостающие припасы и ${villagePrice} монет.`);
  const donated = depositSupplies(farm, project.items, farm.village.supplies);
  const supplied = villageRequirements.every((item) => farm.village.supplies[marketKey(item)] === item.quantity);
  if (supplied && farm.coins >= villagePrice) {
    farm.coins -= villagePrice;
    farm.village.built = true;
    return { ok: true, message: 'Живая бухта открыта! Пригласите соседа в первый домик.' };
  }
  return { ok: true, message: `Доставлено: ${ruCount(donated, 'припас', 'припаса', 'припасов')}.${supplied ? ` Принесите ${villagePrice} монет, чтобы достроить домики.` : ''}` };
}

export function inviteResident(farm: FarmState, id: ResidentId | null, slot: number): ActionResult {
  if (farm.island !== 'village' || !isQuantity(slot) || slot >= getVillageHomeCount(farm)) return failure('Выберите свободный домик в Лавандовой гавани.');
  if (id !== null && !isId(residentIds, id)) return failure('Выберите соседа для приглашения.');
  const oldSlot = id === null ? -1 : farm.village.residents.indexOf(id);
  if (oldSlot === slot) return failure('Этот сосед уже живёт здесь.');
  if (oldSlot >= 0) farm.village.residents[oldSlot] = farm.village.residents[slot];
  farm.village.residents[slot] = id;
  if (id && farm.neighbors[id].current === null) farm.neighbors[id].current = prepareNeighbor(farm.neighbors[id], farm.day);
  return { ok: true, message: id ? `${residentDefinitions[id].name} теперь живёт в домике.` : 'Домик готов принять нового соседа.' };
}

export function getVillageMeal(farm: FarmState, shape: WorkshopShape = farm.workshopPatterns[0] ?? 'round') {
  const fish: FishId = farm.village.residents.includes('finn') ? 'seaBass' : 'perch';
  const items: readonly StockItem[] = [{ kind: 'handmade', item: shape, quantity: 1 }, { kind: 'fish', item: fish, quantity: 1 }];
  const served = farm.village.mealOn === farm.day;
  const available = farm.island === 'village' && farm.village.built && !served && isId(workshopShapes, shape)
    && items.every((item) => ingredientCount(farm, item) >= item.quantity);
  return { available, served, items, shape, fish, meals: farm.village.meals,
    label: served ? 'Сегодня соседи уже поужинали.' : 'Принесите к общему столу 1 свою выпечку и 1 рыбу.' };
}

export function serveVillageMeal(farm: FarmState, shape: WorkshopShape): ActionResult {
  if (!isId(workshopShapes, shape)) return failure('Выберите свою выпечку.');
  const meal = getVillageMeal(farm, shape);
  if (!meal.available) return failure(meal.label);
  for (const item of meal.items) removeStock(farm, item);
  farm.village.meals += 1;
  farm.village.mealOn = farm.day;
  farm.workToday += 1;
  return { ok: true, message: `Вы поужинали с соседями.${farm.village.meals === 2 ? ' Второй домик готов!' : ''}` };
}

export function getResidentService(farm: FarmState, id: ResidentId, shape: WorkshopShape = farm.workshopPatterns[0] ?? 'round') {
  const present = isId(residentIds, id) && farm.island === 'village' && farm.village.built && farm.village.residents.includes(id);
  const used = isId(residentIds, id) && farm.village.serviceOn[id] === farm.day;
  const known = isId(workshopShapes, shape) && farm.workshopPatterns.includes(shape);
  const ingredients = farm.produce.wheat >= 4 && farm.eggs >= 2;
  const available = present && !used && (id === 'finn' ? !farm.village.scouting : known && ingredients);
  const label = !present ? 'Пригласите соседа в домик Лавандовой гавани.' : used ? 'Сегодня сосед уже помог вам.'
    : id === 'finn' ? farm.village.scouting ? 'Всё готово к следующей рыбалке.' : 'Подготовить следующую рыбалку'
    : !known ? `Испеките вручную: ${workshopDefinitions[shape].name.toLowerCase()}. Выберите эту форму в мастерской и нажмите «Испечь» — Беа запомнит образец.` : !ingredients ? 'Принесите 4 пшеницы и 2 яйца для трёх изделий.' : farm.culinary.tastings.bea.bonus||farm.neighbors.bea.helpReady?'Попросить Беа испечь четыре изделия':'Попросить Беа испечь три изделия';
  return { available, label, used, shape };
}

export function runResidentService(farm: FarmState, id: ResidentId, shape: WorkshopShape = farm.workshopPatterns[0] ?? 'round'): ActionResult {
  const action = getResidentService(farm, id, shape);
  if (!action.available) return failure(action.label);
  farm.village.serviceOn[id] = farm.day;
  const pastries=farm.culinary.tastings.bea.bonus||farm.neighbors.bea.helpReady?4:3;
  if (id === 'finn') farm.village.scouting = true;
  else {
    farm.produce.wheat -= 4;
    farm.eggs -= 2;
    farm.handmade[shape] += pastries;
    farm.culinary.tastings.bea.bonus=false;farm.neighbors.bea.helpReady=false;
  }
  farm.workToday += 1;
  return { ok: true, message: id === 'finn' ? 'Финн нашёл безопасный путь. Следующий крючок вместит ещё одну рыбу.'
    : `Беа испекла: ${workshopDefinitions[shape].name.toLowerCase()} × ${pastries}.` };
}

export function gatherSeaSalt(farm: FarmState): ActionResult {
  if (farm.island !== 'grove') return failure('Собирайте морскую соль в заводях Солёной рощи.');
  if (farm.saltGatheredToday) return failure('К утру появится новая морская соль.');
  farm.saltGatheredToday = true;
  farm.seaSalt += 2;
  farm.workToday += 1;
  return { ok: true, message: 'Собрано 2 порции морской соли в заводи.' };
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
  if (farm.island !== 'grove') return failure('Ищите ракушки в Солёной роще.');
  const shell = getShellAt(farm, spot);
  if (!shell) return failure('На этом участке пляжа всё собрано.');
  farm.shellsCollectedToday.push(spot);
  noteFestivalActivity(farm.festivals,'shore');
  farm.shells[shell] += 1;
  farm.workToday += 1;
  const discovered = !farm.shellDiscoveries.includes(shell);
  if (discovered) farm.shellDiscoveries.push(shell);
  const message = `${discovered ? 'Новое открытие' : 'Находка'}: ${shellDefinitions[shell].name.toLowerCase()}.`;
  return { ok: true, message: discovered && hasShoal(farm) ? `${message} Открыта Лунная отмель.` : message };
}

export function getCoveActions(farm:FarmState){
  const unlocked=farm.boatOwned&&farm.shellDiscoveries.length>0,ecology=getCoveEcology(farm.shoreline,farm.day),choices=farm.shoreline.pending??ecology.choices;
  const phase=!unlocked?'locked' as const:farm.shoreline.pending?'pending' as const:farm.shoreline.settled?'settled' as const:'natural' as const;
  return {unlocked,available:unlocked&&farm.island==='grove',phase,choices:{...choices},settled:farm.shoreline.settled?{...farm.shoreline.settled}:null,pending:farm.shoreline.pending?{...farm.shoreline.pending}:null,nextTide:farm.day+1,revision:farm.shoreline.revision,ecology,presets:covePresets,observations:farm.shoreline.observations.map(id=>({id,...coveObservationDefinitions[id]})),label:!unlocked?'Отправляйтесь в Солёную рощу и найдите первую ракушку.':farm.island!=='grove'?'Посетите живую бухту Солёной рощи.':phase==='pending'?'Ночной прилив закрепит эти изменения.':'Выберите течение, растительность и укрытие.'};
}
export function changeCove(farm:FarmState,change:Partial<CoveChoices>):ActionResult{
  const action=getCoveActions(farm);
  if(!action.available)return failure(action.label);
  if(!isRecord(change)||Object.keys(change).length===0||Object.keys(change).some(key=>!['flow','cover','refuge'].includes(key)))return failure('Выберите течение, растительность или укрытие.');
  const choices={...action.choices,...change};if(!isCoveChoices(choices))return failure('Выберите материалы для бухты.');
  if(sameCove(choices,farm.shoreline.pending??farm.shoreline.settled))return failure('Этот вариант уже выбран.');
  farm.shoreline.pending=sameCove(choices,farm.shoreline.settled)?null:{...choices};farm.shoreline.changedOn=farm.day;
  return {ok:true,message:farm.shoreline.pending?'Ночной прилив преобразит бухту.':'Запланированные изменения отменены.'};
}
export function getCoveHabitat(farm:FarmState):CoveFishingHabitat|undefined{
  return farm.island==='grove'&&farm.shoreline.settled?{...getCoveEcology(farm.shoreline,farm.day).fishing}:undefined;
}

export function collectShoalFind(farm: FarmState, id: ShoalFindId): ActionResult {
  if (farm.island !== 'grove' || !getShoalFindAt(farm, id)) return failure('Ищите сокровища на Лунной отмели.');
  farm.shoalCollectedToday.push(id);
  noteFestivalActivity(farm.festivals,'shore');
  farm.shoalFinds[id] += 1;
  farm.workToday += 1;
  const discovered = !farm.shoalDiscoveries.includes(id);
  if (discovered) farm.shoalDiscoveries.push(id);
  return { ok: true, message: `${discovered ? 'Новое открытие' : 'Находка'}: ${shoalDefinitions[id].name.toLowerCase()}.` };
}

export function upgradeBuilding(farm: FarmState, building: BuildingId): ActionResult {
  if (!isId(buildingIds, building) || farm.island !== 'home') return failure('Выберите постройку на ферме.');
  const definition = buildingDefinitions[building];
  if (farm.buildingLevels[building] >= 2) return failure(`Уже улучшено: ${definition.name.toLowerCase()}.`);
  if (farm.coins < definition.upgradePrice) return failure('Не хватает монет на улучшение.');
  farm.coins -= definition.upgradePrice;
  farm.buildingLevels[building] = 2;
  fitHenPositions(farm);
  if (building === 'well') farm.water = getWaterCapacity(farm);
  return { ok: true, message: `Улучшено: ${definition.name.toLowerCase()}.` };
}

export function specializeFarmhouse(farm: FarmState, id: SpecializationId): ActionResult {
  if (farm.island !== 'home' || !isId(specializationIds, id)) return failure('Выберите направление развития дома.');
  if (farm.farmhouseSpecialization !== null) return failure('Направление развития дома уже выбрано.');
  if (farm.buildingLevels.farmhouse !== 2) return failure('Сначала улучшите дом до уровня 2.');
  const definition = specializationDefinitions[id];
  if (farm.coins < definition.price) return failure('Не хватает монет на это направление.');
  farm.coins -= definition.price;
  farm.buildingLevels.farmhouse = 3;
  fitHenPositions(farm);
  farm.farmhouseSpecialization = id;
  return { ok: true, message: `Открыто: ${definition.name.toLowerCase()}.` };
}

export function specializeFacility(farm: FarmState, branch: FacilityBranch): ActionResult {
  if (farm.island !== 'home' || !isId(facilityBranchIds, branch)) return failure('Выберите направление развития фермы.');
  const coop = isId(coopSpecializationIds, branch);
  const building = coop ? 'coop' : 'well';
  const name = buildingDefinitions[building].name;
  if (farm.buildingLevels[building] === 3) return failure(`Направление уже выбрано: ${name.toLowerCase()}.`);
  if (farm.buildingLevels[building] !== 2) return failure(`Сначала улучшите до уровня 2: ${name.toLowerCase()}.`);
  const definition = coop ? facilitySpecializations.coop[branch] : facilitySpecializations.well[branch];
  if (farm.coins < definition.price) return failure('Не хватает монет на это направление.');
  farm.coins -= definition.price;
  farm.buildingLevels[building] = 3;
  fitHenPositions(farm);
  if (coop) farm.coopSpecialization = branch;
  else farm.wellSpecialization = branch;
  return { ok: true, message: `Открыто: ${definition.name.toLowerCase()}.` };
}

export function getGrillFish(farm: FarmState): FishId {
  return farm.fish.seaBass > 0 ? 'seaBass' : fishIds.find(id => farm.fish[id] > 0) ?? 'seaBass';
}

export function getCookIngredients(farm: FarmState, dish: DishId, fish: FishId = getGrillFish(farm)): StockItem[] {
  return dishDefinitions[dish].ingredients.map(item => dish === 'grilledFish' && item.kind === 'fish' ? { ...item, item: fish } : { ...item });
}

export function getCookAction(farm: FarmState, dish: DishId, fish?: FishId): { available: boolean; label: string } {
  if (!isId(dishIds, dish)) return { available: false, label: 'Выберите рецепт.' };
  const definition = dishDefinitions[dish];
  if (definition.capeLevel) {
    if (farm.island !== 'cape') return { available: false, label: 'Готовьте в Медовой кухне на Цветочном мысе.' };
    if (farm.capeLevel < definition.capeLevel) return { available: false, label: 'Постройте Медовую кухню на Цветочном мысе для этого блюда.' };
  } else if (farm.island !== 'home' && !(farm.island === 'village' && farm.village.built)) return { available: false, label: 'Кухня есть дома и в Лавандовой гавани.' };
  if (dish === 'honeyCake' && !canSailTo(farm, 'cape')) return { available: false, label: 'Откройте путь на Цветочный мыс, чтобы узнать этот рецепт.' };
  if (definition.specialization && farm.farmhouseSpecialization !== definition.specialization) {
    return { available: false, label: `Нужно направление: ${specializationDefinitions[definition.specialization].name.toLowerCase()}.` };
  }
  if (farm.buildingLevels.farmhouse < definition.requiredLevel) return { available: false, label: 'Улучшите дом для этого блюда.' };
  if (!getCookIngredients(farm, dish, fish).every((ingredient) => ingredientCount(farm, ingredient) >= ingredient.quantity)) {
    return { available: false, label: 'Сначала соберите ингредиенты.' };
  }
  return { available: true, label: `Приготовить: ${definition.name.toLowerCase()}` };
}

export function cookDish(farm: FarmState, dish: DishId,result?:CookeryResult): ActionResult {
  const families:Partial<Record<DishId,CookeryResult['family']>>={strawberryTart:'decorate',blueberryTart:'decorate',raspberryTart:'decorate',orchardTart:'decorate',appleJam:'preserves',orchardPreserves:'preserves',honeyCake:'honeyCake',honeyPear:'honeyPear',honeyBiscuits:'honeyBiscuits',windParfait:'windParfait',grilledFish:'grilledFish'};
  if(dish==='grilledFish'&&(!result||!isCookeryResult(result)||result.baking?.method!=='grill'||result.baking.finish!=='golden'||result.baking.seconds<=0||!['season-fish','grill-first-side','turn-fish','grill-second-side','plate-fish','arrange-carrot'].every(step=>result.steps.includes(step))))return failure('Приправьте рыбу, обжарьте с двух сторон и выложите на тарелку с морковью.');
  if(result&&(!isCookeryResult(result)||result.family!==families[dish]))return failure('Закончите выбранный рецепт на кухонном столе.');
  const fish = result?.fishSpecies ?? 'seaBass';
  const action = getCookAction(farm, dish, fish);
  if (!action.available) return failure(action.label);
  const definition = dishDefinitions[dish];
  const bonus=farm.culinary.picnic?.day===farm.day&&farm.culinary.picnic.processing==='silky';
  if(!Number.isSafeInteger(farm.dishes[dish]+(bonus?2:1))||!Number.isSafeInteger(farm.workToday+1))return failure('В кладовой пока нет места для нового блюда.');
  for (const ingredient of getCookIngredients(farm, dish, fish)) removeStock(farm, ingredient);
  farm.dishes[dish] += bonus?2:1;
  noteFestivalActivity(farm.festivals,'bake');
  if(bonus)farm.culinary.picnic=null;
  if(result)farm.culinary.lastDishes[dish]=copyCookeryResult(result);
  discoverBay(farm, dish);
  farm.workToday += 1;
  return { ok: true, message: `Готово: ${definition.name.toLowerCase()}.` };
}

function signatureItems(draft:SignatureDraft):StockItem[]{
  const parts:StockItem[]=draft.ingredients.map(part=>part.trait?{kind:'variants',item:part.id,trait:part.trait,quantity:part.quantity}:isId(treeIds,part.id)?{kind:'fruit',item:part.id,quantity:part.quantity}:{kind:'produce',item:part.id,quantity:part.quantity});
  return draft.base==='tart'?[...parts,{kind:'produce',item:'wheat',quantity:1},{kind:'eggs',quantity:1}]:parts;
}
export function getSignatureAction(farm:FarmState,draft:SignatureDraft){
  const normalized=normalizeSignatureDraft(draft),items=normalized?signatureItems(normalized):[];
  const kitchen=farm.island==='home'||farm.island==='village'&&farm.village.built;
  const level=normalized?.base==='preserves'?2:1;
  const available=!!normalized&&kitchen&&farm.buildingLevels.farmhouse>=level&&items.every(item=>ingredientCount(farm,item)>=item.quantity);
  const label=!normalized?'Выберите две порции фруктов или ягод.':!kitchen?'Готовьте на кухне Родного острова или Лавандовой гавани.':farm.buildingLevels.farmhouse<level?'Улучшите дом, чтобы готовить заготовки.':!available?'Соберите выбранные ингредиенты.':'Приготовить свой рецепт';
  return {available,label,items};
}
function craftSignature(farm:FarmState,draft:SignatureDraft,result:CookeryResult,quantity:number):ActionResult&{recipeId?:string}{
  const normalized=normalizeSignatureDraft(draft);
  if(!normalized||!isCookeryResult(result)||result.family!==(normalized.base==='tart'?'decorate':'preserves')||result.fruit.some(p=>!normalized.ingredients.some(part=>part.id===p.ingredientId&&((p.trait===undefined&&result.fruitTraitsVersion!==1)||part.trait===p.trait)))||quantity!==1&&quantity!==3)return failure('Выберите готовый рецепт.');
  const action=getSignatureAction(farm,normalized),items=action.items.map(item=>({...item,quantity:item.quantity*quantity}));
  if(!action.available||!items.every(item=>ingredientCount(farm,item)>=item.quantity))return failure(action.available?'Соберите ингредиенты для всей партии.':action.label);
  if(!Number.isSafeInteger(farm.workToday+1))return failure('Журнал работ заполнен.');
  const identity=signatureIdentity(normalized,result),existing=farm.culinary.recipes.find(recipe=>signatureIdentity(recipe,recipe.result)===identity);
  if(quantity===3&&!existing)return failure('Сначала приготовьте этот вариант один раз, затем сможете готовить тройную партию.');
  if(!existing&&(farm.culinary.recipes.length>=signatureRecipeLimit||farm.culinary.serial>=999999))return failure('Книга рецептов заполнена. Используйте запас блюда и уберите рецепт в архив.');
  const bonus=farm.culinary.picnic?.day===farm.day&&farm.culinary.picnic.processing==='silky',made=quantity+Number(bonus);
  if(existing&&((farm.culinary.stock[existing.id]??0)+made>1_000_000||existing.batches+quantity>1_000_000))return failure('Для этого блюда больше нет места в кладовой.');
  const processing=result.processing??(normalized.base==='tart'?'chunky':'bright');
  const recipe:SignatureRecipe=existing??{id:`s${farm.culinary.serial+1}`,name:`${normalized.base==='tart'?'Тарт':'Конфитюр'}: ${normalized.ingredients.map(part=>signatureFruitNames[part.id].toLowerCase()).join(' + ')}`,favorite:false,base:normalized.base,ingredients:normalized.ingredients.map(part=>({...part})),processing,result:copyCookeryResult(result),createdOn:farm.day,batches:0,sellPrice:signatureSellPrice(normalized,action.items.reduce((sum,item)=>sum+unitPrice(item,farm)*item.quantity,0))};
  for(const item of items)removeStock(farm,item);
  if(!existing){farm.culinary.serial++;farm.culinary.recipes.push(recipe)}
  noteFestivalActivity(farm.festivals,'bake');
  recipe.batches+=quantity;recipe.result=copyCookeryResult(result);farm.culinary.stock[recipe.id]=(farm.culinary.stock[recipe.id]??0)+made;
  if(bonus)farm.culinary.picnic=null;
  farm.workToday++;
  return {ok:true,message:`Готово: «${recipe.name}» — ${ruCount(made, 'порция', 'порции', 'порций')}. Рецепт сохранён.`,recipeId:recipe.id};
}
export function completeSignature(farm:FarmState,draft:SignatureDraft,result:CookeryResult):ActionResult&{recipeId?:string}{return craftSignature(farm,draft,result,1)}
export function repeatSignature(farm:FarmState,id:string,result?:CookeryResult,quantity=1):ActionResult&{recipeId?:string}{
  const recipe=farm.culinary.recipes.find(recipe=>recipe.id===id);
  return recipe?craftSignature(farm,recipe,result??recipe.result,quantity):failure('Выберите уже приготовленный рецепт.');
}
export function getSignatureStock(farm:FarmState){return farm.culinary.recipes.map(recipe=>({recipe,count:farm.culinary.stock[recipe.id]??0}))}
export function nameSignature(farm:FarmState,id:string,name:string):ActionResult{
  const recipe=farm.culinary.recipes.find(recipe=>recipe.id===id);if(!recipe||!validSignatureName(name))return failure('Введите название рецепта длиной от 1 до 32 символов.');recipe.name=name.trim();return {ok:true,message:'Название рецепта сохранено.'};
}
export function favoriteSignature(farm:FarmState,id:string,favorite?:boolean):ActionResult{
  const recipe=farm.culinary.recipes.find(recipe=>recipe.id===id);if(!recipe||favorite!==undefined&&typeof favorite!=='boolean')return failure('Выберите сохранённый рецепт.');recipe.favorite=favorite??!recipe.favorite;return {ok:true,message:recipe.favorite?'Рецепт добавлен в избранное.':'Рецепт удалён из избранного.'};
}
export function forgetSignature(farm:FarmState,id:string):ActionResult{
  const product = 'signature:' + id;
  if (Object.values(farm.freight.warehouses).some(stock => stock[product] > 0)
    || farm.freight.ship.cargo.some(lot => lot.id === product)
    || farm.bayShop.slots.some(slot => slot?.product.id === product && slot.quantity > 0))
    return failure('Заберите партию из лавки или со склада перед архивацией рецепта.');
  const recipe=farm.culinary.recipes.find(recipe=>recipe.id===id);if(!recipe||recipe.favorite||(farm.culinary.stock[id]??0)>0)return failure('Используйте запас блюда и удалите рецепт из избранного перед архивацией.');farm.culinary.recipes=farm.culinary.recipes.filter(recipe=>recipe.id!==id);delete farm.culinary.stock[id];for(const memory of Object.values(farm.culinary.tastings)){memory.favoriteIds=memory.favoriteIds.filter(value=>value!==id);if(memory.lastRecipeId===id)memory.lastRecipeId=null}return {ok:true,message:'Рецепт убран в архив.'};
}
export function sellSignature(farm:FarmState,id:string,quantity=1):ActionResult{
  const recipe=farm.culinary.recipes.find(recipe=>recipe.id===id);if(farm.island!=='home'||!recipe||!isQuantity(quantity)||quantity<1||quantity>(farm.culinary.stock[id]??0))return failure('Принесите приготовленное блюдо на рынок Родного острова.');
  const next=farm.progress.sell+1,bonus=goals.find(goal=>goal.id==='sell'&&goal.target===next)?.reward??0;
  if(!Number.isSafeInteger(next)||!Number.isSafeInteger(farm.workToday+1)||!Number.isSafeInteger(farm.coins+recipe.sellPrice*quantity+bonus))return failure('Рыночный журнал заполнен.');
  farm.culinary.stock[id]-=quantity;farm.coins+=recipe.sellPrice*quantity;return record(farm,'sell',`Продано: «${recipe.name}» — ${ruCount(quantity, 'порция', 'порции', 'порций')}.`);
}
export function useSignature(farm:FarmState,id:string):ActionResult{
  const recipe=farm.culinary.recipes.find(recipe=>recipe.id===id);if(!recipe||(farm.culinary.stock[id]??0)<1||farm.culinary.picnic!==null)return failure('Сначала используйте эффект пикника, затем выберите новое блюдо из запаса.');farm.culinary.stock[id]--;farm.culinary.picnic={processing:recipe.processing,day:farm.day};return {ok:true,message:`Вы попробовали «${recipe.name}». ${recipe.processing==='bright'?'На следующей рыбалке крючок вместит ещё одну находку.':recipe.processing==='silky'?'Следующая готовка даст ещё одну порцию.':'Следующий сбор урожая даст ещё одну единицу.'}`};
}
export function tasteSignature(farm:FarmState,id:string,resident:ResidentId):ActionResult{
  const recipe=farm.culinary.recipes.find(recipe=>recipe.id===id);
  if(!isId(residentIds,resident)||farm.island!=='village'||!farm.village.built||!farm.village.residents.includes(resident)||!recipe||(farm.culinary.stock[id]??0)<1)return failure('Принесите приготовленное блюдо приглашённому соседу в гавани.');
  const memory=farm.culinary.tastings[resident];if(memory.servedOn===farm.day||memory.visits>=1_000_000)return failure('Сегодня сосед уже пробовал ваше блюдо.');
  const taste=residentTastes[resident],liked=recipe.processing===taste.processing||recipe.ingredients.some(part=>part.id===taste.fruit);
  farm.culinary.stock[id]--;memory.servedOn=farm.day;memory.visits++;memory.lastRecipeId=id;
  if(liked){memory.liked++;memory.bonus=true;if(!memory.favoriteIds.includes(id))memory.favoriteIds.push(id)}
  return {ok:true,message:`${taste.name} запомнит блюдо «${recipe.name}».${liked?resident==='bea'?' В следующий раз Беа испечёт ещё одно изделие.':' К следующей рыбалке Финн подготовит особенно прочный крючок.':' В другой день попробуйте любимый фрукт или текстуру этого соседа.'}`};
}
export function deliverSignature(farm:FarmState,id:string):ActionResult{
  const recipe=farm.culinary.recipes.find(recipe=>recipe.id===id),fish=farm.village.residents.includes('finn')?'seaBass':'perch';
  if(!recipe||farm.island!=='village'||!farm.village.built||farm.village.mealOn===farm.day||(farm.culinary.stock[id]??0)<1||farm.fish[fish]<1)return failure('Принесите к общему столу гавани одно авторское блюдо и одну рыбу.');
  if(!Number.isSafeInteger(farm.workToday+1)||!Number.isSafeInteger(farm.village.meals+1))return failure('Журнал ужинов заполнен.');
  farm.culinary.stock[id]--;farm.fish[fish]--;farm.village.meals++;farm.village.mealOn=farm.day;farm.workToday++;return {ok:true,message:`Блюдо «${recipe.name}» подано к общему ужину. ${farm.village.meals===2?'Второй домик готов!':''}`};
}

export function foodDescriptors(farm: FarmState): FoodDescriptor[] {
  return [
    ...dishIds.map(item => ({ id: `dish:${item}` as const, name: dishDefinitions[item].name, source: 'dish' as const, identity: item,
      ingredients: dishDefinitions[item].ingredients.map(part => 'item' in part ? part.item : part.kind),
      preparation: farm.culinary.lastDishes[item] ? copyCookeryResult(farm.culinary.lastDishes[item]) : undefined,
      count: farm.dishes[item], sellPrice: dishDefinitions[item].sellPrice })),
    ...workshopShapes.map(item => ({ id: `handmade:${item}` as const, name: workshopDefinitions[item].name, source: 'handmade' as const,
      identity: item, ingredients: ['wheat', 'eggs'], count: farm.handmade[item], sellPrice: workshopDefinitions[item].sellPrice })),
    ...farm.culinary.recipes.map(recipe => ({ id: `signature:${recipe.id}` as const, name: recipe.name, source: 'signature' as const,
      identity: recipe.base, ingredients: recipe.ingredients.map(part => part.id), recipeIngredients: recipe.ingredients.map(part=>({...part})), processing: recipe.processing,
      preparation: copyCookeryResult(recipe.result), count: farm.culinary.stock[recipe.id] ?? 0, sellPrice: recipe.sellPrice })),
  ];
}
export function getIntentOffers(farm: FarmState, intent: IntentId) {
  if (!isId(intentIds, intent)) return [];
  return foodDescriptors(farm).map(food => ({ ...evaluateFood(food, intent),
    canCook: food.source === 'dish' ? getCookAction(farm, food.identity as DishId).available
      : food.source === 'handmade' ? farm.workshopPatterns.includes(food.identity as WorkshopShape) && getWorkshopAction(farm).available
      : getSignatureAction(farm, farm.culinary.recipes.find(recipe => `signature:${recipe.id}` === food.id)!).available }));
}
export function getCommunityOrders(farm: FarmState) {
  const unlocked = isProjectComplete(farm, 'fair');
  return currentIntentIds(farm.day).map(intentId => ({ id: `intent:${farm.day}:${intentId}`, intentId, ...intentDefinitions[intentId],
    chips: intentDefinitions[intentId].requiredQualities.map(quality => qualityNames[quality]), quantity: 1, rewardBonus: 12, unlocked,
    delivered: farm.intentOrders[intentId].deliveredOn === farm.day, offers: getIntentOffers(farm, intentId) }));
}
function consumeFood(farm: FarmState, offer: FoodDescriptor): void {
  if (offer.source === 'signature') farm.culinary.stock[offer.id.slice('signature:'.length)]--;
  else if (offer.source === 'dish') removeStock(farm, { kind: 'dishes', item: offer.identity as DishId, quantity: 1 });
  else removeStock(farm, { kind: 'handmade', item: offer.identity as WorkshopShape, quantity: 1 });
}
export function deliverIntentOrder(farm: FarmState, id: string, offerId: FoodOfferId): ActionResult {
  const order = getCommunityOrders(farm).find(order => order.id === id);
  if (!order || !order.unlocked || farm.island !== 'home') return failure('Выберите сегодняшнюю просьбу на ярмарке Родного острова.');
  if (order.delivered) return failure('Эта просьба уже выполнена. Завтра появятся новые.');
  const offer = order.offers.find(offer => offer.id === offerId);
  if (!offer?.available) return failure('Выберите подходящее приготовленное блюдо из запаса.');
  const ledger = farm.intentOrders[order.intentId];
  if (ledger.completed >= 1_000_000 || !Number.isSafeInteger(farm.coins + offer.reward) || !Number.isSafeInteger(farm.workToday + 1)) return failure('Журнал ярмарки заполнен.');
  consumeFood(farm, offer); ledger.completed++; ledger.deliveredOn = farm.day;
  farm.coins += offer.reward; farm.workToday++;
  return { ok: true, message: `«${offer.name}» принято. ${offer.reward} монет: стоимость блюда и благодарность за помощь.` };
}
export function getNeighborPlans(farm: FarmState) {
  if (!farm.village.built) return [];
  return residentIds.filter(resident => farm.village.residents.includes(resident)).map(resident => {
    const history = farm.neighbors[resident], plan = history.current ?? prepareNeighbor(history, farm.day);
    const episode = episodeFor(resident, plan.serial), definition = neighborEpisodes[episode], memory = history.memories.at(-1) ?? null;
    const recollection = memory ? `${residentDefinitions[resident].name} помнит «${memory.foodName}» и уже приготовил${resident === 'bea' ? 'а' : ''} для вас место.` : '';
    return { id: `${resident}:${plan.serial}`, phase: plan.phase, episode, ...definition,
      preparation: `${definition.preparation}${memory ? ` ${recollection}` : ''}`,
      dialogue: `${definition.dialogue}${memory ? ` В прошлый раз было так уютно с «${memory.foodName}».` : ''}`,
      food: plan.food ? { ...plan.food, qualities: [...plan.food.qualities] } : null,
      memory: memory ? { ...memory, qualities: [...memory.qualities] } : null,
      memoryCount: history.completed, helpReady: history.helpReady, chips: intentDefinitions[definition.intentId].requiredQualities.map(quality => qualityNames[quality]), requiredQualities: [...intentDefinitions[definition.intentId].requiredQualities],
      reward: plan.food ? (getIntentOffers(farm, definition.intentId).find(offer => offer.id === plan.food!.id)?.sellPrice ?? 0) + 12 : 12, nextAvailableOn: (memory?.day ?? 0) + 1 };
  });
}
function availableNeighborPlan(farm: FarmState, id: string) {
  return farm.island === 'village' ? getNeighborPlans(farm).find(plan => plan.id === id) : undefined;
}
export function joinNeighborPlan(farm: FarmState, id: string): ActionResult {
  const view = availableNeighborPlan(farm, id);
  if (!view || view.phase !== 'preparing') return failure('Подойдите к приглашённому соседу, который готовится к встрече.');
  const history = farm.neighbors[view.resident], plan = history.current ?? prepareNeighbor(history, farm.day);
  history.current = { ...plan, phase: 'joined', food: null };
  return { ok: true, message: `${residentDefinitions[view.resident].name} рад${view.resident === 'bea' ? 'а' : ''} вашей компании. ${intentDefinitions[view.intentId].request}` };
}
export function serveNeighborPlan(farm: FarmState, id: string, offerId: FoodOfferId): ActionResult {
  const view = availableNeighborPlan(farm, id);
  if (!view || view.phase !== 'joined' && view.phase !== 'arranging') return failure('Сначала присоединитесь к затее соседа.');
  const offer = getIntentOffers(farm, view.intentId).find(offer => offer.id === offerId);
  if (!offer?.available) return failure('Выберите подходящее приготовленное угощение.');
  const history = farm.neighbors[view.resident], plan = history.current!;
  history.current = { ...plan, phase: 'arranging', food: { id: offer.id, name: offer.name, qualities: [...offer.qualities] } };
  return { ok: true, message: 'Угощение выбрано. Устройте встречу: разместите еду, чашку и цветы.' };
}
export function finishNeighborPlan(farm: FarmState, id: string, assembly: NeighborAssembly): ActionResult {
  const view = availableNeighborPlan(farm, id);
  if (!view || view.phase !== 'arranging' || !view.food) return failure('Сначала выберите угощение для встречи.');
  if (!validNeighborAssembly(assembly, view.arrangement)) return failure('Разместите угощение по центру, а чашку и цветы — рядом, без наложений.');
  const history = farm.neighbors[view.resident], offer = getIntentOffers(farm, view.intentId).find(offer => offer.id === view.food!.id);
  if (!offer?.available) return failure('Выбранное угощение закончилось. Приготовьте ещё порцию или выберите другое.');
  const reward = offer.sellPrice + 12;
  if (history.completed >= 1_000_000 || history.memories.at(-1)?.day === farm.day || !Number.isSafeInteger(farm.coins + reward) || !Number.isSafeInteger(farm.workToday + 1)) return failure('Следующую встречу устроим в другой день.');
  const food = { id: offer.id, name: offer.name, qualities: [...offer.qualities] };
  consumeFood(farm, offer);
  history.current = { ...history.current!, phase: 'celebrating', food };
  history.completed++; history.helpReady = true;
  history.memories.push({ day: farm.day, episode: view.episode, foodName: offer.name, qualities: [...offer.qualities] });
  history.memories = history.memories.slice(-12);
  farm.coins += reward; farm.workToday++;
  if (farm.village.mealOn !== farm.day) { farm.village.meals++; farm.village.mealOn = farm.day; }
  return { ok: true, message: `${residentDefinitions[view.resident].name} запомнит «${offer.name}» и вашу встречу. ${view.resident === 'bea' ? 'В следующий раз Беа испечёт на одно изделие больше.' : 'Финн укрепит следующий подготовленный крючок.'}` };
}
export function advanceNeighborPlan(farm: FarmState, id: string): ActionResult {
  const view = availableNeighborPlan(farm, id);
  if (!view || view.phase !== 'celebrating' && view.phase !== 'remembered') return failure('Сначала проведите встречу с соседом.');
  const history = farm.neighbors[view.resident];
  if (farm.day > (history.memories.at(-1)?.day ?? 0)) history.current = prepareNeighbor(history, farm.day);
  else if (view.phase === 'celebrating') history.current = { ...history.current!, phase: 'remembered', food: history.current!.food! };
  else return failure('Сосед уже обдумывает следующую затею на завтра.');
  return { ok: true, message: farm.day >= view.nextAvailableOn ? 'У соседа появилась новая затея.' : 'Встреча осталась тёплым воспоминанием. Новая затея появится завтра.' };
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

function supplyOrderReward(farm: FarmState, order: Order): number {
  return Math.max(order.reward, order.items.reduce((sum, item) => sum + unitPrice(item, farm) * item.quantity, 0)
    + 6 + 2 * new Set(order.items.map(marketKey)).size);
}

function marketOrder(farm: FarmState, lane: OrderLane, menu: readonly Order[]) {
  const ledger = farm.orders[lane];
  const delivered = ledger.deliveredOn === farm.day;
  const order = menu[(ledger.completed - Number(delivered)) % menu.length];
  const status: 'delivered' | 'upgrade' | 'ready' | 'waiting' = delivered ? 'delivered'
    : order.upgradedKitchen && farm.buildingLevels.farmhouse < dishDefinitions.grilledFish.requiredLevel ? 'upgrade'
    : order.items.every((item) => ingredientCount(farm, item) >= item.quantity) ? 'ready' : 'waiting';
  return { ...order, reward: supplyOrderReward(farm,order), lane, status } as const;
}

export function getMarketOrders(farm: FarmState) {
  return orderLanes.flatMap((lane) => {
    const menu = marketOrderMenu(farm, lane);
    return menu ? [marketOrder(farm, lane, menu)] : [];
  });
}

function marketOrderMenu(farm: FarmState, lane: OrderLane): readonly Order[] | undefined {
  if (lane === 'harbor') return undefined;
  if (lane === 'kitchen' && farm.buildingLevels.farmhouse >= 2 && berryCropIds.some(id => Object.values(farm.discoveries[id] ?? {}).some(Boolean))) return [...orderMenus.kitchen, ...berryKitchenMenus];
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
  if (farm.island !== 'home' || !isId(orderLanes, lane)) return failure('Заказ недоступен.');
  const menu = marketOrderMenu(farm, lane);
  if (!menu) return failure('Заказ недоступен.');
  const order = marketOrder(farm, lane, menu);
  if (order.status === 'delivered') return failure('Заказ уже доставлен.');
  if (order.status === 'upgrade') return failure('Улучшите дом до уровня 2.');
  if (order.status !== 'ready') return failure('Соберите недостающие продукты.');
  for (const item of order.items) removeStock(farm, item);
  farm.coins += order.reward;
  farm.orders[lane].completed += 1;
  farm.orders[lane].deliveredOn = farm.day;
  return record(farm, 'sell', `Заказ доставлен. Награда: ${ruCount(order.reward, 'монета', 'монеты', 'монет')}.`);
}

function fitHenPositions(farm: FarmState): void {
  farm.henPositions = farm.henPositions.map(point => point && projectHenToGround(point, farm.buildingLevels));
}

export function moveHen(farm: FarmState, id: number, point: HenNativePoint): ActionResult {
  if (farm.island !== 'home' || !isChickenId(id, farm.flockSize)
    || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return failure('Выберите одну из своих кур.');
  farm.henPositions[id] = projectHenToGround(point, farm.buildingLevels);
  return { ok: true, message: '' };
}

export function petChicken(farm: FarmState, id: number): ActionResult {
  if (farm.island !== 'home' || !isChickenId(id, farm.flockSize)) return failure('Выберите одну из своих кур.');
  if (farm.pettedChickens.includes(id)) return failure('Сегодня эту курицу уже погладили.');
  farm.pettedChickens.push(id);
  farm.chickenHappiness = Math.min(maxChickenHappiness, farm.chickenHappiness + 1);
  return { ok: true, message: 'Курица довольно кудахчет.' };
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

export function unitPrice(item: StockItem, farm: FarmState): number {
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
  if (!isId(projectIds, id)) return failure('Выберите проект.');
  const project = getProject(farm, id);
  if (project.status === 'completed') return failure('Проект завершён.');
  if (project.status === 'locked') return failure('Этот проект недоступен здесь.');
  if (project.status !== 'ready') return failure('Нет припасов для доставки.');
  const donated = depositSupplies(farm, project.items, farm.projects[id]);
  if (isProjectComplete(farm, id)) {
    farm.coins += project.reward;
    return { ok: true, message: `Проект «${project.name}» завершён. +${ruCount(project.reward, 'монета', 'монеты', 'монет')}.` };
  }
  return { ok: true, message: `Доставлено: ${ruCount(donated, 'предмет', 'предмета', 'предметов')}.` };
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
    ? { name: 'Ужин в гавани', reward: 36, items: [meal, { kind: 'fish', item: 'seaBass', quantity: 1 }] }
    : { name: 'Посылка из Солёной рощи', reward: 34, items: [meal, { kind: 'seaSalt', quantity: 2 }] };
}

export function getHarborOrder(farm: FarmState) {
  if (!farm.boatOwned || !farm.farmhouseSpecialization || !isProjectComplete(farm, 'dock')) return undefined;
  const ledger = farm.orders.harbor;
  const complete = ledger.deliveredOn === farm.day;
  const order = harborMenu(farm.farmhouseSpecialization, ledger.completed - Number(complete));
  const items = supplyProgress(farm, order.items, farm.harborSupplies, complete);
  const status = complete ? 'completed' : farm.island !== 'grove' ? 'locked'
    : items.some(({ available }) => available > 0) ? 'ready' : 'waiting';
  return { ...order, reward: supplyOrderReward(farm,order), items, status } as const;
}

export function deliverHarborOrder(farm: FarmState): ActionResult {
  const order = getHarborOrder(farm);
  if (!order || farm.island !== 'grove') return failure('Доставьте припасы к причалу Солёной рощи.');
  if (order.status === 'completed') return failure('Заказ уже доставлен.');
  if (order.status !== 'ready') return failure('Нет припасов для доставки.');
  const donated = depositSupplies(farm, order.items, farm.harborSupplies);
  if (order.items.every(({ item }) => farm.harborSupplies[marketKey(item)] === item.quantity)) {
    farm.coins += order.reward;
    farm.orders.harbor.completed += 1;
    farm.orders.harbor.deliveredOn = farm.day;
    farm.harborSupplies = {};
    return { ok: true, message: `Заказ доставлен. Награда: ${ruCount(order.reward, 'монета', 'монеты', 'монет')}.` };
  }
  return { ok: true, message: `Доставлено: ${ruCount(donated, 'предмет', 'предмета', 'предметов')}.` };
}

export function getMarketStock(farm: FarmState) {
  return marketStock.flatMap((item) => {
    const count = ingredientCount(farm, item);
    return (item.kind === 'variants' || item.kind === 'shells' || item.kind === 'shoalFinds') && count === 0 ? []
      : [{ item, key: marketKey(item), count, price: unitPrice(item, farm) }];
  });
}

export function sellMarketItem(farm: FarmState, key: string): ActionResult {
  if (farm.island !== 'home') return failure('Продавайте товары на рынке.');
  const item = marketStock.find((entry) => marketKey(entry) === key);
  if (!item || ingredientCount(farm, item) < 1) return failure('Этот товар закончился.');
  const price = unitPrice(item, farm);
  removeStock(farm, item);
  farm.coins += price;
  return record(farm, 'sell', `Продано за ${ruCount(price, 'монету', 'монеты', 'монет')}.`);
}

export function sellProduce(farm: FarmState): ActionResult {
  const { items, coins } = getSale(farm);
  if (items === 0) return failure('Принесите товары с фермы или островов на продажу.');
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
  return record(farm, 'sell', `Продано: ${ruCount(items, 'предмет', 'предмета', 'предметов')}. Выручка: ${ruCount(coins, 'монета', 'монеты', 'монет')}.`);
}

export function endDay(farm: FarmState): ActionResult {
  if (farm.island !== 'home') return failure('Вернитесь на Родной остров, чтобы отдохнуть в доме.');
  farm.pendingFishingTrip = null;
  const tomorrow = farm.day + 1;
  for (const resident of residentIds) if (farm.neighbors[resident].current?.phase === 'remembered') farm.neighbors[resident].current = prepareNeighbor(farm.neighbors[resident], tomorrow);
  const { weather } = getClimate(tomorrow);
  let cropsGrew = false;
  for (const [index, bed] of farm.beds.entries()) {
    if (bed.kind !== 'crop') continue;
    if (bed.watered) {
      bed.growth += 1;
      delete bed.wateredAt;
      cropsGrew = true;
    }
    const crop = cropDefinitions[bed.crop];
    bed.watered = bed.growth < crop.days && (weather === 'rain' || (crop.retainsWater === true && bed.watered));
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
  farm.shoreline=settleCove(farm.shoreline,tomorrow);
  farm.culinary.picnic=null;
  const freightDayBefore= farm.freight.lastDay;
  advanceFreight(farm.freight, tomorrow, islandIds.filter(port => canSailTo(farm, port)), farm.capeLevel >= 2);
  if(farm.freight.lastDay>freightDayBefore)noteFestivalDelivery(farm.festivals,farm.freight.events.filter(event=>event.kind==='unloading'&&event.port==='village'&&event.day>freightDayBefore).reduce((sum,event)=>sum+event.items.reduce((count,item)=>count+item.quantity,0),0));
  syncFarmShopPrices(farm);
  for (const sale of advanceBayShopDay(farm.bayShop, tomorrow, Number(farm.concertDay === farm.day))) farm.coins += sale.price;
  farm.day = tomorrow;
  const hatched = farm.hatchDay === farm.day;
  if (hatched) {
    farm.flockSize = maxFlockSize;
    farm.hatchDay = null;
  }
  if (farm.wellSpecialization === 'rain') farm.water = getWaterCapacity(farm);
  farm.workToday = 0;
  const message = `Начался день ${farm.day}.${hatched ? ' Вылупилась новая курочка!' : ''}`;
  return cropsGrew ? record(farm, 'rest', message) : { ok: true, message };
}

export function getGoal(farm: FarmState): (Goal & { progress: number }) | undefined {
  const goal = goals.find(({ id, target }) => farm.progress[id] < target);
  return goal && { ...goal, progress: farm.progress[goal.id] };
}

function record(farm: FarmState, id: GoalId, message: string): ActionResult {
  if (id === 'harvest') noteFestivalActivity(farm.festivals,'harvest');
  if (id !== 'rest') farm.workToday += 1;
  farm.progress[id] += 1;
  const completed = goals.find((goal) => goal.id === id && goal.target === farm.progress[id]);
  if (!completed) return { ok: true, message };
  farm.coins += completed.reward;
  return { ok: true, message: `${message} Награда за задание: +${ruCount(completed.reward, 'монета', 'монеты', 'монет')}.` };
}

function failure(message: string): ActionResult {
  return { ok: false, message };
}

function syncFarmShopPrices(farm: FarmState): void {
  const products = farm.bayShop.slots.flatMap(slot => {
    if (!slot) return [];
    const item = marketStock.find(item => bayProductId(item) === slot.product.id);
    const recipe = slot.product.id.startsWith('signature:') ? farm.culinary.recipes.find(recipe => `signature:${recipe.id}` === slot.product.id) : undefined;
    const basePrice = item ? unitPrice(item, farm) : recipe?.sellPrice;
    return basePrice === undefined ? [] : [{ ...slot.product, basePrice }];
  });
  syncBayShopProducts(farm.bayShop, products);
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

function isTreeNursery(value: unknown, serial: number): value is FarmState['treeNursery'] {
  return Array.isArray(value) && Array.from(value).every(entry => isRecord(entry)
    && isQuantity(entry.id) && entry.id > 0 && entry.id <= serial
    && entry.tree !== null && isTreeSlot(entry.tree))
    && new Set(value.map(entry => entry.id)).size === value.length;
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
  // Trading can grant baked goods before the player learns their recipe.
  // Only actual workshop knowledge requires the fair; possession does not.
  if (workshopPatterns.length > 0 && !fairComplete) return undefined;
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
  const unlocked = fairComplete && fairGuestsServed >= villageGuestTarget;
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
      || config.picnic!==undefined&&config.picnic!=='bright'||config.tasting!==undefined&&config.tasting!==true||config.tasting===true&&!config.scouted
      || config.capacity !== (config.scouted ? 3 : 2)+Number(config.picnic==='bright')
      || config.resilience !== (config.scouted ? 4 : 2)+Number(config.tasting===true) && !(config.tasting===undefined&&config.resilience===(config.scouted ? 2 : 1))
      || config.habitat!==undefined&&(!isCoveFishingHabitat(config.habitat)||pending.island!=='grove')
      || config.scouted && (restoredVillage.serviceOn.finn === 0 || !restoredVillage.built)) return undefined;
    pendingFishingTrip = { token: pending.token, day, island: pending.island,
      config: { depth: 120, capacity:(config.scouted ? 3 : 2)+Number(config.picnic==='bright'),resilience:(config.scouted ? 4 : 2)+Number(config.tasting===true),scouted: config.scouted,...(config.picnic==='bright'?{picnic:'bright' as const}:{}),...(config.tasting===true?{tasting:true}:{}),...(config.habitat?{habitat:copyCoveFishingHabitat(config.habitat as CoveFishingHabitat)}:{}) } };
  }
  return { fairGuestsServed, handmade: { ...handmade }, workshopPatterns: [...workshopPatterns],
    village: restoredVillage, fishingTripSerial, pendingFishingTrip };
}

export function restoreFarm(value: unknown): FarmState | undefined {
  if (!isRecord(value) || value.version !== 1) return undefined;
  // Only the absence of both fields is a legacy save. Partial loss must not erase stored trees.
  if (Object.hasOwn(value, 'treeNursery') !== Object.hasOwn(value, 'treeNurserySerial')) return undefined;
  const restored = createFarm();
  const { day, coins, water, selectedSeed, beds, seeds:savedSeeds, produce:savedProduce, feed, eggs, eggsReady, chickensFed, progress } = value;
  const seeds=isRecord(savedSeeds)?{strawberry:0,blueberry:0,raspberry:0,...savedSeeds}:savedSeeds;
  const produce=isRecord(savedProduce)?{strawberry:0,blueberry:0,raspberry:0,...savedProduce}:savedProduce;
  const {
    canUpgraded = restored.canUpgraded,
    workToday = restored.workToday,
    island = restored.island,
    boatOwned = restored.boatOwned,
    trees = restored.trees,
    treeNursery = restored.treeNursery,
    treeNurserySerial = restored.treeNurserySerial,
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
    henPositions = restored.henPositions,
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
  const bayShop = restoreBayShop(value.bayShop, day);
  if (!bayShop) return undefined;
  let freight: BayFreightState;
  try { freight = restoreFreight(value.freight, day); } catch { return undefined; }
  const musicGarden = normalizeBayMusicState(value.musicGarden);
  const concertDay = isQuantity(value.concertDay) && value.concertDay <= day ? value.concertDay : 0;
  const culinary=restoreCulinary(value.culinary,day),shoreline=restoreShoreline(value.shoreline,day);
  if(!culinary||!shoreline)return undefined;
  const orders = restoreOrderLedger(savedOrders, day, restored.orders);
  const projects = restoreProjectLedger(savedProjects);
  const livingBay = projects && restoreLivingBay(value, day, isProjectComplete({ projects }, 'fair'), restored);
  if (!livingBay) return undefined;
  const festivals=restoreBayFestival(value.festivals,day,livingBay.village.built&&livingBay.village.meals>=1);
  if(!festivals)return undefined;
  const intentOrders=restoreIntentOrders(value.intentOrders,day),neighbors=restoreNeighborState(value.neighbors,day,livingBay.village.residents);
  if(!intentOrders||!neighbors)return undefined;
  const variants = restoreCollection(savedVariants, traitIds, (entry): entry is number => isQuantity(entry) && entry > 0);
  const discoveries = restoreCollection(savedDiscoveries, discoveryIds, (entry): entry is true => entry === true);
  if (!orders || !projects || !variants || !discoveries || !isRecord(savedDishes)) return undefined;
  const dishes = { strawberryTart: 0, blueberryTart: 0, raspberryTart: 0, appleJam: 0, farmhouseBread: 0, orchardPreserves: 0, honeyCake: 0, honeyBiscuits: 0, honeyPear: 0, windParfait: 0, ...savedDishes };
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
  const capeUnlocked = canSailTo({ boatOwned, orders, projects }, 'cape');
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
  if (!isQuantity(treeNurserySerial) || !isTreeNursery(treeNursery, treeNurserySerial)) return undefined;
  if (!isOrchardMap(trees) || !isInventory(treeIds, saplings) || !isInventory(treeIds, fruit)) return undefined;
  if (!isInventory(fishIds, fish) || !isInventory(orchardIslandIds, fishCaughtToday)
    || orchardIslandIds.some((id) => fishCaughtToday[id] > getFishLimit({ island, projects }, id))) return undefined;
  if (!isQuantity(seaSalt) || typeof saltGatheredToday !== 'boolean' || !isInventory(dishIds, dishes)) return undefined;
  const isShoalFind = (id: unknown): id is ShoalFindId => isId(shoalFindIds, id);
  if (!isInventory(shellIds, shells) || !isUniqueList(shellDiscoveries, (id): id is ShellId => isId(shellIds, id))
    || !isUniqueList(shellsCollectedToday, isShellSpot) || !isInventory(shoalFindIds, shoalFinds)
    || !isUniqueList(shoalDiscoveries, isShoalFind) || !isUniqueList(shoalCollectedToday, isShoalFind)) return undefined;
  const knownShells = shellIds.filter((id) => shellDiscoveries.includes(id) || shells[id] > 0);
  if((shoreline.settled!==null||shoreline.pending!==null||shoreline.observations.length>0)&&(!boatOwned||knownShells.length===0))return undefined;
  const habitat=livingBay.pendingFishingTrip?.config.habitat;
  if(habitat&&(!shoreline.settled||habitat.revision!==shoreline.revision||!sameCove(habitat,shoreline.settled)))return undefined;
  if (!hasShoal({ shellDiscoveries: knownShells }) && (shoalCollectedToday.length || shoalDiscoveries.length
    || shoalFindIds.some((id) => shoalFinds[id] > 0))) return undefined;
  if (shoalCollectedToday.some((id) => !getShoalFindAt({ day, shellDiscoveries: knownShells, shoalCollectedToday: [] }, id))) return undefined;
  if (specializationIds.some((id) => id !== farmhouseSpecialization && dishes[specializationDefinitions[id].dish] > 0)) return undefined;
  if (!isQuantity(chickenHappiness) || chickenHappiness > maxChickenHappiness) return undefined;
  if (!Array.isArray(pettedChickens) || !Array.from(pettedChickens).every((id) => isChickenId(id, flockSize))
    || new Set(pettedChickens).size !== pettedChickens.length) return undefined;
  if (!Array.isArray(henPositions) || henPositions.length !== maxFlockSize
    || !Array.from(henPositions).every((point, index) => point === null || (index < flockSize && isRecord(point)
      && typeof point.x === 'number' && Number.isFinite(point.x)
      && typeof point.y === 'number' && Number.isFinite(point.y)))) return undefined;
  const safeHenPositions = henPositions.map(point => point === null ? null : projectHenToGround(point, buildingLevels));
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
  const result: FarmState = {
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
    treeNursery: treeNursery.map(({ id, tree }) => ({ id, tree: { ...tree } })),
    treeNurserySerial,
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
    henPositions: safeHenPositions,
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
    culinary,shoreline,intentOrders,neighbors,freight,bayShop,musicGarden,concertDay,festivals,
  };
  syncFestivalRewards(result);
  syncFarmShopPrices(result);
  return result;
}
