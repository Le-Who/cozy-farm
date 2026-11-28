import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import {runInNewContext} from 'node:vm'
import * as F from '../src/farm.ts'
import {ActivationKeyGuard} from '../src/action-click-guard.ts'
import {MarketInlineSales,inlineReceiptText} from '../src/market-inline-sale.ts'
import {ruPlural} from '../src/ru.ts'
import {shellDefinitions} from '../src/tide.ts'
import {shoalDefinitions} from '../src/shoal.ts'
import {earned416Mixed} from './fixtures/earned-416-market-orders.ts'
import {commissionPlayer} from './fixtures/commission-player.ts'

const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
const part=(start:string,end:string,at=0)=>{
 const first=main.indexOf(start,at),last=main.indexOf(end,first+start.length)
 assert.ok(first>=0&&last>first,start);return main.slice(first,last)
}
const page=stripTypeScriptTypes(part('const dishIcons:', 'const communityArt:')+
 part('function quantity(','function row(')+part('function goods()','function firstGroveCatchOrder()')+
 part('function stockLabel(','function stockTile(')+part('function marketInlineCard(','function marketSaleResults(')+
 part('function inlineSaleContext(','function updateMarketSaleSearch(')+
 part("app.addEventListener('keydown', event => {\n  if(!event.defaultPrevented", "app.addEventListener('keydown',event=>{if(event.key==='Enter'")+
 `function edit(event){${part("  if(event.target instanceof HTMLInputElement&&event.target.matches('[data-inline-quantity]'))", "  if (event.target instanceof HTMLInputElement && event.target.matches('[data-recipe-query]'))")}}
 function click(event,control){switch('inline-sale-confirm'){${part("    case 'inline-sale-confirm':","    case 'inline-sale-again':")}}}
 ({edit, click, render:()=>marketInlineCard(goods().find(row=>row.key===key))})`)
