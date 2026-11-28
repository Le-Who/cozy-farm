import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { runInNewContext } from 'node:vm'
import { createFarm, cropIds, getMarketStock, getSale, restoreFarm, variantLabel } from '../src/farm.ts'
import { traitIds } from '../src/climate.ts'
import { MarketInlineSales } from '../src/market-inline-sale.ts'
import { MarketSaleBrowseMemory } from '../src/market-sale-browse.ts'
import { searchMarketSaleView } from '../src/market-sale-search.ts'
import { recipeRepeatReturnFixture } from './fixtures/recipe-repeat-return.ts'
const s=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
const src=stripTypeScriptTypes(s.slice(s.indexOf('function marketCards('),s.indexOf('function treeSelector()'))+';marketCards()')
function sellView(farm:ReturnType<typeof createFarm>, group='all', query='', recipe=false) {
  return runInNewContext(src,{farm:{...farm,culinary:{...farm.culinary,recipes:recipe?[{}]:[]}},getSale,marketTab:'sell',marketSellGroup:group,marketSaleQuery:query,marketSaleFamily:undefined,
    icon:()=>'',quantity:String,numberFormat:new Intl.NumberFormat('ru'),panelTabs:(action:string)=>'<div data-test="'+action+'"></div>',button:(title:string,action:string,on:boolean,o?:{value?:string})=>'<button data-action="'+action+'" data-value="'+(o?.value??'')+'"'+(on?'':' disabled')+'>'+title+'</button>',
    nav:(s:string)=>'<nav>'+s+'</nav>',escapeHtml:String,marketBulkSaleControls:()=>'<button data-action="sell"></button>',marketSaleSearchStatus:()=>'0',marketSaleResults:()=>'<i>FILTERED_RESULTS</i>',marketFamilyOptions:()=>''}) as string
}
test('an empty seller is not an empty farm: one honest notice, no filters or whole-stock command; keep market and unlocked destinations',()=>{
  const f=createFarm();assert.equal(getSale(f).items,0);assert.ok(f.seeds.carrot>0)
  f.village.built=true
  for(const [group,q] of [['all',''],['harvest','яблоко'],['shore','']]){
    const out=sellView(f,group,q,true)
    assert.match(out,/Пока нет товаров для продажи\./)
    assert.match(out,/data-market-sale-empty[^>]*tabindex="-1"|tabindex="-1"[^>]*data-market-sale-empty/)
    assert.match(out,/data-test="market-tab"/)
    for(const v of ['bay-shop','recipe-surplus','recipes'])assert.match(out,new RegExp('data-value="'+v+'"'))
    assert.doesNotMatch(out,/Запасы пусты|data-market-sale-query|market-sell-group|data-action="sell"|FILTERED_RESULTS/)
  }
})
test('no matches in a stocked market keeps the search and group navigation',()=>{
  const f=createFarm();f.produce.carrot=1
  for(const [g,q] of [['shore',''],['harvest','не существует'],['all','пряник']]){
    const out=sellView(f,g,q)
    assert.match(out,/data-market-sale-query/);assert.match(out,/data-test="market-sell-group"/);assert.match(out,/FILTERED_RESULTS/);assert.doesNotMatch(out,/data-market-sale-empty/)
  }
})

test('the unlocked shop and sale groups precede a long real stock grid',()=>{
  const part=(from:string,to:string)=>s.slice(s.indexOf(from),s.indexOf(to,s.indexOf(from)))
  const render=stripTypeScriptTypes(part('function panelTabs(','function goods(')+
    part('function marketSaleSearchView()','function marketSaleSearchStatus()')+
    part('function marketInlineCard(','function inlineSaleContext(')+
    part('function marketCards(','function treeSelector()')+';marketCards()')
  const {farm}=recipeRepeatReturnFixture('ready')
  for(const crop of cropIds) {
    farm.produce[crop]=2
    for(const trait of traitIds)(farm.variants[crop]??={})[trait]=1
  }
  const goods=()=>getMarketStock(farm).filter(row=>row.count>0).map(row=>({...row,image:'',
    group:'harvest',name:row.item.kind==='variants'?variantLabel(row.item.item,row.item.trait).name:row.key}))
  assert.ok(restoreFarm(farm))
  const before=structuredClone(farm)
  const html=runInNewContext(render,{farm,getSale,goods,searchMarketSaleView,marketSaleBrowse:new MarketSaleBrowseMemory(),marketTab:'sell',
    marketSellGroup:'all',marketSaleFamily:undefined,marketSaleQuery:'',marketSaleSearchStatus:()=>'',marketBulkSaleControls:()=>'',
    marketInlineSales:new MarketInlineSales(),icon:()=>'',itemIcon:()=>'',quantity:String,numberFormat:new Intl.NumberFormat('ru'),
    button:(label:string,action:string,enabled:boolean,o?:{value?:string})=>`<button data-action="${action}" data-value="${o?.value??''}"${enabled?'':' disabled'}>${label}</button>`,
    nav:(content:string)=>`<nav>${content}</nav>`,escapeHtml:String}) as string
  const grid=html.indexOf('id="market-sale-results"')
  assert.ok(grid>0)
  assert.equal((html.match(/data-inline-key=/g)??[]).length,goods().length)
  assert.ok(goods().length>30)
  assert.match(html.slice(0,grid),/data-market-sale-query/)
  assert.match(html.slice(0,grid),/data-action="market-sell-group".*data-value="harvest"/)
  const shop=/<button data-action="open-panel" data-value="bay-shop">В лавку в гавань<\/button>/
  assert.match(html.slice(0,grid),shop,'the shop must be above the product scrolling region')
  assert.doesNotMatch(html.slice(grid),shop,'keep only one route to the shop')
  assert.deepEqual(farm,before)
})
