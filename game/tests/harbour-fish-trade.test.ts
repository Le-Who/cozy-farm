import test from 'node:test'
import assert from 'node:assert/strict'
import { createFarm, endDay, restoreCurrentFarm, getVillageMeal, serveVillageMeal, type FarmState } from '../src/farm.ts'
import { sendFerryExpedition, receiveFerryExpedition, expeditionWallet } from '../src/harbour-economy.ts'
import { quoteExpedition, combinedExpeditionId } from '../src/ferry-expeditions.ts'
import { getFerryRestockPlan } from '../src/ferry-restock.ts'
import { getHarbourFishRoute, renderHarbourFishChoice } from '../src/harbour-fish-route.ts'
import { getRequirementHint } from '../src/requirement-guidance.ts'
import { isGuardedAction } from '../src/action-click-guard.ts'

function ready(): FarmState { const f=createFarm(); f.boatOwned=true; f.coins=60; f.freight.expeditions.markets.mill.visits=1; f.freight.expeditions.discovered.push('salt'); return f }
function reload(f:FarmState) { const restored=restoreCurrentFarm(JSON.parse(JSON.stringify(f))); assert.ok(restored); return restored }
function unchanged(f:FarmState, action:()=>{ok:boolean}) { const before=structuredClone(f); assert.equal(action().ok,false); assert.deepEqual(f,before) }

test('a limited paid catch requires the discovered lighthouse and is never free fish',()=>{
 const f=ready(); const q=quoteExpedition(f.freight.expeditions,'salt-fish',expeditionWallet(f))!
 assert.deepEqual(q.incoming,[{id:'seaBass',quantity:2}]);assert.deepEqual(q.outgoing,[]);assert.equal(q.payCoins,28);assert.equal(q.earnCoins,0);assert.equal(q.harvestBonus,0)
 f.freight.expeditions.discovered=['mill'];unchanged(f,()=>sendFerryExpedition(f,'salt-fish'))
 f.freight.expeditions.discovered.push('salt');f.coins=27;unchanged(f,()=>sendFerryExpedition(f,'salt-fish'))
 f.coins=28;f.freight.expeditions.markets.salt.stock.seaBass=1;unchanged(f,()=>sendFerryExpedition(f,'salt-fish'))
})

test('dispatch reserves actual port fish, survives a long absence, and claims once without recording a catch',()=>{
 let f=ready();const prior=structuredClone(f.fishCaughtToday)
 assert.ok(sendFerryExpedition(f,'salt-fish').ok);assert.equal(f.coins,32);assert.equal(f.fish.seaBass,0);assert.equal(f.freight.expeditions.markets.salt.stock.seaBass,0)
 f=reload(f);unchanged(f,()=>receiveFerryExpedition(f));unchanged(f,()=>sendFerryExpedition(f,'salt-fish'))
 for(let n=0;n<30;n++){assert.ok(endDay(f).ok);f=reload(f)}
 const beforeClaim=f.coins;assert.ok(receiveFerryExpedition(f).ok);f=reload(f);assert.equal(f.fish.seaBass,2);assert.equal(f.coins,beforeClaim);assert.deepEqual(f.fishCaughtToday,prior)
 assert.ok(f.bayDiscoveries.includes('seaBass'));unchanged(f,()=>receiveFerryExpedition(f))
})

test('buying and exporting the same catch cannot create a profitable round trip',()=>{
 const f=ready();f.fish.seaBass=2
 const q=quoteExpedition(f.freight.expeditions,combinedExpeditionId('salt-fish','salt-catch')!,expeditionWallet(f))!
 assert.equal(q.payCoins,14);assert.equal(q.earnCoins,0)
 assert.deepEqual(q.outgoing,[{id:'seaBass',quantity:2}]);assert.deepEqual(q.incoming,[{id:'seaBass',quantity:2},{id:'seaSalt',quantity:2}])
 // The gained salt sells for 8, less than the 14 paid. Actual fishing still supplies the more valuable net export.
 assert.ok(sendFerryExpedition(f,q.id).ok);assert.ok(reload(f));assert.ok(endDay(f).ok);assert.ok(receiveFerryExpedition(f).ok)
 assert.equal(f.fish.seaBass,2);assert.equal(f.seaSalt,2);assert.equal(f.coins,46)
})

