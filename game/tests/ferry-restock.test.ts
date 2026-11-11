import assert from 'node:assert/strict'
import test from 'node:test'
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'
import { createFarm, workBed, sellMarketItem, buyBoat, endDay, restoreFarm } from '../src/farm.ts'
import { expeditionWallet, sendFerryExpedition, receiveFerryExpedition, getFerrySupplyRequirement } from '../src/harbour-economy.ts'
import { combinedExpeditionId, portProjects } from '../src/ferry-expeditions.ts'
import { getFerryRestockPlan } from '../src/ferry-restock.ts'
import { isGuardedAction, ActionClickGuard, ActivationKeyGuard } from '../src/action-click-guard.ts'

function depletedBakery() {
  let farm = createFarm()
  const act = (result: { ok: boolean }) => assert.ok(result.ok)
  act(workBed(farm,2)); act(sellMarketItem(farm,'produce:cabbage',2)); act(buyBoat(farm))
  for (const [bed,key,quantity] of [[3,'produce:tomato',3],[5,'produce:beetroot',2],[7,'produce:pumpkin',2]] as const) {
    act(workBed(farm,bed)); act(sellMarketItem(farm,key,quantity))
  }
  act(workBed(farm,4))
  for (let i=0;i<3;i++) {
    act(sendFerryExpedition(farm,'mill-buy')); act(endDay(farm)); act(receiveFerryExpedition(farm))
    farm = restoreFarm(JSON.parse(JSON.stringify(farm)))!
  }
  return farm
}

test('the real depleted bakery needs a grain sale, not more empty mornings or a blocked barter', () => {
  const farm = depletedBakery(), before = structuredClone(farm)
  const plan = getFerryRestockPlan(farm.freight.expeditions,'mill-grain',farm.day,expeditionWallet(farm))
  assert.equal(farm.coins,4); assert.equal(farm.produce.wheat,3)
  assert.equal(plan?.kind,'supply')
  if (plan?.kind !== 'supply') return
  assert.equal(plan.offer.id,'mill-sale'); assert.equal(plan.offer.available,true)
  assert.deepEqual(plan.offer.outgoing,[{id:'wheat',quantity:2}])
  assert.deepEqual(plan.stock,[{id:'handmade:round',needed:1,now:0,nextMorning:0,afterDelivery:1}])
  assert.equal(plan.complete,true); assert.deepEqual(farm,before)
  const waiting = structuredClone(farm)
  for (let i=0;i<7;i++) assert.ok(endDay(waiting).ok)
  assert.equal(waiting.freight.expeditions.markets.mill.stock['handmade:round'],0)
  assert.ok(sendFerryExpedition(farm,plan.offer.id).ok)
  assert.equal(farm.produce.wheat,1); assert.equal(farm.handmade.round,3)
  assert.ok(endDay(farm).ok)
  assert.equal(farm.freight.expeditions.markets.mill.stock['handmade:round'],1)
  assert.ok(receiveFerryExpedition(farm).ok)
  assert.equal(farm.handmade.round,3); assert.equal(farm.coins,14)
})

test('a real next-morning batch takes priority over sending unnecessary supplies', () => {
  const farm = depletedBakery(); farm.freight.expeditions.markets.mill.stock.wheat = 2
  const before = structuredClone(farm)
  const plan = getFerryRestockPlan(farm.freight.expeditions,'mill-grain',farm.day,expeditionWallet(farm))
  assert.equal(plan?.kind,'rest')
  assert.deepEqual(plan?.stock,[{id:'handmade:round',needed:1,now:0,nextMorning:1}])
  assert.deepEqual(farm,before)
  assert.ok(endDay(farm).ok)
  assert.equal(farm.freight.expeditions.markets.mill.stock['handmade:round'],1)
  assert.equal(getFerryRestockPlan(farm.freight.expeditions,'mill-grain',farm.day,expeditionWallet(farm)),undefined)
})

test('a prepared supply still exposes the actual personal shortage and spends nothing', () => {
  const farm = depletedBakery(); assert.ok(sellMarketItem(farm,'produce:wheat',3).ok)
  const before = structuredClone(farm)
  const plan = getFerryRestockPlan(farm.freight.expeditions,'mill-grain',farm.day,expeditionWallet(farm))
  assert.equal(plan?.kind,'supply')
  if (plan?.kind !== 'supply') return
  assert.equal(plan.offer.id,'mill-sale'); assert.equal(plan.offer.available,false)
  assert.equal(getFerrySupplyRequirement(farm,plan.offer.id,'wheat')?.item.quantity,2)
  assert.equal(sendFerryExpedition(farm,plan.offer.id).ok,false)
  assert.deepEqual(farm,before)
})

test('a small delivery is not presented as enough for the whole combined order', () => {
  const farm = depletedBakery(), id = combinedExpeditionId('mill-grain','mill-baking')!
  const plan = getFerryRestockPlan(farm.freight.expeditions,id,farm.day,expeditionWallet(farm))
  assert.equal(plan?.kind,'supply')
  if (plan?.kind !== 'supply') return
  assert.equal(plan.offer.id,'mill-sale'); assert.equal(plan.complete,false)
  assert.deepEqual(plan.stock,[{id:'handmade:round',needed:3,now:0,nextMorning:0,afterDelivery:1}])
})

