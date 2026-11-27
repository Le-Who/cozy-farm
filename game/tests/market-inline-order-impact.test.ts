import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import test from 'node:test'
import {runInNewContext} from 'node:vm'
import * as F from '../src/farm.ts'
import {transferBayGoods} from '../src/harbour-economy.ts'
import {getMarketOrderBoard} from '../src/market-orders-view.ts'
import {pickUpMarketOrderStock} from '../src/market-order-pickup.ts'
import {inlineReceiptText, MarketInlineSales} from '../src/market-inline-sale.ts'
import {earned416Mixed} from './fixtures/earned-416-market-orders.ts'

const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
const extract=(a:string,b:string)=>{
 const i=main.indexOf(a),j=main.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,a)
 return main.slice(i,j)
}
const panel=stripTypeScriptTypes(extract('const marketInlineSales = ','\nlet saleQuantity')+'\n'
 +extract('function marketInlineCard(', 'function marketSaleResults(')
 +extract('function updateInlineSaleCard(', 'function confirmInlineSale(')
 +'\n;({marketInlineSales,marketInlineCard,updateInlineSaleCard})')
const base=earned416Mixed(false)
assert.deepEqual([base.actions,base.state.day,base.state.coins,F.getSale(base.state).items],[543,193,56,416])

function card(farm:F.FarmState,key:string,name:string){
 const item={...F.getMarketStock(farm).find(row=>row.key===key)!,name}
 const message={textContent:'',ariaLive:''},input={value:'1',max:String(item.count),disabled:false}
 const spend={dataset:{action:''},disabled:false,innerHTML:'',name:'',setAttribute(_key:string,label:string){this.name=label}}
 const node={dataset:{inlineToken:''},querySelectorAll:()=>[],querySelector:(s:string)=>s==='[data-inline-quantity]'?input:s==='.market-inline-sell'?spend:message}
 const ctx={farm,MarketInlineSales,inlineReceiptText,escapeHtml:(s:string)=>s,itemIcon:()=>'',icon:()=>'',quantity:(n:number)=>`${n} монеты`,
   numberFormat:new Intl.NumberFormat('ru'),inlineSaleContext:()=>({item})}
 const live=runInNewContext(panel,ctx)
 const html=()=>live.marketInlineCard(item) as string
 live.updateInlineSaleCard(node)
 const amount=(raw:string)=>{
  assert.ok(live.marketInlineSales.edit(key,node.dataset.inlineToken,raw,item.count,item.price))
  live.updateInlineSaleCard(node)
 }
 return {html,amount,message,spend,confirm(){
  const q=live.marketInlineSales.take(key,node.dataset.inlineToken,item.count,item.price)
  assert.ok(q)
  const sale=F.sellMarketItem(farm,key,q.quantity);assert.ok(sale.ok);live.marketInlineSales.finish(key,q,sale.goalRewardText)
 }}
}

test('an earned filtered-row quote discloses whether selling two, three, or six carrots removes real ready order options',()=>{
 const farm=structuredClone(base.state),before=structuredClone(farm)
 assert.deepEqual(F.getMarketOrders(farm).filter(o=>o.status==='ready').map(o=>o.lane),['garden','pantry','kitchen','irrigation'])
 const c=card(farm,'produce:carrot','Морковь')
 assert.equal(c.message.textContent,'')
 for(const [n,total,impact] of [['2',6,''],['3',9,'После продажи не хватит для 1 заказа'],['6',18,'После продажи не хватит для 2 заказов'],['2',6,'']] as const){
  c.amount(n)
  assert.equal(c.message.textContent,impact)
  assert.equal(c.message.ariaLive,'polite')
  const html=c.html()
  assert.equal(html.match(/<p class="market-inline-status"[^>]*>(.*?)<\/p>/)?.[1],impact)
  assert.match(html,new RegExp(`Продать ${n} · ${total}`))
  assert.match(html,/role="status" aria-live="polite"/)
  if(impact)assert.match(html,/class="market-inline-sell" aria-describedby="inline-sale-produce%3Acarrot"/)
  assert.equal(c.spend.disabled,false)
  assert.deepEqual(farm,before)
 }
 c.amount('7')
 assert.match(c.message.textContent,/от 1 до 6/)
 assert.equal(c.spend.disabled,true)
 assert.deepEqual(farm,before)
 c.amount('3');c.confirm()
 assert.deepEqual([farm.coins,farm.produce.carrot,farm.day],[65,3,193])
 assert.equal(F.getMarketOrders(farm).find(o=>o.lane==='garden')?.status,'ready')
 assert.equal(F.getMarketOrders(farm).find(o=>o.lane==='irrigation')?.status,'waiting')
})

test('unrelated stock and orders already waiting or delivered do not create a consequence',()=>{
 const farm=structuredClone(base.state),apple=card(farm,'fruit:apple','Яблоко'),before=structuredClone(farm)
 apple.amount('2');assert.equal(apple.message.textContent,'');assert.deepEqual(farm,before)
 assert.ok(F.deliverMarketOrder(farm,'irrigation').ok)
 assert.deepEqual(F.getMarketOrders(farm).filter(o=>o.lane==='garden'||o.lane==='irrigation').map(o=>o.status),['waiting','delivered'])
 assert.equal(farm.produce.carrot,2)
 const after=structuredClone(farm),c=card(farm,'produce:carrot','Морковь')
 c.amount('2');assert.equal(c.message.textContent,'');assert.deepEqual(farm,after)
})

