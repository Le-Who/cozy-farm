import assert from 'node:assert/strict';
import { test } from 'node:test';
import { berryCropIds, tartDishIds, isTartDish, createFarm, getCookAction, cookDish, dishDefinitions, getArchive, getMarketStock, sellMarketItem, restoreFarm, getMarketOrders, deliverMarketOrder, endDay, workBed, cropDefinitions } from '../src/farm.ts';
import type { CookeryResult } from '../src/culinary.ts';

test('each named berry tart cooks only in the upgraded home kitchen and survives sale, archive and reload', () => {
  for (const berry of berryCropIds) {
    const farm = createFarm();
    const dish = `${berry}Tart`;
    assert.ok(isTartDish(dish));
    assert.ok(tartDishIds.includes(dish));
    farm.produce[berry] = 2;
    farm.produce.wheat = 1;
    farm.eggs = 1;
    const before = structuredClone(farm);
    assert.equal(cookDish(farm, dish).ok, false);
    assert.deepEqual(farm, before, 'a locked kitchen must not spend ingredients');
    farm.buildingLevels.farmhouse = 2;
    assert.ok(getCookAction(farm, dish).available);
    const result: CookeryResult = { family: 'decorate', fruit: [{ ingredientId: berry, x: .2, y: -.1, angle: .4 }], steps: ['fruit', 'dust', 'bake'], baking: { method: 'oven', finish: 'golden', seconds: 140 } };
    assert.ok(cookDish(farm, dish, result).ok);
    assert.equal(farm.produce[berry], 0);
    assert.equal(farm.produce.wheat, 0);
    assert.equal(farm.eggs, 0);
    assert.equal(farm.dishes[dish], 1);
    const restored = restoreFarm(JSON.parse(JSON.stringify(farm)))!;
    assert.ok(restored);
    assert.deepEqual(restored.culinary.lastDishes[dish], result);
    assert.ok(getArchive(restored, 'bay').find(group => group.id === 'dishes')?.items.some(item => item.id === dish && item.name === dishDefinitions[dish].name && item.discovered));
    assert.ok(getMarketStock(restored).some(item => item.key === `dishes:${dish}` && item.count === 1 && item.price === dishDefinitions[dish].sellPrice));
    assert.ok(sellMarketItem(restored, `dishes:${dish}`).ok);
    assert.equal(restored.dishes[dish], 0);
    assert.ok(restoreFarm(JSON.parse(JSON.stringify(restored)))?.bayDiscoveries.includes(dish));
  }
});

test('saves from before named berry tarts gain empty stock without changing existing ingredients or dish stock', () => {
  const old: any = createFarm();
  old.coins = 71;
  old.dishes.orchardTart = 2;
  old.produce.strawberry = 7;
  for (const id of ['strawberryTart', 'blueberryTart', 'raspberryTart']) delete old.dishes[id];
  const restored = restoreFarm(old)!;
  assert.ok(restored);
  assert.equal(restored.coins, 71);
  assert.equal(restored.dishes.orchardTart, 2);
  assert.equal(restored.produce.strawberry, 7);
  for (const id of tartDishIds.filter(id => id !== 'orchardTart')) assert.equal(restored.dishes[id], 0);
});

test('berry kitchen orders join the normal rotation after the first grown berry without changing island requirements', () => {
  const farm = createFarm();
  farm.buildingLevels.farmhouse = 2;
  farm.orders.kitchen = { completed: 2, deliveredOn: 1 };
  farm.day = 3;
  const kitchen = () => getMarketOrders(farm).find(order => order.lane === 'kitchen')!;
  assert.equal(kitchen().name, 'Варенье и зерно');
  farm.beds[0] = { kind: 'crop', crop: 'strawberry', growth: cropDefinitions.strawberry.days, watered: false };
  assert.ok(workBed(farm, 0).ok);
  assert.equal(kitchen().name, 'Клубничное чаепитие');
  farm.produce.wheat = 1;
  farm.eggs = 1;
  assert.ok(cookDish(farm, 'strawberryTart').ok);
  assert.ok(deliverMarketOrder(farm, 'kitchen').ok);
  assert.equal(farm.dishes.strawberryTart, 0);
  assert.ok(endDay(farm).ok);
  assert.equal(kitchen().name, 'Черничный полдник');
  assert.equal(restoreFarm(JSON.parse(JSON.stringify(farm)))?.orders.kitchen.completed, 3);
  assert.equal(farm.orders.harbor.completed, 0);
  assert.equal(farm.boatOwned, false);
});
