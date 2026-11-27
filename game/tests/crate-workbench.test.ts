import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import * as F from '../src/farm.ts'
import { createArrangementPhysics, type ArrangementPiece } from '../src/arrangement-physics.ts'
import { isGuardedAction } from '../src/action-click-guard.ts'
import { chickenCarePlayer } from './fixtures/chicken-care-player.ts'

const order = (farm:F.FarmState) => F.getMarketOrders(farm).find(o => o.lane === 'flock')!
const proof: F.PackingResult = {kind:'crate',settled:true,placements:[
  {x:-.4,y:-.2},{x:0,y:-.2},{x:.4,y:-.2},{x:-.2,y:.2},{x:.2,y:.2},
]}
function earned(){
 const p=chickenCarePlayer('shop','packing')
 const day=()=>{
  if(!p.state.feed)p.act('buyFeed')
  p.act('feedChickens')
  for(let hen=0;hen<p.state.flockSize&&p.state.chickenHappiness<5;hen++)p.act('petChicken',hen)
  if(F.getBedAction(p.state,4).kind==='water'){if(!p.state.water)p.act('refillWater');p.act('workBed',4,0)}
  p.act('endDay')
  if(p.state.eggsReady>0)p.act('collectEggs')
 }
 p.act('selectSeed','wheat');p.act('workBed',4,0)
 for(let i=0;i<7&&(p.state.eggs<5||F.getBedStage(p.state.beds[4])!=='ripe');i++)day()
 p.act('workBed',4,0);p.act('packEggCrate',proof);p.act('deliverMarketOrder','flock')
 for(let i=0;i<7&&(p.state.eggs<10||order(p.state).status==='delivered');i++)day()
 assert.deepEqual([p.log.length,p.state.day,p.state.coins,p.state.eggs,p.state.eggCrates,order(p.state).status,order(p.state).reward],
  [44,4,102,13,0,'waiting',62])
 return p.state
}
const initial=earned()
type Options = { onComplete:(result:F.PackingResult)=>boolean|'next-crate'; onNextCrate?:()=>boolean; onCancel:()=>void }
const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
const start=main.indexOf("    case 'arrangement': {"),end=main.indexOf("    case 'market':",start)
assert.ok(start>=0&&end>start)
const mount=stripTypeScriptTypes(`switch('arrangement'){ ${main.slice(start,end)} }`)
function bench(farm=structuredClone(initial)){
 const calls:string[]=[]
 const pending:(()=>void)[]=[]
 const saves:F.FarmState[]=[]
 let options:Options
 const request={kind:'packing',mode:'crate'}
 const env={
  ...F,farm,panel:'arrangement',panelHistory:[{panel:'coop'}],arrangementRequest:request,arrangementGame:undefined,
  dialogContent:{innerHTML:'',querySelector:()=>({})},
  createArrangement(_host:unknown,o:Options){calls.push('mount');options=o;return{}},
  perform(commit:()=>F.ActionResult){const result=commit();if(result.ok)saves.push(structuredClone(farm));return result.ok},
  queueMicrotask(fn:()=>void){pending.push(fn)},
  openPanel(panel:string){calls.push(panel);env.panel=panel},
  leaveScene(){calls.push('back');env.openPanel('coop')},
 }
 runInNewContext(mount,env)
 const flush=()=>{for(const f of pending.splice(0))f()}
 return {farm,env,options:options!,saves,calls,flush}
}

test('earned two-crate contract offers a deliberate second empty crate on the same bench and pays only after a distinct hand-in',()=>{
 const h=bench(); const before=structuredClone(h.farm)
 assert.equal(h.options.onComplete(proof),'next-crate')
 h.flush()
 assert.equal(h.env.panel,'arrangement')
 assert.deepEqual(h.calls,['mount'])
 assert.deepEqual([h.farm.eggs,h.farm.eggCrates,h.farm.coins,h.saves.length], [8,1,102,1])
 assert.deepEqual(h.farm.variants,before.variants)
 assert.equal(order(h.farm).status,'waiting')
 h.options.onComplete(proof)
 assert.equal(h.saves.length,1,'the first settled receipt never spends again')
 const first=structuredClone(h.farm)
 assert.equal(h.options.onNextCrate?.(),true)
 assert.equal(h.options.onNextCrate?.(),false,'one transition, never a second draft on repeat')
 assert.deepEqual(h.farm,first,'starting another draft neither packs nor reserves eggs')
 assert.equal(h.saves.length,1)
 assert.equal(h.options.onComplete({...proof,placements:proof.placements.slice(0,4)}),false)
 assert.deepEqual(h.farm,first)
 assert.equal(h.options.onComplete(proof),true)
 h.options.onComplete(proof);h.flush()
 assert.deepEqual(h.calls,['mount','coop'])
 assert.deepEqual([h.farm.eggs,h.farm.eggCrates,h.farm.coins,h.saves.length], [3,2,102,2])
 assert.equal(order(h.farm).status,'ready')
 assert.deepEqual(F.restoreCurrentFarm(JSON.parse(JSON.stringify(h.farm))),h.farm)
 assert.ok(F.deliverMarketOrder(h.farm,'flock').ok)
 assert.deepEqual([h.farm.eggs,h.farm.eggCrates,h.farm.coins], [3,0,164])
})

