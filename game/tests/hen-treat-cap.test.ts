import assert from 'node:assert/strict'
import test from 'node:test'
import * as F from '../src/farm.ts'
import {restoreLegacyFarm} from '../src/farm-save-migration.ts'
import {farmSaveKeys} from '../src/farm-save-keys.ts'
import {henFieldSources} from '../src/hen-harvest-walk.ts'
import {getHenTreat,maxHenFriendship,renderHenFriendship,treatHen,type HenTreat} from '../src/hen-friendship.ts'
import {VersionedSave} from '../src/versioned-save.ts'
import {chickenCarePlayer} from './fixtures/chicken-care-player.ts'

const hen=4, carrotPlot=9, tree=0
function coldStore() {
  const storage=new Map<string,string>()
  const provider={getItem:(key:string)=>storage.get(key)??null,setItem:(key:string,value:string)=>void storage.set(key,value)}
  const open=()=>new VersionedSave(()=>provider,farmSaveKeys,F.restoreCurrentFarm,F.createFarm,async operation=>operation(),restoreLegacyFarm)
  return {
    async saveAndReload(farm:F.FarmState) {
      const before=open()
      assert.ok(await before.load())
      assert.equal(await before.save(farm),true)
      const restored=await open().load()
      assert.deepEqual(restored,farm)
      return restored!
    }
  }
}
function act(farm:F.FarmState,result:F.ActionResult) {
  assert.equal(result.ok,true,result.message)
  const restored=F.restoreCurrentFarm(JSON.parse(JSON.stringify(farm)))
  assert.deepEqual(restored,farm)
  return restored!
}
function earnedHenBeforeFirstCarrot() {
  const p=chickenCarePlayer('orchard','hatchery')
  p.act('feedChickens');p.act('endDay');p.act('collectEggs');p.act('incubateEgg')
  p.act('endDay');p.act('endDay')
  assert.deepEqual([p.state.day,p.state.flockSize,p.state.hatchDay,p.state.eggs],[4,5,null,3])
  p.act('workBed',carrotPlot);p.act('workBed',carrotPlot);p.act('pickFruit',tree);p.act('petChicken',hen)
  p.act('endDay');p.act('workBed',carrotPlot);p.act('workBed',carrotPlot);p.act('workBed',carrotPlot);p.act('petChicken',hen)
  assert.deepEqual([p.state.day,p.state.henFriendship.hens[hen].points,p.state.produce.carrot],[5,2,2])
  return p.state
}
async function earnedCappedHen() {
  let f=earnedHenBeforeFirstCarrot()
  f=act(f,treatHen(f,hen,'carrot'))
  assert.deepEqual(f.henFriendship.hens[hen],{points:3,treatedOn:5,tasted:['carrot']})
  for (let day=6;day<=11;day++) {
    f=act(f,F.endDay(f))
    if(day===6)f=act(f,F.workBed(f,carrotPlot))
    f=act(f,F.petChicken(f,hen))
  }
  assert.deepEqual([f.day,f.produce.carrot,f.fruit.apple],[11,3,2])
  assert.deepEqual(f.henFriendship.hens[hen],{points:maxHenFriendship,treatedOn:5,tasted:['carrot']})
  return coldStore().saveAndReload(f)
}
const renderedTreatment=(farm:F.FarmState,treat:HenTreat)=>{
  const html=renderHenFriendship(farm,null,true,hen)
  const tag=[...html.matchAll(/<button\b[^>]*>/g)].find(([x])=>x.includes('data-action="hen-treat"')&&x.includes(`data-value="${hen}:${treat}"`))?.[0]
  assert.ok(tag,treat)
  return { disabled:/\sdisabled(?:[\s>]|=)/.test(tag), tag }
}

test('a previously tasted food is not spent at 9/9 before the favorite; the existing favorite action still works that day',async()=>{
  let f=await earnedCappedHen()
  assert.deepEqual(henFieldSources(f,hen),[])
  const before=structuredClone(f)
  assert.equal(renderedTreatment(f,'carrot').disabled,true)
  assert.equal(getHenTreat(f,hen,'carrot').available,false)
  assert.equal(renderedTreatment(f,'apple').disabled,false)
  assert.equal(treatHen(f,hen,'carrot').ok,false,'even a stale/direct request must not consume the crop or the daily choice')
  assert.deepEqual(f,before)
  assert.equal(treatHen(f,hen,'apple').ok,true)
  assert.deepEqual([f.day,f.fruit.apple,f.produce.carrot],[11,1,3])
  assert.deepEqual(f.henFriendship.hens[hen],{points:maxHenFriendship,treatedOn:11,tasted:['carrot','apple']})
  assert.deepEqual(henFieldSources(f,hen),[{kind:'tree',index:tree}])
  const active=await coldStore().saveAndReload(f)
  f=act(active,F.endDay(active))
  assert.equal(getHenTreat(f,hen,'apple').complete,true)
  assert.equal(treatHen(f,hen,'apple').ok,false,'old complete-friendship rule still protects stock')
  assert.equal(f.fruit.apple,1)
  assert.deepEqual(henFieldSources(f,hen),[{kind:'tree',index:tree}])
})

test('the same known ordinary treat still spends one for a real friendship point below the cap',()=>{
  let f=earnedHenBeforeFirstCarrot()
  f=act(f,treatHen(f,hen,'carrot'))
  f=act(f,F.endDay(f))
  assert.equal(renderedTreatment(f,'carrot').disabled,false)
  const before=structuredClone(f)
  f=act(f,treatHen(f,hen,'carrot'))
  assert.equal(f.produce.carrot,before.produce.carrot-1)
  assert.deepEqual(f.henFriendship.hens[hen],{points:4,treatedOn:6,tasted:['carrot']})
  assert.deepEqual(F.getCoopMorning(f),F.getCoopMorning(before))
  assert.equal(f.feed,before.feed)
})

test('a first non-favorite treat still enables an explicit discovery at the cap',async()=>{
  let f=await earnedCappedHen()
  const plot=15
  assert.equal(f.beds[plot].kind,'tilled')
  const seed=F.selectSeed(f,'leafyGreens');f=act(f,seed)
  f=act(f,F.workBed(f,plot))
  if(F.getBedAction(f,plot).kind==='water'){
    if(!f.water)f=act(f,F.refillWater(f))
    f=act(f,F.workBed(f,plot))
  }
  f=act(f,F.endDay(f));f=act(f,F.workBed(f,plot))
  assert.ok(f.produce.leafyGreens>0)
  assert.equal(renderedTreatment(f,'leafyGreens').disabled,false)
  const before=f.produce.leafyGreens
  f=act(f,treatHen(f,hen,'leafyGreens'))
  assert.equal(f.produce.leafyGreens,before-1)
  assert.deepEqual(f.henFriendship.hens[hen],{points:maxHenFriendship,treatedOn:f.day,tasted:['carrot','leafyGreens']})
  const next=act(f,F.endDay(f))
  assert.equal(renderedTreatment(next,'leafyGreens').disabled,true)
  assert.equal(renderedTreatment(next,'apple').disabled,false)
})
