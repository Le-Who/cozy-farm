import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createFarm, restoreFarm, getCommunityOrders, getIntentOffers, deliverIntentOrder, getNeighborPlans, joinNeighborPlan, serveNeighborPlan, finishNeighborPlan, advanceNeighborPlan, runResidentService, getFishingTripConfig, endDay, completeSignature, nameSignature, cookDish, packEggBasket, packEggCrate, type NeighborAssembly, type FoodOfferId } from '../src/farm.ts';
import { intentIds } from '../src/intent-orders.ts';
import type { CookeryResult } from '../src/culinary.ts';

function farm() {
  const f = createFarm(); f.day = 5; f.boatOwned = true; f.buildingLevels.farmhouse = 2; f.buildingLevels.coop = 2;
  f.projects.fair = { 'dishes:appleJam': 1, eggBaskets: 1, 'produce:carrot': 4, 'produce:wheat': 3 };
  f.fairGuestsServed = 3; f.guestServedOn = 3;
  f.projects.dock = { 'dishes:appleJam': 1, 'fruit:pear': 2, seaSalt: 2 };
  f.village = { built: true, supplies: { 'handmade:round': 2, 'fish:seaBass': 2, honey: 2 }, residents: ['bea', 'finn'], meals: 2, mealOn: 2, serviceOn: { bea: 0, finn: 0 }, scouting: false };
  f.workshopPatterns = ['round', 'folded', 'long']; f.produce.wheat = 30; f.eggs = 20; f.fruit.pear = 6; f.produce.blueberry = 6;
  f.handmade = { round: 3, folded: 3, long: 3 }; f.dishes.honeyPear = 0;
  f.dishes.strawberryTart = 3;
  completeSignature(f, { base: 'preserves', ingredients: [{ id: 'pear', quantity: 2 }] }, { family: 'preserves', processing: 'silky', fruit: [], steps: ['fruit', 'stir', 'jar'] });
  return f;
}
const load = (f: ReturnType<typeof createFarm>) => restoreFarm(JSON.parse(JSON.stringify(f)))!;
const assembly = (kind: 'table' | 'basket'): NeighborAssembly => ({ kind, settled: true, placements: [{ slot: 'food', x: 0, y: 0 }, { slot: 'cup', x: -.6, y: .3 }, { slot: 'flowers', x: .6, y: .3 }] });
function select(f: ReturnType<typeof farm>, resident: 'bea' | 'finn', food: FoodOfferId) {
  const p = getNeighborPlans(f).find(plan => plan.resident === resident)!;
  assert.ok(joinNeighborPlan(f, p.id).ok); assert.ok(serveNeighborPlan(f, p.id, food).ok); return p;
}

test('all six food intentions offer at least two semantic recipes, with ingredient-derived qualities and no name shortcut', () => {
  const f = farm();
  const berry = completeSignature(f, { base: 'tart', ingredients: [{ id: 'blueberry', quantity: 2 }] }, { family: 'decorate', fruit: [], steps: ['fruit', 'bake'], baking: { method: 'oven', finish: 'golden', seconds: 90 } }).recipeId!;
  const delicate = completeSignature(f, { base: 'preserves', ingredients: [{ id: 'pear', quantity: 2 }] }, { family: 'preserves', processing: 'silky', fruit: [], steps: ['fruit', 'stir', 'jar'] }).recipeId!;
  assert.ok(nameSignature(f, delicate, 'Ягодный дорожный пирог').ok);
  for (const intent of intentIds) assert.ok(getIntentOffers(f, intent).filter(offer => offer.eligible).length >= 2, intent);
  assert.ok(getIntentOffers(f, 'berry').find(offer => offer.id === `signature:${berry}`)?.available);
  assert.equal(getIntentOffers(f, 'berry').find(offer => offer.id === `signature:${delicate}`)?.eligible, false);
  assert.ok(getIntentOffers(f, 'delicate').find(offer => offer.id === `signature:${delicate}`)?.available);
  assert.ok(getIntentOffers(f, 'portable').find(offer => offer.id === 'handmade:round')?.available);
  assert.ok(getIntentOffers(f, 'hearty').find(offer => offer.id === 'dish:grilledFish')?.eligible);
  assert.ok(load(f));
});

