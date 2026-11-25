import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { runInNewContext } from 'node:vm'
import * as model from '../src/bay-shop-model.ts'
import { BayShopCustomerView, renderBayShopCustomers } from '../src/bay-shop-customers.ts'
import { shopReturnLabel, shopRemainderQuote } from '../src/bay-shop-price-copy.ts'
import { commissionPlayer } from './fixtures/commission-player.ts'
import { reserveShopGoods } from '../src/harbour-economy.ts'
import { describeFood } from '../src/intent-orders.ts'
import { closeShopBeforeRest } from '../src/shop-rest.ts'
import { bayShopDayGuidance } from '../src/bay-shop-day.ts'
import { advanceBayShop, setBayShopOpen, stockBayShop } from '../src/bay-shop-model.ts'
import { endDay, foodDescriptors, restoreFarm, sail } from '../src/farm.ts'
import { shopDayFixture } from './fixtures/shop-day.ts'

function finishVisitors(farm: ReturnType<typeof shopDayFixture>, target: number) {
  for (let ticks = 0; ticks < 2000 && !(farm.bayShop.visitsToday === target && !farm.bayShop.visitor); ticks++) {
    for (const sale of advanceBayShop(farm.bayShop, 100, Number(farm.concertDay === farm.day))) farm.coins += sale.price
  }
  assert.equal(farm.bayShop.visitsToday, target); assert.equal(farm.bayShop.visitor, null)
}

test('the sixth guest finishes before music is offered, without changing visitor allowance or stock', () => {
  const farm = shopDayFixture(), shop = farm.bayShop
  assert.equal(bayShopDayGuidance(shop, 0, true).remaining, 1)
  while (shop.visitsToday === 5) advanceBayShop(shop, 100)
  assert.equal(shop.visitor?.phase, 'approaching')
  const choosing = bayShopDayGuidance(shop, 0, true)
  assert.equal(choosing.remaining, 0); assert.equal(choosing.action, undefined); assert.match(choosing.detail, /ещё в лавке/)
  finishVisitors(farm, 6)
  const before = JSON.stringify(farm)
  for (let i = 0; i < 10; i++) {
    const hint = bayShopDayGuidance(shop, 0, true)
    assert.equal(hint.count, 'Гости сегодня: 6 из 6'); assert.equal(hint.action, 'music'); assert.doesNotMatch(hint.detail, /завтра/)
  }
  assert.equal(JSON.stringify(farm), before); assert.equal(farm.coins, 42); assert.equal(shop.slots[0]?.quantity, 6)
  assert.ok(restoreFarm(JSON.parse(before)))
})

test('the existing concert opens exactly two more visits, then suggests rest', () => {
  const farm = shopDayFixture(); finishVisitors(farm, 6); farm.concertDay = farm.day
  const hint = bayShopDayGuidance(farm.bayShop, 1, true)
  assert.equal(hint.remaining, 2); assert.equal(hint.count, 'Гости сегодня: 6 из 8'); assert.equal(hint.action, undefined)
  finishVisitors(farm, 8)
  assert.equal(farm.coins, 50); assert.equal(farm.bayShop.sold, 8); assert.equal(farm.bayShop.slots[0]?.quantity, 4)
  const before = JSON.stringify(farm), done = bayShopDayGuidance(farm.bayShop, 1, true)
  assert.equal(done.action, 'rest'); assert.equal(JSON.stringify(farm), before)
  finishVisitors(farm, 8); assert.equal(farm.coins, 50)
})

test('closing, reopening and reloading a full day do not reset visitors or earnings', () => {
  const farm = shopDayFixture(true), before = JSON.stringify(farm)
  const loaded = restoreFarm(JSON.parse(before))!; assert.ok(loaded)
  for (const open of [false, true]) {
    setBayShopOpen(loaded.bayShop, open)
    assert.equal(bayShopDayGuidance(loaded.bayShop, 1, true).action, 'rest')
    for (let i = 0; i < 100; i++) assert.deepEqual(advanceBayShop(loaded.bayShop, 1000, 1), [])
  }
  assert.equal(loaded.bayShop.visitsToday, 8); assert.equal(loaded.coins, farm.coins); assert.equal(loaded.bayShop.revenue, farm.bayShop.revenue)
  assert.equal(JSON.stringify(farm), before)
})

