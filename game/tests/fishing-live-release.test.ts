import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { runInNewContext } from 'node:vm'
import * as F from '../src/farm.ts'
import * as M from '../src/fishing-model.ts'
import { createFishingPractice } from '../src/fishing-practice.ts'
import type { FishingGameOptions } from '../src/fishing.ts'

const code = readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
function section(start: string, end: string) {
  const a=code.indexOf(start), b=code.indexOf(end,a+start.length); assert.ok(a>=0 && b>a)
  return code.slice(a,b)
}
// Exercise the production result, recast, close and save callbacks with only DOM/renderer I/O replaced.
function pier(farm: F.FarmState) {
  let mounted!: FishingGameOptions, saved!: F.FarmState
  const host={querySelector:()=>null}
  const control=runInNewContext(stripTypeScriptTypes(
    'let fishingLanding, fishingGame, fishingToken, fishingPractice, pendingSaves=0, saveAvailable=true, saveRecovery;'+
    section('function saveFarm()', "window.addEventListener('beforeunload'")+
    section('function stopFishing()', 'function stopWorkshop()')+
    section('function mountFishing(', 'function pastryChoices()')+
    'function perform(action){ const r=action();if(r.ok)saveFarm();return r.ok } function closeDialog(){stopFishing()} ;({mountFishing,stopFishing})'
  ),{...F,farm,createFishingPractice,dialogContent:{querySelector:()=>host},status(){},island:{setFishing(){}},
    createFishingGame:(_host:unknown,options:FishingGameOptions)=>{mounted=options;return {destroy(){}}},
    saveStore:{save:(value:F.FarmState)=>{saved=structuredClone(value);return Promise.resolve(true)}}})
  return {open(){control.mountFishing();return mounted}, get current(){return mounted}, get saved(){return saved}}
}
const perch={kind:'fish',species:'perch',variant:'regular'} as const
function land(trip: FishingGameOptions) {
  assert.equal(trip.onCast?.(),true)
  const m=M.createFishingModel(trip.capacity,trip.resilience,trip.seed,trip.fish,trip.habitat)
  const target=m.fish.find(f=>f.loot?.kind==='fish' && f.loot.variant==='regular' && f.depth>4 && f.depth<20 && Math.abs(f.x)<3)!
  assert.ok(target);M.castFishing(m)
  for(let i=0;i<2000 && m.phase!=='done';i++) {
    m.targetX=M.fishPosition(target,m.time)+M.fishingCatchMouth(target).x
    if(m.phase==='descending' && m.depth>target.depth+1.5)M.reelFishing(m)
    M.stepFishing(m,1/60)
  }
  assert.equal(m.phase,'done')
  const catches=m.caught.map(id=>M.fishingCatchLoot(m.fish.find(f=>f.id===id)!,trip.fish))
  const result=trip.onFinish({count:catches.length,depth:m.deepest,catches})
  assert.ok(result && typeof result==='object'); assert.deepEqual(catches[result.index],perch)
  return result
}
test('a steered catch is discovered once; only its held fish may swim instead of going home',()=>{
  const farm=F.createFarm(); assert.ok(F.catchFish(farm,true).ok) // one older perch already in stock
  const pierUI=pier(farm), trip=pierUI.open(), choice=land(trip)
  assert.ok(farm.bayDiscoveries.includes('perch'))
  assert.equal(farm.fishCaughtToday.home,2)
  assert.equal(farm.fish.perch,1,'live hook cannot be sold or cooked')
  const keep=F.restoreCurrentFarm(JSON.parse(JSON.stringify(pierUI.saved)))!
  assert.ok(keep);assert.equal(keep.fish.perch,2,'reloading the unopened/undecided result keeps the catch')
  assert.ok(F.sellMarketItem(farm,'fish:perch',1).ok,'only the older fish can be sold')
  assert.equal(F.sellMarketItem(farm,'fish:perch',1).ok,false)
  const before=structuredClone(farm)
  assert.ok(choice.release());assert.deepEqual(farm,before,'releasing removes nothing from stock and refunds no quota')
  assert.deepEqual(F.restoreCurrentFarm(pierUI.saved),farm)
  assert.equal(choice.release(),false);trip.onCancel?.();assert.deepEqual(farm,before)
  assert.equal(F.finishFishingTrip(farm,farm.fishingTripSerial,2).ok,false)
})
test('shore/recast keep by default; no stale callback can take a sold fish or a newer cast',()=>{
  const farm=F.createFarm(), p=pier(farm), first=p.open(), old=land(first)
  first.onAgain?.();assert.equal(farm.fish.perch,1)
  const next=p.current;assert.equal(next.onCast?.(),true)
  assert.equal(first.onFinish({catches:[perch],count:1,depth:2}),false)
  assert.equal(old.release(),false)
  const result=next.onFinish({catches:[perch],count:1,depth:2});assert.ok(result && typeof result==='object')
  next.onCancel?.(); assert.equal(farm.fish.perch,2)
  assert.ok(F.sellMarketItem(farm,'fish:perch',2).ok)
  const after=structuredClone(farm);assert.equal(result.release(),false);assert.deepEqual(farm,after)
  const active=p.open();active.onCast?.();active.onCancel?.()
  assert.equal(active.onFinish({catches:[perch],count:1,depth:2}),false)
  assert.equal(farm.fishCaughtToday.home,2);assert.equal(farm.fish.perch,0)
})
test('mixed hooks hold exactly one admitted ordinary fish, never shell, junk, rare, or practice',()=>{
  const farm=F.createFarm()
  const grant=(loot:M.FishingLoot[])=>F.finishFishingTrip(farm,F.beginFishingTrip(farm).token!,loot,true)
  let r=grant([{kind:'shell',variant:'regular'},{kind:'junk',item:'boot'}]);assert.equal(r.landed,undefined)
  assert.match(r.message,/мусора/);assert.equal(farm.shells.regular,1);assert.equal(farm.fishCaughtToday.home,0)
  r=grant([{kind:'fish',species:'moonfish',variant:'rare'},perch]);assert.equal(r.landed?.index,1);r.landed!.keep()
  assert.equal(farm.fish.moonfish,1);assert.equal(farm.fish.perch,1);assert.equal(farm.fishCaughtToday.home,2)
  const last=grant([perch,perch]);assert.equal(last.landed?.index,0);assert.ok(last.landed?.release())
  assert.equal(farm.fishCaughtToday.home,3);assert.equal(farm.fish.perch,1);assert.equal(F.getFishAction(farm).available,false)
  const before=structuredClone(farm), practice=createFishingPractice(farm)!;practice.cast()
  assert.equal(practice.finish([perch]),true);assert.deepEqual(farm,before)
})
test('release control detaches the actual catch ID, preserves the result, and honours reduced motion',()=>{
  const source=readFileSync(new URL('../src/fishing.ts',import.meta.url),'utf8')
  const slice=(a:string,b:string)=>{const i=source.indexOf(a),j=source.indexOf(b,i+a.length);assert.ok(i>=0&&j>i);return source.slice(i,j)}
  const ui=slice('      for (const [index, loot] of (options.practiceOnly','      again.hidden = !canRecast')
  const motion=slice('      if (swimmingAway?.id === fish.id)', ' else if (caughtIndex >= 0)') // include closing brace
  class Element {
    kids:Element[]=[];textContent='';onclick?:()=>void;removed=false;aria='';hidden=false
    append(...items:Element[]){this.kids.push(...items)}
    addEventListener(type:string,fn:()=>void){if(type==='click')this.onclick=fn}
    setAttribute(key:string,value:string){if(key==='aria-label')this.aria=value}
    remove(){this.removed=true}
  }
  const mesh=()=>({position:{x:1.4,y:-.13,set(x:number,y:number){this.x=x;this.y=y}},scale:{set(){}},rotation:{z:.95},visible:true})
  const farm=F.createFarm(), p=pier(farm), trip=p.open();trip.onCast?.()
  const catches=[{kind:'shell',variant:'regular'} as const,perch]
  const choice=trip.onFinish({count:2,catches,depth:18});assert.ok(choice && typeof choice==='object')
  const groups=[mesh(),mesh()], resultCatches=new Element(), resultSummary=new Element();let focused=false
  const x={options:{},signal:new AbortController().signal,document:{createElement:()=>new Element()},catches,choice,
    model:{caught:[70,12],fish:[{id:12},{id:70}]},fishMeshes:groups.map(group=>({group})),
    resultCatches,resultSummary,again:{hidden:false,focus(){focused=true}},practice:{hidden:true},leave:{},destroyed:false,
    formatRuNumber:String,depth:18,lootName:()=>'',lootArt:()=>'',announce(){},swimmingAway:undefined as undefined|{id:number;age:number},
    fish:{id:12,direction:1},bodyScale:1,dt:1/60,halfWidth:5.3,group:groups[0],reducedMotion:{matches:false}}
  runInNewContext(stripTypeScriptTypes(ui),x)
  assert.equal(resultCatches.kids.length,2);assert.equal(resultCatches.kids[0].kids.length,2,'shell has no release control')
  const button=resultCatches.kids[1].kids[2];assert.equal(button.aria,'Отпустить окуня')
  button.onclick!();assert.equal(x.swimmingAway!.id,12);assert.ok(button.removed && focused);assert.match(resultSummary.textContent,/вернулась/)
  const registered=x.swimmingAway, pose=stripTypeScriptTypes(motion)
  // Quick double activation can't restart the departure or credit an item.
  button.onclick!();assert.equal(x.swimmingAway,registered)
  const run=runInNewContext('(()=>{'+pose+'})',x) as ()=>void
  for(let i=0;i<35;i++)run();assert.ok(groups[0].visible && groups[0].position.x<.4 && groups[0].position.y<-.5)
  x.reducedMotion.matches=true;run();assert.equal(groups[0].visible,false)
  x.reducedMotion.matches=false;for(let i=0;i<44;i++)run();assert.equal(groups[0].visible,false)
  assert.equal(groups[1].position.x,1.4,'the shell stays on the hook')
  assert.equal(farm.fish.perch,0);assert.equal(farm.shells.regular,1);assert.equal(farm.fishCaughtToday.home,1)
})
