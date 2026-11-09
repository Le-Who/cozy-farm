import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  boatPrice,
  buyBoat,
  buyFeed,
  buySapling,
  buySeeds,
  catchFish,
  collectEggs,
  cookDish,
  createFarm,
  deliverMarketOrder,
  endDay,
  feedChickens,
  gatherSeaSalt,
  getBedAction,
  getBedStage,
  getCookAction,
  getDayPhase,
  getFishAction,
  getGoal,
  getIrrigationRow,
  getMarketOrders,
  getSale,
  getTreeAction,
  getWaterCapacity,
  irrigateRow,
  packEggBasket,
  petChicken,
  pickFruit,
  plantTree,
  refillWater,
  restoreFarm,
  sail,
  selectSeed,
  sellProduce,
  sellMarketItem,
  upgradeCan,
  upgradeBuilding,
  workBed,
} from '../src/farm.ts';
import type { CookeryResult } from '../src/culinary.ts';

const grilledFishResult = (): CookeryResult => ({ family: 'grilledFish', fruit: [],
  steps: ['season-fish', 'grill-first-side', 'turn-fish', 'grill-second-side', 'plate-fish', 'arrange-carrot'],
  baking: { method: 'grill', finish: 'golden', seconds: 18 } });

test('discovery introductions persist per save and migrate established farms', () => {
  const fresh = createFarm();
  assert.deepEqual(fresh.orientation, { collections: false, islands: false });
  fresh.orientation.collections = true;
  assert.deepEqual(restoreFarm(JSON.parse(JSON.stringify(fresh)))?.orientation, fresh.orientation);
  const legacy = JSON.parse(JSON.stringify(fresh));
  delete legacy.orientation;
  assert.deepEqual(restoreFarm(legacy)?.orientation, { collections: false, islands: false });
  legacy.boatOwned = true;
  assert.deepEqual(restoreFarm(legacy)?.orientation, { collections: true, islands: true });
  legacy.orientation = { collections: 'true', islands: false };
  assert.equal(restoreFarm(legacy), undefined);
  legacy.orientation = null;
  assert.equal(restoreFarm(legacy), undefined);
});

test('a starter bed can be tilled, planted, watered, harvested and reused', () => {
  const farm = createFarm();
  const startCoins = farm.coins;
  const startSeeds = farm.seeds.carrot;
  const startWater = farm.water;
  assert.equal(getGoal(farm)?.id, 'till');
  assert.equal(getBedAction(farm, 0).kind, 'till');
  assert.equal(workBed(farm, 0).ok, true);
  assert.equal(getGoal(farm)?.id, 'plant');
  assert.ok(farm.coins > startCoins);
  assert.equal(getBedAction(farm, 0).kind, 'plant');
  assert.equal(workBed(farm, 0).ok, true);
  assert.equal(farm.seeds.carrot, startSeeds - 1);
  assert.equal(getBedStage(farm.beds[0]), 'seedling');
  assert.equal(workBed(farm, 0).ok, true);
  assert.equal(farm.water, startWater - 1);
  assert.equal(getBedAction(farm, 0).available, false);
  assert.equal(workBed(farm, 0).ok, false);
  assert.equal(farm.water, startWater - 1);
  assert.equal(endDay(farm).ok, true);
  assert.equal(farm.day, 2);
  assert.equal(getBedStage(farm.beds[0]), 'ripe');
  assert.equal(workBed(farm, 0).ok, true);
  assert.equal(farm.produce.carrot, 3);
  assert.equal(getBedAction(farm, 0).kind, 'plant');
});

test('dry nights pause growth and slower crops require several watered nights', () => {
  const farm = createFarm();
  assert.equal(selectSeed(farm, 'cabbage').ok, true);
  workBed(farm, 0);
  workBed(farm, 0);
  endDay(farm);
  assert.equal(getBedStage(farm.beds[0]), 'seedling');
  workBed(farm, 0);
  assert.equal(getGoal(farm)?.id, 'rest');
  endDay(farm);
  assert.equal(getGoal(farm)?.id, 'harvest');
  assert.equal(getBedStage(farm.beds[0]), 'growing');
  assert.equal(getBedAction(farm, 0).kind, 'water');
  workBed(farm, 0);
  endDay(farm);
  assert.equal(getBedStage(farm.beds[0]), 'ripe');
});

