import test from 'node:test';
import assert from 'node:assert/strict';
import { getNeighborSceneState, neighborFoodArt, neighborPropSettle, neighborSceneAnchors, neighborWorkFrame, stepNeighborWalker } from '../src/neighbor-scene.ts';

test('resident plans have different grounded preparation and gathering places before the player joins', () => {
  const episodes = ['beaTea', 'beaBasket', 'finnShore', 'finnLantern'] as const;
  for (const episode of episodes) {
    const plan = { episode, resident: episode.startsWith('bea') ? 'bea' as const : 'finn' as const, phase: 'preparing' as const, memoryCount: 0 };
    const scene = getNeighborSceneState(plan);
    assert.equal(scene.phase, 'preparing');
    assert.ok(Math.hypot(scene.stand.x - scene.player.x, scene.stand.y - scene.player.y) > 45);
    assert.ok(scene.prop.x > 590 && scene.prop.x < 1320);
    assert.ok(scene.groundY >= scene.prop.y);
    assert.equal(scene.width, scene.height, 'square authored prop cells keep their aspect ratio');
    assert.equal(scene.keepsake, null);
    assert.ok(getNeighborSceneState({ ...plan, memoryCount: 1 }).keepsake);
    assert.equal(getNeighborSceneState({ ...plan, phase: 'arranging' }).phase, 'gathering');
  }
  assert.notDeepEqual(neighborSceneAnchors.beaTea.stand, neighborSceneAnchors.beaBasket.stand);
  assert.notDeepEqual(neighborSceneAnchors.finnShore.stand, neighborSceneAnchors.finnLantern.stand);
});

test('walking preserves ground contacts, never overshoots a stop, and gait follows distance', () => {
  const actor = { point: { x: 0, y: 0 }, route: [{ x: 3, y: 4 }, { x: 8, y: 4 }], facingRight: false, stride: 0 };
  for (let index = 0; index < 25; index++) stepNeighborWalker(actor, .05, 20);
  assert.deepEqual(actor.point, { x: 8, y: 4 });
  assert.equal(actor.route.length, 0);
  assert.ok(Math.abs(actor.stride - 10 / 38) < 1e-9);
  const still = actor.stride;
  stepNeighborWalker(actor, 200, 20);
  assert.equal(actor.stride, still);
  assert.equal(actor.facingRight, true);
});

test('preparation is a brief authored hand sequence with settled props and quiet waits', () => {
  assert.deepEqual([0, .8, 1.3, 1.8, 2.7, 8].map(time => neighborWorkFrame(time)), [0, 1, 2, 3, 4, 0]);
  assert.equal(neighborWorkFrame(9, true), 5);
  assert.equal(neighborWorkFrame(15.8), neighborWorkFrame(.8));
  assert.ok(Math.abs(neighborPropSettle(1.3).lift) > 0);
  assert.deepEqual(neighborPropSettle(8), { lift: 0, angle: 0 });
});

test('the food shared in the village keeps the actual recipe identity', () => {
  assert.equal(neighborFoodArt('dish:honeyCake'), 'ui-honey-cake');
  assert.equal(neighborFoodArt('dish:orchardTart'), 'ui-tart');
  assert.equal(neighborFoodArt('handmade:long'), 'ui-handmade-long');
  assert.equal(neighborFoodArt('signature:1', { base: 'tart', ingredients: [{ id: 'blueberry' }] }), 'ui-blueberry-tart');
  assert.equal(neighborFoodArt('signature:2', { base: 'preserves', ingredients: [{ id: 'peach' }] }), 'ui-orchard-preserves');
});
