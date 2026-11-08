import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createFarm, endDay, feedChickens, getProject, workBed, type FarmState, type ProjectId } from '../src/farm.ts';
import { getDiscoveryTask } from '../src/discovery-path.ts';

const seen = { collections: true, islands: true };

test('the new harbour leads to a neighbour, correctly shaped suppers and the second cottage', () => {
  const farm = createFarm(); farm.boatOwned = true; farm.village.built = true;
  assert.equal(getDiscoveryTask(farm, seen)?.action.value, 'village');
  farm.island = 'village';
  assert.deepEqual(getDiscoveryTask(farm, seen)?.action, {label:'К первому домику',target:'visit-cottage',value:'0'});
  farm.village.residents[0] = 'bea'; farm.handmade.folded = 1; farm.fish.perch = 1;
  assert.equal(getDiscoveryTask(farm, seen)?.action.value, 'folded');
  farm.village.meals = 1; farm.village.mealOn = farm.day;
  assert.equal(getDiscoveryTask(farm, seen)?.action.value, 'home');
  farm.village.meals = 2;
  assert.equal(getDiscoveryTask(farm, seen)?.action.value, '1');
  farm.village.residents[1] = 'finn';
  assert.equal(getDiscoveryTask(farm, seen)?.id, 'own-recipe');
});

test('a harbour pastry can be shaped locally and earning never demands an unaffordable seed', () => {
  const farm = createFarm(); farm.boatOwned = true; farm.village.built = true; farm.island = 'village'; farm.village.residents[0] = 'bea';
  farm.produce.wheat = 2; farm.eggs = 1;
  assert.equal(getDiscoveryTask(farm, seen)?.action.target, 'workshop');
  farm.village.built = false; farm.island = 'home'; farm.boatOwned = false; farm.bayDiscoveries.push('orchardTart');
  farm.progress = {till:1,plant:1,water:1,rest:1,harvest:3,sell:1,feed:1,collect:1};
  farm.coins = 0; farm.produce.wheat = 0; farm.eggs = 0; farm.beds = farm.beds.map(() => ({kind:'empty'}));
  farm.seeds = {carrot:0,cabbage:0,beetroot:0,tomato:0,pumpkin:0,wheat:2,leafyGreens:0};
  assert.equal(getDiscoveryTask(farm, seen)?.action.target, 'focus-bed');
  farm.beds[0] = {kind:'tilled'};
  assert.deepEqual(getDiscoveryTask(farm, seen)?.action, {label:'Выбрать семена',target:'open-panel',value:'seeds'});
  farm.seeds.wheat = 0;
  assert.equal(getDiscoveryTask(farm, seen)?.action.target, 'visit-tree');
});
function starterDone(): FarmState {
  const farm = createFarm();
  farm.progress = { till: 1, plant: 1, water: 1, rest: 1, harvest: 3, sell: 1, feed: 1, collect: 1 };
  return farm;
}
function complete(farm: FarmState, project: ProjectId): void {
  for (const { item } of getProject(farm, project).items) {
    const key = 'item' in item ? `${item.kind}:${item.item}` : item.kind;
    farm.projects[project][key] = item.quantity;
  }
}
function established(): FarmState {
  const farm = starterDone(); farm.boatOwned = true; farm.coins = 300;
  farm.buildingLevels.farmhouse = 3; farm.farmhouseSpecialization = 'bakery';
  return farm;
}

test('a fresh farm gets one precise bed action and the selector never changes the farm', () => {
  const farm = createFarm(), original = structuredClone(farm);
  const next = getDiscoveryTask(farm, { collections: false, islands: false })!;
  assert.equal(next.id, 'till'); assert.equal(next.progress, 0); assert.equal(next.target, 1); assert.equal(next.reward, 3);
  assert.deepEqual(next.action, { label: 'Вскопать землю', target: 'focus-bed', value: '0' });
  assert.deepEqual(farm, original);
  workBed(farm, 0);
  assert.equal(getDiscoveryTask(farm, seen)?.id, 'plant');
  assert.equal(getDiscoveryTask(farm, seen)?.action.value, '0');
  workBed(farm, 0);
  assert.equal(getDiscoveryTask(farm, seen)?.id, 'water');
});

