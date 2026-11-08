import assert from 'node:assert/strict';
import { test } from 'node:test';
import { exposedTrait, getClimate } from '../src/climate.ts';
import {
  collectEggs, createFarm, endDay, feedChickens, getArchive, getMarketStock, getSale, pickFruit,
  restoreFarm, sellMarketItem, sellProduce, workBed,
} from '../src/farm.ts';

test('a marked harvest, tree and nest yield one premium item each and reveal the matching archive slots', () => {
  let farm = createFarm();
  farm.day = 4;
  assert.equal(pickFruit(farm, 0).ok, true);
  assert.equal(collectEggs(farm).ok, true);
  assert.equal(feedChickens(farm).ok, true);
  for (let work = 0; work < 3; work++) assert.equal(workBed(farm, 0).ok, true);
  assert.equal(endDay(farm).ok, true);
  assert.equal(getClimate(farm.day).weather, 'rainbow');
  assert.equal(farm.beds[0].kind === 'crop' && farm.beds[0].trait, 'rainbow');
  assert.equal(farm.trees.home[0]?.trait, 'rainbow');
  assert.equal(farm.eggTrait, 'rainbow');
  assert.equal(getArchive(farm, 'orchard')[0].items.find(({ id }) => id === 'rainbow')?.discovered, false);
  const restored = restoreFarm(JSON.parse(JSON.stringify(farm)));
  assert.ok(restored);
  farm = restored;
  assert.equal(workBed(farm, 0).ok, true);
  assert.equal(pickFruit(farm, 0).ok, true);
  assert.equal(collectEggs(farm).ok, true);
  assert.equal(farm.produce.carrot, 2);
  assert.equal(farm.fruit.apple, 3);
  assert.equal(farm.eggs, 3);
  assert.deepEqual(farm.variants, { carrot: { rainbow: 1 }, apple: { rainbow: 1 }, egg: { rainbow: 1 } });
  assert.deepEqual(getArchive(farm, 'orchard')[0].items.filter(({ discovered }) => discovered).map(({ id }) => id), ['regular', 'rainbow']);
  assert.equal(pickFruit(farm, 0).ok, false);
  assert.equal(collectEggs(farm).ok, false);
});

test('variants sell individually or in bulk at a premium and keep their archive entry across reload', () => {
  const farm = createFarm();
  farm.day = 4;
  endDay(farm);
  pickFruit(farm, 0);
  farm.progress.sell = 1;
  const listing = getMarketStock(farm).find(({ key }) => key === 'variants:apple:rainbow');
  assert.equal(listing?.price, 8);
  assert.equal(listing?.count, 1);
  const before = farm.coins;
  assert.equal(sellMarketItem(farm, 'variants:apple:rainbow').ok, true);
  assert.equal(sellMarketItem(farm, 'variants:apple:rainbow').ok, false);
  assert.equal(farm.coins, before + 8);
  assert.equal(farm.fruit.apple, 1);
  const restored = restoreFarm(JSON.parse(JSON.stringify(farm)));
  assert.ok(restored?.discoveries.apple?.rainbow);
  const mixed = createFarm();
  mixed.day = 4;
  endDay(mixed);
  pickFruit(mixed, 0);
  mixed.progress.sell = 1;
  assert.deepEqual(getSale(mixed), { items: 2, coins: 12 });
  assert.equal(sellProduce(mixed).ok, true);
  assert.deepEqual(getSale(mixed), { items: 0, coins: 0 });
  assert.ok(mixed.discoveries.apple?.rainbow);
});

test('rain waters growing beds for free and the same sky is reproducible', () => {
  const farm = createFarm();
  const rainDay = Array.from({ length: 40 }, (_, index) => index + 6)
    .find(day => getClimate(day).weather === 'rain')!;
  farm.day = rainDay - 1;
  workBed(farm, 0);
  workBed(farm, 0);
  const water = farm.water;
  endDay(farm);
  assert.equal(farm.beds[0].kind === 'crop' && farm.beds[0].watered, true);
  assert.equal(farm.water, water);
  assert.equal(farm.progress.water, 0);
  assert.equal(workBed(farm, 0).ok, false);
  endDay(farm);
  assert.equal(farm.beds[0].kind === 'crop' && farm.beds[0].growth, 1);
  const skies = new Set(Array.from({ length: 50 }, (_, index) => getClimate(index + 5).weather));
  assert.deepEqual(skies, new Set(['sun', 'rain', 'snow', 'rainbow', 'stars']));
});

test('a saved eve gives the same frost or star traits after dawn and a later sky preserves them', () => {
  for (const [weather, trait] of [['snow', 'frost'], ['stars', 'star']] as const) {
    const day = Array.from({ length: 90 }, (_, index) => index + 6)
      .find(day => getClimate(day).weather === weather && exposedTrait(day, weather, 1))!;
    const eve = createFarm();
    eve.day = day - 1;
    eve.beds[0] = { kind: 'crop', crop: 'carrot', growth: 1, watered: false };
    const resumed = restoreFarm(JSON.parse(JSON.stringify(eve)));
    assert.ok(resumed);
    endDay(eve);
    endDay(resumed);
    assert.deepEqual(resumed.beds, eve.beds);
    assert.equal(resumed.beds[0].kind === 'crop' && resumed.beds[0].trait, trait);
    endDay(resumed);
    assert.equal(workBed(resumed, 0).ok, true);
    assert.equal(resumed.variants.carrot?.[trait], 1);
  }
});

test('legacy stock seeds ordinary archive entries and malformed traits are rejected', () => {
  const { variants, discoveries, eggTrait, ...oldSave } = createFarm();
  oldSave.fruit.apple = 1;
  const restored = restoreFarm(oldSave);
  assert.equal(restored?.discoveries.apple?.regular, true);
  assert.deepEqual(restored?.variants, {});
  assert.equal(restoreFarm({ ...oldSave, variants: { apple: { rainbow: -1 } } }), undefined);
  assert.equal(restoreFarm({ ...oldSave, discoveries: { apple: { frozen: true } } }), undefined);
  assert.equal(restoreFarm({ ...oldSave, eggTrait: 'star', eggsReady: 0 }), undefined);
});