test('the well replenishes water and a dry can cannot water a crop', () => {
  const farm = createFarm();
  workBed(farm, 0);
  workBed(farm, 0);
  let watered = 0;
  for (let index = 0; index < farm.beds.length; index += 1) {
    if (getBedAction(farm, index).kind !== 'water') continue;
    if (!workBed(farm, index).ok) break;
    watered += 1;
  }
  assert.equal(watered, 6);
  assert.equal(farm.water, 0);
  const dryBed = farm.beds.findIndex((_, index) => getBedAction(farm, index).kind === 'water');
  assert.ok(dryBed >= 0);
  assert.equal(getBedAction(farm, dryBed).available, false);
  assert.equal(workBed(farm, dryBed).ok, false);
  assert.equal(refillWater(farm).ok, true);
  assert.equal(farm.water, 6);
  assert.equal(workBed(farm, dryBed).ok, true);
});

test('the larger can is a one-time purchase and the well fills it to its new capacity', () => {
  const farm = createFarm();
  assert.equal(upgradeCan(farm).ok, false);
  farm.coins = 40;
  assert.equal(upgradeCan(farm).ok, true);
  assert.equal(upgradeCan(farm).ok, false);
  assert.equal(farm.coins, 5);
  assert.equal(getWaterCapacity(farm), 10);
  assert.equal(workBed(farm, 1).ok, true);
  assert.equal(farm.water, 9);
  assert.equal(refillWater(farm).ok, true);
  assert.equal(restoreFarm(JSON.parse(JSON.stringify(farm)))?.water, 10);
});

test('successful work advances the daylight and resting returns it to morning', () => {
  const farm = createFarm();
  assert.equal(getDayPhase(farm), 'Morning');
  for (const index of [0, 0, 0, 1, 2]) assert.equal(workBed(farm, index).ok, true);
  assert.equal(getDayPhase(farm), 'Afternoon');
  for (const index of [3, 4, 5, 6, 7]) assert.equal(workBed(farm, index).ok, true);
  assert.equal(getDayPhase(farm), 'Evening');
  endDay(farm);
  assert.equal(getDayPhase(farm), 'Morning');
});

test('the coop uses one feed per day and offers eggs for the market', () => {
  const farm = createFarm();
  const startFeed = farm.feed;
  assert.equal(collectEggs(farm).ok, true);
  assert.equal(farm.eggs, 1);
  assert.equal(collectEggs(farm).ok, false);
  assert.equal(feedChickens(farm).ok, true);
  assert.equal(feedChickens(farm).ok, false);
  assert.equal(farm.feed, startFeed - 1);
  endDay(farm);
  assert.equal(farm.chickensFed, false);
  assert.equal(farm.eggsReady, 3);
  assert.equal(collectEggs(farm).ok, true);
  assert.equal(farm.eggs, 4);
  assert.deepEqual(getSale(farm), { items: 4, coins: 12 });
  const beforeSale = farm.coins;
  const saleReward = 8;
  assert.equal(sellProduce(farm).ok, true);
  assert.equal(farm.coins, beforeSale + 12 + saleReward);
  assert.equal(sellProduce(farm).ok, false);
  assert.equal(farm.eggs, 0);
});

test('market purchases debit the listed price and failed purchases keep balances', () => {
  const farm = createFarm();
  const before = farm.coins;
  const seeds = farm.seeds.carrot;
  const feed = farm.feed;
  assert.equal(buySeeds(farm, 'carrot').ok, true);
  assert.equal(farm.seeds.carrot, seeds + 3);
  assert.equal(farm.coins, before - 4);
  assert.equal(buyFeed(farm).ok, true);
  assert.equal(farm.feed, feed + 2);
  assert.equal(farm.coins, before - 8);
  assert.equal(buySeeds(farm, 'pumpkin').ok, true);
  const remaining = farm.coins;
  const pumpkinSeeds = farm.seeds.pumpkin;
  assert.equal(buySeeds(farm, 'pumpkin').ok, false);
  assert.equal(farm.coins, remaining);
  assert.equal(farm.seeds.pumpkin, pumpkinSeeds);
});

