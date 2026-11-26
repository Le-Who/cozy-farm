import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { runInNewContext } from 'node:vm'
import * as F from '../src/farm.ts'
import { shellDefinitions } from '../src/tide.ts'
import { shoalDefinitions } from '../src/shoal.ts'
import { searchMarketSales, searchMarketSaleView, type MarketSaleGroup } from '../src/market-sale-search.ts'
import { MarketSaleBrowseMemory } from '../src/market-sale-browse.ts'
import { MarketInlineSales } from '../src/market-inline-sale.ts'
import { earned416Mixed } from './fixtures/earned-416-market-orders.ts'

const source=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
function between(a:string,b:string){
 const i=source.indexOf(a),j=source.indexOf(b,i+a.length);assert.ok(i>=0&&j>i);return source.slice(i,j)
}
// Use the actual UI naming/group policy, not pretend localizations of earned stock.
const view=stripTypeScriptTypes(between('function goods()','function fishImage(')+
 between('function stockLabel(','function stockTile(')+between('function marketSaleResults()','function inlineSaleContext(')+
 between('function marketSaleSearchView()','function marketBulkSaleControls()')+';({goods,marketSaleResults,marketSaleSearchStatus,wholeInventorySaleView})')
type Row=ReturnType<typeof F.getMarketStock>[number]&{name:string;group:string}
function seller(farm:F.FarmState,query:string,group:MarketSaleGroup='all',family?:string){
 const placeholders=new Proxy({},{get:()=>''})
 const fn=runInNewContext(view,{...F,farm,marketSellGroup:group,marketSaleFamily:family,marketSaleQuery:query,searchMarketSales,searchMarketSaleView,marketSaleBrowse:new MarketSaleBrowseMemory(),
  shellDefinitions,shoalDefinitions,fishImage:()=>'',pastryIcons:placeholders,dishIcons:placeholders,
  marketInlineCard:(item:Row)=>`<li data-inline-key="${item.key}">${item.name}: ${item.count}</li>`})
 const goods=structuredClone(fn.goods()) as Row[], selected=fn.marketSaleResults() as string
 return {goods, selected, result:searchMarketSales(goods,group,query,family), status:fn.marketSaleSearchStatus() as string,whole:fn.wholeInventorySaleView() as boolean}
}

test('earned 416-stock market can find existing raw fruit and eggs by normal plural without including prepared goods',t=>{
 const p=earned416Mixed(false),farm=p.state,before=structuredClone(farm)
 const apples=seller(farm,'яблоки'),eggs=seller(farm,'ЯЙЦА'),peaches=seller(farm,'персики'),pears=seller(farm,'груши')
 const singular=seller(farm,'яблок').result.items
 const expectedApples=apples.goods.filter(x=>x.count>0&&(x.key==='fruit:apple'||x.key.startsWith('variants:apple:')))
 const expectedEggs=eggs.goods.filter(x=>x.count>0&&(x.key==='eggs'||x.key.startsWith('variants:egg:')))
 assert.equal(F.getSale(farm).items,416)
 assert.ok(expectedApples.some(x=>x.key==='fruit:apple')&&expectedEggs.some(x=>x.key==='eggs'))
 assert.ok(expectedApples.length>=2&&expectedEggs.length>=2,'ordinary and rare are separately earned')
 assert.ok(apples.goods.some(x=>x.count>0&&x.key==='dishes:appleJam'))
 t.diagnostic(JSON.stringify({day:farm.day,actions:p.actions,stock:F.getSale(farm).items,availableRows:apples.result.total,
  queryCounts:{apples:apples.result.items.length,eggs:eggs.result.items.length,pears:pears.result.items.length,peaches:peaches.result.items.length},
  actualAppleRows:expectedApples.length,actualEggRows:expectedEggs.length,ordinaryAppleStock:expectedApples[0]?.count}))
 assert.deepEqual(apples.result.items,expectedApples); assert.deepEqual(eggs.result.items,expectedEggs)
 assert.ok(pears.result.items.some(x=>x.key==='fruit:pear'));assert.ok(peaches.result.items.some(x=>x.key==='fruit:peach'))
 assert.deepEqual(singular,expectedApples);assert.match(apples.selected,/data-inline-key="fruit:apple"/)
 assert.ok(eggs.selected.includes('data-inline-key="eggs"'))
 assert.equal(apples.whole,false);assert.equal(eggs.whole,false,'query is not a bulk-sale authorization')
 assert.deepEqual(seller(farm,'яблоки','kitchen').result.items,[])
 assert.deepEqual(seller(farm,'яблоки','harvest','fruit:pear').result.items,[])
 assert.deepEqual(farm,before)
})

test('plural rare selection retains the exact draft, total and remaining stock through another group',()=>{
 const p=earned416Mixed(false),farm=p.state,before=structuredClone(farm)
 // A real earned harvest may differ by trait; derive the exact singular/plural pair from a stocked product.
 const key='variants:egg:rainbow'
 const expected=seller(farm,'радужное яйцо','harvest','eggs').result.items
 assert.ok(expected.some(x=>x.key===key), 'rare farm egg is genuinely earned')
 const current=seller(farm,'радужные яйца','harvest','eggs').result.items
 assert.deepEqual(current,expected)
 assert.deepEqual(seller(farm,'радужные яйца','kitchen').result.items,[])
 const item=current.find(x=>x.key===key)!;const sales=new MarketInlineSales()
 let quote=sales.view(item.key,item.count,item.price)
 assert.equal(sales.edit(item.key,quote.token,'1',item.count,item.price),true)
 assert.deepEqual(seller(farm,'радужные яйца','shore').result.items,[])
 const row=seller(farm,'радужные яйца','harvest','eggs').result.items.find(x=>x.key===key)!
 quote=sales.view(row.key,row.count,row.price)
 assert.deepEqual(farm,before)
 const confirmed=sales.take(row.key,quote.token,row.count,row.price)
 assert.deepEqual(confirmed,{quantity:1,total:row.price,remaining:row.count-1})
 assert.ok(F.sellMarketItem(farm,row.key,confirmed!.quantity).ok)
 assert.equal(farm.eggs,before.eggs)
 assert.equal(farm.coins,before.coins+row.price)
 assert.equal(F.getSale(farm).items,415)
 assert.equal(sales.take(row.key,quote.token,row.count,row.price),undefined)
})
