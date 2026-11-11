import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createFarm, cropIds, cropDefinitions, endDay, getBedHarvestPreview, getBedTransplantAction, restoreFarm, transplantCrop, workBed, type CropBed } from '../src/farm.ts'
import { exposedTrait, getClimate, traitIds } from '../src/climate.ts'
import { BedTransplantSelection, renderBedTransplant } from '../src/bed-transplant.ts'
import { ActionClickGuard, ActivationKeyGuard, isGuardedAction } from '../src/action-click-guard.ts'

function fixture(crop: CropBed = {kind:'crop',crop:'carrot',growth:0,watered:true,wateredAt:1234,trait:'rainbow'}) {
  const farm = createFarm()
  farm.beds[0] = {...crop}; farm.beds[1] = {kind:'tilled'}
  return farm
}

test('every crop, stage, watering state and trait relocates exactly, changing only two beds', () => {
  for (const crop of cropIds) for (const growth of [0, 1, cropDefinitions[crop].days]) for (const watered of [false, true]) for (const trait of [undefined, ...traitIds]) {
    if (watered && growth >= cropDefinitions[crop].days) continue // Ripe plants are dry in valid saves.
    const plant: CropBed = {kind:'crop',crop,growth,watered,...(watered?{wateredAt:1234}:{}),...(trait?{trait}:{})}
    const farm=fixture(plant), before=structuredClone(farm)
    for(let i=0;i<3;i++)assert.equal(getBedTransplantAction(farm,0,1).available,true)
    assert.deepEqual(farm,before,'preview is pure')
    assert.ok(transplantCrop(farm,0,1).ok)
    const expected=structuredClone(before);expected.beds[0]={kind:'tilled'};expected.beds[1]=plant
    assert.deepEqual(farm,expected,'no resources, work, progress, water, weather reroll or other changes')
    assert.deepEqual(restoreFarm(JSON.parse(JSON.stringify(farm)))?.beds,farm.beds,'all crop properties survive reload')
  }
})

test('invalid, occupied, unprepared, same and away destinations fail atomically', () => {
  for(const [source,destination] of [[0,0],[-1,1],[0,-1],[.5,1],[0,1.5],[99,1],[0,99],[NaN,1],[0,Infinity],[1,0]]) {
    const farm=fixture(),before=structuredClone(farm)
    assert.equal(transplantCrop(farm,source,destination).ok,false);assert.deepEqual(farm,before)
  }
  for(const kind of ['empty','crop','away'] as const) {
    const farm=fixture();if(kind==='away')farm.island='grove';else farm.beds[1]=kind==='empty'?{kind}:{kind,crop:'wheat',growth:0,watered:false}
    const before=structuredClone(farm);assert.equal(transplantCrop(farm,0,1).ok,false);assert.deepEqual(farm,before)
  }
})

test('moving back and forth never grants growth or watering; only the usual night grows the crop', () => {
  for(const watered of [true,false]) {
    const farm=fixture({kind:'crop',crop:'pumpkin',growth:1,watered,...(watered?{wateredAt:1234}:{})}),before=structuredClone(farm)
    for(let i=0;i<20;i++){assert.ok(transplantCrop(farm,0,1).ok);assert.ok(transplantCrop(farm,1,0).ok)}
    assert.deepEqual(farm,before)
    assert.ok(transplantCrop(farm,0,1).ok)
    assert.ok(endDay(farm).ok)
    const plant=farm.beds[1];assert.equal(plant.kind,'crop');if(plant.kind==='crop')assert.equal(plant.growth,1+Number(watered))
    assert.deepEqual(farm.beds[0],{kind:'tilled'})
  }
})

test('ripe crop and picnic forecast stay exact after moving; only harvest consumes the picnic', () => {
  const farm=fixture({kind:'crop',crop:'carrot',growth:1,watered:false,trait:'rainbow'})
  farm.culinary.picnic={day:farm.day,processing:'chunky'}
  const forecast=getBedHarvestPreview(farm,0),before=structuredClone(farm)
  assert.ok(transplantCrop(farm,0,1).ok)
  assert.deepEqual(getBedHarvestPreview(farm,1),forecast);assert.deepEqual(farm.culinary,before.culinary)
  assert.ok(workBed(farm,1).ok)
  assert.equal(farm.produce.carrot-before.produce.carrot,3)
  assert.equal((farm.variants.carrot?.rainbow??0)-(before.variants.carrot?.rainbow??0),1)
  assert.equal(farm.culinary.picnic,null)
})

