import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buyBoat, canSailTo, catchFish, collectCapeHoney, cookDish, createFarm, deliverHarborOrder,
  deliverMarketOrder, deliverProject, endDay, getArchive, getCapeBloom, getCapeHoney,
  getFairGuest, getFishAction, getMarketOrders, getMarketStock, getProject, getTreeAction,
  hasBayDisplay, isHoneyWind, plantCapeFlower, plantTree, restoreFarm, sail, sellMarketItem,
  sellProduce, serveFairGuest, specializeFarmhouse, upgradeBuilding,
} from '../src/farm.ts';

function capeFarm(completeSecondOrder = true) {
  const farm = createFarm();
  farm.coins = 500;
  buyBoat(farm);
  upgradeBuilding(farm, 'farmhouse');
  specializeFarmhouse(farm, 'bakery');
  farm.dishes.appleJam = 1;
  farm.fruit.pear = 2;
  farm.seaSalt = 4;
  sail(farm, 'grove');
  assert.equal(deliverProject(farm, 'dock').ok, true);
  farm.dishes.farmhouseBread = 2;
  farm.fish.seaBass = 1;
  assert.equal(deliverHarborOrder(farm).ok, true);
  assert.equal(canSailTo(farm, 'cape'), true);
  sail(farm, 'home');
  endDay(farm);
  sail(farm, 'grove');
  if (completeSecondOrder) assert.equal(deliverHarborOrder(farm).ok, true);
  return farm;
}

test('the restored dock opens Cape without changing existing orchard and fish ledgers', () => {
  const locked = createFarm();
  locked.honey = 1;
  locked.produce.wheat = 2;
  const beforeRecipe = structuredClone(locked);
  assert.equal(cookDish(locked, 'honeyCake').ok, false);
  assert.deepEqual(locked, beforeRecipe);
  const farm = capeFarm();
  assert.equal(canSailTo(farm, 'cape'), true);
  assert.equal(sail(farm, 'cape').ok, true);
  assert.equal(getFishAction(farm).available, false);
  assert.equal(catchFish(farm, true).ok, false);
  assert.equal(getTreeAction(farm, 0).available, false);
  assert.equal(plantTree(farm, 0, 'apple').ok, false);
  assert.deepEqual(Object.keys(farm.trees), ['home', 'grove']);
  assert.deepEqual(Object.keys(farm.fishCaughtToday), ['home', 'grove']);
  assert.deepEqual(restoreFarm(JSON.parse(JSON.stringify(farm))), farm);
});

test('Cape flowers mature overnight and honey can be collected once a day across travel and reload', () => {
  let farm = capeFarm();
  assert.equal(plantCapeFlower(farm, 0).ok, false);
  sail(farm, 'cape');
  assert.equal(plantCapeFlower(farm, -1).ok, false);
  assert.equal(plantCapeFlower(farm, 3).ok, false);
  assert.equal(plantCapeFlower(farm, 0).ok, true);
  assert.equal(plantCapeFlower(farm, 1).ok, true);
  assert.equal(plantCapeFlower(farm, 0).ok, false);
  assert.equal(getCapeBloom(farm, 0), 'growing');
  assert.equal(collectCapeHoney(farm).ok, false);
  sail(farm, 'home');
  endDay(farm);
  sail(farm, 'cape');
  assert.equal(getCapeBloom(farm, 0), 'bloom');
  assert.deepEqual(getCapeHoney(farm), { available: true, blooms: 2, honey: 2, windHoney: 0 });
  assert.equal(collectCapeHoney(farm).ok, true);
  const restored = restoreFarm(JSON.parse(JSON.stringify(farm)));
  assert.ok(restored);
  farm = restored;
  assert.equal(collectCapeHoney(farm).ok, false);
  sail(farm, 'grove');
  sail(farm, 'cape');
  assert.equal(collectCapeHoney(farm).ok, false);
  sail(farm, 'home');
  endDay(farm);
  sail(farm, 'cape');
  assert.equal(collectCapeHoney(farm).ok, true);
  assert.equal(farm.honey, 4);
});

