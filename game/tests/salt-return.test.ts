import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getDiscoveryTask, getSupplyGuidance } from '../src/discovery-path.ts';
import { getRequirementHint } from '../src/requirement-guidance.ts';
import { endDay, gatherSeaSalt, restoreFarm, sail } from '../src/farm.ts';
import { saltReturnFixture } from './fixtures/salt-return.ts';
const item={kind:'seaSalt',quantity:3} as const;
const request={kind:'stock',item} as const;

test('salt quota is checked before another trip from any island',()=>{
  const farm=saltReturnFixture();
  for(const island of ['home','grove','cape','village'] as const){
    farm.island=island;const before=structuredClone(farm),task=getSupplyGuidance(farm,item,'проверка соли');
    assert.equal(task.action.target,island==='home'?'visit-rest':'sail');
    assert.equal(task.action.value,island==='home'?undefined:'home');
    assert.match(task.detail,/2 порции/);assert.match(task.detail,/игровой день 6/);
    assert.deepEqual(farm,before);
  }
});

test('the real unfinished dock task no longer loops home to grove and back',()=>{
  const farm=saltReturnFixture();
  assert.equal(getDiscoveryTask(farm,farm.orientation)!.action.target,'visit-rest');
  farm.island='grove';assert.equal(getDiscoveryTask(farm,farm.orientation)!.action.value,'home');
  sail(farm,'home');assert.equal(getDiscoveryTask(farm,farm.orientation)!.action.target,'visit-rest');
  assert.equal(farm.day,5);assert.equal(farm.seaSalt,0);assert.equal(farm.saltGatheredToday,true);
});

test('the ingredient opens rest at home without sleeping or spending supplies',()=>{
  const farm=saltReturnFixture(),before=JSON.stringify(farm);
  assert.deepEqual(getRequirementHint(farm,request).action,{label:'',target:'open-panel',value:'rest'});
  assert.match(getRequirementHint(farm,request).notice!,/2 порции/);
  assert.equal(JSON.stringify(farm),before);
  assert.ok(restoreFarm(JSON.parse(before)));
});

test('only an explicit night resets salt and real collection yields exactly the announced amount',()=>{
  const farm=saltReturnFixture();const original=structuredClone(farm.projects.dock);
  getSupplyGuidance(farm,item,'причал');getRequirementHint(farm,request);
  assert.equal(farm.day,5);assert.equal(farm.saltGatheredToday,true);
  endDay(farm);assert.equal(farm.day,6);assert.equal(farm.saltGatheredToday,false);
  const loaded=restoreFarm(JSON.parse(JSON.stringify(farm)))!;assert.ok(loaded);
  assert.equal(getSupplyGuidance(loaded,item,'причал').action.value,'grove');
  assert.ok(sail(loaded,'grove').ok);
  assert.equal(getSupplyGuidance(loaded,item,'причал').action.target,'warehouse-supply'); // Existing overnight freight production stays first.
  assert.equal(gatherSeaSalt(loaded).ok,true);assert.equal(loaded.seaSalt,2);assert.equal(loaded.workToday,1);
  const after=JSON.stringify(loaded);assert.equal(gatherSeaSalt(loaded).ok,false);assert.equal(JSON.stringify(loaded),after);
  assert.deepEqual(loaded.projects.dock,original);assert.ok(restoreFarm(loaded));
});

test('day and quota changes are recalculated rather than retaining the old rest route',()=>{
  const farm=saltReturnFixture();assert.match(getSupplyGuidance(farm,item,'цель').detail,/игровой день 6/);
  farm.day=12;assert.match(getSupplyGuidance(farm,item,'цель').detail,/игровой день 13/);
  farm.saltGatheredToday=false;assert.equal(getRequirementHint(farm,request).action.value,'grove');
  farm.island='grove';assert.deepEqual(getRequirementHint(farm,request).action,{label:'',target:'focus-place',value:'salt'});
  farm.saltGatheredToday=true;assert.equal(getRequirementHint(farm,request).action.value,'home');
});

test('available local stock still wins over waiting and a closed shore stays closed',()=>{
  const farm=saltReturnFixture();farm.freight.warehouses.home.seaSalt=3;
  assert.equal(getSupplyGuidance(farm,item,'цель').action.target,'warehouse-supply');
  assert.equal(getRequirementHint(farm,request).action.target,'warehouse-supply');
  farm.freight.warehouses.home.seaSalt=0;farm.boatOwned=false;
  assert.notEqual(getRequirementHint(farm,request).action.value,'rest');
});


test('an already sufficient bag never asks to sleep, travel or gather even with an old quota',()=>{
  const farm=saltReturnFixture();farm.seaSalt=3;farm.boatOwned=false;
  assert.deepEqual(getSupplyGuidance(farm,item,'цель').action,{label:'Открыть запасы',target:'open-panel',value:'inventory'});
  assert.equal(getRequirementHint(farm,request).action.value,'inventory');
  assert.match(getSupplyGuidance(farm,item,'цель').detail,/Дополнительный сбор не нужен/);
  assert.equal(farm.saltGatheredToday,true);assert.equal(farm.day,5);
});
