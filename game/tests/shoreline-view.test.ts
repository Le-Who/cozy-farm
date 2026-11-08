import test from 'node:test';
import assert from 'node:assert/strict';
import { createShoreline, covePresets, getCoveEcology, settleCove } from '../src/shoreline.ts';
import { coveChannelPoint, createCoveMotion, stepCoveMotion } from '../src/shoreline-view.ts';

const ecology = (preset: keyof typeof covePresets) => getCoveEcology(settleCove({ ...createShoreline(), pending: { ...covePresets[preset] } }, 2), 2);
const observer = { x: 1000, y: 600 };

test('an open channel carries minnows forward and lets the egret wade and probe', () => {
  const state = createCoveMotion(), habitat = ecology('channel');
  let forward = 0, probes = 0, wading = 0;
  for (let i = 0; i < 1600; i++) {
    stepCoveMotion(state, habitat, .05, observer);
    for (const fish of state.minnows) if (fish.opacity > .5) {
      assert.equal(fish.flip, fish.x < fish.previousX);
      if (fish.x > fish.previousX) forward++;
    }
    if (state.egret.frame === 2) probes++;
    if (state.egret.y > 700) wading++;
  }
  assert.ok(forward > 1000);
  assert.ok(probes > 20);
  assert.ok(wading > 20);
  assert.ok(coveChannelPoint(1).x > coveChannelPoint(0).x + 150);
});

test('sheltered kelp keeps a compact school and a patient egret while stone crabs hide and return', () => {
  const nursery = createCoveMotion(), habitat = ecology('nursery');
  let minX = Infinity, maxX = -Infinity;
  for (let i = 0; i < 800; i++) {
    stepCoveMotion(nursery, habitat, .05, observer);
    if (i > 200) for (const fish of nursery.minnows) { minX = Math.min(minX, fish.x); maxX = Math.max(maxX, fish.x); }
    assert.equal(nursery.egret.frame === 2, false);
  }
  assert.ok(maxX - minX < 90);
  assert.equal(nursery.minnows.filter(fish => fish.opacity > 0).length, 7);
  const stones = createCoveMotion(), channel = ecology('channel');
  let hidden = false, visible = false;
  for (let i = 0; i < 1400; i++) {
    stepCoveMotion(stones, channel, .05, observer);
    hidden ||= stones.crab.opacity < .6;
    visible ||= stones.crab.opacity === 1;
  }
  assert.ok(hidden && visible);
});

test('reduced motion has stable animal poses and moving observers cause only temporary retreat', () => {
  const state = createCoveMotion(), habitat = ecology('channel');
  stepCoveMotion(state, habitat, .05, observer, true);
  const still = structuredClone(state);
  for (let i = 0; i < 40; i++) stepCoveMotion(state, habitat, .05, observer, true);
  assert.deepEqual(state.egret, still.egret);
  assert.equal(state.time, 0);
  const live = createCoveMotion();
  const nearby = { x: 1330, y: 680 };
  stepCoveMotion(live, habitat, .05, nearby);
  assert.equal(live.egret.frame, 3);
  for (let i = 0; i < 100; i++) stepCoveMotion(live, habitat, .05, nearby);
  assert.notEqual(live.egret.frame, 3);
});
