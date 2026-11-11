import assert from 'node:assert/strict';
import test from 'node:test';
import { createFarm, endDay, restoreFarm } from '../src/farm.ts';
import { combinedExpeditionId, expeditionOfferIds, expeditionTrades, quoteExpedition, restoreFerryExpeditions } from '../src/ferry-expeditions.ts';
import { expeditionWallet, sendFerryExpedition, receiveFerryExpedition } from '../src/harbour-economy.ts';

const setup = () => { const farm=createFarm(); farm.boatOwned=true; farm.coins=100; farm.produce.wheat=30; farm.eggs=20; return farm; };
const pair = (a='mill-grain', b='mill-eggs') => combinedExpeditionId(a,b)!;
const reload = (farm: ReturnType<typeof setup>) => { const value=restoreFarm(JSON.parse(JSON.stringify(farm))); assert.ok(value); return value; };

test('two different orders share a pure exact quote with combined cargo and one harvest premium', () => {
  const farm=setup(); farm.festivals.completed.harvest=3; const before=structuredClone(farm), id=pair();
  assert.deepEqual(expeditionOfferIds(id),['mill-grain','mill-eggs']);
  for(let i=0;i<4;i++) {
    const q=quoteExpedition(farm.freight.expeditions,id,expeditionWallet(farm))!;
    assert.equal(q.available,true); assert.deepEqual(q.outgoing,[{id:'eggs',quantity:4},{id:'wheat',quantity:4}]);
    assert.deepEqual(q.incoming,[{id:'handmade:round',quantity:2}]); assert.equal(q.payCoins,0); assert.equal(q.earnCoins,13); assert.equal(q.harvestBonus,3);
    q.outgoing[0].quantity=900;
  }
  assert.deepEqual(farm,before);
  const reversed=quoteExpedition(farm.freight.expeditions,pair('mill-eggs','mill-grain'),expeditionWallet(farm))!;
  assert.equal(reversed.earnCoins,13); assert.deepEqual(reversed.incoming,[{id:'handmade:round',quantity:2}]);
});

test('selling and buying in one voyage uses the shown net payment exactly once', () => {
  let farm=setup();farm.coins=5;const id=pair('mill-sale','mill-buy');
  const q=quoteExpedition(farm.freight.expeditions,id,expeditionWallet(farm))!;
  assert.equal(q.payCoins,5);assert.equal(q.earnCoins,0);assert.ok(sendFerryExpedition(farm,id).ok);
  assert.equal(farm.coins,0);assert.equal(farm.produce.wheat,28);assert.equal(farm.handmade.round,0);
  farm=reload(farm);assert.ok(endDay(farm).ok);farm=reload(farm);assert.ok(receiveFerryExpedition(farm).ok);
  assert.equal(farm.coins,0);assert.equal(farm.handmade.round,1);assert.ok(reload(farm));
});

test('aggregate bag, port stock, destination capacity and payment shortages fail atomically', () => {
  for(const scenario of ['bag','stock','capacity','coins'] as const) {
    const farm=setup();let id=pair('mill-grain','mill-baking');
    if(scenario==='bag')farm.produce.wheat=4;
    if(scenario==='stock')farm.freight.expeditions.markets.mill.stock['handmade:round']=2;
    if(scenario==='capacity')farm.freight.expeditions.markets.mill.stock.wheat=18;
    if(scenario==='coins'){id=pair('mill-sale','mill-buy');farm.coins=4;}
    const before=structuredClone(farm);assert.equal(quoteExpedition(farm.freight.expeditions,id,expeditionWallet(farm))?.available,false,scenario);
    assert.equal(sendFerryExpedition(farm,id).ok,false);assert.deepEqual(farm,before);
  }
});

test('duplicates, mixed ports, exploration, unknown orders and more than two orders are rejected', () => {
  assert.equal(combinedExpeditionId('mill-grain','mill-grain'),undefined);
  assert.equal(combinedExpeditionId('mill-grain','salt-buy'),undefined);
  assert.equal(combinedExpeditionId('explore-salt','mill-grain'),undefined);
  const farm=setup(),before=structuredClone(farm);
  for(const id of ['pair:mill-grain+mill-grain','pair:mill-grain+salt-buy','pair:mill-grain+missing','pair:mill-grain+mill-eggs+mill-sale','pair:explore-salt+mill-buy','pair:mill-buy+']) {
    assert.equal(quoteExpedition(farm.freight.expeditions,id,expeditionWallet(farm)),undefined,id);
    assert.equal(sendFerryExpedition(farm,id).ok,false);assert.deepEqual(farm,before);
  }
  farm.freight.expeditions.discovered.push('salt');
  assert.equal(quoteExpedition(farm.freight.expeditions,pair('salt-buy','salt-grill'),expeditionWallet(farm))?.available,false);
});

