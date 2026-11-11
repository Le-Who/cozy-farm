import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createFarm,
  contributeVillage,
  inviteResident,
  serveVillageMeal,
  beginFestival,
  cancelFestival,
  contributeFestival,
  finishFestival,
  getFestivalChoices,
  getFestivalStatus,
  restoreFarm,
  endDay,
  sail,
  pickFruit,
  catchFish,
  beginFishingTrip,
  finishFishingTrip,
  type FarmState,
} from '../src/farm.ts';
import { createBayFestival, restoreBayFestival, noteFestivalActivity, noteFestivalDelivery, type FestivalTradition } from '../src/bay-festival.ts';
import { addFreightStock, startFreight } from '../src/bay-freight-model.ts';

function harbour(): FarmState {
  const farm = createFarm();
  farm.day = 10;
  farm.coins = 100;
  farm.boatOwned = true;
  farm.projects.fair = { 'dishes:appleJam': 1, eggBaskets: 1, 'produce:carrot': 4, 'produce:wheat': 3 };
  farm.projects.dock = { 'dishes:appleJam': 1, 'fruit:pear': 2, seaSalt: 2 };
  farm.buildingLevels = { farmhouse: 3, coop: 2, well: 2 };
  farm.farmhouseSpecialization = 'bakery';
  farm.orders.harbor = { completed: 2, deliveredOn: 2 };
  farm.fairGuestsServed = 3;
  farm.guestServedOn = 3;
  farm.capeFlowers[0] = 1;
  farm.capeHoneyOn = 2;
  farm.handmade.round = 3;
  farm.workshopPatterns = ['round'];
  farm.fish.seaBass = 2;
  farm.fish.perch = 1;
  farm.honey = 2;
  assert.equal(contributeVillage(farm).ok, true);
  assert.equal(sail(farm, 'village').ok, true);
  assert.equal(inviteResident(farm, 'bea', 0).ok, true);
  assert.equal(serveVillageMeal(farm, 'round').ok, true);
  for (const crop of ['carrot', 'beetroot', 'pumpkin', 'leafyGreens', 'cabbage', 'wheat'] as const)
    farm.produce[crop] = 50;
  farm.fruit = { apple: 50, pear: 50, peach: 50 };
  farm.handmade.round = 20;
  farm.fish.perch = 20;
  farm.seaSalt = 20;
  assert.ok(restoreFarm(JSON.parse(JSON.stringify(farm))));
  return farm;
}
function morning(farm: FarmState) {
  assert.equal(sail(farm, 'home').ok, true);
  assert.equal(endDay(farm).ok, true);
  assert.equal(sail(farm, 'village').ok, true);
}
function liveHarvest(farm: FarmState) {
  assert.equal(sail(farm, 'home').ok, true);
  assert.equal(pickFruit(farm, 0).ok, true);
  assert.equal(sail(farm, 'village').ok, true);
}
function contributeStage(farm: FarmState) {
  const stage = farm.festivals.active!.stage;
  while (farm.festivals.active!.stage === stage) {
    const view = getFestivalStatus(farm).active!;
    const req = view.requirements.find((req) => req.delivered < req.quantity && req.available > 0);
    assert.ok(req, `available requirement in ${view.label}`);
    const alt = req.alternatives.find((alt) => alt.available > 0)!;
    assert.equal(contributeFestival(farm, req.id, alt.id).ok, true);
  }
}
function completeHarvest(farm: FarmState) {
  liveHarvest(farm);
  for (let stage = 0; stage < 3; stage++) {
    contributeStage(farm);
    assert.equal(finishFestival(farm).ok, false);
    morning(farm);
  }
  const reward = getFestivalStatus(farm).active!.reward,
    coins = farm.coins;
  assert.equal(finishFestival(farm).ok, true);
  assert.equal(farm.coins, coins + reward);
  return reward;
}

