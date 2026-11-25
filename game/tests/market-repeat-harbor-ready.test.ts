import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { runInNewContext } from 'node:vm'
import { deliverHarborOrder, getHarborOrder, getMarketOrders } from '../src/farm.ts'
import { readyHarborOrderRoute } from '../src/harbor-return.ts'
import { getMarketOrderBoard, renderMarketOrderPicker } from '../src/market-orders-view.ts'
import { commissionPlayer } from './fixtures/commission-player.ts'

const read = (file: string) => readFileSync(new URL(file, import.meta.url), 'utf8')
const opening = JSON.parse(read('./fixtures/home-progress-actions.json'))
const main = read('../src/main.ts')
function section(start: string, end: string) {
  const a = main.indexOf(start), b = main.indexOf(end, a + start.length)
  assert.ok(a >= 0 && b > a, start)
  return main.slice(a, b)
}
const reopen = stripTypeScriptTypes(section('  // An automatic order belongs to this visit.', '  const reopenScroll ='))
const switchTabs = stripTypeScriptTypes(`switch('market-tab'){${section("    case 'market-tab':", "    case 'market-order-pickup':")}}`)
const selectOrder = stripTypeScriptTypes(`switch('market-order-select'){${section("    case 'market-order-select':", "    case 'deliver-order':")}}`)
const readyRoute = stripTypeScriptTypes(`(async function(){ switch('harbor-order-route'){${section("    case 'harbor-order-route':", "    case 'harbor-next-rest':")}} })`)

function repeatGroveParcel() {
  const p = commissionPlayer(opening)
  const makePreserves = () => {
    p.fruit('apple', 1); p.fruit('pear', 1); p.visit('home'); p.act('cookDish', 'orchardPreserves')
  }
  p.visit('home'); p.act('specializeFarmhouse', 'preserves'); makePreserves()
  p.visit('grove'); p.act('catchFish', true); p.act('deliverHarborOrder')
  assert.deepEqual(p.state.orders.harbor, { completed: 1, deliveredOn: 14 })
  while (p.state.day < 17) p.night()
  p.fruit('apple', 1); p.fruit('pear', 1); p.act('gatherSeaSalt'); p.visit('home'); p.act('cookDish', 'orchardPreserves')
  assert.deepEqual([p.actions, p.state.day, p.state.island, p.state.coins, p.state.seaSalt, p.state.dishes.orchardPreserves], [127, 17, 'home', 52, 2, 1])
  return p
}

const chosen = (board: ReturnType<typeof getMarketOrderBoard>) => [...renderMarketOrderPicker(board, () => '').matchAll(/data-action="market-order-select" data-value="([^"]+)" aria-pressed="(true|false)"/g)]
  .map(match => ({ id: match[1], pressed: match[2] === 'true' }))

test('earned Day 17 repeat Grove parcel is the only usable order; its existing route is suggested before waiting cards, without leaving Home', async () => {
  const p = repeatGroveParcel(), farm = p.state, before = structuredClone(farm), trips: string[][] = []
  assert.deepEqual(getMarketOrders(farm).map(order => order.status), Array(8).fill('waiting'))
  const board = getMarketOrderBoard(farm), buttons = chosen(board)
  assert.equal(readyHarborOrderRoute(farm), '17:1:preserves')
  assert.equal(board.selected, 'harbor', 'do not default to a waiting garden order when the carried parcel is ready')
  assert.deepEqual(buttons[0], { id: 'harbor', pressed: true })
  assert.deepEqual(buttons.slice(1).map(button => button.id), getMarketOrders(farm).map(order => order.lane))
  assert.deepEqual(buttons.filter(button => button.pressed).map(button => button.id), ['harbor'])
  assert.deepEqual(farm, before)
  const source = {}, c = {
    farm, readyHarborOrderRoute, panel: 'market', marketTab: 'orders', selectedMarketOrder: board.selected, dialog: { open: true },
    dialogContent: { contains: (element: unknown) => element === source }, control: source, value: '16:1:preserves',
    visitPanelAt: (...destination: string[]) => trips.push(destination),
  }
  const press = runInNewContext(readyRoute, c) as () => Promise<void>
  await press(); assert.deepEqual(trips, [], 'a stale control cannot start the trip')
  c.value = '17:1:preserves'; await press(); assert.deepEqual(trips, [['grove', 'harbor']]); assert.deepEqual(farm, before)
  p.visit('grove'); p.act('deliverHarborOrder')
  assert.deepEqual([p.state.coins, p.state.seaSalt, p.state.dishes.orchardPreserves, p.state.orders.harbor.completed], [92, 0, 0, 2])
  assert.equal(deliverHarborOrder(p.state).ok, false)
})

