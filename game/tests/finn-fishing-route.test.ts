import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { runInNewContext } from 'node:vm'
import * as rules from '../src/farm.ts'
import { isGuardedAction } from '../src/action-click-guard.ts'
import { getFinnFishingRoute } from '../src/finn-fishing-route.ts'
import { sharedSupperFixture } from './fixtures/shared-supper.ts'

test('an invited Finn prepares once; only choosing a live coast travels, and only casting spends his hook', async () => {
  const main = readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
  const section = (start:string,end:string) => {
    const a=main.indexOf(start), b=main.indexOf(end,a+start.length)
    assert.ok(a>=0 && b>a); return main.slice(a,b)
  }
  const code=stripTypeScriptTypes(`(async () => {
    ${section('function mountFishing(', 'function pastryChoices(')}
    ${section('async function visitPanelAt(', 'function openGuidedMarket(')}
    switch (command) {
      ${section("    case 'invite-resident':", "    case 'practice-pattern':")}
      ${section("    case 'resident-service':", "    case 'buy-boat':")}
    }
  })()`)
  const farm=sharedSupperFixture('manual'); assert.ok(rules.serveVillageMeal(farm,'round').ok)
  type FishOptions = { capacity:number; resilience:number; onCast:()=>boolean }
  let options:FishOptions|undefined, crossings=0, focused=false
  const env={...rules, farm, getFinnFishingRoute, value:'finn', command:'invite-resident', panel:'village',villageSlot:1, pastryShape:'round',
    island:{isCrossing:()=>false, crossIsland:async (commit:()=>boolean)=>{crossings++; assert.ok(commit())},setFishing(){}},
    fieldViewButton:{getAttribute:()=> 'false'}, dialog:{open:true}, panelHistory:[],
    dialogContent:{innerHTML:'',querySelector:(selector:string)=>selector==='[data-finn-hook]'?{focus:()=>{focused=true}}:{querySelector:()=>null}},
    perform:(fn:()=>{ok:boolean},dismiss=false)=>{const result=fn(); if(result.ok&&dismiss){env.dialog.open=false;env.panel=''} return result.ok},
    rememberPanel:()=>({panel:env.panel}),closeDialog:()=>{env.dialog.open=false;env.panel=''},
    openPanel:(panel:string)=>{env.panel=panel;env.dialog.open=true; if(panel==='fishing')runInNewContext(stripTypeScriptTypes(section('function mountFishing(', 'function pastryChoices(')+'\nmountFishing()'),env)},
    stopFishing(){}, fishingPractice:undefined, fishingGame:undefined, fishingToken:undefined,saveFarm(){}, drawPanel(){},
    createFishingGame:(_host:unknown,input:FishOptions)=>{options=input;return{destroy(){}}},
  }
  const act=(name:string,value:string)=>{env.command=name;env.value=value;return runInNewContext(code,env)}
  assert.equal(getFinnFishingRoute(farm),undefined); await act('invite-resident','finn')
  assert.deepEqual(farm.village.residents,['bea','finn']); assert.equal(farm.village.scouting,false); assert.equal(crossings,0)
  await act('resident-service','finn'); assert.equal(env.panel,'village');assert.equal(focused,true)
  const ready=structuredClone(farm)
  assert.equal(farm.village.scouting,true); assert.equal(getFinnFishingRoute(farm)?.island,'home'); assert.equal(farm.fishingTripSerial,0)
  assert.deepEqual(rules.restoreFarm(JSON.parse(JSON.stringify(farm)))?.village,ready.village)
  await act('resident-service','finn'); assert.deepEqual(farm,ready)
  farm.fishCaughtToday.home=rules.getFishLimit(farm,'home')
  assert.equal(getFinnFishingRoute(farm)?.island,'grove')
  await act('finn-pier','home:fishing'); assert.equal(crossings,0,'changed quota does not silently choose a different island')
  farm.fishCaughtToday.grove=rules.getFishLimit(farm,'grove')
  assert.equal(getFinnFishingRoute(farm)?.panel,'rest')
  farm.fishCaughtToday={...ready.fishCaughtToday}; env.villageSlot=0
  await act('finn-pier','home:fishing'); assert.equal(crossings,0,'a stale control cannot travel from Bea’s house')
  env.villageSlot=1;await act('finn-pier','home:fishing')
  assert.equal(crossings,1); assert.equal(farm.island,'home'); assert.equal(env.panel,'fishing')
  assert.equal(farm.pendingFishingTrip,null); assert.equal(farm.village.scouting,true);assert.deepEqual(farm.fish,ready.fish)
  assert.ok(options);assert.equal(options.capacity,3);assert.equal(options.resilience,4)
  assert.equal(options.onCast(),true);assert.equal(farm.village.scouting,false);assert.equal(farm.pendingFishingTrip?.config.scouted,true)
  await act('finn-pier','home:fishing');assert.equal(crossings,1)
  assert.ok(['invite-resident','resident-service','finn-pier'].every(isGuardedAction))
})