test('legacy saves have three optional traditions after the first shared supper', () => {
  const farm = harbour(),
    legacy = JSON.parse(JSON.stringify(farm));
  delete legacy.festivals;
  assert.deepEqual(restoreFarm(legacy)?.festivals, createBayFestival());
  assert.deepEqual(
    getFestivalChoices(farm).map((choice) => choice.id),
    ['harvest', 'lights', 'stage'],
  );
  farm.village.meals = 0;
  assert.equal(beginFestival(farm, 'harvest').ok, false);
  farm.village.meals = 1;
  assert.equal(beginFestival(farm, 'harvest').ok, true);
  assert.equal(beginFestival(farm, 'lights').ok, false);
});

test('partial preparations persist without deadlines, require a live action and wait only until morning', () => {
  let farm = harbour();
  assert.equal(beginFestival(farm, 'harvest').ok, true);
  assert.equal(contributeFestival(farm, 'participation', 'harvest').ok, false);
  assert.equal(contributeFestival(farm, 'fruit', 'apple').ok, true);
  assert.equal(getFestivalStatus(farm).active!.materialValue, 4);
  farm = restoreFarm(JSON.parse(JSON.stringify(farm)))!;
  assert.ok(farm);
  for (let night = 0; night < 8; night++) morning(farm);
  assert.equal(farm.festivals.active!.delivered.fruit, 1);
  assert.equal(farm.festivals.active!.stage, 0);
  assert.equal(contributeFestival(farm, 'participation', 'harvest').ok, false);
  liveHarvest(farm);
  contributeStage(farm);
  assert.equal(getFestivalStatus(farm).active!.waitingNight, true);
  assert.equal(contributeFestival(farm).ok, false);
  morning(farm);
  assert.equal(getFestivalStatus(farm).active!.waitingNight, false);
});

test('repeat programs change preparations, reimburse donated value once, and cap growth at the third edition', () => {
  let farm = harbour();
  const programs: string[] = [];
  for (let edition = 1; edition <= 4; edition++) {
    assert.equal(beginFestival(farm, 'harvest').ok, true);
    programs.push(getFestivalStatus(farm).active!.editionName);
    const honorarium = getFestivalStatus(farm).active!.honorarium;
    liveHarvest(farm);
    for (let stage = 0; stage < 3; stage++) {
      contributeStage(farm);
      farm = restoreFarm(JSON.parse(JSON.stringify(farm)))!;
      assert.ok(farm);
      morning(farm);
    }
    const view = getFestivalStatus(farm).active!,
      before = farm.coins;
    assert.ok(view.materialValue > 0);
    assert.equal(view.reward, view.materialValue + honorarium);
    assert.equal(finishFestival(farm).ok, true);
    assert.equal(farm.coins - before, view.materialValue + honorarium);
    const paid = farm.coins;
    assert.equal(finishFestival(farm).ok, false);
    farm = restoreFarm(JSON.parse(JSON.stringify(farm)))!;
    assert.ok(farm);
    assert.equal(finishFestival(farm).ok, false);
    assert.equal(farm.coins, paid);
  }
  assert.equal(new Set(programs.slice(0, 3)).size, 3);
  assert.equal(programs[3], programs[0]);
  assert.equal(farm.freight.harvestStore, 3);
  assert.equal(beginFestival(farm, 'harvest').ok, true);
  assert.ok(getFestivalStatus(farm).active!.requirements.every((req) => req.quantity <= 6));
});

test('full old stock and sleeping cannot replace a new successful catch or shoreline activity', () => {
  let farm = harbour();
  assert.equal(beginFestival(farm, 'lights').ok, true);
  for (let n = 0; n < 4; n++) morning(farm);
  assert.equal(contributeFestival(farm, 'participation', 'fish').ok, false);
  assert.equal(sail(farm, 'home').ok, true);
  assert.equal(catchFish(farm, false).ok, false);
  const trip = beginFishingTrip(farm);
  assert.equal(trip.ok, true);
  assert.equal(finishFishingTrip(farm, trip.token!, 0).ok, true);
  assert.equal(sail(farm, 'village').ok, true);
  farm = restoreFarm(JSON.parse(JSON.stringify(farm)))!;
  assert.equal(contributeFestival(farm, 'participation', 'fish').ok, false);
  assert.equal(sail(farm, 'home').ok, true);
  assert.equal(catchFish(farm, true).ok, true);
  assert.equal(sail(farm, 'village').ok, true);
  assert.equal(contributeFestival(farm, 'participation', 'fish').ok, true);
});