const raw=(farm:F.FarmState)=>JSON.stringify(farm)
function mount(farm:F.FarmState,key='fruit:apple'){
 const writes:string[]=[],focusMoves:string[]=[]
 const doc:{activeElement:object|null}={activeElement:null}
 class Input {
  value='1';max='';disabled=false
  matches(selector:string){return selector==='[data-inline-quantity]'}
  closest(selector:string){assert.equal(selector,'[data-inline-key]');return card}
  focus(){doc.activeElement=this}
 }
 const input=new Input()
 const sell={closest(selector:string){assert.equal(selector,'[data-inline-key]');return card},dataset:{action:'inline-sale-confirm'},disabled:false,innerHTML:'',name:'',
   setAttribute(k:string,v:string){assert.equal(k,'aria-label');this.name=v},
   focus(){doc.activeElement=this;focusMoves.push(this.name)},scrollIntoView(){}}
 const status={ariaLive:'',textContent:''}
 const grid={scrollTop:14}
 const card={dataset:{inlineKey:key,inlineToken:''},closest(selector:string){assert.equal(selector,'[data-inline-key]');return card},
  querySelectorAll:()=>[],
  querySelector(select:string){
   if(select==='[data-inline-quantity]')return input
   if(select==='.market-inline-sell')return sell
   if(select.includes('inline-sale-confirm')&&!sell.disabled&&sell.dataset.action==='inline-sale-confirm')return sell
   if(select==='.market-inline-status')return status
   return null
  }}
 const goods=()=>F.getMarketStock(farm), item=goods().find(row=>row.key===key)!
 const marketInlineSales=new MarketInlineSales(()=>farm)
 card.dataset.inlineToken=marketInlineSales.view(key,item.count,item.price).token
 let dispatch:(e:unknown)=>void=()=>{throw Error('missing source listener')}
 const ctx={
  ...F,shellDefinitions,shoalDefinitions,farm,key,marketInlineSales,inlineReceiptText,ruPlural,numberFormat:new Intl.NumberFormat('ru-RU'),itemIcon:()=>'',icon:()=>'',escapeHtml:String,pastryIcons:{},
  document:doc,HTMLInputElement:Input,app:{addEventListener(name:string,cb:typeof dispatch){assert.equal(name,'keydown');dispatch=cb}},
  dialog:{open:true},panel:'market',marketTab:'sell',marketSellGroup:'all',island:{isCrossing:()=>false},
  dialogContent:{contains(x:unknown){return x===card||x===input||x===sell},
    querySelector:(s:string)=>s==='#market-sale-results'?grid:null,querySelectorAll:()=>goods().find(row=>row.key===key)?.count?[card]:[]},
  perform(action:()=>F.ActionResult){const ok=action().ok;if(ok)writes.push(raw(farm));return ok},playBaySound(){}
 }
 const api=runInNewContext(page,ctx)
 const keys=new ActivationKeyGuard()
 function keyboard(repeat=false, isComposing=false) {
  const target=doc.activeElement
  const event={key:'Enter',target,repeat,isComposing,defaultPrevented:false,preventDefault(){this.defaultPrevented=true}}
  if(keys.blocks(event,target===input||target===sell))return
  dispatch(event)
  if(target===sell&&!sell.disabled&&!event.defaultPrevented)api.click({detail:0},sell)
 }
 function edit(value:string){input.focus();input.value=value;api.edit({target:input})}
 return {writes,focusMoves,doc,input,sell,card,status,api,keyboard,edit,release:()=>keys.release('Enter'),
   current:()=>goods().find(row=>row.key===key)!,quote:()=>{const r=goods().find(row=>row.key===key)!;return marketInlineSales.view(key,r.count,r.price).quote}}
}
const ordinary='fruit:apple'
for(const kind of ['mature','first'] as const)test(`earned ${kind} inline number Enter only reviews the exact row; a second released activation makes one sale`,t=>{
 const p=kind==='mature'?earned416Mixed():commissionPlayer([])
 if(kind==='first')p.act('pickFruit',0)
 const f=p.state,before=raw(f),m=mount(f)
 const units=kind==='mature'?315:2, coins=f.coins, price=m.current().price
 assert.deepEqual([f.day,p.actions,m.current().count,price],kind==='mature'?[196,552,315,4]:[1,1,2,4])
 assert.match(m.api.render(),/aria-label="Количество: Яблоко"[^>]*aria-describedby=/)
 m.edit(String(units))
 assert.deepEqual(m.quote(),{valid:true,quantity:units,remaining:0,total:units*price})
 assert.equal(raw(f),before);assert.equal(m.writes.length,0)
 const quoted=m.sell.name
 m.keyboard()
 t.diagnostic(JSON.stringify({kind,day:f.day,actions:p.actions,count:units,unitPrice:price,
  quote:units*price,beforeCoins:coins,postInputEnterCoins:f.coins,postInputEnterApples:f.fruit.apple,postInputEnterWrites:m.writes.length}))
 assert.ok(raw(f)===before,'ending number entry must not perform a sale')
 assert.equal(m.writes.length,0);assert.equal(m.doc.activeElement,m.sell)
 assert.equal(m.focusMoves.at(-1),quoted)
 for(let i=0;i<4;i++)m.keyboard(true)
 assert.ok(raw(f)===before,'held original Enter must not become a second gesture once focus reaches Sell')
 m.release();m.keyboard();m.release()
 const expected=JSON.parse(before)
 assert.ok(F.sellMarketItem(expected,ordinary,units).ok)
 assert.equal(m.writes.length,1)
 assert.equal(f.fruit.apple,0)
 assert.deepEqual(f,expected)
 assert.deepEqual(F.restoreCurrentFarm(JSON.parse(raw(f))),f)
})

test('invalid and cleared quantity stays on input without a write, while singleton Sell remains one real gesture',()=>{
 const p=commissionPlayer([]);p.act('pickFruit',0);p.act('collectEggs')
 const f=p.state,before=raw(f),m=mount(f)
 for(const value of ['','0','3','1.5']) {
  m.edit(value);assert.equal(m.sell.disabled,true);assert.match(m.status.textContent,/от 1 до 2/)
  m.keyboard();m.release()
  assert.equal(m.doc.activeElement,m.input);assert.equal(raw(f),before)
 }
 const egg=mount(f,'eggs')
 assert.doesNotMatch(egg.api.render(),/data-inline-quantity/)
 egg.sell.focus();egg.keyboard();egg.release()
 assert.equal(egg.writes.length,1);assert.equal(f.eggs,0);assert.equal(f.fruit.apple,2)
})

test('stale stock does not focus an old payable quote or repair the amount behind the user',()=>{
 const p=commissionPlayer([]);p.act('pickFruit',0)
 const f=p.state,m=mount(f)
 m.edit('2');assert.equal(m.sell.disabled,false)
 p.act('sellMarketItem',ordinary,1)
 // The current live controller can be one paint behind; bring the real row snapshot along.
 Object.assign(f,p.state)
 const changed=raw(f)
 m.keyboard();m.release()
 assert.equal(m.writes.length,0);assert.equal(raw(f),changed)
 assert.equal(m.doc.activeElement,m.input);assert.equal(m.input.value,'2')
 assert.equal(m.sell.disabled,true)
})
