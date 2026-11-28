import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { runInNewContext } from 'node:vm'
import * as F from '../src/farm.ts'
import { bedWorkKind, isCurrentBedWork, planBedWork } from '../src/bed-work-intent.ts'
import { searchMarketSales, searchMarketSaleView } from '../src/market-sale-search.ts'

import { MarketSaleBrowseMemory } from '../src/market-sale-browse.ts'

const read=(file:string)=>readFileSync(new URL('../src/'+file,import.meta.url),'utf8')
const main=read('main.ts'), island=read('island.ts')
function part(s:string,a:string,b:string){const start=s.indexOf(a),end=s.indexOf(b,start+1);assert.ok(start>=0&&end>start);return s.slice(start,end)}
const script=stripTypeScriptTypes([
  part(main,'function marketCards(', 'function treeSelector('),
  part(main,'function marketSellView()', 'function rememberClosedMarketSell()'),
  part(main,'function setMarketSaleQuery(', 'function marketSaleSearchView()'),
  part(main,'function refresh()', 'const bedTools ='),
  part(main,'function activateTarget(', '  island.visit(target)\n  switch')+'}',
  part(island,'  function advanceWork(', '  function paintBursts('),
  part(island,'    setViewMode(', '    guideHomeVisitorToBed(').trim().replace(/^setViewMode/,'function setViewMode').replace(/,$/,''),
  part(main,"app.addEventListener('input', event => {", "app.addEventListener('keydown', event => {"),
  'function drawPanel(){'+part(main,'  dialogEmblem.src = iconUrl(panel', '  switch (panel) {').split('\n').slice(1).join('\n')+
    "switch(panel){"+part(main,"    case 'market':\n      dialogContent.innerHTML", "    case 'berry-renewal':")+"}"+
    part(main,'  applyIngredientFinishes(dialogContent)', '\n}\n\n// A map shortcut')+'}',
].join('\n'))

test('a queued harvest updates the normal Sell results without taking focus from its search',()=>{
  const farm=F.createFarm();assert.ok(F.pickFruit(farm,0).ok)
  const before=structuredClone(farm),expected=structuredClone(farm);assert.ok(F.workBed(expected,9).ok);assert.ok(expected.produce.carrot>0)
  const document={activeElement:null as Input|null}
  class Input {
    value='';selectionStart:number|null=0;selectionEnd:number|null=0
    selectionDirection:'none'|'forward'|'backward'|null='none'
    matches(selector:string){return selector==='[data-market-sale-query]'}
    focus({preventScroll}:{preventScroll:boolean}){assert.equal(preventScroll,true);document.activeElement=this}
    setSelectionRange(a:number,b:number,d:'none'|'forward'|'backward'='none'){this.selectionStart=a;this.selectionEnd=b;this.selectionDirection=d}
  }
  const frames:unknown[]=[],saves:typeof farm[]=[],silent=()=>{},rows={innerHTML:'',scrollTop:0,querySelectorAll:()=>[]}
  let input:Input|null=null,markup=''
  const dialogContent={
    contains:(element:unknown)=>input!==null&&element===input,querySelectorAll:()=>[],
    querySelector(selector:string){return selector==='[data-market-sale-query]'?input:selector==='#market-sale-results'?rows:null},
    set innerHTML(text:string){
      markup=text; document.activeElement=null
      const value=text.match(/data-market-sale-query[^>]*value="([^"]*)"/)?.[1]
      input=value===undefined?null:new Input()
      if(input)input.value=value!
    },
  }
  const ctx:any={...F,farm,dialog:{open:false},panel:undefined,marketTab:'sell',marketSellGroup:'harvest',marketSaleQuery:'',marketSaleFamily:undefined,marketSaleBrowse:new MarketSaleBrowseMemory(),dialogContent,document,
    HTMLInputElement:Input,HTMLButtonElement:class{},HTMLSelectElement:class{},salePresentation:{},app:{addEventListener:(name:string,handler:Function)=>{assert.equal(name,'input');ctx.type=handler}},
    bedWorkKind,planBedWork,isCurrentBedWork,bedWorkSound:silent,bayAudio:{primeEvents:silent},playBaySound:silent,
    viewMode:'world',reconcileFrames:silent,farmer:{x:0,y:0},state:farm,workOrders:frames,gesture:undefined,areas:Array(21).fill({center:{x:0,y:0},stop:{x:0,y:0}}),
    WORK_MS:{harvest:200},bursts:[],impactByBed:new Map(),island:{isCrossing:()=>false,render:silent,workBed(index:number,next:Function,commit:Function){frames.push({index,next,commit})}},
    numberFormat:new Intl.NumberFormat('ru'),quantity:String,icon:()=>'',itemIcon:()=>'',panelTabs:()=>'',escapeHtml:String,button:()=>'',nav:()=>'',marketFamilyOptions:()=>'',marketSaleSearchStatus:()=>'',marketBulkSaleControls:()=>'',
    marketSaleResults(){return searchMarketSales(F.getMarketStock(farm).map(o=>({...o,group:'harvest',name:o.key==='produce:carrot'?'Морковь':'Яблоко'})),ctx.marketSellGroup,ctx.marketSaleQuery).items.map(x=>x.key).join(',')},
    closeContextualSale:silent,updateMarketSaleSearch(){rows.innerHTML=ctx.marketSaleResults()},resetMarketSaleBrowsePosition:silent,applyIngredientFinishes:silent,
    status:silent,saveFarm(){saves.push(structuredClone(farm))},dialogFeedback:{classList:{toggle:silent},dataset:{}},dialogFeedbackTimer:0,window:{clearTimeout:silent,setTimeout(){return 1}},
  }
  runInNewContext(script,ctx)
  ctx.activateTarget({kind:'bed',index:9});assert.equal(frames.length,1);ctx.advanceWork(0,false)
  ctx.setViewMode('dialog');assert.equal(ctx.gesture.kind,'harvest')
  ctx.panel='market';ctx.dialog.open=true;ctx.drawPanel()
  const old=input as Input|null;assert.ok(old)
  old.focus({preventScroll:true});old.value='морк';old.setSelectionRange(1,3,'backward')
  ctx.type({target:old})
  assert.equal(ctx.marketSaleQuery,'морк');assert.equal(rows.innerHTML,'')
  assert.deepEqual(farm,before);assert.deepEqual(saves,[])
  ctx.advanceWork(120,false)
  assert.match(markup,/id="market-sale-results">produce:carrot<\/div>/)
  assert.equal(ctx.marketSellGroup,'harvest');assert.equal(ctx.marketSaleQuery,'морк')
  assert.deepEqual(farm,expected);assert.deepEqual(saves,[expected])
  const replacement=input as Input|null;assert.ok(replacement);assert.notEqual(replacement,old)
  assert.equal(document.activeElement,replacement,'keep typing in the market search after the stock redraw')
  assert.equal(replacement.value,'морк')
  assert.deepEqual([replacement.selectionStart,replacement.selectionEnd,replacement.selectionDirection],[1,3,'backward'])
  replacement.value='морковь';ctx.type({target:replacement});assert.equal(rows.innerHTML,'produce:carrot')
  assert.deepEqual(saves,[expected],'a search update never performs a second action')
})

