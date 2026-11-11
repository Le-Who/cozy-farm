import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getWindHoneySource } from '../src/wind-honey-guidance.ts';
import { getSupplyGuidance } from '../src/discovery-path.ts';
import { getRequirementHint } from '../src/requirement-guidance.ts';
import { getApiaryCopy } from '../src/apiary-preview.ts';
import { collectCapeHoney, endDay, getCapeHoney, restoreFarm, sail } from '../src/farm.ts';
import { isGuardedAction } from '../src/action-click-guard.ts';
import { windHoneyFixture } from './fixtures/wind-honey.ts';
const item = {kind:'windHoney',quantity:2} as const;
const hint = (farm: ReturnType<typeof windHoneyFixture>) => getRequirementHint(farm,{kind:'stock',item});

test('ordinary honey availability does not claim to provide the requested rare honey', () => {
  const farm=windHoneyFixture(), source=getWindHoneySource(farm);
  assert.equal(getCapeHoney(farm).available,true);
  assert.equal(getCapeHoney(farm).windHoney,0);
  assert.equal(source.kind,'wait');assert.equal(source.day,13);assert.equal(source.nights,4);
  assert.equal(source.quantity,1);assert.match(source.detail,/нынешним клумбам/);
  assert.deepEqual(hint(farm).action,{label:'Посмотреть прогноз',target:'open-panel',value:'hive'});
  assert.match(getSupplyGuidance(farm,item,'парфе').detail,/игровой день 13/);
  assert.equal(getSupplyGuidance(farm,item,'парфе').action.value,'hive');
  assert.equal(getApiaryCopy(farm).now.available,true);assert.equal(getApiaryCopy(farm).harvest?.honey,4);
});

test('day boundaries and an exhausted wind harvest forecast the next actual rare yield', () => {
  const farm=windHoneyFixture();
  for(const [day,collected,expected] of [[7,6,8],[8,7,8],[8,8,13],[9,8,13],[12,11,13],[13,12,13],[13,13,18]] as const){
    farm.day=day;farm.capeHoneyOn=collected;
    const source=getWindHoneySource(farm);
    assert.equal(source.day,expected);assert.equal(source.kind,day===expected?'ready':'wait');
    if(day===collected)assert.match(source.detail,/уже собран/);
    assert.equal(hint(farm).action.value,'hive');
    assert.doesNotMatch(getSupplyGuidance(farm,item,'парфе').detail,/наполнится завтра/);
  }
});

test('empty beds require explicit planting; a young bed never provides rare honey today', () => {
  const farm=windHoneyFixture();farm.capeLevel=1;farm.capeFlowers=[null,null,null];
  const empty=getWindHoneySource(farm);assert.equal(empty.kind,'plant');assert.equal(empty.day,undefined);
  assert.equal(hint(farm).action.target,'focus-flower');assert.equal(hint(farm).action.value,'0');
  farm.day=8;farm.capeHoneyOn=0;farm.capeFlowers=[8,null,null];
  assert.equal(getWindHoneySource(farm).day,13);
  farm.day=7;farm.capeFlowers=[7,null,null];assert.equal(getWindHoneySource(farm).day,8);
});

test('a single blooming bed gives the rare honey at level one, despite other young beds', () => {
  const farm=windHoneyFixture();farm.day=13;farm.capeLevel=1;farm.capeFlowers=[12,13,null];
  assert.equal(getWindHoneySource(farm).kind,'ready');
  assert.equal(getWindHoneySource(farm).quantity,1);
  assert.equal(collectCapeHoney(farm).ok,true);
  assert.deepEqual([farm.honey,farm.windHoney,farm.beeswax],[0,1,0]);
  assert.equal(getWindHoneySource(farm).day,18);
});

test('locked cape has no date promise, while a local warehouse remains the first source', () => {
  const farm=windHoneyFixture();farm.boatOwned=false;
  assert.equal(getWindHoneySource(farm).kind,'locked');assert.equal(getWindHoneySource(farm).day,undefined);
  assert.notEqual(hint(farm).action.value,'hive');
  farm.boatOwned=true;farm.day=13;farm.capeHoneyOn=13;farm.freight.warehouses.cape.windHoney=2;
  assert.equal(hint(farm).action.target,'warehouse-supply');
});

test('forecast is pure, reload-stable, and recalculates stale day, flower and quota conditions', () => {
  const farm=windHoneyFixture(), before=structuredClone(farm), first=getWindHoneySource(farm);
  for(let i=0;i<5;i++){getWindHoneySource(farm);hint(farm);getApiaryCopy(farm);}
  assert.deepEqual(farm,before);
  const restored=restoreFarm(JSON.parse(JSON.stringify(farm)))!;assert.ok(restored);
  assert.deepEqual(getWindHoneySource(restored),first);
  restored.day=13;assert.equal(getWindHoneySource(restored).kind,'ready');
  restored.capeHoneyOn=13;assert.equal(getWindHoneySource(restored).day,18);
  restored.capeFlowers=[null,null,null];assert.equal(getWindHoneySource(restored).kind,'plant');
  assert.equal(isGuardedAction('show-requirement'),true);
});

test('the forecast equals the real receipt after explicit nights and one manual collection', () => {
  const farm=windHoneyFixture(), expected=getWindHoneySource(farm);
  sail(farm,'home');assert.equal(farm.day,9);assert.equal(farm.windHoney,0);
  for(let i=0;i<expected.nights!;i++)endDay(farm);
  assert.equal(farm.day,expected.day);assert.equal(farm.windHoney,0);assert.equal(farm.capeHoneyOn,8);
  sail(farm,'cape');const restored=restoreFarm(JSON.parse(JSON.stringify(farm)))!;assert.ok(restored);
  assert.equal(collectCapeHoney(restored).ok,true);
  assert.deepEqual([restored.honey,restored.windHoney,restored.beeswax],[3,expected.quantity,1]);
  const once=structuredClone(restored);assert.equal(collectCapeHoney(restored).ok,false);assert.deepEqual(restored,once);
  assert.ok(restoreFarm(JSON.parse(JSON.stringify(restored))));
});

test('forecast matches harvest rules across first wind, repeated cycles, levels and young beds', () => {
  for(let day=1;day<=30;day++)for(const level of [1,2,3] as const)for(const collected of [0,day])for(const age of [0,1]){
    const farm=windHoneyFixture();farm.day=day;farm.capeLevel=level;farm.capeHoneyOn=collected;farm.capeFlowers=[Math.max(1,day-age),null,null];
    const source=getWindHoneySource(farm);assert.ok(source.day!==undefined);
    for(let at=day;at<source.day!;at++){
      const h=getCapeHoney({...farm,day:at});assert.ok(!h.available||h.windHoney===0);
    }
    const exact=getCapeHoney({...farm,day:source.day!});assert.equal(exact.available,true);assert.equal(exact.windHoney,source.quantity);
  }
});

test('forecast handles safe integer limits without an unbounded scan or invented date', () => {
  const farm=windHoneyFixture();farm.day=Number.MAX_SAFE_INTEGER;farm.capeHoneyOn=farm.day;
  assert.equal(getWindHoneySource(farm).kind,'unknown');assert.equal(getWindHoneySource(farm).day,undefined);
});