test('Honey Wind replaces one portion, persists in the archive after sale, and fills a Home order', () => {
  const farm = capeFarm();
  sail(farm, 'cape');
  plantCapeFlower(farm, 0);
  plantCapeFlower(farm, 1);
  sail(farm, 'home');
  while (farm.day < 8) endDay(farm);
  assert.equal(isHoneyWind(7), false);
  assert.equal(isHoneyWind(8), true);
  assert.equal(isHoneyWind(13), true);
  sail(farm, 'cape');
  assert.deepEqual(getCapeHoney(farm), { available: true, blooms: 2, honey: 1, windHoney: 1 });
  assert.equal(collectCapeHoney(farm).ok, true);
  assert.equal(farm.honey + farm.windHoney, 2);
  sail(farm, 'home');
  farm.produce.wheat = 2;
  assert.equal(cookDish(farm, 'honeyCake').ok, true);
  assert.equal(farm.honey, 0);
  const order = getMarketOrders(farm).find(({ lane }) => lane === 'cape');
  assert.ok(order);
  assert.equal(deliverMarketOrder(farm, 'cape').ok, true);
  assert.equal(farm.dishes.honeyCake, 0);
  assert.equal(deliverMarketOrder(farm, 'cape').ok, false);
  endDay(farm);
  assert.equal(deliverMarketOrder(farm, 'cape').ok, true);
  assert.equal(farm.windHoney, 0);
  const entries = getArchive(farm, 'bay').flatMap(({ items }) => items);
  for (const id of ['honey', 'windHoney', 'honeyCake']) {
    assert.equal(entries.find((entry) => entry.id === id)?.discovered, true);
  }
  const restored = restoreFarm(JSON.parse(JSON.stringify(farm)));
  assert.ok(restored);
  assert.deepEqual(restored.bayDiscoveries, farm.bayDiscoveries);
});

test('honey sells through both market entry points at the listed unit prices', () => {
  const farm = capeFarm();
  sail(farm, 'cape');
  plantCapeFlower(farm, 0);
  plantCapeFlower(farm, 1);
  sail(farm, 'home');
  while (farm.day < 8) endDay(farm);
  sail(farm, 'cape');
  collectCapeHoney(farm);
  sail(farm, 'home');
  const market = getMarketStock(farm);
  const windPrice = market.find(({ key }) => key === 'windHoney')!.price;
  const honeyPrice = market.find(({ key }) => key === 'honey')!.price;
  farm.progress.sell = 1;
  const balance = farm.coins;
  assert.equal(sellMarketItem(farm, 'windHoney').ok, true);
  assert.equal(farm.coins, balance + windPrice);
  assert.equal(sellProduce(farm).ok, true);
  assert.equal(farm.coins, balance + windPrice + honeyPrice);
  assert.equal(farm.honey, 0);
  assert.equal(farm.bayDiscoveries.includes('windHoney'), true);
});

test('fair guests trade only their requested item, pay once, and remember being served after reload', () => {
  const farm = capeFarm();
  sail(farm, 'home');
  assert.equal(getFairGuest(farm), undefined);
  upgradeBuilding(farm, 'coop');
  upgradeBuilding(farm, 'well');
  farm.dishes.appleJam = 1;
  farm.eggBaskets = 1;
  farm.produce.carrot = 4;
  farm.produce.wheat = 3;
  assert.equal(getProject(farm, 'fair').status, 'ready');
  assert.equal(deliverProject(farm, 'fair').ok, true);
  const guest = getFairGuest(farm);
  assert.ok(guest);
  assert.equal(serveFairGuest(farm).ok, false);
  farm.fruit.apple = 20;
  farm.produce.wheat = 20;
  farm.dishes.appleJam = 20;
  const coins = farm.coins;
  const seeds = farm.seeds[guest.seeds.crop];
  const progress = { ...farm.progress };
  sail(farm, 'grove');
  assert.equal(serveFairGuest(farm).ok, false);
  assert.equal(farm.coins, coins);
  sail(farm, 'home');
  assert.equal(serveFairGuest(farm).ok, true);
  assert.equal(farm.coins, coins + guest.reward);
  assert.equal(farm.seeds[guest.seeds.crop], seeds + guest.seeds.count);
  assert.deepEqual(farm.progress, progress);
  assert.equal([farm.fruit.apple, farm.produce.wheat, farm.dishes.appleJam].filter((n) => n !== 20).length, 1);
  assert.equal(farm.dishes.honeyCake, 0);
  const restored = restoreFarm(JSON.parse(JSON.stringify(farm)));
  assert.ok(restored);
  assert.equal(getFairGuest(restored)?.served, true);
  assert.equal(serveFairGuest(restored).ok, false);
  endDay(restored);
  assert.equal(getFairGuest(restored)?.served, false);
});

