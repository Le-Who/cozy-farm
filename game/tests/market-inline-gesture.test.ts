import assert from 'node:assert/strict'
import test from 'node:test'
import { ActionClickGuard, ActivationKeyGuard, installActionClickGuard, isGuardedAction } from '../src/action-click-guard.ts'
import { MarketInlineSales } from '../src/market-inline-sale.ts'
import { createFarm, getMarketStock, sellMarketItem } from '../src/farm.ts'

test('inline confirmation and rearming own their gesture; quantity stepping stays repeatable', () => {
  assert.equal(isGuardedAction('inline-sale-confirm'), true)
  assert.equal(isGuardedAction('inline-sale-again'), true)
  assert.equal(isGuardedAction('inline-sale-step'), false)
})

test('held Enter cannot cross inline receipt and rearm into another sale', () => {
  const farm = createFarm(); farm.fruit.apple = 10; farm.progress.sell = 1
  const before = structuredClone(farm), ui = new MarketInlineSales(), keys = new ActivationKeyGuard()
  const key = 'fruit:apple', price = getMarketStock(farm).find(item => item.key === key)!.price
  let view = ui.view(key, farm.fruit.apple, price)
  assert.ok(ui.edit(key, view.token, '3', farm.fruit.apple, price))
  const activate = (repeat: boolean) => {
    const view = ui.view(key, farm.fruit.apple, price), action = view.receipt ? 'inline-sale-again' : 'inline-sale-confirm'
    if (keys.blocks({key:'Enter', repeat}, isGuardedAction(action))) return false
    if (view.receipt) return ui.rearm(key, view.token, farm.fruit.apple, price)
    const quote = ui.take(key, view.token, farm.fruit.apple, price)
    if (!quote) return false
    assert.ok(sellMarketItem(farm, key, quote.quantity).ok); ui.finish(key, quote); return true
  }
  assert.equal(activate(false), true)
  for (let i = 0; i < 8; i++) assert.equal(activate(true), false)
  const expected = structuredClone(before); sellMarketItem(expected, key, 3)
  assert.deepEqual(farm, expected)
  keys.release('Enter'); assert.equal(activate(false), true, 'fresh press rearms without selling')
  for (let i = 0; i < 8; i++) assert.equal(activate(true), false)
  assert.deepEqual(farm, expected)
  keys.release('Enter'); assert.equal(activate(false), true, 'next deliberate press sells the one-unit draft')
  sellMarketItem(expected, key, 1); assert.deepEqual(farm, expected)
})

test('one inline pointer gesture cannot fall through a receipt; later intentional actions work', () => {
  for (const action of ['inline-sale-confirm','inline-sale-again']) {
    const guard = new ActionClickGuard(), first = {detail:1,timeStamp:100,clientX:320,clientY:280}
    assert.equal(guard.blocks(first), false)
    if (isGuardedAction(action)) guard.remember(first)
    assert.equal(guard.blocks({...first, timeStamp:180}), true)
    assert.equal(guard.blocks({...first, detail:2,timeStamp:180}), true)
    assert.equal(guard.blocks({...first, detail:0,timeStamp:200}), false)
    assert.equal(guard.blocks({...first, timeStamp:701}), false)
  }
})

test('inline quantity input keeps held-key ownership even if its last stock row disappears', () => {
  const previous = globalThis.Element, handlers = new Map<string, Function>()
  class Control {
    readonly inline: boolean
    constructor(inline = false) { this.inline = inline }
    closest(selector: string) { return this.inline && selector.includes('[data-inline-quantity]') ? this : null }
  }
  Object.assign(globalThis, { Element: Control })
  const root = { addEventListener() {}, contains: () => true, ownerDocument: {
    addEventListener: (type: string, handler: Function) => handlers.set(type, handler), defaultView: {addEventListener() {}},
  } }
  const dispatch = (target: Control, repeat: boolean) => {
    let prevented = false, stopped = false
    handlers.get('keydown')!({target,key:'Enter',repeat,preventDefault(){prevented=true},stopImmediatePropagation(){stopped=true}})
    assert.equal(prevented, stopped); return prevented
  }
  try {
    installActionClickGuard(root as unknown as HTMLElement)
    assert.equal(dispatch(new Control(true), false), false)
    assert.equal(dispatch(new Control(), true), true, 'redraw may focus the unguarded search field')
    handlers.get('keyup')!({key:'Enter'})
    assert.equal(dispatch(new Control(), false), false)
  } finally { Object.assign(globalThis, {Element: previous}) }
})
