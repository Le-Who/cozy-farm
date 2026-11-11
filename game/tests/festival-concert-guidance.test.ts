import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { bayConcertProgress } from '../src/bay-concert-progress.ts'
import { getFestivalConcertState } from '../src/festival-concert-guidance.ts'
import { beginFestival, cancelFestival, contributeFestival, endDay, getFestivalStatus, restoreFarm, sail } from '../src/farm.ts'
import { bayShopDailyLimit } from '../src/bay-shop-model.ts'
import { festivalConcertFixture } from './fixtures/festival-concert.ts'

const view = (farm: ReturnType<typeof festivalConcertFixture>, steps=0, running=false) =>
  bayConcertProgress(farm.musicGarden, steps, running, farm.concertDay===farm.day, getFestivalConcertState(farm))

test('today shop bonus does not pretend the newly chosen festival concert is done', () => {
  const farm=festivalConcertFixture(), before=structuredClone(farm), progress=view(farm)
  assert.equal(getFestivalConcertState(farm),'needed')
  assert.equal(progress.completedToday,true); assert.equal(progress.value,0)
  assert.match(progress.title,/Празднику нужен новый концерт/)
  assert.match(progress.detail,/после выбора программы/); assert.match(progress.detail,/не добавит гостей/)
  assert.equal(view(farm,32,true).value,32); assert.match(view(farm,32,true).title,/2 из 4/)
  assert.deepEqual(farm,before)
  assert.deepEqual(view(restoreFarm(JSON.parse(JSON.stringify(farm)))!),progress)
})

test('pause and insufficient voices reset only the live progress, not the earned daily bonus', () => {
  const farm=festivalConcertFixture()
  assert.equal(view(farm,48,false).value,0)
  for(const id of ['ceramic','handpan','harp'] as const)farm.musicGarden.tracks[id].muted=true
  const progress=view(farm,40,true)
  assert.equal(progress.value,0); assert.match(progress.title,/две дорожки/)
  assert.equal(progress.completedToday,true)
  assert.equal(view(farm,Infinity,true).value,0)
})

test('the existing completed performance becomes a separate festival contribution, without extra guests', () => {
  const farm=festivalConcertFixture(), coins=farm.coins, limit=bayShopDailyLimit(1,farm.festivals.completed.lights)
  // This is the unchanged counter increment at 64 steps in createBayMusic; actual playback is checked separately.
  farm.musicGarden.performances++
  const progress=view(farm)
  assert.equal(getFestivalConcertState(farm),'ready'); assert.equal(progress.value,64)
  assert.match(progress.title,/Концерт для праздника готов/); assert.match(progress.detail,/отдельно внесите вклад/)
  assert.equal(farm.festivals.active!.stage,0)
  assert.deepEqual(view(restoreFarm(JSON.parse(JSON.stringify(farm)))!),progress)
  assert.ok(contributeFestival(farm,'concert','concert').ok)
  const after=structuredClone(farm)
  assert.equal(getFestivalConcertState(farm),undefined)
  assert.equal(contributeFestival(farm,'concert','concert').ok,false)
  assert.deepEqual(farm,after); assert.equal(farm.coins,coins)
  assert.equal(bayShopDailyLimit(Number(farm.concertDay===farm.day),farm.festivals.completed.lights),limit)
})

test('cancelling the unused program clears only its guidance and a new choice uses a fresh baseline', () => {
  const farm=festivalConcertFixture(), music=structuredClone(farm.musicGarden)
  assert.ok(cancelFestival(farm,'stage').ok)
  assert.equal(getFestivalConcertState(farm),undefined); assert.match(view(farm).title,/Сегодня приглашены/)
  assert.deepEqual(farm.musicGarden,music)
  assert.ok(beginFestival(farm,'stage').ok); assert.equal(getFestivalConcertState(farm),'needed')
  farm.musicGarden.performances++
  assert.equal(cancelFestival(farm,'stage').ok,false); assert.equal(getFestivalConcertState(farm),'ready')
})

test('a new morning removes the shop bonus but does not lose or invent a program concert', () => {
  for(const performed of [false,true]) {
    const farm=festivalConcertFixture();if(performed)farm.musicGarden.performances++
    assert.ok(sail(farm,'home').ok); assert.ok(endDay(farm).ok)
    const loaded=restoreFarm(JSON.parse(JSON.stringify(farm)))!;assert.ok(loaded)
    assert.equal(getFestivalConcertState(loaded),performed?'ready':'needed')
    assert.equal(view(loaded).completedToday,false);assert.equal(view(loaded).value,performed?64:0)
    assert.doesNotMatch(view(loaded).detail,/Сегодня приглашены/)
  }
})

test('non-concert programs, waiting steps and finished programs do not inherit a concert request', () => {
  const farm=festivalConcertFixture()
  assert.ok(cancelFestival(farm,'stage').ok);assert.ok(beginFestival(farm,'harvest').ok)
  assert.equal(getFestivalConcertState(farm),undefined)
  const stageFarm=festivalConcertFixture();stageFarm.musicGarden.performances++
  assert.ok(contributeFestival(stageFarm,'concert','concert').ok)
  assert.ok(getFestivalStatus(stageFarm).active!.waitingNight)
  assert.equal(getFestivalConcertState(stageFarm),undefined)
})

test('the actual music scene recomputes guidance from the farm without changing the reward callback', () => {
  const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
  const music=readFileSync(new URL('../src/bay-music.ts',import.meta.url),'utf8')
  assert.match(main,/getFestivalConcertState:\(\)=>getFestivalConcertState\(farm\)/)
  assert.match(music,/options\.getFestivalConcertState\?\.\(\)/)
  assert.match(main,/if\(farm\.concertDay===farm\.day\)return false/)
  assert.match(music,/state\.performances\+\+; save\(\); const attracted = options\.onPerformance/)
})
