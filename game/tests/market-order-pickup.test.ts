import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { runInNewContext } from 'node:vm'
import test from 'node:test'
import * as F from '../src/farm.ts'
import { freightCapacity, freightUsed } from '../src/bay-freight-model.ts'
import { transferBayGoods } from '../src/harbour-economy.ts'
import { getMarketOrderBoard, renderMarketOrderPicker } from '../src/market-orders-view.ts'
import { pickUpMarketOrderStock } from '../src/market-order-pickup.ts'
import { ActionClickGuard, ActivationKeyGuard, isGuardedAction } from '../src/action-click-guard.ts'
import { getLocalWarehouseSupply, warehouseRequest, withdrawWarehouseSupply } from '../src/warehouse-guidance.ts'
import {getRequirementHint} from '../src/requirement-guidance.ts'
import { earned416Mixed } from './fixtures/earned-416-market-orders.ts'

const before=earned416Mixed(), base=before.state
const restore=(farm=base)=>{const s=F.restoreCurrentFarm(JSON.parse(JSON.stringify(farm)));assert.ok(s);return s}
const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
function part(before:string,after:string) {
 const start=main.indexOf(before),end=main.indexOf(after,start+1)
 assert.ok(start>=0&&end>start)
 return main.slice(start,end)
}
const viewCode=stripTypeScriptTypes(part('function marketOrderStockTile(','let selectedMarketOrder')
 + part('function marketOrders()','function deliveryItems(')+'; marketOrders()')
const clickCode=stripTypeScriptTypes('switch (action) {'
 + part("    case 'market-order-pickup':","    case 'market-order-select':")
 + part("    case 'deliver-order':","    case 'project-boat':")+'}')
const button=(label:string,action:string,enabled=true,opts:{value?:string}={})=>
 `<button data-action="${action}" data-value="${opts.value??''}"${enabled?'':' disabled'}>${label}</button>`
function render(farm:F.FarmState,lane='pantry') {
 const ctx={farm,selectedMarketOrder:lane,...F,getMarketOrderBoard,renderMarketOrderPicker,button,icon:()=>'',ruPlural:()=>'',
  numberFormat:new Intl.NumberFormat('ru'),getNextMarketOrders:()=>[],renderNextMarketOrder:()=>'',
  stockLabel:(item:F.StockItem)=>({name:item.kind==='eggs'?'Яйцо':item.kind==='produce'&&item.item==='wheat'?'Пшеница':F.marketKey(item),image:'stock'}),
  requirementLink:(html:string,request:{item:F.StockItem},className:string,label:string,ready:boolean)=>
   `<button class="${className}" data-action="show-requirement" data-value="${F.marketKey(request.item)}" aria-label="${label}"${ready?' disabled':''}>${html}</button>`}
 return runInNewContext(viewCode,ctx) as string
}
function dispatch(farm:F.FarmState,action:string,value:string,options:{panel?:string;marketTab?:string;open?:boolean;attached?:boolean;lane?:string}={}) {
 const focused:string[]=[], control={}, mutations:{ok:boolean;message:string}[]=[]
 const detail={focus(v:{preventScroll:boolean}){assert.equal(v.preventScroll,true);focused.push('order-detail')},querySelector:()=>null}
 runInNewContext(clickCode,{...F,farm,pickUpMarketOrderStock, action, value, control,
  selectedMarketOrder:options.lane??'pantry',panel:options.panel??'market',marketTab:options.marketTab??'orders',
  dialog:{open:options.open??true},dialogContent:{contains:(c:object)=>c===control&&(options.attached??true),
   querySelector:(s:string)=>s==='.market-order-detail'?detail:null},
  perform(fn:()=>F.ActionResult){const result=fn();mutations.push(result);return result.ok}
 })
 return {focused,mutations}
}

test('earned 416-stock cold entry shows exact local changes in original two actionable ingredient tiles',()=>{
 const farm=restore(), snapshot=structuredClone(farm)
 assert.deepEqual([before.actions,farm.day,F.getSale(farm).items,F.getMarketStock(farm).filter(x=>x.count).length],[552,196,416,36])
 const html=render(farm)
 assert.match(html,/Яйцо (?:\(обычный урожай\)), нужно 1, в запасе 0, со склада ещё 1/)
 assert.match(html,/Пшеница (?:\(обычный урожай\)), нужно 2, в запасе 0, со склада ещё 2/)
 assert.match(html,/>В запасе: 0 · со склада \+1</)
 assert.match(html,/>В запасе: 0 · со склада \+2</)
 assert.equal((html.match(/data-action="show-requirement"/g)??[]).length,2)
 assert.equal((html.match(/data-action="market-order-pickup"/g)??[]).length,1)
 assert.doesNotMatch(html,/data-action="deliver-order"|data-action="warehouse-supply"/)
 assert.deepEqual(farm,snapshot)
})

