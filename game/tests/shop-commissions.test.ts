import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import * as F from '../src/farm.ts'
import * as C from '../src/shop-commissions.ts'
import { isGuardedAction, ActionClickGuard, ActivationKeyGuard } from '../src/action-click-guard.ts'
import { commissionPlayer } from './fixtures/commission-player.ts'
const opening = JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json', import.meta.url), 'utf8'))
function customer() { const p = commissionPlayer(opening), id = p.cook(); p.shelf(id); p.sale(); return { p, id } }
function accept(p: ReturnType<typeof commissionPlayer>) {
  const offer = C.getShopCommissionOffers(p.state).find(o => o.customer === 'bea')!
  p.act('acceptShopCommission', offer.key)
  return String(p.state.shopCommissions.serial)
}
function unchanged(f: F.FarmState, action: () => { ok: boolean }) { const before = structuredClone(f); assert.equal(action().ok, false); assert.deepEqual(f, before) }

test('a real liked shop purchase, not an unsold shelf or a tasting, opens the exact authored recipe', () => {
  const p = commissionPlayer(opening), id = p.cook()
  assert.equal(C.getShopCommissionOffers(p.state).length, 0)
  p.act('tasteSignature', id, 'bea'); assert.equal(C.getShopCommissionOffers(p.state).length, 0)
  p.cook(id); p.shelf(id); assert.equal(C.getShopCommissionOffers(p.state).length, 0)
  p.sale()
  const offer = C.getShopCommissionOffers(p.state)[0]
  assert.equal(offer.customer, 'bea'); assert.equal(offer.recipeId, id)
  assert.deepEqual([offer.quantity, offer.bonus, offer.total], [2, 6, 44])
  p.act('nameSignature', id, 'Тёплый вечер')
  assert.equal(C.getShopCommissionOffers(p.state)[0].key, offer.key)
  assert.equal(C.getShopCommissionOffers(p.state)[0].recipeName, 'Тёплый вечер')
})

test('an actual unliked purchase gives no offer', () => {
  const p = commissionPlayer(opening), id = p.cook()
  p.shelf(id)
  // Only this focused test changes tags: a purchased but unliked recipe is insufficient.
  p.state.bayShop.slots[0]!.product.tags = ['unliked']
  p.sale()
  assert.equal(p.state.bayShop.sold, 1)
  assert.equal(p.state.bayShop.memories.bea.purchases[`signature:${id}`].liked, 0)
  assert.equal(C.getShopCommissionOffers(p.state).length, 0)
})

test('a fresh-farm multi-session route produces 2, 3 then 4 portions without injected resources', () => {
  const { p, id } = customer()
  const ledger = structuredClone(p.state.bayShop)
  let payouts = 0
  for (const quantity of [2, 3, 4, 4]) {
    const serial = accept(p)
    assert.equal(C.getShopCommission(p.state)!.quantity, quantity)
    for (let i = 0; i < quantity; i++) {
      p.cook(id); p.act('deliverShopCommission', serial)
      if (i === 0) { for (let day = 0; day < 3; day++) p.night(); p.visit('village') }
    }
    const before = p.state.coins, total = C.getShopCommission(p.state)!.total
    p.act('finishShopCommission', serial)
    assert.equal(p.state.coins, before + total); payouts += total
    unchanged(p.state, () => C.finishShopCommission(p.state, serial))
    assert.equal(C.getShopCommissionOffers(p.state).length, 0)
    p.night(); p.visit('village')
  }
  assert.equal(payouts, 286); assert.equal(p.state.shopCommissions.completed.bea, 4)
  assert.equal(p.state.culinary.stock[id], 0)
  assert.equal(p.state.bayShop.sold, ledger.sold)
  assert.deepEqual(p.state.bayShop.memories, ledger.memories)
  assert.deepEqual(p.state.bayShop.reputation, ledger.reputation)
  assert.ok(p.state.day > 20)
})

test('partial escrow takes local warehouse first, persists, cancels exactly once and rejects old serials', () => {
  const { p, id } = customer(); p.cook(id); p.cook(id)
  p.act('transferBayGoods', 'deposit', 'village', `signature:${id}`, 1)
  const serial = accept(p), coins = p.state.coins
  p.act('deliverShopCommission', serial)
  assert.equal(C.getShopCommission(p.state)!.warehouse, 0); assert.equal(p.state.culinary.stock[id], 1)
  for (let i = 0; i < 8; i++) p.night()
  p.visit('village'); assert.equal(C.getShopCommission(p.state)!.delivered, 1)
  unchanged(p.state, () => F.forgetSignature(p.state, id))
  p.act('cancelShopCommission', serial)
  assert.equal(p.state.culinary.stock[id], 2); assert.equal(p.state.coins, coins)
  unchanged(p.state, () => C.cancelShopCommission(p.state, serial))
  const next = accept(p); assert.notEqual(next, serial)
  unchanged(p.state, () => C.deliverShopCommission(p.state, serial))
  unchanged(p.state, () => C.cancelShopCommission(p.state, serial))
  unchanged(p.state, () => C.finishShopCommission(p.state, serial))
})