test('a saved wet bed retains its growth across a reload and invalid saves are rejected', () => {
  const farm = createFarm();
  workBed(farm, 0);
  workBed(farm, 0);
  workBed(farm, 0, 12345);
  const restored = restoreFarm(JSON.parse(JSON.stringify(farm)));
  assert.ok(restored);
  assert.deepEqual(restored, farm);
  assert.ok(restored.beds[0].kind === 'crop');
  assert.equal(restored.beds[0].wateredAt, 12345);
  assert.equal(getBedAction(restored, 0).available, false);
  endDay(restored);
  assert.equal(getBedStage(restored.beds[0]), 'ripe');
  assert.equal(restored.beds[0].wateredAt, undefined);
  assert.equal(getBedStage(farm.beds[0]), 'seedling');
  assert.equal(restoreFarm(null), undefined);
  assert.equal(restoreFarm({ ...farm, version: 2 }), undefined);
  assert.equal(restoreFarm({ ...farm, beds: [] }), undefined);
  assert.equal(restoreFarm({ ...farm, seeds: { ...farm.seeds, carrot: -1 } }), undefined);
});

test('fishing limits reset at dawn and sailing opens a distinct catch and tidal resource', () => {
  const farm = createFarm();
  assert.equal(sail(farm, 'grove').ok, false);
  assert.equal(buyBoat(farm).ok, false);
  assert.equal(gatherSeaSalt(farm).ok, false);
  assert.equal(catchFish(farm, false).ok, false);
  for (let cast = 0; cast < 3; cast++) assert.equal(catchFish(farm, true).ok, true);
  assert.equal(farm.fish.perch, 3);
  assert.equal(getFishAction(farm).available, false);
  assert.equal(catchFish(farm, true).ok, false);

  for (const bed of [2, 3, 4, 5, 7]) assert.equal(workBed(farm, bed).ok, true);
  assert.equal(sellProduce(farm).ok, true);
  const beforeBoat = farm.coins;
  assert.equal(buyBoat(farm).ok, true);
  assert.equal(buyBoat(farm).ok, false);
  assert.equal(farm.coins, beforeBoat - boatPrice);
  assert.equal(sail(farm, 'grove').ok, true);
  assert.equal(catchFish(farm, true).ok, true);
  assert.equal(farm.fish.seaBass, 1);
  assert.equal(gatherSeaSalt(farm).ok, true);
  assert.equal(farm.seaSalt, 2);
  assert.equal(gatherSeaSalt(farm).ok, false);
  assert.equal(endDay(farm).ok, false);

  const restored = restoreFarm(JSON.parse(JSON.stringify(farm)));
  assert.deepEqual(restored, farm);
  assert.ok(restored);
  assert.equal(sail(restored, 'home').ok, true);
  assert.equal(getFishAction(restored).available, false);
  assert.equal(endDay(restored).ok, true);
  assert.equal(getFishAction(restored).available, true);
  assert.equal(sail(restored, 'grove').ok, true);
  assert.equal(gatherSeaSalt(restored).ok, true);
});

test('different saplings grow in open orchard spots and fruit comes back after picking', () => {
  const farm = createFarm();
  assert.equal(getTreeAction(farm, 0).kind, 'pick');
  assert.equal(pickFruit(farm, 0).ok, true);
  assert.equal(pickFruit(farm, 0).ok, false);
  assert.equal(farm.fruit.apple, 2);
  assert.equal(plantTree(farm, 0, 'apple').ok, false);
  assert.equal(farm.saplings.apple, 1);
  assert.equal(plantTree(farm, 1, 'apple').ok, true);
  assert.equal(buySapling(farm, 'peach').ok, true);
  assert.equal(plantTree(farm, 2, 'peach').ok, true);
  endDay(farm);
  assert.equal(pickFruit(farm, 0).ok, true);
  assert.equal(pickFruit(farm, 1).ok, false);
  endDay(farm);
  assert.equal(pickFruit(farm, 1).ok, true);
  assert.equal(pickFruit(farm, 2).ok, false);
  endDay(farm);
  assert.equal(pickFruit(farm, 2).ok, true);
  assert.equal(farm.fruit.peach, 2);
});

