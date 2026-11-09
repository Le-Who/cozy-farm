import assert from 'node:assert/strict';
import test from 'node:test';
import {
  collectEggs,
  createFarm,
  deliverMarketOrder,
  endDay,
  feedChickens,
  getIrrigationPair,
  getIrrigationRow,
  getMarketOrders,
  getMarketStock,
  getSale,
  getWaterCapacity,
  incubateEgg,
  irrigatePair,
  irrigateRow,
  packEggBasket,
  packEggCrate,
  petChicken,
  restoreFarm,
  sellMarketItem,
  sellProduce,
  specializeFacility,
  upgradeBuilding,
  upgradeCan,
} from '../src/farm.ts';

test('facility specializations require Level II, are purchased at Home, and persist independently', () => {
  const farm = createFarm();
  farm.coins = 47;
  assert.equal(specializeFacility(farm, 'hatchery').ok, false);
  assert.equal(upgradeBuilding(farm, 'coop').ok, true);
  assert.equal(specializeFacility(farm, 'packing').ok, false);
  assert.equal(farm.coins, 25);
  farm.coins = 200;
  farm.island = 'grove';
  assert.equal(specializeFacility(farm, 'hatchery').ok, false);
  assert.equal(farm.coins, 200);
  farm.island = 'home';
  assert.equal(specializeFacility(farm, 'hatchery').ok, true);
  assert.equal(farm.coins, 170);
  assert.equal(farm.buildingLevels.coop, 3);
  assert.equal(farm.coopSpecialization, 'hatchery');
  assert.equal(specializeFacility(farm, 'packing').ok, false);
  assert.equal(upgradeBuilding(farm, 'well').ok, true);
  assert.equal(specializeFacility(farm, 'rain').ok, true);
  assert.equal(farm.coins, 108);
  assert.equal(farm.buildingLevels.well, 3);
  assert.equal(farm.wellSpecialization, 'rain');
  assert.equal(specializeFacility(farm, 'pipes').ok, false);
  assert.deepEqual(restoreFarm(JSON.parse(JSON.stringify(farm))), farm);
});

test('the Hatchery uses one egg, hatches on the second morning, and grows production and nest capacity', () => {
  let farm = createFarm();
  farm.coins = 100;
  farm.feed = 5;
  assert.equal(upgradeBuilding(farm, 'coop').ok, true);
  assert.equal(specializeFacility(farm, 'hatchery').ok, true);
  assert.equal(incubateEgg(farm).ok, false);
  assert.equal(collectEggs(farm).ok, true);
  assert.equal(incubateEgg(farm).ok, true);
  assert.equal(farm.eggs, 0);
  assert.equal(farm.hatchDay, 3);
  assert.equal(incubateEgg(farm).ok, false);
  assert.equal(petChicken(farm, 4).ok, false);

  assert.equal(feedChickens(farm).ok, true);
  assert.equal(endDay(farm).ok, true);
  assert.equal(farm.flockSize, 4);
  assert.equal(farm.eggsReady, 4);
  const reloaded = restoreFarm(JSON.parse(JSON.stringify(farm)));
  assert.ok(reloaded);
  farm = reloaded;
  assert.equal(farm.hatchDay, 3);
  assert.equal(feedChickens(farm).ok, true);
  assert.match(endDay(farm).message, /Вылупилась новая курочка/);
  assert.equal(farm.flockSize, 5);
  assert.equal(farm.hatchDay, null);
  assert.equal(farm.eggsReady, 8);
  assert.equal(collectEggs(farm).ok, true);
  assert.equal(incubateEgg(farm).ok, false);
  assert.equal(petChicken(farm, 4).ok, true);
  assert.equal(petChicken(farm, 4).ok, false);
  assert.equal(petChicken(farm, 5).ok, false);
  assert.deepEqual(restoreFarm(JSON.parse(JSON.stringify(farm)))?.pettedChickens, [4]);
  assert.equal(feedChickens(farm).ok, true);
  assert.equal(endDay(farm).ok, true);
  assert.equal(farm.eggsReady, 5);

  for (let i = 0; i < 2; i += 1) {
    assert.equal(feedChickens(farm).ok, true);
    assert.equal(endDay(farm).ok, true);
  }
  assert.equal(farm.eggsReady, 12);
  assert.deepEqual(restoreFarm(JSON.parse(JSON.stringify(farm))), farm);
});