test('a newly stocked row must not push an edited quantity and its current quote out of the visible sale grid',async()=>{
  const {MarketInlineSales,inlineReceiptText}=await import('../src/market-inline-sale.ts')
  const saleCode=stripTypeScriptTypes(part(main,'function marketSaleSearchView()', 'function marketSaleSearchStatus()')+part(main,'function marketInlineCard(', 'function confirmInlineSale('))
  const farm=F.createFarm(),key='fruit:apple'
  assert.ok(F.workBed(farm,3).ok);assert.ok(F.pickFruit(farm,0).ok)
  assert.equal(farm.produce.carrot,0)
  const before=structuredClone(farm),expected=structuredClone(farm);assert.ok(F.workBed(expected,9).ok)
  const document={activeElement:null as Input|null},marketInlineSales=new MarketInlineSales(),saves:typeof farm[]=[]
  const gridTop=270,viewport=144,rowStride=190
  let grid:{scrollTop:number;getBoundingClientRect():{top:number}}|null=null, cards:Card[]=[]
  class Input {
    value:string;disabled=false
    constructor(readonlyCard:Card,value:string){this.card=readonlyCard;this.value=value}
    card:Card
    matches(s:string){return s==='[data-inline-quantity]'}
    closest(s:string){return s==='[data-inline-key]'?this.card:null}
    focus({preventScroll}:{preventScroll:boolean}){assert.equal(preventScroll,true);document.activeElement=this}
    getBoundingClientRect(){return {top:gridTop+cards.indexOf(this.card)*rowStride+95-grid!.scrollTop}}
  }
  class Card {
    dataset:{inlineKey:string;inlineToken:string};input:Input
    status={textContent:''};sale={dataset:{action:''},innerHTML:'',setAttribute(){},disabled:false}
    constructor(key:string,token:string,raw:string){this.dataset={inlineKey:key,inlineToken:token};this.input=new Input(this,raw)}
    querySelector(s:string){return s.startsWith('[data-inline-quantity]')?this.input:s==='.market-inline-sell'?this.sale:this.status}
    querySelectorAll(){return []}
    closest(){return this}
  }
  const goods=()=>F.getMarketStock(farm).map(row=>({...row,group:'harvest',name:row.key===key?'Яблоко':row.key,image:''}))
  const encode=(s:string)=>s.replaceAll('"','&quot;')
  const rows=()=>searchMarketSales(goods(),'harvest','').items
  const activeCard=()=>cards.find(c=>c.dataset.inlineKey===key)!
  const dialogContent={
    contains:(el:unknown)=>cards.some(c=>c===el||c.input===el),
    querySelectorAll:(selector:string)=>selector==='[data-inline-key]'?cards:[],
    querySelector:(s:string)=>s==='#market-sale-results'?grid:null,
    set innerHTML(text:string) {
      document.activeElement=null
      grid={scrollTop:0,getBoundingClientRect:()=>({top:gridTop})}
      cards=[...text.matchAll(/data-inline-key="([^"]+)" data-inline-token="([^"]+)">([\s\S]*?)<\/li>/g)].filter(m=>m[3].includes('data-inline-quantity'))
        .map(([,product,token,body])=>new Card(product,token.replaceAll('&quot;','"'),body.match(/data-inline-quantity[^>]*value="([^"]*)"/)![1]))
    },
  }
  const workOrders:unknown[]=[],silent=()=>{}
  const ctx:any={
    ...F,farm,dialog:{open:false},panel:undefined,marketTab:'sell',marketSellGroup:'harvest',marketSaleQuery:'',marketSaleFamily:undefined,marketSaleBrowse:new MarketSaleBrowseMemory(),dialogContent,document,
    HTMLInputElement:Input,HTMLButtonElement:class{},HTMLSelectElement:class{},salePresentation:{},app:{addEventListener:(name:string,fn:Function)=>{assert.equal(name,'input');ctx.type=fn}},
    marketInlineSales,inlineReceiptText,goods,searchMarketSales,searchMarketSaleView,bedWorkKind,planBedWork,isCurrentBedWork,bedWorkSound:silent,bayAudio:{primeEvents:silent},playBaySound:silent,
    viewMode:'world',reconcileFrames:silent,farmer:{x:0,y:0},state:farm,workOrders,gesture:undefined,areas:Array(21).fill({center:{x:0,y:0},stop:{x:0,y:0}}),
    WORK_MS:{harvest:200},bursts:[],impactByBed:new Map(),island:{isCrossing:()=>false,render:silent,workBed(index:number,next:Function,commit:Function){workOrders.push({index,next,commit})}},
    numberFormat:new Intl.NumberFormat('ru'),quantity:String,icon:()=>'',itemIcon:()=>'',panelTabs:()=>'',escapeHtml:encode,button:()=>'',nav:()=>'',marketFamilyOptions:()=>'',marketSaleSearchStatus:()=>'',marketBulkSaleControls:()=>'',applyIngredientFinishes:silent,
    status:silent,saveFarm(){saves.push(structuredClone(farm))},dialogFeedback:{classList:{toggle:silent},dataset:{}},dialogFeedbackTimer:0,window:{clearTimeout:silent,setTimeout(){return 1}},
  }
  runInNewContext(saleCode+'\n'+script,ctx)
  ctx.activateTarget({kind:'bed',index:9});ctx.advanceWork(0,false)
  ctx.setViewMode('dialog');assert.equal(ctx.gesture.kind,'harvest')
  ctx.panel='market';ctx.dialog.open=true;ctx.drawPanel()
  const previous=activeCard(),oldIndex=cards.indexOf(previous)
  assert.ok(oldIndex>0,'the apple editor begins below another stocked row')
  grid!.scrollTop=oldIndex*rowStride+43
  const y=previous.input.getBoundingClientRect().top
  assert.ok(y>=gridTop&&y<gridTop+viewport)
  previous.input.focus({preventScroll:true});previous.input.value='2';ctx.type({target:previous.input})
  assert.match(previous.sale.innerHTML,/Продать 2 · 8/);assert.deepEqual(farm,before)
  ctx.advanceWork(120,false)
  const next=activeCard()
  assert.ok(rows().some(row=>row.key==='produce:carrot'));assert.ok(cards.indexOf(next)>oldIndex,'the incoming crop inserts a row ahead of the apples')
  assert.equal(next.input.value,'2');assert.equal(document.activeElement,next.input)
  assert.deepEqual(farm,expected);assert.deepEqual(saves,[expected])
  assert.equal(next.input.getBoundingClientRect().top,y,'the still-focused amount and its quote must stay in view')
  next.input.value='1';ctx.type({target:next.input})
  assert.match(next.sale.innerHTML,/Продать 1 · 4/)
  assert.deepEqual(saves,[expected],'editing again still does not transact')
})
