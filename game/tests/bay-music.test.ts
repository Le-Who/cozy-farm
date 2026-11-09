import test from 'node:test'
import assert from 'node:assert/strict'
import { BAY_INSTRUMENT_IDS, BAY_MUSIC_EXPANSIONS, bayActiveVoices, bayFestivalPattern, bayPerformanceQuality, cloneBayPattern, createBayMusicState, normalizeBayMusicState } from '../src/bay-music-model.ts'

test('the starter garden is already a four voice composition with two freight expansions', () => {
  const state = createBayMusicState()
  assert.equal(bayActiveVoices(state), 4)
  assert.equal(bayPerformanceQuality(state), 1)
  assert.equal(state.level, 0)
  state.level = 1; assert.equal(bayActiveVoices(state), 5)
  state.level = 2; assert.equal(bayActiveVoices(state), 6)
  assert.deepEqual(BAY_MUSIC_EXPANSIONS.map(expansion => expansion.materials.map(material => material.id)), [['shells', 'seaSalt'], ['shells', 'beeswax']])
})

test('muted, silent and empty tracks do not earn a performance bonus', () => {
  const state = createBayMusicState()
  state.tracks.ceramic.muted = true
  state.tracks.harp.volume = 0
  state.tracks.handpan.steps.fill(-1)
  assert.equal(bayActiveVoices(state), 1)
  assert.equal(bayPerformanceQuality(state), .25)
  state.tracks.marimba.muted = true
  assert.equal(bayActiveVoices(state), 0)
  assert.equal(bayPerformanceQuality(state), 0)
})

test('presets own their notes, tempo and mix independently of the live edit', () => {
  const state = createBayMusicState(), preset = cloneBayPattern(state)
  state.saved[0] = preset
  state.tracks.marimba.steps[0] = 7
  state.tracks.harp.volume = .13
  state.tempo = 130
  assert.equal(preset.tracks.marimba.steps[0], 0)
  assert.equal(preset.tracks.harp.volume, .7)
  assert.equal(preset.tempo, 88)
  const restored = normalizeBayMusicState(JSON.parse(JSON.stringify(state)))
  assert.deepEqual(restored, state)
  restored.tracks.marimba.steps[0] = 4
  assert.equal(state.tracks.marimba.steps[0], 7)
  restored.saved[0]!.tracks.harp.steps.fill(-1)
  assert.notDeepEqual(restored.saved[0], state.saved[0])
})

test('damaged and earlier saves become a finite playable sixteen step score', () => {
  const state = normalizeBayMusicState({tempo:Infinity,level:100,performances:-5,tracks:{ceramic:{steps:[999,NaN,-100,'loud'],volume:Infinity,muted:'yes'},marimba:null},saved:[{tempo:-80,tracks:{harp:{volume:3,steps:[]}}}]})
  assert.equal(state.level, 2); assert.equal(state.tempo,88); assert.equal(state.performances,0)
  assert.deepEqual(state.tracks.ceramic.steps.slice(0,4),[7,-1,-1,-1])
  assert.equal(state.tracks.ceramic.volume,.7); assert.equal(state.tracks.ceramic.muted,false)
  for (const id of BAY_INSTRUMENT_IDS) { assert.equal(state.tracks[id].steps.length,16); assert.ok(state.tracks[id].steps.every(note=>Number.isInteger(note)&&note>=-1&&note<=7)) }
  assert.equal(state.saved.length,3); assert.equal(state.saved[0]!.tempo,54); assert.equal(state.saved[0]!.tracks.harp.volume,1)
  assert.deepEqual(normalizeBayMusicState(null),createBayMusicState())
})

test('three stage celebrations unlock distinct reusable music without consuming personal recordings', () => {
  const state = createBayMusicState(); state.saved = [cloneBayPattern(state), cloneBayPattern(state), cloneBayPattern(state)]
  state.festivalUnlocked = true; state.festivalLevel = 3
  const restored = normalizeBayMusicState(JSON.parse(JSON.stringify(state)))
  assert.equal(restored.festivalUnlocked, true); assert.equal(restored.festivalLevel, 3)
  assert.deepEqual(restored.saved, state.saved)
  const scores = [1, 2, 3].map(bayFestivalPattern)
  assert.equal(new Set(scores.map(score => score.name)).size, 3)
  assert.notDeepEqual(scores[0].tracks.marimba.steps, scores[1].tracks.marimba.steps)
  scores[0].tracks.marimba.steps.fill(-1)
  assert.ok(bayFestivalPattern(1).tracks.marimba.steps.some(note => note >= 0))
  assert.deepEqual(restored.saved, state.saved)
})