test('a combined receipt is frozen through night and reload, collected once, and counts one voyage', () => {
  let farm=setup();const before=structuredClone(farm),id=pair();
  assert.ok(sendFerryExpedition(farm,id).ok);assert.equal(farm.produce.wheat,26);assert.equal(farm.eggs,16);assert.equal(farm.coins,100);
  const receipt=structuredClone(farm.freight.expeditions.active)!;
  const sent=structuredClone(farm);assert.equal(sendFerryExpedition(farm,id).ok,false);assert.deepEqual(farm,sent);
  farm=reload(farm);farm.freight.expeditions.markets.mill.stock.wheat=10;
  assert.ok(endDay(farm).ok);farm=reload(farm);
  assert.deepEqual(farm.freight.expeditions.active,{...receipt,phase:'ready'});
  assert.equal(farm.freight.expeditions.markets.mill.supplied.wheat,4);assert.equal(farm.freight.expeditions.markets.mill.supplied.eggs,4);
  assert.ok(receiveFerryExpedition(farm).ok);farm=reload(farm);
  assert.equal(farm.handmade.round,before.handmade.round+2);assert.equal(farm.coins,110);
  assert.equal(farm.freight.expeditions.serial,1);assert.equal(farm.freight.expeditions.completed,1);assert.equal(farm.freight.expeditions.markets.mill.visits,1);
  const claimed=structuredClone(farm);assert.equal(receiveFerryExpedition(farm).ok,false);assert.deepEqual(farm,claimed);
});

test('damaged combined manifests reject loading instead of losing or minting paid cargo', () => {
  const farm=setup();assert.ok(sendFerryExpedition(farm,pair()).ok);
  for(const change of [
    (x:any)=>x.incoming[0].quantity++, (x:any)=>x.outgoing[0].quantity++,
    (x:any)=>x.id='pair:mill-grain+salt-buy', (x:any)=>x.id='pair:mill-grain+mill-grain',
    (x:any)=>x.payCoins=-1, (x:any)=>x.earnCoins=101, (x:any)=>{x.payCoins=1;x.earnCoins=11}, (x:any)=>x.earnCoins=50, (x:any)=>x.harvestBonus=4,
  ]) { const raw=structuredClone(farm);change(raw.freight.expeditions.active);assert.equal(restoreFarm(raw),undefined); }
});

test('single-order receipts remain unchanged and roundtrip in the extended reader', () => {
  const farm=setup();assert.ok(sendFerryExpedition(farm,'mill-grain').ok);
  const world=structuredClone(farm.freight.expeditions);
  assert.deepEqual(restoreFerryExpeditions(world,farm.day),world);assert.deepEqual(reload(farm),farm);
  assert.deepEqual(expeditionOfferIds('mill-grain'),['mill-grain']);assert.deepEqual(expeditionOfferIds('explore-salt'),[]);
});

test('every available pair survives sailing, arrival and collection at each demand level', () => {
  let completed = 0, unavailable = 0;
  for (const port of ['mill', 'salt', 'orchard'] as const) for (const stock of [0, 5, 10]) {
    const template = setup();
    template.coins = 10000;
    template.freight.expeditions.discovered = ['mill', 'salt', 'orchard'];
    for (const market of Object.values(template.freight.expeditions.markets))
      market.supplied = { wheat: 100, eggs: 100, carrot: 100, seaBass: 100, apple: 100, 'handmade:round': 100 };
    template.produce.wheat = template.produce.carrot = template.eggs = template.fruit.apple = template.handmade.round = template.fish.seaBass = 100;
    const market = template.freight.expeditions.markets[port];
    for (const id of port === 'mill' ? ['wheat', 'eggs'] : port === 'salt' ? ['carrot', 'seaBass'] : ['apple']) market.stock[id] = stock;
    assert.ok(restoreFarm(template), `valid fixture ${port}/${stock}`);
    const offers = expeditionTrades(template.freight.expeditions, port);
    for (let first = 0; first < offers.length; first++) for (let second = first + 1; second < offers.length; second++) {
      let farm = structuredClone(template);
      const id = combinedExpeditionId(offers[first].id, offers[second].id)!;
      const quote = quoteExpedition(farm.freight.expeditions, id, expeditionWallet(farm))!;
      if (!quote.available) { unavailable++; continue; }
      assert.ok(sendFerryExpedition(farm, id).ok, id);
      farm = reload(farm);
      assert.ok(endDay(farm).ok, id);
      farm = reload(farm);
      assert.ok(receiveFerryExpedition(farm).ok, id);
      farm = reload(farm);
      assert.equal(farm.freight.expeditions.completed, 1, id);
      assert.equal(farm.freight.expeditions.active, null, id);
      completed++;
    }
  }
  assert.ok(completed > 40);
  assert.ok(unavailable > 0);
});