test('manual waiting selection survives changing tabs and backing out; the alternate remains an explicit choice', () => {
  const farm = repeatGroveParcel().state, before = structuredClone(farm), focus: string[] = []
  const c = {
    farm, getMarketOrderBoard, panel: 'market', next: 'market', remember: true, entry: undefined,
    marketTab: 'orders', dialog: { open: true }, selectedMarketOrder: 'harbor' as string | undefined, pickedMarketOrder: undefined as string | undefined,
    dialogFeedback: { hidden: false, textContent: 'old' }, value: 'pantry', closeContextualSale() {},
    dialogContent: { scrollTop: 88, querySelector(selector: string) {
      if (selector === '.market-order-picker') return { scrollTop: 23 }
      if (selector === '.market-order-detail') return { focus: () => focus.push(c.selectedMarketOrder!), scrollIntoView() {} }
    } },
    drawPanel() { c.selectedMarketOrder = getMarketOrderBoard(farm, c.selectedMarketOrder).selected },
  }
  runInNewContext(selectOrder, c)
  assert.equal(c.selectedMarketOrder, 'pantry'); assert.equal(c.pickedMarketOrder, 'pantry'); assert.deepEqual(focus, ['pantry'])
  for (const value of ['sell', 'orders']) { c.value = value; runInNewContext(switchTabs, c) }
  assert.equal(c.selectedMarketOrder, 'pantry'); assert.equal(c.dialogContent.scrollTop, 0)
  c.dialog.open = false; c.selectedMarketOrder = undefined
  runInNewContext(reopen, c); c.drawPanel()
  assert.equal(c.selectedMarketOrder, 'pantry')
  assert.equal(chosen(getMarketOrderBoard(farm, c.selectedMarketOrder)).filter(button => button.id === 'harbor').length, 1)
  assert.deepEqual(farm, before)
})

test('genuine local carried/warehouseable order stays ahead, while an undersupplied or completed pier parcel stays in its normal group', () => {
  const p = repeatGroveParcel()
  p.visit('grove'); p.act('catchFish', true); p.visit('home')
  let board = getMarketOrderBoard(p.state)
  assert.equal(readyHarborOrderRoute(p.state), '17:1:preserves')
  assert.equal(board.selected, 'grove'); assert.deepEqual(chosen(board)[0], { id: 'grove', pressed: true })
  p.act('transferBayGoods', 'deposit', 'home', 'seaBass', 1); board = getMarketOrderBoard(p.state)
  assert.equal(readyHarborOrderRoute(p.state), '17:1:preserves')
  assert.equal(board.choices.find(order => order.id === 'grove')?.group, 'warehouse')
  assert.equal(board.selected, 'grove'); assert.deepEqual(chosen(board)[0], { id: 'grove', pressed: true })
  const snapshot = structuredClone(p.state), routeIndex = (state = p.state) => chosen(getMarketOrderBoard(state)).findIndex(button => button.id === 'harbor')
  assert.equal(routeIndex(), 1); assert.deepEqual(p.state, snapshot)
  p.act('sellMarketItem', 'seaSalt', 1)
  assert.equal(readyHarborOrderRoute(p.state), undefined)
  assert.equal(routeIndex(), getMarketOrders(p.state).length)
  assert.equal(getMarketOrderBoard(p.state, 'harbor').selected, 'harbor', 'a player can still browse an incomplete parcel')
  const complete = repeatGroveParcel(); complete.visit('grove'); complete.act('deliverHarborOrder'); complete.visit('home')
  assert.equal(getHarborOrder(complete.state)?.status, 'completed')
  assert.equal(readyHarborOrderRoute(complete.state), undefined); assert.equal(routeIndex(complete.state), 8)
})
