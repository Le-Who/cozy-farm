import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createFarm, bakeWorkshop, getWorkshopAction, getMarketStock, sellMarketItem,
  restoreFarm, serveFairGuest, contributeVillage, getVillageProject, inviteResident,
  getVillageHomeCount, serveVillageMeal, runResidentService, getResidentService,
  beginFishingTrip, finishFishingTrip, cancelFishingTrip, endDay, sail, canSailTo, getFishAction, getTreeAction } from '../src/farm.ts';

function fairFarm() {
  const farm = createFarm();
  farm.day = 5;
  farm.projects.fair = { 'dishes:appleJam': 1, eggBaskets: 1, 'produce:carrot': 4, 'produce:wheat': 3 };
  return farm;
}
function villageFarm() {
  const farm = fairFarm();
  farm.fairGuestsServed = 3;
  farm.guestServedOn = 3;
  farm.boatOwned = true;
  farm.projects.dock = { 'dishes:appleJam': 1, 'fruit:pear': 2, seaSalt: 2 };
  farm.farmhouseSpecialization = 'bakery';
  farm.buildingLevels.farmhouse = 3;
  farm.orders.harbor = { completed: 2, deliveredOn: 2 };
  farm.capeFlowers[0] = 1;
  farm.capeHoneyOn = 2;
  farm.coins = 100;
  farm.handmade.round = 2;
  farm.workshopPatterns = ['round'];
  farm.fish.seaBass = 2;
  farm.honey = 2;
  return farm;
}

test('workshop is gated, consumes an atomic recipe and preserves discovered saleable shapes', () => {
  const farm = createFarm();
  farm.produce.wheat = 4; farm.eggs = 1;
  assert.equal(getWorkshopAction(farm).available, false);
  const before = structuredClone(farm);
  assert.equal(bakeWorkshop(farm, 'round').ok, false);
  assert.deepEqual(farm, before);
  farm.projects = fairFarm().projects;
  assert.equal(bakeWorkshop(farm, 'folded').ok, true);
  assert.equal(farm.produce.wheat, 2);
  assert.equal(farm.eggs, 0);
  assert.equal(farm.handmade.folded, 1);
  assert.deepEqual(farm.workshopPatterns, ['folded']);
  assert.equal(getMarketStock(farm).find(row => row.key === 'handmade:folded')?.price, 20);
  assert.equal(sellMarketItem(farm, 'handmade:folded').ok, true);
  assert.deepEqual(restoreFarm(JSON.parse(JSON.stringify(farm)))?.workshopPatterns, ['folded']);
  const empty = structuredClone(farm);
  assert.equal(bakeWorkshop(farm, 'long').ok, false);
  assert.deepEqual(farm, empty);
});

test('fair tracks one guest each day and old saves infer their first visit', () => {
  const farm = fairFarm();
  farm.fruit.apple = 4;
  assert.equal(serveFairGuest(farm).ok, true);
  assert.equal(serveFairGuest(farm).ok, false);
  assert.equal(farm.fairGuestsServed, 1);
  const legacy = JSON.parse(JSON.stringify(farm));
  delete legacy.fairGuestsServed; delete legacy.handmade; delete legacy.workshopPatterns;
  delete legacy.village; delete legacy.fishingTripSerial; delete legacy.pendingFishingTrip;
  const restored = restoreFarm(legacy);
  assert.ok(restored);
  assert.equal(restored.fairGuestsServed, 1);
  assert.deepEqual(restored.handmade, { round: 0, folded: 0, long: 0 });
});

test('village stores partial supplies and charges its final coins exactly once', () => {
  let farm = villageFarm();
  farm.coins = 47;
  farm.fish.seaBass = 1;
  assert.equal(contributeVillage(farm).ok, true);
  assert.equal(farm.village.built, false);
  assert.equal(farm.handmade.round, 0);
  assert.equal(farm.coins, 47);
  const restored = restoreFarm(JSON.parse(JSON.stringify(farm)));
  assert.ok(restored); farm = restored;
  assert.equal(getVillageProject(farm).items[0].delivered, 2);
  farm.fish.seaBass = 1;
  assert.equal(contributeVillage(farm).ok, true);
  assert.equal(farm.village.built, false);
  farm.coins = 48;
  assert.equal(contributeVillage(farm).ok, true);
  assert.equal(farm.coins, 0);
  assert.equal(farm.village.built, true);
  assert.equal(contributeVillage(farm).ok, false);
  assert.ok(restoreFarm(JSON.parse(JSON.stringify(farm))));
});

