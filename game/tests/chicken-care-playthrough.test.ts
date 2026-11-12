import assert from 'node:assert/strict'
import test from 'node:test'
import { chickenCarePlayer } from './fixtures/chicken-care-player.ts'

test('nine earned thirty-day care routes stay solvent, hatch or pack, and home mixtures do not multiply production',()=>{
 for(const branch of ['basic','hatchery','packing'] as const){
  const players=(['shop','garden','orchard'] as const).map(policy=>chickenCarePlayer(policy,branch))
  const results=players.map(player=>player.run(30))
  for(const player of players){assert.deepEqual(player.opening,{coins:122,actions:18});assert.ok(player.log.every(a=>a.coins>=0));assert.equal(player.state.chickensFed,true)}
  for(const [index,result] of results.entries()){
   assert.ok(result.coins>100);assert.equal(result.happiness,5);assert.equal(result.flock,branch==='hatchery'?5:4)
   if(index){assert.ok(result.mixes>5);assert.equal(result.boughtBags,0);assert.ok(result.includingFeed-results[0].includingFeed<30)}
   assert.deepEqual(players[index].log.filter(x=>x.name==='collectEggs'||x.name==='packEggBasket'||x.name==='packEggCrate').map(x=>({name:x.name,day:x.day})),players[0].log.filter(x=>x.name==='collectEggs'||x.name==='packEggBasket'||x.name==='packEggCrate').map(x=>({name:x.name,day:x.day})))
  }
 }
})

test('an earned batch can be kept or consumed tomorrow without an automatic feeding or extra care requirement',()=>{
 const p=chickenCarePlayer('orchard');p.day();p.act('endDay');p.day();p.act('endDay')
 // Harvest the planted wheat, then deliberately prepare before the daily routine.
 p.act('workBed',4);p.act('mixChickenFeed','orchard')
 const feed=p.state.feed;assert.equal(p.state.chickensFed,false)
 p.act('endDay');assert.equal(p.state.feed,feed)
 p.act('feedChickens');assert.equal(p.state.feed,feed-1)
})
