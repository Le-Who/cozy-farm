import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import {runInNewContext} from 'node:vm'
import * as F from '../src/farm.ts'
import * as M from '../src/chicken-feed.ts'
import * as C from '../src/coop-panel.ts'
import {ActionClickGuard,ActivationKeyGuard,isGuardedAction} from '../src/action-click-guard.ts'
import {chickenCarePlayer} from './fixtures/chicken-care-player.ts'

const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
const midway=(a:string,b:string)=>{const i=main.indexOf(a),j=main.indexOf(b,i+1);assert.ok(i>=0&&j>i,[a,b]);return main.slice(i,j)}
const helpers=stripTypeScriptTypes(midway('function button(','function panelTabs(')+midway('function flockFeedRow(','function seedCards()'))
const htmlActions=(html:string)=>[...html.matchAll(/<button\b([^>]+)>/g)].map(([,tag])=>({
 action:tag.match(/data-action="([^"]+)"/)?.[1],value:tag.match(/data-value="([^"]+)"/)?.[1],disabled:/\sdisabled(?:\s|$)/.test(tag)
}))
const uniqueActions=(html:string)=>htmlActions(html).filter(b=>!b.disabled).map(b=>b.action)
const restore=(f:F.FarmState)=>F.restoreCurrentFarm(JSON.parse(JSON.stringify(f)))!
const controls=(f:F.FarmState,desktop:boolean)=>{
 const icon=(id:string)=>'<i data-art="'+id+'"></i>'
 const env:any={...F,...M,...C,farm:f,panel:'coop',icon,itemIcon:icon,numberFormat:new Intl.NumberFormat('ru-RU')}
 runInNewContext(helpers,env)
 return C.renderCoopPanel(f,{icon,row:env.row,button:env.button,feedRow:env.flockFeedRow},desktop)
}
const first=(html:string)=>html.split('<details class="coop-forecast"')[0]
function earn(){
 const trace=chickenCarePlayer('orchard','hatchery');trace.run(7)
 const pivot=trace.log.findIndex(a=>a.name==='mixChickenFeed'&&a.day>=6);assert.equal(pivot,133)
 const p=chickenCarePlayer('orchard','hatchery')
 let d4:F.FarmState|undefined
 for(const a of trace.log.slice(p.log.length,pivot)){
  p.act(a.name,...a.args)
  if(p.log.length===67)d4=restore(p.state)
 }
 assert.deepEqual([p.state.day,p.state.feed,p.state.chickensFed,p.state.coins,p.state.produce.wheat,p.state.produce.carrot,p.state.fruit.apple,p.state.henFriendship.hens[4].points],
   [7,0,false,297,3,2,3,0])
 return {d4:d4!,d7:p.state}
}
const {d4,d7}=earn()
const normal=controls(d7,false)

test('the same D7 display moves three truthful old choices into one desktop tray without saving or picking any',()=>{
 const f=restore(d7), before=structuredClone(f), actual=controls(f,true), tray=first(actual)
 assert.deepEqual(uniqueActions(first(normal)),['buy-feed','chicken-feed-open','hen-friendship-open'])
 assert.deepEqual(uniqueActions(tray),['buy-feed','mix-chicken-feed','mix-chicken-feed','hen-friendship-open'])
 assert.match(tray,/data-coop-feed-compare/)
 assert.match(tray,/Купить · 2 порции[\s\S]*?4 монеты/)
 assert.match(tray,/data-value="garden"[\s\S]*?Смешать · 3 порции[\s\S]*?Пшеница ×1 \+ морковь ×1/)
 assert.match(tray,/data-value="orchard"[\s\S]*?Смешать · 4 порции[\s\S]*?Пшеница ×1 \+ яблоко ×1/)
 assert.doesNotMatch(actual,/data-action="chicken-feed-open"|aria-pressed="true"/)
 for(const retained of ['Кладка после отдыха','Пуговка','Упаковка яиц','Собрать'])assert.ok(actual.includes(retained)&&normal.includes(retained))
 assert.deepEqual(f,before)
 assert.equal(controls(restore(f),true),actual,'close/reopen has the same comparison; no retained choice')
})

test('one/zero mixes, adequately stocked D4 and compact, fed, offsite states retain their ordinary UI exactly',()=>{
 assert.doesNotMatch(controls(d4,true),/data-coop-feed-compare/)
 assert.equal(controls(d4,true),controls(d4,false))
 for(const mode of ['only apples','no wheat','fed','offsite'] as const){
  const f=restore(d7)
  if(mode==='only apples')assert.ok(F.sellMarketItem(f,'produce:carrot',2).ok)
  if(mode==='no wheat')assert.ok(F.sellMarketItem(f,'produce:wheat',3).ok)
  if(mode==='fed'){assert.ok(F.buyFeed(f).ok);assert.ok(F.feedChickens(f).ok)}
  if(mode==='offsite') {assert.ok(F.buyBoat(f).ok);assert.ok(F.sail(f,'grove').ok)}
  const before=structuredClone(f)
  assert.equal(controls(f,true),controls(f,false),mode)
  assert.deepEqual(f,before,mode)
 }
})

