import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {berryNurseryPlayer} from './fixtures/berry-nursery-player.ts';
import {rememberRecipeDraft} from '../src/recipe-draft.ts';
import {recipePlanningGuide,recipePlanningIngredient} from '../src/recipe-planning.ts';
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

test('one missing berry keeps closest maturity and watered tie priority, even with other dry beds',()=>{
 const farm=growingVariantFixture();farm.beds[0]={kind:'crop',crop:'strawberry',growth:0,watered:true,trait:'rainbow'};
 assert.equal(getGrowingVariantSource(farm,request)?.index,1);
 farm.beds[0].growth=1;
 assert.equal(getGrowingVariantSource(farm,{...request,quantity:1})?.index,0);
 farm.variants.strawberry={rainbow:1};
 assert.equal(getGrowingVariantSource(farm,request)?.index,0,'stock reduces a two-berry recipe to one missing berry');
 farm.beds[2]={kind:'crop',crop:'blueberry',growth:0,watered:false,trait:'rainbow'};
 farm.beds[1]={kind:'crop',crop:'strawberry',growth:1,watered:false,trait:'dew'};
 farm.variants.strawberry={};
 assert.equal(getGrowingVariantSource(farm,request)?.index,0,'do not water a different crop or trait even if two are missing');
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

test('pumpkin keeps its one watering through maturity; strawberry still needs a watered bed each night',()=>{
 const farm=growingVariantFixture();
 const requirement=(crop:'pumpkin'|'strawberry')=>getRequirementHint(farm,{kind:'stock',item:{kind:'variants',item:crop,trait:'dew',quantity:1}}).notice!;
 farm.beds[1]={kind:'crop',crop:'pumpkin',growth:0,watered:false,trait:'dew'};
 assert.match(requirement('pumpkin'),/Полейте грядку один раз/);
 assert.match(requirement('pumpkin'),/До зрелости: 3 ночи/);
 assert.ok(workBed(farm,1).ok);endDay(farm);endDay(farm);
 assert.match(requirement('pumpkin'),/До зрелости: 1 ночь/);
 assert.match(requirement('pumpkin'),/больше поливать не нужно/);
 endDay(farm);assert.equal(getBedHarvestPreview(farm,1)?.trait,'dew');
 farm.beds[1]={kind:'crop',crop:'strawberry',growth:0,watered:false,trait:'dew'};
 assert.match(requirement('strawberry'),/2 ночи при политой грядке перед каждой ночью роста/);
});

test('a two-dew-berry draft directs care to both earned propagation beds before suggesting rest',()=>{
 const opening=JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json',import.meta.url),'utf8'));
 const n=berryNurseryPlayer(opening),p=n.p;
 n.divide(0,2);n.grow();p.act('workBed',0);n.cook();p.visit('home');
 n.divide(2,0);
 const part=recipePlanningIngredient(p.state,'blueberry','dew')!;
 assert.ok(part);assert.ok(rememberRecipeDraft(p.state,{base:'preserves',slots:[part,{...part}],activeSlot:0}));p.reload();
 const line=recipePlanningGuide(p.state)!.lines.find(line=>line.item.kind==='variants')!;
 assert.equal(line.missing,2);assert.equal(p.state.day,20);
 const hint=()=>getRequirementHint(p.state,{kind:'stock',item:line.item});
 const guide=()=>hint().action;
 p.act('workBed',0,0);
 assert.equal(p.state.water,0);assert.equal(guide().value,'well');
 p.act('refillWater');
 const before=structuredClone(p.state);
 assert.equal(guide().target,'focus-bed');assert.equal(guide().value,'2');
 assert.match(hint().notice!,/Полейте грядку один раз/);
 assert.match(hint().notice!,/До зрелости: 3 ночи/);
 assert.deepEqual(p.state,before);
 p.act('workBed',2,0);assert.equal(guide().value,'farmhouse');
 for(const remaining of ['3 ночи','2 ночи','1 ночь']){
  assert.ok(hint().notice!.includes('До зрелости: '+remaining+'.'));
  assert.match(hint().notice!,/больше поливать не нужно/);
  p.night();assert.ok(endDay(before).ok);
 }
 assert.equal(p.state.day,23);
 assert.equal(getBedHarvestPreview(before,0)?.special,1);assert.equal(getBedHarvestPreview(before,2),undefined);
 assert.equal(getBedHarvestPreview(p.state,0)?.special,1);assert.equal(getBedHarvestPreview(p.state,2)?.special,1);
 assert.equal(p.state.variants.blueberry?.dew??0,0,'guidance and sleep never harvest');
 p.act('workBed',0);p.act('workBed',2);assert.equal(p.state.variants.blueberry?.dew,2);
 assert.equal(recipePlanningGuide(p.state)!.missing,0);
});
