import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import * as Farm from '../src/farm.ts'
import { getShopCommission, getShopCommissionOffers } from '../src/shop-commissions.ts'
import { commissionPlayer } from './fixtures/commission-player.ts'
import { createServer } from './fixtures/ssr-vite.ts'

const opening = JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json', import.meta.url), 'utf8'))
const art = { icon: () => '', stock: () => '' }
const result = { family: 'preserves', processing: 'silky', fruit: [], steps: ['mix', 'pour'] } as const

function earnOrder() {
  const player = commissionPlayer(opening)
  const recipeId = player.cook()
  player.shelf(recipeId)
  player.sale()
  player.fruit('apple', 2)
  player.visit('village')
  const picnicId = player.act('completeSignature', {
    base: 'preserves', ingredients: [{ id: 'apple', quantity: 2 }],
  }, result).recipeId as string
  assert.notEqual(picnicId, recipeId)
  player.fruit('apple', 1)
  player.fruit('pear', 1)
  if (player.state.fruit.pear > 1) {
    player.visit('home')
    player.act('sellMarketItem', 'fruit:pear', player.state.fruit.pear - 1)
  }
  player.visit('village')
  const quote = getShopCommissionOffers(player.state).find(offer => offer.recipeId === recipeId)!
  assert.equal(quote.quantity, 2)
  player.act('acceptShopCommission', quote.key)
  return { player, recipeId, picnicId, serial: String(player.state.shopCommissions.serial) }
}

function choice(html: string, action: string, id: string) {
  const match=html.match(new RegExp(`<button[^>]*data-action="${action}" data-value="${id}"([^>]*)>([^<]*)</button>`))
  assert.ok(match, action)
  return { label: match[2], enabled: !/\bdisabled\b/.test(match[1]) }
}
const cold = (farm: Farm.FarmState) => {
  const restored = Farm.restoreCurrentFarm(JSON.parse(JSON.stringify(farm)))
  assert.ok(restored)
  return restored
}

test('one saved repeat quotes two portions only once the real picnic is active; the earned two-jar order stays unpaid until separate hand-ins and claim', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
  try {
    const { signatureBook } = await server.ssrLoadModule('/src/culinary-ui.ts')
    const { player, recipeId, picnicId, serial } = earnOrder()
    const snapshot = cold(player.state)
    assert.deepEqual([player.actions, snapshot.day, snapshot.coins, snapshot.fruit.apple, snapshot.fruit.pear], [127, 16, 93, 2, 1])
    assert.equal(snapshot.culinary.stock[picnicId], 1)
    const book = (farm: Farm.FarmState) => signatureBook(farm, art, { selectedId: recipeId, mode: 'detail' }) as string
    const single = (farm: Farm.FarmState) => choice(book(farm), 'make-signature', recipeId)
    assert.deepEqual(single(player.state), { label: 'Повторить ×1', enabled: true })
    assert.deepEqual(player.state, snapshot, 'rendering never consumes the spare jar or produces stock')

    const ordinary = cold(snapshot)
    assert.equal(Farm.repeatSignature(ordinary, recipeId).ok, true)
    assert.equal(ordinary.culinary.stock[recipeId], 1)
    assert.equal(ordinary.culinary.stock[picnicId], 1)

    player.act('useSignature', picnicId)
    const active = cold(player.state)
    assert.equal(active.culinary.stock[picnicId], 0)
    assert.deepEqual(single(player.state), { label: 'Повторить ×1 · 2 порции', enabled: true })
    assert.deepEqual(choice(book(player.state), 'batch-signature', recipeId), { label: 'Партия ×3', enabled: false })
    assert.deepEqual(player.state, active)

    player.act('repeatSignature', recipeId)
    assert.deepEqual([player.state.fruit.apple, player.state.fruit.pear], [ordinary.fruit.apple, ordinary.fruit.pear])
    assert.equal(player.state.culinary.stock[recipeId], 2)
    assert.equal(player.state.culinary.picnic, null)
    assert.deepEqual(single(player.state), { label: 'Повторить ×1', enabled: false })
    assert.equal(getShopCommission(player.state)?.remaining, 2)
    for (let n = 0; n < 2; n++) {
      player.act('deliverShopCommission', serial)
      assert.equal(player.state.coins, 93)
    }
    player.act('finishShopCommission', serial)
    assert.deepEqual([player.state.day, player.state.island, player.state.coins], [16, 'village', 137])
  } finally { await server.close() }
})

test('an enabled three-repeat batch keeps three input sets and forecasts four only until the picnic is spent or expires', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
  try {
    const { signatureBook } = await server.ssrLoadModule('/src/culinary-ui.ts')
    const { player, recipeId, picnicId } = earnOrder()
    player.fruit('apple', 3)
    player.fruit('pear', 3)
    player.visit('village')
    const book = (farm: Farm.FarmState) => signatureBook(farm, art, { selectedId: recipeId, mode: 'detail' }) as string
    const batch = (farm: Farm.FarmState) => choice(book(farm), 'batch-signature', recipeId)
    assert.deepEqual(batch(player.state), { label: 'Партия ×3', enabled: true })
    player.act('useSignature', picnicId)
    const prior = cold(player.state)
    assert.deepEqual(batch(player.state), { label: 'Партия ×3 · 4 порции', enabled: true })
    assert.deepEqual(player.state, prior)

    const expired = cold(prior)
    assert.equal(Farm.sail(expired, 'home').ok, true)
    assert.equal(Farm.endDay(expired).ok, true)
    assert.equal(expired.culinary.picnic, null)
    assert.deepEqual(batch(expired), { label: 'Партия ×3', enabled: true })
    assert.equal(Farm.repeatSignature(expired, recipeId, undefined, 3).ok, true)
    assert.equal(expired.culinary.stock[recipeId], 3)

    player.act('repeatSignature', recipeId, undefined, 3)
    assert.equal(player.state.culinary.stock[recipeId], 4)
    assert.deepEqual(player.state.fruit, expired.fruit, 'one bonus never adds ingredients or an extra repeat')
    assert.equal(player.state.culinary.picnic, null)
    assert.equal(player.state.coins, prior.coins)
    assert.equal(getShopCommission(player.state)?.remaining, 2)
  } finally { await server.close() }
})
