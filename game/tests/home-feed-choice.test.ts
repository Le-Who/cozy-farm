import test from 'node:test'
import assert from 'node:assert/strict'
import { buyFeed, feedChickens, restoreCurrentFarm } from '../src/farm.ts'
import { canMixBedtimeFeed, mixChickenFeed, renderChickenFeedMixes } from '../src/chicken-feed.ts'
import { chickenCarePlayer } from './fixtures/chicken-care-player.ts'

test('the earned home bedtime choice keeps buying, mixing and daily feeding distinct',()=>{
  const p=chickenCarePlayer('garden')
  p.day();p.act('endDay');p.day();p.act('endDay')
  p.act('workBed',4);p.act('workBed',9);p.act('pickFruit',0);p.act('collectEggs')
  const home=p.state, day=home.day
  assert.equal(day,3);assert.equal(home.feed,0);assert.equal(canMixBedtimeFeed(home),true)
  const before=structuredClone(home)
  assert.match(renderChickenFeedMixes(home,undefined,true),/data-action="back">К отдыху/)
  assert.match(renderChickenFeedMixes(home),/data-action="back">К курятнику/)
  assert.deepEqual(home,before)
  const bought=structuredClone(home);assert.ok(buyFeed(bought).ok)
  assert.equal(bought.coins,home.coins-4);assert.equal(bought.feed,2);assert.equal(bought.chickensFed,false)
  assert.deepEqual(bought.produce,home.produce)
  assert.equal(canMixBedtimeFeed(bought),false);assert.ok(feedChickens(bought).ok);assert.equal(bought.feed,1)
  assert.ok(mixChickenFeed(home,'garden').ok);assert.equal(home.coins,before.coins)
  assert.equal(home.produce.wheat,before.produce.wheat-1);assert.equal(home.produce.carrot,before.produce.carrot-1)
  assert.equal(home.feed,3);assert.equal(home.chickensFed,false);assert.equal(canMixBedtimeFeed(home),false)
  assert.ok(feedChickens(home).ok);assert.equal(home.feed,2);assert.ok(home.chickensFed)
  for(const f of [bought,home]){assert.equal(f.day,day);assert.deepEqual(restoreCurrentFarm(JSON.parse(JSON.stringify(f))),f)}
  const noWheat=structuredClone(before);noWheat.produce.wheat=0
  assert.equal(canMixBedtimeFeed(noWheat),false)
})
