import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { harbourTradePlayer } from './fixtures/harbour-trade-player.ts'
import { contributeVillage, getVillageHomeCount } from '../src/farm.ts'
import { getHarbourFishRoute } from '../src/harbour-fish-route.ts'
const opening=JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json',import.meta.url),'utf8'))

test('an earned no-fishing route builds the harbour and both homes through finite paid trade',()=>{
 const p=harbourTradePlayer(opening)
 assert.equal(p.blocked.day,8);assert.equal(p.state.coins,120);assert.equal(p.state.village.built,false)
 assert.equal(p.blocked.project.items.find(r=>r.item.kind==='fish')!.delivered,0)
 p.build();assert.equal(p.state.village.built,true);assert.equal(p.state.fishingTripSerial,0)
 const built=structuredClone(p.state);assert.equal(contributeVillage(p.state).ok,false);assert.deepEqual(p.state,built)
 assert.deepEqual(p.state.village.supplies,{'handmade:round':2,'fish:seaBass':2,honey:2})
 p.twoHomes();assert.equal(getVillageHomeCount(p.state),2);assert.deepEqual(p.state.village.residents,['bea','finn'])
 assert.equal(p.state.village.meals,2);assert.equal(p.state.fish.seaBass,0);assert.equal(p.state.fish.perch,0)
 assert.equal(p.state.fishingTripSerial,0);assert.equal(p.log.some(c=>/Fishing|catchFish/.test(c.name)),false)
 assert.ok(p.state.coins>=0);p.reload()
})

test('preparing the trade branch never consumes an existing partial construction contribution',()=>{
 const p=harbourTradePlayer(opening);const supplies=structuredClone(p.state.village.supplies)
 p.prepare();const before=structuredClone(p.state);assert.equal(getHarbourFishRoute(p.state).offer,'mill-sale');assert.deepEqual(p.state,before)
 p.voyage('mill-sale');assert.deepEqual(p.state.village.supplies,supplies);p.voyage('explore-salt');assert.deepEqual(p.state.village.supplies,supplies)
 p.voyage('salt-fish');assert.deepEqual(p.state.village.supplies,supplies);assert.equal(p.state.village.built,false)
 p.act('contributeVillage');assert.equal(p.state.village.built,true)
})

test('purchased fish record a delivery, never the personal catch festival activity',()=>{
 const p=harbourTradePlayer(opening);p.build();p.twoHomes();p.wheat(2);p.voyage('mill-sale')
 p.visit('village');p.act('beginFestival','lights');p.voyage('salt-fish')
 assert.equal(p.state.festivals.active!.activity.fish,false)
 assert.equal(p.state.festivals.active!.cargoDelivered,2)
 assert.equal(p.state.fishingTripSerial,0);p.reload()
})


test('buying the first bun trades coins for time while remaining viable without fishing',()=>{
 const p=harbourTradePlayer(opening);p.build('mill-buy')
 assert.equal(p.state.day,13);assert.equal(p.state.coins,29);assert.equal(p.state.handmade.round,1)
 p.twoHomes();assert.equal(getVillageHomeCount(p.state),2);assert.equal(p.state.day,17);assert.equal(p.state.coins,1)
 assert.equal(p.state.fishingTripSerial,0);assert.equal(p.log.some(c=>/Fishing|catchFish/.test(c.name)),false);p.reload()
 // The low-coin faster route still has a free, ordinary way to fund new seed.
 p.visit('home');p.act('pickFruit',0);p.act('sellMarketItem','fruit:apple',1);assert.ok(p.state.coins>=4)
})
