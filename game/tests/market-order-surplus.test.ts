import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import test from 'node:test'
import {runInNewContext} from 'node:vm'
import {createFarm, deliverMarketOrder, endDay, getMarketBasket, getMarketOrders, getSale, restoreCurrentFarm, sail, sellMarketBasket, sellMarketItem, sellProduce, type FarmState} from '../src/farm.ts'
import {getMarketOrderSurplusQuote, sellMarketOrderSurplus} from '../src/market-order-surplus.ts'
import {transferBayGoods} from '../src/harbour-economy.ts'
import {ActionClickGuard, ActivationKeyGuard, isGuardedAction} from '../src/action-click-guard.ts'
import {earnedMarketOrderChoice} from './fixtures/earned-market-order-choice.ts'

const source = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8')
const renderEnd = source.indexOf('function marketInlineCard(')
const renderStart = source.indexOf('function wholeInventorySaleView()')
assert.ok(renderStart >= 0 && renderEnd > renderStart)
const bulk = stripTypeScriptTypes(source.slice(renderStart,renderEnd) + ';marketBulkSaleControls()')
const escapeHtml = (text:string) => text.replace(/[&"<>]/g,c=>({'&':'&amp;','"':'&quot;','<':'&lt;','>':'&gt;'}[c]!))
const quantity = (n:number, noun:string) => `${n} ${noun}`
function render(farm:FarmState, options:Record<string,unknown>={}) {
  return runInNewContext(bulk,{farm,getSale,getMarketOrderSurplusQuote,quantity,escapeHtml,marketSellGroup:'all',marketSaleQuery:'',salePresentation:{},
    button:(label:string, action:string,enabled=true,{value,context}: {value?:string;context?:string}={})=>
      `<button data-action="${action}" ${enabled?'':'disabled '}${value?`data-value="${value}"`:''}${context?` aria-label="${context}"`:''}>${label}</button>`,...options}) as string
}

test('the actual bulk strip offers one exact lower sale that leaves the two ready grain alternatives intact',()=>{
  const farm=earnedMarketOrderChoice(),before=structuredClone(farm),html=render(farm)
  assert.match(html,/Всего: 22 предмет · 148 монета/)
  assert.match(html,/data-action="sell"[^>]*>Продать всё/)
  assert.match(html,/data-action="sell-order-surplus"[^>]*>Продать остальное · 123 монета/)
  assert.match(html,/Оставить для готовых заказов: 4 предмет/)
  assert.equal((html.match(/data-action="sell-order-surplus"/g)??[]).length,1)
  assert.deepEqual(farm,before)
})

const reload=(farm:FarmState)=>restoreCurrentFarm(JSON.parse(JSON.stringify(farm)))!
const stillReady=(farm:FarmState)=>getMarketOrders(farm).filter(order=>order.status==='ready').map(order=>order.lane)
const controlToken=(html:string)=>html.match(/data-action="sell-order-surplus"[^>]*data-value="([^"]+)"/)?.[1]
  ?.replace(/&(quot|amp|lt|gt);/g,(_,entity:string)=>({quot:'"',amp:'&',lt:'<',gt:'>'})[entity]!)
const extractCase=(name:string, next:string)=>{
 const a=source.indexOf(`    case '${name}':`), b=source.indexOf(`    case '${next}':`,a+1)
 assert.ok(a>=0 && b>a)
 return stripTypeScriptTypes(`switch('${name}'){${source.slice(a,b)}}`)
}
function activate(farm:FarmState, mode:'sell-order-surplus'|'sell', options:{value?:string,panel?:string,marketTab?:string,
  open?:boolean,attached?:boolean,query?:string,group?:string,modalSale?:boolean,keyboard?:boolean}={}) {
 const control={}
 const log:string[]=[],result:{ok:boolean}[]=[]
 const details={marketSellGroup:options.group??'all',marketSaleQuery:options.query??''}
 const context={...details,farm,control,value:options.value,panel:options.panel??'market',marketTab:options.marketTab??'sell',
  dialog:{open:options.open??true}, salePresentation:{place:options.modalSale?{kind:'market'}:undefined},
  wholeInventorySaleView:()=>details.marketSellGroup==='all'&&!details.marketSaleQuery.trim(),
  event:{detail:options.keyboard?0:1},
  sellMarketOrderSurplus,sellProduce,
  dialogContent:{contains:(v:unknown)=>v===control&&(options.attached??true),querySelector:(selector:string)=>({
    focus:(settings?:{preventScroll:boolean})=>log.push(selector+(settings?.preventScroll?':quiet':''))
  })},
  perform(action:()=>{ok:boolean}){const r=action();result.push(r);return r.ok},
  playBaySound:(kind:string)=>log.push(kind),updateMarketSaleSearch:()=>log.push('fresh')
 }
 runInNewContext(extractCase(mode,mode==='sell-order-surplus'?'sell':'inline-sale-step'),context)
 return {log,result}
}

test('the real optional command sells 18 for 123, keeps a single shared pair, and advances neither order',()=>{
 const farm=earnedMarketOrderChoice(), before=structuredClone(farm), quote=getMarketOrderSurplusQuote(farm)!
 const chosen=controlToken(render(farm))
 assert.deepEqual([quote.items,quote.total,quote.kept],[18,123,4])
 assert.equal(chosen,quote.token)
 assert.ok(quote.requests.some(r=>r.key==='produce:carrot'&&r.quantity===1),'waiting garden order is not a hidden reservation')
 assert.deepEqual(stillReady(farm),['pantry','kitchen'])
 const action=activate(farm,'sell-order-surplus',{value:chosen,keyboard:true})
 assert.equal(action.result[0].ok,true)
 assert.deepEqual(action.log,['trade.receive','.market-total:quiet'])
 const expected=structuredClone(before), expectedBasket=getMarketBasket(expected,quote.requests)!
 assert.ok(sellMarketBasket(expected,quote.requests,expectedBasket.token).ok)
 assert.deepEqual(farm,expected,'the same all-or-nothing reviewed basket with no additional changes')
 const held={'produce:wheat':2,eggs:1,'dishes:appleJam':1}
 assert.deepEqual([farm.produce.wheat,farm.eggs,farm.dishes.appleJam],[held['produce:wheat'],held.eggs,held['dishes:appleJam']])
 assert.equal(farm.coins-before.coins,123)
 assert.deepEqual(getSale(farm),{items:4,coins:25})
 assert.deepEqual(stillReady(farm),['pantry','kitchen'])
 assert.deepEqual(farm.orders,before.orders)
 assert.deepEqual(farm.freight,before.freight)
 assert.deepEqual(farm.culinary,before.culinary)
 assert.deepEqual(farm.beds,before.beds)
 assert.deepEqual(farm.seeds,before.seeds)
 assert.deepEqual(farm.neighbors,before.neighbors)
 assert.equal(farm.day,before.day)
 assert.equal(farm.progress.sell,before.progress.sell+1)
 assert.deepEqual(reload(farm),farm)
 assert.doesNotMatch(render(farm),/sell-order-surplus/)
 const conserved=structuredClone(farm)
 assert.equal(activate(farm,'sell-order-surplus',{value:chosen}).result[0].ok,false)
 assert.deepEqual(farm,conserved)
 for(const [lane,other] of [['pantry','kitchen'],['kitchen','pantry']] as const){
   const choice=reload(farm);assert.ok(deliverMarketOrder(choice,lane).ok)
   assert.equal(getMarketOrders(choice).find(order=>order.lane===other)?.status,'waiting','shared wheat is not enough to fulfill both')
 }
})

test('intentional Sell All still sells everything for 148 with the old command and empties both ready alternatives',()=>{
 const farm=earnedMarketOrderChoice(),coins=farm.coins
 const result=activate(farm,'sell')
 assert.equal(result.result[0].ok,true)
 assert.deepEqual(result.log,['trade.receive','[data-market-sale-empty]:quiet'])
 assert.equal(farm.coins-coins,148)
 assert.deepEqual(getSale(farm),{items:0,coins:0})
 assert.deepEqual(stillReady(farm),[])
 assert.equal(render(farm),'')
})

test('only the live unfiltered Sell surface can act; stale day, stock, destination, and readiness changes cannot sell',()=>{
 const seed=earnedMarketOrderChoice(),token=controlToken(render(seed))!
 for(const options of [{marketTab:'orders'},{panel:'sale'},{open:false},{attached:false},{query:'пшеница'},
   {group:'harvest'},{modalSale:true}]){
   const farm=reload(seed),result=activate(farm,'sell-order-surplus',{value:token,...options})
   assert.deepEqual(result,{log:[],result:[]});assert.deepEqual(farm,seed)
 }
 for(const change of [
  (farm:FarmState)=>endDay(farm),
  (farm:FarmState)=>transferBayGoods(farm,'deposit','home','wheat',1),
  (farm:FarmState)=>sellMarketItem(farm,'fruit:apple',1),
  (farm:FarmState)=>deliverMarketOrder(farm,'pantry'),
  (farm:FarmState)=>sail(farm,'grove')
 ]){
   const farm=reload(seed);assert.ok(change(farm).ok)
   const before=structuredClone(farm)
   const result=activate(farm,'sell-order-surplus',{value:token,keyboard:true})
   assert.equal(result.result[0].ok,false)
   assert.deepEqual(result.log,['fresh','.market-total:quiet'])
   assert.deepEqual(farm,before)
 }
 const untampered=reload(seed)
 for(const forged of [null,12,'',token+'.', 'x'.repeat(100001)])
   assert.equal(sellMarketOrderSurplus(untampered,forged).ok,false)
 assert.deepEqual(untampered,seed)
})

test('no duplicate control, no automatic sell: filtering, open row editor, empty surplus or no ready orders hide the alternative',()=>{
 const farm=earnedMarketOrderChoice()
 for(const params of [{marketSaleQuery:' яблоко '},{marketSellGroup:'kitchen'},
  {salePresentation:{place:{kind:'market',key:'eggs'}}}]){
   assert.doesNotMatch(render(farm,params),/sell-order-surplus/)
 }
 const onlySurplus=reload(farm)
 const token=getMarketOrderSurplusQuote(onlySurplus)?.token
 assert.ok(sellMarketOrderSurplus(onlySurplus,token).ok)
 assert.equal(getMarketOrderSurplusQuote(onlySurplus),undefined)
 assert.doesNotMatch(render(onlySurplus),/sell-order-surplus/)
 assert.match(render(onlySurplus),/Продать всё/)
 assert.ok(sellMarketItem(farm,'produce:wheat',1).ok)
 assert.deepEqual(stillReady(farm),[])
 assert.equal(getMarketOrderSurplusQuote(farm),undefined)
 assert.doesNotMatch(render(farm),/sell-order-surplus/)
 const newFarm=createFarm()
 assert.equal(getMarketOrderSurplusQuote(newFarm),undefined)
 assert.equal(render(newFarm),'')
})

test('double click and held key cannot transition from the disappearing option into Sell All',()=>{
 assert.equal(isGuardedAction('sell-order-surplus'),true)
 assert.equal(isGuardedAction('sell'),true)
 const pointer=new ActionClickGuard(),keys=new ActivationKeyGuard()
 const click={detail:1,timeStamp:10,clientX:200,clientY:180}
 pointer.remember(click)
 assert.equal(pointer.blocks({...click,detail:2,timeStamp:110}),true)
 assert.equal(pointer.blocks({...click,timeStamp:610}),false)
 assert.equal(keys.blocks({key:'Enter',repeat:false},isGuardedAction('sell-order-surplus')),false)
 assert.equal(keys.blocks({key:'Enter',repeat:true},isGuardedAction('sell')),true)
 keys.release('Enter')
 assert.equal(keys.blocks({key:'Enter',repeat:false},isGuardedAction('sell')),false)
 assert.match(source,/<div class="market-total" tabindex="-1"/)
 const css=readFileSync(new URL('../src/market-sale-grid.css',import.meta.url),'utf8')
 assert.match(css,/\.market-order-surplus\s*\{[^}]*flex-wrap:wrap/)
 assert.match(css,/\.market-total .dialog-button[^}]*min-height:44px/)
})
