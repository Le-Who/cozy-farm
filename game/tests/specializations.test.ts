import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buyBoat,
  cookDish,
  createFarm,
  deliverMarketOrder,
  endDay,
  getCookAction,
  getMarketOrders,
  getProject,
  restoreFarm,
  sail,
  sellMarketItem,
  specializeFarmhouse,
  upgradeBuilding,
  type FarmState,
} from '../src/farm.ts';

function specialtyOrder(farm: FarmState) {
  return getMarketOrders(farm).find(({ lane }) => lane === 'specialty');
}

test('farmhouse specialization requires level two and payment at Home, and the choice is permanent', () => {
  const farm = createFarm();
  farm.coins = 250;
  const starter = structuredClone(farm);
  assert.equal(specializeFarmhouse(farm, 'bakery').ok, false);
  assert.deepEqual(farm, starter);
  assert.equal(upgradeBuilding(farm, 'farmhouse').ok, true);
  assert.equal(buyBoat(farm).ok, true);
  assert.equal(sail(farm, 'grove').ok, true);
  const away = structuredClone(farm);
  assert.equal(specializeFarmhouse(farm, 'bakery').ok, false);
  assert.deepEqual(farm, away);
  assert.equal(sail(farm, 'home').ok, true);

  farm.coins = 57;
  const short = structuredClone(farm);
  assert.equal(specializeFarmhouse(farm, 'bakery').ok, false);
  assert.deepEqual(farm, short);
  assert.equal(specialtyOrder(farm), undefined);
  assert.equal(deliverMarketOrder(farm, 'specialty').ok, false);
  farm.coins = 58;
  assert.equal(specializeFarmhouse(farm, 'bakery').ok, true);
  assert.equal(farm.coins, 0);
  assert.equal(farm.buildingLevels.farmhouse, 3);
  assert.equal(farm.farmhouseSpecialization, 'bakery');

  farm.coins = 100;
  const restored = restoreFarm(JSON.parse(JSON.stringify(farm)));
  assert.ok(restored);
  assert.equal(specializeFarmhouse(restored, 'bakery').ok, false);
  assert.equal(specializeFarmhouse(restored, 'preserves').ok, false);
  assert.equal(upgradeBuilding(restored, 'farmhouse').ok, false);
  assert.deepEqual(restored, farm);
});

test('the Bakery sells bread, rotates its own orders, and keeps level-two kitchen and Fair access', () => {
  const farm = createFarm();
  farm.coins = 250;
  farm.eggs = 3;
  farm.produce.wheat = 6;
  farm.fruit.apple = 4;
  farm.fruit.pear = 1;
  assert.equal(sellMarketItem(farm, 'eggs').ok, true);
  for (const building of ['farmhouse', 'coop', 'well'] as const) assert.equal(upgradeBuilding(farm, building).ok, true);
  assert.equal(getCookAction(farm, 'farmhouseBread').available, false);
  const oldOrders = getMarketOrders(farm);
  assert.equal(specializeFarmhouse(farm, 'bakery').ok, true);
  assert.deepEqual(getMarketOrders(farm).filter(({ lane }) => lane !== 'specialty'), oldOrders);
  assert.equal(cookDish(farm, 'appleJam').ok, true);
  assert.equal(getProject(farm, 'fair').status, 'ready');
  assert.equal(cookDish(farm, 'orchardPreserves').ok, false);
  assert.equal(farm.fruit.pear, 1);

  assert.equal(cookDish(farm, 'farmhouseBread').ok, true);
  assert.equal(farm.eggs, 1);
  assert.equal(farm.produce.wheat, 4);
  const beforeSale = farm.coins;
  assert.equal(sellMarketItem(farm, 'dishes:farmhouseBread').ok, true);
  assert.equal(farm.coins, beforeSale + 22);
  assert.equal(cookDish(farm, 'farmhouseBread').ok, true);
  assert.equal(specialtyOrder(farm)?.name, 'Хлебная корзина');
  assert.equal(specialtyOrder(farm)?.status, 'ready');
  const beforeOrder = farm.coins;
  assert.equal(deliverMarketOrder(farm, 'specialty').ok, true);
  assert.equal(farm.coins, beforeOrder + 38);
  assert.equal(farm.dishes.farmhouseBread, 0);
  assert.equal(farm.produce.wheat, 0);
  assert.equal(specialtyOrder(farm)?.status, 'delivered');

  const restored = restoreFarm(JSON.parse(JSON.stringify(farm)));
  assert.ok(restored);
  assert.equal(deliverMarketOrder(restored, 'specialty').ok, false);
  assert.equal(restored.coins, beforeOrder + 38);
  assert.equal(endDay(restored).ok, true);
  assert.equal(specialtyOrder(restored)?.name, 'Стол пекаря');
  restored.produce.wheat = 4;
  restored.eggs = 2;
  assert.equal(cookDish(restored, 'farmhouseBread').ok, true);
  assert.equal(cookDish(restored, 'farmhouseBread').ok, true);
  assert.equal(deliverMarketOrder(restored, 'specialty').ok, true);
  assert.equal(restored.coins, beforeOrder + 38 + 68);
  assert.equal(endDay(restored).ok, true);
  assert.equal(specialtyOrder(restored)?.name, 'Хлебная корзина');
});

