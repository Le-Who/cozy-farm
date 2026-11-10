import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createFarm, storeTree } from '../src/farm.ts';
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
  assert.equal(next.action.target, 'visit-tree');
  assert.equal(next.action.value, '1');
  assert.match(next.label, /Верните/);
  assert.match(next.detail, /бесплатно/);
});
