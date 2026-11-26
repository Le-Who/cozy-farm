import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { runInNewContext } from 'node:vm'
import test from 'node:test'
import * as F from '../src/farm.ts'
import * as H from '../src/harbour-economy.ts'
import * as shopModel from '../src/bay-shop-model.ts'
import * as quantities from '../src/bay-shop-quantity.ts'
import { BayShopCustomerView, renderBayShopCustomers } from '../src/bay-shop-customers.ts'
import { bayShopDayGuidance } from '../src/bay-shop-day.ts'
import { bayShopPurchaseReaction } from '../src/bay-shop-speech.ts'
import { shopRemainderQuote, shopReturnLabel } from '../src/bay-shop-price-copy.ts'
import { marketSaleFamilies } from '../src/market-sale-family.ts'
import { searchMarketSales } from '../src/market-sale-search.ts'
import { isGuardedAction } from '../src/action-click-guard.ts'
import { ruCount, ruPlural } from '../src/ru.ts'
import { commissionPlayer } from './fixtures/commission-player.ts'
import { harbourTradePlayer } from './fixtures/harbour-trade-player.ts'

const read=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8')
const main=read('../src/main.ts'),shop=read('../src/bay-shop.ts')
function cut(s:string,a:string,b:string) {
 const i=s.indexOf(a), e=s.indexOf(b,i+a.length);assert.ok(i>=0&&e>i,a);return s.slice(i,e)
}
const shopScene=stripTypeScriptTypes(shop.slice(shop.indexOf('const escape =')).replace('export function mountBayShop','function mountBayShop')+'\nmountBayShop')
const controller=stripTypeScriptTypes(
 cut(main,'function button(','function fishImage(')
 +cut(main,'function marketFamilyOptions(', 'function rememberClosedMarketSell(')
 +cut(main,'function marketCareProducts(', 'function treeSelector()')
 +cut(main,'function focusKey(', 'let harbourScene:')
 +cut(main,'function openShopScene(', 'function openMusicScene(')
 +cut(main,'async function visitPanelAt(', 'function openGuidedMarket(')
 +cut(main,'function openPanel(next:', "  if ((farm.island === 'cape' || farm.island === 'village')")
 +`if (remember && panel !== next && dialog.open && panel) panelHistory.push(rememberPanel())
 panel=next; dialog.open=true; panelRenderVersion++; rendered.push(next)
 switch(panel){`+cut(main,"    case 'bay-shop':\n","    case 'shop-commissions':")+ ` }
 if (panel==='market') marketGrid.scrollTop=0
 }
 function click(action,value){switch(action){`+cut(main,"    case 'open-panel':","\n")+ '}}\n'
 +cut(main,'function returnFromPanel(', "dialog.addEventListener('cancel', returnFromPanel)")
 +'({click,marketCards,goods,returnFromPanel,visitPanelAt,openPanel})')

