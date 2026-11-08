import assert from 'node:assert/strict';
import { test } from 'node:test';
import { castFishing, createFishingModel, fishPosition, reelFishing, stepFishing, fishingLootAtDepth, fishingCatchMouth, fishingCatchScale } from '../src/fishing-model.ts';

test('fishing catches only on ascent and never duplicates or exceeds capacity', () => {
  const model = createFishingModel(1);
  model.fish = [{ id: 0, x: -.68, direction: 1, depth: 5, rare: false }, { id: 1, x: -.68, direction: 1, depth: 5, rare: false }];
  castFishing(model);
  model.depth = 4.8;
  stepFishing(model, .01);
  assert.equal(model.caught.length, 0);
  reelFishing(model);
  stepFishing(model, .01);
  stepFishing(model, .01);
  assert.deepEqual(model.caught, [0]);
});

test('two fish contacts reverse the descent and a finished cast stays finished', () => {
  const model = createFishingModel(3);
  model.fish = [{ id: 0, x: 0, direction: 1, depth: .2, rare: false }];
  castFishing(model);
  stepFishing(model, .01);
  assert.equal(model.contacts, 1);
  model.immunity = 0;
  stepFishing(model, .01);
  assert.equal(model.phase, 'ascending');
  for (let i = 0; i < 10; i++) stepFishing(model, .05);
  assert.equal(model.phase, 'done');
  castFishing(model);
  reelFishing(model);
  stepFishing(model, 10);
  assert.equal(model.phase, 'done');
  assert.equal(model.depth, 0);
});

test('the rear body misses while the front body catches', () => {
  const model = createFishingModel(3);
  model.fish = [{ id: 0, x: 0, direction: 1, depth: 5, rare: false }];
  model.depth = 5.1;
  model.phase = 'ascending';
  stepFishing(model, .01);
  assert.equal(model.caught.length, 0);
  model.x = model.targetX = .3;
  stepFishing(model, .01);
  assert.deepEqual(model.caught, [0]);
});

test('the front half volume catches at the body and mouth for each species, facing and size', () => {
  const fronts = { perch: [.12, .4, .74], seaBass: [.12, .4, .74], moonfish: [.2, .5, .82], lanternfish: [.1, .4, .68] };
  for (const species of ['perch', 'seaBass', 'moonfish', 'lanternfish'] as const) {
    for (const direction of [-1, 1]) for (const id of [0, 1]) for (const at of fronts[species]) for (const vertical of [-.12, .12]) {
      const rare = species === 'moonfish' || species === 'lanternfish';
      const fish = { id, x: 0, direction, depth: 5, rare,
        loot: { kind: 'fish' as const, species, variant: rare ? 'rare' as const : 'regular' as const } };
      const scale = fishingCatchScale(fish), mouth = fishingCatchMouth(fish);
      const model = createFishingModel(1); model.fish = [fish]; model.phase = 'ascending';
      model.x = model.targetX = direction * at * scale;
      model.depth = fish.depth + mouth.depth + vertical * scale;
      stepFishing(model, .001);
      assert.deepEqual(model.caught, [id], `${species}, facing ${direction}, size ${scale}, body position ${at}, height ${vertical}`);
    }
  }
});

test('tails and water above the body stay outside the forgiving catch region', () => {
  for (const species of ['perch', 'seaBass', 'moonfish', 'lanternfish'] as const) for (const direction of [-1, 1]) {
    const fish = { id: 1, x: 0, direction, depth: 5, rare: species === 'moonfish' || species === 'lanternfish',
      loot: { kind: 'fish' as const, species, variant: 'regular' as const } };
    for (const [horizontal, vertical] of [[-.45, 0], [.4, -1]]) {
      const model = createFishingModel(1); model.fish = [fish]; model.phase = 'ascending';
      model.x = model.targetX = direction * horizontal;
      model.depth = fish.depth + vertical;
      stepFishing(model, .01);
      assert.deepEqual(model.caught, [], `${species}, facing ${direction}, rejected position ${horizontal},${vertical}`);
    }
  }
});

test('a rapid sideways sweep catches the front half even with both frame endpoints outside it', () => {
  for (const direction of [-1, 1]) {
    const model = createFishingModel(1); model.phase = 'ascending'; model.depth = 5.2;
    model.fish = [{ id: 1, x: 0, direction, depth: 5, rare: false }];
    model.x = direction * -.9; model.targetX = direction * 3;
    stepFishing(model, .05);
    assert.ok(Math.abs(model.x) > .9, 'the hook ends beyond the mouth');
    assert.deepEqual(model.caught, [1]);
  }
});

