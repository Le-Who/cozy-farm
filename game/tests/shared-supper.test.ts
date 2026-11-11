import assert from 'node:assert/strict'
import { test } from 'node:test'
import { completeSignature, deliverSignature, endDay, forgetSignature, getVillageHomeCount, restoreFarm, serveVillageMeal } from '../src/farm.ts'
import { getDiscoveryTask } from '../src/discovery-path.ts'
import { getReadySignatureSuppers, renderSignatureSuppers } from '../src/shared-supper.ts'
import { isGuardedAction, ActionClickGuard, ActivationKeyGuard } from '../src/action-click-guard.ts'
import { sharedSupperFixture } from './fixtures/shared-supper.ts'

const seen = {collections:true,islands:true}
const picture = () => '<span>Блюдо</span>'

test('a ready signature and fish lead to the table without extra pastry or automatic spending', () => {
  const farm = sharedSupperFixture(), before = structuredClone(farm)
  const choices = getReadySignatureSuppers(farm)
  assert.equal(choices.length, 1)
  assert.equal(choices[0].count, 2)
  assert.equal(choices[0].fish, 'perch')
  assert.equal(choices[0].available, true)
  assert.equal(getDiscoveryTask(farm, seen)?.action.target, 'village-meal')
  assert.match(getDiscoveryTask(farm, seen)!.detail, /1 порцию.*1 рыбой/)
  for(let i=0;i<5;i++)renderSignatureSuppers(farm,picture)
  assert.deepEqual(farm, before)
  const restored = restoreFarm(JSON.parse(JSON.stringify(farm)))!
  assert.ok(restored)
  assert.deepEqual(getReadySignatureSuppers(restored), choices)
})

test('one explicit signature supper spends exactly one chosen portion and fish, with no repeat or coin reward', () => {
  const farm = sharedSupperFixture(), id = farm.culinary.recipes[0].id, before = structuredClone(farm)
  assert.equal(deliverSignature(farm, id).ok, true)
  assert.equal(farm.culinary.stock[id], before.culinary.stock[id]-1)
  assert.equal(farm.fish.perch, before.fish.perch-1)
  assert.equal(farm.fish.seaBass, before.fish.seaBass)
  assert.equal(farm.coins, before.coins)
  assert.equal(farm.village.meals, 2)
  assert.equal(farm.village.mealOn, farm.day)
  assert.equal(getVillageHomeCount(farm), 2)
  assert.deepEqual(farm.culinary.tastings, before.culinary.tastings)
  assert.deepEqual(farm.neighbors, before.neighbors)
  const after = structuredClone(farm)
  assert.equal(deliverSignature(farm,id).ok, false)
  assert.equal(serveVillageMeal(farm,'round').ok, false)
  assert.deepEqual(farm, after)
  assert.equal(renderSignatureSuppers(farm,picture), '')
  assert.ok(restoreFarm(JSON.parse(JSON.stringify(farm))))
})

test('handmade and signature dishes share the same day limit, which survives reload and resets only after actual rest', () => {
  const farm = sharedSupperFixture(), id = farm.culinary.recipes[0].id
  farm.handmade.round=1
  assert.equal(serveVillageMeal(farm,'round').ok,true)
  const restored = restoreFarm(JSON.parse(JSON.stringify(farm)))!
  assert.ok(restored)
  const before = structuredClone(restored)
  assert.equal(deliverSignature(restored,id).ok,false)
  assert.deepEqual(restored,before)
  restored.island='home';assert.equal(endDay(restored).ok,true);restored.island='village'
  assert.equal(getReadySignatureSuppers(restored)[0].available,true)
  assert.equal(deliverSignature(restored,id).ok,true)
  assert.equal(restored.village.meals,3)
  assert.equal(restored.culinary.stock[id],1)
  assert.equal(restored.fish.perch,0)
  assert.ok(restoreFarm(JSON.parse(JSON.stringify(restored))))
})

