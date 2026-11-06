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
export const boatPrice = 52;
export const seaSaltPrice = 4;
export const treeSlotCount = 3;
export const chickenCount = 4;
export const maxChickenHappiness = 5;
export const fishDailyLimit = 3;

export const islandIds = ['home', 'grove'] as const;
export type IslandId = typeof islandIds[number];

export const treeIds = ['apple', 'pear', 'peach'] as const;
export type TreeId = typeof treeIds[number];
export type TreeSlot = { tree: TreeId; age: number; fruitReady: number };
export const treeDefinitions: Record<TreeId, { name: string; days: number; saplingPrice: number; sellPrice: number }> = {
  apple: { name: 'Apple', days: 2, saplingPrice: 9, sellPrice: 4 },
  pear: { name: 'Pear', days: 3, saplingPrice: 11, sellPrice: 6 },
  peach: { name: 'Peach', days: 3, saplingPrice: 13, sellPrice: 7 },
};

export const fishIds = ['perch', 'seaBass'] as const;
export type FishId = typeof fishIds[number];
export const fishDefinitions: Record<FishId, { name: string; sellPrice: number }> = {
  perch: { name: 'Perch', sellPrice: 5 },
  seaBass: { name: 'Sea bass', sellPrice: 10 },
};
const islandFish: Record<IslandId, FishId> = { home: 'perch', grove: 'seaBass' };

export const buildingIds = ['farmhouse', 'coop', 'well'] as const;
export type BuildingId = typeof buildingIds[number];
type BuildingLevel = 1 | 2;
export const buildingDefinitions: Record<BuildingId, { name: string; upgradePrice: number; benefit: string }> = {
  farmhouse: { name: 'Farmhouse', upgradePrice: 24, benefit: 'Unlocks grilled fish in the kitchen.' },
  coop: { name: 'Chicken coop', upgradePrice: 22, benefit: 'Fed hens lay one extra egg, and the nest holds nine.' },
  well: { name: 'Well', upgradePrice: 18, benefit: 'The upgraded well fills your can with two extra servings.' },
};

export const dishIds = ['orchardTart', 'grilledFish'] as const;
export type DishId = typeof dishIds[number];
type Ingredient = (
  | { kind: 'produce'; item: CropId }
  | { kind: 'fruit'; item: TreeId }
  | { kind: 'fish'; item: FishId }
  | { kind: 'eggs' | 'seaSalt' }
) & { quantity: number };

type DishDefinition = {
  name: string;
  sellPrice: number;
  requiredLevel: BuildingLevel;
  ingredientLabel: string;
  ingredients: readonly Ingredient[];
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
};

const bedCount = 16;
const nestCapacity = 6;
const fruitPerHarvest = 2;

export type Bed =
  | { kind: 'empty' }
  | { kind: 'tilled' }
  | { kind: 'crop'; crop: CropId; growth: number; watered: boolean; wateredAt?: number };

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
  eggsReady: number;
  chickensFed: boolean;
  island: IslandId;
  boatOwned: boolean;
  trees: Record<IslandId, (TreeSlot | null)[]>;
  saplings: Record<TreeId, number>;
  fruit: Record<TreeId, number>;
  fish: Record<FishId, number>;
  fishCaughtToday: Record<IslandId, number>;
  seaSalt: number;
  saltGatheredToday: boolean;
  dishes: Record<DishId, number>;
  buildingLevels: Record<BuildingId, BuildingLevel>;
  chickenHappiness: number;
  pettedChickens: number[];
  progress: Record<GoalId, number>;
};

export type ActionResult = { ok: boolean; message: string };

