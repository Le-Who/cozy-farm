import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { getFestivalHarvestRoute } from '../src/festival-harvest-route.ts'
import { contributeFestival, cropDefinitions, getFestivalStatus, pickFruit, restoreFarm, sail, treeDefinitions, workBed } from '../src/farm.ts'
import { festivalHarvestFixture } from './fixtures/festival-harvest.ts'

const reload=(farm:ReturnType<typeof festivalHarvestFixture>)=>restoreFarm(JSON.parse(JSON.stringify(farm)))!

test('the festival route finds the ready grove rather than a growing home bed',()=>{
  const farm=festivalHarvestFixture(),before=structuredClone(farm)
  assert.deepEqual(getFestivalHarvestRoute(farm),{island:'grove',target:{kind:'tree',index:1},label:'К готовым плодам в Солёной роще'})
  assert.deepEqual(farm,before);assert.deepEqual(getFestivalHarvestRoute(reload(farm)),getFestivalHarvestRoute(farm))
})

test('a ready current coast wins; home crops and trees remain usable without a boat',()=>{
  const farm=festivalHarvestFixture()
  farm.beds[3]={kind:'crop',crop:'carrot',growth:cropDefinitions.carrot.days,watered:false}
  assert.equal(getFestivalHarvestRoute(farm)?.target.kind,'bed')
  assert.ok(sail(farm,'grove').ok);assert.equal(getFestivalHarvestRoute(farm)?.island,'grove')
  assert.ok(sail(farm,'home').ok);farm.boatOwned=false
  assert.deepEqual(getFestivalHarvestRoute(farm)?.target,{kind:'bed',index:3})
  farm.beds[3]={kind:'tilled'}
  farm.trees.home[2]={tree:'apple',age:treeDefinitions.apple.days,fruitReady:2}
  assert.deepEqual(getFestivalHarvestRoute(farm)?.target,{kind:'tree',index:2})
})

test('inaccessible fruit is never offered; with no ready harvest the original home preparation remains',()=>{
  const farm=festivalHarvestFixture();farm.boatOwned=false
  assert.equal(getFestivalHarvestRoute(farm),undefined)
  farm.island='home'
  assert.deepEqual(getFestivalHarvestRoute(farm),{island:'home',target:{kind:'bed',index:0},label:'К грядкам дома'})
  farm.boatOwned=true;farm.trees.grove[1]!.fruitReady=0
  assert.equal(getFestivalHarvestRoute(farm)?.label,'К грядкам дома')
})

test('only the separate actual tree or bed harvest qualifies, and the participation contribution spends no fruit',()=>{
  for(const kind of ['tree','bed'] as const){
    const farm=festivalHarvestFixture()
    if(kind==='bed')farm.beds[2]={kind:'crop',crop:'carrot',growth:cropDefinitions.carrot.days,watered:false}
    const route=getFestivalHarvestRoute(farm)!,before=structuredClone(farm)
    assert.equal(getFestivalStatus(farm).active!.requirements[0].available,0,'old bag stock does not qualify')
    assert.ok(sail(farm,route.island).ok)
    assert.deepEqual(farm,{...before,island:route.island})
    assert.ok(kind==='tree'?pickFruit(farm,route.target.index).ok:workBed(farm,route.target.index).ok)
    assert.equal(farm.festivals.active!.activity.harvest,true)
    assert.equal(getFestivalHarvestRoute(farm),undefined)
    assert.ok(sail(farm,'village').ok)
    const produce=structuredClone(farm.produce),fruit=structuredClone(farm.fruit),coins=farm.coins
    assert.ok(contributeFestival(farm,'participation','harvest').ok)
    assert.equal(contributeFestival(farm,'participation','harvest').ok,false)
    assert.deepEqual(farm.produce,produce);assert.deepEqual(farm.fruit,fruit);assert.equal(farm.coins,coins)
    assert.equal(reload(farm).festivals.active!.delivered.participation,1)
  }
})

test('completed, waiting and absent programs do not resurrect a harvest route',()=>{
  const farm=festivalHarvestFixture();farm.festivals.active!.readyOn=farm.day+1
  assert.equal(getFestivalHarvestRoute(farm),undefined)
  farm.festivals.active!.readyOn=farm.day;farm.festivals.active!.delivered.participation=1
  assert.equal(getFestivalHarvestRoute(farm),undefined)
  farm.festivals.active=null;assert.equal(getFestivalHarvestRoute(farm),undefined)
})

test('the actual handler rechecks its panel, requirement and program after travel without collecting',async()=>{
  const source=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
  const body=source.split("case 'festival-activity': {")[1].split("case 'festival-village':")[0]
  const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor
  const run=new AsyncFunction('farm','panel','dialog','getFestivalHarvestRoute','closeDialog','island','perform','sail',`const value='harvest';switch('festival-activity'){case 'festival-activity':{${body}}`)
  const farm=festivalHarvestFixture(),before=structuredClone(farm),focused:unknown[]=[]
  const scene={crossIsland:async(commit:()=>unknown)=>{commit()},focusTarget:(target:unknown)=>focused.push(target)}
  const perform=(fn:()=>{ok:boolean})=>fn().ok
  await run(farm,'festival',{open:false},getFestivalHarvestRoute,()=>{},scene,perform,sail)
  await run(farm,'recipes',{open:true},getFestivalHarvestRoute,()=>{},scene,perform,sail)
  assert.deepEqual(farm,before)
  await run(farm,'festival',{open:true},getFestivalHarvestRoute,()=>{},scene,perform,sail)
  assert.deepEqual(focused,[{kind:'tree',index:1}]);assert.deepEqual(farm,{...before,island:'grove'})
  focused.length=0;farm.island='village'
  const changedScene={...scene,crossIsland:async(commit:()=>unknown)=>{commit();farm.festivals.active=null}}
  await run(farm,'festival',{open:true},getFestivalHarvestRoute,()=>{},changedScene,perform,sail)
  assert.deepEqual(focused,[])
})

test('the festival button names the ready source without a contribution or automatic work',async()=>{
  const server=await createServer({root:fileURLToPath(new URL('..',import.meta.url)),configFile:false,server:{middlewareMode:true},appType:'custom'})
  try{
    const {renderFestivalPanel}=await server.ssrLoadModule('/src/bay-festival-ui.ts')
    const farm=festivalHarvestFixture(),before=structuredClone(farm)
    assert.match(renderFestivalPanel(farm),/К готовым плодам в Солёной роще/)
    assert.deepEqual(farm,before)
  }finally{await server.close()}
})