test('first bedtime teaches feeding before the night that produces morning eggs', () => {
  const farm = createFarm(); farm.progress.till = farm.progress.plant = farm.progress.water = 1;
  farm.beds[1] = { kind: 'crop', crop: 'carrot', growth: 0, watered: true };
  assert.equal(getDiscoveryTask(farm, seen)?.action.target, 'visit-coop');
  feedChickens(farm);
  assert.equal(getDiscoveryTask(farm, seen)?.action.target, 'visit-rest');
  const before = farm.eggsReady;
  endDay(farm);
  assert.ok(farm.eggsReady > before);
  assert.equal(getDiscoveryTask(farm, seen)?.id, 'harvest');
});

test('out of order actions remain complete and collections are introduced only once after a harvest', () => {
  const farm = createFarm(); farm.progress.till = farm.progress.plant = farm.progress.water = 1;
  farm.progress.feed = 1; farm.chickensFed = true;
  assert.equal(getDiscoveryTask(farm, seen)?.id, 'rest');
  farm.progress.harvest = 1;
  assert.equal(getDiscoveryTask(farm, { collections: false, islands: false })?.id, 'collections');
  assert.equal(getDiscoveryTask(farm, { collections: true, islands: false })?.id, 'rest');
  assert.equal(getDiscoveryTask(starterDone(), { collections: true, islands: false })?.action.value, 'boat');
});

test('first tart guidance points to each missing ingredient instead of an unavailable recipe', () => {
  const farm = starterDone();
  assert.deepEqual(getDiscoveryTask(farm, seen)?.action, { label: 'К плодовому дереву', target: 'visit-tree', value: '0' });
  farm.fruit.apple = 2;
  assert.equal(getDiscoveryTask(farm, seen)?.action.target, 'focus-bed');
  assert.equal(getDiscoveryTask(farm, seen)?.action.value, '4');
  farm.produce.wheat = 1;
  assert.equal(getDiscoveryTask(farm, seen)?.action.target, 'visit-coop');
  farm.eggs = 1;
  assert.equal(getDiscoveryTask(farm, seen)?.id, 'first-cooking');
  assert.equal(getDiscoveryTask(farm, seen)?.action.target, 'kitchen');
});

test('missing wheat sources lead through seeds, tilling, water and home before rest', () => {
  const farm = starterDone(); farm.fruit.apple = 2;
  farm.beds = farm.beds.map(() => ({ kind: 'empty' })); farm.seeds.wheat = 0;
  assert.match(getDiscoveryTask(farm, seen)!.label, /семена: пшеница/);
  assert.equal(getDiscoveryTask(farm, seen)?.action.target, 'visit-market');
  farm.seeds.wheat = 1;
  assert.equal(getDiscoveryTask(farm, seen)?.action.target, 'focus-bed');
  farm.beds[0] = { kind: 'tilled' };
  assert.equal(getDiscoveryTask(farm, seen)?.action.value, 'seeds');
  farm.selectedSeed = 'wheat';
  assert.equal(getDiscoveryTask(farm, seen)?.action.target, 'focus-bed');
  farm.beds[0] = { kind: 'crop', crop: 'wheat', growth: 0, watered: false }; farm.water = 0;
  assert.equal(getDiscoveryTask(farm, seen)?.action.target, 'refill');
  farm.beds[0].watered = true;
  assert.equal(getDiscoveryTask(farm, seen)?.action.target, 'visit-rest');
  farm.boatOwned = true; farm.island = 'grove';
  assert.equal(getDiscoveryTask(farm, seen)?.action.target, 'sail');
  assert.equal(getDiscoveryTask(farm, seen)?.action.value, 'home');
});

test('a previously cooked dish advances to the boat and Grove without repeating cooking', () => {
  const farm = starterDone(); farm.bayDiscoveries.push('orchardTart'); farm.coins = 100;
  assert.equal(getDiscoveryTask(farm, seen)?.id, 'boat');
  farm.boatOwned = true;
  assert.equal(getDiscoveryTask(farm, seen)?.action.value, 'grove');
  farm.island = 'grove';
  assert.equal(getDiscoveryTask(farm, seen)?.action.target, 'visit-tree');
  farm.bayDiscoveries.push('pear');
  assert.equal(getDiscoveryTask(farm, seen)?.action.value, 'home');
});