test('a fast vertical ascent does not skip a fish between frames', () => {
  const model = createFishingModel(1); model.phase = 'ascending'; model.depth = 5.6;
  model.fish = [{ id: 1, x: 0, direction: 1, depth: 5, rare: false }];
  model.x = model.targetX = .4; model.ascentSpeed = 25;
  stepFishing(model, .05);
  assert.ok(model.depth < 4.7);
  assert.deepEqual(model.caught, [1]);
});

test('swept captures take the first crossed fish when only one hook space remains', () => {
  const model = createFishingModel(1); model.phase = 'ascending'; model.depth = 6;
  model.fish = [
    { id: 1, x: 0, direction: 1, depth: 5.2, rare: false },
    { id: 2, x: 0, direction: 1, depth: 5.6, rare: false },
  ];
  model.x = model.targetX = .4; model.ascentSpeed = 25;
  stepFishing(model, .05);
  assert.deepEqual(model.caught, [2]);
});

test('fish wrapping outside the play field cannot create a phantom capture across the screen', () => {
  for (const direction of [-1, 1]) {
    const model = createFishingModel(1); model.phase = 'ascending'; model.depth = 5.1;
    model.fish = [{ id: 1, x: direction * 7.497, direction, depth: 5, rare: false }];
    model.x = model.targetX = direction * .4;
    stepFishing(model, .05);
    assert.deepEqual(model.caught, []);
  }
});

test('a full hook accelerates smoothly and reaches the surface about three times sooner', () => {
  const full = createFishingModel(2), empty = createFishingModel(2);
  for (const model of [full, empty]) { model.phase = 'ascending'; model.depth = 30; model.fish = []; }
  full.caught = [0, 1];
  const normalSpeed = full.ascentSpeed;
  stepFishing(full, .05); stepFishing(empty, .05);
  assert.ok(full.ascentSpeed > normalSpeed && full.ascentSpeed < normalSpeed * 2, 'acceleration has no instant speed jump');
  for (let i = 1; i < 60; i++) { stepFishing(full, .05); stepFishing(empty, .05); }
  assert.equal(full.phase, 'done'); assert.equal(full.depth, 0);
  assert.ok(empty.depth > 19, 'ordinary ascent still takes about nine seconds');
  const finished = structuredClone(full);
  for (let i = 0; i < 50; i++) stepFishing(full, .05);
  assert.deepEqual(full, finished, 'finished casts cannot change or collect again');
});

test('flipped fish expose their head on the matching side while swimming', () => {
  for (const direction of [-1, 1]) {
    const model = createFishingModel(1);
    model.fish = [{ id: 0, x: 0, direction, depth: 5, rare: false }];
    model.depth = 5.1;
    model.phase = 'ascending';
    model.x = model.targetX = direction * .68;
    stepFishing(model, .01);
    assert.deepEqual(model.caught, [0]);
  }
});

test('one continuous fish contact cannot consume both chances', () => {
  const model = createFishingModel(3);
  model.fish = [{ id: 0, x: 0, direction: 1, depth: .2, rare: false }];
  castFishing(model);
  for (let i = 0; i < 5; i++) stepFishing(model, .01);
  assert.equal(model.contacts, 1);
  assert.equal(model.phase, 'descending');
});

test('steering and elapsed time are bounded and seeded fields are repeatable', () => {
  const model = createFishingModel(4, 2, 44);
  assert.deepEqual(model.fish, createFishingModel(4, 2, 44).fish);
  model.targetX = 1e4;
  castFishing(model);
  stepFishing(model, 1e4);
  assert.ok(model.depth < 1);
  assert.ok(model.x <= 3.9);
  stepFishing(model, Number.NaN);
  assert.ok(Number.isFinite(model.x));
});

test('fish swim forward in their facing direction and wrap outside the viewport', () => {
  for (const direction of [-1, 1]) {
    const fish = { id: 0, x: 0, direction, depth: 5, rare: false };
    assert.equal(Math.sign(fishPosition(fish, 2) - fishPosition(fish, 1)), direction);
    const exiting = { ...fish, x: direction * 7.45 };
    const wrapped = fishPosition(exiting, 1);
    assert.equal(Math.sign(wrapped), -direction);
    assert.ok(Math.abs(wrapped) > 6);
  }
});

