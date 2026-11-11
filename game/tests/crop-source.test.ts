import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cropDefinitions, cropIds, endDay, restoreFarm, workBed } from '../src/farm.ts';
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
