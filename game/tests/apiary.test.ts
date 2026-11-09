import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buyBoat, collectCapeHoney, cookDish, createFarm, deliverHarborOrder, deliverMarketOrder,
  deliverProject, endDay, gatherSeaSalt, getArchive, getCapeHoney, getCapeUpgrade, getCapeWax,
  getCookAction, getMarketOrders, getMarketStock, getSale, plantCapeFlower, restoreFarm, sail,
  sellMarketItem, sellProduce, specializeFarmhouse, upgradeBuilding, upgradeCape, type FarmState,
} from '../src/farm.ts';

function reload(farm: FarmState): FarmState {
  const restored = restoreFarm(JSON.parse(JSON.stringify(farm)));
  assert.ok(restored);
  assert.deepEqual(restored, farm);
  return restored;
}

function assertOrderPremium(farm: FarmState, lane: 'apiary' | 'honeyKitchen', premium: number): void {
  const order = getMarketOrders(farm).find((entry) => entry.lane === lane);
  assert.ok(order);
  const market = getMarketStock(farm);
  const directSale = order.items.reduce((total, item) => {
    const key = 'item' in item ? `${item.kind}:${item.item}` : item.kind;
    const listing = market.find((entry) => entry.key === key);
    assert.ok(listing);
    return total + listing.price * item.quantity;
  }, 0);
  assert.ok(order.reward > directSale, `${order.name} must pay more than direct sale`);
  assert.equal(order.reward - directSale, premium);
}

function capeMeadow(): FarmState {
  const farm = createFarm();
  farm.coins = 500;
  buyBoat(farm);
  upgradeBuilding(farm, 'farmhouse');
  specializeFarmhouse(farm, 'bakery');
  farm.dishes.appleJam = 1;
  farm.fruit.pear = 2;
  farm.seaSalt = 4;
  sail(farm, 'grove');
  deliverProject(farm, 'dock');
  farm.dishes.farmhouseBread = 2;
  farm.fish.seaBass = 1;
  deliverHarborOrder(farm);
  sail(farm, 'home');
  endDay(farm);
  sail(farm, 'grove');
  deliverHarborOrder(farm);
  sail(farm, 'cape');
  for (let index = 0; index < 3; index++) plantCapeFlower(farm, index);
  sail(farm, 'home');
  endDay(farm);
  sail(farm, 'cape');
  assert.equal(collectCapeHoney(farm).ok, true);
  return farm;
}

function harvestNextDay(farm: FarmState): void {
  sail(farm, 'home');
  endDay(farm);
  sail(farm, 'cape');
  assert.equal(collectCapeHoney(farm).ok, true);
}

function honeyKitchen(): FarmState {
  let farm = capeMeadow();
  assert.equal(upgradeCape(farm).ok, true);
  farm = reload(farm);
  for (let day = 0; day < 3; day++) {
    harvestNextDay(farm);
    farm = reload(farm);
  }
  sail(farm, 'grove');
  gatherSeaSalt(farm);
  sail(farm, 'cape');
  assert.equal(upgradeCape(farm).ok, true);
  return reload(farm);
}

test('the Apiary upgrade spends coins and honey atomically and preserves the same-day harvest limit', () => {
  let farm = capeMeadow();
  assert.equal(farm.capeLevel, 1);
  assert.equal(getCapeWax(farm), 0);
  assert.equal(getCapeUpgrade(farm)?.nextLevel, 2);
  farm.coins = 47;
  const shortCoins = structuredClone(farm);
  assert.equal(upgradeCape(farm).ok, false);
  assert.deepEqual(farm, shortCoins);
  farm.coins = 48;
  farm.honey = 2;
  const shortHoney = structuredClone(farm);
  assert.equal(upgradeCape(farm).ok, false);
  assert.deepEqual(farm, shortHoney);
  farm.honey = 3;
  sail(farm, 'home');
  const wrongIsland = structuredClone(farm);
  assert.equal(upgradeCape(farm).ok, false);
  assert.deepEqual(farm, wrongIsland);
  sail(farm, 'cape');
  assert.equal(upgradeCape(farm).ok, true);
  assert.equal(farm.capeLevel, 2);
  assert.equal(farm.coins, 0);
  assert.equal(farm.honey, 0);
  assert.equal(farm.beeswax, 0);
  assert.equal(farm.capeHoneyOn, farm.day);
  assert.deepEqual(getCapeHoney(farm), { available: false, blooms: 3, honey: 4, windHoney: 0 });
  assert.equal(getCapeWax(farm), 1);
  farm = reload(farm);
  assert.equal(collectCapeHoney(farm).ok, false);
  harvestNextDay(farm);
  assert.equal(farm.honey, 4);
  assert.equal(farm.beeswax, 1);
  assert.equal(collectCapeHoney(farm).ok, false);
  reload(farm);
});

