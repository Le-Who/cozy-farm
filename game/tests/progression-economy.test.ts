import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buySeeds, catchFish, createFarm, endDay, pickFruit, refillWater, restoreFarm,
  selectSeed, sellProduce, workBed,
} from '../src/farm.ts';
import { getCoinGuidance } from '../src/discovery-path.ts';
import { setBayShopPrice, stockBayShop } from '../src/bay-shop-model.ts';

function depletedFarm() {
  const farm = createFarm();
  farm.coins = 0; farm.feed = 0; farm.eggsReady = 0;
  for (const crop of Object.keys(farm.seeds) as (keyof typeof farm.seeds)[]) farm.seeds[crop] = 0;
  farm.beds = farm.beds.map(() => ({ kind: 'empty' }));
  // Exclude one-time tutorial payments from recurring income.
  farm.progress = {till:1,plant:1,water:1,rest:1,harvest:3,sell:1,feed:1,collect:1};
  return farm;
}

test('a save with no coins, seeds or feed recovers through free fruit and fishing', () => {
  const farm = depletedFarm();
  assert.ok(restoreFarm(JSON.parse(JSON.stringify(farm))));
  assert.equal(getCoinGuidance(farm, 4, 'семена').action.target, 'visit-tree');
  assert.equal(pickFruit(farm, 0).ok, true);
  for (let cast = 0; cast < 3; cast++) assert.equal(catchFish(farm, true).ok, true);
  assert.equal(catchFish(farm, true).ok, false);
  assert.equal(sellProduce(farm).ok, true);
  assert.equal(farm.coins, 23); // Two apples at four, three perch at five.
  assert.equal(sellProduce(farm).ok, false);
  assert.equal(buySeeds(farm, 'carrot').ok, true);
  assert.equal(farm.coins, 19);
  assert.equal(farm.seeds.carrot, 3);
  assert.ok(restoreFarm(JSON.parse(JSON.stringify(farm))));
});

test('one carrot bed pays for its next seed packet without daily fishing or orders', () => {
  const farm = depletedFarm(); farm.coins = 4;
  assert.equal(buySeeds(farm, 'carrot').ok, true);
  assert.equal(selectSeed(farm, 'carrot').ok, true);
  assert.equal(workBed(farm, 0).ok, true);
  for (let harvest = 0; harvest < 3; harvest++) {
    assert.equal(workBed(farm, 0).ok, true);
    if (farm.water === 0) assert.equal(refillWater(farm).ok, true);
    assert.equal(workBed(farm, 0).ok, true);
    assert.equal(endDay(farm).ok, true);
    assert.equal(workBed(farm, 0).ok, true);
    assert.equal(sellProduce(farm).ok, true);
  }
  assert.equal(farm.coins, 18); // One packet costs four; three harvests return eighteen.
  assert.equal(farm.seeds.carrot, 0);
  assert.equal(buySeeds(farm, 'carrot').ok, true);
  assert.equal(farm.coins, 14);
  assert.ok(restoreFarm(JSON.parse(JSON.stringify(farm))));
});

test('restoring a shop updates old base prices while preserving a chosen shelf price', () => {
  const farm = createFarm();
  const bun = { id:'handmade:round', identity:'handmade:round', name:'Круглая булочка',
    image:'/art/lavender/ui-tart.webp', basePrice:18, tags:['bread'] };
  assert.equal(stockBayShop(farm.bayShop, 0, bun, 2), true);
  assert.equal(setBayShopPrice(farm.bayShop, 0, 27), true);
  const restored = restoreFarm(JSON.parse(JSON.stringify(farm)));
  assert.ok(restored);
  assert.equal(restored.bayShop.slots[0]?.product.basePrice, 20);
  assert.equal(restored.bayShop.slots[0]?.price, 27);
  assert.equal(restored.bayShop.slots[0]?.quantity, 2);
});

test('pumpkin and blueberry can grow through a three-night trip after one watering', () => {
  for (const crop of ['pumpkin','blueberry','tomato'] as const) {
    let farm = createFarm();
    farm.beds[0] = {kind:'tilled'};
    assert.ok(buySeeds(farm,crop).ok && selectSeed(farm,crop).ok);
    assert.ok(workBed(farm,0).ok);
    assert.ok(endDay(farm).ok);
    assert.equal(farm.beds[0].kind==='crop' && farm.beds[0].growth,0);
    assert.ok(workBed(farm,0).ok);
    for (let night=0; night<3; night++) {
      assert.ok(endDay(farm).ok);
      farm = restoreFarm(JSON.parse(JSON.stringify(farm)))!;
      assert.ok(farm);
    }
    assert.equal(farm.beds[0].kind==='crop' && farm.beds[0].growth,crop==='tomato' ? 1 : 3);
  }
});
