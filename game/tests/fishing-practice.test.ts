import assert from 'node:assert/strict';
import { test } from 'node:test';
import { beginFishingTrip, createFarm, finishFishingTrip, getFishAction, getFishLimit, getProject, restoreFarm, type FarmState } from '../src/farm.ts';
import { canPracticeFishing, createFishingPractice } from '../src/fishing-practice.ts';
import { createFishingModel, castFishing, reelFishing, stepFishing, fishingCatchLoot, type FishingLoot } from '../src/fishing-model.ts';

function exhausted(island: 'home' | 'grove' = 'home'): FarmState {
  const farm = createFarm();
  farm.island = island;
  farm.fishCaughtToday[island] = getFishLimit(farm);
  farm.village.scouting = true;
  farm.culinary.picnic = { processing: 'bright', day: farm.day };
  farm.culinary.tastings.finn = { ...farm.culinary.tastings.finn, servedOn: farm.day, visits: 1, liked: 1, bonus: true };
  farm.neighbors.finn.helpReady = true;
  return farm;
}
const loot: FishingLoot[] = [
  { kind: 'fish', species: 'moonfish', variant: 'rare' },
  { kind: 'shell', variant: 'moon' },
  { kind: 'junk', item: 'boot' },
];

function freezeDeep(value: unknown): void {
  if (value && typeof value === 'object') { Object.freeze(value); for (const child of Object.values(value)) freezeDeep(child); }
}

test('practice requires the local daily quota, a fishing island and no pending reward trip', () => {
  const farm = createFarm();
  assert.equal(createFishingPractice(farm), undefined);
  farm.fishCaughtToday.home = getFishLimit(farm);
  assert.equal(canPracticeFishing(farm), true);
  farm.island = 'grove';
  assert.equal(createFishingPractice(farm), undefined, 'another island quota does not unlock practice here');
  for (const island of ['cape', 'village'] as const) { farm.island = island; assert.equal(createFishingPractice(farm), undefined); }
  farm.island = 'grove';
  const trip = beginFishingTrip(farm); assert.equal(trip.ok, true);
  farm.fishCaughtToday.grove = getFishLimit(farm);
  const before = structuredClone(farm);
  assert.equal(createFishingPractice(farm), undefined, 'never steal or cancel a pending rewarded cast');
  assert.deepEqual(farm, before);
});

test('the completed grove dock keeps its extra rewarded catch before practice unlocks', () => {
  const farm = exhausted('grove');
  for (const { item } of getProject(farm, 'dock').items) farm.projects.dock['item' in item ? `${item.kind}:${item.item}` : item.kind] = item.quantity;
  assert.equal(getFishLimit(farm), 4);
  assert.equal(createFishingPractice(farm), undefined);
  assert.equal(getFishAction(farm).available, true);
  farm.fishCaughtToday.grove = 4;
  assert.equal(canPracticeFishing(farm), true);
});

for (const island of ['home', 'grove'] as const) test(`${island}: successful practice cannot change any farm state or consume bonuses`, () => {
  const farm = exhausted(island), before = structuredClone(farm);
  freezeDeep(farm);
  const session = createFishingPractice(farm)!;
  assert.equal(session.fish, island === 'grove' ? 'seaBass' : 'perch');
  assert.equal(session.config.capacity, 4);
  assert.equal(session.config.resilience, 5);
  assert.equal(session.finish(loot), false, 'no finish before the cast');
  assert.equal(session.cast(), true);
  assert.equal(session.cast(), false);
  assert.equal(session.finish(loot), true);
  assert.equal(session.finish(loot), false, 'duplicate finish cannot be applied');
  session.cancel();
  assert.deepEqual(farm, before, 'inventory, discoveries, festivals, work, serial, bonuses and save fields stay identical');
  assert.equal(getFishAction(farm).available, false);
});

