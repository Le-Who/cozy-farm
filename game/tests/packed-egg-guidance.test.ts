import assert from 'node:assert/strict'
import {test} from 'node:test'
import {readFileSync} from 'node:fs'
import {createFarm,restoreFarm,unpackEggBasket,unpackEggCrate,ingredientCount} from '../src/farm.ts'
import {getPackedEggSource} from '../src/packed-egg-guidance.ts'
import {getSupplyGuidance,getDiscoveryTask} from '../src/discovery-path.ts'
import {getRequirementHint} from '../src/requirement-guidance.ts'

function packed(kind: 'basket' | 'crate') {
  const farm=createFarm(); farm.eggs=0; farm.eggsReady=0; farm.chickensFed=true
  if(kind==='basket') {farm.eggBaskets=1;farm.buildingLevels.coop=2}
  else {farm.eggCrates=1;farm.buildingLevels.coop=3;farm.coopSpecialization='packing'}
  return farm
}

test('packed eggs guide both ingredient links and supply hints to the existing coop action without spending',()=>{
  for(const kind of ['basket','crate'] as const){
    const farm=packed(kind),before=structuredClone(farm),item={kind:'eggs' as const,quantity:1}
    const hint=getRequirementHint(farm,{kind:'stock',item}),supply=getSupplyGuidance(farm,item,'тарт')
    assert.deepEqual(hint.action,{label:'К готовым яйцам',target:'open-panel',value:'coop'})
    assert.equal(hint.selector,`[data-action="unpack-egg-${kind}"]`)
    assert.match(hint.notice!,/Распакуйте бесплатно/)
    assert.match(supply.label,/Распакуйте/)
    assert.deepEqual(farm,before)
    assert.deepEqual(restoreFarm(JSON.parse(JSON.stringify(farm))),before)
  }
})

test('the first tart HUD offers an existing package instead of a new morning',()=>{
  for(const kind of ['basket','crate'] as const){
    const farm=packed(kind);farm.fruit.apple=2;farm.produce.wheat=1
    farm.progress={till:1,plant:1,water:1,rest:1,harvest:3,sell:1,feed:1,collect:1}
    const task=getDiscoveryTask(farm,{collections:true,islands:true})!
    assert.match(task.label,/Распакуйте/)
    assert.deepEqual(task.action,{label:'К готовым яйцам',target:'open-panel',value:'coop'})
  }
})

test('remote hints return home before opening the package, without navigation mutations',()=>{
  const farm=packed('basket');farm.boatOwned=true;farm.island='grove'
  const before=structuredClone(farm),item={kind:'eggs' as const,quantity:1}
  assert.equal(getRequirementHint(farm,{kind:'stock',item}).action.target,'sail')
  assert.equal(getSupplyGuidance(farm,item,'тарт').action.value,'home')
  assert.deepEqual(farm,before)
})

test('ready nests retain priority, sufficient loose eggs and ordinary shortages do not suggest unpacking',()=>{
  const farm=packed('basket');farm.eggsReady=1
  assert.equal(getPackedEggSource(farm,1),undefined)
  assert.equal(getSupplyGuidance(farm,{kind:'eggs',quantity:1},'тарт').label,'Соберите свежие яйца')
  farm.eggsReady=0;farm.eggs=1
  assert.equal(getPackedEggSource(farm,1),undefined)
  farm.eggs=0;farm.eggBaskets=0
  assert.equal(getSupplyGuidance(farm,{kind:'eggs',quantity:1},'тарт').action.target,'visit-rest')
  farm.chickensFed=false
  assert.match(getSupplyGuidance(farm,{kind:'eggs',quantity:1},'тарт').label,/Покормите/)
})

test('explicit unpack still releases exactly the stored eggs, with no reward and no duplicate',()=>{
  for(const kind of ['basket','crate'] as const){
    const farm=packed(kind),before=structuredClone(farm),action=kind==='basket'?unpackEggBasket:unpackEggCrate
    assert.equal(ingredientCount(farm,{kind:'eggs',quantity:1}),0,'guidance does not make packed eggs usable ingredients')
    assert.ok(action(farm).ok)
    assert.equal(farm.eggs,kind==='basket'?3:5)
    assert.equal(getPackedEggSource(farm,1),undefined)
    assert.equal(farm.workToday,before.workToday);assert.equal(farm.coins,before.coins)
    assert.deepEqual(farm.progress,before.progress);assert.equal(farm.day,before.day)
    const after=structuredClone(farm);assert.equal(action(farm).ok,false);assert.deepEqual(farm,after)
    assert.ok(restoreFarm(JSON.parse(JSON.stringify(farm))))
  }
})

test('basket requests never unpack their own needed basket and unsafe counts are not proposed',()=>{
  const farm=packed('basket');farm.eggCrates=1;farm.coopSpecialization='packing';farm.buildingLevels.coop=3
  assert.equal(getPackedEggSource(farm,1)?.kind,'basket')
  assert.doesNotMatch(getSupplyGuidance(farm,{kind:'eggBaskets',quantity:1},'ярмарка').label,/Распакуйте/)
  farm.eggs=Number.MAX_SAFE_INTEGER-1
  assert.equal(getPackedEggSource(farm,Number.MAX_SAFE_INTEGER),undefined)
  for(const need of [0,-1,NaN,Infinity,1.5])assert.equal(getPackedEggSource(farm,need),undefined)
})

test('a valid legacy basket at coop one stays actionable, without enabling new packing',()=>{
  const farm=packed('basket');farm.buildingLevels.coop=1
  assert.ok(restoreFarm(JSON.parse(JSON.stringify(farm))))
  assert.equal(getPackedEggSource(farm,1)?.kind,'basket')
  const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
  assert.match(main,/farm.buildingLevels.coop >= 2 \|\| farm.eggBaskets > 0 \? row\('ui-egg-basket'/)
  assert.match(main,/button\('Упаковать', 'pack-egg-basket', farm.buildingLevels.coop >= 2 && farm.eggs >= eggsPerBasket/)
})


test('rare egg guidance never offers unpacking ordinary eggs and keeps the original state',()=>{
  const farm=packed('basket'),before=structuredClone(farm)
  const hint=getRequirementHint(farm,{kind:'stock',item:{kind:'variants',item:'egg',trait:'rainbow',quantity:1}})
  assert.equal(hint.action.target,'focus-place');assert.equal(hint.action.value,'farmhouse')
  assert.equal(hint.selector,undefined);assert.match(hint.notice!,/Редкие разновидности/)
  assert.deepEqual(farm,before)
  const crate=packed('crate');crate.buildingLevels.coop=1
  assert.equal(restoreFarm(JSON.parse(JSON.stringify(crate))),undefined,'crates require the existing level-three packing specialization')
})
