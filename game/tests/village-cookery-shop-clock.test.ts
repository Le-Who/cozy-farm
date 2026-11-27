import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import * as F from '../src/farm.ts'
import * as S from '../src/bay-shop-model.ts'
import { reserveShopGoods } from '../src/harbour-economy.ts'
import { describeFood } from '../src/intent-orders.ts'
import { commissionPlayer } from './fixtures/commission-player.ts'

const read = (name: string) => readFileSync(new URL(name, import.meta.url), 'utf8')
const app = read('../src/main.ts'), kitchen = read('../src/cookery.ts'), shop = read('../src/bay-shop.ts')
const opening = JSON.parse(read('./fixtures/home-progress-actions.json'))
const optionalPart = (source: string, start: string, end: string) => {
  const from = source.indexOf(start)
  if (from === -1) return ''
  const to = source.indexOf(end, from + start.length)
  assert.ok(to > from, start)
  return source.slice(from, to)
}
const draft = { base: 'preserves', ingredients: [{ id: 'apple', quantity: 1 }, { id: 'pear', quantity: 1 }] } as const
const result = { family: 'preserves', processing: 'silky', fruit: [], steps: ['mix', 'pour'] } as const

function earnedShop(includeEggs = true) {
  const p = commissionPlayer(opening)
  assert.deepEqual([p.actions, p.state.day, p.state.island, p.state.coins, p.state.village.meals], [107,14,'village',68,2])
  p.fruit('apple', 1); p.fruit('pear', 1); p.visit('village')
  const id = 'dish:orchardTart', food = F.foodDescriptors(p.state).find(item => item.id === id)!
  assert.deepEqual([p.state.day, food.count, food.sellPrice, p.state.eggs], [14,1,25,3])
  assert.ok(reserveShopGoods(p.state, id, 1))
  assert.ok(S.stockBayShop(p.state.bayShop, 0, { id, identity: id, name: food.name, image: '/art/lavender/ui-tart.webp', basePrice: food.sellPrice, tags: [...food.ingredients, ...describeFood(food)] }, 1))
  if (includeEggs) {
    const price = F.unitPrice({kind:'eggs',quantity:1}, p.state)
    assert.equal(price, 3)
    assert.ok(reserveShopGoods(p.state, 'eggs', 2))
    assert.ok(S.stockBayShop(p.state.bayShop, 1, { id:'eggs', identity:'eggs', name:'Яйцо', image:'/art/lavender/egg.webp', tags:['eggs'], basePrice:price }, 2))
  }
  S.setBayShopOpen(p.state.bayShop, true)
  p.reload()
  assert.ok(F.getSignatureAction(p.state, draft).available)
  return p.state
}

function watched(farm: F.FarmState) {
  const at: number[] = [], state = farm.bayShop, noop = () => {}
  let now = 0
  const sandbox = {
    state, advanceBayShop: S.advanceBayShop, destroyed:false, document:{hidden:false}, lastTime:0, lastPhase:'', lastRefusal:undefined, savedAt:0,
    earnedOrder:undefined, frame:0, tab:'stock', hasShelfStock:() => state.slots.some(slot => slot && slot.quantity > 0),
    options:{onEarn(price:number) { farm.coins += price; at.push(now) }, performanceBonus:() => Number(farm.concertDay === farm.day)},
    render:noop, paintDayGuidance:noop, paintVisitor:noop, saveChanges:noop, requestAnimationFrame:() => 1,
  }
  const tick = runInNewContext(stripTypeScriptTypes(optionalPart(shop, '  function tick(now:', '  const resizeObserver')) + '\ntick', sandbox)
  return { at, until(time:number) { while(now < time) { now += Math.min(100, time - now); tick(now) } } }
}

