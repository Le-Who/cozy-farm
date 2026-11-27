import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import test from 'node:test'
import {runInNewContext} from 'node:vm'
import * as F from '../src/farm.ts'
import * as H from '../src/hen-friendship.ts'
import * as C from '../src/hen-companion.ts'
import * as O from '../src/hen-harvest-walk.ts'
import {defaultHenPositions,isHenGround,projectHenToGround} from '../src/hen-roaming.ts'
import {chickenCarePlayer} from './fixtures/chicken-care-player.ts'

const read=(p:string)=>readFileSync(new URL(p,import.meta.url),'utf8')
const part=(s:string,a:string,b:string)=>{const i=s.indexOf(a),j=s.indexOf(b,i+1);assert.ok(i>=0&&j>i,[a,b]);return s.slice(i,j)}
const scene=read('../src/island.ts'),layout=read('../src/lavender-layout.ts'),main=read('../src/main.ts')
const vm=(body:string,scope:Record<string,unknown>)=>runInNewContext(stripTypeScriptTypes(body),scope)
const authored=part(layout,'const origin =','function sceneBox(').replaceAll('export ','')
 +part(layout,'export const orchard =','export const docks =').replaceAll('export ','')
 +part(scene,'function orchardAreas(','const homeSites')
 +part(scene,'const sceneOrigin=','const WORK_MS')
 +part(scene,'  function fieldRoute(','  function clearHenCompanion(')
 +'({scenePoint,nativeHenPoint,orchardAreas,'+part(scene,'    henWalkAvailable():','    isCrossing():')+'})'
const logic=part(main,"    case 'hen-walk-start': {","    case 'hen-friendship-open': {")
const hen=4, ripeTree={kind:'tree' as const,index:0}
const payload='4:tree:0'
const copy=(f:F.FarmState)=>{const v=F.restoreCurrentFarm(JSON.parse(JSON.stringify(f)));assert.deepEqual(v,f);return v!}
function earnedDay5(){
 const p=chickenCarePlayer('garden','hatchery')
 for(let d=1;d<=3;d++){p.day();p.act('endDay')}
 assert.deepEqual([p.log.length,p.state.day,p.state.flockSize,p.state.fruit.apple,p.state.henFriendship.hens[hen].points],[67,4,5,0,0])
 p.act('petChicken',hen);p.act('pickFruit',0);assert.ok(H.treatHen(p.state,hen,'apple').ok);p.act('endDay')
 assert.deepEqual([p.state.day,p.state.island,p.state.coins,p.state.fruit.apple,p.state.henFriendship.hens[hen].points,p.state.trees.home[0]!.fruitReady],[5,'home',150,1,3,2])
 assert.deepEqual(O.henFieldSources(p.state,hen),[ripeTree])
 return copy(p.state)
}
type Point={x:number;y:number}
function world(farm:F.FarmState){
 const ctx={...C,...O,state:farm,world:{available:true},crossing:false,heldHen:null,companion:undefined as C.HenCompanion|undefined,companionDay:0,
  docks:{home:{entry:{y:0},end:{x:0,y:0},boat:{x:0,y:0}}},grove:{treeSpots:[]},mapped:(p:Point)=>p,
  homeSites:[],hens:[] as {px:{value:number};py:{value:number}}[],sameTarget:(a:O.HenFieldTarget,b:O.HenFieldTarget)=>O.guideKey(a)===O.guideKey(b),
  henWalkChanged(){},requestPaint(){}}
 const island=vm(authored,ctx)
 const bases=defaultHenPositions.map(p=>projectHenToGround(p,farm.buildingLevels))
 ctx.hens=bases.map(p=>{const s=island.scenePoint(p.x,p.y);return {px:{value:s.x},py:{value:s.y}}})
 ctx.homeSites=island.orchardAreas('home')
 const focus:O.HenFieldTarget[]=[]
 island.focusTarget=(t:O.HenFieldTarget)=>focus.push(t)
 let closed=0
 const press=(action:string,value:string,selectedFriendHen=hen)=>vm('switch(action){'+logic+'}',{
  action,value,selectedFriendHen,panel:'hen-friendship',dialog:{open:true,close(){closed++}},fieldViewButton:{getAttribute:()=>''},notify(){},henFriends:H.henFriends,island,
 })
 const render=()=>H.renderHenFriendship(farm,island.henWalkStatus(),island.henWalkAvailable(),hen,()=>'',
  island.henFieldTarget(hen))
 const advance=(farmer:Point,ticks:number,seconds=0)=>{
  assert.ok(ctx.companion)
  const bird=ctx.companion
  for(let n=1;n<=ticks;n++){
   const past=bird.point
   const done=C.stepHenCompanion(bird,farmer,bases[bird.id],farm.buildingLevels,1/60,seconds+n/60)
   assert.ok(isHenGround(bird.point,farm.buildingLevels))
   assert.ok(Math.hypot(bird.point.x-past.x,bird.point.y-past.y)<=155/60+.01)
   const p=island.scenePoint(bird.point.x,bird.point.y)
   ctx.hens[bird.id].px.value=p.x;ctx.hens[bird.id].py.value=p.y
   if(done){ctx.companion=undefined;break}
  }
 }
 return {ctx,island,focus,bases,press,render,advance,get closed(){return closed}}
}
const guideTag=(html:string)=>html.match(/<button[^>]* data-action="hen-guide"[^>]*>[^<]*<\/button>/)?.[0]??''
const enabled=(html:string)=>guideTag(html).includes('data-value="'+payload+'">Пойти за курочкой к яблоне')
test('earned fifth hen redirects the very same active walk to the ripe apple tree only on her explicit existing action',()=>{
 const f=earnedDay5(),before=copy(f),w=world(f)
 assert.ok(enabled(w.render()),'the fresh, already-lawful guide remains available')
 w.press('hen-walk-start','4')
 w.advance({x:655,y:706},186)
 const live=w.ctx.companion!
 const point={...live.point}
 assert.ok(Math.hypot(point.x-w.bases[hen].x,point.y-w.bases[hen].y)>100)
 assert.ok(enabled(w.render()),'a lawful ripe tree is still reachable if this same hen is already following')
 assert.equal(w.ctx.companion,live);assert.equal(live.guide,undefined);assert.deepEqual(f,before,'opening and drawing are not a guide or harvest')
 w.press('hen-guide','4:tree:1');assert.equal(live.guide,undefined);assert.equal(w.closed,1)
 w.press('hen-guide',payload)
 assert.equal(w.ctx.companion,live,'do not replace the existing active hen')
 assert.deepEqual(live.point,point,'no teleport to the orchard, coop or new spawn')
 assert.deepEqual(w.focus,[ripeTree]);assert.equal(w.closed,2,'ordinary guide restores world focus once')
 assert.match(guideTag(w.render()),/disabled hidden/)
 w.press('hen-guide',payload);assert.equal(w.ctx.companion,live);assert.equal(w.closed,2)
 w.advance({x:655,y:706},640,3.1)
 assert.ok(Math.hypot(live.point.x-1325.3333333333333,live.point.y-573)<2)
 assert.deepEqual(f,before,'moving and waiting at the orchard do not save, collect, pay or add friendship')
 assert.ok(F.pickFruit(f,0).ok);assert.equal(f.fruit.apple,2);assert.equal(f.variants.apple?.rainbow,1)
})