test('the kitchen turns ingredients into premium goods and upgrades unlock the island recipe', () => {
  const farm = createFarm();
  assert.equal(pickFruit(farm, 0).ok, true);
  assert.equal(workBed(farm, 4).ok, true);
  const beforeMissingEgg = getSale(farm);
  assert.equal(cookDish(farm, 'orchardTart').ok, false);
  assert.deepEqual(getSale(farm), beforeMissingEgg);
  assert.equal(collectEggs(farm).ok, true);
  const rawValue = getSale(farm).coins;
  assert.equal(cookDish(farm, 'orchardTart').ok, true);
  assert.equal(farm.dishes.orchardTart, 1);
  assert.equal(farm.fruit.apple, 0);
  assert.equal(farm.produce.wheat, 2);
  assert.equal(farm.eggs, 0);
  assert.ok(getSale(farm).coins > rawValue);

  assert.equal(getCookAction(farm, 'grilledFish').available, false);
  for (const bed of [2, 3, 5, 7]) assert.equal(workBed(farm, bed).ok, true);
  assert.equal(sellProduce(farm).ok, true);
  assert.equal(farm.dishes.orchardTart, 0);
  assert.equal(upgradeBuilding(farm, 'farmhouse').ok, true);
  assert.equal(upgradeBuilding(farm, 'farmhouse').ok, false);
  assert.equal(buyBoat(farm).ok, true);
  assert.equal(sail(farm, 'grove').ok, true);
  assert.equal(catchFish(farm, true).ok, true);
  assert.equal(gatherSeaSalt(farm).ok, true);
  assert.equal(sail(farm, 'home').ok, true);
  assert.equal(workBed(farm, 9).ok, true);
  assert.equal(cookDish(farm, 'grilledFish', grilledFishResult()).ok, true);
  assert.equal(farm.fish.seaBass, 0);
  assert.equal(farm.seaSalt, 1);
  assert.equal(farm.produce.carrot, 2);
  assert.equal(farm.dishes.grilledFish, 1);
});

test('petting different hens raises happiness and upgraded buildings improve water and eggs', () => {
  const farm = createFarm();
  assert.equal(petChicken(farm, -1).ok, false);
  assert.equal(petChicken(farm, 0).ok, true);
  assert.equal(petChicken(farm, 0).ok, false);
  assert.equal(petChicken(farm, 1).ok, true);
  assert.equal(farm.chickenHappiness, 2);
  for (const bed of [2, 3, 4, 5, 7]) assert.equal(workBed(farm, bed).ok, true);
  assert.equal(sellProduce(farm).ok, true);
  assert.equal(upgradeBuilding(farm, 'well').ok, true);
  assert.equal(getWaterCapacity(farm), 8);
  assert.equal(farm.water, 8);
  assert.equal(upgradeCan(farm).ok, true);
  assert.equal(getWaterCapacity(farm), 12);
  assert.equal(upgradeBuilding(farm, 'coop').ok, true);
  assert.equal(collectEggs(farm).ok, true);
  assert.equal(feedChickens(farm).ok, true);
  assert.equal(endDay(farm).ok, true);
  assert.equal(farm.eggsReady, 5);
  assert.equal(farm.chickenHappiness, 1);
  assert.equal(petChicken(farm, 0).ok, true);
});

test('older farm saves gain the expansion without losing farming progress', () => {
  const farm = createFarm();
  workBed(farm, 0);
  workBed(farm, 0);
  workBed(farm, 0);
  const legacy = JSON.parse(JSON.stringify(farm));
  for (const key of [
    'island', 'boatOwned', 'trees', 'saplings', 'fruit', 'fish', 'fishCaughtToday', 'seaSalt', 'saltGatheredToday',
    'dishes', 'buildingLevels', 'chickenHappiness', 'pettedChickens',
  ]) delete legacy[key];
  delete legacy.beds[0].wateredAt;
  const restored = restoreFarm(legacy);
  assert.ok(restored);
  assert.equal(restored.coins, farm.coins);
  assert.deepEqual(restored.progress, farm.progress);
  assert.equal(restored.island, 'home');
  assert.equal(restored.boatOwned, false);
  assert.equal(pickFruit(restored, 0).ok, true);
  assert.equal(endDay(restored).ok, true);
  assert.equal(getBedStage(restored.beds[0]), 'ripe');
  assert.equal(restoreFarm({ ...restored, island: 'grove', boatOwned: false }), undefined);
});

