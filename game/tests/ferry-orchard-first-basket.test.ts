import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import * as farmApi from '../src/farm.ts'
import * as worldApi from '../src/ferry-expeditions.ts'
import * as freight from '../src/bay-freight-model.ts'
import * as economy from '../src/harbour-economy.ts'
import { nextFerryExploration } from '../src/ferry-discovery.ts'
import { getFerryRestockPlan } from '../src/ferry-restock.ts'
import { smallerFerryCargo } from '../src/ferry-smaller-cargo.ts'
import { ferryProjectProgress } from '../src/ferry-project-progress.ts'
import { isGuardedAction } from '../src/action-click-guard.ts'
import { ruCount } from '../src/ru.ts'
import type { renderFreightPanel } from '../src/bay-freight-ui.ts'
import { delayedLastFerryReceiptFarm } from './fixtures/last-ferry-receipt.ts'

const src = (file: string) => readFileSync(new URL('../src/' + file, import.meta.url), 'utf8')
function slice(text: string, from: string, to: string) {
  const a = text.indexOf(from), b = text.indexOf(to, a + from.length)
  assert.ok(a >= 0 && b > a, from)
  return text.slice(a, b)
}
const template = stripTypeScriptTypes(
  slice(src('bay-freight-ui.ts'), 'const labels:', '/** DOM entry used')
    .replaceAll('export function ', 'function ').replaceAll('import.meta.env.BASE_URL', '"/"')
    + ';renderFreightPanel')
const render: typeof renderFreightPanel = runInNewContext(template, {
  ...worldApi, ...freight, nextFerryExploration, getFerryRestockPlan, smallerFerryCargo,
  ferryProjectProgress, ruCount,
})
const handler = stripTypeScriptTypes('(async()=>{ switch(action){' +
  slice(src('main.ts'), "    case 'expedition-restock':", "    case 'expedition-source':") +
  slice(src('main.ts'), "    case 'expedition-offer':", "    case 'expedition-order-recipe':") +
  slice(src('main.ts'), "    case 'expedition-claim':", "    case 'music-warehouse-visit':") + '} })()')
const apples = 'orchard-apples', mixed = 'orchard-mixed'
const pair = worldApi.combinedExpeditionId(apples, mixed)!
const quote = (farm: farmApi.FarmState, id: string) =>
  worldApi.quoteExpedition(farm.freight.expeditions, id, economy.expeditionWallet(farm))!
const ok = (result: { ok: boolean; message: string }) => assert.ok(result.ok, result.message)
function earnedReturn() {
  const farm = delayedLastFerryReceiptFarm()
  ok(economy.receiveFerryExpedition(farm))
  for (let attempts = 0; farm.fruit.apple < 15; attempts++) {
    assert.ok(attempts < 15)
    if (!farm.trees.home[0]?.fruitReady) ok(farmApi.endDay(farm))
    ok(farmApi.pickFruit(farm, 0))
  }
  for (const id of ['mill-buy','orchard-buns','orchard-buns',apples,apples]) {
    ok(economy.sendFerryExpedition(farm, id))
    ok(farmApi.endDay(farm))
    ok(economy.receiveFerryExpedition(farm))
  }
  assert.equal(worldApi.portProjectComplete(farm.freight.expeditions, 'orchard'), false)
  ok(economy.sendFerryExpedition(farm, apples))
  ok(farmApi.endDay(farm))
  assert.deepEqual([farm.day, farm.coins, farm.fruit.apple,
    farm.freight.expeditions.active?.phase], [17,96,6,'ready'])
  const cold = farmApi.restoreCurrentFarm(JSON.parse(JSON.stringify(farm)))
  assert.ok(cold)
  return cold
}
type Id = 'expedition-offer' | 'expedition-pair' | 'expedition-send' | 'expedition-claim' | 'expedition-restock'
const button = (html: string, action: Id, value: string) =>
  [...html.matchAll(/<button type="button" data-action="([^"]+)" data-value="([^"]*)" ([^>]*)>([\s\S]*?)<\/button>/g)]
    .filter(match => match[1] === action && match[2] === value)