test('festival visitors are included in the same existing allowance', () => {
  const farm = shopDayFixture(true); farm.bayShop.festivalVisitors = 3
  const hint = bayShopDayGuidance(farm.bayShop, 1, true)
  assert.equal(hint.remaining, 3); assert.equal(hint.count, 'Гости сегодня: 8 из 11'); assert.equal(hint.action, undefined)
  finishVisitors(farm, 11)
  assert.equal(bayShopDayGuidance(farm.bayShop, 1, true).action, 'rest'); assert.ok(restoreFarm(farm))
})

test('only actual rest starts the next allowance; yesterday music and the sold count remain intact', () => {
  const farm = shopDayFixture(true), coins = farm.coins, shelf = farm.bayShop.slots[0]?.quantity
  const before = JSON.stringify(farm)
  assert.equal(endDay(farm).ok, false); assert.equal(JSON.stringify(farm), before)
  farm.island = 'home'; assert.ok(endDay(farm).ok)
  const loaded = restoreFarm(JSON.parse(JSON.stringify(farm)))!; assert.ok(loaded)
  const hint = bayShopDayGuidance(loaded.bayShop, Number(loaded.concertDay === loaded.day), true)
  assert.equal(loaded.day, 6); assert.equal(loaded.concertDay, 5); assert.equal(hint.count, 'Гости сегодня: 0 из 6')
  assert.equal(hint.action, undefined); assert.equal(loaded.coins, coins); assert.equal(loaded.bayShop.slots[0]?.quantity, shelf); assert.equal(loaded.bayShop.sold, 8)
})

test('a sold-out shop closed before rest asks for stock, not reopening, on the new day', () => {
  const opening = JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json', import.meta.url), 'utf8'))
  const p = commissionPlayer(opening), food = foodDescriptors(p.state).find(item => item.id === 'dish:orchardTart')!
  assert.equal(food.count, 1)
  assert.ok(reserveShopGoods(p.state, food.id, 1))
  assert.ok(stockBayShop(p.state.bayShop, 0, { id: food.id, identity: food.id, name: food.name,
    image: '/art/lavender/ui-tart.webp', basePrice: food.sellPrice, tags: [...food.ingredients, ...describeFood(food)] }, 1))
  const guidance = () => bayShopDayGuidance(p.state.bayShop, Number(p.state.concertDay === p.state.day), true)
  assert.match(guidance().detail, /Откройте/)
  setBayShopOpen(p.state.bayShop, true)
  finishVisitors(p.state, 6)
  assert.equal(p.state.bayShop.sold, 1); assert.equal(p.state.bayShop.slots[0]?.quantity, 0)
  p.visit('home'); assert.ok(closeShopBeforeRest(p.state, String(p.state.day)).ok)
  assert.equal(guidance().action, 'music', 'today’s allowance still takes priority')
  p.night(); p.visit('village')
  assert.equal(p.state.bayShop.open, false); assert.equal(guidance().remaining, 6)
  const before = structuredClone(p.state)
  assert.equal(guidance().detail, 'Сначала выставьте товар на прилавок.')
  assert.deepEqual(p.state, before)
})


