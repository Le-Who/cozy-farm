import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createFarm, getFishLimit, getFishAction, collectEggs, pickFruit, endDay, restoreFarm, cropDefinitions, getProject} from '../src/farm.ts'
import {getCoinGuidance, getSupplyGuidance} from '../src/discovery-path.ts'
import {getRequirementHint} from '../src/requirement-guidance.ts'

function emptyBag(){const f=createFarm();f.coins=0;f.eggsReady=0;f.beds=f.beds.map(()=>({kind:'empty'}));return f}
function emptySources(){const f=emptyBag();f.boatOwned=true;f.beds=f.beds.map(()=>({kind:'empty'}));for(const crop of Object.keys(f.seeds) as (keyof typeof f.seeds)[])f.seeds[crop]=0;f.trees.home=[null,null,null];f.trees.grove=[null,null,null];return f}

test('ready eggs precede sowing or waiting, then the real collection leads to the market',()=>{
  const f=emptyBag();f.eggsReady=2;f.beds[0]={kind:'crop',crop:'pumpkin',growth:0,watered:true};const before=structuredClone(f)
  for(let i=0;i<5;i++){const task=getCoinGuidance(f,70,'лодка');assert.equal(task.action.target,'visit-coop');assert.match(task.detail,/2 яйца/)}
  assert.deepEqual(f,before);assert.ok(collectEggs(f).ok)
  assert.equal(f.eggsReady,0);assert.equal(f.eggs,2)
  assert.equal(getCoinGuidance(f,70,'лодка').action.target,'visit-market')
  assert.ok(restoreFarm(JSON.parse(JSON.stringify(f))))
})

test('ready fruit is found beyond a growing first tree and harvested without inventing resources',()=>{
  const f=emptyBag();f.trees.home=[{tree:'apple',age:0,fruitReady:0},{tree:'pear',age:3,fruitReady:2},null]
  assert.ok(restoreFarm(f));const before=structuredClone(f),task=getCoinGuidance(f,70,'лодка')
  assert.equal(task.action.target,'visit-tree');assert.equal(task.action.value,'1');assert.deepEqual(f,before)
  assert.ok(pickFruit(f,1).ok);assert.equal(f.fruit.pear,2)
  assert.equal(getCoinGuidance(f,70,'лодка').action.target,'visit-market');assert.ok(restoreFarm(JSON.parse(JSON.stringify(f))))
})

test('reachable local ripe fruit is preferred and a locked remote orchard is never proposed for earnings',()=>{
  const f=emptyBag();f.trees.home=[null,null,null]
  assert.notEqual(getCoinGuidance(f,70,'лодка').action.value,'grove')
  f.boatOwned=true;f.island='grove';f.trees.home=[{tree:'apple',age:2,fruitReady:2},null,null]
  assert.ok(restoreFarm(f));const before=structuredClone(f),hint=getCoinGuidance(f,100,'дом')
  assert.equal(hint.action.target,'visit-tree');assert.equal(hint.action.value,'0');assert.match(hint.label,/груша/);assert.deepEqual(f,before)
  f.eggsReady=1;assert.equal(getCoinGuidance(f,100,'дом').action.value,'home')
})

test('ripe nursery fruit remains useful without recommending a new purchase or free harvest',()=>{
  const f=emptyBag();f.trees.home=[null,null,null];f.treeNursery=[{tree:{tree:'apple',age:2,fruitReady:2},id:1}];f.treeNurserySerial=1
  assert.ok(restoreFarm(f));const before=structuredClone(f),hint=getCoinGuidance(f,100,'дом')
  assert.equal(hint.action.target,'orchard');assert.match(hint.label,/Верните дерево/);assert.deepEqual(f,before)
})

test('owned market stock and ripe beds retain their priority over the new egg hint',()=>{
  const f=emptyBag();f.eggsReady=1;f.produce.carrot=1
  assert.equal(getCoinGuidance(f,100,'дом').action.target,'visit-market')
  f.produce.carrot=0;f.beds[2]={kind:'crop',crop:'carrot',growth:cropDefinitions.carrot.days,watered:true}
  assert.equal(getCoinGuidance(f,100,'дом').action.target,'focus-bed');assert.equal(getCoinGuidance(f,100,'дом').action.value,'2')
})

test('exhausted fishing routes go Home without a source bounce, and only actual sleep resets both quotas',()=>{
  const f=emptySources();f.island='grove';f.fishCaughtToday.home=3;f.fishCaughtToday.grove=3
  const fish={kind:'fish',item:'seaBass',quantity:1} as const,before=structuredClone(f)
  assert.equal(getCoinGuidance(f,100,'дом').action.value,'home')
  assert.equal(getSupplyGuidance(f,fish,'ужин').action.value,'home')
  assert.equal(getRequirementHint(f,{kind:'stock',item:fish}).action.value,'home');assert.deepEqual(f,before)
  assert.equal(endDay(f).ok,false);assert.deepEqual(f,before)
  f.island='home';const atHome=structuredClone(f)
  assert.equal(getCoinGuidance(f,100,'дом').action.target,'visit-rest')
  assert.deepEqual(getRequirementHint(f,{kind:'stock',item:fish}).action,{label:'',target:'focus-place',value:'farmhouse'})
  assert.deepEqual(f,atHome);assert.ok(endDay(f).ok);assert.equal(f.day,2)
  assert.deepEqual(f.fishCaughtToday,{home:0,grove:0});assert.equal(getFishAction(f).available,true)
  assert.equal(getSupplyGuidance(f,fish,'ужин').action.value,'grove');assert.ok(restoreFarm(JSON.parse(JSON.stringify(f))))
})

test('Grove dock bonus is respected before recommending rest, including after reload',()=>{
  const f=emptySources();for(const {item} of getProject(f,'dock').items)f.projects.dock['item' in item?`${item.kind}:${item.item}`:item.kind]=item.quantity
  f.island='grove';f.fishCaughtToday.grove=3;assert.equal(getFishLimit(f),4)
  const fish={kind:'fish',item:'seaBass',quantity:1} as const
  assert.equal(getSupplyGuidance(f,fish,'ужин').action.target,'visit-pier')
  f.fishCaughtToday.grove=4;const loaded=restoreFarm(JSON.parse(JSON.stringify(f)))!;assert.ok(loaded)
  assert.equal(getSupplyGuidance(loaded,fish,'ужин').action.value,'home')
})