const footer = (html: string) => slice(html,'<footer class="expedition-departure">','</footer>')
const picker = (html: string) => slice(html,'<details class="expedition-offers">','</details>')
function mount(farm: farmApi.FarmState, offer?: string, port?: worldApi.ExpeditionPort) {
  const initial = worldApi.initialExpeditionPreview(farm.freight.expeditions)
  let markup = '', writes = 0
  const owner = {}
  const x = {
    ...worldApi, ...economy, farm, panel: 'bay-freight',
    selectedExpeditionPort: port ?? initial.port, selectedExpeditionOffer: offer ?? initial.offer,
    action: '', value: '', control: {}, event: { detail: 1 }, document: { activeElement: null },
    dialog: { open:true }, dialogContent: { querySelector: (q:string) => q === '.bay-freight' ? owner : null },
    getFerryRestockPlan, captureFerryPanelView: () => undefined, ferrySupplyOrigins: new WeakMap(),
    visitPanelAt: () => { throw Error('this earned replenishment does not travel or rest') },
    presentFerryDeparture: () => {}, bayAudio: { playEvent: () => {} },
    ferryPeachPlanting: { receive: economy.receiveFerryExpedition },
    perform(fn: () => {ok: boolean}) {
      const result = fn()
      if (result.ok) { writes++; x.drawPanel() }
      return result.ok
    },
    drawPanel() {
      markup = render(farm.freight, {
        day: farm.day, coins: farm.coins, playerPort: farm.island, boatOwned: farm.boatOwned,
        expeditionPort: x.selectedExpeditionPort, expeditionOffer: x.selectedExpeditionOffer,
        openedPorts: economy.openedFreightPorts(farm), carried: economy.expeditionWallet(farm).bag,
        products: [
          { id:'apple', name:'Яблоко', icon:'apple' }, { id:'pear', name:'Груша', icon:'pear' },
          { id:'peach', name:'Персик', icon:'peach' }, { id:'dish:appleJam', name:'Яблочное варенье', icon:'jam' },
        ],
        icon: () => '',
      })
    },
  }
  x.drawPanel()
  return { farm, get html() { return markup }, get writes() { return writes },
    get selected() { return x.selectedExpeditionOffer },
    async click(action: Id, value: string, area: (html:string)=>string = html=>html) {
      const matches = button(area(markup), action, value)
      assert.equal(matches.length,1,`one ${action}/${value} in the intended visible markup`)
      assert.doesNotMatch(matches[0][3], /\bdisabled\b/)
      x.action = action; x.value = value
      await runInNewContext(handler, x)
    },
    draw: x.drawPanel,
  }
}
async function settled() {
  const farm = earnedReturn(), panel = mount(farm)
  assert.doesNotMatch(panel.html, /Добавить вторым: Фруктовая корзина/)
  await panel.click('expedition-claim','',footer)
  assert.deepEqual([farm.day, farm.coins, farm.fruit.apple, farm.fruit.pear, farm.fruit.peach,
    farm.freight.expeditions.active, worldApi.expeditionStock(farm.freight.expeditions,'orchard','apple')],
    [17,99,6,0,4,null,1])
  assert.deepEqual(farm.freight.expeditions.markets.orchard.supplied, { apple:9, 'handmade:round':2 })
  assert.ok(worldApi.portProjectComplete(farm.freight.expeditions,'orchard'))
  return farm
}
const imported = (farm: farmApi.FarmState) => [farm.fruit.apple,farm.fruit.pear,farm.fruit.peach,farm.dishes.appleJam]

test('the first earned Orchard Table receipt surfaces one affordable basket add/remove beside the existing dispatch, with zero selection writes', async () => {
  const f = await settled(), before = JSON.stringify(f), p = mount(f)
  assert.equal(p.selected, apples)
  assert.equal(button(footer(p.html),'expedition-send',apples).length,1)
  assert.match(footer(p.html), /Добавить вторым: Фруктовая корзина · −18 монет/)
  assert.equal(button(p.html,'expedition-pair',mixed).length,1)
  assert.equal(button(picker(p.html),'expedition-offer',mixed).length,1,'standalone basket stays in ordinary picker')
  assert.equal(button(picker(p.html),'expedition-offer','orchard-pears').length,1)
  assert.equal(button(footer(p.html),'expedition-send',pair).length,0,'nothing preselected')
  assert.ok(isGuardedAction('expedition-pair') && isGuardedAction('expedition-send'))
  await p.click('expedition-pair', mixed, footer)
  assert.equal(p.selected,pair)
  assert.match(p.html,/Два заказа в одном рейсе/)
  assert.match(footer(p.html),/aria-pressed="true"[^>]*>Убрать второй: Фруктовая корзина/)
  assert.equal(button(footer(p.html),'expedition-send',pair).length,1)
  assert.equal(button(p.html,'expedition-pair',mixed).length,1)
  assert.equal(button(picker(p.html),'expedition-offer',mixed).length,1)
  await p.click('expedition-pair', mixed, footer)
  assert.equal(p.selected,apples)
  assert.match(footer(p.html),/aria-pressed="false"[^>]*>Добавить вторым: Фруктовая корзина/)
  assert.equal(p.writes,0)
  assert.equal(JSON.stringify(f),before)
})

