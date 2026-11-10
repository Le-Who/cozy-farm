import assert from 'node:assert/strict';
import test from 'node:test';
import { createFarm, restoreFarm, endDay, type FarmState } from '../src/farm.ts';
import { createFerryExpeditions, quoteExpedition, dispatchExpedition, advanceExpeditions, finishExpedition, expeditionStock, portProjectComplete, restoreFerryExpeditions } from '../src/ferry-expeditions.ts';
import { sendFerryExpedition, receiveFerryExpedition, expeditionWallet, installGardenInstrument, gardenMaterialStock } from '../src/harbour-economy.ts';
const loadedFarm = () => { const farm = createFarm(); farm.boatOwned=true; farm.coins=100; farm.produce.wheat=30; farm.produce.carrot=20; farm.fruit.apple=20; farm.eggs=20; farm.fish.seaBass=20; return farm; };
const reload = (farm:FarmState):FarmState => { const restored=restoreFarm(JSON.parse(JSON.stringify(farm))); assert.ok(restored,'honestly acquired cargo must survive reload'); return restored; };
function roundTrip(farm:FarmState,id:string):FarmState { assert.ok(sendFerryExpedition(farm,id).ok,id); farm=reload(farm); assert.ok(endDay(farm).ok); farm=reload(farm); assert.ok(receiveFerryExpedition(farm).ok); return reload(farm); }

test('the first cargo costs no coins, has a fixed receipt and is received once before baking is learned',()=>{
  let farm=loadedFarm();farm.coins=0;const before=farm.produce.wheat;
  const quote=quoteExpedition(farm.freight.expeditions,'mill-grain',expeditionWallet(farm))!;
  assert.equal(quote.payCoins,0);assert.equal(quote.earnCoins,5);
  assert.deepEqual(quote.incoming,[{id:'handmade:round',quantity:1}]);
  assert.ok(sendFerryExpedition(farm,'mill-grain').ok);assert.equal(farm.produce.wheat,before-4);
  const sent=structuredClone(farm);assert.equal(sendFerryExpedition(farm,'mill-grain').ok,false);assert.deepEqual(farm,sent);
  farm=reload(farm);const frozen=structuredClone(farm.freight.expeditions.active);
  farm.freight.expeditions.markets.mill.stock.wheat=12;
  assert.ok(endDay(farm).ok);assert.equal(farm.freight.expeditions.active?.earnCoins,frozen?.earnCoins);
  assert.ok(receiveFerryExpedition(farm).ok);assert.equal(farm.handmade.round,1);assert.equal(farm.coins,5);assert.deepEqual(farm.workshopPatterns,[]);
  farm=reload(farm);const received=structuredClone(farm);assert.equal(receiveFerryExpedition(farm).ok,false);assert.deepEqual(farm,received);
});

test('shortages and locked destinations are atomic, and alternatives consume one shared export stock',()=>{
  const farm=loadedFarm();farm.produce.wheat=0;const initial=structuredClone(farm);
  assert.equal(sendFerryExpedition(farm,'mill-grain').ok,false);assert.deepEqual(farm,initial);
  assert.equal(sendFerryExpedition(farm,'salt-buy').ok,false);assert.deepEqual(farm,initial);
  farm.freight.expeditions.markets.mill.stock['handmade:round']=0;
  assert.equal(quoteExpedition(farm.freight.expeditions,'mill-buy',expeditionWallet(farm))?.available,false);
  assert.equal(quoteExpedition(farm.freight.expeditions,'mill-baking',expeditionWallet(farm))?.available,false);
});

test('a paid manifest persists without a deadline and cannot be claimed while sailing',()=>{
  let farm=loadedFarm();assert.ok(sendFerryExpedition(farm,'mill-baking').ok);
  const coins=farm.coins;assert.equal(receiveFerryExpedition(farm).ok,false);assert.equal(farm.coins,coins);
  for(let day=0;day<40;day++)endDay(farm);
  farm=reload(farm);assert.equal(farm.freight.expeditions.active?.phase,'ready');const beforeClaim=farm.coins;assert.ok(receiveFerryExpedition(farm).ok);
  assert.equal(farm.handmade.round,2);assert.equal(farm.coins,beforeClaim);
});

