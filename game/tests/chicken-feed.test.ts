import assert from 'node:assert/strict'
import test from 'node:test'
import { createFarm, endDay, feedChickens, getCoopMorning, restoreCurrentFarm, sail } from '../src/farm.ts'
import { chickenFeedRecipes, getChickenFeedMix, mixChickenFeed, renderChickenFeedMixes } from '../src/chicken-feed.ts'
import { isGuardedAction, ActionClickGuard, ActivationKeyGuard } from '../src/action-click-guard.ts'

function ready() {const f=createFarm();f.buildingLevels.coop=2;f.produce.wheat=4;f.produce.carrot=2;f.fruit.apple=3;return f}
function unchanged(f:ReturnType<typeof ready>, action:()=>unknown){const before=structuredClone(f);action();assert.deepEqual(f,before)}

test('two recipes spend the named ordinary ingredients atomically and prepare existing feed, not a meal or reward',()=>{
 for(const recipe of ['garden','orchard'] as const){
  const f=ready(),before=structuredClone(f),m=getChickenFeedMix(f,recipe)
  assert.equal(m.available,true);assert.equal(m.total,f.feed+chickenFeedRecipes[recipe].portions)
  assert.ok(mixChickenFeed(f,recipe).ok)
  const expected=structuredClone(before);expected.produce.wheat--;if(recipe==='garden')expected.produce.carrot--;else expected.fruit.apple--
  expected.feed+=chickenFeedRecipes[recipe].portions;expected.workToday++
  assert.deepEqual(f,expected);assert.deepEqual(restoreCurrentFarm(JSON.parse(JSON.stringify(f))),f)
 }
})

test('locked coop, wrong island, missing ingredients, invalid recipe and quantity overflow never partially spend',()=>{
 for(const alter of [(f:ReturnType<typeof ready>)=>f.buildingLevels.coop=1,(f:ReturnType<typeof ready>)=>f.island='grove',(f:ReturnType<typeof ready>)=>f.produce.wheat=0,(f:ReturnType<typeof ready>)=>f.produce.carrot=0,(f:ReturnType<typeof ready>)=>f.feed=Number.MAX_SAFE_INTEGER,(f:ReturnType<typeof ready>)=>f.workToday=Number.MAX_SAFE_INTEGER]){
  const f=ready();alter(f);unchanged(f,()=>assert.equal(mixChickenFeed(f,'garden').ok,false))
 }
 const f=ready();for(const invalid of ['',null,undefined,{},'apple','__proto__'])unchanged(f,()=>assert.equal(mixChickenFeed(f,invalid).ok,false))
 f.fruit.apple=0;unchanged(f,()=>assert.equal(mixChickenFeed(f,'orchard').ok,false))
})

test('rare ingredients are never substituted and cannot be destroyed even beside ordinary stock',()=>{
 const f=ready();f.variants={wheat:{star:4},carrot:{dew:4},apple:{rainbow:4}};const rare=structuredClone(f.variants)
 assert.ok(mixChickenFeed(f,'garden').ok);assert.ok(mixChickenFeed(f,'orchard').ok);assert.deepEqual(f.variants,rare)
 f.produce.wheat=0;unchanged(f,()=>assert.equal(mixChickenFeed(f,'garden').ok,false))
 f.produce.wheat=1;f.fruit.apple=0;unchanged(f,()=>assert.equal(mixChickenFeed(f,'orchard').ok,false))
})

test('mixing does not feed; later feeding and morning produce exactly the same eggs as bought feed',()=>{
 for(const recipe of ['garden','orchard'] as const)for(const fed of [false,true])for(const readyEggs of [0,8,9]){
  const f=ready();f.chickenHappiness=4;f.eggsReady=readyEggs;f.chickensFed=fed;const before=getCoopMorning(f)
  assert.ok(mixChickenFeed(f,recipe).ok);assert.deepEqual(getCoopMorning(f),before)
  if(!fed)assert.ok(feedChickens(f).ok)
  const morning=getCoopMorning(f);endDay(f);assert.equal(f.eggsReady,morning.total)
 }
})

test('prepared feed persists through un-fed days, travel and reload without a new save field',()=>{
 const f=ready();f.boatOwned=true;const keys=Object.keys(f).sort();assert.ok(mixChickenFeed(f,'orchard').ok);const stock=f.feed
 assert.ok(sail(f,'grove').ok);assert.deepEqual(restoreCurrentFarm(JSON.parse(JSON.stringify(f))),f);assert.equal(f.feed,stock);assert.ok(sail(f,'home').ok)
 for(let d=0;d<12;d++){endDay(f);assert.equal(f.feed,stock);assert.deepEqual(restoreCurrentFarm(JSON.parse(JSON.stringify(f))),f)}
 assert.deepEqual(Object.keys(f).sort(),keys);assert.equal(f.chickensFed,false)
})

test('preview and cancellation are read-only, disclose exact costs, alternatives and no bonus',()=>{
 const f=ready();unchanged(f,()=>{
  const html=renderChickenFeedMixes(f);assert.match(html,/Пшеница ×1 · есть 4, останется 3/);assert.match(html,/Морковь ×1 · есть 2, останется 1/)
  assert.match(html,/Яблоко ×1 · есть 3, останется 2/);assert.match(html,/Количество яиц от вида смеси не меняется/)
  assert.match(html,/2 порции за 4 монеты/);assert.match(html,/необычный урожай сохранится/);assert.match(html,/Смешать · \+4 порции/)
 });f.produce.wheat=0;assert.equal((renderChickenFeedMixes(f).match(/ disabled/g)||[]).length,2)
})

test('repeated deliberate batches pay each time; one double click or held activation is guarded',()=>{
 const f=ready();assert.ok(mixChickenFeed(f,'garden').ok);assert.ok(mixChickenFeed(f,'garden').ok)
 unchanged(f,()=>assert.equal(mixChickenFeed(f,'garden').ok,false));assert.equal(f.produce.wheat,2)
 assert.equal(isGuardedAction('mix-chicken-feed'),true)
 const guard=new ActionClickGuard();guard.remember({detail:1,timeStamp:1000,clientX:20,clientY:20})
 assert.equal(guard.blocks({detail:2,timeStamp:1100,clientX:20,clientY:20}),true)
 const key=new ActivationKeyGuard();key.blocks({key:'Enter',repeat:false},true);assert.equal(key.blocks({key:'Enter',repeat:true},true),true)
})