test('one actual pickup and separate Deliver match both singles exactly: same capacity, charges, rewards and warehouse stock',()=>{
 const sameStart=restore(), single=restore(), cohort=restore(), beforeWare=freightUsed(cohort.freight,'home')
 const capacity=freightCapacity(cohort.freight,'home')
 for (const key of ['eggs|1','wheat|2']) {
   const request=warehouseRequest(key)!, source=getLocalWarehouseSupply(single,request)!
   assert.ok(withdrawWarehouseSupply(single,request,source).ok)
 }
 const view=render(cohort), token=view.match(/data-action="market-order-pickup" data-value="([^"]+)"/)?.[1]
 assert.ok(token)
 const actual=dispatch(cohort,'market-order-pickup',token)
 assert.deepEqual(actual.focused,['order-detail'])
 assert.equal(actual.mutations.length,1)
 assert.ok(actual.mutations[0].ok)
 assert.deepEqual(cohort,single)
 assert.equal(cohort.coins,sameStart.coins);assert.equal(cohort.workToday,sameStart.workToday)
 assert.deepEqual(cohort.orders,sameStart.orders)
 assert.equal(cohort.day,sameStart.day);assert.equal(cohort.island,'home')
 assert.equal(cohort.freight.warehouses.home.eggs,2)
 assert.equal(freightUsed(cohort.freight,'home'),beforeWare-3)
 assert.equal(freightCapacity(cohort.freight,'home'),capacity)
 assert.deepEqual(cohort.variants,sameStart.variants)
 assert.ok(restore(cohort))
 const delivered=render(cohort)
 assert.doesNotMatch(delivered,/market-order-pickup|со склада/)
 assert.match(delivered,/data-action="deliver-order" data-value="pantry"/)
 const prior=structuredClone(cohort)
 assert.equal(dispatch(cohort,'market-order-pickup',token).mutations[0].ok,false)
 assert.deepEqual(cohort,prior)
 assert.ok(F.deliverMarketOrder(single,'pantry').ok)
 assert.ok(dispatch(cohort,'deliver-order','pantry').mutations[0].ok)
 assert.deepEqual(cohort,single);assert.equal(cohort.coins-sameStart.coins,21)
})

test('one fully covered line needs no modal; partial, foreign and stale shortages cannot commit',()=>{
 const farm=restore()
 const quote=getMarketOrderBoard(farm,'pantry').pickup!
 const noQuote=(s:F.FarmState)=>assert.doesNotMatch(render(s),/data-action="market-order-pickup"/)
 const one=restore()
 assert.ok(transferBayGoods(one,'withdraw','home','eggs',1).ok)
 assert.deepEqual(getMarketOrderBoard(one,'pantry').pickup?.lines.map(({supply})=>[supply.id,supply.quantity]),[['wheat',2]])
 assert.match(render(one),/data-action="market-order-pickup"/)
 assert.doesNotMatch(render(one),/data-action="warehouse-supply"/)
 const singleBefore=structuredClone(one)
 assert.equal(pickUpMarketOrderStock(one,'pantry',quote.token).ok,false,'an older two-line quote cannot turn into a partial transaction')
 assert.deepEqual(one,singleBefore)
 const short=restore()
 assert.ok(transferBayGoods(short,'withdraw','home','wheat',1).ok)
 assert.ok(F.sellMarketItem(short,'produce:wheat',1).ok)
 const shortSnapshot=structuredClone(short)
 noQuote(short)
 assert.equal(pickUpMarketOrderStock(short,'pantry',quote.token).ok,false)
 assert.deepEqual(short,shortSnapshot)
 assert.equal(short.freight.warehouses.home.eggs,3)
 const foreign=restore()
 assert.ok(transferBayGoods(foreign,'withdraw','home','wheat',2).ok)
 assert.ok(F.sail(foreign,'grove').ok);noQuote(foreign)
 assert.ok(transferBayGoods(foreign,'deposit','grove','wheat',2).ok)
 assert.ok(F.sail(foreign,'home').ok);noQuote(foreign)
 const stale=restore()
 assert.ok(transferBayGoods(stale,'withdraw','home','eggs',1).ok)
 assert.ok(F.sellMarketItem(stale,'eggs',1).ok)
 // Still the same missing amounts; it must not reuse an old warehouse quote.
 assert.ok(getMarketOrderBoard(stale,'pantry').pickup)
 const before=structuredClone(stale)
 assert.equal(pickUpMarketOrderStock(stale,'pantry',quote.token).ok,false)
 assert.deepEqual(stale,before)
 assert.ok(F.endDay(farm).ok)
 const after=structuredClone(farm)
 assert.equal(pickUpMarketOrderStock(farm,'pantry',quote.token).ok,false)
 assert.deepEqual(farm,after)
})

