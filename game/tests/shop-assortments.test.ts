import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import * as F from '../src/farm.ts'
import * as C from '../src/shop-commissions.ts'
import { ShopAssortmentChoice } from '../src/shop-assortment-choice.ts'
import { renderShopCommissions } from '../src/shop-commissions-ui.ts'
import { ActionClickGuard, isGuardedAction } from '../src/action-click-guard.ts'
import { assortmentPlayer } from './fixtures/assortment-player.ts'
const opening = JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json', import.meta.url), 'utf8'))
const earned = assortmentPlayer(opening)
const fresh = () => structuredClone(earned.p.state)
const offer = (farm: F.FarmState) => C.getShopAssortment(farm, 'bea', earned.jam, earned.tart)!
function unchanged(farm: F.FarmState, act: () => { ok: boolean }) { const before = structuredClone(farm); assert.equal(act().ok, false); assert.deepEqual(farm, before) }
function accepted() { const f = fresh(); assert.ok(C.acceptShopCommission(f, offer(f).key).ok); return f }
function stocked() {
  const f = accepted()
  // Boundary checks use stock; the separate long routes earn every actual portion.
  f.culinary.stock[earned.jam] = 2; f.culinary.stock[earned.tart] = 2
  return f
}
function fill(f: F.FarmState) {
  for (const line of C.getShopCommission(f)!.lines) for (let n = line.delivered; n < 2; n++) assert.ok(C.deliverShopCommission(f, line.actionValue).ok)
}

test('the earned set needs two completed orders and an actual liked purchase of each different base', () => {
  const f = fresh(), before = structuredClone(f)
  assert.deepEqual([f.day, f.shopCommissions.completed.bea], [25, 2])
  const mixed = offer(f)
  assert.deepEqual(mixed.lines.map(line => line.quantity), [2, 2]); assert.equal(mixed.bonus, 12)
  assert.equal(mixed.total, 114); assert.equal(mixed.total - mixed.lines.reduce((n, line) => n + 2 * line.unitPrice, 0), 12)
  assert.deepEqual(C.getShopAssortment(f, 'bea', earned.tart, earned.jam), mixed)
  assert.deepEqual(f, before)
  assert.equal(C.getShopAssortment(f, 'bea', earned.jam, earned.jam), undefined)
  for (const customer of ['', '__proto__', 'unknown']) assert.equal(C.getShopAssortment(f, customer, earned.jam, earned.tart), undefined)
  f.shopCommissions.completed.bea = 1; assert.equal(offer(f), undefined); f.shopCommissions.completed.bea = 2
  f.bayShop.memories.bea.purchases[`signature:${earned.tart}`].liked = 0; assert.equal(offer(f), undefined)
  f.bayShop.memories.bea.purchases[`signature:${earned.tart}`].liked = 1
  f.culinary.recipes.find(recipe => recipe.id === earned.tart)!.base = 'preserves'; assert.equal(offer(f), undefined)
})

test('single-recipe offers stay unchanged and accepting a set freezes exact terms without taking food', () => {
  const f = fresh(), before = structuredClone(f)
  const single = C.getShopCommissionOffers(f).find(offer => offer.customer === 'bea' && offer.recipeId === earned.jam)!
  assert.deepEqual([single.quantity, single.bonus, single.total], [4, 12, 88])
  assert.ok(C.acceptShopCommission(f, offer(f).key).ok)
  assert.equal(f.shopCommissions.version, 2); assert.deepEqual(f.culinary, before.culinary); assert.equal(f.coins, before.coins)
  assert.equal(C.getShopCommissionOffers(f).length, 0); assert.equal(offer(f), undefined)
  assert.deepEqual(F.restoreCurrentFarm(JSON.parse(JSON.stringify(f))), f)
})