test('the real paired dispatch reserves the basket for Day 18; ordinary repeat still pays +3 and recovers a basket only on Day 20', async () => {
  const initial = await settled(), joint = mount(structuredClone(initial)), repeat = mount(structuredClone(initial))
  assert.deepEqual([quote(initial,apples).earnCoins, quote(initial,pair).payCoins, quote(initial,mixed).payCoins], [3,18,21])
  await joint.click('expedition-pair',mixed,footer)
  assert.equal(joint.writes,0)
  await joint.click('expedition-send',pair,footer)
  assert.deepEqual([joint.writes,joint.farm.coins,...imported(joint.farm)], [1,81,3,0,4,3])
  assert.doesNotMatch(joint.html,/Добавить вторым: Фруктовая корзина/)
  ok(farmApi.endDay(joint.farm)); joint.draw()
  assert.equal(joint.farm.day,18)
  assert.deepEqual(imported(joint.farm),[3,0,4,3],'arrival alone never grants cargo')
  await joint.click('expedition-claim','',footer)
  assert.deepEqual([joint.writes,joint.farm.coins,...imported(joint.farm)], [2,81,4,1,5,4])
  assert.equal(button(footer(joint.html),'expedition-pair',mixed).length,0)

  await repeat.click('expedition-send',apples,footer)
  ok(farmApi.endDay(repeat.farm)); repeat.draw()
  await repeat.click('expedition-claim','',footer)
  assert.deepEqual([repeat.farm.day, repeat.farm.coins, ...imported(repeat.farm)], [18,102,3,0,4,4])
  assert.equal(quote(repeat.farm,mixed).available,false)
  const plan = getFerryRestockPlan(repeat.farm.freight.expeditions,mixed,repeat.farm.day,economy.expeditionWallet(repeat.farm))
  assert.equal(plan?.kind,'supply')
  if (plan?.kind !== 'supply') throw Error('ordinary apple replenishment expected')
  assert.equal(plan.offer.id,apples)
  const restock = mount(repeat.farm,mixed)
  assert.match(restock.html,/Посмотреть поставку/)
  assert.equal(button(footer(restock.html),'expedition-pair',mixed).length,0)
  const beforeRestock = JSON.stringify(repeat.farm)
  await restock.click('expedition-restock',mixed)
  assert.equal(restock.selected,apples)
  assert.equal(restock.writes,0)
  assert.equal(JSON.stringify(repeat.farm),beforeRestock)
  await restock.click('expedition-send',apples,footer)
  ok(farmApi.endDay(repeat.farm)); ok(economy.receiveFerryExpedition(repeat.farm))
  const basket = mount(repeat.farm,mixed)
  await basket.click('expedition-send',mixed,footer)
  ok(farmApi.endDay(basket.farm)); basket.draw()
  await basket.click('expedition-claim','',footer)
  assert.deepEqual([basket.farm.day,basket.farm.coins,...imported(basket.farm)], [20,84,1,1,5,5])
})

test('a real unrelated selection, later receipt or unaffordable pair keeps the ordinary controls only', async () => {
  const f = await settled(), p = mount(f)
  await p.click('expedition-offer', mixed, picker)
  assert.equal(p.selected,mixed)
  assert.equal(button(footer(p.html),'expedition-pair',mixed).length,0)
  assert.equal(button(footer(p.html),'expedition-send',mixed).length,1)
  assert.equal(p.writes,0)
  const onceMore = structuredClone(f)
  ok(economy.sendFerryExpedition(onceMore,'orchard-pears'))
  ok(farmApi.endDay(onceMore)); ok(economy.receiveFerryExpedition(onceMore))
  assert.ok(quote(onceMore,pair).available,'after a different receipt both remain genuinely affordable')
  assert.equal(button(footer(mount(onceMore,apples).html),'expedition-pair',mixed).length,0)
  const missing = structuredClone(f)
  ok(farmApi.sellMarketItem(missing,'fruit:apple',4))
  assert.equal(quote(missing,pair).available,false)
  assert.equal(button(footer(mount(missing,apples).html),'expedition-pair',mixed).length,0)
  const noCoins = structuredClone(f)
  for (let n=0;n<19;n++) ok(farmApi.buySeeds(noCoins,'carrot'))
  ok(farmApi.buySeeds(noCoins,'cabbage'))
  assert.equal(noCoins.coins,17)
  assert.ok(quote(noCoins,apples).available)
  assert.equal(quote(noCoins,pair).available,false)
  const normal = mount(noCoins,apples)
  assert.equal(button(footer(normal.html),'expedition-pair',mixed).length,0)
  assert.equal(button(footer(normal.html),'expedition-send',apples).length,1)
  assert.equal(button(picker(normal.html),'expedition-pair',mixed).length,1,'regular voluntary preview remains possible')
})

