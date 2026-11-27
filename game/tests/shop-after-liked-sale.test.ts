import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { runInNewContext } from 'node:vm'
import * as F from '../src/farm.ts'
import * as M from '../src/bay-shop-model.ts'
import * as C from '../src/shop-commissions.ts'
import { reserveShopGoods, returnShopGoods } from '../src/harbour-economy.ts'
import { describeFood } from '../src/intent-orders.ts'
import { bayShopDayGuidance } from '../src/bay-shop-day.ts'
import { BayShopCustomerView, renderBayShopCustomers } from '../src/bay-shop-customers.ts'
import { bayShopPurchaseReaction } from '../src/bay-shop-speech.ts'
import { shopReturnLabel, shopRemainderQuote } from '../src/bay-shop-price-copy.ts'
import { renderShopCommissions } from '../src/shop-commissions-ui.ts'
import { ShopCommissionView } from '../src/shop-commission-view.ts'
import type { BayShopCommissionPreview, BayShopOptions } from '../src/bay-shop.ts'
import { commissionPlayer } from './fixtures/commission-player.ts'
import { assortmentPlayer } from './fixtures/assortment-player.ts'
import * as UI from '../src/shop-commissions-ui.ts'

const read=(name:string)=>readFileSync(new URL(name,import.meta.url),'utf8')
const opening=JSON.parse(read('./fixtures/home-progress-actions.json')).slice(0,78)
const sceneSource=read('../src/bay-shop.ts'), mainSource=read('../src/main.ts')
const scene=stripTypeScriptTypes(sceneSource.slice(sceneSource.indexOf('const escape =')).replace('export function mountBayShop','function mountBayShop'))
const goToOrders=stripTypeScriptTypes(mainSource.slice(mainSource.indexOf('function openShopScene('),mainSource.indexOf('function openMusicScene(')))
const reopen=(farm:F.FarmState)=>F.restoreCurrentFarm(JSON.parse(JSON.stringify(farm)))!
type Choice = ReturnType<ShopCommissionView['current']>['offer']