test('the Preserves kitchen makes and sells orchard preserves and cycles its two orders', () => {
  const farm = createFarm();
  farm.coins = 250;
  farm.eggs = 2;
  farm.produce.wheat = 2;
  farm.fruit.apple = 6;
  farm.fruit.pear = 2;
  assert.equal(sellMarketItem(farm, 'eggs').ok, true);
  assert.equal(upgradeBuilding(farm, 'farmhouse').ok, true);
  const beforeSpecializing = farm.coins;
  assert.equal(specializeFarmhouse(farm, 'preserves').ok, true);
  assert.equal(farm.coins, beforeSpecializing - 58);
  assert.equal(cookDish(farm, 'farmhouseBread').ok, false);
  assert.equal(farm.produce.wheat, 2);
  assert.equal(farm.eggs, 1);

  assert.equal(cookDish(farm, 'orchardPreserves').ok, true);
  assert.equal(farm.fruit.apple, 5);
  assert.equal(farm.fruit.pear, 1);
  const beforeSale = farm.coins;
  assert.equal(sellMarketItem(farm, 'dishes:orchardPreserves').ok, true);
  assert.equal(farm.coins, beforeSale + 22);
  assert.equal(cookDish(farm, 'orchardPreserves').ok, true);
  assert.equal(specialtyOrder(farm)?.name, 'Ящик садового конфитюра');
  assert.equal(deliverMarketOrder(farm, 'specialty').ok, true);
  assert.equal(farm.coins, beforeSale + 22 + 40);
  assert.equal(farm.fruit.apple, 2);
  assert.equal(farm.dishes.orchardPreserves, 0);
  assert.equal(endDay(farm).ok, true);
  assert.equal(specialtyOrder(farm)?.name, 'Кладовая рощи');
  farm.fruit.apple = 4;
  farm.fruit.pear = 2;
  assert.equal(cookDish(farm, 'orchardPreserves').ok, true);
  assert.equal(cookDish(farm, 'orchardPreserves').ok, true);
  assert.equal(cookDish(farm, 'appleJam').ok, true);
  assert.equal(deliverMarketOrder(farm, 'specialty').ok, true);
  assert.equal(farm.coins, beforeSale + 22 + 40 + 68);
  assert.equal(endDay(farm).ok, true);
  assert.equal(specialtyOrder(farm)?.name, 'Ящик садового конфитюра');
  assert.deepEqual(restoreFarm(JSON.parse(JSON.stringify(farm))), farm);
});

test('older kitchen saves gain empty specialty stock and impossible specialization saves are rejected', () => {
  const farm = createFarm();
  farm.coins = 90;
  assert.equal(upgradeBuilding(farm, 'farmhouse').ok, true);
  const { farmhouseSpecialization, orders, dishes, ...oldFarm } = farm;
  const { specialty, ...oldOrders } = orders;
  const { farmhouseBread, orchardPreserves, ...oldDishes } = dishes;
  oldDishes.appleJam = 2;
  oldOrders.kitchen = { completed: 1, deliveredOn: 1 };
  const restored = restoreFarm({ ...oldFarm, orders: oldOrders, dishes: oldDishes });
  assert.ok(restored);
  assert.equal(restored.farmhouseSpecialization, null);
  assert.equal(restored.dishes.farmhouseBread, 0);
  assert.equal(restored.dishes.orchardPreserves, 0);
  assert.equal(restored.dishes.appleJam, 2);
  assert.equal(getMarketOrders(restored).find(({ lane }) => lane === 'kitchen')?.status, 'delivered');
  assert.equal(specialtyOrder(restored), undefined);

  assert.equal(restoreFarm({ ...farm, farmhouseSpecialization: 'preserves' }), undefined);
  const levelThree = { ...farm, buildingLevels: { ...farm.buildingLevels, farmhouse: 3 } };
  assert.equal(restoreFarm(levelThree), undefined);
  assert.equal(restoreFarm({ ...levelThree, farmhouseSpecialization: 'unknown' }), undefined);
  for (const building of ['coop', 'well'] as const) {
    assert.equal(restoreFarm({ ...farm, buildingLevels: { ...farm.buildingLevels, [building]: 3 } }), undefined);
  }
  assert.equal(restoreFarm({ ...farm, orders: { ...farm.orders, specialty: { completed: 1, deliveredOn: 1 } } }), undefined);
  assert.equal(restoreFarm({ ...levelThree, farmhouseSpecialization: 'bakery', dishes: { ...farm.dishes, orchardPreserves: 1 } }), undefined);
});
