import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import {runInNewContext} from 'node:vm'
import {createFarm,workBed,ingredientCount,type StockItem} from '../src/farm.ts'
const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
const helper=main.slice(main.indexOf('function marketOrderStockTile('),main.indexOf('\nlet selectedMarketOrder'))
function render(farm:ReturnType<typeof createFarm>,item:StockItem){
 let link:{content:string;requirement:{kind:string;item:StockItem};className:string;name:string;ready:boolean}|undefined
 const context={farm,item,ingredientCount,stockLabel:()=>({name:'Товар',image:'tomato'}),icon:(name:string)=>`<img src="${name}" alt="">`,requirementLink:(content:string,requirement:{kind:string;item:StockItem},className:string,name:string,ready:boolean)=>{link={content,requirement,className,name,ready};return content}}
 runInNewContext(stripTypeScriptTypes(helper+'\nmarketOrderStockTile(item)'),context)
 return link!
}
test('selected requirements name both quantities while retaining exact read-only readiness and stock target',()=>{
 const farm=createFarm();workBed(farm,2);workBed(farm,3);const before=structuredClone(farm)
 for(const item of [{kind:'produce',item:'tomato',quantity:1},{kind:'produce',item:'cabbage',quantity:2},{kind:'produce',item:'wheat',quantity:2},{kind:'eggs',quantity:1}] as StockItem[]){
  const stock=ingredientCount(farm,item),link=render(farm,item)
  assert.ok(link.content.includes(`Нужно: ${item.quantity}`));assert.ok(link.content.includes(`В запасе: ${stock}`));assert.equal(link.ready,stock>=item.quantity)
  assert.equal(link.requirement.kind,'stock');assert.equal(link.requirement.item,item);assert.equal(link.className,'ingredient order-requirement')
  assert.ok(link.name.includes(`нужно ${item.quantity}, в запасе ${stock}`));assert.doesNotMatch(link.content,/>\d+\/\d+</)
 }
 assert.deepEqual(farm,before)
})
test('ordinary-shortage warning does not silently include rare stock',()=>{
 const farm=createFarm();farm.variants.tomato={rainbow:3};const before=structuredClone(farm),link=render(farm,{kind:'produce',item:'tomato',quantity:1})
 assert.match(link.content,/Товар \(обычный урожай\)/);assert.match(link.content,/В запасе: 0/);assert.equal(link.ready,false);assert.deepEqual(farm,before)
})
test('clarity is confined to Orders and keeps the original single delivery action',()=>{
 const orders=main.slice(main.indexOf('function marketOrders()'),main.indexOf('\nfunction deliveryItems'))
 assert.equal((orders.match(/'deliver-order'/g)||[]).length,1);assert.match(orders,/order.status === 'ready'/);assert.match(orders,/<small>Награда<\/small>/)
 const cards=main.slice(main.indexOf('function marketCards()'),main.indexOf('function marketCards()')+2400)
 assert.match(cards,/if \(marketTab === 'orders'\) return `<section data-market-orders-browser>/)
 assert.doesNotMatch(orders+helper,/saveFarm\(|perform\(|deliverMarketOrder\(|localStorage/)
})
