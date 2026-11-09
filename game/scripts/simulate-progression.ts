import assert from 'node:assert/strict';
import * as f from '../src/farm.ts';

// A deterministic, successful-fishing route through real commands, with no stock or coin grants.
const farm = f.createFarm();
let actions = 0;
const evenings: number[] = [];
const milestones: Record<string, { day: number; actions: number; coins: number }> = {};
function act(result: {ok: boolean}) { if (result.ok) actions++; return result.ok; }
function mark(id: string) { milestones[id] ??= {day: farm.day, actions, coins: farm.coins}; }
function home() { if (farm.island !== 'home') act(f.sail(farm, 'home')); }
function sellSurplus() {
  home();
  for (const row of f.getMarketStock(farm)) {
    const keep = row.item.kind === 'produce' ? row.item.item === 'wheat' ? 10 : row.item.item === 'carrot' ? 4 : 0
      : row.item.kind === 'eggs' ? 8 : row.item.kind === 'fruit' ? row.item.item === 'apple' ? 4 : 2
      : row.item.kind === 'fish' ? row.item.item === 'seaBass' ? 3 : 0
      : ['dishes','eggBaskets','handmade','honey','seaSalt'].includes(row.item.kind) ? 100 : 0;
    for (let n = row.count; n > keep; n--) act(f.sellMarketItem(farm, row.key));
  }
}
act(f.workBed(farm, 0)); act(f.workBed(farm, 0)); act(f.workBed(farm, 0));
for (let day = 1; day <= 16 && !farm.village.built; day++) {
  home();
  if (farm.feed === 0 && farm.coins >= f.feedBagPrice) act(f.buyFeed(farm));
  act(f.feedChickens(farm)); act(f.collectEggs(farm)); act(f.pickFruit(farm, 0));
  for (let index = 0; index < farm.beds.length; index++) {
    if (f.getBedStage(farm.beds[index]) === 'ripe') act(f.workBed(farm, index));
  }
  // Four wheat plots provide fair supplies, bread and handmade buns without repeating one crop everywhere.
  const growingWheat = farm.beds.filter(bed => bed.kind === 'crop' && bed.crop === 'wheat').length;
  if (growingWheat < 4 && farm.produce.wheat < 10) {
    act(f.selectSeed(farm, 'wheat'));
    for (let index = 0, planted = growingWheat; index < farm.beds.length && planted < 4; index++) {
      if (farm.beds[index].kind !== 'tilled') continue;
      if (farm.seeds.wheat === 0 && farm.coins >= f.cropDefinitions.wheat.seedPrice) act(f.buySeeds(farm, 'wheat'));
      if (act(f.workBed(farm, index))) planted++;
    }
  }
  for (let index = 0; index < farm.beds.length; index++) {
    if (f.getBedAction(farm, index).kind !== 'water') continue;
    if (farm.water === 0) act(f.refillWater(farm));
    act(f.workBed(farm, index));
  }
  sellSurplus();
  if (!farm.boatOwned && act(f.buyBoat(farm))) mark('boat');
  if (farm.buildingLevels.farmhouse === 1) act(f.upgradeBuilding(farm, 'farmhouse'));
  if (farm.buildingLevels.farmhouse >= 2 && farm.dishes.appleJam < 2) act(f.cookDish(farm, 'appleJam'));
  if (farm.boatOwned) {
    act(f.sail(farm, 'grove')); act(f.pickFruit(farm, 0)); act(f.gatherSeaSalt(farm));
    while (f.getFishAction(farm).available) act(f.catchFish(farm, true));
    if (!f.isProjectComplete(farm, 'dock') && act(f.deliverProject(farm, 'dock')) && f.isProjectComplete(farm, 'dock')) mark('dock');
    if (f.canSailTo(farm, 'cape')) {
      act(f.sail(farm, 'cape')); mark('cape');
      for (let index = 0; index < 3; index++) if (farm.capeFlowers[index] === null) act(f.plantCapeFlower(farm, index));
      if (act(f.collectCapeHoney(farm))) mark('honey');
    }
    home();
  }
  // Old Cape route requires the specialization and one harbor delivery on two separate days.
  if (!f.canSailTo(farm, 'cape') && f.isProjectComplete(farm, 'dock')) {
    if (!farm.farmhouseSpecialization) act(f.specializeFarmhouse(farm, 'bakery'));
    if (farm.farmhouseSpecialization) {
      if (farm.dishes.farmhouseBread < 2) act(f.cookDish(farm, 'farmhouseBread'));
      act(f.sail(farm, 'grove')); act(f.deliverHarborOrder(farm)); home();
    }
  }
  for (const building of ['coop','well'] as const) if (farm.buildingLevels[building] === 1) act(f.upgradeBuilding(farm, building));
  if (farm.eggs >= 3 && farm.eggBaskets === 0) act(f.packEggBasket(farm));
  if (!f.isProjectComplete(farm, 'fair')) { act(f.deliverProject(farm, 'fair')); if (f.isProjectComplete(farm, 'fair')) mark('fair'); }
  if (act(f.serveFairGuest(farm))) mark('firstGuest');
  if (f.isProjectComplete(farm, 'fair')) while (farm.handmade.round + (farm.village.supplies['handmade:round'] ?? 0) < 2 && f.getWorkshopAction(farm).available) act(f.bakeWorkshop(farm, 'round'));
  act(f.contributeVillage(farm));
  if (farm.village.built) mark('village');
  assert.ok(f.restoreFarm(JSON.parse(JSON.stringify(farm))), `save roundtrip on day ${farm.day}`);
  if (!farm.village.built) { evenings.push(farm.workToday); act(f.endDay(farm)); }
}
assert.equal(farm.village.built, true, 'the route must reach neighbours');
assert.equal(farm.farmhouseSpecialization, null, 'flowers and neighbours must not demand a kitchen specialization');
assert.equal(farm.orders.harbor.completed, 0, 'daily harbor orders must remain optional');
assert.ok(milestones.cape.day <= 2 && milestones.honey.day <= 3 && milestones.village.day <= 4,
  'the active route must reach flowers and neighbours without extra waiting loops');
console.log(JSON.stringify({mode: 'active-route', milestones, actions, workBeforeRest:evenings}, null, 2));
