import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import test from 'node:test'
import {runInNewContext} from 'node:vm'
import * as F from '../src/farm.ts'
import {transferBayGoods} from '../src/harbour-economy.ts'
import {getMarketOrderBoard} from '../src/market-orders-view.ts'
import {getMarketOrderSurplusQuote,sellMarketOrderSurplus} from '../src/market-order-surplus.ts'
import {earned416Mixed} from './fixtures/earned-416-market-orders.ts'

const carrying=earned416Mixed(false), stored=earned416Mixed(true)
const original=stored.state
const kitchen=(farm:F.FarmState)=>getMarketOrderBoard(farm,'kitchen').choices.find(c=>c.id==='kitchen')
const pantry=(farm:F.FarmState)=>getMarketOrderBoard(farm,'pantry').choices.find(c=>c.id==='pantry')
const reopen=(farm:F.FarmState)=>F.restoreCurrentFarm(JSON.parse(JSON.stringify(farm)))!
const source=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
const start=source.indexOf('function wholeInventorySaleView()'),end=source.indexOf('function marketInlineCard(',start)
assert.ok(start>=0&&end>start)
const markup=stripTypeScriptTypes(source.slice(start,end)+';marketBulkSaleControls()')
const render=(farm:F.FarmState,scope:Record<string,unknown>={})=>runInNewContext(markup,{
 farm,getSale:F.getSale,getMarketOrderSurplusQuote,quantity:(n:number,noun:string)=>n+' '+noun,
 escapeHtml:(s:string)=>s.replaceAll('&','&amp;').replaceAll('"','&quot;'),
 button:(name:string,action:string,on:boolean,opts:Record<string,string>={})=>
  `<button data-action="${action}" data-value="${opts.value??''}"${on?'':' disabled'}>${name}</button>`,
 marketSellGroup:'all',marketSaleQuery:'',salePresentation:{},...scope}) as string

test('earn the 416-item Home market: the optional sale protects an owned local pick-up, with unchanged explicit sale/delivery actions',()=>{
 const farm=reopen(original), quote=getMarketOrderSurplusQuote(farm)!
 assert.deepEqual([stored.actions,farm.day,F.getSale(farm).items,farm.dishes.appleJam,farm.produce.wheat,farm.freight.warehouses.home.wheat],[552,196,416,1,0,2])
 assert.equal(kitchen(farm)?.warehouseRequest,'wheat|2')
 assert.equal(pantry(farm)?.group,'warehouse')
 const html=render(farm)
 assert.deepEqual([quote.items,quote.total,quote.kept],[405,1979,11])
 assert.doesNotMatch(html,/Оставить для готовых заказов/)
 assert.match(html,/Оставить для доступных заказов: 11 предмет/)
 assert.equal((html.match(/data-action="sell[^"]*"/g)??[]).length,2)
 assert.match(html,/data-action="sell"[^>]*>Продать всё/)
 assert.match(html,/data-action="sell-order-surplus"[^>]*>Продать остальное · 1979 монета/)
 assert.deepEqual(farm,original)
 assert.equal(render(farm,{marketSaleQuery:'яблоко'}),'')
 assert.equal(render(farm,{marketSellGroup:'harvest'}),'')
 assert.ok(sellMarketOrderSurplus(farm,quote.token).ok)
 assert.deepEqual([farm.coins-original.coins,farm.dishes.appleJam,farm.produce.wheat],[1979,1,0])
 assert.equal(kitchen(farm)?.group,'warehouse')
 assert.deepEqual(farm.freight,original.freight)
 assert.deepEqual(farm.orders,original.orders)
 assert.deepEqual([farm.day,farm.island],[original.day,'home'])
 assert.deepEqual(reopen(farm),farm)
 assert.ok(!F.deliverMarketOrder(farm,'kitchen').ok,'sale does not pick up or deliver')
 assert.ok(transferBayGoods(farm,'withdraw','home','wheat',2).ok)
 assert.ok(F.deliverMarketOrder(farm,'kitchen').ok)
 assert.equal(farm.coins-original.coins,2011)
 assert.notEqual(pantry(farm)?.group,'ready','the two stored wheat cannot satisfy two orders')
 assert.notEqual(pantry(farm)?.group,'warehouse','the shared exact two wheat were used once')
 const all=reopen(original)
 assert.ok(F.sellProduce(all).ok);assert.equal(all.coins-original.coins,2031)
 assert.deepEqual(all.freight,original.freight)
 assert.deepEqual(F.getSale(all),{items:0,coins:0})
 assert.equal(render(all),'')
})

test('old earned bag-ready quote is exact; only loss of relevant Home eligibility makes this new preview stale',()=>{
 const old=reopen(carrying.state), ordinary=getMarketOrderSurplusQuote(old)!
 assert.deepEqual([old.day,F.getSale(old).items,ordinary.items,ordinary.total,ordinary.kept],[193,416,402,1957,14])
 assert.match(render(old),/Оставить для готовых заказов: 14 предмет/)
 const farm=reopen(original), quote=getMarketOrderSurplusQuote(farm)!
 const moveOne=(s:F.FarmState,id:'eggs'|'wheat')=>{
  assert.ok(transferBayGoods(s,'withdraw','home',id,1).ok)
  assert.ok(F.sail(s,'grove').ok)
  assert.ok(transferBayGoods(s,'deposit','grove',id,1).ok)
  assert.ok(F.sail(s,'home').ok)
 }
 const notRelevant=reopen(farm);moveOne(notRelevant,'eggs')
 assert.equal(pantry(notRelevant)?.group,'warehouse','the surviving local eggs still cover the plan')
 assert.equal(getMarketOrderSurplusQuote(notRelevant)?.token,quote.token)
 const gone=reopen(farm);moveOne(gone,'wheat')
 assert.equal(kitchen(gone)?.group,'waiting')
 const current=getMarketOrderSurplusQuote(gone)!
 assert.deepEqual([current.items,current.total,current.kept],[406,1993,10])
 const before=structuredClone(gone)
 assert.ok(!sellMarketOrderSurplus(gone,quote.token).ok)
 assert.deepEqual(gone,before)
 assert.equal(getMarketOrderSurplusQuote(F.createFarm()),undefined)
 const onlyReserved=reopen(farm)
 assert.ok(sellMarketOrderSurplus(onlyReserved,quote.token).ok)
 assert.equal(getMarketOrderSurplusQuote(onlyReserved),undefined,'do not offer a duplicate option when every bag item is retained')
 const away=reopen(farm);assert.ok(F.sail(away,'grove').ok);assert.equal(getMarketOrderSurplusQuote(away),undefined)
})
