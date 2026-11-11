import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createFarm,restoreFarm,returnNurseryTree,pickFruit,treeIds,treeDefinitions} from '../src/farm.ts';
import {traitIds} from '../src/climate.ts';
import {getRequirementHint} from '../src/requirement-guidance.ts';
import {getNurseryVariantSource,nurseryVariantNotice} from '../src/nursery-variant-guidance.ts';
import {nurseryVariantFixture} from './fixtures/nursery-variant.ts';
const request={kind:'variants',item:'apple',trait:'rainbow',quantity:2} as const;
const hint=(farm:ReturnType<typeof createFarm>)=>getRequirementHint(farm,{kind:'stock',item:request});

test('a ready exact nursery fruit leads to its own explicit return rather than ordinary planted fruit',()=>{
 const farm=nurseryVariantFixture(),before=structuredClone(farm);
 assert.deepEqual(getNurseryVariantSource(farm,request),{island:'home',slot:1,nurseryId:1});
 assert.equal(hint(farm).action.target,'orchard');assert.equal(hint(farm).action.value,'1');
 assert.equal(hint(farm).selector,'[data-action="return-nursery-tree"][data-value="1"]');
 assert.match(hint(farm).notice!,/Радужное яблоко ×1/);assert.match(hint(farm).notice!,/отдельно/);
 assert.deepEqual(farm,before);assert.deepEqual(hint(restoreFarm(JSON.parse(JSON.stringify(farm)))!),hint(farm));
});

test('all fruit and trait combinations select only an already ready exact stored tree',()=>{
 for(const fruit of treeIds)for(const trait of traitIds){
  const farm=createFarm(),item={kind:'variants' as const,item:fruit,trait,quantity:3};
  farm.treeNursery=[{id:1,tree:{tree:fruit,age:treeDefinitions[fruit].days,fruitReady:2}},
    {id:2,tree:{tree:fruit,age:treeDefinitions[fruit].days,fruitReady:2,trait}}];farm.treeNurserySerial=2;
  assert.equal(getNurseryVariantSource(farm,item)?.nurseryId,2);
  assert.match(nurseryVariantNotice(item),/×1/);assert.doesNotMatch(nurseryVariantNotice(item),/×3/);
  farm.treeNursery[1].tree={tree:fruit,age:0,fruitReady:0};
  assert.equal(getNurseryVariantSource(farm,item),undefined);
 }
});

test('only reachable free places are offered, with the current shore preferred',()=>{
 const farm=nurseryVariantFixture();farm.trees.home=Array.from({length:3},()=>({...farm.trees.home[0]!}));
 assert.equal(getNurseryVariantSource(farm,request),undefined,'a closed grove is not a free slot');
 farm.boatOwned=true;
 assert.deepEqual(getNurseryVariantSource(farm,request),{island:'grove',slot:1,nurseryId:1});
 assert.equal(hint(farm).action.target,'sail');assert.equal(hint(farm).action.value,'grove');
 farm.island='grove';farm.trees.home[1]=null;
 assert.equal(getNurseryVariantSource(farm,request)?.island,'grove');
 farm.trees.grove=Array.from({length:3},()=>({...farm.trees.home[0]!}));
 assert.equal(getNurseryVariantSource(farm,request)?.island,'home');
 farm.trees.home[1]={...farm.trees.home[0]!};assert.equal(getNurseryVariantSource(farm,request),undefined);
});

test('local exact goods and already planted exact fruits retain priority over a stored tree',()=>{
 const farm=nurseryVariantFixture();farm.trees.home[2]={...farm.treeNursery[0].tree};
 assert.equal(hint(farm).action.target,'inspect-tree');assert.equal(hint(farm).action.value,'2');
 farm.boatOwned=true;farm.freight.warehouses.home['variants:apple:rainbow']=2;
 assert.equal(hint(farm).action.target,'warehouse-supply');
 farm.variants.apple={rainbow:2};assert.equal(getNurseryVariantSource(farm,request),undefined);
 assert.equal(getNurseryVariantSource(farm,{kind:'variants',item:'egg',trait:'rainbow',quantity:1}),undefined);
});

test('an explicit return preserves the tree, then a separate harvest grants exactly one rare fruit',()=>{
 const farm=nurseryVariantFixture(),before=structuredClone(farm),source=getNurseryVariantSource(farm,request)!;
 assert.equal(returnNurseryTree(farm,source.slot,source.nurseryId).ok,true);
 assert.equal(farm.coins,before.coins);assert.deepEqual(farm.variants,before.variants);assert.deepEqual(farm.fruit,before.fruit);
 assert.equal(farm.workToday,before.workToday+1);assert.deepEqual(farm.trees.home[source.slot],before.treeNursery[0].tree);
 const loaded=restoreFarm(JSON.parse(JSON.stringify(farm)))!;assert.ok(loaded);
 assert.equal(hint(loaded).action.target,'inspect-tree');assert.equal(hint(loaded).action.value,String(source.slot));
 assert.equal(pickFruit(loaded,source.slot).ok,true);assert.equal(loaded.variants.apple?.rainbow,1);assert.equal(loaded.fruit.apple,1);
 assert.equal(loaded.coins,before.coins);assert.equal(loaded.workToday,before.workToday+2);
 assert.deepEqual(loaded.culinary,before.culinary);assert.ok(restoreFarm(loaded));
});

test('stale nursery ID and occupied destination refuse without changing state',()=>{
 const farm=nurseryVariantFixture(),source=getNurseryVariantSource(farm,request)!;
 farm.trees.home[source.slot]={...farm.trees.home[0]!};let before=structuredClone(farm);
 assert.equal(returnNurseryTree(farm,source.slot,source.nurseryId).ok,false);assert.deepEqual(farm,before);
 farm.trees.home[source.slot]=null;farm.treeNursery=[];before=structuredClone(farm);
 assert.equal(getNurseryVariantSource(farm,request),undefined);
 assert.equal(returnNurseryTree(farm,source.slot,source.nurseryId).ok,false);assert.deepEqual(farm,before);
});
