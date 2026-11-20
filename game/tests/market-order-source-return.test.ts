import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
import {stripTypeScriptTypes} from 'node:module'
import * as F from '../src/farm.ts'
import * as W from '../src/warehouse-guidance.ts'
import {bayProductId} from '../src/bay-product-id.ts'
import {getMarketOrderBoard,renderMarketOrderPicker} from '../src/market-orders-view.ts'
import {getNextMarketOrders,renderNextMarketOrder} from '../src/market-return.ts'
import {commissionPlayer} from './fixtures/commission-player.ts'

const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
const take=(start:string,end:string)=>main.slice(main.indexOf(start),main.indexOf(end,main.indexOf(start)))
const navigation=stripTypeScriptTypes(take('function focusKey(','let harbourScene:'))
const view=stripTypeScriptTypes(take('function requirementLink(','const islandNames')+
 take('function marketOrderStockTile(','let selectedMarketOrder')+take('function marketOrders()','function deliveryItems'))
const opening=JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json',import.meta.url),'utf8'))
const boat=opening.findIndex((a:{name:string})=>a.name==='buyBoat')
function earned(keepWheat:boolean,partial:boolean){
 const p=commissionPlayer(opening.slice(0,boat+1));assert.equal(p.state.day,2)
 if(partial){
  p.act('sellMarketItem','produce:wheat',1)
  p.act('transferBayGoods','deposit','home','wheat',1)
 }else{
  if(!keepWheat)p.act('transferBayGoods','deposit','home','wheat',2)
  p.act('transferBayGoods','deposit','home','eggs',3)
 }
 return p
}

for(const scenario of ['cancel','eggs','partial','ready','shortcut'] as const)test(`first breakfast crate remembers its ingredient and reading position on Back: ${scenario}`,()=>{
 const p=earned(scenario==='ready',scenario==='partial'),farm=p.state,order=F.getMarketOrders(farm).find(o=>o.lane==='pantry')!
 assert.equal(order.name,'Ящик к завтраку');assert.equal(order.status,'waiting')
 assert.equal(getMarketOrderBoard(farm).selected,'garden','another ready order must not steal the chosen waiting crate')
 let focused:Control|null=null,buttons:Control[]=[],html=''
 class Control{
  dataset:Record<string,string>;label:string
  constructor(dataset:Record<string,string>,label:string){this.dataset=dataset;this.label=label}
  getClientRects(){return [{}]} focus(){focused=this}
 }
 const picker={scrollTop:37},detail=new Control({},'detail:pantry'),links=new Map<string,{kind:string;item:F.StockItem}>()
 const content={scrollTop:92,querySelector:(selector:string)=>selector==='.market-order-picker'?picker:selector==='.market-order-detail'?detail:null,querySelectorAll:()=>[]}
 const fields='journeyDetailsOpen journalDetailsOpen selectedExpeditionPort selectedExpeditionOffer selectedWarehouseRequest selectedWarehouse freightPlanOpen inventoryGroup boatIsland marketSaleFamily marketSaleQuery marketCategory marketSellGroup bagTab archiveGroup treeSlot previewSeed specializationBuilding previewSpecialization irrigationMode villageSlot pastryShape workshopRecipe cookingDish cookingFish seedPickerBed signatureBase signatureSlot signatureRepeatId expandedRepeatId cookingMode communityOrderId communityResident requestedFood kitchenGroup kitchenTart kitchenPreserves kitchenDish honeyKitchenDish signatureFamily'.split(' ')
 const ctx={...Object.fromEntries(fields.map(k=>[k,undefined])),...F,...W,farm,requirementLinks:links,bayProductId,getMarketOrderBoard,renderMarketOrderPicker,getNextMarketOrders,renderNextMarketOrder,
  getBerryNurserySource:()=>undefined,stockLabel:(item:F.StockItem)=>({name:bayProductId(item),image:''}),icon:()=>'',numberFormat:new Intl.NumberFormat('ru'),ruPlural:()=>'',
  button:(label:string,action:string,enabled=true,o:{value?:string}={})=>`<button data-action="${action}" data-value="${o.value??''}"${enabled?'':' disabled'}>${label}</button>`,
  document:{get activeElement(){return focused}},HTMLButtonElement:Control,dialog:{open:true,querySelectorAll:()=>buttons},dialogContent:content,
  panel:'market',marketTab:'orders',selectedMarketOrder:'pantry',panelRenderVersion:1,panelHistory:[] as unknown[],signatureSlots:[],recipeBook:{snapshot(){},load(){}},
  restoreFerryPanelView(){},requestAnimationFrame:(fn:()=>void)=>fn(),openPanel(next:string){ctx.panel=next;render();picker.scrollTop=0;content.scrollTop=0;focused=null}}
 const run=(s:string)=>runInNewContext(s,ctx)
 run(view);run(navigation)
 function render(){
  links.clear();html=run('marketOrders()');buttons=[]
  for(const m of html.matchAll(/<button\b([^>]+)>/g)){
   const attrs=m[1],a=attrs.match(/data-action="([^"]+)"/)?.[1],v=attrs.match(/data-value="([^"]*)"/)?.[1]
   if(!a||v===undefined||attrs.includes('disabled'))continue
   buttons.push(new Control({action:a,value:v},a==='show-requirement'?bayProductId(links.get(v)!.item):a))
  }
 }
 render()
 const source=buttons.find(b=>b.label===(scenario==='shortcut'?'warehouse-supply':scenario==='partial'?'wheat':'eggs'))!
 source.focus();ctx.panelHistory.push(run('rememberPanel()'));ctx.panel='warehouse-supply'
 const withdraw=(item:F.StockItem)=>assert.ok(W.withdrawWarehouseSupply(farm,item,W.getLocalWarehouseSupply(farm,item)).ok)
 if(scenario==='partial'){
  assert.equal(W.getLocalWarehouseSupply(farm,order.items[1])?.quantity,1)
  withdraw(order.items[1])
 }else if(scenario!=='cancel')withdraw(order.items[0])
 const before=structuredClone(farm);run('goBack(true)')
 assert.equal(ctx.selectedMarketOrder,'pantry');assert.match(html,/id="order-pantry">Ящик к завтраку/)
 if(scenario==='eggs')assert.ok(buttons.some(b=>b.label==='wheat'&&b.dataset.value===source.dataset.value),'old slot 0 now belongs to wheat')
 assert.equal((focused as Control|null)?.label,scenario==='cancel'?'eggs':scenario==='partial'?'wheat':'detail:pantry','Back must never arm another source or Deliver')
 assert.equal(content.scrollTop,92);assert.equal(picker.scrollTop,37)
 assert.equal(F.getMarketOrders(farm).find(o=>o.lane==='pantry')!.reward,order.reward)
 assert.equal(farm.orders.pantry.completed,0);assert.deepEqual(farm,before)
})