function cooking(farm: F.FarmState, kind = 'preserves') {
  let activeFrame: ((now?: number) => void) | undefined
  let crossing = false, now = 0
  const at: [number, number][] = [], writes: F.FarmState[] = []
  const host = { isConnected:true }
  const doc = Object.assign(new EventTarget(), { hidden:false })
  const abort = new AbortController()
  const ctx: any = {
    signal:abort.signal, farm, panel:'cookery', harbourScene:undefined, dialog:{ open:true }, document:doc, model:{stage:'fruit'}, loaded:true, destroyed:false, contextLost:false,
    island:{isCrossing:() => crossing}, dialogContent:{contains:(element:unknown) => element === host},
    createBayShopWorkClock:S.createBayShopWorkClock,
    numberFormat:new Intl.NumberFormat('ru'), textAt:() => {}, bayAudio:{playEvent(){}},
    saveHarbour(){ writes.push(structuredClone(farm)) },
  }
  const mount = (_host: unknown, _options: unknown, frame?: (now?: number) => void) => {
    activeFrame = frame
    return {destroy() { activeFrame?.() }}
  }
  const mountPart = optionalPart(app, 'function mountFarmCookery(', 'function exactSaleCard(')
  const credit = optionalPart(app, 'function earnHarbourSale(', 'function openMusicScene(')
  const mounted = mountPart
    ? runInNewContext(stripTypeScriptTypes(credit + mountPart) + '\nmountFarmCookery', ctx)(host,{ recipe:{ kind } },mount)
    : mount(host,{ recipe:{ kind } }) // Exact old lazy factory passes only host/options.
  Object.defineProperty(ctx, 'shopWorkFrame', { get:() => activeFrame })
  const renderTick = optionalPart(kitchen, '  function tickCookeryShop(', '  function animate(now:')
  const tick = renderTick ? runInNewContext(stripTypeScriptTypes(renderTick) + '\ntickCookeryShop', ctx) : () => {}
  const visibility = kitchen.split('\n').find(line => line.includes("addEventListener('visibilitychange'"))
  if (visibility) runInNewContext(visibility, ctx)
  return { ctx, host, doc, writes, at,
    crossing(value:boolean) { crossing = value }, destroyed() { ctx.destroyed = true; mounted.destroy(); abort.abort(); host.isConnected = false },
    visibilityPause() { doc.hidden = true; doc.dispatchEvent(new Event('visibilitychange')) },
    frame(time:number) {
      now = time
      const sold = farm.bayShop.sold
      tick(now)
      if (farm.bayShop.sold !== sold) at.push([now, farm.coins])
    },
    until(time:number) { while (now < time) this.frame(now + Math.min(100, time - now)) },
  }
}

test('earned D14 active Village preserves earns the same three posted sales while one separately finished recipe remains in the bag', () => {
  const active = earnedShop(), watching = structuredClone(active), overnight = structuredClone(active)
  const untouched = { eggs:active.eggs, day:active.day, orders:structuredClone(active.orders), commissions:structuredClone(active.shopCommissions), festival:structuredClone(active.festivals) }
  const stall = watched(watching), board = cooking(active)
  board.frame(0)
  assert.deepEqual(watching, active); assert.deepEqual(board.writes, [])
  board.until(7399); assert.deepEqual([active.coins,active.bayShop.sold,active.fruit.apple,active.fruit.pear],[68,0,1,1])
  board.until(7400); assert.deepEqual(board.at,[[7400,93]])
  assert.deepEqual([board.writes.at(-1)?.coins,board.writes.at(-1)?.bayShop.sold,board.writes.at(-1)?.bayShop.slots[0]?.quantity],[93,1,0])
  board.until(42000); stall.until(42000)
  assert.deepEqual(stall.at, [7400,24000,40600])
  assert.deepEqual(board.at, [[7400,93],[24000,96],[40600,99]])
  assert.deepEqual(active, watching)
  const orderCountBeforeFinish = active.bayShop.sold
  assert.equal(F.completeSignature(active, draft, result).ok, true)
  assert.deepEqual([Object.values(active.culinary.stock).reduce((a,b)=>a+b,0),active.fruit.apple,active.fruit.pear,active.bayShop.sold,active.coins,active.eggs], [1,0,0,orderCountBeforeFinish,99,untouched.eggs])
  assert.deepEqual([active.orders,active.shopCommissions,active.festivals,active.day],[untouched.orders,untouched.commissions,untouched.festival,untouched.day])
  const afterReceipt = structuredClone(active)
  board.ctx.model.stage = 'finished'; board.until(62000); board.destroyed()
  assert.deepEqual(active, afterReceipt, 'viewing the cooking receipt or returning cannot advance a buyer')
  for (const farm of [active,overnight]) {
    assert.ok(F.sail(farm,'home').ok); assert.ok(F.endDay(farm).ok)
    assert.ok(F.restoreCurrentFarm(farm)); assert.equal(farm.day,15)
  }
  assert.equal(active.coins,99); assert.equal(overnight.coins,99)
  assert.deepEqual(active.bayShop,overnight.bayShop,'ordinary dawn fills the allowance once through the existing ledger')
})

