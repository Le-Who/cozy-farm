import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
import {stripTypeScriptTypes} from 'node:module'
import {commissionPlayer} from './fixtures/commission-player.ts'
import {getBedStage,getBedAction,advanceNeighborPlan,sail,pickFruit,restoreCurrentFarm,getNeighborPlans,getIntentOffers,finishNeighborPlan,type FarmState,type NeighborAssembly} from '../src/farm.ts'
import {inviteNeighborVisit} from '../src/neighbor-visits.ts'
import {syncHomeVisitor,stepHomeVisitor,visitorLanding} from '../src/neighbor-visit-scene.ts'
import {finnPicnicRide,sailHomeWithFinn} from '../src/finn-picnic-ride.ts'

const read=(p:string)=>readFileSync(new URL(p,import.meta.url),'utf8')
const arrangedBasket={kind:'basket',settled:true,placements:[{slot:'food',x:0,y:0},{slot:'cup',x:.4,y:.2},{slot:'flowers',x:-.4,y:.2}]} as const
function picnic(finish=true){
  const p=commissionPlayer(JSON.parse(read('./fixtures/market-order-selection-commands.json')))
  p.act('selectSeed','wheat');p.act('workBed',0)
  for(let i=0;i<5&&getBedStage(p.state.beds[0])!=='ripe';i++){if(getBedAction(p.state,0).kind==='water'){if(!p.state.water)p.act('refillWater');p.act('workBed',0)}p.night()}
  p.act('workBed',0);p.act('bakeWorkshop','round');p.visit('village');p.act('joinNeighborPlan','finn:1');p.act('serveNeighborPlan','finn:1','handmade:round')
  assert.equal(finnPicnicRide(p.state),undefined)
  if(finish) p.act('finishNeighborPlan','finn:1',arrangedBasket)
  return p.state
}
test('fresh picnic: world shortcut crosses with Finn, no stock or memory until the player picks',async()=>{
  const f=picnic(false),before=structuredClone(f)
  assert.equal(finnPicnicRide(f),undefined)
  assert.ok(finishNeighborPlan(before,'finn:1',arrangedBasket).ok)
  const token=finnPicnicRide(before)!
  assert.equal(token,'finn:1:17');assert.equal(f.trees.home[0]?.fruitReady,2)
  const expected=structuredClone(before);advanceNeighborPlan(expected,'finn:1');sail(expected,'home');inviteNeighborVisit(expected,'finnOrchard')
  const main=read('../src/main.ts'),begin=main.indexOf("    case 'finn-picnic-ride':"),end=main.indexOf("    case 'ack-neighbor':",begin)
  const update=main.slice(main.indexOf('function updateCommunityReturn()'),main.indexOf('async function resumeCommunityRequest('))
  // Execute the actual context control and its async click; no extra dialog is opened.
  const label={textContent:''},ctrl={dataset:{} as Record<string,string>,querySelector:()=>label,setAttribute(){}},focused:string[]=[]
  const src=read('../src/island.ts'),cross=src.slice(src.indexOf('    async crossIsland('),src.indexOf('    render(next: FarmState)'))
  const stages:string[]=[],drawings:string[]=[]
  const renderer={state:f,crossing:false,abort:{signal:{aborted:false}},cancelHenGrip(){},bayAudio:{stopEffects(){}},farmSoundEvents:[],motion:{matches:false},
    art:{image:(id:string)=>id,ready:async()=>{}},finnBoatSeat:(boat:string,finn:string)=>{drawings.push(boat,finn);return 'loaded-seat'},
    seatedFinn:undefined,finnAboard:false,capeWork:undefined,departure:0,hovered:undefined,performance,landscape:{home:{occluders:[]}},
    setTimeout,clearTimeout,requestPaint(){},crossingVeil:{hidden:true,animate(_frames:unknown,options:{duration:number}){
      assert.equal(renderer.finnAboard,true);stages.push(f.island+':'+options.duration);return {finished:Promise.resolve(),cancel(){}}
    }}}
  const scene=runInNewContext(stripTypeScriptTypes('({'+cross+'})'),renderer)
  scene.isCrossing=()=>renderer.crossing;scene.focusTarget=(t:{kind:string})=>focused.push(t.kind)

  const ctx={farm:f,finnPicnicRide,sailHomeWithFinn,freshFinnRide:undefined as string|undefined,communityRequest:{kind:'neighbor',resident:'finn',planId:'finn:1'},requestedFood:undefined,saveStore:{issue:true},
    communityResume:ctrl,currentCommunityRequest:()=>({title:'Обед у воды'}),currentCommunityRoute:()=>({label:'К встрече'}),dialog:{open:true},
    island:scene,fieldViewButton:{getAttribute:()=>'false'},perform:(task:()=>{ok:boolean})=>task().ok,canvas:{focus(){}},control:ctrl,value:token,action:'finn-picnic-ride'}
  const mountStart=main.indexOf("    case 'arrangement': {"),mountEnd=main.indexOf("    case 'market':",mountStart)
  assert.ok(mountStart>=0&&mountEnd>mountStart)
  const request={kind:'neighbor',id:'finn:1'}
  let options:{onComplete:(proof:NeighborAssembly)=>unknown;onNextCrate?:()=>boolean}|undefined
  Object.assign(ctx,{queueMicrotask:(cb:()=>void)=>cb(),panel:'arrangement',arrangementRequest:request,arrangementGame:undefined,
    dialogContent:{innerHTML:'',querySelector:()=>({})},getNeighborPlans,getIntentOffers,finishNeighborPlan,
    createArrangement:(_host:unknown,value:typeof options)=>{options=value;return{}},closeDialog:()=>{ctx.dialog.open=false}})
  runInNewContext(stripTypeScriptTypes('switch("arrangement"){'+main.slice(mountStart,mountEnd)+'}'),ctx)
  assert.ok(options);assert.equal(options.onNextCrate,undefined)
  assert.equal(options.onComplete(arrangedBasket),true)
  assert.deepEqual(f,before);assert.equal(ctx.dialog.open,false);assert.equal(ctx.freshFinnRide,token)
  runInNewContext(stripTypeScriptTypes(update)+';updateCommunityReturn()',ctx)
  assert.equal(ctrl.dataset.action,'finn-picnic-ride');assert.equal(ctrl.dataset.value,token);assert.equal(label.textContent,'Домой с Финном')
  await runInNewContext('(async()=>{switch(action){'+main.slice(begin,end)+'}})()',ctx)
  assert.deepEqual(stages,['village:420','home:600']);assert.deepEqual(drawings,['boat','village-finn']);assert.equal(renderer.finnAboard,false)
  assert.deepEqual(focused,['boat']);assert.equal(ctrl.dataset.action,'resume-community');assert.equal(f.neighborVisits.memories.length,0);assert.equal(f.fruit.apple,before.fruit.apple)
  assert.deepEqual(f,expected);assert.deepEqual(restoreCurrentFarm(structuredClone(f)),f)
  const actor=syncHomeVisitor(undefined,f)!;assert.equal(actor.resident,'finn');assert.deepEqual(actor.point,visitorLanding)
  const orchard={x:1300,y:555};for(let i=0;i<1200&&actor.route.length;i++)stepHomeVisitor(actor,.05,false)
  assert.deepEqual(actor.point,orchard);assert.equal(f.neighborVisits.active?.observation,null)
  const stale=structuredClone(f);assert.equal(sailHomeWithFinn(f,token).ok,false);assert.deepEqual(f,stale)
  assert.ok(pickFruit(f,0).ok);assert.equal(f.fruit.apple,before.fruit.apple+2);assert.equal(f.neighborVisits.memories.length,1);assert.equal(f.neighborVisits.memories[0].activity,'finnOrchard')
})
test('solo return, accepted farewell and an empty orchard do not create a passenger',()=>{
  const f=picnic(),token=finnPicnicRide(f)!,solo=structuredClone(f)
  assert.ok(sail(solo,'home').ok);assert.equal(solo.neighborVisits.active,null);assert.equal(solo.fruit.apple,f.fruit.apple)
  pickFruit(solo,0);sail(solo,'village');assert.equal(finnPicnicRide(solo),undefined)
  function stale(farm:FarmState){const before=structuredClone(farm);assert.equal(sailHomeWithFinn(farm,token).ok,false);assert.deepEqual(farm,before)}
  stale(solo);assert.ok(advanceNeighborPlan(f,'finn:1').ok);stale(f)
})
