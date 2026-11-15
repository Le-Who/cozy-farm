import test from 'node:test'
import assert from 'node:assert/strict'
import {createFarm,buyAndPlantTree,buySapling,storeTree,endDay,pickFruit,sellProduce,restoreCurrentFarm,catchFish,buyBoat,sail,plantTree} from '../src/farm.ts'

test('a purchased sapling names its reserve destination while a full orchard and an earned rare stored tree stay intact',()=>{
 const farm=createFarm()
 assert.ok(buyAndPlantTree(farm,1,'apple').ok);assert.ok(buyAndPlantTree(farm,2,'apple').ok)
 for(let day=2;day<=5;day++)assert.ok(endDay(farm).ok)
 assert.deepEqual(farm.trees.home[0],{tree:'apple',age:2,fruitReady:2,trait:'rainbow'})
 assert.ok(storeTree(farm,0).ok);const rare=structuredClone(farm.treeNursery[0])
 assert.ok(buyAndPlantTree(farm,0,'apple').ok)
 assert.ok(pickFruit(farm,1).ok);assert.ok(pickFruit(farm,2).ok);assert.ok(sellProduce(farm).ok)
 assert.equal(farm.coins,28);assert.equal(farm.trees.home.includes(null),false)
 const expected=structuredClone(farm);expected.coins=17;expected.saplings.pear=1
 const result=buySapling(farm,'pear')
 assert.equal(result.ok,true)
 assert.equal(result.message,'Саженец груши в запасах. Посадите его на свободное место в саду.')
 assert.deepEqual(farm,expected)
 assert.ok(storeTree(farm,1).ok);const normal=structuredClone(farm.treeNursery[1])
 const beforePlant=structuredClone(farm)
 const planted=buyAndPlantTree(farm,1,'pear')
 assert.equal(planted.message,'Посажен саженец груши.');assert.equal(farm.coins,17)
 assert.equal(farm.saplings.pear,0);assert.deepEqual(farm.trees.home[1],{tree:'pear',age:0,fruitReady:0})
 assert.deepEqual(farm.treeNursery,[rare,normal]);assert.deepEqual(farm.fruit,beforePlant.fruit)
 assert.ok(endDay(farm).ok);assert.deepEqual(farm.treeNursery,[rare,normal]);assert.equal(farm.trees.home[1]!.age,1)
 assert.deepEqual(restoreCurrentFarm(JSON.parse(JSON.stringify(farm))),farm)
})

test('each reserve receipt names the actual bought type, while direct buy-and-plant still reports planting',()=>{
 for(const [tree,name,price] of [['apple','Саженец яблони',9],['pear','Саженец груши',11],['peach','Саженец персика',13]] as const){
  const farm=createFarm(),expected=structuredClone(farm);expected.coins-=price;expected.saplings[tree]++
  const result=buySapling(farm,tree)
  assert.equal(result.message,`${name} в запасах. Посадите его на свободное место в саду.`);assert.deepEqual(farm,expected)
 }
 const paid=createFarm(),result=buyAndPlantTree(paid,1,'pear')
 assert.equal(result.message,'Посажен саженец груши.');assert.equal(paid.coins,7);assert.equal(paid.saplings.pear,0)
 assert.deepEqual(paid.trees.home[1],{tree:'pear',age:0,fruitReady:0})
 const before=structuredClone(paid),refused=buySapling(paid,'pear')
 assert.equal(refused.ok,false);assert.equal(refused.message,'Не хватает монет на саженец.');assert.deepEqual(paid,before)
})

test('a sapling bought at Home can be intentionally planted in a free Grove place without another payment',()=>{
 const farm=createFarm()
 for(let i=0;i<3;i++)assert.ok(catchFish(farm,true).ok)
 assert.ok(pickFruit(farm,0).ok);assert.ok(sellProduce(farm).ok);assert.equal(farm.coins,49)
 assert.ok(buyBoat(farm).ok)
 assert.ok(buySapling(farm,'pear').ok);assert.equal(farm.coins,2)
 assert.ok(sail(farm,'grove').ok)
 const original=structuredClone(farm.trees.grove[0])
 assert.ok(plantTree(farm,1,'pear').ok);assert.equal(farm.coins,2);assert.equal(farm.saplings.pear,0)
 assert.deepEqual(farm.trees.grove[0],original);assert.deepEqual(farm.trees.grove[1],{tree:'pear',age:0,fruitReady:0})
 assert.deepEqual(restoreCurrentFarm(JSON.parse(JSON.stringify(farm))),farm)
})
