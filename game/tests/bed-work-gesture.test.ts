import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ActionClickGuard, ActivationKeyGuard, isGuardedAction } from '../src/action-click-guard.ts'
import { endDay, getBedAction, restoreFarm, workBed } from '../src/farm.ts'
import { cropSpaceFixture } from './fixtures/crop-space.ts'

const click = (timeStamp: number, detail = 1) => ({ timeStamp, detail, clientX: 344, clientY: 689 })
const ready = () => { const farm = cropSpaceFixture(); endDay(farm); return farm }
const reload = (farm: ReturnType<typeof ready>) => {
  const restored = restoreFarm(JSON.parse(JSON.stringify(farm)))
  assert.ok(restored)
  return restored
}

test('the bed context button owns mouse and held-key activation', () => {
  assert.equal(isGuardedAction('work-context'), true)
})

test('a double harvest click queues only one job before the farmer reaches the bed', () => {
  const farm = ready(), expected = structuredClone(farm), guard = new ActionClickGuard()
  const queued: (() => void)[] = []
  const enqueue = (stamp: number, detail: number) => {
    const event = click(stamp, detail)
    if (guard.blocks(event)) return
    if (isGuardedAction('work-context')) guard.remember(event)
    queued.push(() => { if (getBedAction(farm, 1).available) workBed(farm, 1) })
  }
  enqueue(100, 1); enqueue(180, 2)
  assert.deepEqual(farm, expected, 'queued work has not committed before the animation')
  assert.equal(queued.length, 1)
  queued.forEach(commit => commit())
  assert.equal(workBed(expected, 1).ok, true)
  assert.deepEqual(farm, expected, 'one harvest keeps the existing reward and cannot queue sowing')
  assert.equal(farm.beds[1].kind, 'tilled')
  assert.equal(farm.seeds.wheat, 3)
  assert.equal(farm.produce.carrot, 3)
  assert.deepEqual(reload(farm), farm)
})

test('the replacement sow button rejects a repeated click but accepts a separate later choice', () => {
  const farm = ready(), expected = structuredClone(farm), guard = new ActionClickGuard()
  const activate = (stamp: number, detail = 1) => {
    const event = click(stamp, detail)
    if (guard.blocks(event)) return false
    if (isGuardedAction('work-context')) guard.remember(event)
    return workBed(farm, 1).ok
  }
  assert.equal(activate(100), true)
  assert.equal(activate(180, 2), false)
  assert.equal(farm.beds[1].kind, 'tilled'); assert.equal(farm.seeds.wheat, 3)
  assert.equal(activate(701), true)
  workBed(expected, 1); workBed(expected, 1)
  assert.deepEqual(farm, expected)
  assert.deepEqual(farm.beds[1], { kind: 'crop', crop: 'wheat', growth: 0, watered: false })
  assert.equal(farm.seeds.wheat, 2); assert.equal(farm.water, 6)
  assert.equal(farm.produce.wheat, 0)
  assert.deepEqual(reload(farm), farm)
})

test('a held Enter or Space cannot sow or water after harvest; release permits a new sow', () => {
  for (const key of ['Enter', ' ']) {
    const farm = ready(), expected = structuredClone(farm), keys = new ActivationKeyGuard()
    const activate = (repeat: boolean) => {
      if (keys.blocks({ key, repeat }, isGuardedAction('work-context'))) return false
      return workBed(farm, 1).ok
    }
    assert.equal(activate(false), true)
    assert.equal(activate(true), false); assert.equal(activate(true), false)
    assert.equal(farm.beds[1].kind, 'tilled'); assert.equal(farm.seeds.wheat, 3)
    keys.release(key)
    assert.equal(activate(false), true); assert.equal(activate(true), false)
    workBed(expected, 1); workBed(expected, 1)
    assert.deepEqual(farm, expected)
    assert.equal(farm.water, 6)
    assert.deepEqual(reload(farm), farm)
  }
})

test('an independent keyboard activation remains available after a pointer harvest', () => {
  const farm = ready(), guard = new ActionClickGuard(), keys = new ActivationKeyGuard()
  const first = click(100)
  assert.equal(guard.blocks(first), false)
  if (isGuardedAction('work-context')) guard.remember(first)
  assert.equal(workBed(farm, 1).ok, true)
  assert.equal(keys.blocks({ key: 'Enter', repeat: false }, isGuardedAction('work-context')), false)
  assert.equal(guard.blocks(click(200, 0)), false, 'a new keyboard confirmation is not the second pointer click')
  assert.equal(workBed(farm, 1).ok, true)
  assert.equal(keys.blocks({ key: 'Enter', repeat: true }, true), true)
  assert.equal(farm.seeds.wheat, 2); assert.equal(farm.water, 6)
  assert.deepEqual(farm.beds[1], { kind: 'crop', crop: 'wheat', growth: 0, watered: false })
  assert.deepEqual(reload(farm), farm)
})
