import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import {runInNewContext} from 'node:vm'
import * as F from '../src/farm.ts'
import * as W from '../src/warehouse-guidance.ts'
import {getMarketOrderBoard,renderMarketOrderPicker} from '../src/market-orders-view.ts'
import {pickUpMarketOrderStock} from '../src/market-order-pickup.ts'
import {getNextMarketOrders,renderNextMarketOrder} from '../src/market-return.ts'
import {earned416Mixed} from './fixtures/earned-416-market-orders.ts'

const read=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8')
const cut=(text:string,from:string,to:string)=>{
 const a=text.indexOf(from),b=text.indexOf(to,a+from.length)
 assert.ok(a>=0&&b>a,from);return text.slice(a,b)
}
const main=read('../src/main.ts'), requirements=read('../src/requirement-guidance.ts'),discovery=read('../src/discovery-path.ts')
const rendering=stripTypeScriptTypes(cut(main,'function requirementLink(','const islandNames')+
 cut(main,'function marketOrderStockTile(','let selectedMarketOrder')+cut(main,'function marketOrders()','function deliveryItems'))
const labels:Record<string,string>={eggs:'Яйцо','produce:wheat':'Пшеница'}
function compose(farm:F.FarmState,lane='pantry'){
 const requirementLinks=new Map<string,{kind:'stock';item:F.StockItem}>()
 const context={...F,...W,farm,requirementLinks,getMarketOrderBoard,renderMarketOrderPicker,getNextMarketOrders,renderNextMarketOrder,
  getBerryNurserySource:()=>undefined,stockLabel:(item:F.StockItem)=>({name:labels[F.marketKey(item)]??F.marketKey(item),image:''}),
  bayProductId:(item:F.StockItem)=>F.marketKey(item),icon:()=>'',numberFormat:new Intl.NumberFormat('ru-RU'),ruPlural:()=>'',escapeHtml:(s:string)=>s,
  button:(label:string,action:string,enabled=true,o:{value?:string}={})=>`<button data-action="${action}" data-value="${o.value??''}"${enabled?'':' disabled'}>${label}</button>`,
  panel:'market',marketTab:'orders',selectedMarketOrder:lane,stockTile:()=>''}
 const html=runInNewContext(rendering+'\nmarketOrders()',context) as string
 const detail=html.slice(html.indexOf('<div class="market-order-detail"'))
 const sources=[...detail.matchAll(/<button\b[^>]+data-action="show-requirement" data-value="([^"]*)"[^>]*>([\s\S]*?)<\/button>/g)]
    .map(([tag,value,body])=>({tag,value,body,requirement:requirementLinks.get(value)!}))
 return {html,detail,sources,context}
}
const existingSupplyRoute=stripTypeScriptTypes(cut(discovery,'function task(','function home(')+
 cut(discovery,'function supply(','\nfunction supperFish')+'\n(supply)')
const localStockHint=stripTypeScriptTypes(cut(requirements,'const route =','function capeBoatSurplus')+
 cut(requirements,'function stock(','/** Read-only wayfinding.')+'\n(stock)')
const showAction=stripTypeScriptTypes(cut(main,'async function showRequirement(','// Scene handlers own material sounds.')+
 '(async()=>{switch(action){'+cut(main,"    case 'show-requirement':", "    case 'picnic-field':")+'}})()')
const chooseAction=stripTypeScriptTypes('switch(action){'+cut(main,"    case 'market-order-select':", "    case 'deliver-order':")+'}')
const expected=(f:F.FarmState,lane='pantry')=>F.getMarketOrders(f).find(order=>order.lane===lane)!
function partial(){
 const p=earned416Mixed()
 assert.deepEqual([p.actions,p.state.day,p.state.coins,F.getSale(p.state).items,p.state.freight.warehouses.home.wheat,p.state.freight.warehouses.home.eggs],
 [552,196,60,416,2,3])
 p.act('transferBayGoods','withdraw','home','wheat',1)
 p.act('transferBayGoods','withdraw','home','eggs',1)
 p.act('cookDish','orchardTart',{family:'decorate',fruit:[],steps:['place']})
 const f=p.state
 assert.deepEqual([p.actions,f.day,f.coins,f.produce.wheat,f.eggs,f.freight.warehouses.home.wheat,
  f.freight.warehouses.home.eggs,f.dishes.orchardTart],[555,196,60,0,0,1,2,2])
 assert.ok(Object.values(f.variants.wheat??{}).some(count=>count>0),'ordinary and rare counters must stay distinct')
 return p
}

