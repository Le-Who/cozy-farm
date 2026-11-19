import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import {runInNewContext} from 'node:vm'
import {test} from 'node:test'
import {createFarm, endDay, getBedHarvestPreview, petChicken, pickFruit, restoreCurrentFarm, workBed} from '../src/farm.ts'
import {henFieldRoute,henFieldSources,refreshHenFieldWalk,guideKey,type HenFieldTarget} from '../src/hen-harvest-walk.ts'
import {canWalkWithHen,createHenCompanion,returnHenCompanion,stepHenCompanion,type HenCompanion} from '../src/hen-companion.ts'
import {renderHenFriendship,treatHen} from '../src/hen-friendship.ts'
import {isGuardedAction} from '../src/action-click-guard.ts'
import {defaultHenPositions,isHenGround} from '../src/hen-roaming.ts'

test('earned apple preference: select the actual field action, bird waits at the tree, player may skip or harvest',()=>{
  const f=createFarm(),id=2,home=defaultHenPositions[id]
  assert.ok(petChicken(f,id).ok);assert.ok(pickFruit(f,0).ok);assert.ok(treatHen(f,id,'apple').ok)
  assert.ok(canWalkWithHen(f,id));assert.deepEqual(henFieldSources(f,id),[],'just-picked fruit is not a route')
  assert.ok(endDay(f).ok)
  const islandSource=readFileSync(new URL('../src/island.ts',import.meta.url),'utf8')
  const getRoute=islandSource.slice(islandSource.indexOf('  function fieldRoute('),islandSource.indexOf('  function clearHenCompanion('))
  const startGuide=islandSource.slice(islandSource.indexOf('    startHenGuide('),islandSource.indexOf('    startHenWalk(')).trim().replace(/,$/,'')
  const source=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
  const branch=source.slice(source.indexOf("    case 'hen-guide': {"),source.indexOf("    case 'hen-walk-return': {"))
  const app=(value:string,scene=state)=>runInNewContext(stripTypeScriptTypes("switch ('hen-guide') {"+branch+"}"),{...scene,value})
  const actualTree={kind:'tree' as const,index:0},target={x:1325+1/3,y:573}
  // Native home orchard anchor (1376,553), authored stop and hen's aisle offset, scaled as in Island.
  const sc=(x:number,y:number)=>({x:125.25+x*.75,y:37+y*.75})
  const sceneHen=sc(home.x,home.y),tree=sc(1376,553),nativeHenPoint=(p:typeof tree)=>({x:(p.x-125.25)/.75,y:(p.y-37)/.75})
  let live:{companion?:HenCompanion}={};const visits:HenFieldTarget[]=[]
  const ctx={state:f,world:{available:true},crossing:false,heldHen:null,companion:undefined as HenCompanion|undefined,companionDay:0,
    canWalkWithHen,createHenCompanion,guideKey,henFieldRoute,nativeHenPoint,
    hens:Array.from({length:4},()=>({px:{value:sceneHen.x},py:{value:sceneHen.y}})),henWalkChanged(){},requestPaint(){},
    homeSites:[{target:actualTree,stop:{x:tree.x-23,y:tree.y+15}}],sameTarget:(a:HenFieldTarget,b:HenFieldTarget)=>guideKey(a)===guideKey(b)}
  live=ctx
  const island=runInNewContext(stripTypeScriptTypes(getRoute+';({'+startGuide+'})'),ctx)
  island.focusTarget=(t:HenFieldTarget)=>visits.push(t)
  const state={selectedFriendHen:id,panel:'hen-friendship',dialog:{open:true,close(){this.open=false}},island,notify(){},henFriends:[{},{},{name:'Крошка'}],fieldViewButton:{getAttribute:()=>''}}
  const before=structuredClone(f),html=renderHenFriendship(f,null,true,id,undefined,actualTree)
  const key=html.match(/data-action="hen-guide" data-value="([^"]+)">Пойти за курочкой к яблоне/)?.[1];assert.ok(key);assert.ok(isGuardedAction('hen-guide'))
  app('2:tree:1');app('1:tree:0');assert.ok(!live.companion);assert.ok(state.dialog.open)
  app(key);assert.ok(!state.dialog.open);assert.equal(visits.length,1);assert.equal(guideKey(visits[0]),'tree:0')
  const walk=ctx.companion!;assert.ok(walk);assert.deepEqual({...walk.guide!.stop},target)
  assert.equal(island.startHenGuide(id,'tree:0'),undefined,'double activation never creates a second walk')
  for(let i=0;i<700;i++){const prev={...walk.point};stepHenCompanion(walk,home,home,f.buildingLevels,1/60,i/60);assert.ok(isHenGround(walk.point,f.buildingLevels));assert.ok(Math.hypot(walk.point.x-prev.x,walk.point.y-prev.y)<=155/60+.001)}
  assert.ok(Math.hypot(walk.point.x-target.x,walk.point.y-target.y)<2,'the hen leaves the stationary farmer behind and waits at the actual tree')
  assert.deepEqual(f,before);assert.deepEqual(restoreCurrentFarm(JSON.parse(JSON.stringify(f))),before)
  returnHenCompanion(walk);assert.ok(stepHenCompanion(walk,home,home,f.buildingLevels,0,20,true));assert.deepEqual(f,before)
  assert.ok(pickFruit(f,0).ok);assert.deepEqual(henFieldSources(f,id),[]);assert.equal(f.fruit.apple,before.fruit.apple+2)
})

test('a ripe favorite on another patch is offered only when its aisle is actually reachable',()=>{
  const f=createFarm();assert.ok(workBed(f,6).ok);assert.ok(endDay(f).ok);assert.ok(workBed(f,6).ok);assert.ok(petChicken(f,1).ok);assert.ok(treatHen(f,1,'leafyGreens').ok)
  assert.ok(getBedHarvestPreview(f,15));const source=henFieldSources(f,1);assert.deepEqual(source,[{kind:'bed',index:15}])
  assert.equal(henFieldRoute(f,1,defaultHenPositions[1],()=>({x:-100,y:-100})),undefined)
  const place={x:1053,y:758},route=henFieldRoute(f,1,defaultHenPositions[1],()=>place)!;assert.deepEqual(route.stop,place)
  assert.match(renderHenFriendship(f,null,true,1,undefined,route.target),/data-value="1:bed:15">Пойти за курочкой к зелени/)
  assert.match(renderHenFriendship(f,{id:2,returning:false},true,1,undefined,route.target),/data-action="hen-guide"[^>]*disabled hidden/)
  assert.match(renderHenFriendship(f,null,false,1,undefined,route.target),/data-action="hen-guide"[^>]*disabled hidden/)
  const onlyWalk=structuredClone(f);onlyWalk.henFriendship.hens[1].tasted=[];assert.ok(canWalkWithHen(onlyWalk,1));assert.deepEqual(henFieldSources(onlyWalk,1),[])
  const walk=createHenCompanion(1,defaultHenPositions[1]);walk.guide=route;walk.path=route.path
  refreshHenFieldWalk(f,walk);assert.ok(walk.guide)
  assert.ok(workBed(f,15).ok);refreshHenFieldWalk(f,walk);assert.equal(walk.guide,undefined);assert.deepEqual(walk.path,[])
  assert.deepEqual(henFieldSources(f,1),[]);assert.equal(henFieldRoute(f,1,defaultHenPositions[1],()=>place),undefined)
})