test('scouting is guaranteed and follows meaningful visits rather than repeated-grind counters',()=>{
  let farm=loadedFarm();assert.equal(sendFerryExpedition(farm,'explore-salt').ok,false);
  farm=roundTrip(farm,'mill-grain');farm=roundTrip(farm,'explore-salt');
  assert.deepEqual(farm.freight.expeditions.discovered,['mill','salt']);
  assert.equal(sendFerryExpedition(farm,'explore-salt').ok,false);
  assert.equal(sendFerryExpedition(farm,'explore-orchard').ok,false);
  farm=roundTrip(farm,'salt-carrots');farm=roundTrip(farm,'explore-orchard');
  assert.deepEqual(farm.freight.expeditions.discovered,['mill','salt','orchard']);
  for(const id of ['orchard-apples','orchard-buns','orchard-pears','orchard-peaches'])farm=roundTrip(farm,id);
  assert.ok(farm.fruit.peach>0);assert.ok(farm.fruit.pear>0);assert.ok(farm.dishes.appleJam>0);
  assert.ok(farm.bayDiscoveries.includes('peach'));assert.ok(farm.discoveries.peach?.regular);
});

test('delivery and local production are causal, finite and idempotent',()=>{
  const world=createFerryExpeditions();const wallet={boatOwned:true,bag:{wheat:40},coins:0};
  const before=expeditionStock(world,'mill','handmade:round');advanceExpeditions(world,20);
  assert.equal(expeditionStock(world,'mill','handmade:round'),before,'no flour, no new bread');
  assert.ok(dispatchExpedition(world,'mill-grain',20,wallet).ok);
  assert.equal(expeditionStock(world,'mill','wheat'),0,'not delivered on dispatch');
  advanceExpeditions(world,21);assert.equal(world.markets.mill.supplied.wheat,4);assert.equal(expeditionStock(world,'mill','wheat'),2);
  const once=structuredClone(world);advanceExpeditions(world,21);assert.deepEqual(world,once);
  finishExpedition(world,21);advanceExpeditions(world,22);assert.equal(expeditionStock(world,'mill','wheat'),0);
  advanceExpeditions(world,1000);assert.ok(expeditionStock(world,'mill','handmade:round')<=4);
});

test('natural replenishment never deletes imported goods above its buffer',()=>{
  const world=createFerryExpeditions();world.discovered.push('salt');world.markets.salt.stock.seaBass=6;
  assert.ok(dispatchExpedition(world,'salt-catch',1,{boatOwned:true,bag:{seaBass:2},coins:0}).ok);
  advanceExpeditions(world,2);assert.equal(expeditionStock(world,'salt','seaBass'),8);
  assert.equal(world.markets.salt.supplied.seaBass,2);
});

test('commercial supply opens real production and is counted only on arrival',()=>{
  const world=createFerryExpeditions();world.markets.mill.supplied.wheat=8;
  assert.ok(dispatchExpedition(world,'mill-grain',1,{boatOwned:true,bag:{wheat:4},coins:100}).ok);
  assert.equal(portProjectComplete(world,'mill'),false);advanceExpeditions(world,2);
  assert.equal(portProjectComplete(world,'mill'),true);assert.equal(world.markets.mill.supplied.wheat,12);
  assert.equal(expeditionStock(world,'mill','wheat'),0,'two real batches in the second oven');
  assert.deepEqual(world.markets.mill.production,[{id:'handmade:round',quantity:2}]);
});

test('mid-voyage and waiting-at-home saves retain the exact quote and world state',()=>{
  const world=createFerryExpeditions();dispatchExpedition(world,'mill-grain',1,{boatOwned:true,bag:{wheat:4},coins:0});
  const restored=restoreFerryExpeditions(JSON.parse(JSON.stringify(world)),1);assert.deepEqual(restored,world);
  advanceExpeditions(world,5);advanceExpeditions(restored,5);assert.deepEqual(restored,world);
  assert.deepEqual(restoreFerryExpeditions(JSON.parse(JSON.stringify(restored)),5),world);
});