test('daily intention requests preview matching zero-stock choices and settle a single exact reward transaction', () => {
  const f = farm(), orders = getCommunityOrders(f); assert.equal(orders.length, 3); assert.equal(new Set(orders.map(order => order.intentId)).size, 3);
  const portable = orders.find(order => order.intentId === 'portable')!, before = structuredClone(f);
  assert.equal(deliverIntentOrder(f, portable.id, 'dish:honeyBiscuits').ok, false); assert.deepEqual(f, before);
  const zero = portable.offers.find(offer => offer.id === 'dish:honeyBiscuits')!; assert.ok(zero.eligible); assert.equal(zero.available, false);
  const choice = portable.offers.find(offer => offer.id === 'handmade:round')!, coins = f.coins;
  assert.ok(deliverIntentOrder(f, portable.id, choice.id).ok); assert.equal(f.handmade.round, 2); assert.equal(f.coins, coins + choice.reward);
  const done = load(f), settled = structuredClone(done); assert.ok(done); assert.equal(deliverIntentOrder(done, portable.id, 'handmade:long').ok, false); assert.deepEqual(done, settled);
  endDay(done); assert.equal(deliverIntentOrder(done, portable.id, choice.id).ok, false); assert.equal(getCommunityOrders(done).length, 3);
});

test('occasions require two independent qualities and same-ingredient processing changes the actual answer', () => {
  const f = farm();
  const chunky = completeSignature(f, { base: 'preserves', ingredients: [{ id: 'pear', quantity: 2 }] }, { family: 'preserves', processing: 'chunky', fruit: [], steps: ['fruit', 'stir', 'jar'] }).recipeId!;
  const silky = getIntentOffers(f, 'delicate').find(offer => offer.id === 'signature:s1')!;
  const pieces = getIntentOffers(f, 'delicate').find(offer => offer.id === `signature:${chunky}`)!;
  assert.deepEqual(silky.ingredients, pieces.ingredients); assert.equal(silky.matchCount, 2); assert.equal(pieces.matchCount, 1);
  assert.equal(silky.eligible, true); assert.equal(pieces.eligible, false); assert.deepEqual(silky.requiredQualities, ['delicate', 'sweet']);
  assert.equal(getIntentOffers(f, 'fruit').find(offer => offer.id === 'dish:honeyPear')!.eligible, false, 'a plated fruit dessert does not travel in a basket');
  assert.equal(getIntentOffers(f, 'fruit').find(offer => offer.id === 'dish:appleJam')!.eligible, true, 'a fruit jar does travel');
  assert.equal(getIntentOffers(f, 'hearty').find(offer => offer.id === 'dish:strawberryTart')!.eligible, false, 'sweet pastry does not satisfy an unsweet lunch');
  assert.equal(getIntentOffers(f, 'sharing').find(offer => offer.id === 'handmade:long')!.eligible, false, 'shareable plain bread does not satisfy a sweet gathering');
  const examples = { berry: ['dish:strawberryTart', 'dish:blueberryTart'], fruit: ['dish:appleJam', 'dish:orchardTart'], delicate: ['signature:s1', 'dish:windParfait'], hearty: ['dish:grilledFish', 'dish:farmhouseBread'], portable: ['handmade:round', 'dish:honeyBiscuits'], sharing: ['dish:honeyCake', 'dish:raspberryTart'] } as const;
  for (const intent of intentIds) {
    for (const id of examples[intent]) { const offer = getIntentOffers(f, intent).find(offer => offer.id === id)!; assert.ok(offer.eligible, `${intent}: ${id}`); assert.equal(offer.matchCount, 2); }
    assert.equal(getIntentOffers(f, intent)[0].requestChips.length, 2);
  }
  for (const order of getCommunityOrders(f)) assert.equal(order.chips.length, 2);
});

test('uninvited neighbors have no plan, preparation survives a skipped day, and joining alone consumes nothing', () => {
  const f = farm(); f.village.residents = [null, null]; assert.deepEqual(getNeighborPlans(f), []); assert.equal(joinNeighborPlan(f, 'bea:1').ok, false);
  f.village.residents = ['bea', null]; f.island = 'village'; const p = getNeighborPlans(f)[0]; assert.equal(p.phase, 'preparing'); assert.match(p.preparation, /чашки/);
  assert.ok(joinNeighborPlan(f, p.id).ok); const count = f.culinary.stock.s1; assert.ok(serveNeighborPlan(f, p.id, 'signature:s1').ok); assert.equal(f.culinary.stock.s1, count);
  f.island = 'home'; endDay(f); endDay(f); const returned = load(f); returned.island = 'village';
  assert.equal(getNeighborPlans(returned)[0].phase, 'arranging'); assert.equal(getNeighborPlans(returned)[0].id, p.id); assert.equal(returned.culinary.stock.s1, count);
});

