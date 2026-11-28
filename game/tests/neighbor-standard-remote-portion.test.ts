import A from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import {runInNewContext} from 'node:vm'
import test from 'node:test'
import * as F from '../src/farm.ts'
import * as I from '../src/intent-orders.ts'
import * as H from '../src/neighbor-help.ts'
import * as R from '../src/neighbor-food-recovery.ts'
import * as S from '../src/stored-signature.ts'
import * as W from '../src/warehouse-guidance.ts'
import {freightPortNames} from '../src/bay-freight-model.ts'
import {communityReturnRoute} from '../src/community-return.ts'
import {renderIntentDeadline} from '../src/intent-deadline.ts'
import {earned416Mixed} from './fixtures/earned-416-market-orders.ts'

const plan='bea:2',food='dish:blueberryTart'
const key='grove|dish:blueberryTart|1|1'
const meeting={kind:'neighbor',resident:'bea',planId:plan} as const
const item={kind:'dishes',item:'blueberryTart',quantity:1} as const
const basket={kind:'basket',settled:true,placements:[{slot:'food',x:0,y:0},{slot:'cup',x:.4,y:.2},{slot:'flowers',x:-.4,y:.2}]} as const
const change=(farm:F.FarmState)=>JSON.parse(JSON.stringify(farm))
const read=(name:string)=>readFileSync(new URL('../src/'+name,import.meta.url),'utf8')
const main=read('main.ts'),raw=read('community-ui.ts')
const cut=(a:string,b:string)=>{const i=main.indexOf(a),j=main.indexOf(b,i+a.length);A.ok(i>=0&&j>i);return main.slice(i,j)}
const render=runInNewContext(stripTypeScriptTypes(raw.slice(raw.indexOf('type Offer =')).replaceAll('export function','function')+';neighborDetail'),
 {...F,...I,...H,...R,...S,freightPortNames,renderIntentDeadline}) as Function
const card=(f:F.FarmState)=>render(f,'bea',{icon:()=>'<img alt="">',offerIcon:()=>'<img alt="">'} ) as string
const program=stripTypeScriptTypes(cut('function currentCommunityRequest()','function updateCommunityReturn()')+
 cut('async function resumeCommunityRequest(','function requestedRecipe()')+
 cut('async function visitPanelAt(','function openGuidedMarket(')+
 '({step:async(action:string)=>{switch(action){'+cut("    case 'neighbor-stored-food':","    case 'neighbor-shelf-food':")+
 cut("    case 'warehouse-supply-withdraw':","    case 'show-requirement':")+'}},resumeCommunityRequest,currentCommunityRoute})')

function player(port: F.IslandId) {
 const p=earned416Mixed(false);p.night();p.visit('village')
 A.deepEqual([p.actions,p.state.day,p.state.coins,p.state.produce.blueberry,p.state.produce.wheat,p.state.eggs],[545,194,56,2,2,3])
 p.act('cookDish','blueberryTart');p.act('joinNeighborPlan',plan);p.act('serveNeighborPlan',plan,food)
 p.visit(port);p.act('transferBayGoods','deposit',port,food,1);p.visit('village')
 return p
}
function mount(farm:F.FarmState){
 const nav:string[]=[], actions:string[]=[], control={dataset:{food,storage:key}}, panelHistory:unknown[]=[]
 let valid=true,crossing=false, supply: F.StockItem|undefined
 const scope={...F,...R,...S,...W,communityReturnRoute,farm,communityRequest:undefined as undefined|typeof meeting,
  communityResident:'bea',requestedFood:undefined as string|undefined,panel:'neighbor' as string|undefined,dialog:{open:true},value:plan,control,panelHistory,
  get selectedWarehouseRequest(){return supply},set selectedWarehouseRequest(x:F.StockItem|undefined){supply=x},
  dialogContent:{contains:(candidate:unknown)=>valid&&candidate===control},
  fieldViewButton:{getAttribute:()=> 'false'},
  island:{isCrossing:()=>crossing,crossIsland:async(go:()=>unknown)=>go()},drawPanel(){},
  rememberPanel:()=>({panel:scope.panel}),
  closeDialog(){scope.panel=undefined;scope.dialog.open=false;panelHistory.length=0},
  openPanel(panel:string){scope.panel=panel;scope.dialog.open=true;nav.push(panel+':'+farm.island)},
  perform(go:()=>F.ActionResult){const r=go();if(r.ok)actions.push(r.message);return r.ok},
  bayAudio:{playEvent(){}}}
 const api=runInNewContext(program,scope)
 return {scope,api,nav,actions,control,
  connected(x:boolean){valid=x},crossing(x:boolean){crossing=x},get supply(){return supply}}
}
const storeButton=/<button[^>]*data-action="neighbor-stored-food"[^>]*data-food="dish:blueberryTart"[^>]*data-storage="([^"]+)"[^>]*>К складу: Солёная роща<\/button>/

