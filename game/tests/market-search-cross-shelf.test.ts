import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { runInNewContext } from 'node:vm'
import * as F from '../src/farm.ts'
import { MarketInlineSales } from '../src/market-inline-sale.ts'
import { MarketSaleBrowseMemory } from '../src/market-sale-browse.ts'
import { marketSaleFamilies } from '../src/market-sale-family.ts'
import { searchMarketSales, searchMarketSaleView, type MarketSaleGroup } from '../src/market-sale-search.ts'
import { earned416Mixed } from './fixtures/earned-416-market-orders.ts'
import { shellDefinitions } from '../src/tide.ts'
import { shoalDefinitions } from '../src/shoal.ts'

const source=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
function section(start:string,end:string){
 const a=source.indexOf(start),b=source.indexOf(end,a+start.length);assert.ok(a>=0&&b>a);return source.slice(a,b)
}
const appSrc=stripTypeScriptTypes([
 section('function goods()','function fishImage('),section('function stockLabel(','function stockTile('),
 section('function marketSellView()','function marketBulkSaleControls('),section('function marketSaleResults()','function inlineSaleContext('),
 section('function updateMarketSaleSearch()','function marketCareProducts('),
 section("app.addEventListener('compositionend', event => {","app.addEventListener('keydown', event => {"),
].join('\n'))
const confirm=stripTypeScriptTypes(section('function inlineSaleContext(', 'function updateMarketSaleSearch()')+';confirmInlineSale(control)')
const clear=stripTypeScriptTypes(`switch('market-sale-clear'){${section("    case 'market-sale-clear':","    case 'market-sell-group':")}}`)
const earned=earned416Mixed(false).state
function screen(group:MarketSaleGroup,family?:string){
 const farm=structuredClone(earned), before=structuredClone(farm), icons=new Proxy({},{get:()=>''})
 const memory=new MarketSaleBrowseMemory(), document={activeElement:null as Search|null}
 const listeners=new Map<string,(ev:unknown)=>void>()
 class Search {
  value=''; caret=0
  matches(s:string){return s==='[data-market-sale-query]'}
  focus({preventScroll}:{preventScroll:boolean}){assert.equal(preventScroll,true);document.activeElement=this}
  scrollIntoView(){}
 }
 const search=new Search(), status={textContent:'',classList:{toggle(){}}}, button={disabled:true}
 const grid={scrollTop:0,innerHTML:'',querySelectorAll:()=>[...grid.innerHTML.matchAll(/data-inline-key="([^"]+)"/g)].map(m=>({dataset:{inlineKey:m[1]}}))}
 const content={scrollTop:0,querySelector(s:string){
    return s==='#market-sale-results'?grid:s==='[data-market-sale-query]'?search:s==='.market-sale-search-status'?status:
    s==='[data-action="market-sale-clear"]'?button:null
 },contains(){return true}}
 const ctx={...F,farm,document,dialog:{open:true},marketTab:'sell',panel:'market',
  marketSellGroup:group,marketSaleQuery:'',marketSaleFamily:family,marketSaleBrowse:memory,dialogContent:content,
  HTMLInputElement:Search,app:{addEventListener:(key:string,cb:(ev:unknown)=>void)=>listeners.set(key,cb)},closeContextualSale(){},
  fishImage:()=>'',pastryIcons:icons,dishIcons:icons,shellDefinitions,shoalDefinitions,marketSaleFamilies,searchMarketSales,searchMarketSaleView,
  marketInlineCard:(item:{key:string;count:number})=>`<li data-inline-key="${item.key}">${item.count}</li>`,applyIngredientFinishes(){},salePresentation:{},
  marketBulkSaleControls(){return runInNewContext('wholeInventorySaleView()',ctx)?'bulk':''},drawPanel(){runInNewContext('updateMarketSaleSearch()',ctx)}}
 runInNewContext(appSrc,ctx);ctx.drawPanel()
 search.focus({preventScroll:true})
 const pulse=(event:string,text:string,composing=false)=>{
  search.value=text;search.caret=text.length;listeners.get(event)!({target:search,isComposing:composing})
 }
 return {farm,before,ctx,memory,document,search,grid,status,
   type(text:string,composing=false){pulse('input',text,composing)},
   comp(text:string){pulse('compositionend',text)},clear(){runInNewContext(clear,ctx)},
   select(scope:MarketSaleGroup){runInNewContext(`selectMarketSaleGroup('${scope}')`,ctx)},
   keys(){return grid.querySelectorAll().map(row=>row.dataset.inlineKey)},
   bulk(){return Boolean(ctx.marketBulkSaleControls())}}
}

test('known stocked goods appear in one query from another shelf, visibly as search across All and not a changed filter',t=>{
 for(const [group,family,text,known,count] of [
   ['harvest','fruit:pear','радужное яйцо','variants:egg:rainbow',1],
   ['kitchen',undefined,'яблоки','fruit:apple',5],
   ['shore',undefined,'яблочное варенье','dishes:appleJam',1],
 ] as const){
   const s=screen(group,family); assert.ok(!s.keys().includes(known))
   s.grid.scrollTop=87
   s.type(text)
   assert.ok(s.keys().includes(known));assert.equal(s.keys().length,count)
   assert.match(s.status.textContent,/^Поиск · Всё: /)
   assert.match(s.grid.innerHTML,/aria-label="Поиск · Всё"/)
   assert.deepEqual([s.ctx.marketSellGroup,s.ctx.marketSaleFamily],[group,family])
   assert.equal(s.bulk(),false)
   assert.equal(s.document.activeElement,s.search);assert.equal(s.search.caret,text.length)
   t.diagnostic(JSON.stringify({group,family,text,shown:s.keys(),actions:1,oldNeededAlso:'Всё'}))
   s.clear()
   assert.equal(s.search.value,'');assert.equal(s.ctx.marketSaleQuery,'')
   assert.deepEqual([s.ctx.marketSellGroup,s.ctx.marketSaleFamily],[group,family])
   assert.equal(s.grid.scrollTop,87)
   assert.equal(s.bulk(),false)
   assert.equal(s.document.activeElement,s.search);assert.deepEqual(s.farm,s.before)
 }
})

test('positive scoped hits, genuine absence, IME composition and explicit search refinement keep their own scope',()=>{
 const s=screen('kitchen')
 s.type('яблочное варенье');assert.deepEqual(s.keys(),['dishes:appleJam']);assert.doesNotMatch(s.status.textContent,/Всё/)
 s.type('невозможныйпоиск');assert.deepEqual(s.keys(),[]);assert.doesNotMatch(s.status.textContent,/Всё/)
 s.type('яблоки',true);assert.equal(s.ctx.marketSaleQuery,'невозможныйпоиск');assert.deepEqual(s.keys(),[])
 s.comp('яблоки');assert.equal(s.keys().length,5);assert.match(s.status.textContent,/Всё/)
 s.select('shore');assert.deepEqual(s.keys(),[]);assert.doesNotMatch(s.status.textContent,/Всё/)
 s.type('радужное яйцо');assert.deepEqual(s.keys(),[])
 assert.equal(s.bulk(),false)
 s.clear();assert.equal(s.ctx.marketSellGroup,'shore');assert.equal(s.grid.scrollTop,0);assert.deepEqual(s.keys(),['shells:regular'])
 assert.equal(s.document.activeElement,s.search);assert.deepEqual(s.farm,s.before)
})

test('Clear cannot restore a stale origin and an explicit All remains a separate unfiltered choice',()=>{
 const s=screen('harvest','fruit:pear');s.grid.scrollTop=143
 s.type('радужное яйцо');assert.equal(s.bulk(),false)
 const pear=F.getMarketStock(s.farm).find(x=>x.key==='fruit:pear')!
 assert.equal(pear.count,1)
 assert.ok(F.sellMarketItem(s.farm,pear.key,1).ok) // a legitimate external stock change after entering search
 const after=structuredClone(s.farm)
 s.clear();assert.equal(s.grid.scrollTop,0)
 assert.equal(s.ctx.marketSaleFamily,'fruit:pear')
 assert.deepEqual(s.farm,after)
 s.type('радужное яйцо');s.select('all')
 assert.equal(s.bulk(),false,'selecting All while searching is still not an authorization to sell all')
 s.clear();assert.equal(s.ctx.marketSellGroup,'all');assert.equal(s.ctx.marketSaleFamily,undefined)
 assert.equal(s.bulk(),true,'ordinary unfiltered view retains its original available bulk controls, not activated')
 assert.deepEqual(s.farm,after)
})


test('an explicit sale on a cross-shelf hit uses the exact rare product once; searching and a repeat click transfer nothing',()=>{
 const s=screen('harvest','fruit:pear'), f=s.farm, key='variants:egg:rainbow'
 s.type('радужное яйцо');assert.deepEqual(s.keys(),[key]);assert.deepEqual(f,s.before)
 const item=F.getMarketStock(f).find(row=>row.key===key)!
 assert.equal(item.count,1)
 const sales=new MarketInlineSales(), token=sales.view(key,item.count,item.price).token
 const card={dataset:{inlineKey:key,inlineToken:token}}
 let writes=0
 const c={...s.ctx, marketInlineSales:sales, island:{isCrossing:()=>false},
  control:{closest:()=>card},playBaySound(){},
  perform(done:()=>{ok:boolean}) {if(!done().ok)return false;writes++;s.ctx.drawPanel();return true},
  dialogContent:{...s.ctx.dialogContent,querySelectorAll:()=>s.grid.querySelectorAll()}}
 runInNewContext(confirm,c)
 const after=structuredClone(f)
 assert.equal(writes,1)
 assert.equal(f.coins,s.before.coins+item.price)
 assert.equal(f.eggs,s.before.eggs)
 assert.equal(F.getSale(f).items,415)
 assert.deepEqual(s.keys(),[])
 assert.equal(s.document.activeElement,s.search)
 assert.equal(s.bulk(),false)
 runInNewContext(confirm,c)
 assert.equal(writes,1);assert.deepEqual(f,after)
})

test('the earned Sell search keeps a native search field and one named game clear button, without a second cancel adornment',()=>{
 const render=stripTypeScriptTypes(section('function marketCards()','function treeSelector()')+'\nmarketCards()')
 const css=readFileSync(new URL('../src/market-sale-grid.css',import.meta.url),'utf8')
 for(const marketSaleQuery of ['','радужное яйцо']){
  const html:string=runInNewContext(render,{farm:earned,marketTab:'sell',marketSellGroup:'harvest',marketSaleFamily:'fruit:pear',
   marketSaleQuery,numberFormat:new Intl.NumberFormat('ru-RU'),getSale:F.getSale,quantity:()=>'',icon:()=>'',panelTabs:()=>'',
   button:(label:string,action:string,enabled=true)=>`<button type="button" data-action="${action}"${enabled?'':' disabled'}>${label}</button>`,
   nav:()=>'',escapeHtml:(v:string)=>v,marketBulkSaleControls:()=>'',marketFamilyOptions:()=>'',marketSaleSearchStatus:()=>'',marketSaleResults:()=>''})
  const search=html.match(/<div class="market-sale-search">([\s\S]*?)<\/div>/)?.[1]??''
  assert.match(search,/<input\b[^>]*data-market-sale-query\s+type="search"/)
  const close=[...search.matchAll(/<button\b([^>]*data-action="market-sale-clear"[^>]*)>([^<]*(?:<span[^>]*>[^<]*<\/span>[^<]*)*)<\/button>/g)]
  assert.equal(close.length,1)
  const [,attrs,inside]=close[0]
  assert.match(attrs,/\baria-label="Очистить"/,'the existing game Clear has one explicit accessible name')
  assert.equal(/\bdisabled\b/.test(attrs),marketSaleQuery==='')
  assert.equal(inside,'<span aria-hidden="true">×</span>','the one game cross is decorative, not part of the name')
 }
 assert.deepEqual([...css.matchAll(/^([^{}\n]*::-webkit-search-cancel-button)\s*\{([^}]*)\}/gm)].map(([,selector,rule])=>[selector.trim(),rule.trim()]),
  [['[data-market-sale-browser] .market-sale-search input[data-market-sale-query]::-webkit-search-cancel-button','display:none']])
 assert.match(css,/\[data-market-sale-browser\] \[data-action=market-sale-clear\]\s*\{[^}]*min-width:44px;min-height:44px/)
 assert.doesNotMatch(css,/\[data-action=market-sale-clear\]::after/)
})
