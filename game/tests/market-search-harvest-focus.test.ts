import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { runInNewContext } from 'node:vm'
import * as F from '../src/farm.ts'
import { bedWorkKind, isCurrentBedWork, planBedWork } from '../src/bed-work-intent.ts'
import { searchMarketSales } from '../src/market-sale-search.ts'

const read=(file:string)=>readFileSync(new URL('../src/'+file,import.meta.url),'utf8')
const main=read('main.ts'), island=read('island.ts')
function part(s:string,a:string,b:string){const start=s.indexOf(a),end=s.indexOf(b,start+1);assert.ok(start>=0&&end>start);return s.slice(start,end)}
const script=stripTypeScriptTypes([
  part(main,'function marketCards(', 'function treeSelector('),
  part(main,'function refresh()', 'const bedTools ='),
  part(main,'function activateTarget(', '  island.visit(target)\n  switch')+'}',
  part(island,'  function advanceWork(', '  function paintBursts('),
  part(island,'    setViewMode(', '    guideHomeVisitorToBed(').trim().replace(/^setViewMode/,'function setViewMode').replace(/,$/,''),
  part(main,"app.addEventListener('input', event => {", "app.addEventListener('keydown', event => {"),
  'function drawPanel(){'+part(main,'  dialogEmblem.src = iconUrl(panel', '  switch (panel) {').split('\n').slice(1).join('\n')+
    "switch(panel){"+part(main,"    case 'market':\n      dialogContent.innerHTML = marketCards()", "    case 'berry-renewal':")+"}"+
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
  const frames:unknown[]=[],saves:typeof farm[]=[],silent=()=>{},rows={innerHTML:''}
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
  const ctx:any={...F,farm,dialog:{open:false},panel:undefined,marketTab:'sell',marketSellGroup:'harvest',marketSaleQuery:'',marketSaleFamily:undefined,dialogContent,document,
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
