import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { runInNewContext } from 'node:vm'
import * as F from '../src/farm.ts'
import { MarketSaleBrowseMemory } from '../src/market-sale-browse.ts'
import { MarketInlineSales } from '../src/market-inline-sale.ts'
import { searchMarketSales, type MarketSaleGroup } from '../src/market-sale-search.ts'
import { getMarketOrderBoard } from '../src/market-orders-view.ts'
import { shellDefinitions } from '../src/tide.ts'
import { shoalDefinitions } from '../src/shoal.ts'
import { earned416Mixed } from './fixtures/earned-416-market-orders.ts'

const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
function section(from:string,to:string){
  const a=main.indexOf(from),b=main.indexOf(to,a+from.length);assert.ok(a>=0&&b>a,from);return main.slice(a,b)
}
const saleNames=stripTypeScriptTypes(section('function goods()','function fishImage(')+section('function stockLabel(','function stockTile(')+';goods()')
const tabs=stripTypeScriptTypes(section('function marketSellView()','function rememberClosedMarketSell()')+
  `switch('market-tab'){${section("    case 'market-tab':","    case 'market-order-pickup':")}}`)
type StockRow=ReturnType<typeof F.getMarketStock>[number]&{name:string;group:Exclude<MarketSaleGroup,'all'>}
const earned=earned416Mixed(false)
function screen() {
  const farm=structuredClone(earned.state), icons=new Proxy({},{get:()=>''})
  const goods=()=>structuredClone(runInNewContext(saleNames,{...F,farm,shellDefinitions,shoalDefinitions,
    fishImage:()=>'',pastryIcons:icons,dishIcons:icons})) as StockRow[]
  const selectedMarketOrder='pantry'
  const memory=new MarketSaleBrowseMemory(), draft=new MarketInlineSales()
  const ctx={farm,panel:'market',marketTab:'sell',marketSellGroup:'harvest' as MarketSaleGroup,marketSaleFamily:undefined as string|undefined,marketSaleQuery:'',
    dialog:{open:true},marketSaleBrowse:memory,marketInlineSales:draft,dialogFeedback:{hidden:false,textContent:''},
    dialogContent:{scrollTop:0,querySelector:(s:string)=>s==='#market-sale-results'&&ctx.marketTab==='sell'?grid:null},
    value:'orders',closeContextualSale(){},drawPanel(){grid=makeGrid()}}
  const makeGrid=()=>({scrollTop:0,querySelectorAll:()=>searchMarketSales(goods(),ctx.marketSellGroup,ctx.marketSaleQuery,ctx.marketSaleFamily)
    .items.map(item=>({dataset:{inlineKey:item.key}}))})
  let grid=makeGrid()
  return {ctx,memory,draft,farm,goods,selectedMarketOrder,open(tab:string){ctx.value=tab;runInNewContext(tabs,ctx)},get grid(){return grid}}
}

test('a return from ready Orders to Sell keeps the earned 416-item shelf and exact draft without completing anything',t=>{
  const s=screen(),f=s.farm, before=structuredClone(f)
  const rows=s.grid.querySelectorAll().map(x=>x.dataset.inlineKey)
  assert.deepEqual([earned.actions,f.day,F.getSale(f).items,s.goods().filter(r=>r.count>0).length,rows.length],[543,193,416,38,35])
  assert.deepEqual(getMarketOrderBoard(f).choices.filter(o=>o.group==='ready').map(o=>o.id),['garden','pantry','kitchen','irrigation'])
  s.grid.scrollTop=524
  const key='fruit:apple', item=s.goods().find(row=>row.key===key)!, sale=s.draft
  const quote=sale.view(key,item.count,item.price)
  assert.ok(sale.edit(key,quote.token,'2',item.count,item.price))
  s.open('orders');assert.equal(s.ctx.marketTab,'orders')
  assert.equal(getMarketOrderBoard(f,s.selectedMarketOrder).selected,'pantry')
  s.open('sell')
  const back=s.grid.scrollTop
  t.diagnostic(JSON.stringify({day:f.day,actions:earned.actions,stock:416,distinctStock:38,harvestRows:35,ordersTab:true,initialGridPosition:524,restoredGridPosition:back}))
  assert.equal(back,524)
  assert.deepEqual(s.grid.querySelectorAll().map(x=>x.dataset.inlineKey),rows)
  assert.deepEqual([s.ctx.marketSellGroup,s.ctx.marketSaleFamily,s.ctx.marketSaleQuery],['harvest',undefined,''])
  assert.deepEqual(sale.view(key,item.count,item.price).quote,{quantity:2,total:2*item.price,remaining:item.count-2,valid:true})
  assert.deepEqual(f,before)
})

test('a real hand-in changes the results; returning still keeps Harvest selected but does not reuse a stale offset',()=>{
  const s=screen(),f=s.farm
  assert.equal(f.orders.pantry.completed,0)
  assert.ok(s.grid.querySelectorAll().some(r=>r.dataset.inlineKey==='produce:wheat'))
  s.grid.scrollTop=524;s.open('orders')
  const pantry=F.getMarketOrders(f).find(o=>o.lane==='pantry')!
  assert.equal(pantry.status,'ready');const coins=f.coins
  assert.ok(F.deliverMarketOrder(f,'pantry').ok)
  const after=structuredClone(f)
  s.open('sell')
  assert.equal(s.grid.scrollTop,0)
  assert.equal(s.ctx.marketSellGroup,'harvest')
  assert.ok(!s.grid.querySelectorAll().some(r=>r.dataset.inlineKey==='produce:wheat'))
  assert.deepEqual([f.orders.pantry.completed,f.coins],[1,coins+pantry.reward])
  assert.deepEqual(f,after)
})

test('an explicit view change or a fresh menu invalidates the previous visit position',()=>{
  const changed=screen()
  changed.grid.scrollTop=524;changed.open('orders');changed.ctx.marketSaleQuery='яйца'
  changed.open('sell');assert.equal(changed.grid.scrollTop,0)
  assert.equal(changed.ctx.marketSaleQuery,'яйца')
  const fresh=screen()
  fresh.grid.scrollTop=524;fresh.open('orders');fresh.memory.reset() // same reset used on ordinary openPanel when the dialog was closed
  fresh.open('sell');assert.equal(fresh.grid.scrollTop,0)
  const shore=screen()
  shore.grid.scrollTop=524;shore.open('orders');assert.ok(F.sail(shore.farm,'grove').ok)
  shore.open('sell');assert.equal(shore.grid.scrollTop,0)
})
