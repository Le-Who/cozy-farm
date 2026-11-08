import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buyBoat,
  catchFish,
  collectEggs,
  cookDish,
  createFarm,
  deliverHarborOrder,
  deliverProject,
  endDay,
  gatherSeaSalt,
  getFishAction,
  getFishLimit,
  getHarborOrder,
  getMarketOrders,
  getMarketStock,
  getProject,
  getSale,
  pickFruit,
  restoreFarm,
  sail,
  sellMarketItem,
  sellProduce,
  specializeFarmhouse,
  upgradeBuilding,
} from '../src/farm.ts';

test('harbor orders hold a partial cargo across travel, mornings, and reloads', () => {
  for (const [branch, dish] of [['bakery', 'farmhouseBread'], ['preserves', 'orchardPreserves']] as const) {
    let farm = createFarm();
    farm.coins = 250;
    assert.equal(buyBoat(farm).ok, true);
    assert.equal(upgradeBuilding(farm, 'farmhouse').ok, true);
    assert.equal(specializeFarmhouse(farm, branch).ok, true);
    assert.equal(getHarborOrder(farm), undefined);
    farm.dishes.appleJam = 1;
    farm.fruit.pear = 2;
    farm.seaSalt = 2;
    assert.equal(sail(farm, 'grove').ok, true);
    assert.equal(deliverProject(farm, 'dock').ok, true);
    farm.fish.seaBass = 2;
    const balance = farm.coins;
    const meal = getHarborOrder(farm)?.items[0].item;
    assert.ok(meal?.kind === 'dishes');
    assert.equal(meal.item, dish);
    assert.equal(deliverHarborOrder(farm).ok, true);
    assert.equal(farm.fish.seaBass, 1);
    assert.equal(farm.coins, balance);
    assert.equal(deliverHarborOrder(farm).ok, false);
    assert.equal(sail(farm, 'home').ok, true);
    assert.equal(endDay(farm).ok, true);
    const restored = restoreFarm(JSON.parse(JSON.stringify(farm)));
    assert.ok(restored);
    farm = restored;
    assert.equal(getHarborOrder(farm)?.items[1].delivered, 1);
    assert.equal(getHarborOrder(farm)?.status, 'locked');
    assert.equal(getMarketOrders(farm).some(({ lane }) => lane === 'harbor'), false);
    farm.produce.wheat = 2;
    farm.eggs = 1;
    farm.fruit.apple = farm.fruit.pear = 1;
    assert.equal(cookDish(farm, dish).ok, true);
    assert.equal(deliverHarborOrder(farm).ok, false);
    assert.equal(sail(farm, 'grove').ok, true);
    assert.equal(deliverHarborOrder(farm).ok, true);
    assert.equal(farm.coins, balance + 36);
    assert.equal(farm.fish.seaBass, 1);
    assert.equal(getHarborOrder(farm)?.status, 'completed');
    assert.equal(deliverHarborOrder(farm).ok, false);
    assert.deepEqual(restoreFarm(JSON.parse(JSON.stringify(farm)))?.orders.harbor, { completed: 1, deliveredOn: farm.day });
    assert.equal(sail(farm, 'home').ok, true);
    assert.equal(endDay(farm).ok, true);
    assert.equal(getHarborOrder(farm)?.name, 'Посылка из Солёной рощи');
    assert.ok(getHarborOrder(farm)?.items.every(({ delivered }) => delivered === 0));
    assert.equal(restoreFarm({ ...farm, harborSupplies: { 'fish:seaBass': 1 } }), undefined);
    assert.equal(restoreFarm({ ...farm, harborSupplies: { seaSalt: 2, [`dishes:${dish}`]: 1 } }), undefined);
  }
});