test('opening requires stock on a shelf even with goods in hand and in storage; an empty open shop can close', () => {
  const opening = JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json', import.meta.url), 'utf8'))
  const p = commissionPlayer(opening), id = p.cook()
  p.shelf(id); p.sale()
  p.cook(id); p.act('transferBayGoods', 'deposit', 'village', 'signature:' + id, 1); p.cook(id)
  const farm = p.state, soldOut = farm.bayShop.slots.find(slot => slot?.quantity === 0)!
  assert.ok(soldOut); assert.equal(farm.culinary.stock[id], 1)
  assert.equal(farm.freight.warehouses.village['signature:' + id], 1)

  const source = readFileSync(new URL('../src/bay-shop.ts', import.meta.url), 'utf8')
  const scene = stripTypeScriptTypes(source.slice(source.indexOf('const escape =')).replace('export function mountBayShop', 'function mountBayShop'))
  const host = { innerHTML: '', querySelector: () => null, contains: () => false, addEventListener() {}, removeEventListener() {} }
  const options = { state: farm.bayShop, products: () => [], onChange() {}, onClose() {} }
  const mounted = runInNewContext(scene + ';mountBayShop(host, options)', {
    ...model, BayShopCustomerView, bayShopDayGuidance, shopReturnLabel, shopRemainderQuote, host, options,
    document: { activeElement: null }, HTMLElement: class {}, HTMLInputElement: class {}, matchMedia: () => ({ matches: true }),
    performance: { now: () => 0 }, requestAnimationFrame: () => 1, cancelAnimationFrame() {}, clearTimeout() {},
    ResizeObserver: class { observe() {} disconnect() {} }, applyIngredientFinishes() {},
  })
  const toggle = () => host.innerHTML.match(/<button[^>]* data-open [^>]*>/)![0]
  assert.match(toggle(), / disabled/); assert.match(toggle(), /aria-pressed="false"/)
  assert.ok(reserveShopGoods(farm, 'signature:' + id, 1)); assert.ok(stockBayShop(farm.bayShop, 0, soldOut.product, 1))
  mounted.refresh(); assert.doesNotMatch(toggle(), /disabled/); assert.match(toggle(), /aria-pressed="false"/)
  setBayShopOpen(farm.bayShop, true); model.removeBayShopStock(farm.bayShop, 0)
  mounted.refresh(); assert.doesNotMatch(toggle(), /disabled/); assert.match(toggle(), /aria-pressed="true"/)
  setBayShopOpen(farm.bayShop, false); mounted.refresh()
  assert.match(toggle(), / disabled/); mounted.destroy()
})

function earnedFirstRefusalShop(price: number) {
  const opening = JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json', import.meta.url), 'utf8'))
  const p = commissionPlayer(opening)
  p.fruit('apple', 1); p.fruit('pear', 1); p.visit('home')
  p.act('specializeFarmhouse', 'preserves'); p.act('cookDish', 'orchardPreserves'); p.visit('village')
  const farm = p.state, id = 'dish:orchardPreserves'
  const food = foodDescriptors(farm).find(item => item.id === id)!
  assert.equal(food.count, 1)
  assert.equal(farm.bayShop.serial, 0, 'ordinary playthrough has not used Own Shop')
  assert.ok(reserveShopGoods(farm, id, 1))
  assert.ok(stockBayShop(farm.bayShop, 0, {
    id, identity:id, name:food.name, image:'/art/lavender/ui-signature-bright.webp',
    basePrice:food.sellPrice, tags:[...food.ingredients, ...describeFood(food)],
  }, 1))
  assert.equal(farm.bayShop.slots[0]?.price, 22)
  assert.ok(model.setBayShopPrice(farm.bayShop, 0, price))
  setBayShopOpen(farm.bayShop, true)
  return farm
}

