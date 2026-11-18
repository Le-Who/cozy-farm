import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { commissionPlayer } from './fixtures/commission-player.ts'
import { communityReturnRoute } from '../src/community-return.ts'
import { canSailTo, finishNeighborPlan, getIntentOffers, getNeighborPlans, joinNeighborPlan, restoreFarm, sail } from '../src/farm.ts'
import { communityReturnFixture } from './fixtures/community-return.ts'

test('the HUD fallback with no selected recipe returns to the meeting shore', () => {
  assert.deepEqual(communityReturnRoute('neighbor','home','recipe'),
    {mode:'request',destination:'village',travel:true,label:'К встрече в гавани'})
  assert.equal(communityReturnRoute('neighbor','grove','recipe',2).destination,'village')
  assert.equal(communityReturnRoute('neighbor','cape','recipe',undefined).destination,'village')
})

test('only a real missing portion keeps the recipe shortcut at the current island', () => {
  assert.deepEqual(communityReturnRoute('neighbor','home','recipe',0),
    {mode:'recipe',destination:undefined,travel:false,label:'К рецепту'})
  assert.equal(communityReturnRoute('neighbor','home','request',0).destination,'village')
  assert.equal(communityReturnRoute('intent','village','recipe',0).mode,'recipe')
})

test('current-shore requests do not cross again and fair requests return home', () => {
  assert.equal(communityReturnRoute('neighbor','village','recipe',1).travel,false)
  assert.equal(communityReturnRoute('neighbor','village','recipe',1).label,'К встрече')
  assert.deepEqual(communityReturnRoute('intent','village','recipe'),
    {mode:'request',destination:'home',travel:true,label:'К просьбе домой'})
  assert.equal(communityReturnRoute('intent','home','request').travel,false)
})

for (const kind of ['meeting','intent'] as const) test(`reload and return travel do not join, cook, donate or pay: ${kind}`, () => {
  const fixture=communityReturnFixture(kind), farm=restoreFarm(JSON.parse(JSON.stringify(fixture.farm)))!
  assert.ok(farm)
  const before=structuredClone(farm), route=communityReturnRoute(fixture.selection.request.kind as 'neighbor'|'intent',farm.island,'recipe')
  assert.equal(route.mode,'request')
  if (route.mode!=='request') throw Error('Not a request')
  assert.ok(canSailTo(farm,route.destination))
  assert.ok(sail(farm,route.destination).ok)
  assert.deepEqual(farm,{...before,island:route.destination})
  assert.ok(restoreFarm(JSON.parse(JSON.stringify(farm))))
  if(kind==='meeting') {
    assert.equal(farm.neighbors.finn.current?.phase,'preparing')
    assert.ok(joinNeighborPlan(farm,'finn:2').ok) // Only this separate action joins.
    assert.equal(farm.neighbors.finn.current?.phase,'joined')
    assert.deepEqual(farm.culinary.stock,before.culinary.stock)
    assert.equal(farm.coins,before.coins)
  }
})

test('the missing exact recipe is inspectable without consuming or crossing', () => {
  const {farm,selection}=communityReturnFixture('recipe'), before=structuredClone(farm)
  const plan=getNeighborPlans(farm).find(plan=>plan.resident==='bea')!
  const offer=getIntentOffers(farm,plan.intentId).find(offer=>offer.id===selection.food)!
  assert.equal(offer.count,0)
  assert.equal(communityReturnRoute('neighbor',farm.island,'recipe',offer.count).mode,'recipe')
  assert.deepEqual(farm,before)
  assert.ok(restoreFarm(farm))
})

test('a blocked crossing cannot bypass boat ownership or change the saved meeting', () => {
  const {farm}=communityReturnFixture('blocked'), before=structuredClone(farm)
  const route=communityReturnRoute('neighbor',farm.island,'recipe')
  if (route.mode!=='request') throw Error('Not a request')
  assert.equal(canSailTo(farm,route.destination),false)
  assert.equal(sail(farm,route.destination).ok,false)
  assert.deepEqual(farm,before)
  assert.ok(restoreFarm(farm))
})

test('the last serving finishes Bea’s meeting, not a second recipe errand after reload', () => {
  const actions=JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json',import.meta.url),'utf8'))
  const supper=actions.findLastIndex((a:{name:string})=>a.name==='serveVillageMeal'),player=commissionPlayer(actions.slice(0,supper+1))
  const recipe=player.cook(),food=`signature:${recipe}` as const
  player.visit('home'); player.act('sellSignature',recipe,1); player.night()
  player.fruit('apple',1); player.fruit('pear',1); player.visit('village')
  assert.equal(player.state.day,15); assert.equal(player.state.village.mealOn,14)
  const id='bea:1',route=()=>{
    const farm=player.state,plan=getNeighborPlans(farm).find(plan=>plan.id===id)!
    const offer=getIntentOffers(farm,plan.intentId).find(offer=>offer.id===food)!
    return communityReturnRoute('neighbor',farm.island,'recipe',offer.count,plan.phase)
  }
  player.act('joinNeighborPlan',id); assert.equal(route().mode,'recipe')
  player.act('repeatSignature',recipe); player.act('serveNeighborPlan',id,food)
  assert.equal(route().mode,'request'); assert.equal(player.state.culinary.stock[recipe],1)
  // A missing portion remains actionable until the meeting itself is finished.
  player.act('transferBayGoods','deposit','village',food,1); assert.equal(route().mode,'recipe')
  player.act('transferBayGoods','withdraw','village',food,1)
  const coins=player.state.coins,other=player.state.dishes.orchardTart
  const table={kind:'table',settled:true,placements:[{slot:'food',x:0,y:0},{slot:'cup',x:-.5,y:.2},{slot:'flowers',x:.5,y:-.2}]} as const
  player.act('finishNeighborPlan',id,table); player.reload()
  assert.equal(player.state.culinary.stock[recipe],0); assert.equal(player.state.dishes.orchardTart,other)
  assert.equal(player.state.coins,coins+31); assert.equal(player.state.neighbors.bea.completed,1)
  const done=structuredClone(player.state)
  assert.deepEqual(route(),{mode:'request',destination:'village',travel:false,label:'К встрече'})
  assert.equal(finishNeighborPlan(player.state,id,table).ok,false); assert.deepEqual(player.state,done)
  player.act('advanceNeighborPlan',id); player.visit('home')
  assert.equal(player.state.neighbors.bea.current?.phase,'remembered')
  assert.deepEqual(route(),{mode:'request',destination:'village',travel:true,label:'К встрече в гавани'})
})
