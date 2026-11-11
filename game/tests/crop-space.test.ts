import assert from 'node:assert/strict';
import {test} from 'node:test';
import {cropDefinitions,cropIds,endDay,workBed,restoreFarm,getBedHarvestPreview} from '../src/farm.ts';
import {getNextHarvestBed} from '../src/crop-guidance.ts';
import {getSupplyGuidance} from '../src/discovery-path.ts';
import {getRequirementHint} from '../src/requirement-guidance.ts';
import {cropSpaceFixture} from './fixtures/crop-space.ts';
const item={kind:'produce',item:'wheat',quantity:1} as const;
const supply=(farm:ReturnType<typeof cropSpaceFixture>)=>getSupplyGuidance(farm,item,'тарт');
const hint=(farm:ReturnType<typeof cropSpaceFixture>)=>getRequirementHint(farm,{kind:'stock',item});

test('a full garden waits for the already watered nearest harvest rather than watering a slower first bed',()=>{
 const farm=cropSpaceFixture(),before=structuredClone(farm);
 assert.equal(getNextHarvestBed(farm),1);assert.equal(supply(farm).action.target,'visit-rest');
 assert.equal(hint(farm).action.target,'focus-place');assert.equal(hint(farm).action.value,'farmhouse');
 assert.match(hint(farm).notice!,/Все грядки заняты/);assert.match(hint(farm).notice!,/Грядка 2 \(морковь\): уже полита/);
 assert.match(hint(farm).notice!,/1 ночь/);assert.match(hint(farm).notice!,/Нужная культура пока не посеяна/);
 assert.deepEqual(farm,before);assert.deepEqual(hint(restoreFarm(JSON.parse(JSON.stringify(farm)))!),hint(farm));
});

test('nearer dry crops still require explicit care or refill, not immediate rest',()=>{
 const farm=cropSpaceFixture();farm.beds[1]={kind:'crop',crop:'carrot',growth:0,watered:false};farm.beds[0]={kind:'crop',crop:'pumpkin',growth:1,watered:true};
 assert.equal(supply(farm).action.target,'focus-bed');assert.equal(supply(farm).action.value,'1');assert.match(supply(farm).detail,/сначала нужен полив/);
 farm.water=0;assert.equal(supply(farm).action.target,'refill');assert.equal(hint(farm).action.value,'well');
});

test('equal growth steps prefer the already watered bed and ready harvest always wins',()=>{
 const farm=cropSpaceFixture();farm.beds[0]={kind:'crop',crop:'carrot',growth:0,watered:false};
 assert.equal(getNextHarvestBed(farm),1);farm.beds[2]={kind:'crop',crop:'pumpkin',growth:3,watered:false};
 assert.equal(supply(farm).action.value,'2');assert.match(supply(farm).detail,/Урожай уже готов/);
 assert.doesNotMatch(supply(farm).detail,/До зрелости/);
});

test('existing requested crops and free plots keep their original routes',()=>{
 const farm=cropSpaceFixture();farm.beds[2]={kind:'crop',crop:'wheat',growth:0,watered:false};
 assert.equal(supply(farm).action.value,'2');assert.doesNotMatch(supply(farm).id,/crop-space$/);
 farm.beds[2]={kind:'tilled'};assert.equal(supply(farm).action.value,'2');assert.match(supply(farm).label,/Посеять/);
 farm.beds[2]={kind:'empty'};assert.equal(supply(farm).action.value,'2');assert.match(supply(farm).label,/Вскопать/);
});

test('current stock, seeds and changed plots are rechecked before another visit',()=>{
 const farm=cropSpaceFixture();farm.boatOwned=true;farm.freight.warehouses.home['wheat']=1;
 assert.equal(hint(farm).action.target,'warehouse-supply');farm.freight.warehouses.home={};
 farm.seeds.wheat=0;assert.equal(supply(farm).action.target,'visit-market');farm.seeds.wheat=3;
 farm.beds[1]={kind:'crop',crop:'pumpkin',growth:0,watered:false};
 assert.equal(supply(farm).action.value,'0');assert.match(supply(farm).detail,/3 ночи/);
 farm.island='grove';const before=structuredClone(farm);assert.equal(supply(farm).action.target,'sail');assert.equal(supply(farm).action.value,'home');assert.deepEqual(farm,before);
});

test('one explicit night grows the ready source but never frees or replants its bed automatically',()=>{
 const farm=cropSpaceFixture(),before=structuredClone(farm);endDay(farm);
 assert.equal(farm.beds[0].kind==='crop'&&farm.beds[0].growth,0);assert.ok(getBedHarvestPreview(farm,1));
 assert.equal(supply(farm).action.value,'1');assert.equal(farm.produce.carrot,0);assert.equal(farm.produce.wheat,0);assert.equal(farm.seeds.wheat,3);
 const loaded=restoreFarm(JSON.parse(JSON.stringify(farm)))!;assert.ok(loaded);const shown=structuredClone(loaded);hint(loaded);assert.deepEqual(loaded,shown);
 assert.ok(workBed(loaded,1).ok);assert.equal(loaded.produce.carrot,3);assert.equal(loaded.beds[1].kind,'tilled');assert.equal(loaded.seeds.wheat,3);
 assert.match(supply(loaded).label,/Посеять: пшеница/);assert.ok(workBed(loaded,1).ok);
 assert.deepEqual(loaded.beds[1],{kind:'crop',crop:'wheat',growth:0,watered:false});assert.equal(loaded.seeds.wheat,2);assert.equal(loaded.produce.wheat,0);
 assert.deepEqual(loaded.culinary,before.culinary);assert.ok(restoreFarm(loaded));
});

test('remaining-night comparisons follow each actual crop and weather, not raw age',()=>{
 for(const crop of cropIds.filter(crop=>crop!=='wheat'))for(let day=1;day<=22;day++){
  const farm=cropSpaceFixture(),days=cropDefinitions[crop].days;farm.day=day;
  farm.beds[1]={kind:'crop',crop,growth:days-1,watered:true};
  assert.equal(getNextHarvestBed(farm),1);assert.equal(supply(farm).action.target,'visit-rest');
  endDay(farm);assert.ok(getBedHarvestPreview(farm,1),`${crop}, day ${day}`);
  const dry=cropSpaceFixture();dry.day=day;dry.beds[1]={kind:'crop',crop,growth:days-1,watered:false};
  assert.equal(supply(dry).action.value,'1');endDay(dry);assert.equal(getBedHarvestPreview(dry,1),undefined,`${crop}, day ${day}: rain acts after growth`);
 }
});
