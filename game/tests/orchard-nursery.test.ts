import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buyAndPlantTree, createFarm, endDay, pickFruit, restoreFarm, returnNurseryTree, storeTree, treeDefinitions } from '../src/farm.ts';

test('a full orchard can grow a peach without losing any existing tree', () => {
  const farm = createFarm();
  farm.boatOwned = true;
  farm.coins = 100;
  for (const island of ['home', 'grove'] as const) {
    farm.island = island;
    for (const slot of [1, 2]) assert.equal(buyAndPlantTree(farm, slot, island === 'home' ? 'apple' : 'pear').ok, true);
  }
  farm.island = 'home';
  const original = structuredClone(farm.trees.home[0]);
  const coins = farm.coins;
  assert.equal(storeTree(farm, 0).ok, true);
  assert.equal(farm.trees.home[0], null);
  assert.equal(farm.coins, coins);
  assert.equal(buyAndPlantTree(farm, 0, 'peach').ok, true);
  for (let night = 0; night < treeDefinitions.peach.days; night++) endDay(farm);
  assert.equal(pickFruit(farm, 0).ok, true);
  assert.equal(farm.fruit.peach, 2);
  const storedId = farm.treeNursery[0].id;
  assert.equal(storeTree(farm, 0).ok, true);
  assert.equal(returnNurseryTree(farm, 0, storedId).ok, true);
  assert.deepEqual(farm.trees.home[0], original);
  assert.equal(farm.treeNursery.length, 1);
  assert.equal(farm.treeNursery[0].tree.tree, 'peach');
});

test('nursery survives saves without resetting age, ripe fruit or rare traits', () => {
  const farm = createFarm();
  farm.trees.home[0]!.trait = 'star';
  farm.trees.home[1] = { tree: 'peach', age: 1, fruitReady: 0 };
  storeTree(farm, 0);
  storeTree(farm, 1);
  const saved = JSON.parse(JSON.stringify(farm));
  const loaded = restoreFarm(saved);
  assert.ok(loaded);
  assert.deepEqual(loaded.treeNursery, farm.treeNursery);
  assert.equal(loaded.treeNurserySerial, 2);
  endDay(loaded);
  endDay(loaded);
  assert.deepEqual(loaded.treeNursery, farm.treeNursery, 'nursery growth and new fruit stay paused');
  assert.equal(returnNurseryTree(loaded, 0, 1).ok, true);
  assert.equal(pickFruit(loaded, 0).ok, true);
  assert.equal(loaded.fruit.apple, 1);
  assert.equal(loaded.variants.apple?.star, 1);
  assert.equal(returnNurseryTree(loaded, 1, 2).ok, true);
  assert.equal(loaded.trees.home[1]!.age, 1);
  endDay(loaded);
  assert.equal(loaded.trees.home[1]!.age, 2);
  assert.deepEqual(saved.treeNursery, farm.treeNursery, 'restored state never aliases the source save');
});

test('older saves gain an empty nursery and malformed nursery data is rejected intact', () => {
  const original = createFarm();
  const legacy = JSON.parse(JSON.stringify(original));
  delete legacy.treeNursery;
  delete legacy.treeNurserySerial;
  assert.deepEqual(restoreFarm(legacy)?.treeNursery, []);
  assert.equal(restoreFarm(legacy)?.treeNurserySerial, 0);
  const validTree = { tree: 'apple', age: 2, fruitReady: 2 };
  for (const [nursery, serial] of [
    [null, 0], [{}, 0], [[null], 1], [[{ id: 1, tree: null }], 1],
    [[{ id: 0, tree: validTree }], 1], [[{ id: 2, tree: validTree }], 1],
    [[{ id: 1, tree: validTree }, { id: 1, tree: validTree }], 2],
    [[{ id: 1, tree: { ...validTree, age: 3 } }], 1],
    [[{ id: 1, tree: { ...validTree, fruitReady: 0, trait: 'star' } }], 1],
    [[{ id: 1, tree: { ...validTree, tree: 'unknown' } }], 1],
    [[], -1], [[], 0.5], [[], Number.MAX_SAFE_INTEGER + 1],
  ]) {
    const saved = { ...structuredClone(original), treeNursery: nursery, treeNurserySerial: serial };
    const before = structuredClone(saved);
    assert.equal(restoreFarm(saved), undefined);
    assert.deepEqual(saved, before);
  }
});

test('repeated and invalid moves never duplicate trees, replace occupants or charge resources', () => {
  const farm = createFarm();
  farm.trees.home[1] = { tree: 'pear', age: 1, fruitReady: 0 };
  storeTree(farm, 0);
  storeTree(farm, 1);
  assert.equal(returnNurseryTree(farm, 0, 1).ok, true);
  const before = structuredClone(farm);
  for (const slot of [-1, 0.5, 3, NaN, Infinity]) {
    assert.equal(storeTree(farm, slot).ok, false);
    assert.equal(returnNurseryTree(farm, slot, 2).ok, false);
  }
  assert.equal(storeTree(farm, 1).ok, false);
  assert.equal(returnNurseryTree(farm, 0, 2).ok, false);
  assert.equal(returnNurseryTree(farm, 1, 1).ok, false, 'a stale ID must not select the next stored tree');
  assert.equal(returnNurseryTree(farm, 1, NaN).ok, false);
  assert.deepEqual(farm, before);
  storeTree(farm, 0);
  assert.equal(farm.treeNursery[1].id, 3, 'IDs never recycle after an earlier return');
  farm.island = 'cape';
  const remote = structuredClone(farm);
  assert.equal(storeTree(farm, 0).ok, false);
  assert.equal(returnNurseryTree(farm, 0, 2).ok, false);
  assert.deepEqual(farm, remote);
});

test('a nursery tree can be returned to the other orchard with the same state', () => {
  const farm = createFarm();
  farm.boatOwned = true;
  const original = structuredClone(farm.trees.home[0]);
  storeTree(farm, 0);
  farm.island = 'grove';
  assert.equal(returnNurseryTree(farm, 1, 1).ok, true);
  assert.deepEqual(farm.trees.grove[1], original);
  assert.deepEqual(farm.treeNursery, []);
  assert.ok(restoreFarm(JSON.parse(JSON.stringify(farm))));
});

test('relocation cannot refill harvested fruit or grant a second daily harvest', () => {
  const farm = createFarm();
  pickFruit(farm, 0);
  const fruit = farm.fruit.apple;
  for (let repeat = 0; repeat < 3; repeat++) {
    assert.equal(storeTree(farm, 0).ok, true);
    assert.equal(returnNurseryTree(farm, 0, farm.treeNursery[0].id).ok, true);
    assert.equal(pickFruit(farm, 0).ok, false);
  }
  assert.equal(farm.fruit.apple, fruit);
  assert.equal(farm.trees.home[0]!.fruitReady, 0);
  endDay(farm);
  assert.equal(pickFruit(farm, 0).ok, true);
  assert.equal(farm.fruit.apple, fruit + 2);
});

test('a save missing only one nursery field is rejected instead of dropping stored trees', () => {
  const farm = createFarm();
  storeTree(farm, 0);
  for (const field of ['treeNursery', 'treeNurserySerial']) {
    const saved = JSON.parse(JSON.stringify(farm));
    delete saved[field];
    const before = structuredClone(saved);
    assert.equal(restoreFarm(saved), undefined);
    assert.deepEqual(saved, before);
  }
});
