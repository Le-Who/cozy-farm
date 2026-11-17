import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import {runInNewContext} from 'node:vm'
import * as F from '../src/farm.ts'
import * as C from '../src/shop-commissions.ts'
import {renderShopCommissions} from '../src/shop-commissions-ui.ts'
import {ActivationKeyGuard} from '../src/action-click-guard.ts'
import {commissionPlayer} from './fixtures/commission-player.ts'
import {assortmentPlayer} from './fixtures/assortment-player.ts'

const source=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
const start=source.indexOf("    case 'commission-deliver':"),end=source.indexOf("    case 'commission-cancel':",start)
assert.ok(start>0&&end>start)
const actualHandler=stripTypeScriptTypes(`switch(action){${source.slice(start,end)}}`)
const focusStart=source.indexOf("  if (focused && panel !== 'bay-freight' && panel !== 'recipes')"),focusEnd=source.indexOf('\n}\n\n// A map shortcut',focusStart)
const focusKey=source.slice(source.indexOf('function focusKey('),source.indexOf('\nfunction leaveScene'))
const actualRecovery=stripTypeScriptTypes(focusKey+'\n'+source.slice(focusStart,focusEnd))
const opening=JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json',import.meta.url),'utf8'))
const p=commissionPlayer(opening.slice(0,78)),id=p.cook();p.shelf(id);p.sale();p.cook(id);p.cook(id)
p.act('acceptShopCommission',C.getShopCommissionOffers(p.state).find(o=>o.customer==='bea')!.key)
const accepted=structuredClone(p.state),single=structuredClone(accepted)
assert.ok(C.deliverShopCommission(single,String(single.shopCommissions.serial)).ok)
let mixed: F.FarmState | undefined
function mixedFixture(){
  if(!mixed){
    const a=assortmentPlayer(opening)
    for(const [base,id] of [['preserves',a.jam],['tart',a.tart]] as const)for(let i=0;i<2;i++)a.cook(base,id)
    a.p.act('acceptShopCommission',C.getShopAssortment(a.p.state,'bea',a.jam,a.tart)!.key)
    mixed=structuredClone(a.p.state)
  }
  return structuredClone(mixed)
}
const render=(farm:F.FarmState)=>renderShopCommissions(farm,()=>'<img alt="">')
function harness(input:F.FarmState,options:{value?:string;detail?:number;owned?:boolean;panel?:string;open?:boolean}={}){
  const farm=structuredClone(input),effects:string[]=[],writes:F.FarmState[]=[]
  class Element {
    dataset:Record<string,string>;className:string;tagName:string;tabIndex:number;disabled=false;ready?:Element
    constructor(cls:string,tag='DIV',dataset:Record<string,string>={}){this.className=cls;this.tagName=tag;this.dataset=dataset;this.tabIndex=tag==='BUTTON'?0:-1}
    getAttribute(){return null} textContent=''
    focus(){document.activeElement=this;effects.push('focus:'+(this.dataset.action??this.className))}
    scrollIntoView(){effects.push('reveal:'+this.className)}
    querySelector(query:string){assert.equal(query,'.commission-line-ready');return this.ready??null}
  }
  const closeButton=new Element('dialog-close','BUTTON'),other=new Element('elsewhere','BUTTON'),document={activeElement:other}
  const value=options.value??C.getShopCommission(farm)!.lines[0].actionValue
  const control=new Element('dialog-button','BUTTON',{action:'commission-deliver',value})
  document.activeElement=options.owned===false?other:control
  let buttons:Element[]=[],lines:Element[]=[],ready:Element|undefined
  const redraw=()=>{
    const html=render(farm)
    buttons=[...html.matchAll(/<button([^>]+)>/g)].filter(m=>!m[1].includes(' disabled')).map(m=>new Element('dialog-button','BUTTON',{action:m[1].match(/data-action="([^"]*)"/)![1],value:m[1].match(/data-value="([^"]*)"/)![1]}))
    ready=html.includes('class="commission-ready"')?new Element('commission-ready'):undefined
    lines=[...html.matchAll(/<article class="commission-line"([^>]*)>([\s\S]*?)<\/article>/g)].map(m=>{const line=new Element('commission-line','ARTICLE',{commissionLine:m[1].match(/data-commission-line="([^"]*)"/)?.[1]??''});if(m[2].includes('class="commission-line-ready"'))line.ready=new Element('commission-line-ready','P');return line})
  }
  const dialogContent={
    querySelectorAll(query:string){if(query==='button:not(:disabled)')return buttons;if(query==='[data-commission-line]')return lines.filter(line=>line.dataset.commissionLine);throw Error(query)},
    querySelector(query:string){assert.equal(query,'.commission-ready');return ready??null},
  }
  redraw()
  const panel=options.panel??'shop-commissions',dialog={open:options.open??true}
  const perform=(fn:()=>{ok:boolean})=>{
    const r=fn();if(r.ok){writes.push(structuredClone(farm));const focused=document.activeElement===control?control:undefined;redraw();runInNewContext(actualRecovery,{focused,panel,closeButton,dialogContent})}return r.ok
  }
  runInNewContext(actualHandler,{action:'commission-deliver',value,control,event:{detail:options.detail??0},document,farm,panel,dialog,dialogContent,perform,deliverShopCommission:C.deliverShopCommission,getShopCommissionLine:C.getShopCommissionLine,playBaySound:()=>effects.push('sound')})
  return {farm,effects,writes,active:document.activeElement,ready,lines,buttons}
}

test('terminal keyboard reservation focuses the existing non-action ready status, never the claim',()=>{
  const r=harness(single)
  assert.equal(r.active,r.ready);assert.equal(r.active.className,'commission-ready');assert.equal(r.active.tagName,'DIV');assert.equal(r.active.tabIndex,-1);assert.equal(r.active.dataset.action,undefined)
  assert.equal(r.effects.at(-1),'reveal:commission-ready');assert.equal(r.writes.length,1)
  const expected=structuredClone(single);assert.ok(C.deliverShopCommission(expected,String(expected.shopCommissions.serial)).ok);assert.deepEqual(r.farm,expected);assert.equal(r.farm.coins,single.coins);assert.equal(r.farm.shopCommissions.completed.bea,0)
})
test('nonterminal reservation keeps the existing same-button focus and no result reveal',()=>{
  const r=harness(accepted);assert.equal(r.active.dataset.action,'commission-deliver');assert.deepEqual(r.farm,single);assert.equal(r.writes.length,1);assert.equal(r.effects.some(x=>x.startsWith('reveal:')),false)
})
test('pointer activation and keyboard activation that did not own focus do not receive new focus',()=>{
  for(const options of [{detail:1},{owned:false}]){const r=harness(single,options);assert.notEqual(r.active,r.ready);assert.equal(r.effects.includes('focus:commission-ready'),false);assert.equal(r.effects.some(x=>x.startsWith('reveal:')),false);assert.equal(r.writes.length,1)}
})
test('renderer preserves exact stable line tokens for single and mixed result ownership',()=>{
  assert.match(render(single),new RegExp(`data-commission-line="${single.shopCommissions.serial}"`))
  const f=mixedFixture();for(const line of C.getShopCommission(f)!.lines)assert.ok(render(f).includes(`data-commission-line="${line.actionValue}"`))
})
test('completed mixed line focuses its own existing readiness without moving to the other executable reserve',()=>{
  const f=mixedFixture(),line=C.getShopCommission(f)!.lines[1];assert.ok(C.deliverShopCommission(f,line.actionValue).ok)
  const r=harness(f,{value:line.actionValue}),target=r.lines.find(x=>x.dataset.commissionLine===line.actionValue)!.ready
  assert.equal(r.ready,undefined);assert.equal(r.active,target);assert.equal(r.active.tagName,'P');assert.equal(r.active.tabIndex,-1);assert.equal(r.active.dataset.action,undefined)
  assert.equal(r.effects.at(-1),'reveal:commission-line-ready');assert.equal(C.getShopCommission(r.farm)!.lines[0].delivered,0);assert.equal(r.farm.coins,f.coins);assert.equal(r.writes.length,1)
})
test('final mixed line chooses full ready status, not its individual line or claim button',()=>{
  const f=mixedFixture(),[a,b]=C.getShopCommission(f)!.lines
  for(let i=0;i<2;i++)assert.ok(C.deliverShopCommission(f,a.actionValue).ok)
  assert.ok(C.deliverShopCommission(f,b.actionValue).ok)
  const r=harness(f,{value:b.actionValue});assert.equal(r.active,r.ready);assert.equal(C.getShopCommission(r.farm)!.remaining,0);assert.equal(r.farm.coins,f.coins);assert.equal(r.writes.length,1)
})
test('wrong panel, closed dialog, stale action, away and canceled order leave state and focus untouched',()=>{
  for(const options of [{panel:'inventory'},{open:false},{value:'0'}]){const r=harness(single,options);assert.deepEqual(r.farm,single);assert.deepEqual(r.effects,[]);assert.equal(r.writes.length,0)}
  const away=structuredClone(single);assert.ok(F.sail(away,'home').ok);const r=harness(away);assert.deepEqual(r.farm,away);assert.deepEqual(r.effects,[]);assert.equal(r.writes.length,0)
  const canceled=structuredClone(single);const value=String(canceled.shopCommissions.serial);assert.ok(C.cancelShopCommission(canceled,value).ok);const c=harness(canceled,{value});assert.deepEqual(c.farm,canceled);assert.deepEqual(c.effects,[]);assert.equal(c.writes.length,0)
})
test('no stock disables reserve; rejected delivery does not create result focus or writes',()=>{
  const empty=structuredClone(single);empty.culinary.stock[id]=0 // Focused boundary only; native fixture is fully earned.
  assert.match(render(empty),/data-action="commission-deliver" data-value="\d+" disabled/)
  const r=harness(empty);assert.deepEqual(r.farm,empty);assert.deepEqual(r.effects,[]);assert.equal(r.writes.length,0)
})
test('ready status stays outside natural tab stops, claim remains separate and pays once only',()=>{
  const r=harness(single),html=render(r.farm);assert.equal(r.active.tabIndex,-1);assert.match(html,/class="commission-ready" role="status"><span>Партия готова<\/span><button[^>]+data-action="commission-finish"/)
  assert.doesNotMatch(actualHandler,/finishShopCommission|\.click\(/);assert.equal(r.buttons[0].dataset.action,'commission-finish');assert.equal(r.farm.coins,single.coins)
  const before=r.farm.coins;assert.ok(C.finishShopCommission(r.farm,String(r.farm.shopCommissions.serial)).ok);assert.equal(r.farm.coins,before+44);const paid=structuredClone(r.farm);assert.equal(C.finishShopCommission(r.farm,String(r.farm.shopCommissions.serial)).ok,false);assert.deepEqual(r.farm,paid)
})
test('existing held Enter guard owns repeats on a non-action status until release',()=>{
  const g=new ActivationKeyGuard();assert.equal(g.blocks({key:'Enter',repeat:false},true),false);for(let i=0;i<2;i++)assert.equal(g.blocks({key:'Enter',repeat:true},false),true);g.release('Enter');assert.equal(g.blocks({key:'Enter',repeat:false},true),false)
})