function cropBed(crop: CropId, growth: number): Bed {
  return { kind: 'crop', crop, growth, watered: false };
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
    eggsReady: 1,
    chickensFed: false,
    island: 'home',
    boatOwned: false,
    trees: {
      home: [{ tree: 'apple', age: treeDefinitions.apple.days, fruitReady: fruitPerHarvest }, null, null],
      grove: [{ tree: 'pear', age: treeDefinitions.pear.days, fruitReady: fruitPerHarvest }, null, null],
    },
    saplings: { apple: 1, pear: 0, peach: 0 },
    fruit: { apple: 0, pear: 0, peach: 0 },
    fish: { perch: 0, seaBass: 0 },
    fishCaughtToday: { home: 0, grove: 0 },
    seaSalt: 0,
    saltGatheredToday: false,
    dishes: { orchardTart: 0, grilledFish: 0 },
    buildingLevels: { farmhouse: 1, coop: 1, well: 1 },
    chickenHappiness: 0,
    pettedChickens: [],
    progress: { till: 0, plant: 0, water: 0, rest: 0, harvest: 0, sell: 0, feed: 0, collect: 0 },
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

export function getWaterCapacity(farm: Pick<FarmState, 'canUpgraded'> & Partial<Pick<FarmState, 'buildingLevels'>>): number {
  const capacity = farm.canUpgraded ? expandedWaterCapacity : waterCapacity;
  return capacity + (farm.buildingLevels?.well === 2 ? 2 : 0);
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
    farm.beds[index] = cropBed(crop, 0);
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
  farm.produce[bed.crop] += crop.yield;
  farm.beds[index] = { kind: 'tilled' };
  return record(farm, 'harvest', `${crop.name} harvest added ${crop.yield} to your basket.`);
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
  farm.eggs += eggs;
  farm.eggsReady = 0;
  return record(farm, 'collect', eggs === 1 ? 'Collected a fresh egg.' : `Collected ${eggs} fresh eggs.`);
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

export function getFishAction(farm: FarmState): { available: boolean; label: string } {
  if (farm.fishCaughtToday[farm.island] >= fishDailyLimit) {
    return { available: false, label: 'This spot needs a rest. Come back tomorrow.' };
  }
  return { available: true, label: 'Cast your line' };
}

export function catchFish(farm: FarmState, hit: boolean): ActionResult {
  const action = getFishAction(farm);
  if (!action.available) return failure(action.label);
  if (!hit) return failure('The fish slipped away. Try another cast.');
  const fish = islandFish[farm.island];
  farm.fish[fish] += 1;
  farm.fishCaughtToday[farm.island] += 1;
  farm.workToday += 1;
  return { ok: true, message: `Caught a ${fishDefinitions[fish].name.toLowerCase()}.` };
}

export function getTreeAction(farm: FarmState, slot: number): { kind: 'pick' | 'plant' | 'wait'; available: boolean; label: string } {
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
  const action = getTreeAction(farm, slot);
  if (action.kind !== 'pick' || !action.available) return failure(action.label);
  const tree = farm.trees[farm.island][slot];
  if (!tree) return failure('Choose a fruit tree.');
  const quantity = tree.fruitReady;
  farm.fruit[tree.tree] += quantity;
  tree.fruitReady = 0;
  farm.workToday += 1;
  return { ok: true, message: `Picked ${quantity} ${treeDefinitions[tree.tree].name.toLowerCase()} fruit.` };
}

export function plantTree(farm: FarmState, slot: number, tree: TreeId): ActionResult {
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
  farm.island = island;
  return { ok: true, message: island === 'home' ? 'Welcome back to the farm.' : 'You reached Saltwind Grove.' };
}

export function gatherSeaSalt(farm: FarmState): ActionResult {
  if (farm.island !== 'grove') return failure('Sea salt gathers in the Saltwind Grove tidal pools.');
  if (farm.saltGatheredToday) return failure('More sea salt will gather overnight.');
  farm.saltGatheredToday = true;
  farm.seaSalt += 2;
  farm.workToday += 1;
  return { ok: true, message: 'Gathered 2 sea salt from the tidal pool.' };
}

export function upgradeBuilding(farm: FarmState, building: BuildingId): ActionResult {
  if (!isId(buildingIds, building) || farm.island !== 'home') return failure('Choose a building on your farm.');
  const definition = buildingDefinitions[building];
  if (farm.buildingLevels[building] === 2) return failure(`${definition.name} is already upgraded.`);
  if (farm.coins < definition.upgradePrice) return failure('You need more coins for this upgrade.');
  farm.coins -= definition.upgradePrice;
  farm.buildingLevels[building] = 2;
  if (building === 'well') farm.water = getWaterCapacity(farm);
  return { ok: true, message: `${definition.name} upgraded. ${definition.benefit}` };
}

export function getCookAction(farm: FarmState, dish: DishId): { available: boolean; label: string } {
  if (!isId(dishIds, dish)) return { available: false, label: 'Choose a recipe.' };
  if (farm.island !== 'home') return { available: false, label: 'Cook in the farmhouse kitchen.' };
  const definition = dishDefinitions[dish];
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
  for (const ingredient of definition.ingredients) {
    switch (ingredient.kind) {
      case 'produce': farm.produce[ingredient.item] -= ingredient.quantity; break;
      case 'fruit': farm.fruit[ingredient.item] -= ingredient.quantity; break;
      case 'fish': farm.fish[ingredient.item] -= ingredient.quantity; break;
      case 'eggs': farm.eggs -= ingredient.quantity; break;
      case 'seaSalt': farm.seaSalt -= ingredient.quantity; break;
    }
  }
  farm.dishes[dish] += 1;
  farm.workToday += 1;
  return { ok: true, message: `Cooked ${definition.name.toLowerCase()}.` };
}

function ingredientCount(farm: FarmState, ingredient: Ingredient): number {
  if (ingredient.kind === 'produce') return farm.produce[ingredient.item];
  if (ingredient.kind === 'fruit') return farm.fruit[ingredient.item];
  if (ingredient.kind === 'fish') return farm.fish[ingredient.item];
  return farm[ingredient.kind];
}

export function petChicken(farm: FarmState, id: number): ActionResult {
  if (farm.island !== 'home' || !isChickenId(id)) return failure('Choose one of your hens.');
  if (farm.pettedChickens.includes(id)) return failure('This hen has had her cuddle today.');
  farm.pettedChickens.push(id);
  farm.chickenHappiness = Math.min(maxChickenHappiness, farm.chickenHappiness + 1);
  return { ok: true, message: 'Your hen clucks happily.' };
}

export function getSale(farm: FarmState): { items: number; coins: number } {
  let items = farm.eggs + farm.seaSalt;
  let coins = farm.eggs * eggPrice + farm.seaSalt * seaSaltPrice;
  for (const crop of cropIds) {
    items += farm.produce[crop];
    coins += farm.produce[crop] * cropDefinitions[crop].sellPrice;
  }
  for (const tree of treeIds) {
    items += farm.fruit[tree];
    coins += farm.fruit[tree] * treeDefinitions[tree].sellPrice;
  }
  for (const fish of fishIds) {
    items += farm.fish[fish];
    coins += farm.fish[fish] * fishDefinitions[fish].sellPrice;
  }
  for (const dish of dishIds) {
    items += farm.dishes[dish];
    coins += farm.dishes[dish] * dishDefinitions[dish].sellPrice;
  }
  return { items, coins };
}

export function sellProduce(farm: FarmState): ActionResult {
  const { items, coins } = getSale(farm);
  if (items === 0) return failure('Bring something from your farm or the islands to sell.');
  farm.coins += coins;
  farm.produce = emptyProduce();
  farm.eggs = 0;
  for (const tree of treeIds) farm.fruit[tree] = 0;
  for (const fish of fishIds) farm.fish[fish] = 0;
  for (const dish of dishIds) farm.dishes[dish] = 0;
  farm.seaSalt = 0;
  return record(farm, 'sell', `Sold ${items} ${items === 1 ? 'item' : 'items'} for ${coins} coins.`);
}

export function endDay(farm: FarmState): ActionResult {
  if (farm.island !== 'home') return failure('Sail home to rest at the farmhouse.');
  let cropsGrew = false;
  for (const bed of farm.beds) {
    if (bed.kind !== 'crop' || !bed.watered) continue;
    bed.growth += 1;
    bed.watered = false;
    delete bed.wateredAt;
    cropsGrew = true;
  }
  for (const island of islandIds) {
    farm.fishCaughtToday[island] = 0;
    for (const tree of farm.trees[island]) {
      if (!tree) continue;
      const maturity = treeDefinitions[tree.tree].days;
      tree.age = Math.min(maturity, tree.age + 1);
      if (tree.age === maturity) tree.fruitReady = fruitPerHarvest;
    }
  }
  if (farm.chickensFed) {
    const upgraded = farm.buildingLevels.coop === 2;
    const eggsLaid = 3 + Number(upgraded) + Math.floor(farm.chickenHappiness / 2);
    farm.eggsReady = Math.min(upgraded ? nestCapacity + 3 : nestCapacity, farm.eggsReady + eggsLaid);
  }
  farm.chickenHappiness = Math.max(0, farm.chickenHappiness - 1);
  farm.pettedChickens = [];
  farm.saltGatheredToday = false;
  farm.chickensFed = false;
  farm.day += 1;
  farm.workToday = 0;
  const message = `Day ${farm.day} begins.`;
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
  return { ok: true, message: `${message} Goal reward earned (+${completed.reward} coins).` };
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

function isChickenId(value: unknown): value is number {
  return isQuantity(value) && value < chickenCount;
}

function isBed(value: unknown): value is Bed {
  if (!isRecord(value)) return false;
  if (value.kind === 'empty' || value.kind === 'tilled') return true;
  if (value.kind !== 'crop' || !isCropId(value.crop) || !isQuantity(value.growth) || typeof value.watered !== 'boolean') return false;
  if (value.wateredAt !== undefined && (!value.watered || !isQuantity(value.wateredAt))) return false;
  const ripeAt = cropDefinitions[value.crop].days;
  return value.watered ? value.growth < ripeAt : value.growth <= ripeAt;
}

function isInventory<Id extends string>(ids: readonly Id[], value: unknown): value is Record<Id, number> {
  return isRecord(value) && ids.every((id) => isQuantity(value[id]));
}

function isTreeSlot(value: unknown): value is TreeSlot | null {
  if (value === null) return true;
  if (!isRecord(value) || !isId(treeIds, value.tree) || !isQuantity(value.age) || !isQuantity(value.fruitReady)) return false;
  const maturity = treeDefinitions[value.tree].days;
  return value.age <= maturity && value.fruitReady <= (value.age === maturity ? fruitPerHarvest : 0);
}

function isOrchard(value: unknown): value is (TreeSlot | null)[] {
  return Array.isArray(value) && value.length === treeSlotCount && Array.from(value).every(isTreeSlot);
}

function isOrchardMap(value: unknown): value is FarmState['trees'] {
  return isRecord(value) && islandIds.every((island) => isOrchard(value[island]));
}

function isBuildingLevels(value: unknown): value is FarmState['buildingLevels'] {
  return isRecord(value) && buildingIds.every((id) => value[id] === 1 || value[id] === 2);
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
    fish = restored.fish,
    fishCaughtToday = restored.fishCaughtToday,
    seaSalt = restored.seaSalt,
    saltGatheredToday = restored.saltGatheredToday,
    dishes = restored.dishes,
    buildingLevels = restored.buildingLevels,
    chickenHappiness = restored.chickenHappiness,
    pettedChickens = restored.pettedChickens,
  } = value;
  if (!isQuantity(day) || day === 0 || !isQuantity(coins)) return undefined;
  if (typeof canUpgraded !== 'boolean' || !isQuantity(workToday) || !isBuildingLevels(buildingLevels)) return undefined;
  if (!isQuantity(water) || water > getWaterCapacity({ canUpgraded, buildingLevels }) || !isCropId(selectedSeed)) return undefined;
  if (!Array.isArray(beds) || beds.length !== bedCount || !Array.from(beds).every(isBed)) return undefined;
  if (!isInventory(cropIds, seeds) || !isInventory(cropIds, produce)) return undefined;
  if (!isQuantity(feed) || !isQuantity(eggs) || !isQuantity(eggsReady) || eggsReady > (buildingLevels.coop === 2 ? nestCapacity + 3 : nestCapacity)) return undefined;
  if (typeof chickensFed !== 'boolean' || !isRecord(progress)) return undefined;
  if (!isId(islandIds, island) || typeof boatOwned !== 'boolean' || (!boatOwned && island !== 'home')) return undefined;
  if (!isOrchardMap(trees) || !isInventory(treeIds, saplings) || !isInventory(treeIds, fruit)) return undefined;
  if (!isInventory(fishIds, fish) || !isInventory(islandIds, fishCaughtToday) || islandIds.some((id) => fishCaughtToday[id] > fishDailyLimit)) return undefined;
  if (!isQuantity(seaSalt) || typeof saltGatheredToday !== 'boolean' || !isInventory(dishIds, dishes)) return undefined;
  if (!isQuantity(chickenHappiness) || chickenHappiness > maxChickenHappiness) return undefined;
  if (!Array.isArray(pettedChickens) || !Array.from(pettedChickens).every(isChickenId) || new Set(pettedChickens).size !== pettedChickens.length) return undefined;
  for (const { id } of goals) {
    const count = progress[id];
    if (!isQuantity(count)) return undefined;
    restored.progress[id] = count;
  }
  return {
    version: 1,
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
    eggsReady,
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
    seaSalt,
    saltGatheredToday,
    dishes: { ...dishes },
    buildingLevels: { ...buildingLevels },
    chickenHappiness,
    pettedChickens: [...pettedChickens],
    progress: restored.progress,
  };
}
