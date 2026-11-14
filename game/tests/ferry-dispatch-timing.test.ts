import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer, type ViteDevServer } from 'vite'
import { createFarm, endDay, type FarmState } from '../src/farm.ts'
import { combinedExpeditionId, quoteExpedition, type ExpeditionPort } from '../src/ferry-expeditions.ts'
import { expeditionWallet, sendFerryExpedition } from '../src/harbour-economy.ts'
import type { renderFreightPanel } from '../src/bay-freight-ui.ts'

let server: ViteDevServer, renderPanel: typeof renderFreightPanel
test.before(async () => {
  server = await createServer({ root: fileURLToPath(new URL('..', import.meta.url)), configFile: false,
    server: { middlewareMode: true, hmr: false }, appType: 'custom' })
  renderPanel = (await server.ssrLoadModule('/src/bay-freight-ui.ts')).renderFreightPanel
})
test.after(async () => { await server?.close() })
function render(farm: FarmState, offer = 'mill-grain', port: ExpeditionPort = 'mill') {
  return renderPanel(farm.freight, { day: farm.day, coins: farm.coins, boatOwned: farm.boatOwned,
    expeditionPort: port, expeditionOffer: offer, playerPort: 'home', openedPorts: ['home','grove'],
    products: [{ id: 'seaSalt', name: 'Морская соль', icon: 'seaSalt' }], carried: expeditionWallet(farm).bag, icon: () => '' })
}
function departure(html: string) {
  const footer = html.match(/<footer class="expedition-departure">([\s\S]*?)<\/footer>/)?.[1]
  assert.ok(footer, 'the rendered departure footer exists')
  return footer
}
function assertBlocked(farm: FarmState, offer: string, port: ExpeditionPort = 'mill') {
  const before = structuredClone(farm), quote = quoteExpedition(farm.freight.expeditions, offer, expeditionWallet(farm))!
  assert.equal(quote.available, false)
  const html = render(farm, offer, port), footer = departure(html)
  assert.doesNotMatch(footer, /Вернётся|вернётся|После отправки|<p>\s*<\/p>/)
  assert.equal(footer.split(quote.reason).length - 1, 1, 'show the actual dispatch blocker exactly once')
  assert.match(footer, /data-action="expedition-send"[^>]*disabled/)
  assert.deepEqual(farm, before, 'preview does not spend, send or advance the day')
  return html
}

test('a blocked salt draft keeps its real whole-basket forecast, not a next-morning return promise', () => {
  const farm = createFarm(); farm.boatOwned = true; farm.coins = 100; farm.produce.carrot = 3
  const world = farm.freight.expeditions; world.discovered.push('salt')
  world.markets.salt.supplied = { carrot: 6, seaBass: 4 }
  Object.assign(world.markets.salt.stock, { seaSalt: 0, seaBass: 2, carrot: 3, 'dish:grilledFish': 0 })
  const single = assertBlocked(farm, 'salt-buy', 'salt')
  assert.match(single, /<h4>Партия к утру дня 3<\/h4>/)
  assert.match(single, /Без новой поставки: Морская соль: 2 из нужных 2/)
  assert.match(single, /data-action="expedition-restock" data-value="salt-buy"/)
  assert.match(single, /Переход не начинает ночь/)
  const pair = combinedExpeditionId('salt-buy','salt-carrots')!
  const combined = assertBlocked(farm, pair, 'salt')
  assert.match(combined, /<h4>Партия к утру дня 5<\/h4>/)
  assert.match(combined, /Морская соль: 5 из нужных 4/)
})

test('boat, personal cargo, coins and exploration gates do not advertise a departure date', () => {
  const noBoat = createFarm(); noBoat.boatOwned = false; noBoat.produce.wheat = 8
  assertBlocked(noBoat, 'mill-grain')
  const noCargo = createFarm(); noCargo.boatOwned = true; noCargo.produce.wheat = 0
  assert.match(assertBlocked(noCargo, 'mill-grain'), /data-action="expedition-source"/)
  const noCoins = createFarm(); noCoins.boatOwned = true; noCoins.coins = 0
  assertBlocked(noCoins, 'mill-buy')
  const lockedExplore = createFarm(); lockedExplore.boatOwned = true; lockedExplore.produce.wheat = 10
  assertBlocked(lockedExplore, 'explore-salt', 'salt')
})

test('ready-to-send trade and exploration explicitly time the return from sending', () => {
  const farm = createFarm(); farm.boatOwned = true; farm.produce.wheat = 10; farm.freight.expeditions.markets.mill.visits = 1
  for (const [offer, port] of [['mill-grain','mill'], ['explore-salt','salt']] as const) {
    assert.equal(quoteExpedition(farm.freight.expeditions, offer, expeditionWallet(farm))?.available, true)
    const before = structuredClone(farm), footer = departure(render(farm, offer, port))
    assert.match(footer, /После отправки вернётся следующим игровым утром/)
    assert.doesNotMatch(footer, /expedition-reason|disabled/)
    assert.deepEqual(farm, before)
  }
})

test('underway and ready retain their actual return and collection states', () => {
  const farm = createFarm(); farm.boatOwned = true; farm.produce.wheat = 8
  assert.ok(sendFerryExpedition(farm, 'mill-grain').ok)
  const sent = structuredClone(farm), sailing = departure(render(farm))
  assert.match(sailing, /Вернётся утром дня 2/)
  assert.match(sailing, /data-action="expedition-rest"/)
  assert.doesNotMatch(sailing, /После отправки|data-action="expedition-send"/)
  assert.deepEqual(farm, sent)
  assert.ok(endDay(farm).ok)
  const arrived = structuredClone(farm), ready = departure(render(farm))
  assert.match(ready, /Паром вернулся. Груз вас дождётся./)
  assert.match(ready, /data-action="expedition-claim"/)
  assert.doesNotMatch(ready, /После отправки|Вернётся|data-action="expedition-send"/)
  assert.deepEqual(farm, arrived)
})