test('a stage needs a concert after selection; an old concert and an empty ferry never count', () => {
  const farm = harbour();
  farm.concertDay = farm.day;
  farm.musicGarden.performances = 2;
  assert.equal(beginFestival(farm, 'stage').ok, true);
  contributeStage(farm);
  morning(farm);
  contributeStage(farm);
  morning(farm);
  assert.equal(contributeFestival(farm, 'concert', 'concert').ok, false);
  const bonusDay = farm.concertDay;
  farm.musicGarden.performances++;
  assert.equal(contributeFestival(farm, 'concert', 'concert').ok, true);
  assert.equal(farm.concertDay, bonusDay);
  morning(farm);
  assert.equal(finishFestival(farm).ok, true);
  assert.equal(farm.musicGarden.festivalLevel, 1);
  assert.equal(beginFestival(farm, 'lights').ok, true);
  farm.freight.events.unshift({ day: farm.day + 1, kind: 'unloading', port: 'village', items: [] });
  assert.equal(contributeFestival(farm, 'participation', 'delivery').ok, false);
});

test('malformed future, overfilled, or fabricated completed preparations are rejected', () => {
  const farm = harbour();
  beginFestival(farm, 'harvest');
  const save = JSON.parse(JSON.stringify(farm));
  save.festivals.active.readyOn = farm.day + 2;
  assert.equal(restoreFarm(save), undefined);
  assert.equal(
    restoreBayFestival({ ...createBayFestival(), completed: { harvest: 1, lights: 0, stage: 0 } }, 1, true),
    undefined,
  );
  const partial = JSON.parse(JSON.stringify(farm));
  partial.festivals.active.delivered.fruit = 999;
  assert.equal(restoreFarm(partial), undefined);
});

test('real ferry unloading counts once and remains remembered after the recent transport log rotates', () => {
  let farm = harbour();
  assert.equal(beginFestival(farm, 'lights').ok, true);
  assert.equal(addFreightStock(farm.freight, 'home', 'wheat', 3), true);
  assert.equal(startFreight(farm.freight, farm.day, ['home', 'grove', 'cape', 'village']).ok, true);
  morning(farm);
  assert.ok(farm.festivals.active!.cargoDelivered >= 3);
  farm.freight.events = [];
  farm = restoreFarm(JSON.parse(JSON.stringify(farm)))!;
  assert.ok(farm);
  assert.equal(contributeFestival(farm, 'participation', 'delivery').ok, true);
  assert.equal(contributeFestival(farm, 'participation', 'delivery').ok, false);
});

test('a new full concert on the day of an earlier concert counts without granting another daily visitor bonus', () => {
  const farm = harbour();
  farm.festivals.completed.stage = 2;
  farm.festivals.lastCompletedOn = 9;
  farm.musicGarden.performances = 5;
  farm.concertDay = farm.day;
  assert.equal(beginFestival(farm, 'stage').ok, true);
  assert.equal(getFestivalStatus(farm).active!.requirements[0].id, 'concert');
  assert.equal(contributeFestival(farm, 'concert', 'concert').ok, false);
  // The live music scene increments this counter after 64 played steps with at least two voices.
  farm.musicGarden.performances++;
  assert.equal(contributeFestival(farm, 'concert', 'concert').ok, true);
  assert.equal(farm.concertDay, farm.day);
  assert.equal(farm.bayShop.visitsToday, 0);
  assert.ok(restoreFarm(JSON.parse(JSON.stringify(farm))));
});