function stockedCase(){
  const p=commissionPlayer(opening), first=p.cook()
  p.fruit('apple',2); p.visit('village')
  const second=p.act('completeSignature',{base:'preserves',ingredients:[{id:'apple',quantity:2}]},{family:'preserves',processing:'chunky',fruit:[],steps:['mix','pour']}).recipeId as string
  assert.notEqual(second,first)
  for(let n=0;n<2;n++){
    p.fruit('apple',2);p.visit('village')
    assert.equal(p.act('repeatSignature',second).recipeId,second)
  }
  assert.deepEqual([p.actions,p.state.day,p.state.culinary.stock[second]],[100,12,3])
  assert.equal(p.state.bayShop.visitsToday,0)
  return {farm:reopen(p.state),first,second}
}
function shelf(farm:F.FarmState,id:string,amount=1,index=0){
  const key=id.startsWith('dish:')?id:'signature:'+id
  const food=F.foodDescriptors(farm).find(r=>r.id===key)!
  assert.ok(food.count>=amount&&reserveShopGoods(farm,key,amount))
  assert.ok(M.stockBayShop(farm.bayShop,index,{id:key,identity:key,name:food.name,image:'/art/lavender/ui-signature-silky.webp',
    basePrice:food.sellPrice,tags:[...food.ingredients,...describeFood(food),...(food.processing?[food.processing]:[])],...(food.source==='signature'?{signature:true}:{})},amount))
}
function mount(farm:F.FarmState,selection=new ShopCommissionView()){
  let options:BayShopOptions, frame:(time:number)=>void, now=0, writes=0, selected:Choice, panel=''
  const calls:{customer?:string,preview?:BayShopCommissionPreview}[]=[], focuses:string[]=[], listeners=new Map<string,(event:unknown)=>void>()
  const node={textContent:'',hidden:false}
  const host={innerHTML:'',querySelector:()=>node,contains:()=>true,
    addEventListener:(name:string,cb:(event:unknown)=>void)=>listeners.set(name,cb),removeEventListener:(name:string)=>listeners.delete(name)}
  // Use absent nodes for paintVisitor/positioning, just as the other mounted source tests.
  const mountHost={...host,querySelector:(k:string)=>['.bay-shop-day-detail','.bay-shop-day-count','.bay-shop-notice','[data-shop-next]'].includes(k)?node:null}
  const mainContext={farm,getShopCommissionOffers:C.getShopCommissionOffers,harbourGoods:()=>[],panelHistory:[],
    shopCommissionView:selection,nextShopStock:undefined,harbourScene:undefined,reserveShopGoods,returnShopGoods,status(){},
    textAt(){},icon(){return ''},numberFormat:new Intl.NumberFormat('ru'),bayAudio:{playEvent(){}},saveHarbour(){writes++},leaveScene(){},applyIngredientFinishes(){},
    openPanel(value:string){panel=value;selected=selection.current(farm).offer},
    dialogContent:{querySelector(selector:string){return {focus({preventScroll}:{preventScroll:boolean}){assert.ok(preventScroll);focuses.push(selector)}}}},
    mountBayShop(_host:unknown,captured:BayShopOptions){options=captured},nullHost:{},
  }
  // Capture the actual production options, then run the actual scene with them.
  runInNewContext(goToOrders+';openShopScene(nullHost)',mainContext)
  const openExact=options!.onOpenCommissions!
  const live={...options!,onOpenCommissions(customer?:M.BayShopVisitorId,preview?:BayShopCommissionPreview){
    calls.push({customer,preview}); openExact(customer,preview)
  }}
  const env={...M,bayShopDayGuidance,BayShopCustomerView,renderBayShopCustomers,bayShopPurchaseReaction,shopReturnLabel,shopRemainderQuote,
    host:mountHost,opts:live,document:{hidden:false,activeElement:null},HTMLElement:class{},HTMLInputElement:class{},matchMedia:()=>({matches:true}),
    requestAnimationFrame(fn:(t:number)=>void){frame=fn;return 1},cancelAnimationFrame(){},performance:{now:()=>0},window:{setTimeout:()=>0},
    clearTimeout(){},ResizeObserver:class{observe(){}disconnect(){}},applyIngredientFinishes(){},playBaySound(){}}
  const ui=runInNewContext(scene+';mountBayShop(host,opts)',env) as {refresh():void;destroy():void}
  function until(check:()=>boolean){
    for(let i=0;i<1600&&!check();i++){now+=100;frame!(now)}
    assert.ok(check())
  }
  function click(keys:string[],dataset:Record<string,string>={}){
    const button={disabled:false,hasAttribute:(k:string)=>keys.includes(k),getAttribute:(k:string)=>k==='data-customer'?dataset.customer:null,dataset,closest:()=>button}
    listeners.get('click')?.({target:button})
  }
  function label(){
    const list=[...mountHost.innerHTML.matchAll(/<button[^>]*data-commissions[^>]*>([^<]+)<\/button>/g)]
    assert.equal(list.length,1,'one original navigation control')
    return list[0][1]
  }
  return {ui,until,click,label,calls,focuses,get selected(){return selected},get panel(){return panel},get writes(){return writes}, openExact}
}
function soldFinn(farm:F.FarmState,first:string,second:string,selection=new ShopCommissionView()){
  shelf(farm,first); M.setBayShopOpen(farm.bayShop,true)
  const s=mount(farm,selection)
  s.until(()=>!farm.bayShop.visitor&&farm.bayShop.visitsToday===1)
  assert.equal(farm.bayShop.memories.bea.purchases['signature:'+first].liked,1)
  assert.ok(selection.choose(farm,'customer','bea'))
  shelf(farm,second,1,1);s.ui.refresh()
  s.until(()=>!farm.bayShop.visitor&&farm.bayShop.visitsToday===2)
  assert.equal(farm.bayShop.memories.finn.purchases['signature:'+second].liked,1)
  assert.equal(selection.current(farm).offer?.recipeId,first)
  const exact=C.getShopCommissionOffers(farm).find(o=>o.customer==='finn'&&o.recipeId===second)!
  assert.ok(exact);assert.equal(exact.total,34)
  return {s,selection,exact}
}