test('shop shelf and a different authored result cannot supply an order or get spent twice', () => {
  const { p, id } = customer(); p.cook(id); p.shelf(id)
  const serial = accept(p), before = structuredClone(p.state.bayShop)
  unchanged(p.state, () => C.deliverShopCommission(p.state, serial))
  p.fruit('apple', 1); p.fruit('pear', 1); p.visit('village')
  const other = p.act('completeSignature', { base: 'preserves', ingredients: [{ id: 'apple', quantity: 1 }, { id: 'pear', quantity: 1 }] },
    { family: 'preserves', processing: 'chunky', fruit: [], steps: ['mix', 'pour'] }).recipeId
  assert.notEqual(other, id)
  unchanged(p.state, () => C.deliverShopCommission(p.state, serial))
  assert.deepEqual(p.state.bayShop, before)
  assert.equal(p.state.culinary.stock[other], 1)
})

test('acceptance and every delivery action are harbour-local and atomic at resource limits', () => {
  const { p, id } = customer(); const offer = C.getShopCommissionOffers(p.state)[0]
  p.visit('home'); unchanged(p.state, () => C.acceptShopCommission(p.state, offer.key))
  p.visit('village'); const serial = accept(p); p.cook(id); p.cook(id)
  p.visit('home')
  for (const command of [C.deliverShopCommission, C.cancelShopCommission, C.finishShopCommission]) unchanged(p.state, () => command(p.state, serial))
  p.visit('village'); p.act('deliverShopCommission', serial)
  p.state.culinary.stock[id] = 1_000_000
  unchanged(p.state, () => C.cancelShopCommission(p.state, serial))
  p.state.culinary.stock[id] = 1; p.act('deliverShopCommission', serial)
  unchanged(p.state, () => C.deliverShopCommission(p.state, serial))
  p.state.coins = Number.MAX_SAFE_INTEGER
  unchanged(p.state, () => C.finishShopCommission(p.state, serial))
})

test('removing and recreating a recipe does not transfer a customer memory to a new recipe ID', () => {
  const { p, id } = customer()
  p.state.bayShop.slots[0] = null
  p.act('forgetSignature', id)
  const next = p.cook(); assert.notEqual(next, id)
  assert.equal(C.getShopCommissionOffers(p.state).length, 0)
})

test('malformed or incomplete ledgers never become empty orders, while legacy absence is explicit', () => {
  const { p, id } = customer(); const serial = accept(p); p.cook(id); p.act('deliverShopCommission', serial)
  for (const mutate of [
    (f: any) => { delete f.shopCommissions },
    (f: any) => { f.shopCommissions.version = 2 },
    (f: any) => { delete f.shopCommissions.active },
    (f: any) => { delete f.shopCommissions.completed.bea },
    (f: any) => { f.shopCommissions.active.delivered = 3 },
    (f: any) => { f.shopCommissions.active.recipeId = 's999' },
    (f: any) => { f.shopCommissions.active.unitPrice++ },
    (f: any) => { f.shopCommissions.active.startedOn = 0 },
    (f: any) => { f.shopCommissions.completed.bea++ },
    (f: any) => { f.shopCommissions.last = {} },
  ]) { const value = structuredClone(p.state); mutate(value); assert.equal(F.restoreCurrentFarm(value), undefined) }
  const legacy = structuredClone(p.state) as any; delete legacy.shopCommissions
  assert.deepEqual(F.restoreFarm(legacy)!.shopCommissions, C.createShopCommissions())
})

test('all new guarded controls suppress double-click and held-key activation after redraw', () => {
  for (const action of ['accept', 'deliver', 'cancel', 'finish', 'recipe', 'rest']) assert.ok(isGuardedAction(`commission-${action}`))
  const guard = new ActionClickGuard(), click = { detail: 1, timeStamp: 100, clientX: 50, clientY: 50 }
  guard.remember(click); assert.ok(guard.blocks({ ...click, timeStamp: 350, detail: 2 }))
  const keys = new ActivationKeyGuard()
  assert.equal(keys.blocks({ key: 'Enter', repeat: false }, true), false)
  assert.equal(keys.blocks({ key: 'Enter', repeat: true }, false), true)
  keys.release('Enter'); assert.equal(keys.blocks({ key: 'Enter', repeat: false }, true), false)
})

test('a full recipe book cannot delete the active recipe but still allows its exact repeat', () => {
  const { p, id } = customer(); accept(p)
  // Resource-rich boundary fixture. The separate playthrough above earns all its resources.
  p.state.fruit.apple = 60; p.state.fruit.pear = 60; p.state.produce.wheat = 30; p.state.eggs = 30
  for (let i = 0; i < 23; i++) p.act('completeSignature', { base: 'tart', ingredients: [{ id: 'apple', quantity: 1 }, { id: 'pear', quantity: 1 }] },
    { family: 'decorate', processing: 'bright', fruit: [{ ingredientId: 'apple', x: i / 25, y: 0, angle: 0 }], steps: ['place'] })
  assert.equal(p.state.culinary.recipes.length, 24)
  assert.equal(p.state.culinary.stock[id], 0)
  unchanged(p.state, () => F.forgetSignature(p.state, id))
  p.act('repeatSignature', id)
  assert.equal(p.state.culinary.recipes.length, 24); assert.equal(p.state.culinary.stock[id], 1)
})