test('an untouched festival selection can be cancelled and replaced without changing inventory or rewards', () => {
  const farm = harbour(), before = structuredClone(farm);
  assert.equal(beginFestival(farm, 'harvest').ok, true);
  assert.equal(getFestivalStatus(farm).active!.canCancel, true);
  assert.equal(cancelFestival(farm, 'harvest').ok, true);
  assert.deepEqual(farm, before);
  assert.equal(cancelFestival(farm, 'harvest').ok, false);
  assert.deepEqual(farm, before);
  assert.equal(beginFestival(farm, 'lights').ok, true);
  assert.equal(farm.festivals.active!.tradition, 'lights');
  const selected = structuredClone(farm);
  assert.equal(cancelFestival(farm, 'harvest').ok, false, 'a stale cancel button cannot clear a different selection');
  assert.deepEqual(farm, selected);
  assert.ok(restoreFarm(JSON.parse(JSON.stringify(farm))));
});

test('material contributions permanently protect the chosen program, including after reload', () => {
  let farm = harbour();
  assert.equal(beginFestival(farm, 'harvest').ok, true);
  assert.equal(contributeFestival(farm, 'fruit', 'apple').ok, true);
  assert.equal(getFestivalStatus(farm).active!.canCancel, false);
  assert.match(getFestivalStatus(farm).active!.cancelReason, /Подготовка уже началась/);
  const before = structuredClone(farm);
  assert.equal(cancelFestival(farm, 'harvest').ok, false);
  assert.deepEqual(farm, before, 'no refund, stock mutation, reward or progress loss');
  farm = restoreFarm(JSON.parse(JSON.stringify(farm)))!;
  assert.ok(farm);
  assert.equal(getFestivalStatus(farm).active!.canCancel, false);
  const restored = structuredClone(farm);
  assert.equal(cancelFestival(farm, 'harvest').ok, false);
  assert.deepEqual(farm, restored);
});

test('any recorded activity, real cargo or new concert protects even an unfilled first stage', () => {
  for (const action of [
    (farm: FarmState) => { liveHarvest(farm); },
    (farm: FarmState) => { noteFestivalActivity(farm.festivals, 'bake'); },
    (farm: FarmState) => { noteFestivalActivity(farm.festivals, 'fish'); },
    (farm: FarmState) => { noteFestivalActivity(farm.festivals, 'shore'); },
    (farm: FarmState) => { noteFestivalDelivery(farm.festivals, 1); },
    (farm: FarmState) => { farm.musicGarden.performances++; },
  ]) {
    let farm = harbour();
    assert.equal(beginFestival(farm, 'harvest').ok, true);
    action(farm);
    assert.equal(farm.festivals.active!.stage, 0);
    assert.deepEqual(farm.festivals.active!.delivered, {});
    assert.equal(getFestivalStatus(farm).active!.canCancel, false);
    const before = structuredClone(farm);
    assert.equal(cancelFestival(farm, 'harvest').ok, false);
    assert.deepEqual(farm, before);
    farm = restoreFarm(JSON.parse(JSON.stringify(farm)))!;
    assert.ok(farm);
    assert.equal(getFestivalStatus(farm).active!.canCancel, false);
  }
});

test('old activity, browsing, an empty delivery and sleeping do not consume an untouched selection', () => {
  let farm = harbour(); farm.musicGarden.performances = 2;
  liveHarvest(farm);
  noteFestivalDelivery(farm.festivals, 3);
  assert.equal(beginFestival(farm, 'lights').ok, true);
  noteFestivalDelivery(farm.festivals, 0);
  const beforeRead = structuredClone(farm);
  getFestivalChoices(farm); getFestivalStatus(farm);
  assert.deepEqual(farm, beforeRead);
  assert.equal(sail(farm, 'home').ok, true);
  const away = structuredClone(farm);
  assert.equal(getFestivalStatus(farm).active!.canCancel, false);
  assert.equal(cancelFestival(farm, 'lights').ok, false);
  assert.deepEqual(farm, away);
  assert.equal(endDay(farm).ok, true);
  assert.equal(sail(farm, 'village').ok, true);
  farm = restoreFarm(JSON.parse(JSON.stringify(farm)))!;
  assert.ok(farm);
  assert.equal(getFestivalStatus(farm).active!.canCancel, true);
  const beforeCancel = structuredClone(farm); beforeCancel.festivals.active = null;
  assert.equal(cancelFestival(farm, 'lights').ok, true);
  assert.deepEqual(farm, beforeCancel);
});
