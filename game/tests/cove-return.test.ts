import assert from 'node:assert/strict';
import { test } from 'node:test';
import { beginFishingTrip, cancelCovePlan, changeCove, createFarm, endDay, getCoveActions, getCoveHabitat, restoreFarm } from '../src/farm.ts';
import { covePlanKey, covePresets, getCoveEcology, getCoveForecast } from '../src/shoreline.ts';

function cove() {
  const farm = createFarm(); farm.boatOwned = true; farm.shellDiscoveries = ['regular']; farm.island = 'grove';
  return farm;
}
function morning(farm: ReturnType<typeof createFarm>) {
  farm.island = 'home'; const result = endDay(farm); farm.island = 'grove'; return result;
}
function reload(farm: ReturnType<typeof createFarm>) {
  const restored = restoreFarm(JSON.parse(JSON.stringify(farm))); assert.ok(restored); return restored;
}

test('cancel an initial pending plan without resources, observations, work or habitat changes', () => {
  const farm = cove(); farm.fishCaughtToday.grove = 1; farm.shellsCollectedToday = [0];
  assert.equal(changeCove(farm, covePresets.channel).ok, true);
  const before = structuredClone(farm), key = covePlanKey(farm.shoreline);
  assert.equal(getCoveActions(farm).canCancel, true);
  assert.equal(cancelCovePlan(farm, key).ok, true);
  before.shoreline.pending = null;
  assert.deepEqual(farm, before, 'only the still-pending plan is removed');
  assert.equal(getCoveHabitat(farm), undefined);
  assert.equal(getCoveActions(farm).canCancel, false);
  assert.equal(cancelCovePlan(farm, key).ok, false);
  assert.deepEqual(farm, before);
  const result = morning(farm);
  assert.equal(result.ok, true);
  assert.doesNotMatch(result.message, /применил план/);
  assert.equal(farm.shoreline.revision, 0);
  assert.equal(farm.shoreline.settled, null);
  assert.deepEqual(farm.shoreline.observations, []);
  assert.ok(reload(farm));
});

test('cancel only the future plan, preserving settled habitat and an active fishing snapshot', () => {
  const farm = cove(); changeCove(farm, covePresets.nursery); morning(farm);
  assert.equal(beginFishingTrip(farm).ok, true);
  const habitat = getCoveHabitat(farm);
  changeCove(farm, covePresets.channel);
  const before = structuredClone(farm); before.shoreline.pending = null;
  assert.equal(cancelCovePlan(farm).ok, true);
  assert.deepEqual(farm, before);
  assert.deepEqual(getCoveHabitat(farm), habitat);
  assert.deepEqual(reload(farm), farm);
});

test('stale, remote and locked cancellation leave the entire current state unchanged', () => {
  const farm = cove(); changeCove(farm, covePresets.nursery);
  const old = covePlanKey(farm.shoreline); changeCove(farm, covePresets.channel);
  let before = structuredClone(farm);
  assert.equal(cancelCovePlan(farm, old).ok, false); assert.deepEqual(farm, before);
  farm.island = 'home'; before = structuredClone(farm);
  assert.equal(cancelCovePlan(farm).ok, false); assert.deepEqual(farm, before);
  farm.island = 'grove'; farm.boatOwned = false; before = structuredClone(farm);
  assert.equal(cancelCovePlan(farm).ok, false); assert.deepEqual(farm, before);
  farm.boatOwned = true; farm.shellDiscoveries = []; before = structuredClone(farm);
  assert.equal(cancelCovePlan(farm).ok, false); assert.deepEqual(farm, before);
});

test('applied tide cannot be cancelled or refunded, and its confirmation survives reload only that day', () => {
  let farm = cove(); changeCove(farm, covePresets.channel);
  const old = covePlanKey(farm.shoreline);
  const result = morning(farm);
  assert.match(result.message, /Ночной прилив применил план заводи/);
  assert.equal(getCoveActions(farm).appliedToday, true);
  farm = reload(farm);
  const applied = structuredClone(farm);
  assert.equal(getCoveActions(farm).appliedToday, true);
  assert.equal(cancelCovePlan(farm, old).ok, false);
  assert.deepEqual(farm, applied);
  const next = morning(farm);
  assert.doesNotMatch(next.message, /применил план/);
  assert.equal(getCoveActions(farm).appliedToday, false);
  assert.equal(farm.shoreline.revision, applied.shoreline.revision);
  assert.deepEqual(farm.shoreline.settled, applied.shoreline.settled);
});

test('pending plans can be cancelled after reload without resurrecting the plan later', () => {
  let farm = cove(); changeCove(farm, covePresets.channel);
  const key = covePlanKey(farm.shoreline); farm = reload(farm);
  assert.equal(covePlanKey(farm.shoreline), key);
  assert.equal(cancelCovePlan(farm, key).ok, true);
  farm = reload(farm); morning(farm);
  assert.equal(farm.shoreline.settled, null);
  assert.equal(getCoveForecast(farm.shoreline, farm.day), null);
  assert.ok(reload(farm));
});

test('forecast is read-only and exactly matches next morning ecology without early discoveries', () => {
  for (const preset of Object.values(covePresets)) {
    const farm = cove(); assert.equal(getCoveForecast(farm.shoreline, farm.day), null);
    changeCove(farm, preset);
    const before = structuredClone(farm), forecast = getCoveActions(farm).forecast!;
    assert.equal(forecast.day, farm.day + 1);
    assert.deepEqual(farm, before);
    assert.equal(farm.shoreline.revision, 0);
    assert.deepEqual(farm.shoreline.observations, []);
    assert.equal(getCoveHabitat(farm), undefined);
    morning(farm);
    assert.deepEqual(getCoveEcology(farm.shoreline, farm.day), forecast.ecology);
    assert.equal(getCoveForecast(farm.shoreline, farm.day), null);
  }
});

test('editing forecast copies and cancelling a newer morning plan cannot undo the applied tide', () => {
  const farm = cove(); changeCove(farm, covePresets.nursery); morning(farm);
  const applied = structuredClone(farm.shoreline);
  changeCove(farm, covePresets.channel);
  const before = structuredClone(farm), forecast = getCoveActions(farm).forecast!;
  forecast.ecology.choices.flow = 'sheltered'; forecast.ecology.fishing.current = 99;
  forecast.ecology.animals.minnows.count = 999;
  assert.deepEqual(farm, before);
  assert.equal(getCoveActions(farm).appliedToday, true);
  assert.equal(cancelCovePlan(farm).ok, true);
  assert.deepEqual(farm.shoreline.settled, applied.settled);
  assert.equal(farm.shoreline.revision, applied.revision);
  assert.deepEqual(farm.shoreline.observations, applied.observations);
  assert.equal(getCoveActions(farm).appliedToday, true);
});