test('the Packing House preserves baskets and sells each five-egg crate for 24 coins', () => {
  const farm = createFarm();
  farm.coins = 100;
  farm.eggs = 13;
  assert.equal(upgradeBuilding(farm, 'coop').ok, true);
  assert.equal(packEggCrate(farm).ok, false);
  assert.equal(farm.eggs, 13);
  assert.equal(specializeFacility(farm, 'packing').ok, true);
  assert.equal(packEggBasket(farm).ok, true);
  assert.equal(packEggCrate(farm).ok, true);
  assert.equal(packEggCrate(farm).ok, true);
  assert.equal(packEggCrate(farm).ok, false);
  assert.equal(farm.eggs, 0);
  assert.equal(farm.eggBaskets, 1);
  assert.equal(farm.eggCrates, 2);
  assert.deepEqual(restoreFarm(JSON.parse(JSON.stringify(farm))), farm);
  const listing = getMarketStock(farm).find(({ key }) => key === 'eggCrates');
  assert.equal(listing?.price, 24);
  assert.equal(listing?.count, 2);
  assert.deepEqual(getSale(farm), { items: 3, coins: 61 });
  farm.progress.sell = 1;
  const before = farm.coins;
  assert.equal(sellMarketItem(farm, 'eggCrates').ok, true);
  assert.equal(farm.coins - before, 24);
  assert.equal(farm.eggCrates, 1);
  assert.equal(sellProduce(farm).ok, true);
  assert.equal(farm.coins - before, 61);
  assert.equal(farm.eggCrates, 0);
  assert.equal(farm.eggBaskets, 0);
});

test('the Rain Cistern expands either watering can and refills it every morning', () => {
  const farm = createFarm();
  farm.coins = 100;
  assert.equal(upgradeBuilding(farm, 'well').ok, true);
  assert.equal(specializeFacility(farm, 'rain').ok, true);
  assert.equal(getWaterCapacity(farm), 12);
  assert.equal(getIrrigationPair(farm, 0).available, false);
  assert.equal(irrigateRow(farm, 0).ok, true);
  assert.equal(endDay(farm).ok, true);
  assert.equal(farm.water, 12);
  assert.equal(upgradeCan(farm).ok, true);
  assert.equal(getWaterCapacity(farm), 16);
  farm.water = 0;
  assert.equal(endDay(farm).ok, true);
  assert.equal(farm.water, 16);
  assert.equal(restoreFarm(JSON.parse(JSON.stringify(farm)))?.water, 16);
});

test('Irrigation Pipes water the full adjacent pair at ordinary water and goal costs', () => {
  const farm = createFarm();
  farm.coins = 100;
  assert.equal(upgradeBuilding(farm, 'well').ok, true);
  farm.beds.splice(0, 8,
    { kind: 'crop', crop: 'carrot', growth: 1, watered: false },
    ...Array.from({ length: 6 }, () => ({ kind: 'crop', crop: 'carrot', growth: 0, watered: false }) as const),
    { kind: 'crop', crop: 'carrot', growth: 0, watered: true, wateredAt: 5 },
  );
  assert.equal(getIrrigationPair(farm, 0).available, false);
  assert.equal(specializeFacility(farm, 'pipes').ok, true);
  assert.equal(getWaterCapacity(farm), 8);
  assert.equal(getIrrigationRow(farm, 1).available, true);
  assert.deepEqual(getIrrigationPair(farm, 0), { targets: [1, 2, 3, 4, 5, 6], available: true });
  farm.water = 5;
  const before = structuredClone(farm);
  assert.equal(irrigatePair(farm, 0).ok, false);
  assert.equal(irrigatePair(farm, 3).ok, false);
  assert.equal(irrigatePair(farm, -1).ok, false);
  assert.equal(irrigatePair(farm, 0.5).ok, false);
  assert.deepEqual(farm, before);
  farm.water = 6;
  assert.equal(irrigatePair(farm, 0, 40).ok, true);
  assert.equal(farm.water, 0);
  assert.equal(farm.progress.water, 6);
  assert.equal(farm.workToday, 6);
  assert.equal(farm.coins - before.coins, 3);
  assert.deepEqual(farm.beds.slice(0, 8).map((bed) => bed.kind === 'crop' && bed.wateredAt),
    [undefined, 40, 40, 40, 40, 40, 40, 5]);
  assert.equal(endDay(farm).ok, true);
  assert.equal(farm.water, 0);
});