test('earned mixed +21 order exposes how much is already on the same-site shelf before reading either source',()=>{
 const p=partial(),f=p.state,before=structuredClone(f),order=expected(f)
 assert.deepEqual([order.status,order.reward],[ 'waiting',21 ])
 const board=getMarketOrderBoard(f,'pantry'),mapped=board.choices.find(r=>r.id==='pantry')!
 assert.equal(mapped.group,'waiting');assert.equal(mapped.warehouseRequest,undefined);assert.equal(board.pickup,undefined)
 const rendered=compose(f)
 assert.match(rendered.detail,/id="order-pantry">Ящик к завтраку/)
 assert.match(rendered.detail,/<small>Награда<\/small><span> 21/)
 assert.match(rendered.detail,/data-action="deliver-order" data-value="pantry" disabled/)
 assert.doesNotMatch(rendered.detail,/data-action="market-order-pickup"/)
 assert.deepEqual(rendered.sources.map(s=>F.marketKey(s.requirement.item)),['eggs','produce:wheat'])
 for(const s of rendered.sources){
  const item=s.requirement.item
  const q=W.getLocalWarehouseSupply(f,item)!
  assert.equal(q.quantity,1)
  assert.match(s.body,new RegExp('Нужно: '+item.quantity))
  assert.match(s.body,/В запасе: 0 · со склада \+1/)
  assert.match(s.tag,new RegExp('нужно '+item.quantity+', в запасе 0, со склада ещё 1'))
 }
 assert.deepEqual(f,before)
})

test('existing desktop keyboard entry keeps native source buttons; reading is free and separate withdrawal never finishes an incomplete order',async()=>{
 const p=partial(),f=p.state,before=structuredClone(f)
 const rendered=compose(f),wheat=rendered.sources.find(row=>F.marketKey(row.requirement.item)==='produce:wheat')!
 const supply=runInNewContext(existingSupplyRoute,W)
 const actualHint=runInNewContext(localStockHint,{...F,...W,getSupplyGuidance:supply}) as (f:F.FarmState,item:F.StockItem)=>{action:{target:string;value:string}}
 const moves:unknown[]=[]
 let focus:unknown
 const picker={scrollTop:80},detail={focus(){focus=this},scrollIntoView(o:unknown){moves.push(o)}}
 const select={...rendered.context,action:'market-order-select',value:'pantry',selectedMarketOrder:'garden',dialog:{open:true},
  dialogContent:{querySelector:(q:string)=>q==='.market-order-picker'?picker:q==='.market-order-detail'?detail:null},
  drawPanel(){picker.scrollTop=0}}
 runInNewContext(chooseAction,select)
 assert.equal(select.selectedMarketOrder,'pantry');assert.equal(picker.scrollTop,80);assert.equal(focus,detail)
 const control={closest:()=>null},opening={
  ...rendered.context, action:'show-requirement',value:wheat.value,control,dialog:{open:true}, selectedWarehouseRequest:null,
  getRequirementHint:(farm:F.FarmState,req:{kind:'stock';item:F.StockItem},origin:unknown)=>{assert.equal(origin,undefined);return actualHint(farm,req.item)},
  dialogContent:{querySelector:()=>null},openPanel:(name:string)=>moves.push(name),
  highlightControl:()=>{},perform:()=>assert.fail('a read must not execute a farm mutation'),closeDialog:()=>assert.fail('no crossing on a local source'),
 }
 await runInNewContext(showAction,opening)
 assert.equal(moves.at(-1),'warehouse-supply')
 assert.deepEqual(opening.selectedWarehouseRequest,wheat.requirement.item)
 assert.deepEqual(f,before)
 const q=W.getLocalWarehouseSupply(f,wheat.requirement.item)!
 assert.ok(W.withdrawWarehouseSupply(f,wheat.requirement.item,q).ok)
 assert.deepEqual([f.produce.wheat,f.freight.warehouses.home.wheat,f.coins,f.day],[1,undefined,60,196])
 assert.equal(expected(f).status,'waiting')
 const reopened=F.restoreCurrentFarm(JSON.parse(JSON.stringify(f)))!
 assert.ok(reopened);assert.deepEqual(reopened.orders,before.orders)
 assert.equal(F.deliverMarketOrder(reopened,'pantry').ok,false)
})

test('atomic completion quote and ready delivery are unchanged, and no unavailable or remote units are represented',()=>{
 const p=earned416Mixed(),full=p.state,fullBefore=structuredClone(full),board=getMarketOrderBoard(full,'pantry')
 assert.equal(board.choices.find(o=>o.id==='pantry')?.group,'warehouse')
 assert.deepEqual(board.pickup?.lines.map(l=>[l.supply.id,l.supply.quantity]),[['eggs',1],['wheat',2]])
 assert.match(compose(full).detail,/data-action="market-order-pickup"/)
 assert.ok(pickUpMarketOrderStock(full,'pantry',board.pickup?.token).ok)
 assert.deepEqual([full.produce.wheat,full.eggs,full.coins],[2,1,60])
 const ready=compose(full)
 assert.match(ready.detail,/data-action="deliver-order" data-value="pantry">/)
 assert.doesNotMatch(ready.detail,/со склада \+/)
 assert.ok(F.deliverMarketOrder(full,'pantry').ok)
 assert.equal(full.coins,fullBefore.coins+21)
 const q=partial()
 q.act('transferBayGoods','withdraw','home','wheat',1)
 q.visit('grove');q.act('transferBayGoods','deposit','grove','wheat',1);q.visit('home')
 const names=compose(q.state).sources
 assert.doesNotMatch(names.find(s=>F.marketKey(s.requirement.item)==='produce:wheat')!.body,/со склада \+/)
 assert.match(names.find(s=>F.marketKey(s.requirement.item)==='eggs')!.body,/со склада \+1/)
})
