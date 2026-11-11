import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getRegularShellSource } from '../src/regular-shell-source.ts';
import { getRequirementHint } from '../src/requirement-guidance.ts';
import { collectShell, endDay, getShellAt, restoreFarm, sail } from '../src/farm.ts';
import { shellReturnFixture } from './fixtures/shell-return.ts';
const request={kind:'stock',item:{kind:'shells',item:'regular',quantity:6}} as const;

test('the exhausted ordinary shore routes home before making a pointless trip to Grove', () => {
  const farm=shellReturnFixture(),before=structuredClone(farm),source=getRegularShellSource(farm);
  assert.equal(source.status,'waiting');assert.equal(source.day,6);assert.deepEqual(source.spots,[1,2]);
  assert.match(source.detail,/2 обычные ракушки/);assert.doesNotMatch(source.detail,/жемчуг/);
  assert.equal(getRequirementHint(farm,request).action.value,'home');
  farm.island='grove';assert.equal(getRequirementHint(farm,request).action.value,'home');
  farm.island='home';assert.deepEqual(getRequirementHint(farm,request).action,{label:'',target:'open-panel',value:'rest'});
  assert.match(getRequirementHint(farm,request).notice!,/игровой день 6/);
  farm.island=before.island;assert.deepEqual(farm,before);
});

test('a visible lunar shell is never mistaken for the missing ordinary material', () => {
  const farm=shellReturnFixture();farm.day=6;farm.island='grove';farm.shellsCollectedToday=[1,2];
  assert.equal(getShellAt(farm,0),'moon');assert.equal(getRegularShellSource(farm).status,'waiting');
  assert.equal(getRegularShellSource(farm).day,7);assert.equal(getRequirementHint(farm,request).action.value,'home');
  farm.shellsCollectedToday=[1];assert.deepEqual(getRegularShellSource(farm).spots,[2]);
  assert.equal(getRequirementHint(farm,request).action.value,'2');
});

test('an all-lunar tomorrow is skipped using the real fresh ledger, not a generic tomorrow promise', () => {
  const farm=shellReturnFixture();farm.day=170;
  assert.equal(getRegularShellSource(farm).day,172);assert.equal(getRegularShellSource(farm).nights,2);
  for(let spot=0;spot<3;spot++)assert.equal(getShellAt({...farm,day:171,shellsCollectedToday:[]},spot),'moon');
});

test('actual sleep resets collection and the forecast matches exactly the ordinary receipts', () => {
  const farm=shellReturnFixture(),forecast=getRegularShellSource(farm),before=structuredClone(farm.shells);
  sail(farm,'home');assert.equal(farm.day,5);assert.deepEqual(farm.shells,before);
  endDay(farm);sail(farm,'grove');const loaded=restoreFarm(JSON.parse(JSON.stringify(farm)))!;assert.ok(loaded);
  assert.deepEqual(loaded.shellsCollectedToday,[]);assert.equal(loaded.day,forecast.day);
  for(const spot of forecast.spots!){assert.equal(getShellAt(loaded,spot),'regular');assert.equal(collectShell(loaded,spot).ok,true);}
  assert.equal(loaded.shells.regular-before.regular,forecast.spots!.length);assert.equal(loaded.shells.moon,0);
  assert.equal(getShellAt(loaded,0),'moon');assert.equal(getRegularShellSource(loaded).day,7);
  assert.ok(restoreFarm(loaded));
});

test('all ledger combinations and first/repeated tides preserve exact type and nearest date', () => {
  for(let day=1;day<=180;day++)for(let bits=0;bits<8;bits++){
    const farm=shellReturnFixture();farm.day=day;farm.shellsCollectedToday=[0,1,2].filter(i=>bits&(1<<i));
    const source=getRegularShellSource(farm);assert.ok(source.day!==undefined);
    for(let at=day;at<source.day!;at++)assert.ok([0,1,2].every(i=>getShellAt({...farm,day:at,shellsCollectedToday:at===day?farm.shellsCollectedToday:[]},i)!=='regular'));
    assert.ok(source.spots!.every(i=>getShellAt({...farm,day:source.day!,shellsCollectedToday:source.day===day?farm.shellsCollectedToday:[]},i)==='regular'));
  }
});

test('forecast is pure and reload-stable; a stale link recalculates after a day or collection changes', () => {
  const farm=shellReturnFixture(),before=structuredClone(farm);
  for(let i=0;i<4;i++)getRegularShellSource(farm);
  assert.deepEqual(farm,before);assert.deepEqual(getRegularShellSource(restoreFarm(JSON.parse(JSON.stringify(farm)))!),getRegularShellSource(farm));
  farm.day=6;farm.shellsCollectedToday=[];farm.island='grove';assert.equal(getRequirementHint(farm,request).action.value,'1');
  farm.shellsCollectedToday=[1];assert.equal(getRequirementHint(farm,request).action.value,'2');
  farm.shellsCollectedToday=[1,2];assert.equal(getRequirementHint(farm,request).action.value,'home');
});

test('local stock stays first, a locked shore stays locked, and rare-shell and shoal hints are unchanged', () => {
  const farm=shellReturnFixture();farm.freight.warehouses.village.shells=3;
  assert.equal(getRequirementHint(farm,request).action.target,'warehouse-supply');
  farm.freight.warehouses.village.shells=0;farm.boatOwned=false;
  assert.equal(getRegularShellSource(farm).status,'locked');assert.notEqual(getRequirementHint(farm,request).action.value,'rest');
  farm.boatOwned=true;farm.island='grove';farm.day=6;farm.shellsCollectedToday=[];
  assert.equal(getRequirementHint(farm,{kind:'stock',item:{kind:'shells',item:'moon',quantity:1}}).action.value,'0');
  assert.match(getRequirementHint(farm,{kind:'stock',item:{kind:'shoalFinds',item:'pearl',quantity:1}}).notice!,/оба вида ракушек/);
});

test('safe integer edge returns no invented future day', () => {
  const farm=shellReturnFixture();farm.day=Number.MAX_SAFE_INTEGER;
  assert.equal(getRegularShellSource(farm).status,'unknown');assert.equal(getRegularShellSource(farm).day,undefined);
});
