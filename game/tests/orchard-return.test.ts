import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createFarm, endDay, restoreFarm, returnNurseryTree, pickFruit, treeDefinitions, treeIds } from '../src/farm.ts';
import { getFruitSource, nightsToFruit, nurseryFruitDetail } from '../src/orchard-guidance.ts';
import { getSupplyGuidance } from '../src/discovery-path.ts';
import { ActionClickGuard, ActivationKeyGuard, isGuardedAction } from '../src/action-click-guard.ts';
import { getRequirementHint } from '../src/requirement-guidance.ts';

const peach = {kind:'fruit',item:'peach',quantity:1} as const;
function fixture() {
  const farm = createFarm(); farm.day = 5;
  farm.trees.home[0] = {tree:'peach',age:0,fruitReady:0};
  farm.treeNursery = [{id:4,tree:{tree:'peach',age:0,fruitReady:0}},{id:7,tree:{tree:'peach',age:3,fruitReady:0}}];
  farm.treeNurserySerial = 7;
  return farm;
}

test('a paused adult is a one-night source when a reachable free slot exists', () => {
  const f=fixture(), before=structuredClone(f);
  assert.deepEqual(getFruitSource(f,'peach'), {island:'home',slot:1,kind:'return',nurseryId:7,nights:1});
  const task=getSupplyGuidance(f,peach,'пирог'), hint=getRequirementHint(f,{kind:'stock',item:peach});
  assert.deepEqual(task.action,{label:'К дереву в питомнике',target:'orchard',value:'7'});
  assert.match(task.detail,/следующим утром/); assert.match(task.detail,/рост на паузе/);
  assert.match(hint.selector!,/data-value="7"/); assert.deepEqual(f,before);
  const loaded=restoreFarm(JSON.parse(JSON.stringify(f)))!;
  assert.ok(loaded); assert.deepEqual(getFruitSource(loaded,'peach'),getFruitSource(f,'peach'));
});

test('explicit return then one rest gives fruit; viewing and returning never harvest', () => {
  const f=fixture(), before=structuredClone(f);
  getSupplyGuidance(f,peach,'пирог');getRequirementHint(f,{kind:'stock',item:peach}); assert.deepEqual(f,before);
  assert.equal(returnNurseryTree(f,1,7).ok,true);
  assert.equal(f.day,5);assert.equal(f.fruit.peach,0);assert.equal(f.coins,before.coins);
  assert.equal(f.workToday,before.workToday+1);assert.equal(f.trees.home[1]!.fruitReady,0);
  const afterReturn=structuredClone(f);
  assert.equal(returnNurseryTree(f,1,7).ok,false);assert.deepEqual(f,afterReturn);
  assert.equal(endDay(f).ok,true);assert.equal(f.day,6);assert.equal(f.trees.home[1]!.fruitReady,2);
  assert.equal(f.treeNursery[0].tree.age,0);assert.equal(f.fruit.peach,0);
  assert.equal(getFruitSource(f,'peach').kind,'pick');assert.equal(pickFruit(f,1).ok,true);assert.equal(f.fruit.peach,2);
});

test('ties keep the planted source, including a one-night sapling', () => {
  for (const age of [2,3]) {
    const f=fixture();f.trees.home[0]!.age=age;
    assert.deepEqual(getFruitSource(f,'peach'),{island:'home',slot:0,kind:'grow',nights:1});
    assert.equal(getSupplyGuidance(f,peach,'пирог').action.target,'visit-rest');
  }
});

test('choose the soonest planted tree, not the first slot or farther nursery', () => {
  const f=fixture();f.boatOwned=true;f.trees.grove[2]={tree:'peach',age:2,fruitReady:0};
  assert.deepEqual(getFruitSource(f,'peach'),{island:'grove',slot:2,kind:'grow',nights:1});
  f.trees.home[2]={tree:'peach',age:2,fruitReady:0};assert.equal(getFruitSource(f,'peach').island,'home');
  f.island='grove';assert.equal(getFruitSource(f,'peach').island,'grove');
});

test('do not route a paused empty tree through unavailable space', () => {
  const f=fixture();f.trees.home=[f.trees.home[0],{tree:'apple',age:2,fruitReady:0},{tree:'pear',age:3,fruitReady:0}];
  assert.equal(getFruitSource(f,'peach').kind,'grow');f.boatOwned=true;
  assert.deepEqual(getFruitSource(f,'peach'),{island:'grove',slot:1,kind:'return',nurseryId:7,nights:1});
  f.trees.grove=[{tree:'pear',age:3,fruitReady:0},{tree:'pear',age:3,fruitReady:0},{tree:'pear',age:3,fruitReady:0}];
  assert.equal(getFruitSource(f,'peach').kind,'grow');f.treeNursery[1].tree.fruitReady=2;
  assert.equal(getFruitSource(f,'peach').kind,'space');
});

test('ready fruit beats every wait, and ready planted fruit beats a nursery move', () => {
  const f=fixture();f.treeNursery[0].tree={tree:'peach',age:3,fruitReady:2};
  assert.equal(getFruitSource(f,'peach').nurseryId,4);assert.match(getSupplyGuidance(f,peach,'пирог').detail,/сразу после возврата/);
  f.trees.home[2]={tree:'peach',age:3,fruitReady:2};
  assert.deepEqual(getFruitSource(f,'peach'),{island:'home',slot:2,kind:'pick',nights:0});
});

test('every species and growth stage forecast matches the actual overnight rules', () => {
  for (const tree of treeIds) for(let age=0;age<=treeDefinitions[tree].days;age++) {
    const f=createFarm();f.trees.home[0]={tree,age,fruitReady:0};const n=nightsToFruit(f.trees.home[0]!);
    for(let i=0;i<n;i++){assert.equal(f.trees.home[0]!.fruitReady,0);endDay(f)}
    assert.equal(f.trees.home[0]!.fruitReady,2);assert.match(nurseryFruitDetail({tree,age,fruitReady:0}),/После возврата/);
  }
});


test('returning one nursery tree owns a double click and held Enter across redraw', () => {
  assert.ok(isGuardedAction('return-nursery-tree'));
  const click = new ActionClickGuard();
  click.remember({detail:1,timeStamp:100,clientX:200,clientY:500});
  assert.ok(click.blocks({detail:1,timeStamp:250,clientX:200,clientY:500}));
  assert.equal(click.blocks({detail:1,timeStamp:800,clientX:200,clientY:500}),false);
  const key = new ActivationKeyGuard();
  assert.equal(key.blocks({key:'Enter',repeat:false},true),false);
  assert.equal(key.blocks({key:'Enter',repeat:true},false),true);
  key.release('Enter');
  assert.equal(key.blocks({key:'Enter',repeat:false},true),false);
});
