import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { commissionPlayer } from './fixtures/commission-player.ts';
import { getCapeJourneyStatus } from '../src/cape-journey-status.ts';
import {
  buyBoat,
  contributeVillage,
  createFarm,
  deliverHarborOrder,
  deliverProject,
  endDay,
  getVillageMeal,
  restoreFarm,
  sail,
  serveFairGuest,
  specializeFarmhouse,
  upgradeBuilding,
  type FarmState,
  type IslandId,
} from '../src/farm.ts';
import { getIslandJourneys } from '../src/journey.ts';

function journey(farm: FarmState, island: IslandId) {
  return getIslandJourneys(farm).find(({ id }) => id === island)!;
}

function prepareHarbor(farm: FarmState) {
  farm.coins = 500;
  assert.equal(buyBoat(farm).ok, true);
  assert.equal(upgradeBuilding(farm, 'farmhouse').ok, true);
  assert.equal(specializeFarmhouse(farm, 'bakery').ok, true);
  assert.equal(sail(farm, 'grove').ok, true);
  farm.dishes.appleJam = 1;
  farm.fruit.pear = 2;
  farm.seaSalt = 4;
  assert.equal(deliverProject(farm, 'dock').ok, true);
}

function prepareFair(farm: FarmState) {
  farm.coins = 500;
  assert.equal(buyBoat(farm).ok, true);
  for (const id of ['farmhouse', 'coop', 'well'] as const) assert.equal(upgradeBuilding(farm, id).ok, true);
  farm.dishes.appleJam = 1;
  farm.eggBaskets = 1;
  farm.produce.carrot = 4;
  farm.produce.wheat = 3;
  assert.equal(deliverProject(farm, 'fair').ok, true);
}

test('a new farm shows every destination and its first reachable action before buying a boat', () => {
  const farm = createFarm();
  const cards = getIslandJourneys(farm);
  assert.deepEqual(cards.map(card => card.id), ['home', 'grove', 'cape', 'village']);
  assert.equal(journey(farm, 'home').current, true);
  assert.equal(journey(farm, 'home').nextAction, undefined);
  for (const id of ['grove', 'cape', 'village'] as const) {
    const card = journey(farm, id);
    assert.equal(card.unlocked, false);
    assert.equal(card.nextAction?.target, 'buy-boat');
    assert.equal(card.nextAction?.enabled, false);
  }
  farm.coins = 52;
  assert.equal(journey(farm, 'grove').nextAction?.enabled, true);
  assert.equal(buyBoat(farm).ok, true);
  assert.deepEqual(journey(farm, 'grove').nextAction, { target: 'sail', value: 'grove', label: 'В путь · Солёная роща', enabled: true });
});

test('Cape explains the kitchen and pier requirements without demanding specialization', () => {
  const farm = createFarm();
  farm.coins = 500;
  assert.equal(buyBoat(farm).ok, true);
  assert.equal(journey(farm, 'cape').nextAction?.target, 'upgrades');
  assert.equal(sail(farm, 'grove').ok, true);
  assert.equal(journey(farm, 'cape').nextAction?.value, 'home');
  assert.equal(sail(farm, 'home').ok, true);
  assert.equal(upgradeBuilding(farm, 'farmhouse').ok, true);
  assert.equal(specializeFarmhouse(farm, 'bakery').ok, true);
  assert.equal(journey(farm, 'cape').nextAction?.value, 'grove');
  assert.equal(sail(farm, 'grove').ok, true);
  assert.equal(journey(farm, 'cape').nextAction?.target, 'project-dock');
  farm.dishes.appleJam = 1;
  assert.equal(deliverProject(farm, 'dock').ok, true);
  const pier = journey(farm, 'cape').requirements.find(item => item.id === 'pier')!;
  assert.deepEqual([pier.current, pier.target, pier.complete], [1, 5, false]);
});

test('restoring the pier opens Cape immediately without a specialization or daily harbor orders', () => {
  const farm = createFarm();
  farm.coins = 100;
  assert.equal(buyBoat(farm).ok, true);
  assert.equal(upgradeBuilding(farm, 'farmhouse').ok, true);
  assert.equal(sail(farm, 'grove').ok, true);
  farm.dishes.appleJam = 1; farm.fruit.pear = 2; farm.seaSalt = 2;
  assert.equal(deliverProject(farm, 'dock').ok, true);
  assert.equal(farm.farmhouseSpecialization, null);
  assert.equal(farm.orders.harbor.completed, 0);
  assert.equal(journey(farm, 'cape').unlocked, true);
  assert.ok(journey(farm, 'cape').requirements.every(item => item.complete));
  assert.equal(journey(farm, 'cape').nextAction?.value, 'cape');
  assert.equal(sail(farm, 'cape').ok, true);
  assert.ok(restoreFarm(JSON.parse(JSON.stringify(farm))));
  assert.equal(journey(farm, 'cape').nextAction, undefined);
});