test('market deliveries keep unfinished orders across nights and pay exactly once', () => {
  const farm = createFarm();
  const order = () => getMarketOrders(farm).find(({ lane }) => lane === 'garden')!;
  assert.equal(order().name, 'Огородная корзина');
  assert.equal(deliverMarketOrder(farm, 'garden').ok, false);
  endDay(farm);
  assert.equal(order().name, 'Огородная корзина');

  workBed(farm, 2);
  workBed(farm, 3);
  assert.equal(sellMarketItem(farm, 'produce:tomato').ok, true);
  assert.equal(farm.produce.tomato, 2);
  assert.equal(farm.produce.cabbage, 2);
  assert.equal(order().status, 'ready');

  const coins = farm.coins;
  const reward = order().reward;
  assert.equal(deliverMarketOrder(farm, 'garden').ok, true);
  assert.equal(farm.coins, coins + reward);
  assert.equal(farm.produce.tomato, 1);
  assert.equal(farm.produce.cabbage, 0);
  assert.equal(order().status, 'delivered');
  const saved = restoreFarm(JSON.parse(JSON.stringify(farm)))!;
  const beforeRepeat = structuredClone(saved);
  assert.equal(deliverMarketOrder(saved, 'garden').ok, false);
  assert.deepEqual(saved, beforeRepeat);
  endDay(saved);
  assert.equal(getMarketOrders(saved).find(({ lane }) => lane === 'garden')?.name, 'Ящик корнеплодов');
});

test('Grove orders use island goods and unlock the final meal after the kitchen upgrade', () => {
  const farm = createFarm();
  farm.coins = 200;
  const grove = () => getMarketOrders(farm).find(({ lane }) => lane === 'grove');
  assert.equal(grove(), undefined);
  assert.equal(deliverMarketOrder(farm, 'grove').ok, false);
  assert.equal(buyBoat(farm).ok, true);
  assert.equal(sail(farm, 'grove').ok, true);
  catchFish(farm, true);
  gatherSeaSalt(farm);
  const before = structuredClone(farm);
  assert.equal(deliverMarketOrder(farm, 'grove').ok, false);
  assert.equal(sellMarketItem(farm, 'fish:seaBass').ok, false);
  assert.deepEqual(farm, before);
  sail(farm, 'home');
  assert.equal(deliverMarketOrder(farm, 'grove').ok, true);
  assert.equal(farm.fish.seaBass, 0);
  assert.equal(farm.seaSalt, 1);
  endDay(farm);
  farm.fruit.pear = 2;
  farm.produce.beetroot = 2;
  assert.equal(deliverMarketOrder(farm, 'grove').ok, true);
  endDay(farm);
  assert.equal(grove()?.status, 'upgrade');
  assert.equal(deliverMarketOrder(farm, 'grove').ok, false);
  assert.equal(upgradeBuilding(farm, 'farmhouse').ok, true);
  assert.equal(grove()?.status, 'waiting');
  farm.produce.carrot = 1;
  farm.fish.seaBass = 1;
  farm.seaSalt = 2;
  assert.equal(cookDish(farm, 'grilledFish', grilledFishResult()).ok, true);
  assert.equal(grove()?.status, 'ready');
  assert.equal(deliverMarketOrder(farm, 'grove').ok, true);
  assert.equal(farm.dishes.grilledFish, 0);
  assert.equal(farm.seaSalt, 0);
});

test('old saves get an empty market ledger and invalid order dates are rejected', () => {
  const { orders, ...previousSave } = createFarm();
  const restored = restoreFarm(previousSave)!;
  assert.deepEqual(restored.orders, orders);
  const before = structuredClone(restored);
  assert.equal(sellMarketItem(restored, 'produce:unknown').ok, false);
  assert.equal(sellMarketItem(restored, 'produce:carrot').ok, false);
  assert.deepEqual(restored, before);
  restored.orders.garden = { completed: 1, deliveredOn: 2 };
  assert.equal(restoreFarm(restored), undefined);
});