test('a corrupt paid receipt is rejected instead of silently deleting the shipment',()=>{
  const farm=loadedFarm();sendFerryExpedition(farm,'mill-grain');
  const corrupt=JSON.parse(JSON.stringify(farm));corrupt.freight.expeditions.active.incoming=[{id:'honey',quantity:999}];
  assert.equal(restoreFarm(corrupt),undefined);
  const future=JSON.parse(JSON.stringify(farm));future.freight.expeditions.version=99;
  assert.equal(restoreFarm(future),undefined);
});

test('music materials come from the common bag with compatible legacy stock and no double charge',()=>{
  const farm=loadedFarm();farm.island='village';farm.village.built=true;
  farm.shells.regular=4;farm.freight.warehouses.village.shells=2;farm.seaSalt=3;
  assert.equal(gardenMaterialStock(farm).shells,6);assert.equal(installGardenInstrument(farm),1);
  assert.equal(farm.shells.regular,0);assert.equal(farm.seaSalt,0);assert.equal(farm.freight.warehouses.village.shells??0,0);
  const once=structuredClone(farm);assert.equal(installGardenInstrument(farm),undefined);assert.deepEqual(farm,once);
});

test('harvest premium is bounded by traded crop units, frozen and applied to net money once',()=>{
  const farm=loadedFarm();farm.festivals.completed.harvest=3;
  const world=farm.freight.expeditions, wallet=expeditionWallet(farm);
  assert.equal(quoteExpedition(world,'mill-grain',wallet)?.earnCoins,8);
  assert.equal(quoteExpedition(world,'mill-sale',wallet)?.harvestBonus,2);
  assert.equal(quoteExpedition(world,'mill-baking',wallet)?.payCoins,7);
  assert.equal(quoteExpedition(world,'mill-eggs',wallet)?.harvestBonus,0);
  assert.equal(quoteExpedition(world,'mill-buy',wallet)?.harvestBonus,0);
  world.markets.mill.visits=1;
  assert.equal(quoteExpedition(world,'explore-salt',wallet)?.harvestBonus,0);
  const before=farm.coins;assert.ok(sendFerryExpedition(farm,'mill-grain').ok);
  farm.festivals.completed.harvest=0;
  advanceExpeditions(world,2);farm.day=2;
  const restored=reload(farm);assert.equal(restored.freight.expeditions.active?.harvestBonus,3);
  assert.ok(receiveFerryExpedition(restored).ok);assert.equal(restored.coins,before+8);
  assert.equal(receiveFerryExpedition(restored).ok,false);assert.equal(restored.coins,before+8);
});

test('retiring the old route returns remaining cargo rather than discarding it',()=>{
  const farm=loadedFarm();farm.freight.ship={phase:'sailing',from:'home',to:'grove',arrivesOn:2,cargo:[{id:'wheat',quantity:4,destination:'grove'}]};
  const before=farm.produce.wheat;assert.ok(sendFerryExpedition(farm,'mill-sale').ok);
  assert.equal(farm.produce.wheat,before-2+4);assert.deepEqual(farm.freight.ship.cargo,[]);
});

test('a new trade receipt supports the harbour festival once, exploration does not',()=>{
 const farm=loadedFarm();farm.festivals.active={tradition:'lights',edition:1,stage:0,startedOn:1,readyOn:0,performanceBaseline:0,materialValue:0,cargoDelivered:0,activity:{harvest:false,bake:false,fish:false,shore:false},delivered:{}};
 assert.ok(sendFerryExpedition(farm,'mill-grain').ok);advanceExpeditions(farm.freight.expeditions,2);farm.day=2;
 assert.ok(receiveFerryExpedition(farm).ok);assert.equal(farm.festivals.active.cargoDelivered,1);
 receiveFerryExpedition(farm);assert.equal(farm.festivals.active.cargoDelivered,1);
 assert.ok(sendFerryExpedition(farm,'explore-salt').ok);advanceExpeditions(farm.freight.expeditions,3);farm.day=3;
 receiveFerryExpedition(farm);assert.equal(farm.festivals.active.cargoDelivered,1);
});
