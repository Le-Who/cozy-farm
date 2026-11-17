import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer, type ViteDevServer } from 'vite'
import { createFarm, endDay, restoreCurrentFarm, type FarmState } from '../src/farm.ts'
import { quoteExpedition } from '../src/ferry-expeditions.ts'
import { expeditionWallet, receiveFerryExpedition, sendFerryExpedition } from '../src/harbour-economy.ts'
import type { renderFreightPanel } from '../src/bay-freight-ui.ts'

let server: ViteDevServer, renderPanel: typeof renderFreightPanel
test.before(async () => {
  server = await createServer({root:fileURLToPath(new URL('..',import.meta.url)),configFile:false,server:{middlewareMode:true,hmr:false},appType:'custom'})
  renderPanel = (await server.ssrLoadModule('/src/bay-freight-ui.ts')).renderFreightPanel
})
test.after(async () => { await server?.close() })
function render(farm: FarmState, offer = 'mill-buy') {
  return renderPanel(farm.freight, {day:farm.day,coins:farm.coins,boatOwned:farm.boatOwned,
    expeditionPort:'mill',expeditionOffer:offer,playerPort:'home',openedPorts:['home','grove'],products:[],
    carried:expeditionWallet(farm).bag,icon:()=>''})
}
function label(farm: FarmState, offer?: string) {
  return render(farm,offer).match(/<button[^>]*data-action="expedition-claim"[^>]*>([^<]*)<\/button>/)?.[1]
}
function setup() {
  const farm=createFarm();farm.boatOwned=true;farm.coins=100;farm.produce.wheat=20
  return farm
}

for (const [offer, expected, confirmation] of [
  ['mill-sale','Получить выручку','Выручка получена. Можно выбрать следующий рейс.'],
  ['mill-buy','Получить груз','Груз получен. Можно выбрать следующий рейс.'],
  ['mill-grain','Получить груз и выручку','Груз и выручка получены. Можно выбрать следующий рейс.'],
  ['pair:mill-sale+mill-buy','Получить груз','Груз получен. Можно выбрать следующий рейс.'],
  ['explore-salt','Открыть новый порт','Новый порт открыт. Выберите его на карте.'],
] as const) test(`${offer} ready action describes only its frozen rewards and claims exactly once`,()=>{
  let farm=setup()
  if (offer==='explore-salt') farm.freight.expeditions.markets.mill.visits=1
  assert.equal(label(farm),undefined)
  const quote=quoteExpedition(farm.freight.expeditions,offer,expeditionWallet(farm))!
  assert.ok(sendFerryExpedition(farm,offer).ok)
  assert.equal(farm.coins,100-quote.payCoins)
  assert.equal(farm.produce.wheat,20-(quote.outgoing.find(item=>item.id==='wheat')?.quantity??0))
  const sailing=structuredClone(farm)
  assert.equal(label(farm),undefined);assert.equal(receiveFerryExpedition(farm).ok,false);assert.deepEqual(farm,sailing)
  assert.ok(endDay(farm).ok)
  farm=restoreCurrentFarm(structuredClone(farm))!
  assert.ok(farm);const ready=structuredClone(farm),wallet=expeditionWallet(farm),manifest=farm.freight.expeditions.active!
  // Deliberately request a different draft: the ready action belongs to the active manifest.
  assert.equal(label(farm,offer==='mill-buy'?'mill-sale':'mill-buy'),expected)
  assert.deepEqual(farm,ready,'render is read-only')
  const expectedBag={...wallet.bag}
  for (const item of manifest.incoming) expectedBag[item.id]=(expectedBag[item.id]??0)+item.quantity
  const result=receiveFerryExpedition(farm);assert.ok(result.ok);assert.equal(result.message,confirmation)
  assert.equal(farm.coins,wallet.coins+manifest.earnCoins)
  assert.deepEqual(expeditionWallet(farm).bag,expectedBag,'claim credits only the frozen goods; outgoing goods are not debited twice')
  assert.equal(label(farm),undefined)
  const received=structuredClone(farm);assert.equal(receiveFerryExpedition(farm).ok,false);assert.deepEqual(farm,received)
  assert.deepEqual(restoreCurrentFarm(structuredClone(farm)),farm)
})

test('a mixed frozen voyage keeps its label when a fresh quote would have goods but no proceeds',()=>{
  const farm=setup();assert.ok(sendFerryExpedition(farm,'mill-grain').ok)
  const frozen=structuredClone(farm.freight.expeditions.active!)
  farm.freight.expeditions.markets.mill.stock.wheat=12
  assert.ok(endDay(farm).ok)
  const fresh=quoteExpedition(farm.freight.expeditions,'mill-grain',expeditionWallet(farm))!
  assert.equal(fresh.earnCoins,0);assert.ok(fresh.payCoins>0)
  assert.equal(farm.freight.expeditions.active!.earnCoins,frozen.earnCoins)
  const before=structuredClone(farm);assert.equal(label(farm),'Получить груз и выручку');assert.deepEqual(farm,before)
  const result=receiveFerryExpedition(farm);assert.ok(result.ok);assert.equal(result.message,'Груз и выручка получены. Можно выбрать следующий рейс.')
})
