import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createFarm, restoreFarm, pickFruit, collectEggs, workBed, cropDefinitions, type StockItem } from '../src/farm.ts';
import { getReadyVariantSource, treeVariantCopy } from '../src/ready-variant-guidance.ts';
import { isGuardedAction } from '../src/action-click-guard.ts';
import { getRequirementHint } from '../src/requirement-guidance.ts';

const apple = {kind:'variants',item:'apple',trait:'rainbow',quantity:2} as const;
const hint = (farm: ReturnType<typeof createFarm>, item: StockItem = apple) => getRequirementHint(farm,{kind:'stock',item});
function orchard() {
  const farm=createFarm();
  farm.trees.home[1]={...farm.trees.home[0]!,trait:'rainbow'};
  assert.ok(restoreFarm(farm));
  return farm;
}

test('an exact ready tree takes priority over an ordinary tree of the same fruit', () => {
  const farm=orchard(), before=structuredClone(farm);
  assert.deepEqual(getReadyVariantSource(farm,apple),{kind:'tree',island:'home',index:1});
  assert.equal(hint(farm).action.target,'inspect-tree');assert.equal(hint(farm).action.value,'1');
  assert.match(hint(farm).notice!,/Радужное яблоко ×1/);
  assert.deepEqual(farm,before);
  assert.deepEqual(hint(restoreFarm(JSON.parse(JSON.stringify(farm)))!),hint(farm));
});

test('only reachable orchards are offered, preferring the current shore', () => {
  const farm=orchard();farm.trees.grove[2]={...farm.trees.home[1]!};farm.trees.home[1]=null;
  assert.equal(getReadyVariantSource(farm,apple),undefined);
  farm.boatOwned=true;assert.deepEqual(getReadyVariantSource(farm,apple),{kind:'tree',island:'grove',index:2});
  assert.deepEqual(hint(farm).action,{label:'',target:'sail',value:'grove'});
  farm.island='grove';farm.trees.home[1]={...farm.trees.grove[2]!};
  assert.deepEqual(getReadyVariantSource(farm,apple),{kind:'tree',island:'grove',index:2});
  assert.equal(hint(farm).action.value,'2');assert.ok(restoreFarm(farm));
});

test('after explicit harvest the old ingredient link recomputes instead of claiming the ordinary tree is ready', () => {
  const farm=orchard();
  assert.ok(pickFruit(farm,1).ok);assert.equal(farm.variants.apple?.rainbow,1);assert.equal(farm.fruit.apple,1);
  assert.equal(farm.trees.home[0]?.fruitReady,2);
  const before=structuredClone(farm);
  assert.equal(getReadyVariantSource(farm,apple),undefined);
  assert.notEqual(hint(farm).action.target,'inspect-tree');
  assert.doesNotMatch(hint(farm).notice!,/Уже можно собрать/);assert.deepEqual(farm,before);
  assert.ok(restoreFarm(farm));
});

test('a rare crop uses the exact ripe bed and never a growing or different-trait bed', () => {
  const farm=createFarm(), crop='strawberry';
  farm.beds[0]={kind:'crop',crop,growth:cropDefinitions[crop].days,watered:false};
  farm.beds[1]={kind:'crop',crop,growth:0,watered:false,trait:'rainbow'};
  farm.beds[2]={kind:'crop',crop,growth:cropDefinitions[crop].days,watered:false,trait:'dew'};
  farm.beds[3]={kind:'crop',crop,growth:cropDefinitions[crop].days,watered:false,trait:'rainbow'};
  const request={kind:'variants',item:crop,trait:'rainbow',quantity:2} as const;
  assert.deepEqual(getReadyVariantSource(farm,request),{kind:'bed',island:'home',index:3});
  assert.equal(hint(farm,request).action.target,'focus-bed');assert.equal(hint(farm,request).action.value,'3');
  const before=structuredClone(farm);hint(farm,request);assert.deepEqual(farm,before);
  assert.ok(workBed(farm,3).ok);assert.equal(farm.variants.strawberry?.rainbow,1);
  assert.equal(getReadyVariantSource(farm,request),undefined);assert.ok(restoreFarm(farm));
});

test('a matching egg in the nest is distinct from ordinary eggs and packages', () => {
  const farm=createFarm(), request={kind:'variants',item:'egg',trait:'star',quantity:1} as const;
  farm.eggs=10;farm.eggBaskets=2;
  assert.equal(getReadyVariantSource(farm,request),undefined);
  farm.eggTrait='dew';assert.equal(getReadyVariantSource(farm,request),undefined);
  farm.eggTrait='star';
  assert.deepEqual(getReadyVariantSource(farm,request),{kind:'nest',island:'home'});
  assert.equal(hint(farm,request).action.target,'open-panel');assert.equal(hint(farm,request).action.value,'coop');
  const before=structuredClone(farm);hint(farm,request);assert.deepEqual(farm,before);
  assert.ok(collectEggs(farm).ok);assert.equal(farm.variants.egg?.star,1);assert.equal(farm.eggBaskets,2);
  assert.equal(getReadyVariantSource(farm,request),undefined);assert.ok(restoreFarm(farm));
});

test('stored or unripe nursery trees are not claimed as immediately harvestable', () => {
  const farm=orchard(), tree=farm.trees.home[1]!;
  farm.trees.home[1]=null;farm.treeNursery=[{id:1,tree}];farm.treeNurserySerial=1;
  assert.equal(getReadyVariantSource(farm,apple),undefined);
  farm.trees.home[1]={tree:'apple',age:0,fruitReady:0};
  assert.equal(getReadyVariantSource(farm,apple),undefined);
  assert.equal(getReadyVariantSource(farm,{...apple,trait:'star'}),undefined);
});

test('tree copy counts exactly one special fruit, rather than promising the whole requested amount', () => {
  const farm=orchard(), tree=farm.trees.home[1]!;
  assert.match(treeVariantCopy(tree),/Радужное яблоко ×1/);
  assert.match(treeVariantCopy(tree),/Обычные плоды ×1/);
  assert.equal(treeVariantCopy(farm.trees.home[0]!), '');
  assert.equal(treeVariantCopy({...tree,fruitReady:0}), '');
  assert.doesNotMatch(treeVariantCopy({...tree,fruitReady:1}),/Обычные/);
});

test('direct tree guidance is read-only and keeps the existing ingredient double-click guard', () => {
  const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8');
  const handler=main.slice(main.indexOf("else if (target === 'inspect-tree')"),main.indexOf("else if (target === 'orchard')"));
  assert.equal(isGuardedAction('show-requirement'),true);
  assert.match(handler,/treeSlot/);assert.match(handler,/openPanel\('tree'\)/);
  assert.doesNotMatch(handler,/pickFruit|endDay|perform\(/);
});

test('existing exact warehouse goods keep priority, and fulfilled needs do not propose more rare harvesting', () => {
  const farm=orchard();farm.boatOwned=true;farm.freight.warehouses.home['variants:apple:rainbow']=2;
  const before=structuredClone(farm);
  assert.equal(hint(farm).action.target,'warehouse-supply');assert.equal(hint(farm).action.value,'variants:apple:rainbow|2');
  assert.deepEqual(farm,before);assert.ok(restoreFarm(farm));
  farm.variants.apple={rainbow:2};assert.equal(getReadyVariantSource(farm,apple),undefined);
  assert.equal(hint(farm,{kind:'fruit',item:'apple',quantity:1}).action.value,'0');
});
