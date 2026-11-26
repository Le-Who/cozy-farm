import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from './fixtures/ssr-vite.ts'
import type { ViteDevServer } from 'vite'
import { expeditionWallet, sendFerryExpedition, receiveFerryExpedition } from '../src/harbour-economy.ts'
import { earlyFerryFarm, tendEarlyFerryFarm } from './fixtures/early-ferry.ts'
import { createFarm, endDay, restoreFarm, sellMarketItem, type FarmState } from '../src/farm.ts'
import { nextFerryExploration } from '../src/ferry-discovery.ts'
import { expeditionTrades } from '../src/ferry-expeditions.ts'
import type { renderFreightPanel } from '../src/bay-freight-ui.ts'

let server: ViteDevServer, renderPanel: typeof renderFreightPanel
test.before(async () => {
  server = await createServer({ root: fileURLToPath(new URL('..', import.meta.url)), configFile: false,
    server: { middlewareMode: true, hmr: false }, appType: 'custom' })
  renderPanel = (await server.ssrLoadModule('/src/bay-freight-ui.ts')).renderFreightPanel
})
test.after(async () => { await server?.close() })
function render(farm: FarmState, offer = 'mill-grain') {
  return renderPanel(farm.freight, { day: farm.day, coins: farm.coins, boatOwned: farm.boatOwned,
    expeditionPort: 'mill', expeditionOffer: offer, playerPort: farm.island, openedPorts: ['home','grove'],
    products: [{ id: 'wheat', name: 'Пшеница', icon: 'wheat' }], carried: expeditionWallet(farm).bag, icon: () => '' })
}
const footer = (html: string) => html.match(/<footer class="expedition-departure">([\s\S]*?)<\/footer>/)?.[1] ?? ''

test('the first-day three-wheat harvest exposes an explicit smaller sale without replacing or sending the blocked draft', () => {
  const farm = earlyFerryFarm(), before = structuredClone(farm)
  assert.equal(farm.day, 1)
  assert.equal(farm.produce.wheat, 3)
  const html = render(farm), departure = footer(html)
  assert.match(html, /<h3>Зерно для пекаря<\/h3>/)
  assert.match(html, /Есть 3 · нужно ещё 1/)
  assert.match(departure, /data-action="expedition-send" data-value="mill-grain"[^>]*disabled/)
  assert.match(departure, /data-action="expedition-offer" data-value="mill-sale"/)
  assert.match(departure, /Посмотреть: Пшеница ×2 → 10 монет/)
  assert.deepEqual(farm, before, 'a suggestion is read-only and keeps the selected draft')
  assert.equal(sendFerryExpedition(farm, 'mill-grain').ok, false)
  assert.deepEqual(farm, before, 'the original unavailable offer must still reject departure')
  const smaller = render(farm, 'mill-sale')
  assert.match(smaller, /<h3>Продать немного зерна<\/h3>/)
  assert.doesNotMatch(footer(smaller), /disabled|Посмотреть:/)
  assert.deepEqual(farm, before, 'viewing the smaller quote does not spend, depart or earn')
  assert.ok(sendFerryExpedition(farm, 'mill-sale').ok)
  assert.equal(farm.produce.wheat, 1)
  assert.equal(farm.coins, before.coins, 'the ten coins remain on the boat until receipt')
})


test('ordinary farming and explicit ferry actions reach two new markets by day five without a stock or coin grant', () => {
  let farm = earlyFerryFarm()
  const ports = [['mill'], ['mill','salt'], ['mill','salt'], ['mill','salt','orchard']]
  const offers = ['mill-sale','explore-salt','salt-carrots','explore-orchard']
  for (const [index, offer] of offers.entries()) {
    assert.ok(sendFerryExpedition(farm, offer).ok)
    const promised = structuredClone(farm.freight.expeditions.active)!
    farm = restoreFarm(JSON.parse(JSON.stringify(farm)))!
    assert.ok(farm)
    assert.deepEqual(farm.freight.expeditions.active, promised)
    assert.ok(endDay(farm).ok)
    farm = restoreFarm(JSON.parse(JSON.stringify(farm)))!
    assert.ok(farm)
    const coins = farm.coins, salt = farm.seaSalt
    assert.ok(receiveFerryExpedition(farm).ok)
    assert.equal(farm.coins, coins + promised.earnCoins)
    assert.equal(farm.seaSalt, salt + (offer === 'salt-carrots' ? 2 : 0))
    assert.deepEqual(farm.freight.expeditions.discovered, ports[index])
    const received = structuredClone(farm)
    assert.equal(receiveFerryExpedition(farm).ok, false)
    assert.deepEqual(farm, received)
    if (index === 0) assert.equal(nextFerryExploration(farm.freight.expeditions, expeditionWallet(farm))?.port, 'salt')
    if (index === 2) assert.equal(nextFerryExploration(farm.freight.expeditions, expeditionWallet(farm))?.port, 'orchard')
    if (index < offers.length - 1) tendEarlyFerryFarm(farm)
  }
  assert.equal(farm.day, 5)
  assert.equal(farm.coins, 82)
  assert.equal(farm.produce.wheat, 6)
  assert.equal(farm.seaSalt, 2)
  assert.ok(expeditionTrades(farm.freight.expeditions, 'orchard').some(offer => offer.id === 'orchard-pears'))
  assert.ok(restoreFarm(JSON.parse(JSON.stringify(farm))))
})

test('no smaller owned cargo keeps the source action, never suggests spending coins or replacing a viable draft', () => {
  const farm = earlyFerryFarm()
  assert.ok(sellMarketItem(farm, 'produce:wheat').ok)
  assert.ok(sellMarketItem(farm, 'produce:wheat').ok)
  const before = structuredClone(farm), departure = footer(render(farm))
  assert.match(departure, /data-action="expedition-source"/)
  assert.doesNotMatch(departure, /data-action="expedition-offer"|Посмотреть:/)
  assert.deepEqual(farm, before)
  assert.doesNotMatch(footer(render(earlyFerryFarm(), 'mill-sale')), /data-action="expedition-offer"|Посмотреть:/)
  assert.doesNotMatch(footer(render(createFarm())), /data-action="expedition-offer"|Посмотреть:/)
})

test('a sent or unclaimed sale offers no alternative and waits through optional extra farm days', () => {
  let farm = earlyFerryFarm()
  assert.ok(sendFerryExpedition(farm, 'mill-sale').ok)
  assert.doesNotMatch(footer(render(farm)), /data-action="expedition-offer"|Посмотреть:/)
  for (let n = 0; n < 3; n++) {
    assert.ok(endDay(farm).ok)
    tendEarlyFerryFarm(farm)
    farm = restoreFarm(JSON.parse(JSON.stringify(farm)))!
    assert.ok(farm)
    assert.doesNotMatch(footer(render(farm)), /data-action="expedition-offer"|Посмотреть:/)
  }
  assert.equal(farm.day, 4)
  const coins = farm.coins
  assert.ok(receiveFerryExpedition(farm).ok)
  assert.equal(farm.coins, coins + 10, 'waiting does not reprice, lose or automatically collect the sale')
})
