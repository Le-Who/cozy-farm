import assert from 'node:assert/strict';
import { test } from 'node:test';
import { collectEggs, createFarm, cropDefinitions, cropIds, dishDefinitions, endDay, getBedAction, getCookAction, ingredientCount, pickFruit, restoreFarm, selectSeed, sellMarketItem, workBed, type FarmState } from '../src/farm.ts';
import { followGardenPlan, saveGardenPlan } from '../src/garden-plans.ts';
import { chooseSeedForBed, seedChoice } from '../src/seed-choice.ts';
import { getSupplyGuidance } from '../src/discovery-path.ts';
import { getClimate } from '../src/climate.ts';
import { getRequirementHint } from '../src/requirement-guidance.ts';
import { cropSourceFixture } from './fixtures/crop-source.ts';

const wheat = {kind:'produce',item:'wheat',quantity:1} as const;
const hint = (farm:ReturnType<typeof cropSourceFixture>) => getSupplyGuidance(farm,wheat,'пирог');

test('an already watered nearest harvest does not ask to water unrelated younger beds first', () => {
  const farm=cropSourceFixture(),before=structuredClone(farm);
  assert.equal(hint(farm).action.target,'visit-rest');
  assert.deepEqual(farm,before);
  const loaded=restoreFarm(JSON.parse(JSON.stringify(farm)))!;
  assert.equal(hint(loaded).action.target,'visit-rest');
  endDay(loaded);
  assert.equal(hint(loaded).action.target,'focus-bed');assert.equal(hint(loaded).action.value,'1');
  assert.equal(loaded.beds[0].kind==='crop'&&loaded.beds[0].growth,0);
  assert.ok(workBed(loaded,1).ok);assert.equal(loaded.produce.wheat,cropDefinitions.wheat.yield);
});

test('a dry nearly mature bed wins over a younger watered one and still needs explicit watering', () => {
  const farm=cropSourceFixture();
  farm.beds[0]={kind:'crop',crop:'wheat',growth:0,watered:true};
  farm.beds[1]={kind:'crop',crop:'wheat',growth:1,watered:false};
  const before=structuredClone(farm);
  assert.equal(hint(farm).action.value,'1');assert.deepEqual(farm,before);
  assert.ok(workBed(farm,1).ok);assert.equal(farm.water,1);
  assert.equal(hint(farm).action.target,'visit-rest');
  endDay(farm);
  assert.equal(farm.beds[0].kind==='crop'&&farm.beds[0].growth,1);
  assert.equal(farm.beds[1].kind==='crop'&&farm.beds[1].growth,2);
});

test('equally mature watered beds take precedence without mutating the order of the garden', () => {
  const farm=cropSourceFixture();farm.beds[0]={kind:'crop',crop:'wheat',growth:1,watered:false};
  const before=structuredClone(farm);
  assert.equal(hint(farm).action.target,'visit-rest');assert.deepEqual(farm,before);
});

test('ready crops still win immediately over every growing candidate', () => {
  const farm=cropSourceFixture();farm.beds[3]={kind:'crop',crop:'wheat',growth:2,watered:false};
  assert.equal(hint(farm).action.target,'focus-bed');assert.equal(hint(farm).action.value,'3');
});

test('the same nearest-growth rule covers each crop using its actual maturity', () => {
  for (const crop of cropIds) {
    const farm=cropSourceFixture(),days=cropDefinitions[crop].days;
    farm.beds[0]={kind:'crop',crop,growth:0,watered:false};
    farm.beds[1]={kind:'crop',crop,growth:days-1,watered:true};
    const item={kind:'produce',item:crop,quantity:1} as const,before=structuredClone(farm);
    assert.equal(getSupplyGuidance(farm,item,'проверка').action.target,'visit-rest',crop);
    assert.deepEqual(farm,before);
    endDay(farm);
    assert.equal(getSupplyGuidance(farm,item,'проверка').action.value,'1',crop);
  }
});

test('changed water and travel states are recalculated instead of preserving an old suggested action', () => {
  const farm=cropSourceFixture();farm.beds[1]={kind:'crop',crop:'wheat',growth:1,watered:false};farm.water=0;
  const before=structuredClone(farm);
  assert.equal(hint(farm).action.target,'refill');assert.deepEqual(farm,before);
  farm.beds[1].watered=true;
  assert.equal(hint(farm).action.target,'visit-rest');
  farm.island='grove';farm.boatOwned=true;
  const away=structuredClone(farm);
  assert.equal(hint(farm).action.target,'sail');assert.equal(hint(farm).action.value,'home');assert.deepEqual(farm,away);
});


test('rain tomorrow never substitutes for explicit watering tonight', () => {
  const farm=cropSourceFixture();
  farm.day=Array.from({length:40},(_,i)=>i+1).find(day=>getClimate(day+1).weather==='rain')!;
  farm.beds[0]={kind:'crop',crop:'wheat',growth:0,watered:true};
  farm.beds[1]={kind:'crop',crop:'wheat',growth:1,watered:false};
  assert.equal(hint(farm).action.value,'1');
  const ignored=structuredClone(farm);endDay(ignored);
  assert.deepEqual(ignored.beds[1].kind==='crop'&&[ignored.beds[1].growth,ignored.beds[1].watered],[1,true]);
  assert.ok(workBed(farm,1).ok);endDay(farm);
  assert.equal(farm.beds[1].kind==='crop'&&farm.beds[1].growth,2);
});

