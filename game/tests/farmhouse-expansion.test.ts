import assert from 'node:assert/strict';
import { test } from 'node:test';
import { restoreBayFestival } from '../src/bay-festival.ts';
import { createFarm, upgradeBuilding, specializeFarmhouse, getCookAction, cookDish, restoreFarm,
  hasFarmhouseSpecialization, getFarmhouseSpecializationAction, beginFestival, getFestivalStatus, contributeFestival } from '../src/farm.ts';

for (const first of ['bakery', 'preserves'] as const) {
  test(`both kitchen skills remain available after opening ${first} first and reloading`, () => {
    const farm = createFarm(); farm.coins = 500;
    assert.equal(upgradeBuilding(farm, 'farmhouse').ok, true);
    assert.equal(specializeFarmhouse(farm, first).ok, true);
    const second = first === 'bakery' ? 'preserves' : 'bakery';
    const before = farm.coins;
    assert.equal(getFarmhouseSpecializationAction(farm, second).available, true);
    assert.equal(specializeFarmhouse(farm, second).ok, true);
    assert.equal(farm.coins, before - 58);
    assert.equal(farm.farmhouseSpecialization, first, 'existing orders and building style keep their original branch');
    assert.equal(farm.farmhouseSecondarySpecialization, second);
    assert.equal(hasFarmhouseSpecialization(farm, 'bakery'), true);
    assert.equal(hasFarmhouseSpecialization(farm, 'preserves'), true);
    farm.produce.wheat = 2; farm.eggs = 1; farm.fruit.apple = 1; farm.fruit.pear = 1;
    assert.equal(getCookAction(farm, 'farmhouseBread').available, true);
    assert.equal(getCookAction(farm, 'orchardPreserves').available, true);
    assert.equal(cookDish(farm, 'farmhouseBread').ok, true);
    assert.equal(cookDish(farm, 'orchardPreserves').ok, true);
    const restored = restoreFarm(JSON.parse(JSON.stringify(farm)));
    assert.deepEqual(restored, farm);
    const unchanged = structuredClone(restored!);
    assert.equal(specializeFarmhouse(restored!, first).ok, false);
    assert.equal(specializeFarmhouse(restored!, second).ok, false);
    assert.deepEqual(restored, unchanged, 'repeat purchases never charge coins or replace a branch');
  });
}

test('a second kitchen requires the actual price at Home and failures are atomic', () => {
  const farm = createFarm(); farm.coins = 500;
  upgradeBuilding(farm, 'farmhouse'); specializeFarmhouse(farm, 'bakery');
  for (const setup of [() => { farm.coins = 57; farm.island = 'home' }, () => { farm.coins = 100; farm.island = 'grove' }]) {
    setup(); const before = structuredClone(farm);
    assert.equal(specializeFarmhouse(farm, 'preserves').ok, false);
    assert.deepEqual(farm, before);
  }
});

test('legacy single-branch saves migrate without inventing a second kitchen; malformed additions are rejected', () => {
  const farm = createFarm(); farm.coins = 500;
  upgradeBuilding(farm, 'farmhouse'); specializeFarmhouse(farm, 'bakery');
  assert.deepEqual(restoreFarm(JSON.parse(JSON.stringify(farm))), farm);
  assert.equal(hasFarmhouseSpecialization(farm, 'preserves'), false);
  for (const invalid of ['bakery', 'unknown', null, [], 2]) {
    assert.equal(restoreFarm({ ...farm, farmhouseSecondarySpecialization: invalid }), undefined);
  }
  assert.equal(restoreFarm({ ...createFarm(), farmhouseSecondarySpecialization: 'preserves' }), undefined);
  assert.equal(restoreFarm({ ...farm, dishes: { ...farm.dishes, orchardPreserves: 1 } }), undefined);
});

test('both specialty dishes are valid festival contributions and stay delivered after reload', () => {
  const farm = createFarm(); farm.coins = 500;
  upgradeBuilding(farm, 'farmhouse'); specializeFarmhouse(farm, 'bakery'); specializeFarmhouse(farm, 'preserves');
  farm.village.built = true; farm.village.meals = 1; farm.island = 'village';
  assert.equal(beginFestival(farm, 'harvest').ok, true);
  // Saved fixture at the third preparation. Other preparation paths have their own integration coverage.
  farm.day = 3; farm.festivals.active!.stage = 2; farm.festivals.active!.readyOn = 3;
  farm.produce.wheat = 2; farm.eggs = 1; farm.fruit.apple = 1; farm.fruit.pear = 1;
  assert.equal(cookDish(farm, 'farmhouseBread').ok, true);
  assert.equal(cookDish(farm, 'orchardPreserves').ok, true);
  const table = getFestivalStatus(farm).active!.requirements.find(row => row.id === 'treat');
  assert.ok(table?.alternatives.some(alt => alt.id === 'farmhouseBread'));
  assert.ok(table?.alternatives.some(alt => alt.id === 'orchardPreserves'));
  assert.equal(contributeFestival(farm, 'treat', 'farmhouseBread').ok, true);
  assert.equal(farm.dishes.farmhouseBread, 0);
  assert.equal(farm.dishes.orchardPreserves, 1);
  farm.festivals = restoreBayFestival(JSON.parse(JSON.stringify(farm.festivals)), farm.day, true)!;
  assert.ok(farm.festivals);
  assert.equal(contributeFestival(farm, 'treat', 'orchardPreserves').ok, true);
  assert.equal(farm.dishes.orchardPreserves, 0);
  assert.equal(contributeFestival(farm, 'treat', 'orchardPreserves').ok, false);
});
