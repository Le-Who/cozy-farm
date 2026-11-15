import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { createFarm, endDay, restoreFarm } from '../src/farm.ts'
import { expeditionOfferAfterClaim, quoteExpedition, type ExpeditionManifest } from '../src/ferry-expeditions.ts'
import { expeditionWallet, receiveFerryExpedition, sendFerryExpedition } from '../src/harbour-economy.ts'
import { delayedLastFerryReceiptFarm } from './fixtures/last-ferry-receipt.ts'

const manifest = (id:string,port:ExpeditionManifest['port']='mill',kind:ExpeditionManifest['kind']='trade') => ({id,port,kind})

test('a claimed purchase keeps its fresh available trade, without sending or charging again', () => {
  const farm=delayedLastFerryReceiptFarm(); receiveFerryExpedition(farm)
  assert.ok(sendFerryExpedition(farm,'mill-buy').ok); assert.ok(endDay(farm).ok)
  const voyage=farm.freight.expeditions.active!
  const selected=expeditionOfferAfterClaim(farm.freight.expeditions,voyage)
  assert.equal(selected,'mill-buy')
  assert.ok(receiveFerryExpedition(farm).ok)
  assert.equal(farm.day,11); assert.equal(farm.coins,74); assert.equal(farm.produce.wheat,0)
  const before=structuredClone(farm)
  assert.equal(expeditionOfferAfterClaim(farm.freight.expeditions,voyage),selected)
  assert.equal(quoteExpedition(farm.freight.expeditions,selected,expeditionWallet(farm))?.available,true)
  assert.equal(quoteExpedition(farm.freight.expeditions,'mill-grain',expeditionWallet(farm))?.available,false)
  assert.deepEqual(farm,before)
  assert.equal(farm.freight.expeditions.active,null)
  assert.deepEqual(restoreFarm(JSON.parse(JSON.stringify(farm)))?.freight.expeditions,farm.freight.expeditions)
  assert.ok(sendFerryExpedition(farm,selected).ok)
  assert.equal(farm.coins,59,'only the separate explicit send buys again')
  assert.equal(farm.freight.expeditions.serial,before.freight.expeditions.serial+1)
})

test('a valid pair stays paired; retired, mismatched or locked portfolio cards fall back safely', () => {
  const farm=createFarm(),world=farm.freight.expeditions
  assert.equal(expeditionOfferAfterClaim(world,manifest('pair:mill-grain+mill-buy')),'pair:mill-grain+mill-buy')
  for(const id of ['mill-retired','pair:mill-grain+mill-retired','pair:mill-grain+mill-grain','salt-buy'])
    assert.equal(expeditionOfferAfterClaim(world,manifest(id)),'mill-grain',id)
  assert.equal(expeditionOfferAfterClaim(world,manifest('salt-grill','salt')),'salt-carrots')
  assert.equal(expeditionOfferAfterClaim(world,manifest('pair:salt-buy+salt-grill','salt')),'salt-carrots')
  world.discovered.push('salt')
  world.markets.salt.supplied={carrot:6,seaBass:4}
  assert.equal(expeditionOfferAfterClaim(world,manifest('pair:salt-buy+salt-grill','salt')),'pair:salt-buy+salt-grill')
  assert.equal(expeditionOfferAfterClaim(world,manifest('explore-salt','salt','explore')),'salt-carrots')
  assert.equal(expeditionOfferAfterClaim(world,manifest('explore-orchard','orchard','explore')),'orchard-apples')
  world.markets.mill.stock['handmade:round']=0
  assert.equal(expeditionOfferAfterClaim(world,manifest('mill-buy')),'mill-buy','an out-of-stock current card keeps its recovery context')
})

test('the next preview uses current terms while its separately labelled receipt keeps the frozen exchange', async () => {
  const server=await createServer({root:fileURLToPath(new URL('..',import.meta.url)),configFile:false,server:{middlewareMode:true,hmr:false},appType:'custom'})
  try {
    const {renderFreightPanel}=await server.ssrLoadModule('/src/bay-freight-ui.ts')
    const farm=delayedLastFerryReceiptFarm(),world=farm.freight.expeditions
    const selected=expeditionOfferAfterClaim(world,world.active!)
    assert.equal(selected,'mill-sale'); receiveFerryExpedition(farm)
    const before=structuredClone(farm)
    const quote=quoteExpedition(world,selected,expeditionWallet(farm))!
    assert.equal(quote.earnCoins,8)
    assert.equal(world.last?.settled?.earnCoins,10)
    const html=renderFreightPanel(farm.freight,{day:farm.day,coins:farm.coins,boatOwned:true,expeditionPort:'mill',expeditionOffer:selected,
      playerPort:'home',openedPorts:['home','grove'],products:[],carried:expeditionWallet(farm).bag,icon:()=>''})
    assert.match(html,/<h3>Продать немного зерна<\/h3>/)
    assert.match(html,/<h4>Отправим<\/h4>/)
    assert.match(html,/<h4>Привезёт<\/h4>[\s\S]*?<strong>8 монет<\/strong>/)
    assert.match(html,/<h4 class="expedition-receipt"[^>]*>Прошлый груз получен · Мельничный посад · день 10 · Пшеница ×2 → 10 монет<\/h4>/)
    assert.match(html,/data-action="expedition-send" data-value="mill-sale"[^>]*disabled/)
    assert.deepEqual(farm,before)
  } finally {await server.close()}
})
