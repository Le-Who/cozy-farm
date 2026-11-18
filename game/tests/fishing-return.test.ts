import test from 'node:test'
import assert from 'node:assert/strict'
import { beginFishingTrip, cancelFishingTrip, endDay, finishFishingTrip, getFishAction, getFishingTripConfig, restoreFarm, sail } from '../src/farm.ts'
import { fishingReturnFixture } from './fixtures/fishing-return.ts'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { runInNewContext } from 'node:vm'
import * as F from '../src/farm.ts'
import { commissionPlayer } from './fixtures/commission-player.ts'

const reload = (farm: ReturnType<typeof fishingReturnFixture>) => restoreFarm(JSON.parse(JSON.stringify(farm)))!

test('Finn promises hook space and visibly confirms preparation when his cottage closes', () => {
  const opening=JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json',import.meta.url),'utf8')) as {name:string;args:unknown[]}[]
  const p=commissionPlayer(opening.slice(0,opening.findIndex(step=>step.name==='inviteResident'&&step.args[0]==='finn')))
  const code=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
  function section(start:string,end:string){const a=code.indexOf(start),b=code.indexOf(end,a+start.length);assert.ok(a>=0&&b>a);return code.slice(a,b)}
  const cottage=stripTypeScriptTypes(section('function neighboursCard()', 'let selectedWarehouseRequest')+';neighboursCard()')
  const read=()=>runInNewContext(cottage,{...F,farm:p.state,villageSlot:1,pastryShape:'round',icon:()=>'',nav:(...parts:string[])=>parts.join(''),neighborHelpCard:()=>'',button:(label:string)=>label}) as string
  assert.match(read(),/\+1 место на крючке · крепче снасть/)
  p.act('inviteResident','finn',1);assert.match(read(),/Разведать · \+1 место на крючке/)
  const before=structuredClone(p.state.fish),quota=structuredClone(p.state.fishCaughtToday),coins=p.state.coins
  const dialog={open:true,close(){this.open=false}}
  let screenReaderOnly=true
  const toast={dataset:{},textContent:'',hidden:true,classList:{toggle(_:string,on:boolean){screenReaderOnly=on}}}
  const script=section('function notify(', 'function currentTask(')+section('function perform(', '\n}')+'\n}'+
    "\nswitch ('resident-service'){"+section("case 'resident-service':","case 'buy-boat':")+'}'
  runInNewContext(stripTypeScriptTypes(script),{...F,farm:p.state,value:'finn',pastryShape:'round',dialog,toast,toastTimer:0,
    window:{setTimeout(){},clearTimeout(){}},saveFarm(){},refresh(){}})
  assert.equal(dialog.open,false);assert.equal(toast.hidden,false);assert.equal(screenReaderOnly,false)
  assert.match(toast.textContent,/Следующий крючок вместит ещё одну рыбу/)
  assert.match(read(),/Маршрут готов · \+1 место на крючке/)
  assert.deepEqual(p.state.fish,before);assert.deepEqual(p.state.fishCaughtToday,quota);assert.equal(p.state.coins,coins)
  p.visit('grove');p.reload();assert.equal(p.state.village.scouting,true)
  const trip=beginFishingTrip(p.state);assert.equal(trip.config?.capacity,3);assert.equal(trip.config?.resilience,4)
  assert.equal(p.state.village.scouting,false);assert.ok(finishFishingTrip(p.state,trip.token!,[]).ok)
  assert.deepEqual(p.state.fish,before);assert.deepEqual(p.state.fishCaughtToday,quota)
})

test('viewing prepared fishing repeatedly and reloading never consumes its picnic or Finn help', () => {
  const farm = fishingReturnFixture(), before = structuredClone(farm)
  for (let i = 0; i < 4; i++) {
    assert.ok(getFishAction(farm).available)
    assert.deepEqual(getFishingTripConfig(farm), { capacity: 4, depth: 120, resilience: 5, scouted: true, picnic: 'bright', tasting: true })
  }
  assert.deepEqual(farm, before)
  assert.deepEqual(reload(farm), before)
  assert.equal(cancelFishingTrip(farm).ok, false)
  assert.deepEqual(farm, before)
})

test('a real cast consumes each prepared effect exactly once; cancellation grants nothing and reload preserves that boundary', () => {
  const farm = fishingReturnFixture(), before = structuredClone(farm), started = beginFishingTrip(farm)
  assert.ok(started.ok)
  assert.equal(farm.culinary.picnic, null)
  assert.equal(farm.village.scouting, false)
  assert.equal(farm.culinary.tastings.finn.bonus, false)
  assert.equal(started.config?.capacity, 4)
  assert.equal(started.config?.resilience, 5)
  const pending = reload(farm)
  assert.deepEqual(pending, farm)
  assert.ok(cancelFishingTrip(pending, started.token).ok)
  assert.deepEqual(pending.fish, before.fish)
  assert.deepEqual(pending.fishCaughtToday, before.fishCaughtToday)
  assert.equal(pending.coins, before.coins)
  assert.equal(pending.workToday, before.workToday)
  assert.equal(pending.pendingFishingTrip, null)
  assert.deepEqual(getFishingTripConfig(pending), { capacity: 2, depth: 120, resilience: 2, scouted: false })
  assert.deepEqual(reload(pending), pending)
  const cancelled = structuredClone(pending)
  assert.equal(finishFishingTrip(pending, started.token!, 3).ok, false)
  assert.deepEqual(pending, cancelled)
})

test('quota and wrong-shore refusals preserve every unused effect, with no token issued', () => {
  for (const failure of ['quota', 'shore'] as const) {
    const farm = fishingReturnFixture()
    if (failure === 'quota') farm.fishCaughtToday.home = 3
    else assert.ok(sail(farm, 'village').ok)
    const before = structuredClone(farm)
    assert.equal(beginFishingTrip(farm).ok, false)
    assert.deepEqual(farm, before)
    assert.deepEqual(reload(farm), before)
  }
})

test('rest expires only the same-day picnic, leaving the existing prepared route and Finn help for later', () => {
  const farm = fishingReturnFixture()
  assert.ok(endDay(farm).ok)
  const loaded = reload(farm)
  assert.equal(loaded.culinary.picnic, null)
  assert.equal(loaded.village.scouting, true)
  assert.equal(loaded.culinary.tastings.finn.bonus, true)
  assert.deepEqual(getFishingTripConfig(loaded), { capacity: 3, depth: 120, resilience: 5, scouted: true, tasting: true })
})