test('closing only the actual tart scene and reopening the shop resumes the same buyer, while Close business does not make an invisible sale', () => {
  const farm = earnedShop(false), board = cooking(farm, 'decorate')
  board.frame(0); board.until(4600)
  assert.deepEqual([farm.bayShop.visitor?.id,farm.bayShop.visitor?.phase,farm.bayShop.visitor?.elapsed,farm.bayShop.visitsToday], ['bea','browsing',200,1])
  board.destroyed(); assert.deepEqual(board.writes.at(-1)?.bayShop,farm.bayShop)
  const saved = structuredClone(farm)
  board.frame(60000)
  assert.deepEqual(farm,saved)
  const activeStall = watched(farm); activeStall.until(2799)
  assert.deepEqual([farm.bayShop.visitor?.serial, farm.bayShop.sold], [1,0])
  activeStall.until(2800)
  assert.deepEqual([activeStall.at,farm.bayShop.visitor?.serial,farm.bayShop.visitsToday,farm.coins],[[2800],1,1,93])
  const closed = earnedShop(false), preview = cooking(closed)
  preview.frame(0); preview.until(4600)
  S.setBayShopOpen(closed.bayShop, false)
  preview.until(20000)
  assert.deepEqual([closed.bayShop.visitor?.outcome?.kind,closed.bayShop.sold,closed.coins],['closed',0,68])
  S.setBayShopOpen(closed.bayShop, true)
  const reopened = watched(closed); reopened.until(15000)
  assert.equal(reopened.at.length,1)
  assert.deepEqual([closed.bayShop.sold,closed.coins,closed.bayShop.memories.bea.purchases,closed.bayShop.memories.finn.purchases['dish:orchardTart']?.bought],[1,93,{},1])
})

test('unloaded/closed/away/hidden/covered cookery cannot accrue any paid time; restore never catches up', () => {
  const cases = [
    ['honey or grill', (s:ReturnType<typeof cooking>) => {}, 'honeyPear'],
    ['loading', (s:ReturnType<typeof cooking>) => { s.ctx.loaded = false }],
    ['renderer lost', (s:ReturnType<typeof cooking>) => { s.ctx.contextLost = true }],
    ['recipe book', (s:ReturnType<typeof cooking>) => { s.ctx.panel = 'recipes' }],
    ['dialog closed', (s:ReturnType<typeof cooking>) => { s.ctx.dialog.open = false }],
    ['already owned', (s:ReturnType<typeof cooking>) => { s.ctx.harbourScene = {} }],
    ['crossing', (s:ReturnType<typeof cooking>) => { s.crossing(true) }],
    ['stale business day', (s:ReturnType<typeof cooking>) => { s.ctx.farm.bayShop.businessDay-- }],
    ['detached', (s:ReturnType<typeof cooking>) => { s.host.isConnected = false }],
    ['Home', (s:ReturnType<typeof cooking>) => { assert.ok(F.sail(s.ctx.farm,'home').ok) }],
  ] as const
  for (const [label, block, kind] of cases) {
    const farm=earnedShop(), board=cooking(farm,kind)
    block(board); const before=structuredClone(farm)
    board.frame(0); board.until(9000)
    assert.deepEqual(farm,before,label); assert.deepEqual(board.writes,[],label)
  }
  const farm=earnedShop(), board=cooking(farm)
  board.frame(0); board.until(7000)
  const before=structuredClone(farm)
  board.visibilityPause(); board.doc.hidden=false
  board.frame(7450) // Short hide with no RAF while hidden: normal long-gap cap alone cannot prevent this.
  assert.deepEqual(farm,before)
  board.frame(9950); assert.deepEqual(farm,before,'one actual 2500ms stall is never catch-up')
  board.until(10349); assert.equal(farm.bayShop.sold,0)
  board.until(10350); assert.deepEqual(board.at,[[10350,93]])
  assert.match(kitchen, /webglcontextlost'[\s\S]*?contextLost = true; shopWorkFrame\?\.\(\)/)
  assert.match(kitchen, /destroyed = true; shopWorkFrame\?\.\(\)/)
  assert.match(kitchen, /renderer.render\(scene, camera\); tickCookeryShop\(now\); frame = requestAnimationFrame\(animate\)/)
  assert.match(app, /const createCookery = lazyScene\([\s\S]+?mountFarmCookery\(host, options, createCookery\)/)
})

test('an open empty shelf does not use invisible visits; exact unaffordable stock still refuses', () => {
  const sold = earnedShop(false), one = cooking(sold)
  one.frame(0); one.until(60000)
  assert.deepEqual([sold.bayShop.sold,sold.bayShop.serial,sold.bayShop.visitsToday,sold.bayShop.visitor,sold.coins],[1,1,1,null,93])
  const refused = earnedShop(false), priced = cooking(refused)
  assert.ok(S.setBayShopPrice(refused.bayShop,0,96))
  priced.frame(0); priced.until(7400)
  assert.deepEqual([refused.bayShop.visitor?.outcome?.kind,refused.bayShop.slots[0]?.quantity,refused.bayShop.sold,refused.coins],['budget',1,0,68])
})