test('earned established Bea basket retains its selected ordinary blueberry portion across an explicit Grove warehouse return',async()=>{
 const p=player('grove'),farm=p.state,before=change(farm)
 A.deepEqual([p.actions,farm.day,farm.coins,farm.produce.blueberry,farm.dishes.blueberryTart,farm.freight.warehouses.grove[food]],[551,194,56,0,0,1])
 A.equal(F.getCookAction(farm,'blueberryTart').available,false)
 const m=card(farm).match(storeButton)
 A.equal(m?.[1],key,'same exact ordinary serving already owned, not a replacement recipe')
 A.doesNotMatch(card(farm),/Выбранное угощение закончилось/)
 A.match(card(farm),/Выбрать другое угощение/)
 A.match(card(farm),/class="dialog-button community-button secondary" data-action="cook-intent-offer" data-value="dish:blueberryTart"/)
 A.deepEqual(farm,before,'reading the native gathering card is read-only')
 const x=mount(farm)
 await x.api.step('neighbor-stored-food')
 A.deepEqual(x.nav,['warehouse-supply:grove'])
 A.deepEqual(change(x.supply),item)
 A.deepEqual(change(x.scope.communityRequest),meeting)
 A.deepEqual(farm,{...before,island:'grove'},'deliberate crossing only; no claim, cook, payment or visit advance')

 x.scope.closeDialog()
 A.equal(x.api.currentCommunityRoute('recipe').label,'К встрече в гавани')
 await x.api.resumeCommunityRequest('recipe')
 A.deepEqual(farm,before,'close and explicit return can leave the portion untouched')
 A.equal(x.nav.at(-1),'neighbor:village')
 A.deepEqual(change(x.scope.communityRequest),meeting)

 await x.api.step('neighbor-stored-food')
 x.scope.value=key
 await x.api.step('warehouse-supply-withdraw')
 A.deepEqual([farm.island,farm.coins,farm.dishes.blueberryTart,farm.freight.warehouses.grove[food]],['grove',56,1,undefined])
 A.deepEqual(farm.neighbors,before.neighbors)
 const once=change(farm);await x.api.step('warehouse-supply-withdraw');A.deepEqual(farm,once)
 x.scope.closeDialog();await x.api.resumeCommunityRequest('recipe')
 A.deepEqual(change(x.scope.communityRequest),meeting)
 A.match(card(farm),/data-action="arrange-neighbor" data-value="bea:2"/)
 A.deepEqual([farm.day,farm.coins,farm.produce.wheat,farm.eggs],[194,56,1,2])
 A.ok(F.finishNeighborPlan(farm,plan,basket).ok)
 A.deepEqual([farm.day,farm.coins,farm.dishes.blueberryTart,F.getNeighborPlans(farm).find(x=>x.id===plan)?.phase],[194,103,0,'celebrating'])
 const done=change(farm);A.equal(F.finishNeighborPlan(farm,plan,basket).ok,false);A.deepEqual(farm,done)
})

test('remote ordinary stale clicks cannot sail or take; local existing and deliberate alternate cooking remain',async()=>{
 const local=player('village').state
 A.match(card(local),/К готовой порции на складе/)
 A.doesNotMatch(card(local),/data-storage=/)
 for(const bad of ['wrong-port','wrong-food','detached','underway','already-taken','changed-choice'] as const){
  const p=player('grove')
  if(bad==='already-taken'){
   p.visit('grove');p.act('transferBayGoods','withdraw','grove',food,1);p.visit('village')
   A.doesNotMatch(card(p.state),storeButton)
  }
  if(bad==='changed-choice'){
   p.act('cookDish','strawberryTart');p.act('serveNeighborPlan',plan,'dish:strawberryTart')
   A.doesNotMatch(card(p.state),storeButton)
  }
  const f=p.state,before=change(f),m=mount(f)
  if(bad==='wrong-port')m.control.dataset.storage='home|dish:blueberryTart|1|1'
  if(bad==='wrong-food')m.control.dataset.food='dish:strawberryTart'
  if(bad==='detached')m.connected(false)
  if(bad==='underway')m.crossing(true)
  await m.api.step('neighbor-stored-food')
  A.deepEqual(f,before,bad);A.deepEqual(m.nav,[],bad);A.deepEqual(m.actions,[],bad)
 }
 const swap=player('grove')
 swap.act('cookDish','strawberryTart');swap.act('serveNeighborPlan',plan,'dish:strawberryTart')
 swap.act('finishNeighborPlan',plan,basket)
 A.deepEqual([swap.state.coins,swap.state.produce.wheat,swap.state.eggs,swap.state.freight.warehouses.grove[food]],[101,0,1,1])
})
