import assert from 'node:assert/strict';
import {test} from 'node:test';
import {cropDefinitions,cropIds,endDay,getBedHarvestPreview,restoreFarm,workBed} from '../src/farm.ts';
import {getClimate,traitIds} from '../src/climate.ts';
import {getRequirementHint} from '../src/requirement-guidance.ts';
import {getGrowingVariantSource,growingVariantNotice} from '../src/growing-variant-guidance.ts';
import {growingVariantFixture} from './fixtures/growing-variant.ts';
const request={kind:'variants',item:'strawberry',trait:'rainbow',quantity:2} as const;
const hint=(farm:ReturnType<typeof growingVariantFixture>)=>getRequirementHint(farm,{kind:'stock',item:request});

test('known growing rare crop beats ripe ordinary crop without watering or harvesting on navigation',()=>{
 const farm=growingVariantFixture(),before=structuredClone(farm);
 assert.deepEqual(getGrowingVariantSource(farm,request),{index:1,nights:1,watered:false});
 assert.equal(hint(farm).action.target,'focus-bed');assert.equal(hint(farm).action.value,'1');
 assert.match(hint(farm).notice!,/Радужная клубника/);assert.match(hint(farm).notice!,/Редкий урожай этой грядки: ×1/);
 assert.match(hint(farm).notice!,/Сначала полейте/);assert.match(hint(farm).notice!,/отдельно/);
 assert.deepEqual(farm,before);assert.deepEqual(hint(restoreFarm(JSON.parse(JSON.stringify(farm)))!),hint(farm));
});

test('water, travel and readiness are freshly calculated at every visit',()=>{
 const farm=growingVariantFixture();farm.water=0;
 assert.equal(hint(farm).action.target,'focus-place');assert.equal(hint(farm).action.value,'well');
 farm.water=6;assert.equal(hint(farm).action.value,'1');
 assert.ok(workBed(farm,1).ok);assert.equal(hint(farm).action.target,'focus-place');assert.equal(hint(farm).action.value,'farmhouse');
 const before=structuredClone(farm);assert.match(hint(farm).notice!,/уже полита/);assert.deepEqual(farm,before);
 farm.island='grove';farm.boatOwned=true;assert.equal(hint(farm).action.target,'sail');assert.equal(hint(farm).action.value,'home');
 farm.island='home';endDay(farm);assert.equal(hint(farm).action.target,'focus-bed');assert.equal(hint(farm).action.value,'1');
});

test('ready exact crop and available exact warehouse goods retain priority',()=>{
 const farm=growingVariantFixture();farm.beds[2]={kind:'crop',crop:'strawberry',growth:2,watered:false,trait:'rainbow'};
 assert.equal(hint(farm).action.value,'2');farm.boatOwned=true;farm.freight.warehouses.home['variants:strawberry:rainbow']=2;
 assert.equal(hint(farm).action.target,'warehouse-supply');farm.variants.strawberry={rainbow:2};
 assert.equal(getGrowingVariantSource(farm,request),undefined);
});

test('closest exact maturity wins, with already watered first on ties',()=>{
 const farm=growingVariantFixture();farm.beds[0]={kind:'crop',crop:'strawberry',growth:0,watered:true,trait:'rainbow'};
 assert.equal(getGrowingVariantSource(farm,request)?.index,1);
 farm.beds[0].growth=1;assert.equal(getGrowingVariantSource(farm,request)?.index,0);
});

test('a changed or removed trait no longer promises this rare source',()=>{
 const farm=growingVariantFixture();farm.beds[1]={kind:'crop',crop:'strawberry',growth:1,watered:true,trait:'dew'};
 const before=structuredClone(farm);assert.equal(getGrowingVariantSource(farm,request),undefined);
 assert.match(hint(farm).notice!,/подходящей погоде/);assert.deepEqual(farm,before);
 farm.beds[1]={kind:'tilled'};assert.equal(getGrowingVariantSource(farm,request),undefined);
 assert.equal(getGrowingVariantSource(farm,{kind:'variants',item:'egg',trait:'rainbow',quantity:2}),undefined);
});

test('actual night and separate harvest preserve recipe and grant just one rare ingredient',()=>{
 const farm=growingVariantFixture(),before=structuredClone(farm);
 assert.ok(workBed(farm,1).ok);assert.equal(farm.water,before.water-1);assert.equal(farm.variants.strawberry?.rainbow,undefined);
 const loaded=restoreFarm(JSON.parse(JSON.stringify(farm)))!;assert.ok(loaded);endDay(loaded);
 assert.deepEqual(getBedHarvestPreview(loaded,1),{crop:'strawberry',total:3,ordinary:2,special:1,trait:'rainbow',picnicBonus:0});
 assert.equal(loaded.variants.strawberry?.rainbow,undefined);assert.ok(workBed(loaded,1).ok);
 assert.equal(loaded.variants.strawberry?.rainbow,1);assert.equal(loaded.produce.strawberry,2);
 const control=structuredClone(before);workBed(control,1);endDay(control);workBed(control,1);
 assert.deepEqual(loaded.culinary,before.culinary);assert.equal(loaded.coins,control.coins);assert.deepEqual(loaded.progress,control.progress);assert.ok(restoreFarm(loaded));
});

test('all crops and known traits survive weather and mature after actual cared-for growth nights',()=>{
 for(const crop of cropIds)for(const trait of traitIds)for(let day=1;day<=22;day++){
  const farm=growingVariantFixture(),days=cropDefinitions[crop].days;
  farm.day=day;farm.beds=[{kind:'crop',crop,growth:0,watered:false,trait}];
  const item={kind:'variants' as const,item:crop,trait,quantity:2};
  const source=getGrowingVariantSource(farm,item)!;assert.equal(source.nights,days);
  assert.match(growingVariantNotice(item,source),/×1/);
  for(let remaining=days;remaining>0;remaining--){
   assert.equal(getGrowingVariantSource(farm,item)?.nights,remaining);
   farm.water=6;if(farm.beds[0].kind==='crop'&&!farm.beds[0].watered)assert.ok(workBed(farm,0).ok);
   endDay(farm);assert.equal(farm.beds[0].kind==='crop'&&farm.beds[0].trait,trait);
  }
  assert.equal(getBedHarvestPreview(farm,0)?.special,1);assert.equal(getGrowingVariantSource(farm,item),undefined);
 }
});

test('rain after a dry night does not count as growth before the required care',()=>{
 const farm=growingVariantFixture();farm.day=Array.from({length:40},(_,i)=>i+1).find(day=>getClimate(day+1).weather==='rain')!;
 endDay(farm);assert.equal(farm.beds[1].kind==='crop'&&farm.beds[1].growth,1);
 assert.equal(getGrowingVariantSource(farm,request)?.nights,1);assert.equal(hint(farm).action.value,'farmhouse');
 endDay(farm);assert.equal(getBedHarvestPreview(farm,1)?.trait,'rainbow');
});