test('selection, cancellation, redraw and reopening never mutate farm or revive a pending move', () => {
  const farm=fixture(),before=structuredClone(farm),selection=new BedTransplantSelection()
  assert.match(renderBedTransplant(farm,selection),/1\. Выберите культуру/)
  assert.ok(selection.choose(farm,0))
  for(let i=0;i<4;i++)assert.match(renderBedTransplant(farm,selection),/2\. Выберите подготовленную грядку/)
  assert.deepEqual(farm,before)
  selection.reset();assert.equal(selection.selected,undefined);assert.equal(selection.move(farm,1).ok,false)
  assert.deepEqual(farm,before)
  assert.match(renderBedTransplant(farm,new BedTransplantSelection()),/1\. Выберите культуру/)
})

test('stale source or newly occupied destination cannot move a different crop', () => {
  for(const changed of ['crop','growth','watered','wateredAt','trait','destination'] as const) {
    const farm=fixture(),selection=new BedTransplantSelection();selection.choose(farm,0)
    const plant=farm.beds[0] as CropBed
    if(changed==='crop')plant.crop='wheat'
    if(changed==='growth')plant.growth++
    if(changed==='watered'){plant.watered=false;delete plant.wateredAt}
    if(changed==='wateredAt')plant.wateredAt=5678
    if(changed==='trait')plant.trait='dew'
    if(changed==='destination')farm.beds[1]={kind:'crop',crop:'wheat',growth:0,watered:false}
    const before=structuredClone(farm);assert.equal(selection.move(farm,1).ok,false);assert.deepEqual(farm,before)
  }
})

test('a successful move ends selection, double click and held Enter cannot start another move', () => {
  const farm=fixture(),selection=new BedTransplantSelection();selection.choose(farm,0)
  assert.ok(selection.move(farm,1).ok);const moved=structuredClone(farm)
  assert.equal(selection.move(farm,2).ok,false);assert.deepEqual(farm,moved)
  const html=renderBedTransplant(farm,selection)
  assert.match(html,/Пересадить ещё/);assert.doesNotMatch(html,/data-action="transplant-(?:source|destination)"/)
  const guard=new ActionClickGuard(),keys=new ActivationKeyGuard()
  for(const action of ['transplant-source','transplant-destination','transplant-reset'])assert.ok(isGuardedAction(action))
  const click={detail:1,timeStamp:100,clientX:100,clientY:100};guard.remember(click)
  assert.ok(guard.blocks({...click,detail:2,timeStamp:150}))
  assert.equal(keys.blocks({key:'Enter',repeat:false},true),false)
  assert.equal(keys.blocks({key:'Enter',repeat:true},false),true)
  keys.release('Enter');assert.equal(keys.blocks({key:'Enter',repeat:false},false),false)
})

test('unavailable empty gardens explain the missing crop or prepared bed', () => {
  const farm=createFarm(),selection=new BedTransplantSelection();farm.beds=farm.beds.map(()=>({kind:'empty'}))
  const html=renderBedTransplant(farm,selection)
  assert.match(html,/Нет свободных вспаханных/);assert.match(html,/Пока нет культур/)
  assert.equal(selection.choose(farm,0),false)
})


test('relocation does not reroll a new trait even into an exposed bed during rainbow weather', () => {
  const farm=fixture({kind:'crop',crop:'pumpkin',growth:1,watered:false});farm.day=5
  const destination=farm.beds.findIndex((_,index)=>index>0 && exposedTrait(farm.day,getClimate(farm.day).weather,index+1)==='rainbow')
  assert.ok(destination>0);farm.beds[destination]={kind:'tilled'}
  const before=structuredClone(farm)
  assert.ok(transplantCrop(farm,0,destination).ok)
  assert.deepEqual(farm.beds[destination],before.beds[0])
  assert.deepEqual(restoreFarm(JSON.parse(JSON.stringify(farm)))?.beds[destination],before.beds[0])
})
