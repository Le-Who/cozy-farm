import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from './fixtures/ssr-vite.ts'
import type { ViteDevServer } from 'vite'
import { createFarm, endDay, restoreFarm, type FarmState } from '../src/farm.ts'
import { expeditionWallet, receiveFerryExpedition, sendFerryExpedition } from '../src/harbour-economy.ts'
import type { ExpeditionPort } from '../src/ferry-expeditions.ts'
import type { renderFreightPanel } from '../src/bay-freight-ui.ts'
import { delayedLastFerryReceiptFarm } from './fixtures/last-ferry-receipt.ts'

let server: ViteDevServer, renderPanel: typeof renderFreightPanel
test.before(async () => {
  server = await createServer({root:fileURLToPath(new URL('..',import.meta.url)),configFile:false,server:{middlewareMode:true,hmr:false},appType:'custom'})
  renderPanel = (await server.ssrLoadModule('/src/bay-freight-ui.ts')).renderFreightPanel
})
test.after(async () => { await server?.close() })
function receipt(farm: FarmState, port: ExpeditionPort = 'mill', name = 'Круглая булочка') {
  const html = renderPanel(farm.freight, {day:farm.day,coins:farm.coins,boatOwned:farm.boatOwned,
    expeditionPort:port,playerPort:'home',openedPorts:['home','grove'],products:[{id:'handmade:round',name,icon:''},{id:'eggs',name:'Яйцо',icon:''}],
    carried:expeditionWallet(farm).bag,icon:()=>''})
  return html.match(/<h4 class="expedition-receipt" tabindex="-1">([\s\S]*?)<\/h4>/)?.[1] ?? ''
}

test('the compact receipt names its actual port and frozen ten coins in every selected port before and after reload', () => {
  let farm = delayedLastFerryReceiptFarm()
  receiveFerryExpedition(farm)
  for (let reload = 0; reload < 2; reload++) {
    const before = structuredClone(farm)
    for (const port of ['mill','salt','orchard'] as const) {
      assert.match(receipt(farm, port), /Прошлый груз получен · Мельничный посад · день 10 · Пшеница ×2 → 10 монет/)
      assert.doesNotMatch(receipt(farm, port), /8 монет|Соляной маяк|Садовая пристань|data-action/)
    }
    assert.deepEqual(farm, before)
    farm = restoreFarm(JSON.parse(JSON.stringify(farm)))!
  }
})

test('goods, paid purchases, combined harvest premiums and exploration render only their settled outcome', () => {
  for (const [offer, expected, bonus] of [
    ['mill-buy', /день 2 · 15 монет → Круглая булочка ×1$/, 0],
    ['mill-baking', /Пшеница ×4 \+ 10 монет → Круглая булочка ×2$/, 0],
    ['pair:mill-sale+mill-buy', /Пшеница ×2 \+ 5 монет → Круглая булочка ×1$/, 0],
    ['pair:mill-grain+mill-eggs', /Яйцо ×4 \+ Пшеница ×4 → Круглая булочка ×2 \+ 13 монет$/, 3],
    ['explore-salt', /^Новый порт на карте · Соляной маяк · день 2 · отдали: Пшеница ×2$/, 0],
  ] as const) {
    let farm = createFarm()
    farm.boatOwned = true; farm.coins = 100; farm.produce.wheat = 10; farm.eggs = 8
    farm.freight.expeditions.markets.mill.visits = 1
    farm.festivals.completed.harvest = bonus
    assert.equal(sendFerryExpedition(farm, offer).ok, true)
    farm.festivals.completed.harvest = 0 // The old paid premium is independent of today's tier.
    endDay(farm)
    assert.equal(receiveFerryExpedition(farm).ok, true)
    const settled = structuredClone(farm.freight.expeditions.last)
    farm = restoreFarm(JSON.parse(JSON.stringify(farm)))!
    assert.deepEqual(farm.freight.expeditions.last, settled)
    assert.match(receipt(farm, 'orchard'), expected)
    assert.doesNotMatch(receipt(farm, 'orchard'), /Садовая пристань|data-action|оплат/)
  }
})

test('legacy history does not reconstruct today’s goods, price or new claim, and product labels are escaped', () => {
  const farm = delayedLastFerryReceiptFarm()
  receiveFerryExpedition(farm)
  delete farm.freight.expeditions.last!.settled
  assert.equal(receipt(farm, 'salt'), 'Прошлый груз получен · Мельничный посад · день 10')
  assert.equal(sendFerryExpedition(farm, 'mill-buy').ok, true)
  endDay(farm); receiveFerryExpedition(farm)
  assert.match(receipt(farm, 'salt', '<img src=x>'), /&lt;img src=x&gt; ×1/)
  assert.doesNotMatch(receipt(farm, 'salt', '<img src=x>'), /<img/)
})
