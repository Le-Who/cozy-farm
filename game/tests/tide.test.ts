import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buyBoat, collectShell, createFarm, endDay, getArchive, getMarketStock, getSale, getShellAt,
  restoreFarm, sail, sellMarketItem, sellProduce,
} from '../src/farm.ts';
import { isLunarTide, shellForSpot } from '../src/tide.ts';

test('Saltwind Grove renews shell spots at dawn and tide days can carry moon shells', () => {
  const farm = createFarm();
  farm.day = 5;
  farm.coins = 60;
  assert.equal(collectShell(farm, 0).ok, false);
  assert.equal(buyBoat(farm).ok, true);
  assert.equal(sail(farm, 'grove').ok, true);
  assert.equal(getShellAt(farm, 0), 'regular');
  assert.equal(collectShell(farm, 0).ok, true);
  for (const spot of [0, -1, 1.5, 3]) assert.equal(collectShell(farm, spot).ok, false);
  assert.equal(sail(farm, 'home').ok, true);
  assert.equal(sail(farm, 'grove').ok, true);
  assert.equal(getShellAt(farm, 0), undefined);
  assert.equal(sail(farm, 'home').ok, true);
  assert.equal(endDay(farm).ok, true);
  assert.equal(isLunarTide(farm.day), true);
  assert.deepEqual([0, 1, 2].map((spot) => getShellAt(farm, spot)), ['moon', 'regular', 'regular']);
  assert.equal(isLunarTide(16), true);
  for (let day = 6; day < 1000; day += 5) {
    assert.ok([0, 1, 2].some(spot => shellForSpot(day, spot) === 'moon'), `empty tide on day ${day}`);
  }
});

test('shell discoveries survive sale and spots cannot be collected twice after reload', () => {
  let farm = createFarm();
  farm.day = 6;
  farm.boatOwned = true;
  farm.island = 'grove';
  assert.equal(collectShell(farm, 1).ok, true);
  assert.deepEqual(getArchive(farm, 'shore')[0].items.map(({ discovered }) => discovered), [true, false]);
  assert.equal(collectShell(farm, 0).ok, true);
  const restored = restoreFarm(JSON.parse(JSON.stringify(farm)));
  assert.ok(restored);
  farm = restored;
  assert.equal(collectShell(farm, 0).ok, false);
  assert.equal(getMarketStock(farm).find(({ key }) => key === 'shells:moon')?.price, 12);
  assert.equal(sail(farm, 'home').ok, true);
  farm.progress.sell = 1;
  assert.deepEqual(getSale(farm), { items: 2, coins: 15 });
  const balance = farm.coins;
  assert.equal(sellMarketItem(farm, 'shells:moon').ok, true);
  assert.equal(sellProduce(farm).ok, true);
  assert.equal(farm.coins, balance + 15);
  assert.deepEqual(farm.shells, { regular: 0, moon: 0 });
  assert.deepEqual(restoreFarm(JSON.parse(JSON.stringify(farm)))?.shellDiscoveries, ['regular', 'moon']);
});

test('saves from before tides start with an empty Shore series and invalid ledgers are rejected', () => {
  const { shells, shellDiscoveries, shellsCollectedToday, ...oldSave } = createFarm();
  const farm = restoreFarm(oldSave);
  assert.ok(farm);
  assert.deepEqual(farm.shells, { regular: 0, moon: 0 });
  assert.ok(getArchive(farm, 'shore')[0].items.every(({ discovered }) => !discovered));
  assert.equal(restoreFarm({ ...oldSave, shellsCollectedToday: [0, 0] }), undefined);
  assert.equal(restoreFarm({ ...oldSave, shellsCollectedToday: [3] }), undefined);
  assert.equal(restoreFarm({ ...oldSave, shellDiscoveries: ['pearl'] }), undefined);
  assert.equal(restoreFarm({ ...oldSave, shells: { regular: 0, moon: -1 } }), undefined);
});