test('on an earned first shop day the one Orders control previews Finn’s newly ready exact recipe, not earlier Bea',()=>{
  const {farm,first,second}=stockedCase()
  const {s,selection,exact}=soldFinn(farm,first,second)
  assert.equal(s.label(),'Заказы · Финн')
  const before=structuredClone(farm),writes=s.writes
  s.click(['data-commissions'])
  assert.equal(s.panel,'shop-commissions')
  assert.equal(s.selected?.key,exact.key)
  assert.equal(s.calls[0].preview?.recipeId,second)
  assert.deepEqual(s.focuses,['[data-commission-view="customer"], [data-commission-customer]'])
  assert.deepEqual(farm,before);assert.equal(s.writes,writes)
  const html=renderShopCommissions(farm,()=>'',undefined,selection)
  assert.match(html,/(?:value="finn" selected|data-value="finn" aria-pressed="true")/)
  assert.match(html,new RegExp('data-action="commission-accept" data-value="'+exact.key+'"'))
  assert.ok(selection.choose(farm,'customer','bea'))
  assert.equal(selection.current(farm).offer?.recipeId,first,'the earlier customer remains a normal choice')
  s.ui.destroy()
})

test('a changed stock/day or replaced shop scene never treats an old observed sale as a ready preview',()=>{
  const {farm,first,second}=stockedCase()
  const {s,selection,exact}=soldFinn(farm,first,second)
  assert.equal(s.label(),'Заказы · Финн')
  const reopened=reopen(farm),reload=mount(reopened)
  assert.equal(reload.label(),'Заказы');reload.click(['data-commissions']);assert.equal(reload.calls[0].preview,undefined)
  assert.equal(reload.selected?.recipeId,first)
  reload.ui.destroy()
  assert.ok(F.useSignature(farm,second).ok) // Another explicit use removes one of the two needed portions.
  const before=structuredClone(farm)
  s.click(['data-commissions'])
  assert.equal(s.calls[0].preview,undefined);assert.equal(s.selected?.recipeId,first);assert.deepEqual(s.focuses,[])
  s.openExact('finn',{key:exact.key,customer:'finn',recipeId:second}) // Also check the production callback’s independent live boundary.
  assert.equal(selection.current(farm).offer?.recipeId,first);assert.deepEqual(farm,before);assert.deepEqual(s.focuses,[])
  s.ui.destroy()
  assert.ok(F.sail(reopened,'home').ok);assert.ok(F.endDay(reopened).ok);assert.ok(F.sail(reopened,'village').ok)
  const otherDay=mount(reopened)
  otherDay.openExact('finn',{key:exact.key,customer:'finn',recipeId:second})
  assert.equal(otherDay.selected?.recipeId,first);assert.deepEqual(otherDay.focuses,[])
  otherDay.ui.destroy()
})

test('no ready handoff when stock is still on the shelf, active order exists, or sale is an ordinary recipe',()=>{
  const supplied=stockedCase(),f=supplied.farm
  shelf(f,supplied.first);M.setBayShopOpen(f.bayShop,true)
  const remains=mount(f);remains.until(()=>!f.bayShop.visitor&&f.bayShop.visitsToday===1)
  shelf(f,supplied.second,1,1);shelf(f,'dish:orchardTart',1,2)
  assert.ok(M.setBayShopPrice(f.bayShop,2,10_000));remains.ui.refresh()
  remains.until(()=>!f.bayShop.visitor&&f.bayShop.visitsToday===2)
  assert.equal(f.bayShop.memories.finn.purchases['signature:'+supplied.second].liked,1)
  assert.equal(f.bayShop.slots[2]?.quantity,1);assert.equal(f.culinary.stock[supplied.second],2)
  assert.equal(remains.label(),'Заказы');remains.ui.destroy()
  const {farm,first,second}=stockedCase()
  shelf(farm,first);M.setBayShopOpen(farm.bayShop,true)
  const active=mount(farm);active.until(()=>!farm.bayShop.visitor&&farm.bayShop.visitsToday===1)
  assert.ok(C.acceptShopCommission(farm,C.getShopCommissionOffers(farm)[0].key).ok)
  shelf(farm,second,1,1);active.ui.refresh()
  active.until(()=>!farm.bayShop.visitor&&farm.bayShop.visitsToday===2)
  assert.equal(farm.bayShop.memories.finn.purchases['signature:'+second].liked,1)
  assert.equal(active.label(),'Заказы');active.ui.destroy()
  const p=commissionPlayer(opening)
  p.fruit('apple',1);p.fruit('pear',1);p.visit('home')
  p.act('specializeFarmhouse','preserves');p.act('cookDish','orchardPreserves');p.visit('village')
  const plain=p.state; shelf(plain,'dish:orchardPreserves');M.setBayShopOpen(plain.bayShop,true)
  const ordinary=mount(plain);ordinary.until(()=>!plain.bayShop.visitor&&plain.bayShop.visitsToday===1)
  assert.equal(plain.bayShop.memories.bea.purchases['dish:orchardPreserves'].liked,1)
  assert.equal(ordinary.label(),'Заказы');assert.equal(C.getShopCommissionOffers(plain).length,0);ordinary.ui.destroy()
})