test('communal meals unlock the second home and assignments cannot reset services', () => {
  const farm = villageFarm();
  assert.equal(contributeVillage(farm).ok, true);
  assert.equal(getVillageHomeCount(farm), 1);
  farm.island = 'village';
  assert.equal(inviteResident(farm, 'finn', 1).ok, false);
  assert.equal(inviteResident(farm, 'bea', 0).ok, true);
  farm.produce.wheat = 8; farm.eggs = 4;
  assert.equal(runResidentService(farm, 'bea', 'round').ok, true);
  assert.equal(farm.handmade.round, 3);
  assert.equal(inviteResident(farm, 'finn', 0).ok, true);
  assert.equal(inviteResident(farm, 'bea', 0).ok, true);
  assert.equal(getResidentService(farm, 'bea', 'round').available, false);
  assert.equal(runResidentService(farm, 'bea', 'round').ok, false);
  farm.fish.perch = 2;
  assert.equal(serveVillageMeal(farm, 'round').ok, true);
  assert.equal(serveVillageMeal(farm, 'round').ok, false);
  farm.island = 'home';
  assert.equal(endDay(farm).ok, true);
  farm.island = 'village';
  assert.equal(serveVillageMeal(farm, 'round').ok, true);
  assert.equal(getVillageHomeCount(farm), 2);
  assert.equal(inviteResident(farm, 'finn', 1).ok, true);
  assert.deepEqual(farm.village.residents, ['bea', 'finn']);
  assert.equal(inviteResident(farm, 'bea', 1).ok, true);
  assert.deepEqual(farm.village.residents, ['finn', 'bea']);
  assert.equal(runResidentService(farm, 'finn').ok, true);
  farm.island = 'home';
  const trip = beginFishingTrip(farm);
  assert.equal(trip.config?.capacity, 3);
  assert.equal(trip.config?.resilience, 4);
  assert.equal(farm.village.scouting, false);
  assert.equal(cancelFishingTrip(farm, trip.token).ok, true);
  assert.equal(beginFishingTrip(farm).config?.capacity, 2);
  assert.ok(restoreFarm(JSON.parse(JSON.stringify(farm))));
});

test('fishing awards one bounded transaction across reloads, losses and stale tokens', () => {
  let farm = createFarm();
  const first = beginFishingTrip(farm);
  assert.ok(first.ok && first.token);
  assert.equal(first.config?.resilience, 2);
  const loaded = restoreFarm(JSON.parse(JSON.stringify(farm)));
  assert.ok(loaded); farm = loaded;
  assert.equal(finishFishingTrip(farm, first.token, 99).ok, true);
  assert.equal(farm.fish.perch, 2);
  const awarded = structuredClone(farm);
  assert.equal(finishFishingTrip(farm, first.token, 2).ok, false);
  assert.deepEqual(farm, awarded);
  const second = beginFishingTrip(farm);
  assert.ok(second.token);
  assert.equal(finishFishingTrip(farm, second.token, 2).ok, true);
  assert.equal(farm.fish.perch, 3);
  assert.equal(beginFishingTrip(farm).ok, false);
  endDay(farm);
  const abandoned = beginFishingTrip(farm);
  const replacement = beginFishingTrip(farm);
  assert.ok(abandoned.token && replacement.token);
  assert.equal(finishFishingTrip(farm, abandoned.token, 2).ok, false);
  assert.equal(finishFishingTrip(farm, replacement.token, 0).ok, true);
  assert.equal(farm.fish.perch, 3);
  assert.equal(farm.pendingFishingTrip, null);
});

test('Lavender Harbour opens only after construction and has workshop rather than orchard fishing', () => {
  const farm = villageFarm();
  assert.equal(canSailTo(farm, 'village'), false);
  assert.equal(sail(farm, 'village').ok, false);
  assert.equal(contributeVillage(farm).ok, true);
  assert.equal(canSailTo(farm, 'village'), true);
  assert.equal(sail(farm, 'village').ok, true);
  assert.equal(getFishAction(farm).available, false);
  assert.equal(getTreeAction(farm, 0).available, false);
  assert.equal(beginFishingTrip(farm).ok, false);
  farm.produce.wheat = 2; farm.eggs = 1;
  assert.equal(getWorkshopAction(farm).available, true);
  assert.equal(bakeWorkshop(farm, 'long').ok, true);
  assert.ok(restoreFarm(JSON.parse(JSON.stringify(farm))));
});

test('invalid living saves and fishing awards cannot create goods or reset daily services', () => {
  const farm = villageFarm();
  assert.equal(restoreFarm({ ...farm, island: 'village' }), undefined);
  assert.equal(restoreFarm({ ...farm, fairGuestsServed: 6 }), undefined);
  assert.equal(restoreFarm({ ...farm, handmade: null }), undefined);
  // Owning traded pastry no longer proves the player has baked its pattern.
  assert.deepEqual(restoreFarm({ ...farm, workshopPatterns: [] })?.workshopPatterns, []);
  assert.equal(restoreFarm({ ...farm, village: { ...farm.village, meals: 1, mealOn: 5 } }), undefined);
  assert.equal(contributeVillage(farm).ok, true);
  assert.equal(restoreFarm({ ...farm, village: { ...farm.village, residents: ['bea', 'bea'] } }), undefined);
  assert.equal(restoreFarm({ ...farm, village: { ...farm.village, residents: ['bea', 'finn'] } }), undefined);
  farm.island = 'village';
  inviteResident(farm, 'bea', 0);
  farm.produce.wheat = 4; farm.eggs = 1;
  const short = structuredClone(farm);
  assert.equal(runResidentService(farm, 'bea', 'round').ok, false);
  assert.deepEqual(farm, short);
  farm.island = 'home';
  const trip = beginFishingTrip(farm);
  assert.ok(trip.token);
  const pending = structuredClone(farm);
  assert.equal(finishFishingTrip(farm, trip.token, -1).ok, false);
  assert.deepEqual(farm, pending);
  assert.equal(finishFishingTrip(farm, trip.token, Number.NaN).ok, false);
  assert.equal(restoreFarm({ ...farm, pendingFishingTrip: { ...farm.pendingFishingTrip, config: { capacity: 100, depth: 120, resilience: 1, scouted: false } } }), undefined);
  endDay(farm);
  assert.equal(finishFishingTrip(farm, trip.token, 2).ok, false);
  assert.equal(farm.fish.perch, 0);
});
