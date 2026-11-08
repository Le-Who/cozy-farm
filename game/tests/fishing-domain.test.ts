import assert from 'node:assert/strict';
import { test } from 'node:test';
import { beginFishingTrip, finishFishingTrip, createFarm, restoreFarm, getMarketStock, buyAndPlantTree, treeDefinitions } from '../src/farm.ts';
import type { FishingLoot } from '../src/fishing-model.ts';

test('typed catches award species and shells once while junk earns no fish or daily quota', () => {
  const farm = createFarm();
  const first = beginFishingTrip(farm); assert.ok(first.token);
  const result = finishFishingTrip(farm, first.token, [{ kind: 'fish', species: 'moonfish', variant: 'rare' }, { kind: 'shell', variant: 'moon' }]);
  assert.ok(result.ok); assert.match(result.message, /moonfish/);
  assert.equal(farm.fish.moonfish, 1); assert.equal(farm.fish.perch, 0);
  assert.equal(farm.shells.moon, 1); assert.ok(farm.shellDiscoveries.includes('moon'));
  assert.equal(farm.fishCaughtToday.home, 1); assert.ok(farm.bayDiscoveries.includes('moonfish'));
  assert.ok(getMarketStock(farm).some(item => item.key === 'fish:moonfish' && item.count === 1));
  const awarded = structuredClone(farm);
  assert.equal(finishFishingTrip(farm, first.token, [{ kind: 'fish', species: 'moonfish', variant: 'rare' }]).ok, false);
  assert.deepEqual(farm, awarded);
  const junk = beginFishingTrip(farm); assert.ok(junk.token);
  const cleanup = finishFishingTrip(farm, junk.token, [{ kind: 'junk', item: 'boot' }, { kind: 'junk', item: 'weed' }]);
  assert.match(cleanup.message, /litter/);
  assert.equal(farm.fishCaughtToday.home, 1); assert.equal(farm.fish.perch, 0);
  assert.ok(restoreFarm(JSON.parse(JSON.stringify(farm))));
});

test('typed catch validation is atomic and slots and daily fish quota remain bounded', () => {
  const farm = createFarm(); const trip = beginFishingTrip(farm); assert.ok(trip.token);
  const pending = structuredClone(farm);
  assert.equal(finishFishingTrip(farm, trip.token, [{ kind: 'fish', species: 'imaginary', variant: 'rare' }] as unknown as FishingLoot[]).ok, false);
  assert.deepEqual(farm, pending);
  const loot = { kind: 'fish', species: 'lanternfish', variant: 'rare' } as const;
  finishFishingTrip(farm, trip.token, [loot, loot, loot]);
  assert.equal(farm.fish.lanternfish, 2);
  const last = beginFishingTrip(farm); assert.ok(last.token);
  finishFishingTrip(farm, last.token, [loot, { kind: 'shell', variant: 'regular' }]);
  assert.equal(farm.fish.lanternfish, 3); assert.equal(farm.shells.regular, 1);
  assert.equal(farm.fishCaughtToday.home, 3); assert.equal(beginFishingTrip(farm).ok, false);
});

test('old fish saves gain empty deep species while new catches survive reload', () => {
  const farm = createFarm();
  const old = { ...farm, fish: { perch: 2, seaBass: 0 } };
  const restored = restoreFarm(old); assert.ok(restored);
  assert.equal(restored.fish.perch, 2); assert.equal(restored.fish.moonfish, 0);
  assert.equal(restoreFarm({ ...old, fish: { perch: 2, seaBass: 0, moonfish: -1 } }), undefined);
});

test('buy and plant uses an owned sapling or purchases and plants atomically', () => {
  const owned = createFarm(); const coins = owned.coins;
  assert.ok(buyAndPlantTree(owned, 1, 'apple').ok);
  assert.equal(owned.coins, coins); assert.equal(owned.saplings.apple, 0);
  assert.equal(owned.trees.home[1]?.tree, 'apple');
  const farm = createFarm();
  assert.ok(buyAndPlantTree(farm, 1, 'pear').ok);
  assert.equal(farm.coins, 18 - treeDefinitions.pear.saplingPrice);
  assert.equal(farm.saplings.pear, 0); assert.equal(farm.trees.home[1]?.tree, 'pear');
  assert.equal(farm.workToday, 1);
});

test('buy and plant cannot charge for an occupied, invalid, inaccessible or unaffordable spot', () => {
  for (const failure of ['occupied', 'island', 'slot', 'coins'] as const) {
    const farm = createFarm();
    if (failure === 'island') farm.island = 'cape';
    if (failure === 'coins') farm.coins = 0;
    const before = structuredClone(farm);
    assert.equal(buyAndPlantTree(farm, failure === 'occupied' ? 0 : failure === 'slot' ? -1 : 1, 'pear').ok, false);
    assert.deepEqual(farm, before);
  }
});
