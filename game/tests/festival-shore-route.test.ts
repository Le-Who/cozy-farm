import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { getFestivalShoreRoute } from '../src/festival-shore-route.ts'
import { collectShell, collectShoalFind, contributeFestival, endDay, getFestivalStatus, restoreFarm, sail } from '../src/farm.ts'
import { festivalShoreFixture } from './fixtures/festival-shore.ts'

const reload=(farm:ReturnType<typeof festivalShoreFixture>)=>restoreFarm(JSON.parse(JSON.stringify(farm)))!

test('a ready shoal find is the festival source after shells are gone, even with no fishing quota',()=>{
  const farm=festivalShoreFixture(),before=structuredClone(farm)
  assert.deepEqual(getFestivalShoreRoute(farm),{island:'grove',target:{kind:'shoal-find',id:'glass'},label:'К находке на Лунной отмели'})
  assert.deepEqual(farm,before);assert.deepEqual(getFestivalShoreRoute(reload(farm)),getFestivalShoreRoute(farm))
})

test('uncollected shells retain priority and only actually available shoal finds are selected',()=>{
  const farm=festivalShoreFixture();farm.shellsCollectedToday=[0,2]
  assert.deepEqual(getFestivalShoreRoute(farm)?.target,{kind:'shell',index:1})
  farm.shellsCollectedToday=[0,1,2];farm.shoalCollectedToday=['glass']
  assert.equal(getFestivalShoreRoute(farm)?.panel,'rest','no pearl on ordinary day')
  farm.day=11
  assert.deepEqual(getFestivalShoreRoute(farm)?.target,{kind:'shoal-find',id:'pearl'})
  farm.shoalCollectedToday=[];farm.shellDiscoveries=['regular'];farm.shells.moon=0
  assert.equal(getFestivalShoreRoute(farm)?.panel,'rest','locked shoal is not offered')
})

test('no reachable new find offers only explicit rest, which changes nothing before sleeping',()=>{
  const farm=festivalShoreFixture();farm.shoalCollectedToday=['glass']
  const before=structuredClone(farm)
  assert.deepEqual(getFestivalShoreRoute(farm),{island:'home',panel:'rest',label:'К отдыху дома'})
  assert.deepEqual(farm,before);assert.ok(sail(farm,'home').ok)
  assert.equal(farm.day,5);assert.equal(farm.festivals.active!.activity.shore,false)
  assert.ok(endDay(farm).ok)
  assert.deepEqual(getFestivalShoreRoute(reload(farm))?.target,{kind:'shell',index:0})
})

test('unreachable grove, absent, completed and waiting participation never offer a stale route',()=>{
  const farm=festivalShoreFixture();farm.boatOwned=false
  assert.equal(getFestivalShoreRoute(farm),undefined)
  farm.boatOwned=true;farm.festivals.active!.readyOn=farm.day+1
  assert.equal(getFestivalShoreRoute(farm),undefined)
  farm.festivals.active!.readyOn=farm.day;farm.festivals.active!.delivered.participation=1
  assert.equal(getFestivalShoreRoute(farm),undefined)
  farm.festivals.active=null;assert.equal(getFestivalShoreRoute(farm),undefined)
})

test('only a separate real shell or shoal pickup qualifies, survives reload, and is contributed once',()=>{
  for(const kind of ['shell','shoal-find'] as const){
    const farm=festivalShoreFixture();if(kind==='shell')farm.shellsCollectedToday=[0,2]
    const before=structuredClone(farm),route=getFestivalShoreRoute(farm)!
    assert.equal(getFestivalStatus(farm).active!.requirements[0].alternatives.find(a=>a.id==='shore')!.available,0)
    assert.ok(sail(farm,route.island).ok);assert.deepEqual(farm,{...before,island:'grove'})
    assert.ok(kind==='shell'?collectShell(farm,1).ok:collectShoalFind(farm,'glass').ok)
    assert.equal(getFestivalShoreRoute(farm),undefined)
    assert.equal(reload(farm).festivals.active!.activity.shore,true)
    assert.ok(sail(farm,'village').ok)
    const stock=structuredClone({shells:farm.shells,finds:farm.shoalFinds}),coins=farm.coins
    assert.ok(contributeFestival(farm,'participation','shore').ok)
    assert.equal(contributeFestival(farm,'participation','shore').ok,false)
    assert.deepEqual({shells:farm.shells,finds:farm.shoalFinds},stock);assert.equal(farm.coins,coins)
    assert.equal(reload(farm).festivals.active!.delivered.participation,1)
  }
})

