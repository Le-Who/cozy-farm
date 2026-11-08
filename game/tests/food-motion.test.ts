import test from 'node:test'
import assert from 'node:assert/strict'
import { createFruitLanding, createViscousFollower, stepFruitLanding, stepSpring, stepViscousFollower } from '../src/food-motion.ts'

function near(actual: number, expected: number, tolerance = 1e-10) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}`)
}

test('spring time partition preserves displacement and momentum in all damping regimes', () => {
  for (const damping of [0, .32, .65, 1, 1.00001, 1.6, 5]) {
    const whole = { value: -.4, velocity: 2.3 }, split = { ...whole }
    stepSpring(whole, .7, .4, { frequency: 3, damping })
    for (const dt of [.013, .077, .1, .044, .016, .09, .06]) stepSpring(split, .7, dt, { frequency: 3, damping })
    near(split.value, whole.value)
    near(split.velocity, whole.velocity)
  }
})

test('underdamped spring visibly overshoots then settles without persistent jitter', () => {
  const state = { value: .25, velocity: -1 }
  let crossed = false
  for (let frame = 0; frame < 360; frame++) {
    stepSpring(state, 0, 1 / 60, { frequency: 4, damping: .4 })
    crossed ||= state.value < 0
    assert.ok(Number.isFinite(state.value) && Number.isFinite(state.velocity))
  }
  assert.ok(crossed)
  near(state.value, 0, 1e-15)
  near(state.velocity, 0, 1e-15)
})

test('spring remains stable over .1 second frames and a suspended-tab interval', () => {
  for (const damping of [.1, 1, 4]) {
    const state = { value: 2, velocity: -12 }
    for (let frame = 0; frame < 40; frame++) stepSpring(state, -.2, .1, { frequency: 24, damping })
    stepSpring(state, -.2, 30, { frequency: 24, damping })
    near(state.value, -.2)
    near(state.velocity, 0)
  }
})

test('spring pause is inert and zero stiffness preserves free motion', () => {
  const state = { value: .2, velocity: .4 }
  for (const dt of [0, -.1, NaN, Infinity]) stepSpring(state, 3, dt)
  assert.deepEqual(state, { value: .2, velocity: .4 })
  stepSpring(state, 3, .5, { frequency: 0 })
  near(state.value, .4)
  near(state.velocity, .4)
})

test('viscous follower lags an abrupt cursor move without overshooting and settles after release', () => {
  const state = createViscousFollower()
  stepViscousFollower(state, 1, -.5, 1 / 60)
  assert.ok(state.x > 0 && state.x < .1)
  assert.ok(state.y < 0 && state.y > -.05)
  let previous = state.x
  for (let frame = 0; frame < 180; frame++) {
    stepViscousFollower(state, 1, -.5, 1 / 60)
    assert.ok(state.x >= previous && state.x <= 1)
    previous = state.x
  }
  near(state.x, 1)
  near(state.y, -.5)
  near(state.vx, 0)
  near(state.vy, 0)
})

test('viscous follower preserves both axes across uneven frame partitions and response settings', () => {
  for (const response of [4, 12, 30]) {
    const whole = { ...createViscousFollower(-.2, .4), vx: .8, vy: -.1 }, split = { ...whole }
    stepViscousFollower(whole, .6, -.7, .2, response)
    for (const dt of [.02, .07, .1, .01]) stepViscousFollower(split, .6, -.7, dt, response)
    for (const key of ['x', 'y', 'vx', 'vy'] as const) near(split[key], whole[key])
  }
})

test('fruit landing resolves subframe contacts identically at 30 and 120 Hz', () => {
  const slow = createFruitLanding(.25, .1), fast = { ...slow }, whole = { ...slow }
  const options = { restitution: .5, settleSpeed: .012 }
  for (let i = 0; i < 15; i++) stepFruitLanding(slow, 1 / 30, options)
  for (let i = 0; i < 60; i++) stepFruitLanding(fast, 1 / 120, options)
  stepFruitLanding(whole, .5, options)
  for (const state of [slow, fast]) {
    near(state.height, whole.height)
    near(state.velocity, whole.velocity)
    assert.equal(state.bounces, whole.bounces)
  }
  assert.ok(whole.bounces > 0)
  assert.ok(whole.height > 0)
})

test('fruit gently bounces then rests exactly on the surface; settled state stays still', () => {
  const state = createFruitLanding(.12)
  let roseAfterContact = false
  for (let i = 0; i < 300; i++) {
    stepFruitLanding(state, .01)
    assert.ok(state.height >= 0)
    assert.ok(Number.isFinite(state.height) && Number.isFinite(state.velocity))
    roseAfterContact ||= state.bounces > 0 && state.height > 0
  }
  assert.ok(roseAfterContact)
  assert.ok(state.settled)
  assert.equal(state.height, 0)
  assert.equal(state.velocity, 0)
  assert.ok(state.bounces >= 2)
  const stopped = { ...state }
  stepFruitLanding(state, 10)
  assert.deepEqual(state, stopped)
})

test('large landing steps terminate even with a raised restitution; launch from the surface remains physical', () => {
  const long = createFruitLanding(.4, -8)
  stepFruitLanding(long, 60, { restitution: .8, settleSpeed: .001 })
  assert.deepEqual({ height: long.height, velocity: long.velocity, settled: long.settled }, { height: 0, velocity: 0, settled: true })
  assert.ok(long.bounces < 100)
  const launch = createFruitLanding(0, .3)
  stepFruitLanding(launch, .02)
  assert.ok(launch.height > 0)
  assert.equal(launch.bounces, 0)
  const rest = createFruitLanding(0)
  assert.ok(rest.settled)
})