test('cancelled or invalid physical arrangement is free; successful assembly revalidates and consumes once across reload', () => {
  const f = farm(); f.island = 'village'; const p = select(f, 'bea', 'signature:s1'), snapshot = structuredClone(f);
  assert.equal(finishNeighborPlan(f, p.id, assembly('basket')).ok, false); assert.deepEqual(f, snapshot);
  assert.equal(finishNeighborPlan(f, p.id, { ...assembly('table'), placements: assembly('table').placements.map(point => ({ ...point, x: 0, y: 0 })) }).ok, false); assert.deepEqual(f, snapshot);
  f.culinary.stock.s1 = 0; const empty = structuredClone(f); assert.equal(finishNeighborPlan(f, p.id, assembly('table')).ok, false); assert.deepEqual(f, empty);
  f.culinary.stock.s1 = 2; const coins = f.coins; assert.ok(finishNeighborPlan(f, p.id, assembly('table')).ok); assert.equal(f.culinary.stock.s1, 1); assert.equal(f.coins, coins + 30);
  const restored = load(f), settled = structuredClone(restored); assert.ok(restored); assert.equal(getNeighborPlans(restored)[0].phase, 'celebrating');
  assert.equal(finishNeighborPlan(restored, p.id, assembly('table')).ok, false); assert.deepEqual(restored, settled);
});

test('both neighbors complete distinct alternating episodes with persistent memories and an enforced daily pause', () => {
  let f = farm(); f.island = 'village';
  for (let day = 0; day < 2; day++) {
    for (const resident of ['bea', 'finn'] as const) {
      const p = select(f, resident, day === 0 ? resident === 'bea' ? 'signature:s1' : 'handmade:round' : resident === 'bea' ? 'handmade:round' : 'dish:strawberryTart');
      assert.ok(finishNeighborPlan(f, p.id, assembly(p.arrangement)).ok); assert.ok(advanceNeighborPlan(f, p.id).ok);
      assert.equal(getNeighborPlans(f).find(plan => plan.resident === resident)!.phase, 'remembered');
      assert.equal(advanceNeighborPlan(f, p.id).ok, false);
    }
    f = load(f); assert.ok(f); if (day === 0) { f.island = 'home'; endDay(f); f.island = 'village'; }
  }
  for (const resident of ['bea', 'finn'] as const) {
    const history = f.neighbors[resident]; assert.equal(history.completed, 2); assert.equal(history.memories.length, 2);
    assert.notEqual(history.memories[0].episode, history.memories[1].episode);
    const p = getNeighborPlans(f).find(plan => plan.resident === resident)!; assert.match(p.preparation, /помнит/); assert.equal(p.memoryCount, 2);
  }
});

test('remembered gatherings change the next real baking and fishing help and consume the bonus once', () => {
  const f = farm(); f.island = 'village';
  for (const resident of ['bea', 'finn'] as const) { const p = select(f, resident, resident === 'bea' ? 'signature:s1' : 'handmade:round'); assert.ok(finishNeighborPlan(f, p.id, assembly(p.arrangement)).ok); }
  const before = f.handmade.long; assert.ok(runResidentService(f, 'bea', 'long').ok); assert.equal(f.handmade.long, before + 4); assert.equal(f.neighbors.bea.helpReady, false);
  assert.ok(runResidentService(f, 'finn').ok); assert.equal(getFishingTripConfig(f).resilience, 5); assert.ok(load(f));
});

test('bringing an expensive tart to a neighbor preserves its market value and pays only once', () => {
  const f = farm(); f.island = 'village';
  const p = select(f, 'bea', 'dish:strawberryTart'), coins = f.coins;
  assert.ok(finishNeighborPlan(f, p.id, assembly('table')).ok);
  assert.equal(f.coins - coins, 45);
  assert.equal(f.dishes.strawberryTart, 2);
  assert.equal(f.neighbors.bea.helpReady, true);
  const settled = structuredClone(f);
  assert.equal(finishNeighborPlan(f, p.id, assembly('table')).ok, false);
  assert.deepEqual(f, settled);
});

