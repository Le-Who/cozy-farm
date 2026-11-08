import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  collectShell, collectShoalFind, createFarm, endDay, getArchive, getSale, restoreFarm, sail,
  sellMarketItem, sellProduce,
} from '../src/farm.ts';
import { getShoalFindAt, hasShoal } from '../src/shoal.ts';

test('the second shell discovery opens the shoal and one sea-glass find per day', () => {
  const farm = createFarm();
  farm.day = 6;
  farm.boatOwned = true;
  assert.equal(sail(farm, 'grove').ok, true);
  assert.equal(getShoalFindAt(farm, 'glass'), undefined);
  assert.equal(collectShoalFind(farm, 'glass').ok, false);
  assert.equal(collectShell(farm, 1).ok, true);
  assert.equal(hasShoal(farm), false);
  assert.match(collectShell(farm, 0).message, /Открыта Лунная отмель/);
  assert.equal(hasShoal(farm), true);
  assert.equal(getShoalFindAt(farm, 'pearl'), undefined);
  assert.equal(collectShoalFind(farm, 'glass').ok, true);
  assert.equal(collectShoalFind(farm, 'glass').ok, false);
  const restored = restoreFarm(JSON.parse(JSON.stringify(farm)));
  assert.ok(restored);
  assert.equal(getShoalFindAt(restored, 'glass'), undefined);
  assert.equal(sail(restored, 'home').ok, true);
  assert.equal(endDay(restored).ok, true);
  assert.equal(getShoalFindAt(restored, 'glass'), 'glass');
  assert.equal(collectShoalFind(restored, 'glass').ok, false);
  assert.deepEqual(getArchive(restored, 'shore')[1].items.map(({ discovered }) => discovered), [true, false]);
});

test('a lunar pearl joins ordinary glass at the market and both stay in the archive after sale', () => {
  const farm = createFarm();
  farm.day = 11;
  farm.boatOwned = true;
  farm.shellDiscoveries = ['regular', 'moon'];
  assert.equal(sail(farm, 'grove').ok, true);
  assert.equal(collectShoalFind(farm, 'pearl').ok, true);
  assert.equal(collectShoalFind(farm, 'pearl').ok, false);
  assert.equal(collectShoalFind(farm, 'glass').ok, true);
  assert.equal(sail(farm, 'home').ok, true);
  farm.progress.sell = 1;
  const balance = farm.coins;
  assert.deepEqual(getSale(farm), { items: 2, coins: 23 });
  assert.equal(sellMarketItem(farm, 'shoalFinds:pearl').ok, true);
  assert.equal(sellProduce(farm).ok, true);
  assert.equal(farm.coins, balance + 23);
  const restored = restoreFarm(JSON.parse(JSON.stringify(farm)));
  assert.ok(restored);
  assert.ok(hasShoal(restored));
  assert.deepEqual(restored.shoalDiscoveries, ['glass', 'pearl']);
});

test('old shell discoveries unlock the shoal and unavailable ledger entries are rejected', () => {
  const { shoalFinds, shoalDiscoveries, shoalCollectedToday, ...legacy } = createFarm();
  legacy.shellDiscoveries = ['regular', 'moon'];
  const farm = restoreFarm(legacy);
  assert.ok(farm && hasShoal(farm));
  assert.deepEqual(farm.shoalFinds, { glass: 0, pearl: 0 });
  assert.equal(restoreFarm({ ...legacy, shoalCollectedToday: ['pearl'] }), undefined);
  assert.equal(restoreFarm({ ...legacy, shoalCollectedToday: ['glass', 'glass'] }), undefined);
  assert.equal(restoreFarm({ ...legacy, shellDiscoveries: [], shoalFinds: { glass: 1, pearl: 0 } }), undefined);
});