test('the orchard kitchen unlocks jam and its own market orders', () => {
  const farm = createFarm();
  const kitchen = () => getMarketOrders(farm).find(({ lane }) => lane === 'kitchen');
  farm.coins = 80;
  pickFruit(farm, 0);
  workBed(farm, 4);
  assert.equal(kitchen(), undefined);
  assert.equal(cookDish(farm, 'appleJam').ok, false);
  assert.equal(upgradeBuilding(farm, 'farmhouse').ok, true);
  assert.equal(kitchen()?.name, 'Варенье и зерно');
  assert.equal(cookDish(farm, 'appleJam').ok, true);
  assert.equal(farm.fruit.apple, 0);
  assert.equal(kitchen()?.status, 'ready');
  assert.equal(deliverMarketOrder(farm, 'kitchen').ok, true);
  assert.equal(farm.dishes.appleJam, 0);
  assert.equal(farm.produce.wheat, 1);
  assert.equal(kitchen()?.status, 'delivered');
});

test('the packing coop turns collected eggs into a product without taking unrelated stock', () => {
  const farm = createFarm();
  farm.coins = 80;
  assert.equal(packEggBasket(farm).ok, false);
  assert.equal(upgradeBuilding(farm, 'coop').ok, true);
  const emptyNest = structuredClone(farm);
  assert.equal(packEggBasket(farm).ok, false);
  assert.deepEqual(farm, emptyNest);
  feedChickens(farm);
  endDay(farm);
  collectEggs(farm);
  workBed(farm, 9);
  assert.equal(farm.eggs, 5);
  assert.equal(packEggBasket(farm).ok, true);
  assert.equal(farm.eggs, 2);
  assert.equal(farm.eggBaskets, 1);
  assert.equal(deliverMarketOrder(farm, 'coop').ok, true);
  assert.equal(farm.eggBaskets, 0);
  assert.equal(farm.eggs, 2);
});

test('row watering spends one unit per dry crop and is atomic when water is short', () => {
  const farm = createFarm();
  farm.coins = 80;
  assert.equal(irrigateRow(farm, 2).ok, false);
  upgradeBuilding(farm, 'well');
  assert.equal(getMarketOrders(farm).some(({ lane }) => lane === 'irrigation'), true);
  farm.water = 1;
  assert.deepEqual(getIrrigationRow(farm, 2), { targets: [10, 11], available: false });
  const before = structuredClone(farm);
  assert.equal(irrigateRow(farm, 2).ok, false);
  assert.equal(irrigateRow(farm, 4).ok, false);
  assert.deepEqual(farm, before);
  refillWater(farm);
  assert.equal(irrigateRow(farm, 2, 1234).ok, true);
  assert.equal(farm.water, 6);
  assert.equal(farm.beds[8].kind, 'empty');
  assert.equal(farm.beds[9].kind === 'crop' && farm.beds[9].watered, false);
  assert.equal(farm.beds[10].kind === 'crop' && farm.beds[10].wateredAt, 1234);
  assert.equal(farm.beds[11].kind === 'crop' && farm.beds[11].wateredAt, 1234);
  assert.equal(irrigateRow(farm, 2).ok, false);
  assert.equal(farm.water, 6);
});

test('earlier market saves retain their delivered orders and building upgrades', () => {
  const { eggBaskets, ...current } = createFarm();
  const earlier = {
    ...current,
    buildingLevels: { ...current.buildingLevels, coop: 2 },
    orders: { garden: { completed: 1, deliveredOn: 1 }, pantry: current.orders.pantry, grove: current.orders.grove },
    dishes: { orchardTart: 1, grilledFish: 0 },
  };
  const restored = restoreFarm(earlier)!;
  assert.equal(restored.buildingLevels.coop, 2);
  assert.equal(restored.eggBaskets, 0);
  assert.equal(restored.dishes.appleJam, 0);
  assert.equal(restored.dishes.orchardTart, 1);
  assert.equal(getMarketOrders(restored).find(({ lane }) => lane === 'garden')?.status, 'delivered');
  assert.equal(getMarketOrders(restored).find(({ lane }) => lane === 'coop')?.name, 'Утренняя корзина');
});
