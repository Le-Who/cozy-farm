import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import test from 'node:test'
import {runInNewContext} from 'node:vm'
import * as F from '../src/farm.ts'
import * as S from '../src/market-order-surplus.ts'
import {ruPlural,traitLabel} from '../src/ru.ts'
import {shellDefinitions} from '../src/tide.ts'
import {shoalDefinitions} from '../src/shoal.ts'
import {MarketInlineSales} from '../src/market-inline-sale.ts'
import {MarketSaleBrowseMemory} from '../src/market-sale-browse.ts'
import {marketSaleFamilies} from '../src/market-sale-family.ts'
import {searchMarketSales,searchMarketSaleView} from '../src/market-sale-search.ts'
import {earned416Mixed} from './fixtures/earned-416-market-orders.ts'

const source=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
const cut=(start:string,end:string)=>{
 const a=source.indexOf(start),b=source.indexOf(end,a+start.length)
 assert.ok(a>=0&&b>a,start)
 return source.slice(a,b)
}
const escapeHtmlSource=readFileSync(new URL('../src/culinary-ui.ts',import.meta.url),'utf8').split('\n')
 .find(line=>line.startsWith('export const escapeRecipeText='))?.replace('export const escapeRecipeText=','const escapeHtml=')
assert.ok(escapeHtmlSource)
const render=stripTypeScriptTypes(escapeHtmlSource+'\n'+
 cut('function button(','function fishSource(')+cut('function stockLabel(','function stockTile(')
 +cut('function marketFamilyOptions(','function setMarketSaleQuery(')
 +cut('function marketSaleSearchView()','function inlineSaleContext(')
 +cut('function marketCareProducts(','function treeSelector(')
 +';({marketCards,selectMarketFamily,selectMarketSaleGroup,goods})')
const keys=(html:string)=>[...html.matchAll(/data-inline-key="([^"]+)"/g)].map(([,x])=>x)
const typeFruit='type:fruit',typeBerries='type:berries'
const fresh=()=>{
 const p=earned416Mixed(true)
 assert.deepEqual([p.state.day,p.actions,F.getSale(p.state).items],[196,552,416])
 return p.state
}
type Row=ReturnType<typeof F.getMarketStock>[number]&{name:string;group:string}
function market(farm:F.FarmState){
 let markup=''
 const grid={scrollTop:0},blanks=new Proxy({},{get:()=>''}),marketInlineSales=new MarketInlineSales(()=>farm)
 const ctx={
  ...F,...S,farm,panel:'market',dialog:{open:true},marketTab:'sell',marketCategory:'seeds',marketSellGroup:'harvest',
  marketSaleFamily:undefined as string|undefined,marketSaleQuery:'',
  marketInlineSales,salePresentation:{place:undefined},marketSaleBrowse:new MarketSaleBrowseMemory(),
  dialogContent:{scrollTop:0,querySelector:(sel:string)=>sel==='#market-sale-results'?grid:null},
  closeContextualSale:()=>false,drawPanel(){markup=fn.marketCards()},
  marketSaleFamilies,searchMarketSales,searchMarketSaleView,ruPlural,traitLabel,shellDefinitions,shoalDefinitions,
  pastryIcons:blanks,dishIcons:blanks,icon:()=>'',itemIcon:()=>'',numberFormat:new Intl.NumberFormat('ru-RU'),
 }
 const fn=runInNewContext(render,ctx) as {marketCards():string;selectMarketFamily(value:string):boolean;
  selectMarketSaleGroup(value:string):boolean;goods():Row[]}
 ctx.drawPanel()
 return {ctx,grid,fn,get html(){return markup}}
}
const fruitKeys=['fruit:apple','fruit:pear','fruit:peach','variants:apple:dew','variants:apple:frost','variants:apple:rainbow','variants:apple:star','variants:pear:rainbow','variants:pear:star']
const berryKeys=['produce:strawberry','produce:blueberry','produce:raspberry','variants:blueberry:frost','variants:raspberry:frost']

