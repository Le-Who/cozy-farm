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

test('zero mixes, adequately stocked D4 and compact, fed, offsite states retain their ordinary UI exactly',()=>{
 assert.doesNotMatch(controls(d4,true),/data-coop-feed-compare/)
 assert.equal(controls(d4,true),controls(d4,false))
 for(const mode of ['no wheat','fed','offsite'] as const){
  const f=restore(d7)
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
 const entry=stripTypeScriptTypes("switch ('chicken-feed-open') {"+midway("    case 'chicken-feed-open':","    case 'mix-chicken-feed':")+'}')
 const inspect=()=>{const form:string[]=[];runInNewContext(entry,{...context,openPanel:(name:string)=>form.push(name)});return form}
 const buy=midway("    case 'buy-feed':","    case 'buy-seeds':")
 const focus=midway('function focusCoopFeedResult()','function highlightControl(')
 const code=stripTypeScriptTypes(focus+'\n'+'switch(action){'+span+'\n'+buy+'\n}')
 const connected=(choice='both')=>({connected:true,closest:(s:string)=>s==='[data-coop-feed-compare]'?{dataset:{coopFeedCompare:choice}}:null})
 const action=(act:string,value?:string,control=connected())=>runInNewContext(code,{...context,action:act,value,control})
 return {action,inspect,saves:()=>saves,timeline,title,context,connected}
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

function oneReady(policy:'orchard'|'garden') {
 const trace=chickenCarePlayer(policy,'hatchery');trace.run(policy==='orchard'?7:3)
 const stop=policy==='orchard'?122:48, p=chickenCarePlayer(policy,'hatchery')
 for(const {name,args} of trace.log.slice(p.log.length,stop))p.act(name,...args)
 p.act('collectEggs')
 assert.deepEqual([p.log.length,p.state.day,p.state.coins,p.state.flockSize,p.state.feed,p.state.chickensFed,
  p.state.produce.wheat,p.state.produce.carrot,p.state.fruit.apple],
  policy==='orchard'?[123,7,301,5,0,false,1,0,1]:[49,3,109,4,0,false,3,1,0])
 return p.state
}

test('earned D7/D3: an explicit single mix next to Buy and the original inspector with both recipes',()=>{
 for(const policy of ['orchard','garden'] as const) {
  const f=oneReady(policy),before=structuredClone(f),html=controls(f,true),compact=controls(f,false)
  const tray=first(html),state=harness(f),unavailable=policy==='garden'?'orchard':'garden'
  assert.ok(tray.includes('data-coop-feed-compare="'+policy+'"'))
  assert.deepEqual(htmlActions(tray).filter(x=>x.action==='mix-chicken-feed').map(x=>[x.value,x.disabled]),[[policy,false]])
  assert.match(tray,/Купить · 2 порции[\s\S]*?4 монеты/)
  assert.match(tray,policy==='orchard'?/Смешать · 4 порции[\s\S]*?Пшеница ×1 \+ яблоко ×1/:/Смешать · 3 порции[\s\S]*?Пшеница ×1 \+ морковь ×1/)
  const inspectorCount=(content:string)=>htmlActions(content).filter(x=>x.action==='chicken-feed-open'&&!x.disabled).length
  assert.equal(inspectorCount(html),1)
  assert.doesNotMatch(tray,/data-action="(?:feed|chicken-feed-open)"/)
  assert.ok(html.includes('Кладка после отдыха')&&html.includes('Упаковка яиц')&&html.includes('Забота и развитие'))
  assert.equal(html.includes('coop-incubator-new-hen'),policy==='orchard')
  assert.doesNotMatch(compact,/data-coop-feed-compare|mix-chicken-feed/)
  assert.equal(inspectorCount(first(compact)),1)
  assert.deepEqual(state.inspect(),['chicken-feed'])
  const inspector=M.renderChickenFeedMixes(f),recipes=htmlActions(inspector).filter(x=>x.action==='mix-chicken-feed')
  assert.deepEqual(recipes.map(x=>[x.value,x.disabled]),[[policy,false],[unavailable,true]])
  assert.match(inspector,/К курятнику/);assert.match(inspector,/Нет в запасе/)
  assert.equal(state.saves(),0);assert.deepEqual(f,before)
  assert.equal(controls(restore(f),true),html,'close/reopen owns no hidden selection or action')
 }
})

test('earned D7: separate explicit Buy or Mix, then Feed, conserve the whole farm and both yield seven eggs',()=>{
 for(const option of ['buy','orchard'] as const) {
  const f=oneReady('orchard'),before=structuredClone(f),state=harness(f),target=state.connected('orchard')
  state.action(option==='buy'?'buy-feed':'mix-chicken-feed',option,target)
  const exact=structuredClone(before)
  if(option==='buy'){exact.coins-=4;exact.feed=2}
  else {exact.produce.wheat--;exact.fruit.apple--;exact.workToday++;exact.feed=4}
  assert.deepEqual(f,exact);assert.equal(state.saves(),1)
  assert.deepEqual(state.timeline,['neutral feed stock']);assert.equal(state.title.tabIndex,-1)
  assert.ok(htmlActions(first(controls(f,true))).some(x=>x.action==='feed'&&!x.disabled))
  assert.doesNotMatch(controls(f,true),/data-coop-feed-compare/)
  state.action('mix-chicken-feed','orchard',target);state.action('buy-feed',undefined,target)
  assert.deepEqual(f,exact)
  state.action('feed')
  assert.ok(F.feedChickens(exact).ok);assert.deepEqual(f,exact)
  assert.equal(state.saves(),2)
  assert.ok(F.endDay(f).ok);assert.deepEqual([f.day,f.eggsReady,f.feed],[8,7,option==='buy'?1:3])
  assert.deepEqual(restore(f),f)
 }
})

test('a sole tray is stale if the set of live choices changes; a blocked alternative never spends',()=>{
 const f=oneReady('orchard'),state=harness(f),old=state.connected('orchard')
 const oldState=structuredClone(f)
 state.action('mix-chicken-feed','garden',old)
 assert.equal(state.saves(),0);assert.deepEqual(f,oldState)
 assert.ok(F.workBed(f,9).ok)
 assert.ok(controls(f,true).includes('data-coop-feed-compare="both"'))
 const picked=structuredClone(f)
 for(const [action,value] of [['buy-feed',undefined],['mix-chicken-feed','orchard']] as const)state.action(action,value,old)
 assert.equal(state.saves(),0);assert.deepEqual(f,picked)
})

test('native choice navigation cannot click a feed acquisition control with arrows',()=>{
 const listener=stripTypeScriptTypes(midway("dialog.addEventListener('keydown', event => {\n  if (event.defaultPrevented","\nstackedMarketOrders.addEventListener"))
 for(const f of [d7,oneReady('orchard')]){
  let consume:(e:{key:string;target:object;preventDefault:()=>void})=>void=()=>{throw Error('listener missing')}
  const html=first(controls(f,true)),acquisition=html.match(/<div class="([^"]+)" role="group" aria-label="Пополнить запас корма"/)
  assert.ok(acquisition)
  const effects:string[]=[]
  class Button {
   closest(selector:string){return acquisition![1].split(' ').some(c=>selector.split(',').includes('.'+c))?group:null}
   getClientRects(){return [{}]}
   focus(){effects.push('focus')}
   click(){effects.push('click')}
  }
  const options=[new Button(),new Button()]
  const group={classList:{contains:()=>false},querySelectorAll:()=>options}
  runInNewContext(listener,{HTMLButtonElement:Button,dialog:{addEventListener(_:string,fn:typeof consume){consume=fn}}})
  for(const key of ['ArrowRight','ArrowLeft','Home','End','Tab','Enter',' ']){
   const flags:string[]=[]
   consume({key,target:options[key==='Home'?1:0],preventDefault:()=>flags.push('prevented')})
   assert.deepEqual(flags,[],key);assert.deepEqual(effects,[],key)
  }
 }
})
