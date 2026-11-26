import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import test from 'node:test'
import { createContext, runInContext } from 'node:vm'
import { fileURLToPath } from 'node:url'
import { createServer } from './fixtures/ssr-vite.ts'
import { endDay, restoreCurrentFarm, type FarmState } from '../src/farm.ts'
import { combinedExpeditionId, expeditionOfferIds, expeditionTrades } from '../src/ferry-expeditions.ts'
import { expeditionWallet, receiveFerryExpedition, sendFerryExpedition } from '../src/harbour-economy.ts'
import { earlyFerryFarm, tendEarlyFerryFarm } from './fixtures/early-ferry.ts'

test('an earned peach shipment offers two ways to pay, then sends and settles only the explicit choice',async()=>{
  const cash='orchard-peaches',barter='orchard-buns',pair=combinedExpeditionId(cash,barter)!
  function roundTrip(f:FarmState,id:string) {
    assert.ok(sendFerryExpedition(f,id).ok,id);assert.ok(endDay(f).ok);assert.ok(receiveFerryExpedition(f).ok)
    tendEarlyFerryFarm(f)
  }
  const farm=earlyFerryFarm();assert.ok(endDay(farm).ok);tendEarlyFerryFarm(farm)
  for(const id of ['mill-grain','explore-salt','salt-carrots','explore-orchard'])roundTrip(farm,id)
  assert.equal(farm.day,6);assert.equal(farm.handmade.round,1);assert.equal(farm.fruit.peach,0)
  const before=structuredClone(farm),main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
  const handlers=main.slice(main.indexOf("    case 'expedition-offer':"),main.indexOf("    case 'expedition-send':"))
  const choose=stripTypeScriptTypes('switch(action){'+handlers+'}')
  const server=await createServer({root:fileURLToPath(new URL('..',import.meta.url)),configFile:false,
    server:{middlewareMode:true,hmr:false,ws:false},optimizeDeps:{noDiscovery:true,include:[]},appType:'custom'})
  try {
    const {renderFreightPanel}=await server.ssrLoadModule('/src/bay-freight-ui.ts')
    const render=(f:FarmState,offer:string)=>{
      const clone=structuredClone(f)
      const result:string=renderFreightPanel(f.freight,{day:f.day,coins:f.coins,boatOwned:f.boatOwned,expeditionPort:'orchard',
        expeditionOffer:offer,playerPort:'home',openedPorts:['home','grove'],products:[{id:'peach',name:'Персик',icon:'peach'}],
        carried:expeditionWallet(f).bag,icon:()=>''})
      assert.deepEqual(f,clone);return result
    }
    const view={farm,action:'expedition-offer',value:'',panel:'bay-freight',selectedExpeditionPort:'orchard',
      selectedExpeditionOffer:barter,expeditionTrades,combinedExpeditionId,expeditionOfferIds,drawPanel(){}}
    const context=createContext(view)
    for(const [picked,other]of [[cash,barter],[barter,cash]]){
      view.value=picked;runInContext(choose,context);assert.equal(view.selectedExpeditionOffer,picked)
      const html=render(farm,picked)
      const switcher=html.match(/<div class="expedition-peach-payments"[^>]*>([\s\S]*?)<\/div>/)?.[1]
      assert.ok(switcher,'the two ready payment options are shown without opening all offers')
      assert.match(switcher,/−16 монет/);assert.match(switcher,/−1 булочка[\s\S]*?\+8 монет/)
      for(const [id,selected]of [[picked,true],[other,false]])
        assert.match(switcher,new RegExp('data-action="expedition-offer" data-value="'+id+'"[^>]*aria-pressed="'+selected+'"'))
      for(const id of [cash,barter])
        assert.equal((html.match(new RegExp('data-action="expedition-offer" data-value="'+id+'"','g'))??[]).length,1)
      assert.match(html,new RegExp('data-action="expedition-pair" data-value="'+other+'"'))
      assert.match(html,new RegExp('data-action="expedition-send" data-value="'+picked+'"[^>]*class="bay-freight-primary"[^>]*>'))
      assert.deepEqual(farm,before,'selection changes neither the farm nor its outgoing shipment')

      const cargo=structuredClone(farm),coins=cargo.coins
      assert.ok(sendFerryExpedition(cargo,picked).ok);assert.equal(cargo.fruit.peach,0)
      assert.equal(cargo.coins,coins-(picked===cash?16:0));assert.equal(cargo.handmade.round,picked===cash?1:0)
      assert.doesNotMatch(render(cargo,picked),/class="expedition-peach-payments"/)
      assert.ok(endDay(cargo).ok);assert.equal(cargo.fruit.peach,0);assert.equal(cargo.freight.expeditions.active?.phase,'ready')
      assert.equal(cargo.coins,coins-(picked===cash?16:0));assert.doesNotMatch(render(cargo,picked),/class="expedition-peach-payments"/)
      assert.ok(receiveFerryExpedition(cargo).ok);assert.equal(cargo.fruit.peach,2)
      assert.equal(cargo.coins,coins+(picked===cash?-16:8))
      const settled=structuredClone(cargo);assert.equal(receiveFerryExpedition(cargo).ok,false);assert.deepEqual(cargo,settled)
      assert.deepEqual(restoreCurrentFarm(settled),cargo)
    }
    // Pairing still means four peaches, not either of the two forms of payment.
    view.action='expedition-pair';view.value=cash;runInContext(choose,context)
    assert.equal(view.selectedExpeditionOffer,combinedExpeditionId(barter,cash))
    const combined=render(farm,view.selectedExpeditionOffer)
    assert.doesNotMatch(combined,/class="expedition-peach-payments"/)
    assert.match(combined,/Персик ×4/)
    assert.match(combined,new RegExp('data-action="expedition-send" data-value="'+view.selectedExpeditionOffer.replace('+','\\+')+'"'))
    assert.deepEqual(farm,before)
    assert.doesNotMatch(render(farm,pair),/class="expedition-peach-payments"/)
    assert.doesNotMatch(render(farm,'orchard-pears'),/class="expedition-peach-payments"/)
    for(const block of [(f:FarmState)=>{f.handmade.round=0},(f:FarmState)=>{f.coins=15},
      (f:FarmState)=>{f.freight.expeditions.markets.orchard.stock.peach=1},
      (f:FarmState)=>{f.freight.expeditions.markets.orchard.stock['handmade:round']=2}]){
      const limited=structuredClone(farm);block(limited)
      const html=render(limited,cash);assert.doesNotMatch(html,/class="expedition-peach-payments"/)
      assert.match(html,/data-action="expedition-offer" data-value="orchard-buns"/)
    }
  }finally{await server.close()}
})