test('an empty local catch has an honest multi-morning restock, not a compulsory personal catch',()=>{
 const f=ready();f.freight.expeditions.markets.salt.stock.seaBass=0
 const before=structuredClone(f), plan=getFerryRestockPlan(f.freight.expeditions,'salt-fish',f.day,expeditionWallet(f))
 assert.equal(plan?.kind,'rest');assert.equal(plan?.day,3);assert.equal(plan?.stock[0].nextMorning,2);assert.deepEqual(f,before)
 assert.ok(endDay(f).ok);assert.equal(quoteExpedition(f.freight.expeditions,'salt-fish',expeditionWallet(f))?.available,false)
 assert.ok(endDay(f).ok);assert.equal(quoteExpedition(f.freight.expeditions,'salt-fish',expeditionWallet(f))?.available,true)
})

test('route previews retain an active voyage, show preparation, and never spend supplies',()=>{
 const f=createFarm(),before=structuredClone(f)
 assert.match(renderHarbourFishChoice(f,'supper'),/обычный окунь или морской окунь/);assert.match(renderHarbourFishChoice(f),/28 монет/);assert.match(renderHarbourFishChoice(f),/Поймать бесплатно/);assert.equal(getHarbourFishRoute(f).label,'Посмотреть лодку');assert.deepEqual(f,before)
 f.boatOwned=true;assert.equal(getHarbourFishRoute(f).offer,'mill-sale')
 f.freight.expeditions.markets.mill.visits=1;assert.equal(getHarbourFishRoute(f).offer,'explore-salt')
 f.freight.expeditions.discovered.push('salt');assert.equal(getHarbourFishRoute(f).offer,'salt-fish')
 f.coins=28;assert.ok(sendFerryExpedition(f,'salt-fish').ok);assert.equal(getHarbourFishRoute(f).offer,'salt-fish');assert.equal(getHarbourFishRoute(f).label,'К текущему рейсу')
 assert.ok(isGuardedAction('harbour-fish-trade'));assert.ok(isGuardedAction('harbour-fish-catch'))
})

test('a bought ordinary sea bass can feed Bea while rare fish are never silently substituted',()=>{
 const f=ready();f.island='village';f.village.built=true;f.village.residents[0]='bea';f.handmade.round=1;f.fish.seaBass=1
 assert.equal(getVillageMeal(f).fish,'seaBass');assert.ok(serveVillageMeal(f,'round').ok);assert.equal(f.fish.seaBass,0);assert.equal(f.village.meals,1)
 f.village.mealOn=0;f.handmade.round=1;f.fish.moonfish=1;f.fish.lanternfish=1
 assert.equal(getVillageMeal(f).available,false);unchanged(f,()=>serveVillageMeal(f,'round'))
 f.fish.perch=1;assert.equal(getVillageMeal(f).fish,'perch');f.fish.seaBass=1;assert.equal(getVillageMeal(f).fish,'perch')
 f.village.residents[0]='finn';assert.equal(getVillageMeal(f).fish,'seaBass')
})


test('the island checklist offers a choice only while fish are actually missing',()=>{
 const f=ready(), before=structuredClone(f)
 const req={kind:'journey',island:'village',id:'supply-fish'} as const
 assert.match(getRequirementHint(f,req).notice!,/паромом/);assert.deepEqual(f,before)
 f.fish.seaBass=2;assert.equal(getRequirementHint(f,req).notice,undefined)
 f.fish.seaBass=0;f.village.supplies['fish:seaBass']=2;assert.equal(getRequirementHint(f,req).notice,undefined)
})

test('an active local kitchen gives an exact finite restock date and preserves the preview',()=>{
 for(let dishes=0;dishes<=4;dishes++){
  const f=ready(), market=f.freight.expeditions.markets.salt
  market.stock.seaBass=0;market.stock.carrot=12;market.stock.seaSalt=12;market.stock['dish:grilledFish']=dishes
  market.supplied={carrot:6,seaBass:4}
  const before=structuredClone(f), plan=getFerryRestockPlan(f.freight.expeditions,'salt-fish',f.day,expeditionWallet(f))!
  assert.equal(plan.kind,'rest');assert.equal(plan.day,7-dishes);assert.deepEqual(f,before)
  while(f.day<plan.day){assert.equal(quoteExpedition(f.freight.expeditions,'salt-fish',expeditionWallet(f))!.available,false);assert.ok(endDay(f).ok)}
  assert.equal(quoteExpedition(f.freight.expeditions,'salt-fish',expeditionWallet(f))!.available,true)
 }
})
