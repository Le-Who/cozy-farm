import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createFarm, endDay, maxFlockSize, moveHen, needsSeedChoice, restoreFarm, selectSeed, upgradeBuilding, packEggBasket, packEggCrate, specializeFacility, feedChickens, buyFeed} from '../src/farm.ts';
import {isHenGround} from '../src/hen-roaming.ts';

test('empty soil offers seeds only after the selected packet runs out', () => {
  const farm = createFarm();
  assert.equal(needsSeedChoice(farm, 0), false);
  farm.seeds.carrot = 0;
  assert.equal(needsSeedChoice(farm, 0), true);
  farm.beds[0] = {kind:'tilled'};
  assert.equal(needsSeedChoice(farm, 0), true);
  assert.equal(needsSeedChoice(farm, 4), false);
  assert.equal(needsSeedChoice(farm, -1), false);
  farm.seeds.cabbage = 1;
  assert.equal(selectSeed(farm, 'cabbage').ok, true);
  assert.equal(needsSeedChoice(farm, 0), false);
  farm.island = 'grove';
  farm.seeds.cabbage = 0;
  assert.equal(needsSeedChoice(farm, 0), false);
});

test('hens can stay outside their pen without spending resources or daily care', () => {
  const farm = createFarm();
  const before = {coins:farm.coins,water:farm.water,work:farm.workToday,happiness:farm.chickenHappiness};
  const destination = {x:775,y:750};
  assert.equal(moveHen(farm,0,destination).ok,true);
  assert.deepEqual(farm.henPositions[0],destination);
  destination.x = 999;
  assert.deepEqual(farm.henPositions[0],{x:775,y:750});
  assert.deepEqual({coins:farm.coins,water:farm.water,work:farm.workToday,happiness:farm.chickenHappiness},before);
  assert.deepEqual(farm.pettedChickens,[]);
  const restored = restoreFarm(JSON.parse(JSON.stringify(farm)));
  assert.deepEqual(restored?.henPositions[0],{x:775,y:750});
  endDay(farm);
  assert.deepEqual(farm.henPositions[0],{x:775,y:750});
});

test('hen positions migrate old saves and reject malformed inactive entries', () => {
  const saved = JSON.parse(JSON.stringify(createFarm()));
  delete saved.henPositions;
  assert.deepEqual(restoreFarm(saved)?.henPositions,Array(maxFlockSize).fill(null));
  for (const value of [[],null,[{x:'700',y:700},null,null,null,null],[null,null,null,null,{x:775,y:750}]]) {
    assert.equal(restoreFarm({...saved,henPositions:value}),undefined);
  }
  saved.henPositions = [{x:0,y:0},null,null,null,null];
  const restored = restoreFarm(saved)!;
  assert.ok(isHenGround(restored.henPositions[0]!,restored.buildingLevels));
});

test('unsafe drops and building expansion keep hens on valid land', () => {
  const farm = createFarm();
  assert.equal(moveHen(farm,0,{x:0,y:0}).ok,true);
  assert.ok(isHenGround(farm.henPositions[0]!,farm.buildingLevels));
  assert.equal(moveHen(farm,0,{x:610,y:320}).ok,true);
  farm.coins = 1000;
  assert.equal(upgradeBuilding(farm,'well').ok,true);
  assert.ok(isHenGround(farm.henPositions[0]!,farm.buildingLevels));
  const positions = structuredClone(farm.henPositions);
  assert.equal(moveHen(farm,4,{x:775,y:750}).ok,false);
  assert.equal(moveHen(farm,0,{x:NaN,y:750}).ok,false);
  farm.island = 'grove';
  assert.equal(moveHen(farm,0,{x:775,y:750}).ok,false);
  assert.deepEqual(farm.henPositions,positions);
});

test('egg baskets require level two while crates belong to the Packing House', () => {
  const farm=createFarm();farm.coins=1000;farm.eggs=30;
  assert.equal(packEggBasket(farm).ok,false);
  assert.equal(packEggCrate(farm).ok,false);
  assert.equal(upgradeBuilding(farm,'coop').ok,true);
  assert.equal(packEggBasket(farm).ok,true);
  assert.equal(packEggCrate(farm).ok,false);
  assert.equal(specializeFacility(farm,'packing').ok,true);
  assert.equal(packEggCrate(farm).ok,true);
  assert.ok(restoreFarm(JSON.parse(JSON.stringify(farm))));
});

test('buying feed does not feed automatically, and one meal enables morning eggs', () => {
  const farm=createFarm();farm.feed=0;farm.eggsReady=0;
  endDay(farm);
  assert.equal(farm.eggsReady,0);
  assert.equal(buyFeed(farm).ok,true);
  assert.equal(farm.chickensFed,false);
  assert.equal(feedChickens(farm).ok,true);
  assert.equal(feedChickens(farm).ok,false);
  endDay(farm);
  assert.equal(farm.eggsReady,3);
  assert.equal(farm.chickensFed,false);
});