test('saves made before projects still load without granting project rewards', () => {
  const { projects, ...oldSave } = createFarm();
  oldSave.coins = 93;
  oldSave.produce.carrot = 5;
  oldSave.orders.garden = { completed: 1, deliveredOn: 1 };
  const farm = restoreFarm(oldSave);
  assert.ok(farm);
  assert.equal(farm.coins, 93);
  assert.equal(farm.produce.carrot, 5);
  assert.deepEqual(farm.orders.garden, oldSave.orders.garden);
  assert.equal(getProject(farm, 'fair').status, 'locked');
  assert.equal(getProject(farm, 'dock').status, 'locked');
  assert.equal(getFishLimit(farm, 'grove'), 3);
  assert.deepEqual(getSale(farm), { items: 5, coins: 10 });
});

test('restore rejects deliveries above project requirements and catches above the unrewarded limit', () => {
  const farm = createFarm();
  const overfilledFair = { ...farm, projects: { ...farm.projects, fair: { 'produce:carrot': 5 } } };
  assert.equal(restoreFarm(overfilledFair), undefined);
  assert.equal(restoreFarm({ ...farm, boatOwned: true, fishCaughtToday: { home: 0, grove: 4 } }), undefined);
});

test('the fair accepts supplies over several days, pays once and raises fresh crop prices', () => {
  const farm = createFarm();
  farm.coins = 300;
  assert.equal(collectEggs(farm).ok, true);
  assert.equal(sellMarketItem(farm, 'eggs').ok, true);
  assert.equal(upgradeBuilding(farm, 'farmhouse').ok, true);
  assert.equal(upgradeBuilding(farm, 'coop').ok, true);
  farm.produce.carrot = 7;
  assert.equal(getProject(farm, 'fair').status, 'locked');
  const lockedFarm = structuredClone(farm);
  assert.equal(deliverProject(farm, 'fair').ok, false);
  assert.deepEqual(farm, lockedFarm);
  assert.equal(upgradeBuilding(farm, 'well').ok, true);

  farm.dishes.appleJam = 2;
  farm.produce.wheat = 1;
  assert.equal(buyBoat(farm).ok, true);
  assert.equal(sail(farm, 'grove').ok, true);
  const awayFromFair = structuredClone(farm);
  assert.equal(deliverProject(farm, 'fair').ok, false);
  assert.deepEqual(farm, awayFromFair);
  assert.equal(sail(farm, 'home').ok, true);

  const originalStock = getMarketStock(farm);
  const project = getProject(farm, 'fair');
  assert.equal(project.status, 'ready');
  assert.deepEqual(Object.fromEntries(project.items.map(({ item, available }) => [
    'item' in item ? item.item : item.kind, available,
  ])), { appleJam: 1, eggBaskets: 0, carrot: 4, wheat: 1 });
  const coinsBeforeDelivery = farm.coins;
  assert.equal(deliverProject(farm, 'fair').ok, true);
  assert.equal(farm.coins, coinsBeforeDelivery);
  assert.equal(farm.dishes.appleJam, 1);
  assert.equal(farm.produce.carrot, 3);
  assert.equal(farm.produce.wheat, 0);
  assert.deepEqual(Object.fromEntries(getProject(farm, 'fair').items.map(({ item, delivered }) => [
    'item' in item ? item.item : item.kind, delivered,
  ])), { appleJam: 1, eggBaskets: 0, carrot: 4, wheat: 1 });
  assert.equal(getProject(farm, 'fair').status, 'waiting');
  const partialFarm = structuredClone(farm);
  assert.equal(deliverProject(farm, 'fair').ok, false);
  assert.deepEqual(farm, partialFarm);

  const restored = restoreFarm(JSON.parse(JSON.stringify(farm)));
  assert.ok(restored);
  assert.equal(endDay(restored).ok, true);
  assert.deepEqual(getProject(restored, 'fair'), getProject(farm, 'fair'));
  restored.eggBaskets = 2;
  restored.produce.wheat = 5;
  assert.equal(getProject(restored, 'fair').status, 'ready');
  assert.equal(deliverProject(restored, 'fair').ok, true);
  assert.equal(restored.coins, coinsBeforeDelivery + 65);
  assert.equal(restored.eggBaskets, 1);
  assert.equal(restored.produce.wheat, 3);
  assert.equal(restored.produce.carrot, 3);
  assert.equal(restored.dishes.appleJam, 1);
  assert.equal(getProject(restored, 'fair').status, 'completed');

  const afterFair = restoreFarm(JSON.parse(JSON.stringify(restored)));
  assert.ok(afterFair);
  const completedFarm = structuredClone(afterFair);
  assert.equal(deliverProject(afterFair, 'fair').ok, false);
  assert.deepEqual(afterFair, completedFarm);
  for (const { item, key, price } of originalStock) {
    assert.equal(getMarketStock(afterFair).find((entry) => entry.key === key)?.price, price + Number(item.kind === 'produce'), key);
  }
  const coinsBeforeSale = afterFair.coins;
  assert.equal(sellMarketItem(afterFair, 'produce:carrot').ok, true);
  assert.equal(afterFair.coins, coinsBeforeSale + 3);
  const basketPrice = originalStock.find(({ key }) => key === 'eggBaskets')!.price;
  const remainingStockValue = 2 * 3 + 3 * 4 + 14 + basketPrice;
  assert.deepEqual(getSale(afterFair), { items: 7, coins: remainingStockValue });
  assert.equal(sellProduce(afterFair).ok, true);
  assert.equal(afterFair.coins, coinsBeforeSale + 3 + remainingStockValue);
});