test('Harbour points to fair prerequisites and next-day visitors before requesting building supplies', () => {
  const farm = createFarm();
  farm.coins = 100;
  assert.equal(buyBoat(farm).ok, true);
  assert.equal(journey(farm, 'village').nextAction?.target, 'upgrades');
  farm.coins = 500;
  for (const id of ['farmhouse', 'coop', 'well'] as const) assert.equal(upgradeBuilding(farm, id).ok, true);
  assert.equal(journey(farm, 'village').nextAction?.target, 'fair-project');
  farm.dishes.appleJam = 1;
  farm.eggBaskets = 1;
  farm.produce.carrot = 4;
  farm.produce.wheat = 3;
  assert.equal(deliverProject(farm, 'fair').ok, true);
  assert.equal(journey(farm, 'village').nextAction?.target, 'visit-guest');
  farm.fruit.apple = 2;
  assert.equal(serveFairGuest(farm).ok, true);
  assert.equal(journey(farm, 'village').nextAction?.target, 'village-project');
  const visitors = journey(farm, 'village').requirements.find(item => item.id === 'visitors')!;
  assert.deepEqual([visitors.current, visitors.target], [1, 1]);
});

test('Harbour shows partial delivery separately from supplies held and preserves the completed route after spending coins', () => {
  const farm = createFarm();
  prepareFair(farm);
  farm.day = 4;
  farm.guestServedOn = 3;
  farm.fairGuestsServed = 3;
  farm.handmade.round = 1;
  assert.equal(journey(farm, 'village').nextAction?.target, 'village-project');
  assert.equal(contributeVillage(farm).ok, true);
  farm.handmade.round = 1;
  let pastry = journey(farm, 'village').requirements.find(item => item.id === 'supply-handmade')!;
  assert.deepEqual([pastry.current, pastry.target, pastry.available], [1, 2, 1]);
  farm.fish.seaBass = 2;
  farm.honey = 2;
  farm.coins = 48;
  assert.equal(contributeVillage(farm).ok, true);
  const card = journey(farm, 'village');
  assert.equal(farm.coins, 0);
  assert.equal(card.unlocked, true);
  assert.equal(card.requirements.every(item => item.complete), true);
  assert.equal(card.nextAction?.value, 'village');
  assert.equal(sail(farm, 'village').ok, true);
  assert.equal(journey(farm, 'home').nextAction?.value, 'home');
  pastry = journey(farm, 'village').requirements.find(item => item.id === 'supply-handmade')!;
  assert.equal(pastry.current, 2);
});

test('restored pre-project saves retain locked destinations and reading journeys never mutates the save', () => {
  const { projects, village, fairGuestsServed, ...oldSave } = createFarm();
  const farm = restoreFarm(oldSave);
  assert.ok(farm);
  const before = structuredClone(farm);
  assert.equal(journey(farm, 'cape').unlocked, false);
  assert.equal(journey(farm, 'village').unlocked, false);
  assert.equal(journey(farm, 'village').requirements.find(item => item.id === 'visitors')?.current, 0);
  assert.deepEqual(farm, before);
});

test('the village island card retires supper after serving, but not Home travel or tomorrow’s table', () => {
  const opening = JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json', import.meta.url), 'utf8')) as {name:string; args:unknown[]}[];
  const mealAt = opening.reduce((last, step, index) => step.name === 'serveVillageMeal' ? index : last, -1);
  assert.ok(mealAt >= 0);
  const p = commissionPlayer(opening.slice(0, mealAt));
  const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
  const start = main.indexOf("    case 'boat': {"), end = main.indexOf("\n    case 'dock-project':", start);
  const card = main.slice(start, end).replace('import.meta.env.BASE_URL', "'/'");
  const render = (boatIsland: IslandId) => {
    const dialogContent = {innerHTML: ''};
    runInNewContext(`switch ('boat') { ${card} }`, {
      farm:p.state, getIslandJourneys, getVillageMeal, getCapeJourneyStatus, boatIsland, dialogContent, pastryShape:'round',
      icon:() => '', requirementLink:() => '', escapeHtml:(s:string) => s, journeyDetailsOpen:false,
      button:(label:string, action:string, enabled:boolean, options?:{value?:string}) =>
        `<button data-action="${action}" data-value="${options?.value ?? ''}"${enabled ? '' : ' disabled'}>${label}</button>`,
    });
    return dialogContent.innerHTML;
  };
  assert.equal(p.state.island, 'village'); assert.equal(getVillageMeal(p.state).available, true);
  const supper = /data-action="village-meal"[^>]*>Общий ужин</;
  assert.match(render('village'), supper);
  p.act('serveVillageMeal', 'round');
  const before = structuredClone(p.state), served = render('village');
  assert.doesNotMatch(served, /data-action="village-meal"/);
  assert.match(served, /Ужин завтра/);
  assert.match(render('home'), /data-action="sail" data-value="home">Отправиться</);
  assert.doesNotMatch(render('home'), /Ужин завтра/); assert.deepEqual(p.state, before);
  p.night(); p.visit('village');
  const morning = render('village'); assert.match(morning, supper); assert.doesNotMatch(morning, /Ужин завтра/);
});