test('both fish unlock the dock display and Bay discoveries survive consumption and old-save migration', () => {
  const farm = createFarm();
  catchFish(farm, true);
  farm.coins = 100;
  buyBoat(farm);
  sail(farm, 'grove');
  catchFish(farm, true);
  assert.equal(hasBayDisplay(farm), false);
  farm.dishes.appleJam = 1;
  farm.fruit.pear = 2;
  farm.seaSalt = 2;
  deliverProject(farm, 'dock');
  assert.equal(hasBayDisplay(farm), true);
  sail(farm, 'home');
  sellProduce(farm);
  assert.equal(hasBayDisplay(farm), true);
  assert.equal(restoreFarm(JSON.parse(JSON.stringify(farm)))?.bayDiscoveries.includes('seaBass'), true);
  const legacy = createFarm() as unknown as Record<string, unknown>;
  delete legacy.bayDiscoveries;
  delete legacy.capeFlowers;
  delete legacy.capeHoneyOn;
  delete legacy.honey;
  delete legacy.windHoney;
  delete legacy.guestServedOn;
  legacy.fish = { perch: 1, seaBass: 0 };
  legacy.dishes = { orchardTart: 1, grilledFish: 0 };
  const restored = restoreFarm(legacy);
  assert.ok(restored);
  assert.deepEqual(restored.bayDiscoveries, ['perch', 'orchardTart']);
  assert.deepEqual(restored.capeFlowers, [null, null, null]);
});

test('restore rejects locked Cape visits, impossible flowers, future collections, and premature guest service', () => {
  const farm = createFarm();
  assert.equal(restoreFarm({ ...farm, boatOwned: true, island: 'cape' }), undefined);
  assert.equal(restoreFarm({ ...farm, capeFlowers: [1, null, null] }), undefined);
  assert.equal(restoreFarm({ ...farm, capeHoneyOn: 2 }), undefined);
  assert.equal(restoreFarm({ ...farm, guestServedOn: 1 }), undefined);
  assert.equal(restoreFarm({ ...farm, bayDiscoveries: ['unknown'] }), undefined);
  assert.equal(restoreFarm({ ...farm, bayDiscoveries: ['perch', 'perch'] }), undefined);
  const unlocked = capeFarm();
  assert.equal(restoreFarm({ ...unlocked, capeFlowers: [unlocked.day + 1, null, null] }), undefined);
  assert.equal(restoreFarm({ ...unlocked, capeFlowers: [null, null, null], capeHoneyOn: unlocked.day }), undefined);
  assert.equal(restoreFarm({ ...unlocked, honey: 1 }), undefined);
  assert.equal(restoreFarm({ ...unlocked, windHoney: 1 }), undefined);
});