const opening=JSON.parse(read('./fixtures/home-progress-actions.json'))
function earned() {
 const harbour=harbourTradePlayer(opening);harbour.build()
 const p=commissionPlayer(harbour.log);p.fruit('apple',2);p.fruit('pear',2);p.visit('home')
 assert.deepEqual([p.actions,p.state.day,p.state.island,p.state.coins,p.state.village.built,p.state.fruit.pear],[103,17,'home',54,true,2])
 assert.deepEqual(p.state.variants.pear,{rainbow:1,frost:1})
 return p.state
}
function screen(farm:F.FarmState, tab='sell', borrow='market') {
 let host:any
 const events:string[]=[],writes:Array<F.IslandId>=[],focus:string[]=[], marketGrid={scrollTop:0,querySelectorAll:()=>liveRows().map(row=>({dataset:{inlineKey:row.key}}))}
 type Listener=(event:unknown)=>void
 class Control {
  disabled=false
  attr:string; constructor(attr:string) { this.attr=attr }
  hasAttribute(key:string) { return key===this.attr }
 }
 class Node {}
 const outlet=new Control('data-action') as Control & {dataset:Record<string,string>}
 outlet.dataset={action:'open-panel',value:'bay-shop'}
 const data='selectedWarehouseRequest selectedExpeditionPort selectedExpeditionOffer selectedWarehouse inventoryGroup boatIsland bagTab archiveGroup treeSlot previewSeed specializationBuilding previewSpecialization irrigationMode villageSlot requestedFood cookingDish cookingFish kitchenTart kitchenPreserves kitchenGroup kitchenDish honeyKitchenDish freightPlanOpen journeyDetailsOpen journalDetailsOpen selectedMarketOrder pastryShape workshopRecipe seedPickerBed signatureBase signatureSlot signatureRepeatId expandedRepeatId signatureFamily cookingMode communityRequest communityOrderId communityResident harp musicView'.split(' ')
 const x:any={...F,...H,...shopModel,...quantities,BayShopCustomerView,renderBayShopCustomers,bayShopDayGuidance,bayShopPurchaseReaction,shopRemainderQuote,shopReturnLabel,marketSaleFamilies,ruCount,ruPlural,
  ...Object.fromEntries(data.map(k=>[k,undefined])), farm,panel:borrow,panelHistory:[],panelRenderVersion:0,signatureSlots:[],
  marketTab:tab,marketSellGroup:'harvest',marketSaleFamily:'fruit:pear',marketSaleQuery:'груша',marketCategory:'trees',
  rendered:events,harbourScene:undefined,nextShopStock:undefined,nextShopMarketVisit:undefined,
  dialog:{open:true,querySelectorAll:()=>[]},panelTitles:{'bay-shop':'Своя лавка',market:'Рынок',guide:'Бухта'},
  numberFormat:new Intl.NumberFormat('ru-RU'), icon:()=>'',itemIcon:()=>'',iconUrl:()=>'',escapeHtml:String,
  marketSaleResults:()=>'',marketSaleSearchStatus:()=>'',marketBulkSaleControls:()=>'',salePresentation:{place:undefined},
  stockLabel(item:F.StockItem){return {name:item.kind==='fruit'?F.treeDefinitions[item.item].name:item.kind==='variants'?F.variantLabel(item.item,item.trait).name:F.marketKey(item),image:''}},
  // Render only real carried pear rows in this scoped scene; quantity/action behavior is unmodified.
  harbourGoods:()=>liveRows().map(row=>({id:H.bayProductId(row.item),identity:H.bayProductId(row.item),name:row.name,image:'/pear.webp',item:row.item,
   quantity:row.count,basePrice:row.price,tags:['pear','fruit','sweet']})),
  marketGrid,fieldViewButton:{getAttribute:()=> 'false'},island:{isCrossing:()=>false,async crossIsland(fn:()=>boolean){await fn()}},
  closeDialog(){x.harbourScene?.destroy();x.harbourScene=undefined;x.dialog.open=false;x.panel=undefined;x.panelHistory.length=0;host=undefined;events.push('close')},
  perform(fn:()=>{ok:boolean}){const result=fn();if(result.ok)writes.push(farm.island);return result.ok},
  closeContextualSale:()=>false,returnToRecipeIndex:()=>false, rememberClosedMarketSell:()=>{},restoreFerryPanelView:()=>{},
  requestAnimationFrame:(fn:()=>void)=>{if(x.panel==='market')fn();return 1},cancelAnimationFrame:()=>{},
  status:()=>{},saveHarbour:()=>{writes.push(farm.island)},textAt:()=>{},bayAudio:{playEvent(){}},
  HTMLElement:Node,HTMLInputElement:Node,HTMLButtonElement:Control,Element:Node,
  ResizeObserver:class{observe(){}disconnect(){}},matchMedia:()=>({matches:true}),performance,
  window:{setTimeout:()=>1},clearTimeout:()=>{},playBaySound:()=>{},applyIngredientFinishes:()=>{},
  document:{activeElement:outlet,createElement(){
   const listeners:Record<string,Listener>={}
   const section={innerHTML:'',querySelector:()=>null,querySelectorAll:()=>[],contains:()=>true,addEventListener:(key:string,fn:Listener)=>{listeners[key]=fn},removeEventListener:()=>{},
    press(attr:string){listeners.click({target:{closest:()=>new Control(attr)}})}}
   return section
  }},
  dialogContent:{scrollTop:0,querySelectorAll:()=>[],querySelector:(s:string)=>s==='#market-sale-results'&&x.panel==='market'?marketGrid:s.includes('[data-market-sale-query]')?{focus(){focus.push('market-search')},scrollIntoView(){}}:null,
   contains:(candidate:unknown)=>candidate===host,replaceChildren(next:unknown){host=next}},
  recipeBook:{snapshot:()=>({}),load(){},view:{},restore(){}},
 }
 const mounted=runInNewContext(shopScene,x)
 x.mountBayShop=(host:unknown,options:unknown)=>mounted(host,options)
 const ui=runInNewContext(controller,x)
 const liveRows=()=>searchMarketSales(ui.goods(),'harvest','груша','fruit:pear').items as any[]
 const settle=()=>new Promise<void>(resolve=>setImmediate(resolve))
 const engage=async()=>{ui.click('open-panel','bay-shop');await settle()}
 return {ui,x,engage,writes,events,focus,settle,liveRows,get host(){return host},marketGrid}
}