test('the dock accepts Grove deliveries and adds one local catch after completion', () => {
  const farm = createFarm();
  farm.coins = 300;
  farm.dishes.appleJam = 2;
  assert.equal(getProject(farm, 'dock').status, 'locked');
  assert.equal(deliverProject(farm, 'dock').ok, false);
  assert.equal(buyBoat(farm).ok, true);
  const beforeSailing = structuredClone(farm);
  assert.equal(deliverProject(farm, 'dock').ok, false);
  assert.deepEqual(farm, beforeSailing);

  assert.equal(sail(farm, 'grove').ok, true);
  assert.equal(pickFruit(farm, 0).ok, true);
  assert.equal(gatherSeaSalt(farm).ok, true);
  assert.equal(getFishLimit(farm), 3);
  for (let cast = 0; cast < 3; cast += 1) assert.equal(catchFish(farm, true).ok, true);
  assert.equal(getFishAction(farm).available, false);
  assert.equal(catchFish(farm, true).ok, false);
  assert.equal(getProject(farm, 'dock').status, 'ready');
  const coinsBeforeDelivery = farm.coins;
  assert.equal(deliverProject(farm, 'dock').ok, true);
  assert.equal(farm.coins, coinsBeforeDelivery + 55);
  assert.equal(farm.dishes.appleJam, 1);
  assert.equal(farm.fruit.pear, 0);
  assert.equal(farm.seaSalt, 0);
  assert.equal(getProject(farm, 'dock').status, 'completed');

  assert.equal(getFishLimit(farm), 4);
  assert.equal(getFishAction(farm).available, true);
  assert.equal(catchFish(farm, true).ok, true);
  assert.equal(farm.fish.seaBass, 4);
  assert.equal(catchFish(farm, true).ok, false);
  const restored = restoreFarm(JSON.parse(JSON.stringify(farm)));
  assert.ok(restored);
  assert.equal(getProject(restored, 'dock').status, 'completed');
  assert.equal(getFishAction(restored).available, false);
  assert.equal(deliverProject(restored, 'dock').ok, false);
  assert.equal(restored.coins, coinsBeforeDelivery + 55);
  assert.equal(sail(restored, 'home').ok, true);
  assert.equal(getFishLimit(restored), 3);
  assert.equal(endDay(restored).ok, true);
  assert.equal(sail(restored, 'grove').ok, true);
  assert.equal(getFishLimit(restored), 4);
  assert.equal(getFishAction(restored).available, true);
});
