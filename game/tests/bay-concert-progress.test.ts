import test from 'node:test'
import assert from 'node:assert/strict'
import { BAY_CONCERT_STEPS, bayConcertProgress } from '../src/bay-concert-progress.ts'
import { createBayMusicState } from '../src/bay-music-model.ts'
import { createFarm, endDay, restoreFarm } from '../src/farm.ts'
import { bayShopDailyLimit } from '../src/bay-shop-model.ts'

test('concert guidance describes the unchanged four-round reward without changing the composition', () => {
  const state = createBayMusicState(), before = structuredClone(state)
  const ready = bayConcertProgress(state, 0, false, false)
  assert.match(ready.detail, /4 круга/); assert.match(ready.detail, /две дорожки/)
  assert.equal(ready.maximum, 64); assert.equal(BAY_CONCERT_STEPS, 64)
  for (const step of [0, 1, 15, 16, 63, 64]) {
    const progress = bayConcertProgress(state, step, true, false)
    assert.equal(progress.value, step); assert.match(progress.title, new RegExp(`${Math.floor(step / 16)} из 4`))
  }
  assert.deepEqual(state, before)
})

test('pause, silent tracks and an empty score display no retained progress', () => {
  const state = createBayMusicState()
  assert.equal(bayConcertProgress(state, 40, false, false).value, 0)
  state.tracks.ceramic.muted = true; state.tracks.harp.volume = 0; state.tracks.handpan.steps.fill(-1)
  const before = structuredClone(state), hint = bayConcertProgress(state, 40, true, false)
  assert.equal(hint.value, 0); assert.match(hint.title, /две дорожки/); assert.match(hint.detail, /громкостью/)
  assert.deepEqual(state, before)
  state.tracks.ceramic.muted = false
  assert.equal(bayConcertProgress(state, 1, true, false).value, 1)
  assert.equal(bayConcertProgress(state, Infinity, true, false).value, 0)
})

test('today status survives pause, replay, changed tracks and reload on the existing concert day', () => {
  const farm = createFarm(); farm.concertDay = farm.day; farm.musicGarden.performances = 1
  const before = JSON.stringify(farm), loaded = restoreFarm(JSON.parse(before))!
  assert.ok(loaded)
  for (const state of [farm, loaded]) {
    const progress = bayConcertProgress(state.musicGarden, 0, false, state.concertDay === state.day)
    assert.equal(progress.completedToday, true); assert.equal(progress.value, 64)
    assert.match(progress.detail, /не добавит гостей/)
  }
  assert.equal(JSON.stringify(farm), before)
  loaded.musicGarden.tracks.ceramic.muted = true
  loaded.musicGarden.tracks.marimba.muted = true
  loaded.musicGarden.tracks.handpan.muted = true
  loaded.musicGarden.tracks.harp.muted = true
  assert.equal(bayConcertProgress(loaded.musicGarden, 0, true, true).completedToday, true)
  assert.equal(bayShopDailyLimit(Number(loaded.concertDay === loaded.day), 0), bayShopDailyLimit(0, 0) + 2)
})

test('a real new morning removes yesterday status without erasing music or creating a new reward', () => {
  const farm = createFarm(); farm.concertDay = farm.day; farm.musicGarden.performances = 1
  const music = structuredClone(farm.musicGarden)
  assert.ok(endDay(farm).ok)
  const loaded = restoreFarm(JSON.parse(JSON.stringify(farm)))!; assert.ok(loaded)
  assert.equal(loaded.day, 2); assert.equal(loaded.concertDay, 1)
  assert.deepEqual(loaded.musicGarden, music)
  const progress = bayConcertProgress(loaded.musicGarden, 0, false, loaded.concertDay === loaded.day)
  assert.equal(progress.completedToday, false); assert.equal(progress.value, 0)
  assert.equal(bayShopDailyLimit(Number(loaded.concertDay === loaded.day), 0), bayShopDailyLimit(0, 0))
})