/** Real scene renderer and frame loop, without browser, synthetic stock, or DOM layout claims. */
function watchMountedRefusal(farm: ReturnType<typeof earnedFirstRefusalShop>) {
  const source = readFileSync(new URL('../src/bay-shop.ts', import.meta.url), 'utf8')
  const scene = stripTypeScriptTypes(source.slice(source.indexOf('const escape =')).replace('export function mountBayShop', 'function mountBayShop'))
  class Control {
    hidden = false
    disabled = false
    textContent = ''
    readonly attributes: string[]
    readonly dataset: Record<string,string>
    constructor(attributes: string[] = [], dataset: Record<string,string> = {}) {
      this.attributes = attributes
      this.dataset = dataset
    }
    hasAttribute(name: string) { return this.attributes.includes(name) }
    closest(selector: string) { return selector === 'button' ? this : null }
  }
  class Price {
    value: string
    constructor(value: string) { this.value = value }
    matches(selector: string) { return selector === '[data-price]' }
  }
  const detail = new Control(), count = new Control(), next = new Control(), notice = new Control()
  const nodes = new Map([['.bay-shop-day-detail',detail],['.bay-shop-day-count',count],
    ['[data-shop-next]',next],['.bay-shop-notice',notice]])
  const listeners = new Map<string,(event: unknown) => void>()
  const host = {
    innerHTML:'', querySelector:(selector:string) => nodes.get(selector) ?? null, querySelectorAll:() => [],
    contains:(button:unknown) => button instanceof Control,
    addEventListener:(key:string, cb:(event:unknown)=>void)=>listeners.set(key,cb),
    removeEventListener:(key:string)=>listeners.delete(key),
  }
  const document = { activeElement:null, hidden:false }, nextActions: string[] = []
  const options = {
    state:farm.bayShop, products:()=>[], onChange(){}, onClose(){},
    onOpenMusic(){nextActions.push('music')}, onGoRest(){nextActions.push('rest')},
    performanceBonus:()=>Number(farm.concertDay===farm.day),
    onEarn(coins:number){ farm.coins += coins },
    returnStock(id:string, quantity:number){ assert.equal(id,'dish:orchardPreserves'); farm.dishes.orchardPreserves += quantity },
  }
  let now = 0, nextFrame: ((time:number)=>void) | undefined
  const mounted = runInNewContext(scene + ';mountBayShop(host, options)', {
    ...model, BayShopCustomerView, renderBayShopCustomers, bayShopDayGuidance, shopReturnLabel, shopRemainderQuote, host, options,
    document, HTMLElement:Control, HTMLInputElement:Price, matchMedia:()=>({matches:false}),
    performance:{now:()=>0}, requestAnimationFrame(cb:(time:number)=>void){ nextFrame=cb; return 1 },
    cancelAnimationFrame(){ nextFrame=undefined }, clearTimeout(){}, window:{setTimeout:()=>0},
    ResizeObserver:class { observe() {} disconnect() {} }, applyIngredientFinishes(){}, playBaySound(){},
  }) as { destroy():void }
  const step = () => { const frame = nextFrame; assert.ok(frame); now += 250; frame(now) }
  function until(condition:()=>boolean) {
    for (let pass=0; pass<500 && !condition(); pass++) step()
    assert.ok(condition(), 'normal animation frames reached the desired visit phase')
  }
  // The live renderer opens the first empty shelf; use the same explicit
  // occupied shelf selection the player makes before price or return actions.
  listeners.get('click')?.({target:new Control([], {slot:'0'})})
  return { detail, count, next, nextActions, document, step, until, mounted,
    press: (attributes:string[],dataset?:Record<string,string>)=>listeners.get('click')?.({target:new Control(attributes,dataset)}),
    enterPrice:(value:string)=>listeners.get('change')?.({target:new Price(value),type:'change'}) }
}

test('an earned first refusal stays in the existing status between visitors, never as a budget promise', () => {
  for (const [price, outcome, line] of [
    [30,'expensive','Беа: цена не подошла.'], [96,'budget','Беа: не хватило монет.'],
  ] as const) {
    const farm = earnedFirstRefusalShop(price), balance = farm.coins, shop = farm.bayShop, ui = watchMountedRefusal(farm)
    assert.match(ui.detail.textContent,/Следующий гость/)
    ui.until(()=>shop.visitor?.outcome?.kind===outcome)
    assert.equal(shop.visitor?.budget,95)
    assert.match(ui.detail.textContent,/ещё в лавке/,'live speech still owns an active visit')
    ui.until(()=>shop.visitor===null)
    assert.equal(ui.detail.textContent,line)
    assert.equal(ui.count.textContent,'Гости сегодня: 1 из 6')
    assert.deepEqual([farm.coins,shop.sold,shop.revenue,shop.slots[0]?.quantity],[balance,0,0,1])
    ui.press([], {tab:'journal'}); assert.equal(ui.detail.textContent,line,'looking at buyers does not clear it')
    ui.until(()=>shop.visitor?.id==='finn')
    assert.match(ui.detail.textContent,/ещё в лавке/)
    assert.doesNotMatch(ui.detail.textContent,/Беа/)
    ui.until(()=>shop.visitor===null && shop.visitsToday===6)
    assert.equal(ui.next.hidden,false); assert.match(ui.detail.textContent,/Концерт/)
    assert.deepEqual([farm.coins,shop.sold,shop.slots[0]?.quantity],price===30 ? [balance+30,1,0] : [balance,0,1])
    assert.equal(shop.memories.mark.purchases['dish:orchardPreserves']?.bought,price===30 ? 1 : undefined)
    ui.mounted.destroy()
  }
})