test('closed, detached, another order or another market tab cannot spend; held and same-pointer gestures are guarded',()=>{
 const farm=restore(), token=getMarketOrderBoard(farm,'pantry').pickup!.token,snapshot=structuredClone(farm)
 for(const wrong of [{panel:'rest'},{marketTab:'sell'},{open:false},{attached:false},{lane:'kitchen'}]) {
  const result=dispatch(farm,'market-order-pickup',token,wrong)
  assert.ok(!result.mutations.some(x=>x.ok));assert.deepEqual(result.focused,[]);assert.deepEqual(farm,snapshot)
 }
 assert.ok(isGuardedAction('market-order-pickup'));assert.ok(isGuardedAction('deliver-order'))
 const pointer=new ActionClickGuard()
 pointer.remember({detail:1,timeStamp:100,clientX:60,clientY:60})
 assert.ok(pointer.blocks({detail:2,timeStamp:180,clientX:60,clientY:60}))
 const keys=new ActivationKeyGuard()
 assert.equal(keys.blocks({key:'Enter',repeat:false},true),false)
 assert.equal(keys.blocks({key:'Enter',repeat:true},true),true)
})

test('earned D196 jam and grain takes exactly the one missing owned line inline, then separately pays 32',()=>{
 const farm=restore(), baseline=structuredClone(farm)
 const lane='kitchen', html=render(farm,lane), board=getMarketOrderBoard(farm,lane)
 assert.equal(board.order?.name,'Варенье и зерно')
 assert.deepEqual([farm.day,farm.dishes.appleJam,farm.produce.wheat,farm.freight.warehouses.home.wheat,board.order!.reward],[196,1,0,2,32])
 const token=html.match(/data-action="market-order-pickup" data-value="([^"]+)"/)?.[1]
 assert.ok(token,'the fully covered single line can use the same direct pickup as the two-line order')
 assert.deepEqual(board.pickup?.lines.map(({supply})=>[supply.id,supply.quantity]),[['wheat',2]])
 assert.match(html,/Пшеница.*со склада ещё 2/)
 assert.match(html,/data-action="show-requirement" data-value="produce:wheat"/,'the exact optional warehouse review remains reachable')
 assert.doesNotMatch(html,/data-action="deliver-order"|data-action="warehouse-supply"/)
 assert.deepEqual(farm,baseline)

 const byWarehouse=restore();const requirement=warehouseRequest('wheat|2')!
 const review=getRequirementHint(farm,{kind:'stock',item:requirement})
 assert.deepEqual([review.action.target,review.action.value],['warehouse-supply','wheat|2'])
 assert.deepEqual(farm,baseline)
 assert.ok(withdrawWarehouseSupply(byWarehouse,requirement,getLocalWarehouseSupply(byWarehouse,requirement)).ok)
 const {mutations,focused}=dispatch(farm,'market-order-pickup',token,{lane})
 assert.deepEqual(mutations.map(m=>m.ok),[true]);assert.deepEqual(focused,['order-detail'])
 assert.deepEqual(farm,byWarehouse);assert.equal(farm.coins,baseline.coins);assert.deepEqual(farm.orders,baseline.orders)
 assert.match(render(farm,lane),/data-action="deliver-order" data-value="kitchen"/)
 const picked=structuredClone(farm)
 assert.equal(dispatch(farm,'market-order-pickup',token,{lane}).mutations[0].ok,false)
 assert.deepEqual(farm,picked)
 assert.ok(dispatch(farm,'deliver-order',lane,{lane}).mutations[0].ok)
 assert.equal(farm.coins-baseline.coins,32);assert.equal(farm.orders.kitchen.deliveredOn,196)
 assert.equal(farm.freight.warehouses.home.wheat,undefined)
 assert.equal(getMarketOrderBoard(farm,'pantry').pickup,undefined,'the second order cannot also claim that wheat')
 assert.ok(F.deliverMarketOrder(byWarehouse,lane).ok)
 assert.deepEqual(farm,byWarehouse)
})
