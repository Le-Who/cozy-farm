import test from 'node:test'
import assert from 'node:assert/strict'
import { bayShopPurchaseReaction } from '../src/bay-shop-speech.ts'
import { advanceBayShop } from '../src/bay-shop-model.ts'
import { restoreFarm } from '../src/farm.ts'
import { shopSpeechFixture } from './fixtures/shop-speech.ts'

for (const [returning, liked, expected] of [
  [false, false, 'Возьму попробовать.'],
  [true, false, 'Возьму ещё раз.'],
  [false, true, 'Как раз по моему вкусу!'],
  [true, true, 'Снова за любимым! Как раз по моему вкусу!'],
] as const) test(`purchase reaction distinguishes returning=${returning}, liked=${liked}`, () => {
  const purchase = Object.freeze({ returning, liked })
  assert.equal(bayShopPurchaseReaction(purchase), expected)
})

for (const liked of [false, true]) test(`Bea's actual repeat retains taste, stock, coins and save data: liked=${liked}`, () => {
  const farm = shopSpeechFixture(liked), beforeCoins = farm.coins
  for (let ticks = 0; ticks < 120 && farm.bayShop.visitor?.outcome?.kind !== 'bought'; ticks++) {
    for (const sale of advanceBayShop(farm.bayShop, 100, 1)) farm.coins += sale.price
  }
  const purchase = farm.bayShop.visitor?.outcome
  assert.equal(farm.bayShop.visitor?.id, 'bea')
  assert.equal(purchase?.kind, 'bought')
  if (purchase?.kind !== 'bought') throw Error('No actual repeat')
  assert.equal(purchase.returning, true)
  assert.equal(purchase.liked, liked)
  assert.equal(bayShopPurchaseReaction(purchase).includes('любимым'), liked)
  assert.equal(farm.coins - beforeCoins, liked ? 6 : 4)
  assert.equal(farm.bayShop.slots[0]?.quantity, 5)
  assert.equal(farm.bayShop.sold, 7)
  assert.deepEqual(farm.bayShop.memories.bea.purchases[liked ? 'pear' : 'apple'], { bought: 2, liked: liked ? 2 : 0 })
  const before = JSON.stringify(farm)
  bayShopPurchaseReaction(purchase)
  assert.equal(JSON.stringify(farm), before)
  const restored = restoreFarm(JSON.parse(before))!
  assert.ok(restored)
  assert.deepEqual(restored.bayShop, farm.bayShop)
  assert.equal(restored.coins, farm.coins)
})