test('price, shelf and reopening clear actual stale refusals; rejected or unchanged edits do not', () => {
  const farm = earnedFirstRefusalShop(30), shop = farm.bayShop, ui = watchMountedRefusal(farm)
  ui.until(()=>shop.visitor===null && shop.visitsToday===1)
  assert.equal(ui.detail.textContent,'Беа: цена не подошла.')
  ui.enterPrice('10001'); assert.equal(shop.slots[0]?.price,30); assert.equal(ui.detail.textContent,'Беа: цена не подошла.')
  ui.enterPrice('30'); assert.equal(ui.detail.textContent,'Беа: цена не подошла.')
  ui.press([], {priceFactor:'1.35'}); assert.equal(ui.detail.textContent,'Беа: цена не подошла.')
  ui.mounted.destroy()
  const returned = watchMountedRefusal(farm)
  assert.match(returned.detail.textContent,/Следующий гость/,'own shop return starts a new view')
  returned.until(()=>shop.visitor===null && shop.visitsToday===2)
  assert.match(returned.detail.textContent,/Финн: цена/)
  returned.enterPrice('22'); assert.equal(shop.slots[0]?.price,22)
  assert.match(returned.detail.textContent,/Следующий гость/)
  returned.mounted.destroy()

  const separate = earnedFirstRefusalShop(30), stockView = watchMountedRefusal(separate)
  stockView.until(()=>separate.bayShop.visitor===null && separate.bayShop.visitsToday===1)
  assert.match(stockView.detail.textContent,/Беа: цена/)
  stockView.press(['data-return'])
  assert.equal(separate.dishes.orchardPreserves,1); assert.equal(separate.bayShop.slots[0],null)
  assert.match(stockView.detail.textContent,/На полках пусто/)
  stockView.mounted.destroy()
})

test('hidden frames and restoring an already-decided buyer do not synthesize a newly observed refusal', () => {
  const farm = earnedFirstRefusalShop(96), balance=farm.coins, ui = watchMountedRefusal(farm)
  ui.until(()=>farm.bayShop.visitor?.phase==='browsing')
  const before = JSON.stringify(farm)
  ui.document.hidden = true
  for (let i=0; i<20; i++) ui.step()
  assert.equal(JSON.stringify(farm),before)
  ui.document.hidden = false
  ui.until(()=>farm.bayShop.visitor?.outcome?.kind==='budget')
  ui.mounted.destroy()
  const snapshot = restoreFarm(JSON.parse(JSON.stringify(farm)))!
  assert.ok(snapshot); assert.equal(snapshot.bayShop.visitor?.outcome?.kind,'budget')
  const restored = watchMountedRefusal(snapshot)
  restored.until(()=>snapshot.bayShop.visitor===null)
  assert.match(restored.detail.textContent,/Следующий гость/)
  assert.equal(snapshot.coins,balance)
  restored.until(()=>snapshot.bayShop.visitor===null && snapshot.bayShop.visitsToday===2)
  assert.match(restored.detail.textContent,/Финн/)
  restored.press(['data-open']); assert.match(restored.detail.textContent,/Лавка закрыта/)
  restored.press(['data-open']); assert.match(restored.detail.textContent,/Следующий гость/)
  restored.mounted.destroy()
})

test('the ordinary first sale never leaves a refusal status or charges twice', () => {
  const farm = earnedFirstRefusalShop(22), balance = farm.coins, ui = watchMountedRefusal(farm)
  ui.until(()=>farm.bayShop.visitor===null && farm.bayShop.visitsToday===1)
  assert.deepEqual([farm.coins,farm.bayShop.revenue,farm.bayShop.sold,farm.bayShop.slots[0]?.quantity],[balance+22,22,1,0])
  assert.match(ui.detail.textContent,/На полках пусто/)
  ui.until(()=>farm.bayShop.visitor===null && farm.bayShop.visitsToday===2)
  assert.equal(farm.coins,balance+22)
  ui.mounted.destroy()
})