test('selection previews are read-only, reset an incompatible second recipe, and cannot accept stale choices', () => {
  const f = fresh(), before = structuredClone(f), choice = new ShopAssortmentChoice()
  assert.ok(choice.choose(f, 'bea', 'first', earned.jam)); assert.ok(choice.choose(f, 'bea', 'second', earned.tart))
  assert.equal(choice.second, earned.tart)
  const html = renderShopCommissions(f, () => '', choice)
  assert.match(html, /Стоимость блюд 102 \+ премия 12/); assert.match(html, /Принять набор 2\+2/)
  assert.match(html, /data-action="commission-accept" data-value="set:bea:s1:s2:2:25"/)
  assert.ok(choice.choose(f, 'bea', 'first', earned.tart)); assert.equal(choice.second, '')
  assert.equal(choice.choose(f, 'bea', 'second', earned.tart), false)
  assert.equal(choice.choose(f, 'bea', 'first', 's999'), false); assert.deepEqual(f, before)
  const stale = offer(f).key
  F.sail(f, 'home'); unchanged(f, () => C.acceptShopCommission(f, stale)); F.endDay(f); F.sail(f, 'village')
  unchanged(f, () => C.acceptShopCommission(f, stale))
  for (const key of ['set:bea:s1:s2', stale + ':extra', stale.replace('s1:s2', 's2:s1'), 'set:bea:s1:s1:2:26']) unchanged(f, () => C.acceptShopCommission(f, key))
})

test('named escrow preserves each recipe, prefers its own warehouse and rejects ambiguous or stale actions', () => {
  const f = stocked(), lines = C.getShopCommission(f)!.lines, before = structuredClone(f)
  f.freight.warehouses.village[`signature:${earned.tart}`] = 1
  for (const value of [String(f.shopCommissions.serial), '0:s1', `${f.shopCommissions.serial}:s999`]) unchanged(f, () => C.deliverShopCommission(f, value))
  assert.ok(C.deliverShopCommission(f, lines[1].actionValue).ok)
  assert.equal(f.freight.warehouses.village[`signature:${earned.tart}`], undefined)
  assert.equal(f.culinary.stock[earned.tart], 2); assert.equal(f.culinary.stock[earned.jam], before.culinary.stock[earned.jam])
  assert.ok(C.deliverShopCommission(f, lines[1].actionValue).ok)
  unchanged(f, () => C.deliverShopCommission(f, lines[1].actionValue))
  assert.equal(C.getShopCommission(f)!.lines[0].delivered, 0)
  unchanged(f, () => C.finishShopCommission(f, String(f.shopCommissions.serial)))
  assert.deepEqual(F.restoreCurrentFarm(JSON.parse(JSON.stringify(f))), f)
})

test('either active recipe is protected from deletion and exact repeat links carry the named line', () => {
  const f = accepted()
  for (const line of C.getShopCommission(f)!.lines) {
    unchanged(f, () => F.forgetSignature(f, line.recipeId))
    assert.equal(C.getShopCommissionLine(f, line.actionValue)?.recipeId, line.recipeId)
    assert.match(renderShopCommissions(f, () => ''), new RegExp(`data-action="commission-recipe" data-value="${line.actionValue}"`))
  }
  assert.equal(C.getShopCommissionLine(f, String(f.shopCommissions.serial)), undefined)
})

test('cancel returns both actual escrows exactly once, without a reward or a partial overflow return', () => {
  const f = stocked(), coins = f.coins, initial = structuredClone(f.culinary.stock), serial = String(f.shopCommissions.serial)
  for (const line of C.getShopCommission(f)!.lines) assert.ok(C.deliverShopCommission(f, line.actionValue).ok)
  f.culinary.stock[earned.tart] = 1_000_000
  unchanged(f, () => C.cancelShopCommission(f, serial))
  f.culinary.stock[earned.tart] = 1
  assert.ok(C.cancelShopCommission(f, serial).ok); assert.deepEqual(f.culinary.stock, initial); assert.equal(f.coins, coins)
  assert.equal(f.shopCommissions.version, 1); assert.equal(f.shopCommissions.completed.bea, 2)
  unchanged(f, () => C.cancelShopCommission(f, serial)); assert.deepEqual(F.restoreCurrentFarm(JSON.parse(JSON.stringify(f))), f)
})

