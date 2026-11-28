import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import {runInNewContext} from 'node:vm'
import test from 'node:test'
import * as F from '../src/farm.ts'
import * as O from '../src/market-orders-view.ts'
import * as R from '../src/market-return.ts'
import * as H from '../src/harbour-economy.ts'
import * as Shop from '../src/bay-shop-model.ts'
import {ruPlural} from '../src/ru.ts'
import {getMarketOrderSurplusQuote,sellMarketOrderSurplus} from '../src/market-order-surplus.ts'
import {quoteMarketOrderPickup,pickUpMarketOrderStock} from '../src/market-order-pickup.ts'
import {earned416Mixed} from './fixtures/earned-416-market-orders.ts'
import {commissionPlayer} from './fixtures/commission-player.ts'
import {describeFood} from '../src/intent-orders.ts'

const read=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
const main=read('src/main.ts')
const cut=(a:string,b:string)=>{const i=main.indexOf(a),j=main.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,[a,b]);return main.slice(i,j)}
const script=stripTypeScriptTypes(cut('function button(','function goods()')+cut('let selectedMarketOrder:','function deliveryItems(')
 +cut('function marketCareProducts(','function treeSelector()')+'\nselectedMarketOrder=asked;marketCards()')
const early=()=>commissionPlayer(JSON.parse(read('tests/fixtures/market-order-selection-commands.json')).slice(0,-1))
function expanded(){
 const p=earned416Mixed(false)
 p.act('sellMarketItem','fruit:apple',12)
 p.act('specializeFarmhouse','preserves');p.act('specializeFacility','rain');p.act('cookDish','orchardPreserves')
 assert.deepEqual([p.actions,p.state.day,p.state.coins,F.getSale(p.state).items],[547,193,2,403])
 return p
}
function markup(farm:F.FarmState,marketTab='orders',selectedMarketOrder?:string){
 const before=structuredClone(farm)
 const output=runInNewContext(script,{...F,...O,...R,ruPlural,farm,marketTab,marketCategory:'seeds',asked:selectedMarketOrder,
  icon:()=>'',itemIcon:()=>'',numberFormat:new Intl.NumberFormat('ru'),marketOrderStockTile:(item:F.StockItem)=>`<li>${item.kind}</li>`,
  harborCard:()=>'<section id="harbor-order">Причал</section>',marketSaleResults:()=>'',marketBulkSaleControls:()=>'',marketSaleSearchStatus:()=>'',
  marketSellGroup:'all',marketSaleFamily:undefined,marketSaleQuery:'',marketFamilyOptions:()=>''}) as string
 assert.deepEqual(farm,before,'a toolbar cannot sell, reserve or sail')
 return output
}
test('the real Orders toolbar places same accessible Shop beside native tabs, preserving all six independently ready actions',()=>{
 const first=early();assert.deepEqual([first.actions,first.state.day,first.state.coins,first.state.village.built],[118,14,99,true])
 const mature=expanded(),stored=earned416Mixed()
 const ids=['garden','pantry','kitchen','irrigation','specialty','waterworks']
 assert.deepEqual(O.getMarketOrderBoard(mature.state).choices.filter(o=>o.group==='ready').map(o=>o.id),ids)
 for(const p of [first,mature,stored]){
  const f=p.state,html=markup(f),rail=html.slice(0,html.indexOf('class="market-orders-workspace"'))
  const toolbar=rail.indexOf('class="market-orders-navigation"'), tabs=rail.indexOf('class="market-controls"'),outlet=rail.indexOf('class="market-orders-shop"')
  assert.ok(toolbar>0&&tabs>toolbar&&outlet>tabs,'one live shop action is in the existing Orders navigation row, after the tabs')
  assert.deepEqual([...rail.matchAll(/data-action="market-tab" data-value="([^"]+)"/g)].map(x=>x[1]),['buy','sell','orders','projects'])
  assert.equal((html.match(/data-action="open-panel"\s+data-value="bay-shop"/g)??[]).length,1)
  assert.match(rail,/data-action="open-panel"\s+data-value="bay-shop"[^>]*>В лавку в гавань/);assert.doesNotMatch(rail,/tabindex="[1-9]/)
 }
 const ready=markup(mature.state,'orders','waterworks'),board=O.getMarketOrderBoard(mature.state,'waterworks')
 assert.equal(board.selected,'waterworks')
 assert.match(ready,/Корзина дождливого сада/);assert.match(ready,/data-action="deliver-order"\s+data-value="waterworks"[^>]*>/)
 assert.match(ready,/Когда появится следующий заказ/)
 const locked=markup(F.createFarm())
 assert.doesNotMatch(locked,/market-orders-navigation|market-orders-shop|data-value="bay-shop"/)
 const css=read('src/market-orders-view.css')
 assert.match(css,/@media\s*\(min-width:1080px\)\s*and\s*\(min-height:600px\)\s*\{[^}]*\.market-orders-navigation\s*\{[^}]*grid-template-columns:minmax\(0,1fr\) auto/)
})
test('Home market reserve and explicit local depot delivery stay distinct from a real Harbour buyer',()=>{
 const depot=earned416Mixed().state,before=structuredClone(depot)
 const reserve=getMarketOrderSurplusQuote(depot)!
 assert.deepEqual([reserve.items,reserve.kept,reserve.total],[405,11,1979])
 assert.match(markup(depot,'orders','kitchen'),/data-action="market-order-pickup"/)
 assert.ok(sellMarketOrderSurplus(depot,reserve.token).ok)
 assert.deepEqual(depot.orders,before.orders); assert.deepEqual(depot.freight,before.freight)
 assert.equal(depot.coins,before.coins+1979);assert.equal(depot.dishes.appleJam,1)
 const kitchen=F.getMarketOrders(depot).find(o=>o.lane==='kitchen')!
 const pickup=quoteMarketOrderPickup(depot,kitchen)!
 assert.ok(pickup);assert.ok(pickUpMarketOrderStock(depot,'kitchen',pickup.token).ok)
 assert.ok(F.deliverMarketOrder(depot,'kitchen').ok);assert.equal(depot.coins,before.coins+1979+32)
 assert.equal(depot.bayShop.sold,0)

 const p=early(),f=p.state
 assert.deepEqual([f.coins,f.dishes.orchardTart,f.bayShop.sold],[99,1,0])
 assert.ok(F.sail(f,'village').ok)
 assert.match(markup(f),/data-action="open-panel"\s+data-value="bay-shop"[^>]*>Своя лавка/)
 assert.deepEqual([f.coins,f.dishes.orchardTart,f.bayShop.sold],[99,1,0])
 const tart=F.foodDescriptors(f).find(o=>o.id==='dish:orchardTart')!
 assert.ok(H.reserveShopGoods(f,tart.id,1))
 assert.ok(Shop.stockBayShop(f.bayShop,0,{id:tart.id,identity:tart.id,name:tart.name,image:'/art/lavender/ui-tart.webp',
  basePrice:tart.sellPrice,tags:[...tart.ingredients,...describeFood(tart)]},1))
 assert.ok(Shop.setBayShopPrice(f.bayShop,0,25))
 Shop.setBayShopOpen(f.bayShop,true);assert.equal(f.bayShop.open,true)
 const receipts:ReturnType<typeof Shop.advanceBayShop>=[]
 for(let n=0;n<20&&!receipts.length;n++)receipts.push(...Shop.advanceBayShop(f.bayShop,1000))
 assert.deepEqual(receipts.map(x=>[x.visitor,x.product.id,x.price]),[['bea','dish:orchardTart',25]]);assert.equal(f.bayShop.sold,1)
 assert.equal(f.bayShop.slots[0]?.quantity,0);assert.equal(f.orders.kitchen.deliveredOn,0)
})
