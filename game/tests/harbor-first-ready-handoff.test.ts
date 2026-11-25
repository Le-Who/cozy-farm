import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { runInNewContext } from 'node:vm'
import * as F from '../src/farm.ts'
import * as H from '../src/harbor-return.ts'
import { getMarketOrderBoard } from '../src/market-orders-view.ts'
import { ActivationKeyGuard, isGuardedAction } from '../src/action-click-guard.ts'
import { commissionPlayer } from './fixtures/commission-player.ts'

const read=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8')
const s=read('../src/main.ts'),opening=JSON.parse(read('./fixtures/home-progress-actions.json'))
function scope(a:string,b:string){
 const i=s.indexOf(a),j=s.indexOf(b,i+a.length)
 assert.ok(i>=0&&j>i);return s.slice(i,j)
}
const render=stripTypeScriptTypes(scope('function button(label:','function quantity(')+scope('function harborCard(','function groveDockActions()')+';harborCard')
const navigate=stripTypeScriptTypes(scope('async function visitPanelAt(', 'function openGuidedMarket(')+
 'async function choose(){switch(action){'+scope("    case 'sail':","    case 'store-tree':")+
 scope("    case 'visit-harbor':","    case 'harbor-next-rest':")+'}};choose')
function firstReady(){
 const p=commissionPlayer(opening.slice(0,29))
 assert.equal(p.state.day,3);assert.ok(F.isProjectComplete(p.state,'dock'));assert.equal(F.getHarborOrder(p.state),undefined)
 p.act('catchFish',true);p.visit('home');p.act('specializeFarmhouse','bakery');p.act('cookDish','farmhouseBread')
 assert.equal(p.actions,33);assert.equal(p.state.orders.harbor.completed,0)
 assert.deepEqual([p.state.dishes.farmhouseBread,p.state.fish.seaBass,p.state.coins],[1,1,20])
 return p
}
function card(farm:F.FarmState,fromMarket=true){
 const noop=()=>'',html=runInNewContext(render,{...F,...H,farm,icon:noop,deliveryItems:noop,stockTile:noop,escapeHtml:String,numberFormat:new Intl.NumberFormat('ru'),
  ruPlural:()=>'',quantity:String})(fromMarket) as string
 const tag=html.match(/<button\b(?![^>]*\bdisabled)[^>]*>/)?.[0]
 return {html,tag,action:tag?.match(/data-action="([^"]*)"/)?.[1],value:tag?.match(/data-value="([^"]*)"/)?.[1]}
}
function navigateFrom(farm:F.FarmState,c:ReturnType<typeof card>,opts:{selected?:string,attached?:boolean,panel?:string,canceled?:boolean,value?:string}={}){
 const calls:string[]=[], ctrl={}; const open={open:true}
 const ctx={farm,action:c.action,value:opts.value??c.value,control:ctrl,panel:opts.panel??'market',dialog:open,marketTab:'orders',selectedMarketOrder:opts.selected??'harbor',
  panelHistory:[{panel:'guide'},{panel:'tree'}],
  dialogContent:{contains(x:unknown){return opts.attached!==false&&x===ctrl}},...F,...H,
  fieldViewButton:{getAttribute:()=> 'false'},fieldLayout:{matches:false},rememberPanel:()=>({panel:ctx.panel}),
  closeDialog(){calls.push('close');ctx.panel='';open.open=false;ctx.panelHistory.length=0},
  island:{isCrossing:()=>false,async crossIsland(commit:()=>boolean){calls.push('cross');if(!opts.canceled)assert.ok(commit())}},
  openPanel(to:string){calls.push('open:'+to);ctx.panel=to;open.open=true},
  canvas:{focus(){calls.push('world')}},
  perform(work:()=>{ok:boolean}){return work().ok},
 }
 return {ctx,go:runInNewContext(navigate,ctx) as()=>Promise<void>,calls}
}
const loaded=(farm:F.FarmState)=>F.restoreCurrentFarm(JSON.parse(JSON.stringify(farm)))!
test('fully supplied first Grove order selected at Market opens that exact order on arrival, never delivers itself',async t=>{
 const p=firstReady(),farm=p.state,before=structuredClone(farm)
 const selected=getMarketOrderBoard(farm,'harbor');assert.equal(selected.selected,'harbor')
 const actual=F.getHarborOrder(farm)!;assert.equal(actual.reward,42);assert.ok(actual.items.every(({item,available,delivered})=>delivered+available===item.quantity))
 const choice=card(farm);assert.ok(choice.tag)
 assert.equal(card(farm,false).action,'sail','outside the selected Market card ordinary sailing stays ordinary')
 assert.match(s,/case 'harbor': if \(farm.island === 'grove' && getHarborOrder\(farm\)\) openPanel\('harbor'\)/)
 const m=navigateFrom(farm,choice);await m.go()
 t.diagnostic(JSON.stringify({day:farm.day,earned:p.actions,coins:before.coins,reward:actual.reward,choice:choice.action,arrival:m.calls,secondWorldOpenNeeded:m.ctx.panel!=='harbor'}))
 assert.deepEqual(m.calls,['close','cross','open:harbor']);assert.deepEqual(m.ctx.panelHistory,[{panel:'guide'}])
 assert.match(s,/можно вносить частями<\/p>\$\{harborCard\(true\)\}/)
 assert.deepEqual(farm,{...before,island:'grove'});assert.equal(F.getHarborOrder(farm)?.status,'ready')
 assert.equal(card(farm).action,'deliver-harbor')
 assert.match(s,/;\(sceneEntry \?\? closeButton\)\.focus\(\{ preventScroll: true \}\)/)
 assert.ok(isGuardedAction(choice.action))
 const guard=new ActivationKeyGuard();assert.equal(guard.blocks({key:'Enter',repeat:false},isGuardedAction(choice.action)),false)
 assert.equal(guard.blocks({key:'Enter',repeat:true},false),true,'holding the travel press cannot deliver')
 assert.ok(F.deliverHarborOrder(farm).ok);assert.equal(farm.coins,before.coins+42)
 assert.deepEqual([farm.dishes.farmhouseBread,farm.fish.seaBass,farm.orders.harbor.completed],[0,0,1])
 assert.equal(F.deliverHarborOrder(farm).ok,false)
 assert.deepEqual(loaded(farm),farm)
})
test('underprepared still has plain route; exact ready action cannot cross from detached, wrong or stale control',async()=>{
 const p=firstReady(),stock=structuredClone(p.state),ready=card(p.state)
 for(const opts of [{selected:'garden'},{attached:false},{panel:'inventory'},{value:'2:0:bakery'}]){
  const farm=loaded(stock),m=navigateFrom(farm,ready,opts);await m.go()
  assert.deepEqual(m.calls,[]);assert.deepEqual(farm,stock)
 }
 const failed=loaded(stock),m=navigateFrom(failed,ready,{canceled:true});await m.go()
 assert.deepEqual(m.calls,['close','cross']);assert.deepEqual(failed,stock)
 p.act('sellMarketItem','fish:seaBass',1)
 const short=p.state,choice=card(short);assert.equal(choice.action,'sail');assert.equal(choice.value,'grove')
 assert.deepEqual(F.getHarborOrder(short)?.items.map(x=>x.available),[1,0])
 const gone=navigateFrom(loaded(short),ready);await gone.go()
 assert.deepEqual(gone.calls,[]);assert.deepEqual(gone.ctx.farm,short)
 const old=navigateFrom(loaded(short),choice);await old.go()
 assert.deepEqual(old.calls,['close','cross','world'],'the old optional partial-deposit path remains separate')
 const capped=loaded(stock);assert.ok(F.endDay(capped).ok)
 const stale=navigateFrom(capped,ready);await stale.go();assert.deepEqual(stale.calls,[])
})