test('Apiary requires three mature flower beds and Honey Kitchen debits its material costs only on success', () => {
  const farm = capeMeadow();
  farm.capeFlowers[2] = farm.day;
  const immature = structuredClone(farm);
  assert.equal(getCapeUpgrade(farm)?.available, false);
  assert.equal(upgradeCape(farm).ok, false);
  assert.deepEqual(farm, immature);
  farm.capeFlowers[2] = farm.day - 1;
  upgradeCape(farm);
  for (let day = 0; day < 3; day++) harvestNextDay(farm);
  assert.equal(farm.beeswax, 3);
  farm.seaSalt = 1;
  const shortSalt = structuredClone(farm);
  assert.equal(upgradeCape(farm).ok, false);
  assert.deepEqual(farm, shortSalt);
  farm.seaSalt = 2;
  const balance = farm.coins;
  assert.equal(upgradeCape(farm).ok, true);
  assert.equal(farm.capeLevel, 3);
  assert.equal(farm.coins, balance - 68);
  assert.equal(farm.beeswax, 0);
  assert.equal(farm.seaSalt, 0);
  assert.equal(getCapeUpgrade(farm), undefined);
  assert.equal(collectCapeHoney(farm).ok, false);
  const complete = structuredClone(farm);
  assert.equal(upgradeCape(farm).ok, false);
  assert.deepEqual(farm, complete);
  reload(farm);
});

test('Cape recipes cook only in the Honey Kitchen and retain their discoveries after delivery and reload', () => {
  let farm = honeyKitchen();
  while (farm.day < 8) harvestNextDay(farm);
  assert.deepEqual(getCapeHoney(farm), { available: false, blooms: 3, honey: 3, windHoney: 1 });
  farm.produce.wheat = 4;
  farm.eggs = 3;
  farm.fruit.pear = 2;
  farm.fruit.peach = 1;
  farm.seaSalt = 1;
  sail(farm, 'home');
  const atHome = structuredClone(farm);
  for (const recipe of ['honeyBiscuits', 'honeyPear', 'windParfait'] as const) {
    assert.equal(getCookAction(farm, recipe).available, false);
    assert.equal(cookDish(farm, recipe).ok, false);
  }
  assert.deepEqual(farm, atHome);
  sail(farm, 'cape');
  assert.equal(cookDish(farm, 'honeyCake').ok, false);
  for (const recipe of ['honeyBiscuits', 'honeyBiscuits', 'honeyPear', 'windParfait'] as const) {
    assert.equal(cookDish(farm, recipe).ok, true);
    farm = reload(farm);
  }
  assert.equal(farm.produce.wheat, 0);
  assert.equal(farm.eggs, 0);
  assert.equal(farm.fruit.pear, 0);
  assert.equal(farm.fruit.peach, 0);
  assert.equal(farm.seaSalt, 0);
  assert.equal(farm.windHoney, 0);
  assert.equal(deliverMarketOrder(farm, 'honeyKitchen').ok, false);
  sail(farm, 'home');
  farm.progress.sell = 1;
  const beforeFirst = farm.coins;
  assertOrderPremium(farm, 'honeyKitchen', 14);
  assert.equal(deliverMarketOrder(farm, 'honeyKitchen').ok, true);
  assert.equal(farm.coins, beforeFirst + 70);
  farm = reload(farm);
  assert.equal(deliverMarketOrder(farm, 'honeyKitchen').ok, false);
  endDay(farm);
  const beforeSecond = farm.coins;
  assertOrderPremium(farm, 'honeyKitchen', 16);
  assert.equal(deliverMarketOrder(farm, 'honeyKitchen').ok, true);
  assert.equal(farm.coins, beforeSecond + 88);
  farm = reload(farm);
  for (const recipe of ['honeyBiscuits', 'honeyPear', 'windParfait'] as const) {
    assert.equal(farm.dishes[recipe], 0);
    assert.equal(getArchive(farm, 'bay').flatMap(({ items }) => items).find(({ id }) => id === recipe)?.discovered, true);
  }
});

