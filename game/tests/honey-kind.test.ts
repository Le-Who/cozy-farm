import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getDiscoveryTask, getSupplyGuidance } from '../src/discovery-path.ts';
import { getRequirementHint } from '../src/requirement-guidance.ts';
import { collectCapeHoney, endDay, getCapeHoney, restoreFarm, sail } from '../src/farm.ts';
import { honeyKindFixture } from './fixtures/honey-kind.ts';
const item={kind:'honey',quantity:1} as const,request={kind:'stock',item} as const;

test('the single wind portion never supplies a requested ordinary-honey ingredient',()=>{
  const farm=honeyKindFixture(),before=JSON.stringify(farm),harvest=getCapeHoney({...farm,island:'cape'});
  assert.equal(harvest.available,true);assert.equal(harvest.honey,0);assert.equal(harvest.windHoney,1);
  assert.equal(getSupplyGuidance(farm,item,'медовый кекс').action.target,'visit-rest');
  assert.deepEqual(getRequirementHint(farm,request).action,{label:'',target:'open-panel',value:'rest'});
  assert.match(getRequirementHint(farm,request).notice!,/Цветочный мёд ×1/);
  assert.equal(JSON.stringify(farm),before);
  farm.island='cape';assert.equal(getRequirementHint(farm,request).action.value,'home');
});

test('first-honey discovery uses the same precise kind and does not promise an empty harvest',()=>{
  const farm=honeyKindFixture();assert.equal(getDiscoveryTask(farm,farm.orientation)!.action.target,'visit-rest');
  assert.match(getDiscoveryTask(farm,farm.orientation)!.detail,/игровой день 9/);
});

test('a second bloom or an ordinary day keeps the immediate harvest available',()=>{
  const farm=honeyKindFixture();farm.island='cape';farm.capeFlowers=[1,1,null];
  assert.equal(getCapeHoney(farm).honey,1);assert.equal(getRequirementHint(farm,request).action.target,'visit-hive');
  farm.capeFlowers=[1,null,null];farm.day=9;
  assert.equal(getCapeHoney(farm).honey,1);assert.equal(getRequirementHint(farm,request).action.target,'visit-hive');
});

test('current flowers determine the next amount, and empty flowers never promise ordinary honey after sleep',()=>{
  const farm=honeyKindFixture();farm.capeFlowers=[1,8,null];
  assert.match(getSupplyGuidance(farm,item,'кекс').detail,/Цветочный мёд ×2/);
  farm.capeFlowers=[null,null,null];
  assert.notEqual(getSupplyGuidance(farm,item,'кекс').action.target,'visit-rest');
  assert.doesNotMatch(getSupplyGuidance(farm,item,'кекс').detail,/Цветочный мёд ×/);
});

test('the optional current rare harvest and the later ordinary harvest keep exact distinct receipts',()=>{
  const farm=honeyKindFixture();sail(farm,'cape');assert.ok(collectCapeHoney(farm).ok);
  assert.equal(farm.honey,0);assert.equal(farm.windHoney,1);
  sail(farm,'home');endDay(farm);sail(farm,'cape');
  const loaded=restoreFarm(JSON.parse(JSON.stringify(farm)))!;assert.ok(loaded);
  assert.ok(collectCapeHoney(loaded).ok);assert.equal(loaded.honey,1);assert.equal(loaded.windHoney,1);
  const after=JSON.stringify(loaded);assert.equal(collectCapeHoney(loaded).ok,false);assert.equal(JSON.stringify(loaded),after);
});

test('bag and valid local warehouse are preferred over waiting, without moving their contents',()=>{
  const farm=honeyKindFixture();farm.capeHoneyOn=7;farm.honey=1;
  assert.equal(getRequirementHint(farm,request).action.value,'inventory');
  farm.honey=0;farm.freight.warehouses.home.honey=1;const before=JSON.stringify(farm);
  assert.equal(getRequirementHint(farm,request).action.target,'warehouse-supply');
  assert.equal(getSupplyGuidance(farm,item,'кекс').action.target,'warehouse-supply');
  assert.equal(JSON.stringify(farm),before);
});

test('reloading and changed day or blooms recompute the route while a closed cape stays closed',()=>{
  const farm=honeyKindFixture();assert.deepEqual(getRequirementHint(restoreFarm(JSON.parse(JSON.stringify(farm)))!,request),getRequirementHint(farm,request));
  farm.capeFlowers[1]=1;assert.equal(getRequirementHint(farm,request).action.value,'cape');
  farm.capeFlowers[1]=null;farm.day=9;assert.equal(getRequirementHint(farm,request).action.value,'cape');
  farm.day=8;farm.boatOwned=false;assert.notEqual(getRequirementHint(farm,request).action.value,'rest');
});

test('guidance matches the real ordinary yield across repeated winds and every simple bloom state',()=>{
  for(let day=2;day<=38;day++)for(let code=0;code<27;code++){
    const farm=honeyKindFixture();farm.day=day;farm.island='cape';
    let mask=code;farm.capeFlowers=farm.capeFlowers.map(()=>{const state=mask%3;mask=Math.floor(mask/3);return state===0?null:state===1?day:day-1});
    const harvest=getCapeHoney(farm),hint=getRequirementHint(farm,request);
    if(harvest.available&&harvest.honey===0){
      assert.equal(hint.action.value,'home');
      const tomorrow=getCapeHoney({...farm,day:day+1});assert.ok(tomorrow.honey>0);
      assert.match(getSupplyGuidance(farm,item,'кекс').detail,new RegExp(`Цветочный мёд ×${tomorrow.honey}`));
    }else if(harvest.available&&harvest.honey>0)assert.equal(hint.action.target,'visit-hive');
  }
});

test('all apiary levels keep their existing mixed harvest and the rare ingredient still has its own route',()=>{
  for(const level of [1,2,3] as const){
    const farm=honeyKindFixture();farm.island='cape';farm.capeLevel=level;farm.capeFlowers=[1,1,1];farm.capeHoneyOn=7;
    assert.ok(restoreFarm(farm));assert.equal(getCapeHoney(farm).honey,level===1?2:3);
    assert.equal(getCapeHoney(farm).windHoney,1);assert.equal(getRequirementHint(farm,request).action.target,'visit-hive');
  }
  const farm=honeyKindFixture();farm.island='cape';
  assert.equal(getRequirementHint(farm,{kind:'stock',item:{kind:'windHoney',quantity:1}}).action.value,'hive');
  assert.equal(getRequirementHint(farm,request).action.value,'home');
});
