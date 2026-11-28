import A from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import {runInNewContext} from 'node:vm'
import * as F from '../src/farm.ts'
import {ruPlural} from '../src/ru.ts'
import {shellDefinitions} from '../src/tide.ts'
import {shoalDefinitions} from '../src/shoal.ts'
import {saleStock,exactSaleQuote,type SaleTarget} from '../src/exact-sale.ts'
import {SalePresentation} from '../src/sale-presentation.ts'
import {ActivationKeyGuard,isGuardedAction} from '../src/action-click-guard.ts'
import {earned416Mixed} from './fixtures/earned-416-market-orders.ts'
import {earnedRecipeBookPlayer} from './fixtures/earned-recipe-book.ts'

const read=(p:string)=>readFileSync(new URL(p,import.meta.url),'utf8')
const main=read('../src/main.ts')
function part(a:string,b:string) {
  const i=main.indexOf(a),j=main.indexOf(b,i+a.length);A.ok(i>=0&&j>i,a)
  return main.slice(i,j)
}
function line(value:string){const row=main.split('\n').find(row=>row.trimStart().startsWith(value));A.ok(row,value);return row}
const js=stripTypeScriptTypes([
  part('function button(','function panelTabs('),
  part('function goods()','function inventorySupplies()'),
  part('function stockLabel(','function stockTile('),
  part('function exactSaleCard(','let disposeCoopServices:'),
  part("app.addEventListener('input', event => {","app.addEventListener('keydown',event=>{if(event.key==='Enter'"),
  `function act(action,value,control,event){switch(action){${line("case 'sell-item':")}\n${line("case 'sell-signature':")}\n${line("case 'confirm-sale':")}}}`,
].join('\n'))
const old=Date.now;Date.now=()=>1795852800000
const p=earned416Mixed()
A.deepEqual([p.actions,p.state.day,p.state.island,p.state.coins,F.getSale(p.state).items],[552,196,'home',60,416])
while(p.state.fish.perch<2) {
  A.ok(F.getFishAction(p.state).available,'D196 ordinary fisheries remaining')
  p.act('catchFish',true)
}
const book=earnedRecipeBookPlayer(),recipe=book.state.culinary.recipes[0]
book.fruit('apple',recipe.ingredients[0].quantity);book.visit('home');book.act('repeatSignature',recipe.id)
Date.now=old
A.ok(book.state.culinary.stock[recipe.id]>=2)
const art={icon:()=>'',stock:()=>''}
A.match(read('../src/culinary-ui.ts'),/farm\.island==='home'\?control\('Продать…','sell-signature',recipe\.id,count>0\)/)
A.equal(book.state.island,'home')
const close=({preventScroll}:{preventScroll:boolean})=>A.equal(preventScroll,true)
function harness(farm:F.FarmState,target:SaleTarget, origin:'inventory'|'recipes'){
  const writes:F.FarmState[]=[], gestures=new ActivationKeyGuard(), listeners=new Map<string,(event:any)=>void>()
  let ctx:any
  const document={activeElement:null as SaleInput|Button|null}
  const card={dataset:{saleToken:''}}
  class SaleInput {
    value='1'
    matches(selector:string){return selector==='[data-sale-quantity]'}
    closest(selector:string){A.equal(selector,'.exact-sale');return card}
    focus(options:{preventScroll:boolean}){close(options);document.activeElement=this}
  }
  class Button {
    disabled=false
    data:Record<string,string>={}
    textContent=''
    readonly action:string;constructor(action:string){this.action=action}
    closest(selector:string){A.equal(selector,'.exact-sale');return card}
    setAttribute(key:string,value:string){this.data[key]=value}
    focus(options:{preventScroll:boolean}){close(options);document.activeElement=this}
    scrollIntoView(){}
    click(detail=0){if(!this.disabled)ctx.act(this.action,undefined,this,{detail})}
  }
  const input=new SaleInput(), confirm=new Button('confirm-sale'), receipt=new Button('receipt')
  const whitespace=(x:string)=>x
  const summary={textContent:''},key=target.key,scene={open:true}, SaleRoot={html:''}
  const dialogContent={
    scrollTop:0, contains:(obj:unknown)=>obj===input||obj===confirm||obj===receipt,
    querySelector(sel:string){
      if(sel==='.exact-sale h2')return {focus:close}
      if(sel==='.exact-sale-summary')return summary
      if(sel==='.exact-sale-receipt')return receipt
      if(sel==='[data-action="confirm-sale"]')return confirm
      if(sel==='[data-action="confirm-sale"]:not(:disabled)')return confirm.disabled?null:confirm
      return null
    },
    querySelectorAll(){return []},
  }
  ctx={...F,farm,document,dialog:scene,dialogContent,HTMLInputElement:SaleInput,marketTab:'sell',panel:origin,panelHistory:[],
    app:{addEventListener:(which:string,fn:(event:any)=>void)=>listeners.set(which,fn)},
    island:{isCrossing:()=>false},marketSaleBrowse:{},numberFormat:new Intl.NumberFormat('ru-RU'),ruPlural,
    icon:art.icon,itemIcon:art.icon,signatureResultPicture:art.icon,escapeHtml:whitespace,shellDefinitions,shoalDefinitions,
    dishIcons:{},pastryIcons:{},saleStock,exactSaleQuote,
    salePresentation:new SalePresentation(),selectedSale:undefined,saleReceipt:undefined,saleQuantity:'1',playBaySound(){},
    openPanel(next:string){ctx.panelHistory.push({panel:ctx.panel});ctx.panel=next;card.dataset.saleToken=ctx.salePresentation.token;paint()},
    perform(done:()=>F.ActionResult){const result=done();if(!result.ok)return false
      A.deepEqual(F.restoreCurrentFarm(structuredClone(farm)),farm)
      writes.push(structuredClone(farm));paint();return true
    }
  }
  function paint(){SaleRoot.html=ctx.exactSaleCard(false);ctx.updateSaleQuote()}
  runInNewContext(js,ctx)
  if(target.kind==='market'){
    const row=ctx.inventoryStockRow(ctx.goods().find((row:{key:string})=>row.key===key))
    A.match(row,/data-action="sell-item"[\s\S]*?data-value="fish:perch"/)
  }
  ctx.act(target.kind==='market'?'sell-item':'sell-signature',key,{}, {detail:1})
  A.deepEqual([ctx.panel,ctx.panelHistory.at(-1).panel,ctx.selectedSale.key,ctx.saleQuantity],['sale',origin,key,'1'])
  A.match(SaleRoot.html,/data-sale-quantity type="number"/)
  A.match(SaleRoot.html,/data-action="confirm-sale"/)
  A.equal(writes.length,0)
  input.focus({preventScroll:true})
  const type=(value:string)=>{input.value=value;listeners.get('input')!({target:input})}
  const keyDown=({composing=false,repeat=false,keyCode=13}={})=>{
    const target=document.activeElement
    const event={target,key:'Enter',keyCode,isComposing:composing,repeat,defaultPrevented:false,
      preventDefault(){this.defaultPrevented=true}}
    if(gestures.blocks(event,target===input||target instanceof Button&&isGuardedAction(target.action)))return
    listeners.get('keydown')!(event)
    if(!event.defaultPrevented&&!composing&&keyCode!==229&&target instanceof Button)target.click()
  }
  return {ctx,farm,confirm,input,writes,document,summary,type,keyDown,release:()=>gestures.release('Enter')}
}
for(const [origin,seed,target] of [
 ['inventory',p.state,{kind:'market',key:'fish:perch'}],
 ['recipes',book.state,{kind:'signature',key:recipe.id}]
] as const) {
 test(`earned ${origin} edit Enter focuses the existing quote; deliberate next activation sells exactly once`,t=>{
  const farm=structuredClone(seed),stock=saleStock(farm,target)!
  const expected=structuredClone(farm)
  A.ok((target.kind==='market'?F.sellMarketItem(expected,target.key,2):F.sellSignature(expected,target.key,2)).ok)
  const s=harness(farm,target,origin),before=structuredClone(farm)
  s.type('2');A.match(s.summary.textContent,new RegExp(String(stock.price*2)))
  const priced=s.confirm.textContent
  s.keyDown()
  t.diagnostic(JSON.stringify({origin,day:before.day,rows:F.getMarketStock(before).filter(x=>x.count).length,
    item:target.key,stock:stock.count,coins:before.coins,resultCoins:s.farm.coins,price:stock.price,priced,writesAfterFirstEnter:s.writes.length}))
  A.equal(s.writes.length,0,'a quantity edit does not authorize sale via an indirect .click()')
  A.deepEqual(farm,before)
  A.equal(s.document.activeElement,s.confirm)
  s.keyDown({repeat:true});A.deepEqual(farm,before)
  s.release();s.keyDown()
  A.equal(s.writes.length,1);A.deepEqual(farm,expected)
  s.keyDown({repeat:true});s.release()
  A.equal(s.writes.length,1);A.deepEqual(farm,expected)
 })
}

test('cleared, invalid, composing, blur and disabled exact quotes never commit',()=>{
 const farm=structuredClone(p.state),target={kind:'market',key:'fish:perch'} as const
 const s=harness(farm,target,'inventory'),before=structuredClone(farm)
 for(const value of ['','0','2.5','9999']){
  s.type(value);A.equal(s.confirm.disabled,true);s.keyDown();s.release()
  A.equal(s.document.activeElement,s.input);A.deepEqual(farm,before)
 }
 s.type('1')
 s.keyDown({composing:true});s.release()
 A.equal(s.document.activeElement,s.input);A.deepEqual(farm,before)
 s.keyDown({keyCode:229});s.release()
 A.equal(s.document.activeElement,s.input);A.deepEqual(farm,before)
 s.document.activeElement=null
 s.keyDown();s.release()
 A.equal(s.writes.length,0);A.deepEqual(farm,before)
 s.confirm.click(1)
 A.equal(s.writes.length,1)
 const after=structuredClone(farm);A.ok(F.sellMarketItem(before,target.key,1).ok);A.deepEqual(after,before)
})