test('no gesture overrides a different bird, a returning one, or an orchard that is no longer ripe',()=>{
 const f=earnedDay5(),other=copy(f)
 assert.ok(H.treatHen(other,2,'apple').ok);assert.ok(C.canWalkWithHen(other,2))
 const a=world(other);a.press('hen-walk-start','2',2)
 const wrong=a.ctx.companion!;assert.equal(wrong.id,2);assert.match(guideTag(a.render()),/disabled hidden/)
 a.press('hen-guide',payload);assert.equal(a.ctx.companion,wrong);assert.equal(wrong.guide,undefined);assert.deepEqual(a.focus,[])
 const b=world(copy(f));b.press('hen-walk-start','4');b.press('hen-walk-return','4')
 const returning=b.ctx.companion!
 assert.ok(returning.returning);assert.match(guideTag(b.render()),/disabled hidden/)
 b.press('hen-guide',payload);assert.equal(b.ctx.companion,returning);assert.equal(returning.guide,undefined)
 const c=world(f);c.press('hen-walk-start','4')
 assert.ok(F.pickFruit(f,0).ok);const picked=copy(f)
 c.press('hen-guide',payload);assert.equal(c.ctx.companion?.guide,undefined);assert.deepEqual(c.focus,[]);assert.deepEqual(f,picked)

 // The live update used while reading the card agrees with initial rendering.
 const button={dataset:{value:'4',action:'hen-walk-start'},disabled:false,textContent:''}
 const reason={textContent:''}, lead={dataset:{value:''},hidden:true,disabled:true,textContent:''}
 const row={querySelector(s:string){return s==='button'?button:reason}}
 const root={querySelector(s:string){return s==='.hen-walk-choice'?row:lead}} as unknown as HTMLElement
 const untouched=earnedDay5(),before=copy(untouched)
 H.refreshHenWalkChoice(root,untouched,{id:4,returning:false},true,ripeTree)
 assert.deepEqual([lead.hidden,lead.disabled,lead.dataset.value],[false,false,payload])
 for(const status of [{id:2,returning:false},{id:4,returning:true},{id:4,returning:false,guiding:true}]){
  H.refreshHenWalkChoice(root,untouched,status,true,ripeTree);assert.ok(lead.hidden&&lead.disabled)
 }
 assert.deepEqual(untouched,before)
})