test('the Buyers tab still opens its manually selected customer with the existing focus',()=>{
  const {farm,first,second}=stockedCase(),{s}=soldFinn(farm,first,second)
  s.click([],{tab:'journal'});s.click(['data-customer'],{customer:'bea'})
  assert.equal(s.label(),'Заказы · Беа')
  s.click(['data-commissions'])
  assert.equal(s.calls[0].preview,undefined);assert.equal(s.selected?.recipeId,first)
  assert.deepEqual(s.focuses,['[data-commission-view="customer"], [data-commission-customer]'])
  s.ui.destroy()
})

function quickControls(html:string) {
  return [...html.matchAll(/<button type="button" data-action="commission-preview-customer" data-value="([^"]+)" aria-pressed="([^"]+)" aria-label="([^"]+)"([^>]*)>([\s\S]*?)<\/button>/g)]
    .map(([,buyer,pressed,label,attrs,text])=>({buyer,pressed:pressed==='true',label,current:attrs.includes('data-commission-customer'),text:text.trim()}))
}
function renderOrders(farm:F.FarmState,view:ShopCommissionView) { return renderShopCommissions(farm,()=>'',undefined,view) }
function previewHandler(farm:F.FarmState,shopCommissionView:ShopCommissionView) {
  const s=mainSource.indexOf("    case 'commission-preview-customer':")
  const e=mainSource.indexOf("    case 'commission-accept':",s)
  assert.ok(s>=0&&e>s)
  let draws=0
  const focus:string[]=[],dialogContent={scrollTop:175,querySelector:(selector:string)=>{
    assert.equal(selector,'[data-action="commission-preview-customer"][aria-pressed="true"]')
    return {focus(opts:{preventScroll:boolean}){
      assert.ok(opts.preventScroll)
      const pressed=quickControls(renderOrders(farm,shopCommissionView)).filter(c=>c.pressed)
      assert.equal(pressed.length,1);focus.push(pressed[0].buyer)
    }}
  }}
  const env={farm,shopCommissionView,compactShopCommissionOffers:UI.compactShopCommissionOffers,getShopCommissionOffers:C.getShopCommissionOffers,
    panel:'shop-commissions',dialog:{open:true},dialogContent,drawPanel:()=>{draws++}}
  const click=runInNewContext(stripTypeScriptTypes('(value)=>{switch("commission-preview-customer"){'+mainSource.slice(s,e)+'}}'),env)
  return {click,env,focus,dialogContent,get draws(){return draws}}
}

