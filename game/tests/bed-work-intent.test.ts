import assert from 'node:assert/strict'
import {test} from 'node:test'
import {readFileSync} from 'node:fs'
import {createFarm,workBed,endDay,selectSeed,restoreCurrentFarm} from '../src/farm.ts'
import {saveGardenPlan,followGardenPlan} from '../src/garden-plans.ts'
import {planBedWork,isCurrentBedWork,bedWorkKind,BedPointerGuard} from '../src/bed-work-intent.ts'

const pointer=(timeStamp:number)=>({timeStamp,clientX:300,clientY:400})
function finish(farm:ReturnType<typeof createFarm>,intent:NonNullable<ReturnType<typeof planBedWork>>){
  return isCurrentBedWork(farm,intent)&&workBed(farm,intent.index,0).ok
}

test('two pending harvest intentions cannot silently become harvesting then sowing',()=>{
  let farm=createFarm()
  const first=planBedWork(farm,9)!,second=planBedWork(farm,9)!,before=structuredClone(farm)
  assert.equal(first.kind,'harvest');assert.equal(second.kind,'harvest')
  assert.ok(finish(farm,first));assert.equal(finish(farm,second),false)
  assert.equal(bedWorkKind(farm,second),'wait')
  assert.deepEqual(farm.beds[9],{kind:'tilled'});assert.equal(farm.produce.carrot,3)
  assert.deepEqual(farm.seeds,before.seeds);assert.equal(farm.water,before.water)
  const loaded=restoreCurrentFarm(JSON.parse(JSON.stringify(farm)));assert.ok(loaded);farm=loaded
  assert.ok(finish(farm,planBedWork(farm,9)!),'a fresh separate sow remains possible')
  assert.deepEqual(farm.beds[9],{kind:'crop',crop:'carrot',growth:0,watered:false})
  assert.equal(farm.seeds.carrot,2);assert.equal(farm.water,before.water)
})

test('repeat taps cannot sow immediately after a reduced-motion harvest, but fresh taps can',()=>{
  const farm=createFarm(),guard=new BedPointerGuard()
  const tap=(time:number,index=9,offset=0)=>guard.accepts(index,{...pointer(time),clientX:300+offset})&&finish(farm,planBedWork(farm,index)!)
  assert.ok(tap(100));assert.equal(tap(180,9,20),false,'touch drift inside the same bed is still one gesture')
  assert.deepEqual(farm.beds[9],{kind:'tilled'});assert.equal(farm.seeds.carrot,3)
  assert.ok(tap(601));assert.equal(farm.seeds.carrot,2)
  assert.equal(tap(700),false);assert.equal(farm.water,6)
  assert.ok(tap(1102));assert.equal(farm.water,5)
})

test('field pointer guard reads native inherited event getters and does not suppress other beds',()=>{
  const guard=new BedPointerGuard()
  const native=(stamp:number)=>Object.create({get timeStamp(){return stamp},get clientX(){return 300},get clientY(){return 400}})
  assert.equal(guard.accepts(9,native(100)),true)
  assert.equal(guard.accepts(9,native(180)),false)
  assert.equal(guard.accepts(10,native(200)),true)
  assert.equal(guard.accepts(undefined,native(220)),true)
  assert.equal(guard.accepts(10,native(240)),true,'visiting another place ends the field gesture')
})

test('queued sowing never substitutes a newly selected crop or a changed garden plan',()=>{
  for(const source of ['manual','plan']){
    const farm=createFarm(),beforeSeed=structuredClone(farm.seeds),intent=planBedWork(farm,13)!
    if(source==='manual')assert.ok(selectSeed(farm,'wheat').ok)
    else {const crops=Array(16).fill('wheat');assert.ok(saveGardenPlan(farm,0,{name:'Для хлеба',crops},0).ok);assert.ok(followGardenPlan(farm,0,1).ok)}
    const changed=structuredClone(farm)
    assert.equal(bedWorkKind(farm,intent),'wait');assert.equal(finish(farm,intent),false)
    assert.deepEqual(farm,changed);assert.deepEqual(farm.seeds,beforeSeed)
    assert.ok(finish(farm,planBedWork(farm,13)!));assert.equal(farm.seeds.wheat,beforeSeed.wheat-1)
  }
})

test('changed bed, day, shore or available water cancels work before effects or spending',()=>{
  for(const change of ['bed','day','island','water']){
    const farm=createFarm();assert.ok(workBed(farm,13,0).ok)
    const intent=planBedWork(farm,13)!;assert.equal(intent.kind,'water')
    if(change==='bed')assert.ok(workBed(farm,13,1).ok)
    if(change==='day')assert.ok(endDay(farm).ok)
    if(change==='island')farm.island='grove'
    if(change==='water')farm.water=0
    const before=structuredClone(farm)
    assert.equal(bedWorkKind(farm,intent),'wait',change);assert.equal(finish(farm,intent),false,change)
    assert.deepEqual(farm,before,change)
  }
  const farm=createFarm()
  for(const index of [-1,16,NaN,.5])assert.equal(planBedWork(farm,index),undefined)
  const intent=planBedWork(farm,0)!;assert.ok(finish(farm,intent));assert.equal(finish(farm,intent),false)
  assert.deepEqual(farm.beds[0],{kind:'tilled'});assert.equal(farm.seeds.carrot,3)
})

test('the actual canvas and delayed work path use the pointer and intent boundaries',()=>{
  const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
  const island=readFileSync(new URL('../src/island.ts',import.meta.url),'utf8')
  assert.match(main,/const intent = planBedWork\(farm, index\)/)
  assert.match(main,/island.workBed\(index, \(\) => bedWorkKind\(farm, intent\), \(\) => \{\s*if \(!isCurrentBedWork\(farm, intent\)\) return/)
  assert.match(island,/bedPointerGuard.accepts\(target.target.kind === 'bed' \? target.target.index : undefined, event\)/)
  assert.match(island,/if \(gesture.order.next\(\) !== gesture.kind\) \{ gesture = undefined; return; \}/)
})
