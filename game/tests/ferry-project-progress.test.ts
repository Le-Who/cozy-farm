import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { createFarm, endDay, restoreFarm } from '../src/farm.ts'
import { expeditionWallet, receiveFerryExpedition, sendFerryExpedition } from '../src/harbour-economy.ts'

const products = [
  {id:'wheat',name:'Пшеница',icon:'wheat'},
  {id:'carrot',name:'Морковь',icon:'carrot'},
  {id:'seaBass',name:'Морской окунь',icon:'seaBass'},
  {id:'apple',name:'Яблоки',icon:'apple'},
  {id:'handmade:round',name:'Булочка',icon:'bun'},
]
async function withPanel(check: (render: (farm: ReturnType<typeof createFarm>, port?: string, offer?: string) => string) => void) {
  const server = await createServer({root:fileURLToPath(new URL('..',import.meta.url)),configFile:false,server:{middlewareMode:true},appType:'custom'})
  try {
    const {renderFreightPanel} = await server.ssrLoadModule('/src/bay-freight-ui.ts')
    check((farm, port='mill', offer='mill-grain') => renderFreightPanel(farm.freight, {
      day:farm.day, coins:farm.coins, boatOwned:farm.boatOwned, playerPort:farm.island,
      expeditionPort:port, expeditionOffer:offer, openedPorts:['home','grove'],
      carried:expeditionWallet(farm).bag, products, icon:()=>'',
    }))
  } finally { await server.close() }
}
function nearSecondOven() {
  let farm = createFarm(); farm.boatOwned=true; farm.produce.wheat=18
  for(let i=0;i<2;i++) {
    assert.ok(sendFerryExpedition(farm,'mill-grain').ok)
    assert.ok(endDay(farm).ok)
    assert.ok(receiveFerryExpedition(farm).ok)
    farm=restoreFarm(JSON.parse(JSON.stringify(farm)))!
  }
  return farm
}
const effect = (html:string) => html.match(/<p class="expedition-effect">([\s\S]*?)<\/p>/)?.[1] ?? ''

test('a selected sale shows its exact project contribution and payoff without reserving or granting anything', async () => {
  await withPanel(render => {
    const farm=nearSecondOven(), before=structuredClone(farm)
    const html=render(farm,'mill','mill-sale'), preview=effect(html)
    assert.match(html,/<details class="expedition-port-details"><summary>О порте<\/summary>/)
    assert.match(html,/Благодаря нашим поставкам:/)
    assert.match(preview,/Вторая печь/)
    assert.match(preview,/Пшеница: 8 → 10\/10/)
    assert.match(preview,/Заработает после доставки/)
    assert.match(preview,/до двух булочек за утро/)
    assert.deepEqual(farm,before)
  })
})

test('the frozen shipment keeps its contribution across reload and arrival never counts the cargo twice', async () => {
  await withPanel(render => {
    let farm=nearSecondOven()
    const coins=farm.coins, wheat=farm.produce.wheat, completed=farm.freight.expeditions.completed
    assert.ok(sendFerryExpedition(farm,'mill-sale').ok)
    const receipt=structuredClone(farm.freight.expeditions.active)!
    assert.equal(farm.produce.wheat,wheat-2)
    assert.equal(farm.coins,coins)
    farm=restoreFarm(JSON.parse(JSON.stringify(farm)))!
    assert.match(effect(render(farm,'salt','salt-buy')),/Пшеница: 8 → 10\/10/,'an active manifest takes priority over another selection')
    assert.deepEqual(farm.freight.expeditions.active,receipt)
    assert.ok(endDay(farm).ok)
    farm=restoreFarm(JSON.parse(JSON.stringify(farm)))!
    const arrived=effect(render(farm))
    assert.match(arrived,/Пшеница: 8 → 10\/10/)
    assert.match(arrived,/Теперь работает/)
    assert.doesNotMatch(arrived,/Заработает после доставки/)
    assert.equal(farm.coins,coins)
    assert.equal(farm.freight.expeditions.markets.mill.supplied.wheat,10)
    assert.ok(receiveFerryExpedition(farm).ok)
    assert.equal(farm.coins,coins+receipt.earnCoins)
    assert.equal(farm.freight.expeditions.completed,completed+1)
    assert.doesNotMatch(effect(render(farm,'mill','mill-sale')),/→|Заработает после доставки/)
    const received=structuredClone(farm)
    assert.equal(receiveFerryExpedition(farm).ok,false)
    farm=restoreFarm(JSON.parse(JSON.stringify(farm)))!
    assert.deepEqual(farm,received)
  })
})

test('switching ports and orders recomputes only the selected delivery, including both ingredients in a paired cargo', async () => {
  await withPanel(render => {
    const farm=nearSecondOven(), world=farm.freight.expeditions
    world.discovered.push('salt','orchard')
    world.markets.salt.supplied={carrot:3,seaBass:2}
    farm.produce.carrot=3; farm.fish.seaBass=2
    const before=structuredClone(farm)
    const one=effect(render(farm,'salt','salt-carrots'))
    assert.match(one,/Рыбная кухня/)
    assert.match(one,/Морковь: 3 → 6\/6/)
    assert.match(one,/Морской окунь: 2\/4/)
    assert.match(one,/После завершения проекта/)
    assert.doesNotMatch(one,/Вторая печь|Заработает после доставки/)
    const pair=effect(render(farm,'salt','pair:salt-carrots+salt-catch'))
    assert.match(pair,/Морковь: 3 → 6\/6/)
    assert.match(pair,/Морской окунь: 2 → 4\/4/)
    assert.match(pair,/Заработает после доставки/)
    assert.match(effect(render(farm,'mill','mill-sale')),/Пшеница: 8 → 10\/10/)
    assert.deepEqual(farm,before)
  })
})

test('purchases, unrelated cargo, exploration and already-complete projects do not promise project progress', async () => {
  await withPanel(render => {
    const farm=nearSecondOven(), world=farm.freight.expeditions
    world.discovered.push('salt')
    const before=structuredClone(farm)
    assert.match(render(farm,'mill','mill-buy'),/<details class="expedition-port-details"><summary>Вторая печь <span>8\/10<\/span><\/summary>/)
    for(const [port,offer] of [['mill','mill-buy'],['mill','mill-eggs'],['salt','salt-buy'],['orchard','explore-orchard']]) {
      assert.doesNotMatch(effect(render(farm,port,offer)),/→|Заработает после доставки|После завершения проекта/)
    }
    assert.match(effect(render(farm,'salt','salt-fish')),/Покупка не считается личным уловом/)
    assert.deepEqual(farm,before)
    world.markets.mill.supplied.wheat=10
    assert.doesNotMatch(effect(render(farm,'mill','mill-grain')),/→|Заработает после доставки/)
  })
})

test('a preview caps surplus at the goal and a missing personal supply remains an unavailable departure', async () => {
  await withPanel(render => {
    const farm=nearSecondOven(); farm.produce.wheat=0
    const before=structuredClone(farm), html=render(farm,'mill','pair:mill-grain+mill-sale')
    assert.match(effect(html),/Пшеница: 8 → 10\/10/)
    assert.doesNotMatch(effect(html),/14\/10/)
    assert.match(html,/Есть 0 · нужно ещё 6/)
    assert.match(html,/data-action="expedition-send"[^>]*disabled/)
    assert.equal(sendFerryExpedition(farm,'pair:mill-grain+mill-sale').ok,false)
    assert.deepEqual(farm,before)
  })
})