function harness(farm:F.FarmState){
 let saves=0
 const timeline:string[]=[],title={tabIndex:0,focus:()=>timeline.push('neutral feed stock')}
 const parent={querySelector:(selector:string)=>selector==='.dialog-row-copy'?title:null}
 const feedBtn={closest:()=>parent}
 const context:any={...F,...M,...C,farm,panel:'coop',dialog:{open:true},dialogContent:{
  contains:(control:{connected?:boolean})=>control.connected===true,
  querySelector:(selector:string)=>selector.includes('[data-action="feed"]')?feedBtn:null,
 },perform(fn:()=>F.ActionResult){const r=fn();if(r.ok)saves++;return r.ok},playBaySound:()=>{},
 event:{detail:1},control:null,closeButton:{},document:{activeElement:null}}
 const span=midway("    case 'mix-chicken-feed':","    case 'collect':")
 const buy=midway("    case 'buy-feed':","    case 'buy-seeds':")
 const focus=midway('function focusCoopFeedResult()','function highlightControl(')
 const code=stripTypeScriptTypes(focus+'\n'+'switch(action){'+span+'\n'+buy+'\n}')
 const connected=()=>({connected:true,closest:(s:string)=>s==='[data-coop-feed-compare]'?{}:null})
 const action=(act:string,value?:string,control=connected())=>runInNewContext(code,{...context,action:act,value,control})
 return {action,saves:()=>saves,timeline,title,context,connected}
}

test('explicit existing direct action acquires once and neutral focus cannot feed; a separate old Feed leads to seven D8 eggs',()=>{
 for(const opt of ['buy','garden','orchard'] as const) {
  const f=restore(d7),h=harness(f),original=structuredClone(f)
  const act=opt==='buy'?'buy-feed':'mix-chicken-feed'
  h.action(act,opt)
  assert.deepEqual([f.coins,f.feed,f.produce.wheat,f.produce.carrot,f.fruit.apple,f.chickensFed,h.saves()],
   opt==='buy'?[293,2,3,2,3,false,1]:opt==='garden'?[297,3,2,1,3,false,1]:[297,4,2,2,2,false,1])
  assert.deepEqual(h.timeline,['neutral feed stock']); assert.equal(h.title.tabIndex,-1)
  assert.deepEqual([f.day,f.eggs,f.eggsReady,f.flockSize,f.hatchDay],[original.day,original.eggs,original.eggsReady,5,null])
  assert.doesNotMatch(controls(restore(f),true),/data-coop-feed-compare/)
  assert.ok(uniqueActions(first(controls(f,true))).includes('feed'))
  const bought=structuredClone(f)
  h.action(act,opt) // the same formerly mounted compare control is no longer valid
  assert.deepEqual(f,bought)
  const yields = opt==='buy'?2:opt==='garden'?3:4
  h.action('feed')
  assert.deepEqual([f.feed,f.chickensFed,h.saves()],[yields-1,true,2])
  assert.ok(F.endDay(f).ok);assert.deepEqual([f.day,f.flockSize,f.eggsReady,f.feed],[8,5,7,yields-1])
  assert.deepEqual(restore(f),f)
 }
})

test('stale no-stock, detached controls and captured double-click/held Enter cannot fire a follow-up',()=>{
 const f=restore(d7),h=harness(f)
 const bad=h.connected();bad.connected=false
 const original=structuredClone(f)
 h.action('mix-chicken-feed','orchard',bad);h.action('buy-feed',undefined,bad)
 assert.deepEqual(f,original)
 assert.ok(F.sellMarketItem(f,'fruit:apple',3).ok)
 const after=structuredClone(f)
 h.action('mix-chicken-feed','garden') // garden still valid generally, not the old two-option tray
 h.action('mix-chicken-feed','orchard')
 assert.deepEqual(f,after);assert.equal(h.saves(),0)
 const pointer=new ActionClickGuard(), keys=new ActivationKeyGuard(),at={timeStamp:1000,detail:1,clientX:390,clientY:210}
 for(const act of ['mix-chicken-feed','buy-feed'])assert.equal(isGuardedAction(act),true)
 pointer.remember(at)
 assert.equal(pointer.blocks({...at,timeStamp:1160,detail:2}),true)
 assert.equal(pointer.blocks({...at,timeStamp:1160,detail:1,clientX:at.clientX+151}),false)
 assert.equal(keys.blocks({key:'Enter',repeat:false},true),false)
 assert.equal(keys.blocks({key:'Enter',repeat:true},false),true)
})