test('the real sixth refusal briefly explains the result without replacing or triggering the concert', () => {
  const original = 'Концерт сегодня может пригласить ещё двух гостей.'
  for (const [price, outcome, reason] of [
    [50,'expensive','цена не подошла'], [96,'budget','не хватило монет'], [30,'bought',undefined],
  ] as const) {
    const farm=earnedFirstRefusalShop(price), balance=farm.coins, shop=farm.bayShop, ui=watchMountedRefusal(farm)
    ui.until(()=>shop.visitor?.id==='mark' && shop.visitor.outcome!==null)
    assert.equal(shop.visitor?.outcome?.kind,outcome)
    assert.equal(ui.count.textContent,'Гости сегодня: 6 из 6')
    assert.equal(ui.detail.textContent,'Последний гость ещё в лавке.')
    assert.equal(ui.next.hidden,true)
    ui.until(()=>shop.visitor===null)
    const status=reason ? `Марк: ${reason}. Концерт: ещё 2 гостя.` : original
    assert.equal(ui.detail.textContent,status)
    assert.ok(status.length<=original.length)
    assert.equal(ui.next.textContent,'Пригласить музыкой');assert.equal(ui.next.hidden,false)
    assert.deepEqual([farm.coins,shop.sold,shop.slots[0]?.quantity],reason?[balance,0,1]:[balance+30,1,0])
    const unchanged=structuredClone(farm)
    assert.deepEqual(ui.nextActions,[])
    ui.press(['data-shop-next'])
    assert.deepEqual(ui.nextActions,['music']);assert.deepEqual(farm,unchanged)
    ui.mounted.destroy()
  }
})

test('valid repricing clears a final refusal; same or invalid prices leave it, and there is no next-day echo', () => {
  const farm=earnedFirstRefusalShop(50), shop=farm.bayShop, balance=farm.coins, ui=watchMountedRefusal(farm), day=farm.day
  ui.until(()=>shop.visitor===null && shop.visitsToday===6)
  assert.match(ui.detail.textContent,/Марк: цена не подошла/)
  ui.enterPrice('50');assert.match(ui.detail.textContent,/Марк: цена/)
  ui.enterPrice('10001');assert.match(ui.detail.textContent,/Марк: цена/)
  ui.enterPrice('22');assert.equal(ui.detail.textContent,'Концерт сегодня может пригласить ещё двух гостей.')
  assert.deepEqual([ui.next.textContent,ui.next.hidden,shop.visitsToday,shop.slots[0]?.price,shop.slots[0]?.quantity,farm.coins],
    ['Пригласить музыкой',false,6,22,1,balance])
  ui.press(['data-open']);ui.mounted.destroy()
  assert.ok(sail(farm,'home').ok);assert.ok(endDay(farm).ok);assert.ok(sail(farm,'village').ok)
  assert.equal(farm.day,day+1)
  const loaded=restoreFarm(JSON.parse(JSON.stringify(farm)))!, tomorrow=watchMountedRefusal(loaded)
  assert.equal(tomorrow.detail.textContent,'Лавка закрыта. Откройте её для гостей.')
  assert.equal(tomorrow.count.textContent,'Гости сегодня: 0 из 6');assert.equal(tomorrow.next.hidden,true)
  assert.deepEqual([loaded.bayShop.slots[0]?.price,loaded.bayShop.slots[0]?.quantity,loaded.coins],[22,1,balance])
  tomorrow.mounted.destroy()
})

test('with the ordinary concert bonus already granted, the eighth actual refusal preserves the rest action', () => {
  const farm=earnedFirstRefusalShop(50), shop=farm.bayShop, balance=farm.coins
  const before=watchMountedRefusal(farm)
  before.until(()=>shop.visitor===null && shop.visitsToday===6)
  before.mounted.destroy()
  // Completed concert is a boundary input; no audio/player behavior is under test.
  farm.concertDay=farm.day;farm.musicGarden.performances++
  const granted=restoreFarm(JSON.parse(JSON.stringify(farm)))!, watched=watchMountedRefusal(granted)
  assert.equal(watched.count.textContent,'Гости сегодня: 6 из 8');assert.equal(watched.next.hidden,true)
  watched.until(()=>granted.bayShop.visitor?.serial===8 && granted.bayShop.visitor.outcome!==null)
  assert.equal(granted.bayShop.visitor?.id,'finn');assert.equal(granted.bayShop.visitor?.outcome?.kind,'expensive')
  assert.equal(watched.next.hidden,true)
  watched.until(()=>granted.bayShop.visitor===null)
  assert.equal(watched.detail.textContent,'Финн: цена не подошла. Новые гости после отдыха.')
  assert.equal(watched.count.textContent,'Гости сегодня: 8 из 8')
  assert.equal(watched.next.textContent,'Домой к отдыху');assert.equal(watched.next.hidden,false)
  const exact=structuredClone(granted)
  watched.press(['data-shop-next']);assert.deepEqual(watched.nextActions,['rest'])
  assert.deepEqual(granted,exact);assert.equal(granted.coins,balance)
  watched.mounted.destroy()
})
