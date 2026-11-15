import assert from 'node:assert/strict'
import test from 'node:test'
import { FerryArrivalPresentation } from '../src/ferry-arrival-presentation.ts'
import { createFarm, endDay, restoreFarm } from '../src/farm.ts'
import { sendFerryExpedition, receiveFerryExpedition } from '../src/harbour-economy.ts'

test('a real played-night arrival waits for its first visible display, then never replays', () => {
  const farm=createFarm();farm.boatOwned=true;farm.coins=50
  assert.ok(sendFerryExpedition(farm,'mill-buy').ok)
  const view=new FerryArrivalPresentation(), before={...farm.freight.expeditions.active!}
  assert.ok(endDay(farm).ok)
  view.recordNight(before,farm.freight.expeditions.active)
  const saved=JSON.stringify(farm)
  assert.equal(view.take(farm.freight.expeditions.active,false),false)
  const ready={...farm.freight.expeditions.active!}
  endDay(farm);view.recordNight(ready,farm.freight.expeditions.active)
  assert.equal(view.take(farm.freight.expeditions.active,true),true)
  for(let i=0;i<3;i++)assert.equal(view.take(farm.freight.expeditions.active,true),false)
  const loaded=restoreFarm(JSON.parse(saved))!
  assert.ok(loaded)
  assert.equal(new FerryArrivalPresentation().take(loaded.freight.expeditions.active,true),false)
  assert.equal(receiveFerryExpedition(loaded).ok,true)
  assert.equal(loaded.handmade.round,1)
  assert.equal(receiveFerryExpedition(loaded).ok,false)
})

test('discovery reveals once without unlocking before claim, and old tokens cannot apply to another voyage', () => {
  const farm=createFarm();farm.boatOwned=true;farm.produce.wheat=4;farm.freight.expeditions.markets.mill.visits=1
  sendFerryExpedition(farm,'explore-salt')
  const view=new FerryArrivalPresentation(),before={...farm.freight.expeditions.active!}
  endDay(farm);view.recordNight(before,farm.freight.expeditions.active)
  const saved=JSON.stringify(farm)
  assert.equal(view.take(farm.freight.expeditions.active,true),true)
  assert.equal(JSON.stringify(farm),saved)
  assert.equal(farm.freight.expeditions.discovered.includes('salt'),false)
  receiveFerryExpedition(farm)
  assert.equal(farm.freight.expeditions.discovered.includes('salt'),true)
  assert.equal(view.take(null,true),false)
  view.recordNight(before,{...before,phase:'ready'})
  assert.equal(view.take({...before,serial:before.serial+1,phase:'ready'},true),false)
  assert.equal(view.take({...before,phase:'ready'},true),false)
})

test('no transition or mismatched serial does not create a reveal; reduced-motion display consumes normally', () => {
  const view=new FerryArrivalPresentation(),ready={serial:1,phase:'ready'} as const
  view.recordNight(ready,ready)
  assert.equal(view.take(ready,true),false)
  view.recordNight({serial:2,phase:'sailing'},ready)
  assert.equal(view.take(ready,true),false)
  view.recordNight({serial:1,phase:'sailing'},ready)
  // Motion preference controls CSS only, not whether this display consumes the reveal.
  assert.equal(view.take(ready,true),true)
  assert.equal(view.take(ready,true),false)
})