test('the kitchen hint follows the same choice and remains pure before and after a changed crop', () => {
  const farm=cropSourceFixture(),requirement={kind:'stock',item:wheat} as const;
  const before=structuredClone(farm),restHint=getRequirementHint(farm,requirement);
  assert.equal(restHint.action.target,'focus-place');assert.equal(restHint.action.value,'farmhouse');
  assert.match(restHint.notice!,/уже полита/);assert.deepEqual(farm,before);
  farm.beds[1]={kind:'tilled'};
  const changed=structuredClone(farm),waterHint=getRequirementHint(farm,requirement);
  assert.equal(waterHint.action.target,'focus-bed');assert.equal(waterHint.action.value,'0');assert.deepEqual(farm,changed);
});

function pieFarmWithPlan(manual: 'wheat' | 'carrot', plannedWheat: boolean) {
  let farm = createFarm();
  const act = (action: (current: FarmState) => {ok:boolean;message:string}) => {
    const result = action(farm);
    assert.ok(result.ok, result.message);
    const restored = restoreFarm(JSON.parse(JSON.stringify(farm)));
    assert.deepEqual(restored, farm);
    farm = restored!;
  };
  act(collectEggs); act(farm => pickFruit(farm, 0));
  act(farm => workBed(farm, 4)); act(farm => workBed(farm, 11));
  act(endDay); act(farm => workBed(farm, 11));
  assert.equal(farm.day, 2);
  assert.equal(farm.produce.wheat, 6);
  act(farm => sellMarketItem(farm, 'produce:wheat', 6));
  act(farm => selectSeed(farm, manual));
  const crops: (typeof cropIds[number] | null)[] = farm.beds.map(() => null);
  crops[4] = 'cabbage'; crops[13] = plannedWheat ? 'wheat' : 'cabbage';
  if (!plannedWheat) crops[11] = 'cabbage';
  act(farm => saveGardenPlan(farm, 0, {name:'На пирог', crops}, farm.gardenPlans.revision));
  act(farm => followGardenPlan(farm, 0, farm.gardenPlans.revision));
  assert.deepEqual(dishDefinitions.orchardTart.ingredients.map(item => ingredientCount(farm, item)), [2, 0, 1]);
  assert.equal(getCookAction(farm,'orchardTart').available, false);
  return farm;
}

for (const manual of ['wheat','carrot'] as const) {
  test(`the pie's wheat hint uses the matching tilled plan slot, not manual ${manual}`, () => {
    const farm = pieFarmWithPlan(manual, true), before = structuredClone(farm);
    const item = dishDefinitions.orchardTart.ingredients[1];
    assert.deepEqual(item, wheat);
    const {action} = getRequirementHint(farm,{kind:'stock',item});
    assert.match(getBedAction(farm,4).label, /капуста/);
    assert.deepEqual(action, {label:'Посеять: пшеница',target:'focus-bed',value:'13'});
    assert.deepEqual(farm, before);

    assert.ok(workBed(farm,Number(action.value)).ok);
    assert.equal(farm.beds[13].kind === 'crop' && farm.beds[13].crop,'wheat');
    assert.deepEqual(farm.beds[4],before.beds[4]);
    assert.deepEqual(farm.seeds,{...before.seeds,wheat:before.seeds.wheat-1});
    assert.deepEqual(farm.gardenPlans,before.gardenPlans);
    assert.equal(farm.selectedSeed,manual);
  });
}

test('when all tilled slots are assigned to cabbage, a wheat hint offers the existing deliberate manual choice', () => {
  const farm = pieFarmWithPlan('wheat', false), before = structuredClone(farm);
  const {action,selector} = getRequirementHint(farm,{kind:'stock',item:wheat});
  assert.equal(action.target,'open-panel'); assert.equal(action.value,'seeds');
  assert.match(selector!,/preview-seed.*wheat/);
  assert.deepEqual(farm,before);
  const choice = seedChoice(farm,'wheat');
  assert.match(choice.detail,/выключит посев по плану/);
  assert.ok(chooseSeedForBed(farm,'wheat',undefined,choice.token).ok);
  assert.equal(farm.gardenPlans.active,null);
  assert.deepEqual(farm.beds,before.beds); assert.deepEqual(farm.seeds,before.seeds);
});

test('growth-night comparisons match actual care across every crop and weather window', () => {
  for (const crop of cropIds) for (let day=1;day<=22;day++) {
    const farm=cropSourceFixture(),days=cropDefinitions[crop].days;
    farm.day=day;
    farm.beds[0]={kind:'crop',crop,growth:0,watered:true};
    farm.beds[1]={kind:'crop',crop,growth:days-1,watered:false};
    const item={kind:'produce',item:crop,quantity:1} as const;
    const next=getSupplyGuidance(farm,item,'срок');
    if(days===1)assert.equal(next.action.target,'visit-rest');
    else {assert.equal(next.action.target,'focus-bed');assert.equal(next.action.value,'1');}
    const ignored=structuredClone(farm);endDay(ignored);
    assert.equal(ignored.beds[1].kind==='crop'&&ignored.beds[1].growth,days-1,`${crop}, day ${day}: rain cannot grow a dry bed tonight`);
    assert.ok(workBed(farm,1).ok);endDay(farm);
    assert.equal(farm.beds[1].kind==='crop'&&farm.beds[1].growth,days,`${crop}, day ${day}: explicit care yields the next morning`);
  }
});
