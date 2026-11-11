import assert from 'node:assert/strict'
import test from 'node:test'
import { communityReturnRoute } from '../src/community-return.ts'
import { canSailTo, getIntentOffers, getNeighborPlans, joinNeighborPlan, restoreFarm, sail } from '../src/farm.ts'
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
