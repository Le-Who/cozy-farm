import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createFarm, boatPrice, getProject } from '../src/farm.ts';
import { getRequirementHint, type Requirement } from '../src/requirement-guidance.ts';

test('each missing ingredient has its own source regardless of the onboarding task', () => {
  const farm = createFarm();
  assert.deepEqual(getRequirementHint(farm,{kind:'stock',item:{kind:'fruit',item:'apple',quantity:2}}).action,{label:'К плодовому дереву',target:'visit-tree',value:'0'});
  assert.equal(getRequirementHint(farm,{kind:'stock',item:{kind:'produce',item:'wheat',quantity:1}}).action.value,'4');
  assert.equal(getRequirementHint(farm,{kind:'stock',item:{kind:'eggs',quantity:1}}).action.target,'visit-coop');
});

test('waiting and refilling are hints with no automatic rest or resource transaction', () => {
  const farm = createFarm(); farm.eggsReady=0; farm.chickensFed=true;
  const before=structuredClone(farm),hint=getRequirementHint(farm,{kind:'stock',item:{kind:'eggs',quantity:1}});
  assert.equal(hint.action.target,'focus-place');assert.equal(hint.action.value,'farmhouse');assert.ok(hint.notice);
  assert.deepEqual(farm,before);
  farm.water=0;farm.beds[4]={kind:'crop',crop:'wheat',growth:0,watered:false};
  assert.equal(getRequirementHint(farm,{kind:'stock',item:{kind:'produce',item:'wheat',quantity:1}}).action.value,'well');
});

test('locked resource islands lead through boat and access requirements', () => {
  const farm=createFarm();farm.coins=boatPrice;
  const pear:Requirement={kind:'stock',item:{kind:'fruit',item:'pear',quantity:1}};
  assert.equal(getRequirementHint(farm,pear).action.value,'boat');
  farm.boatOwned=true;
  assert.equal(getRequirementHint(farm,pear).action.value,'grove');
  farm.island='grove';
  assert.equal(getRequirementHint(farm,pear).action.target,'visit-tree');
  const honey=getRequirementHint(farm,{kind:'stock',item:{kind:'honey',quantity:1}});
  assert.equal(honey.action.target,'sail');assert.equal(honey.action.value,'home');
});

test('unmet building and island prerequisites route independently to their own facility', () => {
  const farm=createFarm();
  assert.equal(getRequirementHint(farm,{kind:'building',building:'coop'}).action.value,'coop');
  assert.equal(getRequirementHint(farm,{kind:'journey',island:'village',id:'building-well'}).action.value,'well');
  assert.equal(getRequirementHint(farm,{kind:'stock',item:{kind:'eggBaskets',quantity:1}}).action.value,'coop');
  assert.equal(getRequirementHint(farm,{kind:'journey',island:'cape',id:'specialization'}).action.value,'farmhouse');
});

test('owned delivery stock points to delivery rather than harvesting more', () => {
  const farm=createFarm();farm.handmade.round=2;
  assert.equal(getRequirementHint(farm,{kind:'journey',island:'village',id:'supply-handmade'}).action.target,'village-project');
  assert.equal(getRequirementHint(farm,{kind:'delivery'}).action.target,'guide-delivery');
});

test('rare sources describe a chance and never point at a locked shoal', () => {
  const farm=createFarm();farm.boatOwned=true;farm.island='grove';
  const moon=getRequirementHint(farm,{kind:'stock',item:{kind:'shells',item:'moon',quantity:1}});
  assert.equal(moon.action.value,'harbor');assert.match(moon.notice!,/могут.*лунном приливе/);
  const pearl=getRequirementHint(farm,{kind:'stock',item:{kind:'shoalFinds',item:'pearl',quantity:1}});
  assert.equal(pearl.action.target,'focus-shell');assert.match(pearl.notice!,/оба вида ракушек/);
});

test('exhausted remote sources lead Home to rest without bouncing back to the source island', () => {
  const farm=createFarm();farm.boatOwned=true;farm.island='grove';farm.fishCaughtToday.grove=4;
  const fish:Requirement={kind:'stock',item:{kind:'fish',item:'seaBass',quantity:1}};
  assert.equal(getRequirementHint(farm,fish).action.value,'home');
  farm.island='home';
  assert.deepEqual(getRequirementHint(farm,fish).action,{label:'',target:'focus-place',value:'farmhouse'});
  farm.trees.grove[0]!.fruitReady=0;
  assert.equal(getRequirementHint(farm,{kind:'stock',item:{kind:'fruit',item:'pear',quantity:1}}).action.value,'farmhouse');
});

test('a recipe keeps guiding its remote missing ingredient after arrival', () => {
  const farm=createFarm();farm.boatOwned=true;farm.buildingLevels.farmhouse=3;farm.farmhouseSpecialization='preserves';farm.fruit.apple=1;
  const preserves:Requirement={kind:'stock',item:{kind:'dishes',item:'orchardPreserves',quantity:1}};
  assert.equal(getRequirementHint(farm,preserves).action.value,'grove');
  farm.island='grove';
  assert.equal(getRequirementHint(farm,preserves).action.target,'visit-tree');
  farm.fruit.pear=1;
  assert.equal(getRequirementHint(farm,preserves).action.value,'home');
});

test('honey ingredient links accept one blooming bed and stay Home after the daily harvest', () => {
  const farm = createFarm(); farm.boatOwned = true; farm.day = 2;
  for (const { item } of getProject(farm, 'dock').items) {
    const key = 'item' in item ? `${item.kind}:${item.item}` : item.kind;
    farm.projects.dock[key] = item.quantity;
  }
  farm.capeFlowers = [1, null, 2];
  const honey: Requirement = { kind: 'stock', item: { kind: 'honey', quantity: 1 } };
  const before = structuredClone(farm);
  assert.equal(getRequirementHint(farm, honey).action.value, 'cape');
  farm.island = 'cape';
  assert.equal(getRequirementHint(farm, honey).action.target, 'visit-hive');
  farm.island = before.island;
  assert.deepEqual(farm, before);
  farm.capeHoneyOn = farm.day;
  farm.island = 'cape';
  assert.equal(getRequirementHint(farm, honey).action.value, 'home');
  farm.island = 'home';
  assert.deepEqual(getRequirementHint(farm, honey).action, { label: '', target: 'focus-place', value: 'farmhouse' });
});


test('secondary kitchen ingredient links guide to cooking instead of asking for a duplicate upgrade', () => {
  const farm = createFarm(); farm.buildingLevels.farmhouse = 3;
  farm.farmhouseSpecialization = 'bakery'; farm.farmhouseSecondarySpecialization = 'preserves';
  farm.fruit.apple = 1; farm.fruit.pear = 1;
  assert.equal(getRequirementHint(farm, { kind: 'stock', item: { kind: 'dishes', item: 'orchardPreserves', quantity: 1 } }).action.target, 'kitchen');
  farm.farmhouseSpecialization = 'preserves'; farm.farmhouseSecondarySpecialization = 'bakery';
  farm.produce.wheat = 2; farm.eggs = 1;
  assert.equal(getRequirementHint(farm, { kind: 'stock', item: { kind: 'dishes', item: 'farmhouseBread', quantity: 1 } }).action.target, 'kitchen');
});
