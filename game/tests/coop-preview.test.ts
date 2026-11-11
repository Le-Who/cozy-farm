import assert from 'node:assert/strict'
import {test} from 'node:test'
import {collectEggs,createFarm,endDay,feedChickens,getCoopMorning,petChicken,restoreFarm} from '../src/farm.ts'
import {renderCoopCapacityWarning,renderCoopMorning} from '../src/coop-preview.ts'

function emptyGarden(){const farm=createFarm();farm.beds=farm.beds.map(()=>({kind:'empty'}));return farm}

test('full nests explain zero new eggs before and after feeding, without changing the feed action economy',()=>{
  const f=emptyGarden();f.eggsReady=6
  assert.deepEqual(getCoopMorning(f),{capacity:6,capacityAfterRest:6,hatching:false,ready:6,laying:3,addedIfFed:0,blockedIfFed:3,added:0,total:6})
  assert.match(renderCoopMorning(f),/Гнёзда полны · 6\/6/)
  const before=structuredClone(f),result=feedChickens(f)
  assert.equal(result.ok,true);assert.match(result.message,/Гнёзда полны/)
  assert.equal(f.feed,before.feed-1);assert.equal(f.progress.feed,before.progress.feed+1);assert.equal(f.workToday,before.workToday+1)
  assert.equal(f.coins,before.coins+4);assert.equal(f.eggsReady,6)
  const fed=structuredClone(f);assert.equal(feedChickens(f).ok,false);assert.deepEqual(f,fed)
  assert.match(renderCoopMorning(f),/К утру добавится: 0 яиц/)
  endDay(f);assert.equal(f.eggsReady,6)
})

test('partly filled nests show the actual accepted clutch, not the unconstrained production amount',()=>{
  const f=emptyGarden();f.eggsReady=5;f.chickensFed=true
  assert.equal(getCoopMorning(f).added,1);assert.equal(getCoopMorning(f).blockedIfFed,2)
  assert.match(renderCoopMorning(f),/Поместится только 1 яйцо из 3/)
  assert.match(renderCoopCapacityWarning(f,true),/data-action="open-panel" data-value="coop"/)
  assert.doesNotMatch(renderCoopCapacityWarning(f,true),/data-action="collect"/)
  endDay(f);assert.equal(f.eggsReady,6)
})

test('the shared forecast preserves the previous night formula for every capacity, care and feeding state',()=>{
  for(const level of [1,2,3] as const)for(const flock of [4,5])for(let happiness=0;happiness<=5;happiness++){
    const capacity=6+Number(level>=2)*3+Number(flock===5)*3
    for(let ready=0;ready<=capacity;ready++)for(const fed of [false,true]){
      const f=emptyGarden();f.buildingLevels.coop=level;f.flockSize=flock;f.chickenHappiness=happiness;f.eggsReady=ready;f.chickensFed=fed
      const oldFormula=fed?Math.min(capacity,ready+3+Number(level>=2)+(flock-4)+Math.floor(happiness/2)):ready
      const forecast=getCoopMorning(f);assert.equal(forecast.total,oldFormula)
      endDay(f);assert.equal(f.eggsReady,oldFormula);assert.equal(f.chickenHappiness,Math.max(0,happiness-1));assert.equal(f.chickensFed,false)
    }
  }
})

test('a hatch tomorrow does not promise that new hen eggs or extra nest space one morning early',()=>{
  const f=emptyGarden();f.buildingLevels.coop=3;f.coopSpecialization='hatchery';f.day=2;f.hatchDay=3;f.chickensFed=true;f.eggsReady=8
  assert.ok(restoreFarm(f));const morning=getCoopMorning(f)
  assert.equal(morning.capacity,9);assert.equal(morning.capacityAfterRest,12);assert.equal(morning.hatching,true);
  assert.match(renderCoopMorning(f),/После отдыха в гнёздах: 9\/12/);assert.match(renderCoopMorning(f),/кладка ещё рассчитана на прежнюю стаю/);assert.equal(morning.added,1);assert.equal(morning.blockedIfFed,3)
  endDay(f);assert.equal(f.flockSize,5);assert.equal(f.eggsReady,9)
  assert.equal(getCoopMorning(f).capacity,12);assert.ok(restoreFarm(f))
})

test('preview is read-only and reload recomputes it without new saved fields',()=>{
  const f=emptyGarden();f.eggsReady=6;f.chickensFed=true;f.eggTrait='rainbow';f.discoveryPreferences.quiet=true
  const before=structuredClone(f),raw=JSON.stringify(f)
  for(let i=0;i<8;i++){getCoopMorning(f);renderCoopMorning(f);renderCoopCapacityWarning(f,true)}
  assert.deepEqual(f,before)
  const loaded=restoreFarm(JSON.parse(raw))!;assert.ok(loaded)
  assert.deepEqual(getCoopMorning(loaded),getCoopMorning(f));assert.equal(JSON.stringify(f),raw)
})

test('collection frees the nest immediately; ordinary and unusual eggs retain the original split',()=>{
  const f=emptyGarden();f.eggsReady=6;f.eggTrait='rainbow';f.chickensFed=true
  assert.equal(collectEggs(f).ok,true);assert.equal(f.eggsReady,0);assert.equal(f.eggs,5);assert.equal(f.variants.egg?.rainbow,1)
  assert.equal(getCoopMorning(f).added,3);assert.equal(renderCoopCapacityWarning(f,true),'')
  const before=structuredClone(f);assert.equal(collectEggs(f).ok,false);assert.deepEqual(f,before)
  endDay(f);assert.equal(f.eggsReady,3);assert.ok(restoreFarm(f))
})

test('care changes the forecast only through the existing happiness rule and is capped by free space',()=>{
  const f=emptyGarden();f.eggsReady=2;f.chickensFed=true
  assert.equal(getCoopMorning(f).added,3)
  petChicken(f,0);petChicken(f,1)
  assert.equal(getCoopMorning(f).added,4);assert.equal(getCoopMorning(f).blockedIfFed,0)
  petChicken(f,2);petChicken(f,3)
  assert.equal(getCoopMorning(f).added,4);assert.equal(getCoopMorning(f).blockedIfFed,1)
  assert.match(renderCoopMorning(f),/Места для всей кладки не хватит/)
})

test('unfed and unconstrained nests do not promise an automatic morning refill',()=>{
  const f=emptyGarden();f.eggsReady=0
  assert.equal(getCoopMorning(f).added,0);assert.equal(getCoopMorning(f).addedIfFed,3)
  assert.match(renderCoopMorning(f),/Без корма новой кладки не будет/)
  assert.equal(renderCoopCapacityWarning(f),'')
  const before=f.eggsReady;endDay(f);assert.equal(f.eggsReady,before)
})

test('future nest capacity is separate from the current clutch even when a hatching flock was not fed',()=>{
  const f=emptyGarden();f.day=3;f.buildingLevels.coop=3;f.coopSpecialization='hatchery';f.hatchDay=4;f.eggsReady=9
  const before=structuredClone(f),preview=getCoopMorning(f)
  assert.equal(preview.capacity,9);assert.equal(preview.capacityAfterRest,12)
  assert.equal(preview.added,0);assert.equal(preview.addedIfFed,0);assert.equal(preview.total,9)
  assert.match(renderCoopMorning(f),/После кормления и отдыха в гнёздах: 9\/12/)
  assert.deepEqual(f,before)
  endDay(f);assert.equal(f.eggsReady,9);assert.equal(f.flockSize,5)
  assert.equal(getCoopMorning(f).capacity,12);assert.equal(getCoopMorning(f).addedIfFed,3)
})