test('earned 416-unit Harvest selects all fruit or all berries once without removing default cards or any sale state',()=>{
 const f=fresh(),before=structuredClone(f),view=market(f)
 const all=keys(view.html)
 assert.equal(all.length,33)
 assert.equal((view.html.match(/data-market-sale-family/g)??[]).length,1)
 assert.equal((view.html.match(/data-market-sale-query/g)??[]).length,1)
 assert.match(view.html,/value="harvest" selected>Весь урожай/)
 assert.match(view.html,/value="family:type:fruit">Фрукты · 9 видов/,'actual existing filter needs one discoverable whole fruit choice')
 assert.match(view.html,/value="family:type:berries">Ягоды · 5 видов/)
 assert.match(view.html,/data-action="review-harvest-sale"/)
 assert.equal(view.fn.selectMarketFamily('family:type:bogus'),false)
 assert.equal(view.fn.selectMarketFamily('type:fruit'),false)
 let cell=view.ctx.marketInlineSales.view('fruit:apple',315,4)
 assert.ok(view.ctx.marketInlineSales.edit('fruit:apple',cell.token,'7',315,4))
 assert.equal(view.fn.selectMarketFamily('family:'+typeFruit),true)
 assert.deepEqual(keys(view.html),fruitKeys)
 assert.doesNotMatch(view.html,/data-action="(?:review-harvest-sale|sell-order-surplus|sell)"/)
 assert.match(view.html,/value="family:type:fruit" selected/)
 const stock=structuredClone(view.fn.goods())
 const source=stock.filter(x=>fruitKeys.includes(x.key))
 assert.deepEqual(searchMarketSales(stock,'harvest','',typeFruit).items,source)
 assert.equal(searchMarketSales(stock,'harvest','радужные яблоки',typeFruit).items[0].key,'variants:apple:rainbow')
 view.grid.scrollTop=143
 assert.ok(view.fn.selectMarketSaleGroup('kitchen'))
 assert.ok(view.fn.selectMarketSaleGroup('harvest'))
 assert.deepEqual([view.ctx.marketSaleFamily,view.grid.scrollTop],[typeFruit,143])
 assert.deepEqual(keys(view.html),fruitKeys)
 assert.equal(view.fn.selectMarketFamily('family:'+typeBerries),true)
 assert.deepEqual(keys(view.html),berryKeys)
 assert.equal(searchMarketSales(stock,'harvest','черника',typeBerries).items.length,2)
 assert.equal(view.fn.selectMarketFamily('family:fruit:apple'),true)
 assert.deepEqual(keys(view.html),fruitKeys.filter(x=>x==='fruit:apple'||x.startsWith('variants:apple:')))
 assert.equal(view.fn.selectMarketFamily('harvest'),true)
 assert.deepEqual(keys(view.html),all)
 assert.match(view.html,/data-action="review-harvest-sale"/)
 cell=view.ctx.marketInlineSales.view('fruit:apple',315,4)
 assert.deepEqual([cell.raw,cell.quote.quantity,cell.quote.total],['7',7,28])
 assert.deepEqual(f,before)
})

test('no unnecessary types on a fresh farm; an exhausted selected fruit type never falls through to a different item',()=>{
 const starting=F.createFarm();assert.ok(F.pickFruit(starting,0).ok);assert.ok(F.workBed(starting,9).ok)
 const early=market(starting)
 assert.equal(early.fn.selectMarketFamily('family:'+typeFruit),false)
 assert.doesNotMatch(early.html,/family:type:/)
 const f=fresh(),view=market(f)
 assert.ok(view.fn.selectMarketFamily('family:'+typeFruit))
 for(const row of view.fn.goods())if(row.count>0&&fruitKeys.includes(row.key))assert.ok(F.sellMarketItem(f,row.key,row.count).ok)
 const after=structuredClone(f)
 view.ctx.drawPanel()
 assert.deepEqual(keys(view.html),[])
 assert.match(view.html,/value="family:type:fruit" selected>Фрукты · 0 видов/)
 assert.doesNotMatch(view.html,/data-action="(?:inline-sale-confirm|review-harvest-sale|sell)"/)
 assert.equal(view.fn.selectMarketFamily('harvest'),true)
 assert.doesNotMatch(view.html,/family:type:fruit/)
 assert.ok(keys(view.html).includes('produce:carrot'))
 assert.deepEqual(f,after)
})