test('old saves migrate without losing inventory; malformed community journals and plan states are rejected', () => {
  const f = farm(), old: any = structuredClone(f); delete old.neighbors; delete old.intentOrders; const migrated = restoreFarm(old)!;
  assert.ok(migrated); assert.equal(migrated.handmade.folded, f.handmade.folded); assert.equal(getNeighborPlans(migrated).length, 2);
  f.island = 'village'; const p = select(f, 'bea', 'signature:s1'); finishNeighborPlan(f, p.id, assembly('table')); assert.ok(load(f));
  for (const mutate of [(x: any) => x.neighbors.bea.current.serial = 3, (x: any) => x.neighbors.bea.current.phase = 'unknown', (x: any) => x.neighbors.bea.memories[0].episode = 'finnShore', (x: any) => x.neighbors.bea.memories[0].day = 99, (x: any) => x.intentOrders.berry.deliveredOn = 99, (x: any) => x.neighbors.finn.helpReady = true]) {
    const bad = structuredClone(f); mutate(bad); assert.equal(restoreFarm(bad), undefined);
  }
});

test('grilled fish requires the manual process, preserves actual garnish and atomically spends the original ingredients', () => {
  const f = farm(); f.fish.seaBass = 2; f.seaSalt = 2; f.produce.carrot = 2;
  const result: CookeryResult = { family: 'grilledFish', fruit: [], garnish: [{ ingredientId: 'carrot', x: .4, y: -.2, angle: .6 }], steps: ['season-fish', 'grill-first-side', 'turn-fish', 'grill-second-side', 'plate-fish', 'arrange-carrot'], baking: { method: 'grill', finish: 'golden', seconds: 18 } };
  const before = structuredClone(f); assert.equal(cookDish(f, 'grilledFish').ok, false); assert.equal(cookDish(f, 'grilledFish', { ...result, steps: ['plate-fish'] }).ok, false); assert.deepEqual(f, before);
  assert.ok(cookDish(f, 'grilledFish', result).ok); assert.equal(f.fish.seaBass, 1); assert.equal(f.seaSalt, 1); assert.equal(f.produce.carrot, 1); assert.equal(f.dishes.grilledFish, 1);
  result.garnish![0].x = 0; assert.equal(f.culinary.lastDishes.grilledFish.garnish![0].x, .4); assert.ok(load(f));
});

test('optional manual egg packing proof preserves coop upgrade gates and rejects overlapping or wrong-count layouts for free', () => {
  const f = farm(); const before = structuredClone(f);
  assert.equal(packEggBasket(f, { kind: 'basket', settled: true, placements: [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }] }).ok, false); assert.deepEqual(f, before);
  assert.ok(packEggBasket(f, { kind: 'basket', settled: true, placements: [{ x: -.5, y: 0 }, { x: 0, y: 0 }, { x: .5, y: 0 }] }).ok); assert.equal(f.eggs, 17);
  const proof = { kind: 'crate' as const, settled: true as const, placements: [-.8, -.4, 0, .4, .8].map(x => ({ x, y: 0 })) };
  assert.equal(packEggCrate(f, proof).ok, false); f.coopSpecialization = 'packing'; f.buildingLevels.coop = 3; assert.ok(packEggCrate(f, proof).ok); assert.equal(f.eggs, 12); assert.ok(load(f));
});

test('Bea accepts a personally composed tart made in the village and takes exactly one portion after serving', () => {
  const f = farm(); f.island = 'village';
  const plan = getNeighborPlans(f).find(p => p.resident === 'bea')!;
  assert.ok(joinNeighborPlan(f, plan.id).ok);
  const receipt = completeSignature(f, {base:'tart', ingredients:[{id:'blueberry',quantity:2}]},
    {family:'decorate',fruit:[],steps:['fruit','finish']});
  assert.ok(receipt.ok);
  const id = `signature:${receipt.recipeId}` as const;
  const offer = getIntentOffers(f, plan.intentId).find(o => o.id === id)!;
  assert.ok(offer.available);
  assert.ok(serveNeighborPlan(f, plan.id, id).ok);
  assert.equal(f.culinary.stock[receipt.recipeId!],1);
  const arranged = assembly('table');
  assert.ok(finishNeighborPlan(f,plan.id,{...arranged,placements:arranged.placements.map(p=>p.slot==='food'?{...p,x:.72,y:-.13}:p)}).ok);
  assert.equal(f.culinary.stock[receipt.recipeId!],0);
  assert.equal(f.island,'village');
});