test('recovery follows existing salt production and distinguishes supply from natural replenishment', () => {
  const farm = createFarm(); farm.boatOwned=true
  const world=farm.freight.expeditions; world.discovered.push('salt')
  world.markets.salt.supplied={carrot:6,seaBass:4}; farm.produce.carrot=3
  const before=structuredClone(farm)
  const plan=getFerryRestockPlan(world,'salt-grill',farm.day,expeditionWallet(farm))
  assert.equal(plan?.kind,'supply')
  if(plan?.kind !== 'supply') return
  assert.equal(plan.offer.id,'salt-carrots')
  assert.deepEqual(plan.stock,[{id:'dish:grilledFish',needed:1,now:0,nextMorning:0,afterDelivery:1}])
  assert.deepEqual(farm,before)
  assert.ok(sendFerryExpedition(farm,plan.offer.id).ok); assert.ok(endDay(farm).ok)
  assert.equal(world.markets.salt.stock['dish:grilledFish'],1)
  assert.ok(receiveFerryExpedition(farm).ok)
  world.markets.salt.stock.seaSalt=0
  assert.equal(getFerryRestockPlan(world,'salt-buy',farm.day,expeditionWallet(farm)),undefined,'the working kitchen consumes one of the two new salt units')
  world.markets.salt.stock.carrot=0
  const salt=getFerryRestockPlan(world,'salt-buy',farm.day,expeditionWallet(farm))
  assert.equal(salt?.kind,'rest')
  assert.equal(salt?.stock[0].nextMorning,2)
})

test('a morning forecast must preserve every export in a mixed basket, including existing fruit', () => {
  const farm=createFarm(); farm.boatOwned=true; farm.day=2
  const world=farm.freight.expeditions; world.lastDay=2; world.discovered.push('orchard')
  const market=world.markets.orchard
  market.supplied=Object.fromEntries(portProjects.orchard.needs.map(item=>[item.id,item.quantity]))
  market.stock={apple:2,pear:0,peach:2,'dish:appleJam':0}
  assert.equal(getFerryRestockPlan(world,'orchard-mixed',farm.day,expeditionWallet(farm)),undefined,'new pears cannot fix the basket when jam production consumes its apples')
  const tomorrow=structuredClone(farm); assert.ok(endDay(tomorrow).ok)
  assert.equal(tomorrow.freight.expeditions.markets.orchard.stock.apple,0)
  assert.equal(tomorrow.freight.expeditions.markets.orchard.stock.pear,2)
  market.stock.apple=1
  const plan=getFerryRestockPlan(world,'orchard-mixed',farm.day,expeditionWallet(farm))
  assert.equal(plan?.kind,'rest')
  assert.deepEqual(plan?.stock,[
    {id:'apple',needed:1,now:1,nextMorning:1},
    {id:'pear',needed:1,now:0,nextMorning:2},
    {id:'peach',needed:1,now:2,nextMorning:2},
  ])
})

test('guidance never uses locked ports, active voyages, exploration or an already sufficient export', () => {
  const farm=depletedBakery(), world=farm.freight.expeditions
  const plan=(id:string)=>getFerryRestockPlan(world,id,farm.day,expeditionWallet(farm))
  for(const id of ['not-a-trade','explore-salt','salt-buy','orchard-mixed','mill-sale']) assert.equal(plan(id),undefined)
  world.discovered.push('salt')
  assert.equal(plan(combinedExpeditionId('salt-buy','salt-grill')!),undefined,'a combined choice cannot bypass an unfinished port project')
  farm.boatOwned=false; assert.equal(plan('mill-grain'),undefined); farm.boatOwned=true
  assert.ok(sendFerryExpedition(farm,'mill-sale').ok)
  assert.equal(plan('mill-grain'),undefined)
  assert.ok(endDay(farm).ok); assert.equal(plan('mill-grain'),undefined)
  assert.ok(receiveFerryExpedition(farm).ok); assert.equal(plan('mill-grain'),undefined)
})

test('the recovery gesture cannot fall through into dispatch or sleep', () => {
  assert.equal(isGuardedAction('expedition-restock'),true)
  const clicks=new ActionClickGuard(); clicks.remember({detail:1,timeStamp:100,clientX:220,clientY:330})
  assert.equal(clicks.blocks({detail:2,timeStamp:150,clientX:220,clientY:330}),true)
  const keys=new ActivationKeyGuard()
  assert.equal(keys.blocks({key:'Enter',repeat:false},true),false)
  assert.equal(keys.blocks({key:'Enter',repeat:true},false),true)
})

test('the blocked order distinguishes a supply preview, partial recovery and a genuine morning batch', async () => {
  const server=await createServer({root:fileURLToPath(new URL('..',import.meta.url)),configFile:false,server:{middlewareMode:true},appType:'custom'})
  try {
    const {renderFreightPanel}=await server.ssrLoadModule('/src/bay-freight-ui.ts')
    const farm=depletedBakery(), render=(id='mill-grain')=>renderFreightPanel(farm.freight,{
      day:farm.day,coins:farm.coins,boatOwned:true,playerPort:'home',expeditionPort:'mill',expeditionOffer:id,
      openedPorts:['home','grove'],carried:expeditionWallet(farm).bag,
      products:[{id:'wheat',name:'Пшеница',icon:'wheat'},{id:'handmade:round',name:'Булочка',icon:'bun'}],icon:()=>'',
    })
    const empty=render()
    assert.match(empty,/aria-label="Пополнение порта"/)
    assert.match(empty,/Продать немного зерна/)
    assert.match(empty,/data-action="expedition-restock" data-value="mill-grain"/)
    assert.match(empty,/Посмотреть поставку/)
    assert.doesNotMatch(empty,/data-action="expedition-source"/,'a personal wheat hint cannot solve this port shortage')
    assert.match(render(combinedExpeditionId('mill-grain','mill-baking')!),/Этого пока недостаточно для всего выбранного заказа/)
    farm.freight.expeditions.markets.mill.stock.wheat=2
    const morning=render()
    assert.match(morning,/Новая партия к утру/)
    assert.match(morning,/В дом · посмотреть утро/)
    assert.doesNotMatch(morning,/Посмотреть поставку/)
  } finally { await server.close() }
})