test('facility branches open independent rotating orders and preserve the Level II lanes', () => {
  const farm = createFarm();
  farm.coins = 200;
  assert.equal(upgradeBuilding(farm, 'coop').ok, true);
  assert.equal(upgradeBuilding(farm, 'well').ok, true);
  assert.deepEqual(getMarketOrders(farm).map(({ lane }) => lane), ['garden', 'pantry', 'coop', 'irrigation']);
  assert.equal(specializeFacility(farm, 'packing').ok, true);
  assert.equal(specializeFacility(farm, 'pipes').ok, true);
  farm.eggs = 5;
  assert.equal(packEggCrate(farm).ok, true);
  farm.produce.wheat = 2;
  farm.produce.carrot = 6;
  farm.produce.beetroot = 4;
  assert.equal(deliverMarketOrder(farm, 'flock').ok, true);
  assert.equal(deliverMarketOrder(farm, 'flock').ok, false);
  assert.equal(deliverMarketOrder(farm, 'waterworks').ok, true);
  assert.equal(farm.eggCrates, 0);
  assert.equal(farm.produce.wheat, 0);
  assert.equal(farm.produce.carrot, 0);
  assert.equal(farm.produce.beetroot, 0);
  assert.deepEqual(getMarketOrders(farm).slice(-2).map(({ status }) => status), ['delivered', 'delivered']);
  const restored = restoreFarm(JSON.parse(JSON.stringify(farm)));
  assert.ok(restored);
  assert.equal(endDay(restored).ok, true);
  assert.deepEqual(getMarketOrders(restored).slice(-2).map(({ name }) => name), ['Поставка к завтраку', 'Ужин на мельнице']);

  const other = createFarm();
  other.coins = 200;
  assert.equal(upgradeBuilding(other, 'coop').ok, true);
  assert.equal(upgradeBuilding(other, 'well').ok, true);
  assert.equal(specializeFacility(other, 'hatchery').ok, true);
  assert.equal(specializeFacility(other, 'rain').ok, true);
  assert.deepEqual(getMarketOrders(other).slice(-2).map(({ name }) => name), ['Завтрак в инкубаторе', 'Корзина дождливого сада']);
});

test('earlier saves keep their upgrades and invalid facility state is rejected', () => {
  const farm = createFarm();
  farm.coins = 120;
  assert.equal(upgradeBuilding(farm, 'coop').ok, true);
  assert.equal(upgradeBuilding(farm, 'well').ok, true);
  assert.equal(petChicken(farm, 3).ok, true);
  const { coopSpecialization, wellSpecialization, flockSize, hatchDay, eggCrates, orders, ...previousSave } = farm;
  const { flock, waterworks, ...previousOrders } = orders;
  const oldSave = { ...previousSave, orders: previousOrders };
  assert.deepEqual(restoreFarm(oldSave), farm);
  assert.equal(restoreFarm({ ...oldSave, coopSpecialization: 'packing' }), undefined);
  assert.equal(restoreFarm({ ...oldSave, eggCrates: 1 }), undefined);
  assert.equal(restoreFarm({ ...oldSave, flockSize: 5 }), undefined);
  assert.equal(restoreFarm({ ...oldSave, pettedChickens: [4] }), undefined);
  assert.equal(restoreFarm({ ...oldSave, orders: { ...previousOrders, flock: { completed: 1, deliveredOn: 1 } } }), undefined);
  assert.equal(specializeFacility(farm, 'hatchery').ok, true);
  assert.equal(restoreFarm({ ...farm, hatchDay: farm.day }), undefined);
  assert.equal(restoreFarm({ ...farm, hatchDay: farm.day + 3 }), undefined);
  assert.equal(restoreFarm({ ...farm, hatchDay: farm.day + 1, flockSize: 5 }), undefined);
});
