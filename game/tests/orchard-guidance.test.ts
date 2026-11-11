import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createFarm, storeTree, returnNurseryTree, getTreeAction } from '../src/farm.ts';
import { getSupplyGuidance } from '../src/discovery-path.ts';
import { getRequirementHint } from '../src/requirement-guidance.ts';

const peach = { kind: 'fruit', item: 'peach', quantity: 1 } as const;

test('a missing peach in a full orchard leads to safe relocation, not occupied planting', () => {
  const farm = createFarm();
  farm.boatOwned = true;
  for (const island of ['home', 'grove'] as const) farm.trees[island] = Array.from({ length: 3 }, () => ({ tree: 'apple', age: 2, fruitReady: 2 }));
  const before = structuredClone(farm);
  const task = getSupplyGuidance(farm, peach, 'парфе');
  assert.equal(task.action.target, 'orchard');
  assert.match(task.detail, /питомник/);
  assert.equal(getRequirementHint(farm, { kind: 'stock', item: peach }).action.target, 'orchard');
  assert.match(getRequirementHint(farm, { kind: 'stock', item: peach }).notice!, /питомник/);
  assert.deepEqual(farm, before);
});

test('fruit guidance finds trees on their actual island after relocation', () => {
  const farm = createFarm();
  farm.boatOwned = true;
  farm.trees.grove[1] = { tree: 'peach', age: 3, fruitReady: 2 };
  assert.equal(getRequirementHint(farm, { kind: 'stock', item: peach }).action.value, 'grove');
  farm.island = 'grove';
  assert.deepEqual(getSupplyGuidance(farm, peach, 'парфе').action, { label: 'К плодовому дереву', target: 'visit-tree', value: '1' });
  farm.trees.grove[1]!.fruitReady = 0;
  assert.equal(getRequirementHint(farm, { kind: 'stock', item: peach }).action.value, 'home');
  farm.island = 'home';
  assert.equal(getRequirementHint(farm, { kind: 'stock', item: peach }).action.value, 'farmhouse');
});

test('nursery trees are returned before asking for another purchase', () => {
  const farm = createFarm();
  farm.coins = 0;
  farm.trees.home[1] = { tree: 'peach', age: 3, fruitReady: 2 };
  storeTree(farm, 1);
  const next = getSupplyGuidance(farm, peach, 'парфе');
  assert.equal(next.action.target, 'orchard');
  assert.equal(next.action.value, '1');
  assert.match(next.label, /Верните/);
  assert.match(next.detail, /бесплатно/);
});

test('ripe nursery fruit comes before waiting for an orchard tree of the same kind', () => {
  const farm = createFarm();
  farm.trees.home[0] = { tree: 'peach', age: 0, fruitReady: 0 };
  farm.trees.home[1] = { tree: 'peach', age: 3, fruitReady: 2 };
  assert.equal(storeTree(farm, 1).ok, true);
  const before = structuredClone(farm);
  const next = getSupplyGuidance(farm, peach, 'парфе');
  assert.equal(next.action.target, 'orchard');
  assert.equal(next.action.value, '1');
  assert.match(next.label, /Верните/);
  assert.match(next.detail, /бесплатно/);
  assert.equal(getRequirementHint(farm, { kind: 'stock', item: peach }).action.target, 'orchard');
  assert.deepEqual(farm, before);
});

test('ripe nursery guidance frees space first and leaves ready orchard fruit as the first choice', () => {
  const farm = createFarm(); farm.boatOwned = true;
  farm.trees.home[1] = { tree: 'peach', age: 3, fruitReady: 2 };
  assert.equal(storeTree(farm, 1).ok, true);
  for (const island of ['home', 'grove'] as const) farm.trees[island] = Array.from({ length: 3 }, () => ({ tree: 'peach', age: 0, fruitReady: 0 }));
  assert.equal(getSupplyGuidance(farm, peach, 'парфе').action.target, 'orchard');
  assert.match(getRequirementHint(farm, { kind: 'stock', item: peach }).notice!, /питомник/);
  farm.trees.grove[2] = null;
  assert.equal(getSupplyGuidance(farm, peach, 'парфе').action.value, 'grove');
  farm.island = 'grove';
  assert.equal(getSupplyGuidance(farm, peach, 'парфе').action.value, String(farm.treeNursery[0].id));
  assert.equal(returnNurseryTree(farm, 2, farm.treeNursery[0].id).ok, true);
  assert.equal(getTreeAction(farm, 2).kind, 'pick');
  farm.island = 'home';
  assert.equal(getSupplyGuidance(farm, peach, 'парфе').action.value, 'grove');
  farm.island = 'grove';
  assert.deepEqual(getSupplyGuidance(farm, peach, 'парфе').action, { label: 'К плодовому дереву', target: 'visit-tree', value: '2' });
});