test('leaving before or during a cast invalidates all old callbacks without affecting the next session', () => {
  for (const cast of [false, true]) {
    const farm = exhausted(), before = structuredClone(farm);
    const old = createFishingPractice(farm)!;
    if (cast) old.cast();
    old.cancel();
    const next = createFishingPractice(farm)!;
    assert.equal(next.cast(), true);
    assert.equal(old.cast(), false);
    assert.equal(old.finish(loot), false);
    old.cancel();
    assert.equal(next.finish(loot), true);
    assert.deepEqual(farm, before);
  }
});

test('reload during practice has no pending reward token and cannot turn a practice catch into rewards', () => {
  const farm = createFarm(); farm.fishCaughtToday.home = getFishLimit(farm);
  const baseline = JSON.stringify(farm);
  const old = createFishingPractice(farm)!; old.cast();
  const restored = restoreFarm(JSON.parse(JSON.stringify(farm)));
  assert.ok(restored);
  assert.equal(restored.pendingFishingTrip, null);
  assert.equal(JSON.stringify(farm), baseline);
  const before = structuredClone(restored);
  const next = createFishingPractice(restored)!;
  assert.equal(next.cast(), true);
  old.finish(loot);
  next.finish(loot);
  next.cancel();
  assert.equal(finishFishingTrip(restored, restored.fishingTripSerial + 1, loot).ok, false);
  assert.equal(beginFishingTrip(restored).ok, false, 'rewarded quota remains exhausted after reload');
  assert.deepEqual(restored, before);
});

test('actual model catches and empty casts are discarded equally in practice', () => {
  for (const catches of [true, false]) {
    const farm = exhausted(), before = structuredClone(farm), session = createFishingPractice(farm)!;
    const model = createFishingModel(session.config.capacity, session.config.resilience, session.seed, session.fish);
    model.fish = catches ? loot.map((item, id) => ({ id, x: -.6, depth: 5, direction: 1 as const, rare: false, loot: item })) : [];
    assert.equal(session.cast(), true);
    castFishing(model); model.depth = 4.8; stepFishing(model, .01); reelFishing(model);
    for (let i = 0; i < 500 && model.phase !== 'done'; i++) stepFishing(model, .05);
    assert.equal(model.phase, 'done');
    const result = model.caught.map(id => fishingCatchLoot(model.fish.find(item => item.id === id)!, session.fish));
    if (catches) assert.ok(result.length > 0);
    else assert.equal(result.length, 0);
    assert.equal(session.finish(result), true);
    assert.deepEqual(farm, before);
  }
});

test('practice snapshot remains separate from farm configuration and ordinary fishing keeps its rewards', () => {
  const farm = exhausted(), before = structuredClone(farm);
  const practice = createFishingPractice(farm)!;
  practice.config.capacity = 100;
  assert.deepEqual(farm, before);
  practice.cast(); practice.cancel();
  farm.fishCaughtToday.home = 0;
  const trip = beginFishingTrip(farm); assert.equal(trip.ok, true);
  const pending = structuredClone(farm);
  assert.equal(practice.finish(loot), false, 'stale practice cannot finish a new normal trip');
  assert.deepEqual(farm, pending);
  assert.equal(finishFishingTrip(farm, trip.token!, [{ kind: 'fish', species: 'perch', variant: 'regular' }]).ok, true);
  assert.equal(farm.fish.perch, before.fish.perch + 1);
  assert.equal(farm.fishCaughtToday.home, 1);
  assert.equal(farm.workToday, before.workToday + 1);
});

test('quota UI offers an explicit practice-only entry and shore exit, never a rewarded cast', async () => {
  const { renderFishingPracticeEntry } = await import('../src/fishing-practice-ui.ts');
  const fresh = createFarm();
  assert.equal(renderFishingPracticeEntry(fresh), '');
  const farm = exhausted(), before = structuredClone(farm);
  const html = renderFishingPracticeEntry(farm);
  assert.match(html, /data-action="fishing-practice">Тренироваться без наград/);
  assert.match(html, /data-action="close">На берег/);
  assert.match(html, /без улова, опыта и прогресса/);
  assert.doesNotMatch(html, /Закинуть удочку/);
  assert.deepEqual(farm, before);
});
