import assert from 'node:assert/strict'
import test from 'node:test'
import {fileURLToPath} from 'node:url'
import {createServer} from 'vite'
import {createFarm, endDay, restoreFarm} from '../src/farm.ts'
import {expeditionWallet, sendFerryExpedition, receiveFerryExpedition} from '../src/harbour-economy.ts'
import {combinedExpeditionId} from '../src/ferry-expeditions.ts'
import {getFerryRestockPlan} from '../src/ferry-restock.ts'

function busySaltKitchen() {
  const farm=createFarm(); farm.boatOwned=true; farm.coins=100
  const world=farm.freight.expeditions
  world.discovered.push('salt')
  world.markets.salt.supplied={carrot:6,seaBass:4}
  Object.assign(world.markets.salt.stock,{seaSalt:0,seaBass:2,carrot:3,'dish:grilledFish':0})
  return farm
}

test('salt purchase waits for the first sufficient real morning, not an unnecessary supply or a premature departure', () => {
  let farm=busySaltKitchen()
  const before=structuredClone(farm)
  const plan=getFerryRestockPlan(farm.freight.expeditions,'salt-buy',farm.day,expeditionWallet(farm))
  assert.deepEqual(plan,{kind:'rest',port:'salt',day:3,stock:[{id:'seaSalt',needed:2,now:0,nextMorning:2}]})
  assert.deepEqual(farm,before,'forecast does not advance the farm or credit salt')
  assert.equal(sendFerryExpedition(farm,'salt-buy').ok,false)
  assert.deepEqual(farm,before)
  assert.ok(endDay(farm).ok)
  assert.equal(farm.freight.expeditions.markets.salt.stock.seaSalt,1)
  const tomorrow=structuredClone(farm)
  assert.equal(sendFerryExpedition(farm,'salt-buy').ok,false)
  assert.deepEqual(farm,tomorrow)
  farm=restoreFarm(JSON.parse(JSON.stringify(farm)))!
  assert.equal(getFerryRestockPlan(farm.freight.expeditions,'salt-buy',farm.day,expeditionWallet(farm))?.day,3)
  assert.ok(endDay(farm).ok)
  assert.equal(farm.freight.expeditions.markets.salt.stock.seaSalt,2)
  assert.equal(getFerryRestockPlan(farm.freight.expeditions,'salt-buy',farm.day,expeditionWallet(farm)),undefined)
  const coins=farm.coins, salt=farm.seaSalt
  assert.ok(sendFerryExpedition(farm,'salt-buy').ok)
  assert.equal(farm.coins,coins-10)
  assert.equal(farm.seaSalt,salt)
  assert.ok(endDay(farm).ok)
  assert.ok(receiveFerryExpedition(farm).ok)
  assert.equal(farm.seaSalt,salt+2)
  const received=structuredClone(farm)
  assert.equal(receiveFerryExpedition(farm).ok,false)
  assert.deepEqual(farm,received)
})

test('a combined salt basket waits for all four units rather than reusing the two-unit purchase forecast', () => {
  const farm=busySaltKitchen(); farm.produce.carrot=3
  const before=structuredClone(farm), id=combinedExpeditionId('salt-buy','salt-carrots')!
  const plan=getFerryRestockPlan(farm.freight.expeditions,id,farm.day,expeditionWallet(farm))
  assert.deepEqual(plan,{kind:'rest',port:'salt',day:5,stock:[{id:'seaSalt',needed:4,now:0,nextMorning:5}]})
  assert.deepEqual(farm,before)
  const waiting=structuredClone(farm)
  for(const quantity of [1,2,3,5]) {
    assert.ok(endDay(waiting).ok)
    assert.equal(waiting.freight.expeditions.markets.salt.stock.seaSalt,quantity)
  }
  assert.equal(waiting.day,5)
  assert.equal(getFerryRestockPlan(waiting.freight.expeditions,id,waiting.day,expeditionWallet(waiting)),undefined)
})

test('the bounded wait never promises a mixed basket whose dish cannot be produced without new carrots', () => {
  const farm=busySaltKitchen(); farm.freight.expeditions.markets.salt.stock.carrot=0
  const before=structuredClone(farm), id=combinedExpeditionId('salt-buy','salt-grill')!
  assert.equal(getFerryRestockPlan(farm.freight.expeditions,id,farm.day,expeditionWallet(farm)),undefined)
  assert.deepEqual(farm,before)
  const waiting=structuredClone(farm)
  for(let morning=0;morning<6;morning++) {
    assert.ok(endDay(waiting).ok)
    assert.equal(waiting.freight.expeditions.markets.salt.stock['dish:grilledFish'],0)
  }
  assert.equal(waiting.freight.expeditions.markets.salt.stock.seaSalt,6)
})

test('a later wait names its day, preserves the exact navigation action, and does not imply an automatic night', async () => {
  const server=await createServer({root:fileURLToPath(new URL('..',import.meta.url)),configFile:false,server:{middlewareMode:true,hmr:false},appType:'custom'})
  try {
    const {renderFreightPanel}=await server.ssrLoadModule('/src/bay-freight-ui.ts')
    const farm=busySaltKitchen(), render=(offer='salt-buy')=>renderFreightPanel(farm.freight,{
      day:farm.day,coins:farm.coins,boatOwned:true,playerPort:'home',expeditionPort:'salt',expeditionOffer:offer,
      openedPorts:['home','grove'],carried:expeditionWallet(farm).bag,
      products:[{id:'seaSalt',name:'Морская соль',icon:'seaSalt'}],icon:()=>'',
    })
    const before=structuredClone(farm), later=render()
    assert.match(later,/<h4>Партия к утру дня 3<\/h4>/)
    assert.match(later,/Без новой поставки: Морская соль: 2 из нужных 2/)
    assert.doesNotMatch(later,/Новая партия к утру/)
    assert.match(later,/data-action="expedition-restock" data-value="salt-buy"/)
    assert.match(later,/Переход не начинает ночь/)
    assert.doesNotMatch(later,/data-action="sleep"/)
    assert.match(later,/data-action="expedition-send" data-value="salt-buy"[^>]*disabled/)
    const pair=combinedExpeditionId('salt-buy','salt-carrots')!
    assert.match(render(pair),/<h4>Партия к утру дня 5<\/h4>/)
    assert.ok(render(pair).includes(`data-action="expedition-restock" data-value="${pair}"`))
    assert.deepEqual(farm,before)
    assert.ok(endDay(farm).ok)
    const tomorrow=render()
    assert.match(tomorrow,/<h4>Новая партия к утру<\/h4>/)
    assert.match(tomorrow,/Без новой поставки утром дня 3: Морская соль: 2 из нужных 2/)
    assert.ok(endDay(farm).ok)
    assert.doesNotMatch(render(),/aria-label="Пополнение порта"/)
  } finally {await server.close()}
})