test('the ready pantry order is not counted lost when one already-owned local egg can replace a sale',()=>{
 const farm=structuredClone(base.state)
 assert.ok(transferBayGoods(farm,'deposit','home','eggs',1).ok)
 assert.deepEqual([farm.eggs,farm.freight.warehouses.home.eggs],[2,1])
 assert.equal(getMarketOrderBoard(farm).choices.find(o=>o.id==='pantry')?.group,'ready')
 const c=card(farm,'eggs','Яйцо'),before=structuredClone(farm)
 c.amount('2')
 assert.equal(c.message.textContent,'')
 assert.match(c.html(),/Продать 2 · 6/)
 assert.deepEqual(farm,before)
 c.confirm()
 assert.deepEqual([farm.eggs,farm.freight.warehouses.home.eggs,farm.coins],[0,1,62])
 assert.equal(getMarketOrderBoard(farm).choices.find(o=>o.id==='pantry')?.group,'warehouse')
 assert.equal(F.deliverMarketOrder(farm,'pantry').ok,false,'preview did not collect automatically')
 assert.ok(transferBayGoods(farm,'withdraw','home','eggs',1).ok)
 assert.ok(F.deliverMarketOrder(farm,'pantry').ok)
 assert.equal(farm.coins,83)
})

test('the same market quote warns before taking the last jar from an earned fully local pickup order',()=>{
 const earned=earned416Mixed(true), farm=earned.state, before=structuredClone(farm)
 assert.deepEqual([earned.actions,farm.day,farm.coins,F.getSale(farm).items,farm.dishes.appleJam,farm.freight.warehouses.home.wheat],
  [552,196,60,416,1,2])
 const kitchen=(s:F.FarmState)=>getMarketOrderBoard(s,'kitchen')
 const pickup=kitchen(farm).pickup
 assert.deepEqual(pickup?.lines.map(({supply})=>[supply.id,supply.quantity]),[['wheat',2]])
 assert.equal(kitchen(farm).choices.find(x=>x.id==='kitchen')?.group,'warehouse')
 const c=card(farm,'dishes:appleJam','Яблочное варенье')
 assert.equal(c.message.textContent,'После продажи не хватит для 1 заказа')
 assert.equal(c.message.ariaLive,'polite')
 assert.equal((c.html().match(/После продажи не хватит для 1 заказа/g)??[]).length,1)
 assert.match(c.html(),/Продать 1 · 14/)
 assert.equal(c.spend.disabled,false)
 assert.deepEqual(farm,before,'a quote must not sell, reserve, cross or collect')
 const keep=structuredClone(before)
 assert.ok(pickUpMarketOrderStock(keep,'kitchen',pickup!.token).ok)
 assert.equal(keep.coins,60)
 assert.ok(F.deliverMarketOrder(keep,'kitchen').ok)
 assert.deepEqual([keep.coins,keep.day,keep.dishes.appleJam,keep.produce.wheat],[92,196,0,0])
 c.confirm()
 assert.deepEqual([farm.coins,farm.dishes.appleJam,farm.day,farm.island],[74,0,196,'home'])
 assert.deepEqual(farm.freight,before.freight)
 assert.deepEqual(farm.orders,before.orders)
 assert.equal(kitchen(farm).choices.find(x=>x.id==='kitchen')?.group,'waiting')
 assert.equal(getMarketOrderBoard(farm).choices.find(x=>x.id==='pantry')?.group,'warehouse')
})

test('no warning for a refillable local sale, unrelated fruit or an already incomplete route using another island',()=>{
 const before=earned416Mixed(true).state
 const pickup=(s:F.FarmState)=>getMarketOrderBoard(s,'kitchen').pickup
 const jam=(s:F.FarmState)=>card(s,'dishes:appleJam','Яблочное варенье')
 const keep=structuredClone(before)
 assert.ok(F.cookDish(keep,'appleJam').ok)
 assert.ok(transferBayGoods(keep,'deposit','home','dish:appleJam',1).ok)
 assert.ok(pickup(keep))
 const full=structuredClone(keep), cached=jam(keep)
 assert.equal(cached.message.textContent,'')
 assert.deepEqual(keep,full)
 cached.confirm()
 assert.deepEqual(pickup(keep)?.lines.map(({supply})=>supply.id),['dish:appleJam','wheat'])
 assert.equal(keep.freight.warehouses.home['dish:appleJam'],1)
 const peach=structuredClone(before)
 assert.equal(card(peach,'fruit:peach','Персик').message.textContent,'')
 assert.deepEqual(peach,before)
 const away=structuredClone(before)
 assert.ok(transferBayGoods(away,'withdraw','home','wheat',1).ok)
 assert.ok(F.sail(away,'grove').ok)
 assert.ok(transferBayGoods(away,'deposit','grove','wheat',1).ok)
 assert.ok(F.sail(away,'home').ok)
 assert.equal(pickup(away),undefined)
 const unavailable=structuredClone(away)
 assert.equal(jam(away).message.textContent,'')
 assert.deepEqual(away,unavailable)
})
