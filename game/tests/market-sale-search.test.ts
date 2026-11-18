import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { runInNewContext } from 'node:vm'
import { searchMarketSales } from '../src/market-sale-search.ts'
import { createFarm, getMarketStock, sellMarketItem, workBed, selectSeed, endDay, getBedAction, getSale, sellProduce } from '../src/farm.ts'

const stock = [
  {key:'fruit:apple',name:'Яблоко',count:30,price:4,group:'harvest'},
  {key:'variants:apple:rainbow',name:'Радужное яблоко',count:2,price:16,group:'harvest',trait:'rainbow'},
  {key:'honey',name:'Цветочный мёд',count:3,price:10,group:'harvest'},
  {key:'dishes:appleTart',name:'Яблочный пирог',count:1,price:20,group:'kitchen'},
]
test('search keeps exact identity, rarity, counts, original order and category without mutating stock',()=>{
  const before=structuredClone(stock)
  const found=searchMarketSales(stock,'harvest','  ЯБЛО ')
  assert.deepEqual(found.items,[stock[0],stock[1]])
  assert.equal(found.items[1],stock[1]); assert.equal(found.total,3)
  assert.equal(searchMarketSales(stock,'kitchen','ябл').items[0],stock[3])
  assert.equal(searchMarketSales(stock,'harvest','радуж ябл').items[0],stock[1])
  assert.equal(searchMarketSales(stock,'harvest','МЕД').items[0],stock[2])
  assert.deepEqual(stock,before)
})
test('empty and clear states stay inside the selected category; more than 30 rows remain reachable',()=>{
  const many=Array.from({length:45},(_,n)=>({key:`produce:${n}`,name:`Урожай ${n}`,count:n+1,group:'harvest'}))
  assert.equal(searchMarketSales(many,'harvest','урожай 44').items[0].key,'produce:44')
  assert.equal(searchMarketSales(stock,'harvest','несуществующий').items.length,0)
  assert.deepEqual(searchMarketSales(stock,'harvest','').items,stock.slice(0,3))
  assert.deepEqual(searchMarketSales(stock,'shore',''),{total:0,items:[]})
})
test('partial and exhausted exact product sales never retarget its sibling or change the requested category',()=>{
  const farm=createFarm(); farm.fruit.apple=30; farm.variants.apple={rainbow:2}
  const listings=()=>getMarketStock(farm).filter(x=>x.key==='fruit:apple'||x.key==='variants:apple:rainbow')
    .map(x=>({...x,name:x.key==='fruit:apple'?'Яблоко':'Радужное яблоко',group:'harvest'}))
  const before=structuredClone(farm)
  const chosen=searchMarketSales(listings(),'harvest','радуж').items[0]
  assert.deepEqual(farm,before)
  assert.ok(sellMarketItem(farm,chosen.key,1).ok)
  assert.equal(searchMarketSales(listings(),'harvest','радуж').items[0].count,1)
  assert.ok(sellMarketItem(farm,chosen.key,1).ok)
  assert.equal(searchMarketSales(listings(),'harvest','радуж').items.length,0)
  assert.equal(farm.fruit.apple,30)
  const exhausted=structuredClone(farm)
  assert.equal(sellMarketItem(farm,chosen.key,1).ok,false)
  assert.deepEqual(farm,exhausted)
  assert.deepEqual(searchMarketSales(listings(),'kitchen',''),{total:0,items:[]})
  assert.equal(searchMarketSales(listings(),'harvest','').items[0].key,'fruit:apple')
})


test('search or a product group cannot activate a whole-farm sale, including a stale button',()=>{
  const earned=createFarm();assert.ok(workBed(earned,0).ok)
  while(earned.day<5)assert.ok(endDay(earned).ok)
  assert.ok(selectSeed(earned,'beetroot').ok);assert.ok(workBed(earned,0).ok)
  while(getBedAction(earned,0).kind!=='harvest'){
    assert.ok(earned.day<10)
    if(getBedAction(earned,0).kind==='water')assert.ok(workBed(earned,0,0).ok)
    assert.ok(endDay(earned).ok)
  }
  assert.ok(workBed(earned,0).ok);assert.ok(workBed(earned,9).ok)
  assert.equal(earned.variants.beetroot?.rainbow,1);assert.equal(earned.produce.beetroot,1);assert.ok(earned.produce.carrot>0)
  const source=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
  const branch=source.slice(source.indexOf("    case 'sell':"),source.indexOf("    case 'inline-sale-step':"))
  const policy=source.slice(source.indexOf('function marketSaleSearchStatus('),source.indexOf('function marketInlineCard('))
  const code=stripTypeScriptTypes(policy+"\n"+"switch('sell'){"+branch+'}')
  for(const [group,query,attached,authorized] of [
    ['all',' радужная ',true,false],['all','нет такого продукта',true,false],['harvest','',true,false],
    ['all','',false,false],['all','  ',true,true],['all','',true,true],
  ] as const){
    const farm=structuredClone(earned),expected=structuredClone(earned),control={}
    const state={farm,marketSellGroup:group,marketSaleQuery:query,panel:'market',marketTab:'sell',dialog:{open:true},
      dialogContent:{contains:(candidate:unknown)=>attached&&candidate===control},control,salePresentation:{},sellProduce,
      perform:(action:()=>{ok:boolean})=>action().ok,playBaySound:()=>{},getSale,quantity:(v:number)=>String(v),button:(label:string)=>label}
    runInNewContext(code,state)
    if(authorized)assert.ok(sellProduce(expected).ok)
    assert.equal(getSale(farm).items,authorized?0:getSale(earned).items);assert.deepEqual(farm,expected)
    const rendered=runInNewContext(stripTypeScriptTypes(policy+';marketBulkSaleControls()'),state)
    assert.equal(rendered.includes('Продать всё'),group==='all'&&!query.trim())
  }
})
