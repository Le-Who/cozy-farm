import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { ActionClickGuard, ActivationKeyGuard, isGuardedAction } from '../src/action-click-guard.ts'
import { mixChickenFeed } from '../src/chicken-feed.ts'
import { chickenCarePlayer } from './fixtures/chicken-care-player.ts'

function ready() {
  const player = chickenCarePlayer('garden')
  player.day(); player.act('endDay'); player.day(); player.act('endDay')
  player.act('workBed', 4); player.act('workBed', 9); player.act('pickFruit', 0)
  return player.state
}

test('the coop entry uses its own guarded action rather than generic navigation', () => {
  const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8')
  assert.match(main, /button\('Выбрать смесь', 'chicken-feed-open'/)
  assert.match(main, /case 'chicken-feed-open':[\s\S]*?panel === 'coop' && dialog\.open && farm\.island === 'home' && farm\.buildingLevels\.coop >= 2[\s\S]*?openPanel\('chicken-feed'\)/)
  assert.equal(isGuardedAction('chicken-feed-open'), true)
  assert.equal(isGuardedAction('open-panel'), false, 'unrelated navigation keeps its behavior')
})

test('a double click at overlapping entry and mixture coordinates opens without spending', () => {
  for (const recipe of ['garden', 'orchard'] as const) for (const detail of [1, 2]) {
    const farm = ready(), before = structuredClone(farm), guard = new ActionClickGuard()
    let panel = 'coop'
    const click = (stamp: number, action: 'chicken-feed-open' | 'mix-chicken-feed', clickDetail = 1) => {
      const event = { detail: clickDetail, timeStamp: stamp, clientX: 220, clientY: 575 }
      if (guard.blocks(event)) return false
      if (isGuardedAction(action)) guard.remember(event)
      if (action === 'chicken-feed-open') { panel = 'chicken-feed'; return true }
      return panel === 'chicken-feed' && mixChickenFeed(farm, recipe).ok
    }
    assert.equal(click(1000, 'chicken-feed-open'), true)
    assert.equal(panel, 'chicken-feed')
    assert.equal(click(1120, 'mix-chicken-feed', detail), false)
    assert.deepEqual(farm, before, 'opening must not spend produce, prepare feed or advance work')
    assert.equal(click(1601, 'mix-chicken-feed'), true, 'a fresh deliberate click can still prepare a batch')
    assert.equal(farm.feed, recipe === 'garden' ? 3 : 4)
    assert.equal(farm.produce.wheat, before.produce.wheat - 1)
    assert.equal(farm.chickensFed, false)
  }
})

test('held entry activation stays owned across the redraw and releases normally', () => {
  for (const key of ['Enter', ' ']) {
    const guard = new ActivationKeyGuard()
    assert.equal(guard.blocks({ key, repeat: false }, isGuardedAction('chicken-feed-open')), false)
    assert.equal(guard.blocks({ key, repeat: true }, false), true, 'redraw may move focus outside a guarded button')
    assert.equal(guard.blocks({ key, repeat: true }, isGuardedAction('mix-chicken-feed')), true)
    guard.release(key)
    assert.equal(guard.blocks({ key, repeat: false }, isGuardedAction('mix-chicken-feed')), false)
  }
})