test('earned orchard pear comparison returns 3→1 via one explicit travel, exact filter and no sale',async t=>{
 const farm=earned(),before=structuredClone(farm),s=screen(farm)
 assert.match(s.ui.marketCards(),/data-value="bay-shop"[^>]*>В лавку в гавань/u)
 assert.match(s.ui.marketCards(),/<option value="family:fruit:pear" selected/u)
 const keys=s.liveRows().map(r=>r.key)
 assert.deepEqual(keys,['fruit:pear','variants:pear:frost','variants:pear:rainbow'])
 await s.engage()
 assert.deepEqual([s.x.panel,farm.island,s.x.panelHistory.length],['bay-shop','village',0])
 assert.deepEqual(s.writes,['village'])
 assert.equal(farm.fruit.pear,2);assert.equal(farm.coins,54)
 const from=s.host
 const visible=from.innerHTML.match(/data-action="shop-market-home"/gu)??[]
 t.diagnostic(JSON.stringify({day:17,actions:103,fruit:keys,arrival:farm.island,exactComparisonReturnButtons:visible.length}))
 assert.equal(visible.length,1,'exact Market comparison must own one explicit Home route beside the unchanged local close')
 assert.match(from.innerHTML,/data-action="shop-market-home">Рынок дома<\/button>/u)
 assert.match(from.innerHTML,/data-close aria-label="Вернуться в бухту"/u)
 assert.match(from.innerHTML,/data-stock="pear"/u)
 assert.equal(isGuardedAction('shop-market-home'),true)
 // Only UI view variables can vary while away; no alteration of earned product state.
 Object.assign(s.x,{marketTab:'buy',marketSellGroup:'all',marketSaleFamily:undefined,marketSaleQuery:''})
 from.press('data-shop-market-home');await s.settle()
 assert.deepEqual([s.x.panel,farm.island,s.x.marketTab,s.x.marketSellGroup,s.x.marketSaleFamily,s.x.marketSaleQuery],
  ['market','home','sell','harvest','fruit:pear','груша'])
 assert.deepEqual(s.liveRows().map(row=>row.key),keys)
 assert.deepEqual(s.writes,['village','home']);assert.deepEqual(s.focus,['market-search'])
 assert.deepEqual([farm.day,farm.fruit.pear,farm.coins,farm.variants.pear,farm.bayShop.slots],
  [before.day,before.fruit.pear,before.coins,before.variants.pear,before.bayShop.slots])
 from.press('data-shop-market-home');await s.settle()
 assert.deepEqual(s.writes,['village','home'],'detached old button cannot start another trip')
})

test('ordinary Shop close or Escape stays local; the owned route ends with the scene',async()=>{
 for(const type of ['close','Escape']){
  const farm=earned(),s=screen(farm);await s.engage()
  const from=s.host,f={...farm.fruit},prior=structuredClone(farm)
  assert.match(from.innerHTML,/data-action="shop-market-home"/u)
  if(type==='close')from.press('data-close')
  else {
   const event={type:'keydown',defaultPrevented:false,preventDefault(){this.defaultPrevented=true}}
   s.ui.returnFromPanel(event)
   assert.equal(event.defaultPrevented,false)
   // Native modal Escape is not simulated by this model harness; close like its unchecked local default.
   s.x.closeDialog()
  }
  from.press('data-shop-market-home');await s.settle()
  assert.deepEqual([s.x.panel,s.x.dialog.open,farm.island],[undefined,false,'village'])
  assert.deepEqual(s.writes,['village']);assert.deepEqual(farm.fruit,f);assert.deepEqual(farm,prior)
  s.ui.openPanel('bay-shop')
  assert.doesNotMatch(s.host.innerHTML,/data-action="shop-market-home"/u)
  assert.equal(farm.island,'village')
 }
})

test('different initial tabs, guide trips and local arrivals do not gain or carry a comparison route',async()=>{
 for(const [tab,pane,place] of [['orders','market','home'],['sell','guide','home'],['sell','guide','village']] as const){
  const farm=earned();if(place==='village')assert.ok(F.sail(farm,'village').ok)
  const s=screen(farm,tab,pane);await s.engage()
  assert.deepEqual([s.x.panel,farm.island],['bay-shop','village'])
  assert.doesNotMatch(s.host.innerHTML,/data-action="shop-market-home"/u)
  assert.equal(s.writes.length,place==='home'?1:0)
 }
})
