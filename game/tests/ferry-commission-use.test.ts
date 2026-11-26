import test from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { createServer } from './fixtures/ssr-vite.ts'
import { getShopCommission, getShopCommissionOffers, finishShopCommission } from '../src/shop-commissions.ts'
import { ferryCommissionUse, openFerryCommissionRecipe } from '../src/ferry-commission-use.ts'
import { expeditionWallet, receiveFerryExpedition } from '../src/harbour-economy.ts'
import { orchardCustomerReturn } from './fixtures/ferry-commission-return.ts'
import type { FarmState } from '../src/farm.ts'

test('an earned orchard return supplies Bea’s real two-portion order; browsing does not cook, deliver or pay',()=>{
  const {p,id,serial}=orchardCustomerReturn()
  assert.equal(p.state.freight.expeditions.active?.phase,'ready')
  assert.equal(p.state.fruit.pear,0)
  assert.equal(ferryCommissionUse(p.state),undefined)
  p.act('receiveFerryExpedition')
  assert.equal(receiveFerryExpedition(p.state).ok,false)
  const settled=structuredClone(p.state.freight.expeditions.last)
  const use=ferryCommissionUse(p.state)!
  assert.equal(use.ready,2);assert.equal(use.customer,'Беа');assert.equal(use.recipeId,id)
  const atDock=structuredClone(p.state),opened:string[]=[]
  assert.equal(openFerryCommissionRecipe(p.state,'other-voyage',value=>opened.push(value)),false)
  assert.equal(openFerryCommissionRecipe(p.state,use.key,value=>opened.push(value)),true)
  assert.deepEqual(opened,[id]);assert.deepEqual(p.state,atDock)
  p.reload();assert.deepEqual(ferryCommissionUse(p.state),use)
  const beforePayment=p.state.coins,total=getShopCommission(p.state)!.total
  p.act('repeatSignature',id);assert.equal(ferryCommissionUse(p.state)?.ready,1)
  p.act('repeatSignature',id);assert.equal(ferryCommissionUse(p.state),undefined)
  assert.equal(openFerryCommissionRecipe(p.state,use.key,value=>opened.push(value)),false)
  assert.equal(getShopCommission(p.state)?.delivered,0);assert.equal(p.state.coins,beforePayment)
  p.visit('village');p.act('deliverShopCommission',serial);p.act('deliverShopCommission',serial)
  assert.equal(p.state.coins,beforePayment);assert.equal(p.state.culinary.stock[id]??0,0)
  p.act('finishShopCommission',serial);assert.equal(p.state.coins,beforePayment+total)
  assert.equal(finishShopCommission(p.state,serial).ok,false)
  assert.deepEqual(p.state.freight.expeditions.last,settled)
  assert.equal(p.state.shopCommissions.completed.bea,1)
  // Another ordinary morning, a fresh request and a new paid sailing, not a one-time hint.
  p.night();p.visit('village')
  const again=getShopCommissionOffers(p.state).find(offer=>offer.customer==='bea'&&offer.recipeId===id)!
  p.act('acceptShopCommission',again.key);p.fruit('apple',2);p.visit('home')
  p.act('sendFerryExpedition','orchard-pears');p.night();p.act('receiveFerryExpedition')
  const next=ferryCommissionUse(p.state)!
  assert.equal(next.recipeId,id);assert.equal(next.ready,2);assert.notEqual(next.key,use.key)
  assert.equal(openFerryCommissionRecipe(p.state,use.key,()=>assert.fail('old customer order')),false)

})

test('only incoming stock that increases the cookable, still-unfilled quantity counts',()=>{
  const {p,id}=orchardCustomerReturn();p.act('receiveFerryExpedition')
  const candidate=(edit:(f:FarmState)=>void)=>{const copy=structuredClone(p.state);edit(copy);return ferryCommissionUse(copy)}
  assert.equal(candidate(f=>{f.fruit.apple=1})?.ready,1)
  assert.equal(candidate(f=>{f.culinary.stock[id]=1})?.ready,1)
  assert.equal(candidate(f=>{f.freight.warehouses.village['signature:'+id]=1})?.ready,1)
  assert.equal(candidate(f=>{f.freight.warehouses.village['signature:'+id]=1;f.culinary.stock[id]=1}),undefined)
  assert.equal(candidate(f=>{f.fruit.apple=0}),undefined)
  assert.equal(candidate(f=>{f.fruit.pear+=2}),undefined)
  assert.equal(candidate(f=>{f.culinary.recipes[0].ingredients.find(i=>i.id==='pear')!.trait='dew'}),undefined)
  assert.equal(candidate(f=>{f.shopCommissions.active=null}),undefined)
  assert.equal(candidate(f=>{f.day++}),undefined)
  assert.equal(candidate(f=>{delete f.freight.expeditions.last!.settled}),undefined)
  assert.equal(candidate(f=>{f.freight.expeditions.last!.explored=true}),undefined)
  assert.equal(candidate(f=>{f.freight.expeditions.last!.settled!.incoming=[]}),undefined)
  const key=ferryCommissionUse(p.state)!.key
  for(const edit of [(f:FarmState)=>{f.freight.expeditions.serial++},(f:FarmState)=>{f.shopCommissions.active!.serial++}]){
    const copy=structuredClone(p.state);edit(copy)
    assert.equal(openFerryCommissionRecipe(copy,key,()=>assert.fail('stale link')),false)
  }
})

test('actual ferry panel keeps the settled manifest and exposes exactly one escaped recipe link',async()=>{
  const server=await createServer({root:fileURLToPath(new URL('..',import.meta.url)),configFile:false,server:{middlewareMode:true,hmr:false},appType:'custom'})
  try{
    const {renderFreightPanel}=await server.ssrLoadModule('/src/bay-freight-ui.ts')
    const {p,id}=orchardCustomerReturn()
    const render=()=>renderFreightPanel(p.state.freight,{day:p.state.day,coins:p.state.coins,boatOwned:true,playerPort:'home',openedPorts:['home','grove','village'],products:[],carried:expeditionWallet(p.state).bag,expeditionPort:'orchard',commissionUse:ferryCommissionUse(p.state),icon:()=>''})
    assert.doesNotMatch(render(),/expedition-order-recipe/)
    p.act('receiveFerryExpedition')
    const use=ferryCommissionUse(p.state)!,html=render()
    assert.match(html,/<h4 class="expedition-receipt" tabindex="-1">Прошлый груз получен · Садовая пристань · день 20/)
    assert.match(html,/Для заказа · Беа/);assert.match(html,/2 порции по рецепту «Конфитюр: яблоко \+ груша»/)
    assert.equal(html.split('data-action="expedition-order-recipe"').length-1,1)
    assert.ok(html.includes('data-value="'+use.key+'"'));assert.match(html,/Открыть этот рецепт/)
    p.act('repeatSignature',id);assert.match(render(),/1 порцию/)
    const original=p.state.culinary.recipes[0].name
    p.state.culinary.recipes[0].name='<img src=x>';assert.match(render(),/«&lt;img src=x&gt;»/)
    p.state.culinary.recipes[0].name=original
    p.act('repeatSignature',id);assert.doesNotMatch(render(),/expedition-order-recipe/)
  }finally{await server.close()}
})