test('advanced saves skip obsolete starter counters and use the actual dock ingredient source', () => {
  const farm = established(); farm.progress = createFarm().progress;
  farm.fruit.apple = 2; farm.island = 'grove';
  assert.equal(getDiscoveryTask(farm, { collections: false, islands: true })?.action.value, 'home');
  farm.island = 'home';
  assert.equal(getDiscoveryTask(farm, seen)?.action.target, 'kitchen', 'stay Home to cook jam rather than bouncing back to Grove');
  farm.dishes.appleJam = 1;
  assert.equal(getDiscoveryTask(farm, seen)?.action.value, 'grove');
  farm.island = 'grove';
  assert.equal(getDiscoveryTask(farm, seen)?.action.target, 'project-dock');
});

test('harbor guidance obtains meals at Home and waits for tomorrow at Home after delivery', () => {
  const farm = established(); complete(farm, 'dock'); farm.island = 'grove';
  assert.equal(getDiscoveryTask(farm, seen)?.action.value, 'home');
  farm.island = 'home';
  assert.equal(getDiscoveryTask(farm, seen)?.action.target, 'focus-bed');
  farm.dishes.farmhouseBread = 1;
  assert.equal(getDiscoveryTask(farm, seen)?.action.value, 'grove');
  farm.island = 'grove';
  assert.equal(getDiscoveryTask(farm, seen)?.action.target, 'visit-harbor');
  farm.orders.harbor.completed = 1; farm.orders.harbor.deliveredOn = farm.day;
  assert.equal(getDiscoveryTask(farm, seen)?.action.value, 'home');
  farm.island = 'home';
  assert.equal(getDiscoveryTask(farm, seen)?.action.target, 'visit-rest');
});

test('Cape, fair, visitors and Harbour follow real permanent milestones', () => {
  const farm = established(); complete(farm, 'dock'); farm.orders.harbor.completed = 2;
  assert.equal(getDiscoveryTask(farm, seen)?.id, 'cape-flowers');
  farm.bayDiscoveries.push('honey');
  assert.equal(getDiscoveryTask(farm, seen)?.id, 'upgrade-coop');
  farm.buildingLevels.coop = farm.buildingLevels.well = 2;
  farm.dishes.appleJam = 1;
  assert.equal(getDiscoveryTask(farm, seen)?.id, 'fair');
  complete(farm, 'fair'); farm.fruit.apple = 2;
  assert.equal(getDiscoveryTask(farm, seen)?.id, 'visitors');
  farm.fairGuestsServed = 3; farm.handmade.round = 2;
  assert.equal(getDiscoveryTask(farm, seen)?.id, 'village');
  farm.village.built = true;
  assert.equal(getDiscoveryTask(farm, { collections: false, islands: false })?.action.value, 'village');
});

test('Cape introduction plants all beds, returns Home for the night and collects honey before further upgrades', () => {
  const farm = established(); complete(farm, 'dock'); farm.orders.harbor.completed = 2; farm.island = 'cape';
  for (let index = 0; index < 3; index++) {
    const next = getDiscoveryTask(farm, seen)!;
    assert.equal(next.action.target, 'focus-flower'); assert.equal(next.action.value, String(index));
    assert.equal(next.progress, index); assert.equal(next.target, 3);
    farm.capeFlowers[index] = farm.day;
  }
  assert.equal(getDiscoveryTask(farm, seen)?.action.value, 'home');
  farm.island = 'home';
  assert.equal(getDiscoveryTask(farm, seen)?.action.target, 'visit-rest');
  farm.day++;
  assert.equal(getDiscoveryTask(farm, seen)?.action.value, 'cape');
  farm.island = 'cape';
  assert.equal(getDiscoveryTask(farm, seen)?.action.target, 'visit-hive');
  farm.bayDiscoveries.push('honey');
  assert.equal(getDiscoveryTask(farm, seen)?.id, 'upgrade-coop');
  assert.equal(getDiscoveryTask(farm, seen)?.action.value, 'home');
});