test('missing correct fish disables service and directs preparation to fish rather than another pastry', () => {
  const farm = sharedSupperFixture(), id = farm.culinary.recipes[0].id
  farm.fish.perch=0
  const before=structuredClone(farm)
  assert.equal(getReadySignatureSuppers(farm)[0].available,false)
  assert.notEqual(getDiscoveryTask(farm,seen)?.action.target,'workshop')
  assert.equal(deliverSignature(farm,id).ok,false)
  assert.deepEqual(farm,before)
  assert.match(renderSignatureSuppers(farm,picture), /disabled.*1 рыба — окунь/)
  farm.village.residents=['finn',null]
  assert.equal(getReadySignatureSuppers(farm)[0].fish,'seaBass')
  assert.equal(getReadySignatureSuppers(farm)[0].available,true)
  assert.match(renderSignatureSuppers(farm,picture), /морской окунь/)
  assert.equal(deliverSignature(farm,id).ok,true)
  assert.equal(farm.fish.seaBass,1)
  assert.equal(farm.fish.perch,0)
})

test('spent or deleted recipes cannot consume fish through stale supper controls', () => {
  const farm=sharedSupperFixture(),id=farm.culinary.recipes[0].id
  farm.culinary.stock[id]=0
  assert.deepEqual(getReadySignatureSuppers(farm),[])
  assert.equal(getDiscoveryTask(farm,seen)?.action.target,'workshop')
  let before=structuredClone(farm)
  assert.equal(deliverSignature(farm,id).ok,false)
  assert.deepEqual(farm,before)
  assert.equal(forgetSignature(farm,id).ok,true)
  before=structuredClone(farm)
  assert.equal(deliverSignature(farm,id).ok,false)
  assert.deepEqual(farm,before)
  assert.equal(renderSignatureSuppers(farm,picture),'')
})

test('a ready dish on another shore routes to the harbour and never serves remotely', () => {
  const farm=sharedSupperFixture(),id=farm.culinary.recipes[0].id
  farm.island='home';const before=structuredClone(farm)
  assert.equal(getReadySignatureSuppers(farm)[0].available,false)
  assert.deepEqual(getDiscoveryTask(farm,seen)?.action,{label:'В Лавандовую гавань',target:'sail',value:'village'})
  assert.equal(deliverSignature(farm,id).ok,false)
  assert.deepEqual(farm,before)
})

test('the exact selected recipe is spent without touching other portions, and custom names are escaped', () => {
  const farm=sharedSupperFixture(), first=farm.culinary.recipes[0]
  farm.fruit.pear=2
  const made=completeSignature(farm,{base:'tart',ingredients:[{id:'pear',quantity:2}]},{...structuredClone(first.result),fruit:[{ingredientId:'pear',x:0,y:0,angle:0}]})
  assert.equal(made.ok,true)
  const id=made.recipeId!,recipe=farm.culinary.recipes.find(recipe=>recipe.id===id)!
  recipe.name='Тарт & "груша"'
  assert.ok(restoreFarm(farm))
  assert.match(renderSignatureSuppers(farm,picture), /Тарт &amp; &quot;груша&quot;/)
  const firstCount=farm.culinary.stock[first.id],chosenCount=farm.culinary.stock[id]
  assert.equal(deliverSignature(farm,id).ok,true)
  assert.equal(farm.culinary.stock[first.id],firstCount)
  assert.equal(farm.culinary.stock[id],chosenCount-1)
})

test('both supper gestures protect redraw against double click and held activation', () => {
  for(const action of ['supper-signature','share-meal'])assert.equal(isGuardedAction(action),true)
  const clicks=new ActionClickGuard()
  clicks.remember({detail:1,timeStamp:100,clientX:20,clientY:40})
  assert.equal(clicks.blocks({detail:2,timeStamp:160,clientX:20,clientY:40}),true)
  const keys=new ActivationKeyGuard()
  assert.equal(keys.blocks({key:'Enter',repeat:false},true),false)
  assert.equal(keys.blocks({key:'Enter',repeat:true},false),true)
  keys.release('Enter')
  assert.equal(keys.blocks({key:'Enter',repeat:false},false),false)
})