test('elapsed dawn is not a timer; a matching receipt still compares while the real difference is live', async () => {
  const f = await settled()
  ok(farmApi.endDay(f))
  const p = mount(f)
  assert.equal(f.day,18)
  assert.ok(quote(f,apples).available&&quote(f,pair).available)
  assert.match(footer(p.html), /Добавить вторым: Фруктовая корзина · −18 монет/)
})

const peaches = 'orchard-peaches'
const basketAndPeaches = worldApi.combinedExpeditionId(mixed,peaches)!
const selectedOrders = (html:string) => slice(html,'<section class="expedition-selection"','</section>')

async function paidBasketAndPeaches() {
  const f = await settled(), p = mount(f)
  await p.click('expedition-offer',mixed,picker)
  await p.click('expedition-pair',peaches,picker)
  assert.deepEqual([p.selected,p.writes,quote(f,basketAndPeaches).payCoins],[basketAndPeaches,0,37])
  await p.click('expedition-send',basketAndPeaches,footer)
  assert.equal(button(selectedOrders(p.html),'expedition-offer',peaches).length,0)
  ok(farmApi.endDay(f)); p.draw()
  assert.equal(button(selectedOrders(p.html),'expedition-offer',peaches).length,0)
  await p.click('expedition-claim','',footer)
  // Cold reopen derives the attempted repeat from the real paid shipment, not injected selection.
  const cold = farmApi.restoreCurrentFarm(JSON.parse(JSON.stringify(f)))
  assert.ok(cold)
  return cold
}

test('a real short-port repeat keeps the named ready second parcel from the selected summary, with a separate quoted send and claim', async () => {
  const f = await paidBasketAndPeaches(), before = JSON.stringify(f), p = mount(f)
  assert.deepEqual([f.day,f.island,f.coins,...imported(f),p.selected], [18,'home',62,7,1,7,3,basketAndPeaches])
  assert.deepEqual([quote(f,basketAndPeaches).available,quote(f,mixed).available,quote(f,peaches).available],
    [false,false,true])
  assert.match(p.html,/Посмотреть поставку/,'keep the full-basket restocking option')
  assert.match(button(footer(p.html),'expedition-send',basketAndPeaches)[0][3], /\bdisabled\b/)
  const keep = button(selectedOrders(p.html),'expedition-offer',peaches)
  assert.equal(keep.length,1,'the ready order is directly reachable without reopening the general picker')
  assert.match(keep[0][4],/^Оставить: Персики для рецепта$/)
  assert.equal(button(selectedOrders(p.html),'expedition-offer',mixed).length,0)
  assert.equal(button(picker(p.html),'expedition-offer',mixed).length,1,'the full picker still allows individual plans')
  await p.click('expedition-offer',peaches,selectedOrders)
  assert.deepEqual([p.selected,p.writes,JSON.stringify(f)],[peaches,0,before])
  assert.equal(quote(f,peaches).payCoins,16)
  await p.click('expedition-send',peaches,footer)
  assert.deepEqual([p.writes,f.day,f.island,f.coins,...imported(f)],[1,18,'home',46,7,1,7,3])
  ok(farmApi.endDay(f)); p.draw()
  assert.equal(f.fruit.peach,7,'arrival alone does not give the cargo')
  await p.click('expedition-claim','',footer)
  assert.deepEqual([p.writes,f.day,f.island,f.coins,...imported(f)],[2,19,'home',46,7,1,9,3])
})

test('the selected-order shortcut does not replace a ready first, both ready, or both blocked', async () => {
  const f = await paidBasketAndPeaches()
  const reverse = worldApi.combinedExpeditionId(peaches,mixed)!
  assert.deepEqual([quote(f,reverse).available,quote(f,peaches).available,quote(f,mixed).available],[false,true,false])
  assert.equal(button(selectedOrders(mount(f,reverse).html),'expedition-offer',peaches)[0][4],
    'Оставить только первый заказ')
  const both = await settled()
  assert.ok(quote(both,basketAndPeaches).available)
  assert.equal(button(selectedOrders(mount(both,basketAndPeaches).html),'expedition-offer',mixed)[0][4],
    'Оставить только первый заказ')
  const pears = 'orchard-pears', neither = await settled(), basketAndPears = worldApi.combinedExpeditionId(mixed,pears)!
  ok(economy.sendFerryExpedition(neither,basketAndPears))
  ok(farmApi.endDay(neither)); ok(economy.receiveFerryExpedition(neither))
  assert.deepEqual([quote(neither,basketAndPears).available,quote(neither,mixed).available,quote(neither,pears).available],
    [false,false,false])
  assert.equal(button(selectedOrders(mount(neither).html),'expedition-offer',mixed)[0][4],
    'Оставить только первый заказ')
})