test('beeswax trades in the Apiary lane and both sale entry points retain its archive record', () => {
  let farm = capeMeadow();
  assert.equal(getMarketOrders(farm).some(({ lane }) => lane === 'apiary'), false);
  upgradeCape(farm);
  for (let day = 0; day < 3; day++) harvestNextDay(farm);
  sail(farm, 'home');
  farm.progress.sell = 1;
  const beforeOrder = farm.coins;
  assertOrderPremium(farm, 'apiary', 10);
  assert.equal(deliverMarketOrder(farm, 'apiary').ok, true);
  assert.equal(farm.coins, beforeOrder + 42);
  assert.equal(farm.beeswax, 0);
  farm = reload(farm);
  assert.equal(deliverMarketOrder(farm, 'apiary').ok, false);
  for (let day = 0; day < 2; day++) harvestNextDay(farm);
  sail(farm, 'home');
  farm.fruit.apple = 2;
  cookDish(farm, 'appleJam');
  const beforeSecond = farm.coins;
  assertOrderPremium(farm, 'apiary', 10);
  assert.equal(deliverMarketOrder(farm, 'apiary').ok, true);
  assert.equal(farm.coins, beforeSecond + 36);
  assert.equal(farm.beeswax, 0);
  assert.equal(farm.dishes.appleJam, 0);
  farm = reload(farm);
  harvestNextDay(farm);
  sail(farm, 'home');
  const stock = getMarketStock(farm).find(({ key }) => key === 'beeswax');
  assert.equal(stock?.count, 1);
  assert.equal(stock?.price, 6);
  const beforeSale = farm.coins;
  assert.equal(sellMarketItem(farm, 'beeswax').ok, true);
  assert.equal(farm.coins, beforeSale + 6);
  harvestNextDay(farm);
  sail(farm, 'home');
  const sale = getSale(farm);
  const beforeBulk = farm.coins;
  assert.equal(sellProduce(farm).ok, true);
  assert.equal(farm.coins, beforeBulk + sale.coins);
  assert.equal(farm.beeswax, 0);
  farm = reload(farm);
  assert.equal(farm.bayDiscoveries.includes('beeswax'), true);
});

test('older Cape saves gain empty upgrade state while impossible Apiary and kitchen states are rejected', () => {
  const farm = capeMeadow();
  const old = JSON.parse(JSON.stringify(farm));
  delete old.capeLevel;
  delete old.beeswax;
  delete old.dishes.honeyBiscuits;
  delete old.dishes.honeyPear;
  delete old.dishes.windParfait;
  delete old.orders.apiary;
  delete old.orders.honeyKitchen;
  const restored = restoreFarm(old);
  assert.ok(restored);
  assert.equal(restored.capeLevel, 1);
  assert.equal(restored.beeswax, 0);
  assert.equal(restored.dishes.honeyBiscuits, 0);
  assert.equal(restored.dishes.honeyPear, 0);
  assert.equal(restored.dishes.windParfait, 0);
  assert.deepEqual(restored.orders.apiary, { completed: 0, deliveredOn: 0 });
  assert.deepEqual(restored.orders.honeyKitchen, { completed: 0, deliveredOn: 0 });
  assert.equal(restoreFarm({ ...farm, capeLevel: 4 }), undefined);
  assert.equal(restoreFarm({ ...farm, beeswax: 1 }), undefined);
  assert.equal(restoreFarm({ ...farm, dishes: { ...farm.dishes, honeyBiscuits: 1 } }), undefined);
  assert.equal(restoreFarm({ ...createFarm(), capeLevel: 2 }), undefined);
  const atApiary = capeMeadow();
  upgradeCape(atApiary);
  atApiary.produce.wheat = 2;
  atApiary.eggs = 1;
  atApiary.honey = 1;
  assert.equal(cookDish(atApiary, 'honeyBiscuits').ok, false);
});