test('ordinary D12 Orders exposes both earned choices and a true ready quantity without selecting or accepting it',()=>{
  const {farm,first,second}=stockedCase(),sale=soldFinn(farm,first,second)
  sale.s.ui.destroy()
  const cold=reopen(farm),v=new ShopCommissionView(),mountCold=mount(cold,v)
  assert.equal(mountCold.label(),'Заказы')
  const before=structuredClone(cold),writes=mountCold.writes
  mountCold.click(['data-commissions'])
  assert.equal(v.current(cold).offer!.recipeId,first,'ordinary entry does not jump to the ready customer')
  const html=renderOrders(cold,v)
  assert.doesNotMatch(html,/data-commission-view=/,'drop only the redundant pair of selects')
  assert.deepEqual(quickControls(html),[
    {buyer:'bea',pressed:true,label:'Беа, готовых порций 0 из 2',current:true,text:'Беа · 0/2'},
    {buyer:'finn',pressed:false,label:'Финн, готовых порций 2 из 2',current:false,text:'Финн · 2/2 ✓'},
  ])
  assert.match(html,/aria-label="Покупатель"/)
  assert.match(html,/За всю партию: 44 монеты/)
  assert.equal(mountCold.writes,writes);assert.deepEqual(cold,before)
  const h=previewHandler(cold,v)
  h.click('finn')
  assert.deepEqual(h.focus,['finn']);assert.equal(h.dialogContent.scrollTop,0);assert.equal(h.draws,1)
  const exact=v.current(cold).offer!
  assert.equal(exact.key,sale.exact.key)
  assert.equal(exact.total,34)
  const selected=renderOrders(cold,v)
  assert.match(selected,/За всю партию: 34 монеты/)
  assert.ok(selected.includes('data-action="commission-accept" data-value="'+exact.key+'"'))
  h.click('bea');assert.deepEqual(h.focus,['finn','bea']);assert.equal(v.current(cold).offer!.recipeId,first)
  h.click('not-a-buyer');assert.deepEqual(h.focus,['finn','bea'])
  h.click('finn')
  assert.deepEqual(cold,before,'direct choice is preview only, no shelf, coins, order or stock writes')
  assert.ok(C.acceptShopCommission(cold,exact.key).ok)
  assert.equal(cold.coins,before.coins);assert.deepEqual(cold.culinary.stock,before.culinary.stock)
  const serial=String(cold.shopCommissions.serial)
  for(let p=0;p<2;p++){assert.ok(C.deliverShopCommission(cold,serial).ok);assert.equal(cold.coins,before.coins)}
  assert.ok(C.finishShopCommission(cold,serial).ok);assert.equal(cold.coins-before.coins,34)
  assert.equal(C.finishShopCommission(cold,serial).ok,false)
  mountCold.ui.destroy()
})

test('same earned offers stay selectable but show no completion after use, and stale preview cannot replace an active order',()=>{
  const {farm,first,second}=stockedCase(),sale=soldFinn(farm,first,second)
  sale.s.ui.destroy()
  assert.ok(F.useSignature(farm,second).ok)
  const v=new ShopCommissionView(),view=renderOrders(farm,v)
  assert.deepEqual(quickControls(view).map(c=>c.text),['Беа · 0/2','Финн · 1/2'])
  const h=previewHandler(farm,v)
  h.env.dialog.open=false;h.click('finn')
  h.env.dialog.open=true;h.env.panel='bay-shop';h.click('finn')
  assert.equal(h.draws,0);assert.deepEqual(h.focus,[])
  h.env.panel='shop-commissions';h.click('finn')
  assert.ok(C.acceptShopCommission(farm,v.current(farm).offer!.key).ok)
  const before=structuredClone(farm)
  h.click('bea');assert.deepEqual(h.focus,['finn'])
  assert.deepEqual(farm,before);assert.deepEqual(quickControls(renderOrders(farm,v)),[])
})

test('earned D25 multi-recipe and assortment renders use both actual selectors, never a large buyer wall',()=>{
  const {p,jam,tart}=assortmentPlayer(JSON.parse(read('./fixtures/home-progress-actions.json'))), v=new ShopCommissionView()
  const farm=p.state,before=structuredClone(farm),offers=C.getShopCommissionOffers(farm)
  assert.deepEqual([farm.day,offers.length,new Set(offers.map(o=>o.customer)).size],[25,7,6])
  const html=renderOrders(farm,v)
  assert.deepEqual(quickControls(html),[])
  assert.match(html,/data-commission-view="customer"/);assert.match(html,/data-commission-view="request"/)
  assert.ok(v.choose(farm,'customer','bea'));assert.ok(v.choose(farm,'request','set'))
  const exact=C.getShopAssortment(farm,'bea',jam,tart)!
  const mixed=renderOrders(farm,v)
  assert.ok(mixed.includes('data-action="commission-accept" data-value="'+exact.key+'"'))
  assert.match(mixed,/За всю партию: 114 монет/)
  assert.deepEqual(farm,before)
})