test('a legitimately reserved bread counts, but only the separately confirmed live fish completes the parcel', async()=>{
 const p=firstReady()
 p.act('sellMarketItem','fish:seaBass',1); p.visit('grove'); p.act('deliverHarborOrder')
 assert.equal(p.state.orders.harbor.completed,0)
 assert.deepEqual(p.state.harborSupplies,{'dishes:farmhouseBread':1})
 p.act('catchFish',true); p.visit('home')
 const farm=p.state,before=structuredClone(farm),choice=card(farm)
 assert.equal(choice.action,'harbor-order-route')
 const expected=F.getHarborOrder(farm)!
 assert.deepEqual(expected.items.map(({delivered,available})=>[delivered,available]),[[1,0],[0,1]])
 const m=navigateFrom(farm,choice);await m.go()
 assert.deepEqual(m.calls,['close','cross','open:harbor'])
 assert.deepEqual(farm,{...before,island:'grove'})
 assert.ok(F.deliverHarborOrder(farm).ok)
 assert.equal(farm.coins,before.coins+expected.reward);assert.equal(farm.orders.harbor.completed,1)
 assert.deepEqual(farm.harborSupplies,{})
 assert.equal(card(farm).action,'harbor-next-rest')
 assert.deepEqual(loaded(farm),farm)
})