test('the actual handler requires its open panel and rechecks program and target after crossing',async()=>{
  const source=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
  const body=source.split("case 'festival-activity': {")[1].split("case 'festival-village':")[0]
  const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor
  const run=new AsyncFunction('farm','panel','dialog','getFestivalShoreRoute','closeDialog','island','perform','sail','openPanel',`const value='shore';switch('festival-activity'){case 'festival-activity':{${body}}`)
  const farm=festivalShoreFixture(),before=structuredClone(farm),focused:unknown[]=[],visits:unknown[]=[]
  const scene={crossIsland:async(commit:()=>unknown)=>{commit()},focusTarget:(target:unknown)=>focused.push(target)}
  const perform=(fn:()=>{ok:boolean})=>fn().ok
  const visit=(panel:string)=>visits.push(panel)
  await run(farm,'festival',{open:false},getFestivalShoreRoute,()=>{},scene,perform,sail,visit)
  await run(farm,'recipes',{open:true},getFestivalShoreRoute,()=>{},scene,perform,sail,visit)
  assert.deepEqual(farm,before)
  await run(farm,'festival',{open:true},getFestivalShoreRoute,()=>{},scene,perform,sail,visit)
  assert.deepEqual(focused,[{kind:'shoal-find',id:'glass'}]);assert.deepEqual(farm,{...before,island:'grove'})
  focused.length=0;farm.island='village'
  await run(farm,'festival',{open:true},getFestivalShoreRoute,()=>{},{...scene,crossIsland:async(commit:()=>unknown)=>{commit();farm.festivals.active=null}},perform,sail,visit)
  assert.deepEqual(focused,[])
  for(const change of [
    (f:ReturnType<typeof festivalShoreFixture>)=>{f.shoalCollectedToday=['glass']},
    (f:ReturnType<typeof festivalShoreFixture>)=>{f.festivals.active!.delivered.participation=1},
  ]){
    const stale=festivalShoreFixture()
    await run(stale,'festival',{open:true},getFestivalShoreRoute,()=>{},{...scene,crossIsland:async(commit:()=>unknown)=>{commit();change(stale)}},perform,sail,visit)
    assert.deepEqual(focused,[]);assert.deepEqual(visits,[])
  }
  const exhausted=festivalShoreFixture();exhausted.shoalCollectedToday=['glass']
  const exhaustedBefore=structuredClone(exhausted)
  await run(exhausted,'festival',{open:true},getFestivalShoreRoute,()=>{},scene,perform,sail,visit)
  assert.deepEqual(visits,['rest']);assert.deepEqual(exhausted,{...exhaustedBefore,island:'home'})
})

test('the festival labels the real find and explains separate rest without changing any resources',async()=>{
  const server=await createServer({root:fileURLToPath(new URL('..',import.meta.url)),configFile:false,server:{middlewareMode:true,ws:false},appType:'custom'})
  try{
    const {renderFestivalPanel}=await server.ssrLoadModule('/src/bay-festival-ui.ts')
    const farm=festivalShoreFixture(),before=structuredClone(farm)
    assert.match(renderFestivalPanel(farm),/К находке на Лунной отмели/);assert.deepEqual(farm,before)
    farm.shoalCollectedToday=['glass']
    assert.match(renderFestivalPanel(farm),/Доступные ракушки и находки отмели сегодня собраны/)
  }finally{await server.close()}
})
