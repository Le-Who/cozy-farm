import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { runInNewContext } from 'node:vm'
import { commissionPlayer } from './fixtures/commission-player.ts'
import * as expeditions from '../src/ferry-expeditions.ts'
import { createServer } from './fixtures/ssr-vite.ts'
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

test('cold loading an earned lighthouse receipt keeps its exact affordable repeat without sending it', async () => {
  const actions = JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json', import.meta.url),'utf8')) as {name:string;args:unknown[]}[]
  const p = commissionPlayer(actions.slice(0, actions.findIndex(action => action.name === 'buyBoat') + 1))
  p.act('sellMarketItem','produce:tomato',3)
  for (const id of ['mill-buy','explore-salt']) { p.act('sendFerryExpedition',id); p.night(); p.act('receiveFerryExpedition') }
  p.act('sendFerryExpedition','salt-buy'); p.night()
  const main = readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
  const startup = main.slice(main.indexOf('const ferryArrival ='),main.indexOf('let freightPlanOpen'))
  const preview = () => runInNewContext(stripTypeScriptTypes(startup + '\n;({expeditionPort:selectedExpeditionPort,expeditionOffer:selectedExpeditionOffer})'), {
    ...expeditions, farm:p.state, FerryArrivalPresentation:class {}, ShopAssortmentChoice:class {}, ShopCommissionView:class {},
  })
  const server = await createServer({root:fileURLToPath(new URL('..',import.meta.url)),configFile:false,server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'})
  try {
    const {renderFreightPanel} = await server.ssrLoadModule('/src/bay-freight-ui.ts')
    const render = () => renderFreightPanel(p.state.freight,{...preview(),day:p.state.day,coins:p.state.coins,boatOwned:true,
      playerPort:'home',openedPorts:['home','grove'],products:[],carried:expeditionWallet(p.state).bag,icon:()=>''}) as string
    assert.match(render(),/data-action="expedition-claim"/); assert.doesNotMatch(render(),/data-action="expedition-send"/)
    p.act('receiveFerryExpedition'); p.reload()
    assert.equal(p.state.day,5); assert.equal(p.state.seaSalt,2); assert.equal(p.state.coins,12)
    const before=structuredClone(p.state), html=render()
    assert.match(html,/<h3>Соль для своей кухни<\/h3>/)
    assert.match(html,/data-action="expedition-send" data-value="salt-buy"[^>]*>/)
    assert.doesNotMatch(html,/data-action="expedition-(claim|send)"[^>]*disabled/)
    assert.match(html,/Прошлый груз получен · Соляной маяк · день 5/)
    assert.deepEqual(p.state,before)
    p.act('sendFerryExpedition','salt-buy')
    assert.equal(p.state.coins,2); assert.equal(p.state.freight.expeditions.active?.serial,4)
  } finally { await server.close() }
})

test('legacy and retired lighthouse cards use a valid preview without unlocking a route', () => {
  const world=createFarm().freight.expeditions
  assert.deepEqual(expeditions.initialExpeditionPreview(world),{port:'mill',offer:'mill-grain'})
  world.last={name:'Соляной маяк',port:'salt',day:1,explored:false}
  assert.deepEqual(expeditions.initialExpeditionPreview(world),{port:'mill',offer:'mill-grain'})
  world.discovered.push('salt')
  assert.deepEqual(expeditions.initialExpeditionPreview(world),{port:'salt',offer:'salt-carrots'})
  for (const id of ['retired','salt-grill','pair:mill-buy+salt-buy']) {
    world.last.settled={id,outgoing:[],incoming:[],earnCoins:0,payCoins:0}
    assert.deepEqual(expeditions.initialExpeditionPreview(world),{port:'salt',offer:'salt-carrots'})
  }
})