test('Cape cakes, the cake visitor, and Wind honey retain their stock and daily ledgers after every save', () => {
  let farm = capeFarm();
  const reload = () => {
    const restored = restoreFarm(JSON.parse(JSON.stringify(farm)));
    assert.ok(restored);
    assert.deepEqual(restored, farm);
    farm = restored;
  };
  sail(farm, 'home');
  upgradeBuilding(farm, 'coop');
  upgradeBuilding(farm, 'well');
  farm.dishes.appleJam = 1;
  farm.eggBaskets = 1;
  farm.produce.carrot = 4;
  farm.produce.wheat = 7;
  deliverProject(farm, 'fair');
  sail(farm, 'cape');
  plantCapeFlower(farm, 0);
  plantCapeFlower(farm, 1);
  reload();
  assert.equal(collectCapeHoney(farm).ok, false);
  sail(farm, 'home');
  endDay(farm);
  reload();
  sail(farm, 'cape');
  collectCapeHoney(farm);
  reload();
  assert.equal(farm.honey, 2);
  assert.equal(collectCapeHoney(farm).ok, false);
  sail(farm, 'home');
  cookDish(farm, 'honeyCake');
  reload();
  assert.equal(farm.dishes.honeyCake, 1);
  assert.equal(farm.honey, 1);
  const beforeMarket = farm.coins;
  assert.equal(deliverMarketOrder(farm, 'cape').ok, true);
  assert.equal(farm.coins, beforeMarket + 28 + 8);
  assert.equal(farm.progress.sell, 1);
  reload();
  assert.equal(deliverMarketOrder(farm, 'cape').ok, false);
  assert.equal(farm.dishes.honeyCake, 0);
  endDay(farm);
  assert.equal(farm.day, 4);
  cookDish(farm, 'honeyCake');
  reload();
  const guest = getFairGuest(farm);
  assert.deepEqual(guest?.item, { kind: 'dishes', item: 'honeyCake', quantity: 1 });
  const beforeGuest = farm.coins;
  const beforeSeeds = farm.seeds.wheat;
  assert.equal(serveFairGuest(farm).ok, true);
  assert.equal(farm.coins, beforeGuest + 23);
  assert.equal(farm.seeds.wheat, beforeSeeds + 2);
  assert.equal(farm.progress.sell, 1);
  reload();
  assert.equal(serveFairGuest(farm).ok, false);
  assert.equal(farm.dishes.honeyCake, 0);
  while (farm.day < 8) {
    endDay(farm);
    reload();
  }
  sail(farm, 'cape');
  collectCapeHoney(farm);
  reload();
  assert.equal(farm.windHoney, 1);
  sail(farm, 'home');
  const beforeWindOrder = farm.coins;
  assert.equal(deliverMarketOrder(farm, 'cape').ok, true);
  assert.equal(farm.coins, beforeWindOrder + 26);
  reload();
  assert.equal(farm.windHoney, 0);
  assert.equal(farm.orders.cape.completed, 2);
  assert.equal(deliverMarketOrder(farm, 'cape').ok, false);
  for (const id of ['honey', 'windHoney', 'honeyCake'] as const) assert.equal(farm.bayDiscoveries.includes(id), true);
});

test('the fair visitor keeps the same daily request when optional harbor orders unlock cake requests', () => {
  for (const unlockDay of [2, 3, 4]) {
    const farm = capeFarm(false);
    sail(farm, 'home');
    upgradeBuilding(farm, 'coop');
    upgradeBuilding(farm, 'well');
    farm.dishes.appleJam = 1;
    farm.eggBaskets = 1;
    farm.produce.carrot = 4;
    farm.produce.wheat = 3;
    deliverProject(farm, 'fair');
    while (farm.day < unlockDay) endDay(farm);
    const guestBeforeUnlock = getFairGuest(farm);
    assert.ok(guestBeforeUnlock);
    assert.equal(canSailTo(farm, 'cape'), true);
    if (unlockDay === 4) {
      assert.equal(guestBeforeUnlock.name, 'Беа');
      assert.deepEqual(guestBeforeUnlock.item, { kind: 'produce', item: 'wheat', quantity: 3 });
    }
    sail(farm, 'grove');
    assert.equal(deliverHarborOrder(farm).ok, true);
    sail(farm, 'home');
    assert.equal(canSailTo(farm, 'cape'), true);
    assert.deepEqual(getFairGuest(farm), guestBeforeUnlock);
    const restored = restoreFarm(JSON.parse(JSON.stringify(farm)));
    assert.ok(restored);
    assert.deepEqual(getFairGuest(restored), guestBeforeUnlock);
    while (restored.day < 8) endDay(restored);
    assert.deepEqual(getFairGuest(restored)?.item, { kind: 'dishes', item: 'honeyCake', quantity: 1 });
  }
});
