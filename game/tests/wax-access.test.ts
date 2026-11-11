import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getRequirementHint } from '../src/requirement-guidance.ts';
import { collectCapeHoney, endDay, getCapeUpgrade, getCapeWax, restoreFarm, sail, upgradeCape } from '../src/farm.ts';
import { waxAccessFixture } from './fixtures/wax-access.ts';
const request={kind:'stock',item:{kind:'beeswax',quantity:4}} as const;

test('wax level requirement takes priority over a harvest already taken today',()=>{
  const farm=waxAccessFixture(),before=structuredClone(farm);
  assert.equal(getRequirementHint(farm,request).action.value,'cape');
  farm.island='cape';const hint=getRequirementHint(farm,request);
  assert.deepEqual(hint.action,{label:'',target:'open-panel',value:'cape-upgrade'});
  assert.match(hint.notice!,/воск/);assert.doesNotMatch(hint.notice!,/завтра/);
  assert.equal(getCapeWax(farm),0);assert.equal(getCapeWax({...farm,day:farm.day+1}),0);
  farm.island=before.island;assert.deepEqual(farm,before);
});

test('the same prerequisite remains before the first harvest or when flowers are not ready',()=>{
  const farm=waxAccessFixture();farm.island='cape';farm.capeHoneyOn=0;farm.honey=0;
  for(const flowers of [[1,1,1],[5,5,5],[null,null,null]] as const){
    farm.capeFlowers=[...flowers];const before=structuredClone(farm);
    assert.equal(getRequirementHint(farm,request).action.value,'cape-upgrade');
    assert.equal(getCapeWax(farm),0);assert.deepEqual(farm,before);
    if(flowers[0]!==1)assert.match(getCapeUpgrade(farm)!.reason,/цветения/);
  }
});

test('viewing cannot purchase an upgrade and insufficient funds keep it unavailable',()=>{
  const farm=waxAccessFixture();farm.island='cape';farm.coins=20;const before=JSON.stringify(farm);
  getRequirementHint(farm,request);assert.equal(getCapeUpgrade(farm)!.available,false);
  assert.equal(upgradeCape(farm).ok,false);assert.equal(JSON.stringify(farm),before);
});

test('actual purchase and explicit next morning are both needed after today was harvested',()=>{
  const farm=waxAccessFixture();farm.island='cape';
  assert.ok(upgradeCape(farm).ok);assert.equal(farm.capeLevel,2);assert.equal(farm.coins,32);assert.equal(farm.honey,0);
  assert.equal(farm.beeswax,0);assert.equal(collectCapeHoney(farm).ok,false);
  assert.equal(getRequirementHint(farm,request).action.value,'home');
  sail(farm,'home');endDay(farm);sail(farm,'cape');
  const loaded=restoreFarm(JSON.parse(JSON.stringify(farm)))!;assert.ok(loaded);
  const before=loaded.beeswax;assert.ok(collectCapeHoney(loaded).ok);assert.equal(loaded.beeswax-before,1);
  const raw=JSON.stringify(loaded);assert.equal(collectCapeHoney(loaded).ok,false);assert.equal(JSON.stringify(loaded),raw);
  assert.ok(restoreFarm(loaded));
});

test('a current local wax supply at the unlocked level stays ahead of waiting',()=>{
  const farm=waxAccessFixture();farm.capeLevel=2;farm.freight.warehouses.village.beeswax=4;
  assert.equal(getRequirementHint(farm,request).action.target,'warehouse-supply');
  farm.capeLevel=1;assert.equal(getRequirementHint(farm,request).action.value,'cape');
});

test('reload and changed level recompute the route, without altering ordinary honey or locked access',()=>{
  const farm=waxAccessFixture();farm.island='cape';
  assert.deepEqual(getRequirementHint(restoreFarm(JSON.parse(JSON.stringify(farm)))!,request),getRequirementHint(farm,request));
  farm.capeLevel=2;assert.equal(getRequirementHint(farm,request).action.value,'home');
  farm.capeHoneyOn=4;assert.equal(getRequirementHint(farm,request).action.target,'visit-hive');
  farm.capeLevel=1;farm.capeHoneyOn=5;
  assert.equal(getRequirementHint(farm,{kind:'stock',item:{kind:'honey',quantity:4}}).action.value,'home');
  farm.boatOwned=false;assert.notEqual(getRequirementHint(farm,request).action.value,'cape-upgrade');
});

test('a night without building the apiary still yields no wax through the real collection function',()=>{
  const farm=waxAccessFixture();sail(farm,'home');endDay(farm);sail(farm,'cape');
  assert.equal(farm.capeLevel,1);assert.ok(collectCapeHoney(farm).ok);assert.equal(farm.beeswax,0);
  assert.equal(farm.capeHoneyOn,6);assert.ok(restoreFarm(farm));
});

test('an already sufficient bag takes priority over the exhausted daily harvest and any further purchase',()=>{
  const farm=waxAccessFixture();farm.capeLevel=2;farm.beeswax=4;const before=JSON.stringify(farm);
  assert.deepEqual(getRequirementHint(farm,request).action,{label:'',target:'open-panel',value:'inventory'});
  assert.match(getRequirementHint(farm,request).notice!,/Дополнительный сбор не нужен/);
  assert.equal(JSON.stringify(farm),before);assert.ok(restoreFarm(farm));
});