test('depth changes the loot odds and keeps unique species out of the shallows', () => {
  let shallowRare = 0, deepRare = 0;
  for (let roll = 0; roll < 1; roll += .001) {
    const shallow = fishingLootAtDepth(5, roll);
    const deep = fishingLootAtDepth(29, roll);
    if (shallow.kind === 'fish' && shallow.variant === 'rare') shallowRare++;
    if (deep.kind === 'fish' && deep.variant === 'rare') deepRare++;
  }
  assert.equal(shallowRare, 0);
  assert.ok(deepRare > 300);
  assert.deepEqual(fishingLootAtDepth(20, .99), { kind: 'fish', species: 'moonfish', variant: 'rare' });
  assert.deepEqual(fishingLootAtDepth(29, .99), { kind: 'fish', species: 'lanternfish', variant: 'rare' });
  assert.deepEqual(fishingLootAtDepth(3, .05), { kind: 'junk', item: 'weed' });
  assert.deepEqual(fishingLootAtDepth(15, .05), { kind: 'junk', item: 'boot' });
  assert.deepEqual(fishingLootAtDepth(29, .02), { kind: 'junk', item: 'rock' });
  assert.deepEqual(fishingLootAtDepth(29, .07), { kind: 'shell', variant: 'moon' });
  const rolls=Array.from({length:1000},(_,i)=>i/1000);
  const shallowJunk=rolls.filter(roll=>fishingLootAtDepth(3,roll).kind==='junk').length;
  const deepJunk=rolls.filter(roll=>fishingLootAtDepth(29,roll).kind==='junk').length;
  assert.ok(deepJunk<shallowJunk/3,'deep water has substantially less litter');
});

test('seeded casts have room between finds and preserve their regional common fish', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const model = createFishingModel(2, 2, seed, 'seaBass');
    assert.ok(model.fish.length <= 18);
    assert.deepEqual(model.fish, createFishingModel(2, 2, seed, 'seaBass').fish);
    assert.ok(model.fish.every((fish, i) => i === 0 || fish.depth - model.fish[i - 1].depth > .85));
    assert.ok(model.fish.every(fish => fish.loot?.kind !== 'fish' || fish.loot.variant === 'rare' || fish.loot.species === 'seaBass'));
  }
});

test('shells and junk fill real hook slots on ascent without swimming or damaging the descent', () => {
  const model = createFishingModel(2);
  model.fish = [
    { id: 0, x: 0, depth: 5, direction: 1, rare: false, loot: { kind: 'junk', item: 'boot' } },
    { id: 1, x: 0, depth: 5, direction: -1, rare: false, loot: { kind: 'shell', variant: 'regular' } },
  ];
  castFishing(model); model.depth = 4.9;
  stepFishing(model, .01);
  assert.equal(model.contacts, 0); assert.equal(model.caught.length, 0);
  assert.equal(fishPosition(model.fish[0], 100), 0);
  reelFishing(model); stepFishing(model, .01);
  assert.deepEqual(model.caught, [0, 1]);
});

test('little fish warn before a forward dart and steering away avoids the contact', () => {
  const model = createFishingModel(2);
  model.fish = [{ id: 0, x: -1.4, depth: 3.2, direction: 1, rare: false,
    loot: { kind: 'fish', species: 'perch', variant: 'regular' } }];
  model.nextDartAt = 0; castFishing(model); stepFishing(model, .01);
  const fish = model.fish[0];
  assert.equal(fish.dart?.phase, 'warning');
  assert.equal(fish.dart?.offset, 0);
  model.x = model.targetX = 1.8;
  for (let i = 0; i < 14; i++) stepFishing(model, .05);
  assert.equal(fish.dart?.phase, 'warning');
  let previous = fishPosition(fish, model.time);
  for (let i = 0; i < 80; i++) {
    stepFishing(model, .05);
    const current = fishPosition(fish, model.time);
    assert.ok(current >= previous - 1e-8, 'the fish always moves in its facing direction');
    previous = current;
  }
  assert.equal(model.contacts, 0);
  assert.equal(fish.dart, undefined);
  assert.ok(model.nextDartAt >= 4.5);
});

test('new species capture at their illustrated mouth in either direction', () => {
  for (const species of ['moonfish', 'lanternfish'] as const) for (const direction of [-1, 1]) {
    const model = createFishingModel(1);
    const fish = { id: 0, x: 0, direction, depth: 8, rare: true,
      loot: { kind: 'fish' as const, species, variant: 'rare' as const } };
    model.fish = [fish]; model.phase = 'ascending';
    const mouth = fishingCatchMouth(fish);
    model.x = model.targetX = mouth.x;
    model.depth = fish.depth + mouth.depth;
    stepFishing(model, .01);
    assert.deepEqual(model.caught, [0]);
  }
});