test('one full set pays only base values plus twelve, creates an exact two-line receipt and advances one order', () => {
  const f = stocked(), serial = String(f.shopCommissions.serial), coins = f.coins, shop = structuredClone(f.bayShop)
  fill(f); assert.ok(C.finishShopCommission(f, serial).ok)
  assert.equal(f.coins, coins + 114); assert.equal(f.shopCommissions.completed.bea, 3); assert.equal(f.shopCommissions.version, 2)
  assert.deepEqual(f.bayShop, shop); assert.equal(C.getShopCommissionOffers(f).length, 0)
  assert.equal(f.shopCommissions.last && 'lines' in f.shopCommissions.last && f.shopCommissions.last.lines.length, 2)
  assert.match(renderShopCommissions(f, () => ''), /Выплачено: 114 монет/)
  unchanged(f, () => C.finishShopCommission(f, serial)); assert.deepEqual(F.restoreCurrentFarm(JSON.parse(JSON.stringify(f))), f)
})

test('travel and long pauses never change terms, food or progress', () => {
  const f = stocked(), first = C.getShopCommission(f)!.lines[0]
  assert.ok(C.deliverShopCommission(f, first.actionValue).ok); const active = structuredClone(f.shopCommissions.active)
  F.sail(f, 'home')
  for (const action of [() => C.deliverShopCommission(f, first.actionValue), () => C.cancelShopCommission(f, String(f.shopCommissions.serial)), () => C.finishShopCommission(f, String(f.shopCommissions.serial))]) unchanged(f, action)
  for (let d = 0; d < 20; d++) { F.endDay(f); assert.deepEqual(f.shopCommissions.active, active); assert.deepEqual(F.restoreCurrentFarm(JSON.parse(JSON.stringify(f))), f) }
})

test('new mixed data cannot be read as a legacy single or discard a malformed second line', () => {
  for (const state of [stocked(), (() => { const f = stocked(); fill(f); C.finishShopCommission(f, String(f.shopCommissions.serial)); return f })()]) {
    for (const change of [
      (f: any) => { f.shopCommissions.version = 1 },
      (f: any) => { (f.shopCommissions.active ?? f.shopCommissions.last).lines.pop() },
      (f: any) => { (f.shopCommissions.active ?? f.shopCommissions.last).lines[1].quantity = 3 },
      (f: any) => { (f.shopCommissions.active ?? f.shopCommissions.last).bonus = 13 },
    ]) { const f = structuredClone(state); change(f); assert.equal(F.restoreCurrentFarm(f), undefined) }
  }
  for (const change of [
    (f: any) => { f.shopCommissions.active.lines[1].recipeId = earned.jam },
    (f: any) => { f.shopCommissions.active.lines.reverse() },
    (f: any) => { f.shopCommissions.active.lines[1].delivered = 3 },
    (f: any) => { f.shopCommissions.active.lines[1].unitPrice++ },
    (f: any) => { f.shopCommissions.completed.bea = 1 },
  ]) { const f = stocked(); change(f); assert.equal(F.restoreCurrentFarm(f), undefined) }
})

test('overflow failure and repeated click never consume a second named portion or duplicate payment', () => {
  const f = stocked(), view = C.getShopCommission(f)!, first = view.lines[0], clicks = new ActionClickGuard()
  const event = { detail: 1, timeStamp: 100, clientX: 100, clientY: 200 }
  assert.ok(isGuardedAction('commission-deliver')); clicks.remember(event)
  assert.ok(C.deliverShopCommission(f, first.actionValue).ok)
  assert.equal(clicks.blocks({ ...event, detail: 2, timeStamp: 160 }), true)
  assert.equal(C.getShopCommission(f)!.delivered, 1)
  f.workToday = Number.MAX_SAFE_INTEGER; unchanged(f, () => C.deliverShopCommission(f, first.actionValue)); f.workToday = 2
  fill(f); f.coins = Number.MAX_SAFE_INTEGER; unchanged(f, () => C.finishShopCommission(f, String(view.serial)))
})