test('default one crate and Back survive, and a changed stock or day cannot confirm the quoted second draft',()=>{
 const short=structuredClone(initial)
 assert.ok(F.sellMarketItem(short,'eggs',4).ok)
 const single=bench(short)
 assert.equal(single.options.onComplete(proof),true);single.flush()
 assert.deepEqual([single.env.panel,single.saves.length,single.farm.eggs],['coop',1,4])
 assert.equal(single.options.onNextCrate?.(),false)
 const exit=bench()
 assert.equal(exit.options.onComplete(proof),'next-crate');exit.options.onCancel();exit.flush()
 assert.deepEqual(exit.calls,['mount','back','coop']);assert.equal(exit.saves.length,1)
 assert.equal(exit.options.onNextCrate?.(),false)
 const changed=bench()
 assert.equal(changed.options.onComplete(proof),'next-crate')
 assert.ok(F.sellMarketItem(changed.farm,'eggs',1).ok)
 const quantity=structuredClone(changed.farm)
 assert.equal(changed.options.onNextCrate?.(),false)
 assert.deepEqual(changed.farm,quantity)
 const fulfilled=bench()
 assert.equal(fulfilled.options.onComplete(proof),'next-crate')
 assert.ok(F.packEggCrate(fulfilled.farm,proof).ok)
 assert.ok(F.deliverMarketOrder(fulfilled.farm,'flock').ok)
 const pastOrder=structuredClone(fulfilled.farm)
 assert.equal(fulfilled.options.onNextCrate?.(),false)
 assert.deepEqual(fulfilled.farm,pastOrder);assert.equal(fulfilled.saves.length,1)
 const late=bench()
 assert.equal(late.options.onComplete(proof),'next-crate');assert.equal(late.options.onNextCrate?.(),true)
 assert.ok(F.endDay(late.farm).ok)
 assert.equal(order(late.farm).name,'Поставка к завтраку','even the same order on a new date needs a fresh start')
 const nextDay=structuredClone(late.farm)
 assert.equal(late.options.onComplete(proof),false)
 assert.deepEqual(late.farm,nextDay);assert.equal(late.saves.length,1)
 assert.equal(isGuardedAction('next-egg-crate'),true)
})

test('a settled crate resets to five loose spawn positions and must be physically packed again in the same world',async()=>{
 const pieces:ArrangementPiece[]=Array.from({length:5},(_,i)=>({id:'egg-'+i,slot:'egg',
   position:{x:(i-2)*.55,y:.24,z:.78+(i%2)*.10},half:{x:.195,y:.18,z:.145},mass:.065}))
 const physics=await createArrangementPhysics('crate',pieces)
 const target=physics.target
 const tick=(seconds:number)=>{for(let i=0;i<seconds*120;i++)physics.step(1/120)}
 const pack=()=>{
  for(const [i,piece] of pieces.entries()){
   assert.ok(physics.takePointer(piece.id))
   physics.followPointer({x:(i-2)*.55,y:.41,z:0})
   physics.release()
  }
  tick(3)
  assert.equal(physics.result()?.length,5)
 }
 try{
  tick(1);pack()
  assert.equal(physics.resetCrate(),true)
  assert.equal(physics.target,target)
  assert.equal(physics.result(),undefined)
  assert.equal(physics.heldId(),undefined)
  assert.deepEqual(physics.progress().map(x=>x.placed),[false,false,false,false,false])
  for(const [i,p] of physics.poses().entries()){
   assert.equal(p.id,pieces[i].id)
   for(const key of ['x','y','z'] as const)assert.ok(Math.abs(p.position[key]-pieces[i].position[key])<1e-5)
   assert.deepEqual(p.rotation,{x:0,y:0,z:0,w:1});assert.equal(p.speed,0)
  }
  tick(3);assert.equal(physics.result(),undefined,'empty slot needs new input, not a settling timer')
  pack()
 }finally{physics.dispose()}
})
