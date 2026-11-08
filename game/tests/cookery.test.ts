import assert from 'node:assert/strict'
import test from 'node:test'
import {
  beginCookeryStroke, cancelCookery, completeCookery, cookeryParticle, cookeryProgress,
  cookeryViewport, createCookeryModel, endCookeryStroke, fillCookeryJar,
  moveCookeryStroke, placeCookeryFruit, STIR_REQUIRED,
} from '../src/cookery-model.ts'

function addFruit(kind: 'preserves' | 'decorate') {
  const model = createCookeryModel(kind)
  for (let i = 0; i < model.fruitRequired; i++) assert.equal(placeCookeryFruit(model, i, { x: Math.cos(i) * .5, y: Math.sin(i) * .5 }), true)
  return model
}

test('fruit is freely arranged, with no prescribed pattern; outside drops and duplicate ingredients do not advance preparation', () => {
  const model = createCookeryModel('decorate')
  assert.equal(placeCookeryFruit(model, 0, { x: 1, y: 0 }), false)
  assert.equal(placeCookeryFruit(model, 0, { x: NaN, y: 0 }), false)
  placeCookeryFruit(model, 0, { x: .1, y: .2 })
  placeCookeryFruit(model, 0, { x: -.3, y: -.2 })
  assert.equal(model.fruit.length, 1)
  assert.equal(model.fruit[0].x, -.3)
  placeCookeryFruit(model, 1, { x: .2, y: .1 })
  placeCookeryFruit(model, 2, { x: .5, y: .2 })
  assert.equal(model.stage, 'sprinkle')
  assert.equal(placeCookeryFruit(model, 3, { x: -.5, y: .2 }), true)
  assert.equal(placeCookeryFruit(model, 0, { x: 0, y: -.5 }), true)
  assert.equal(model.fruit.length, 4)
})

test('preserves require actual circular stirring and three honest scoops before inventory can commit', () => {
  const model = addFruit('preserves')
  assert.equal(model.stage, 'stir')
  assert.equal(fillCookeryJar(model), false)
  beginCookeryStroke(model, { x: .6, y: 0 })
  for (let i = 1; i <= 200; i++) moveCookeryStroke(model, { x: Math.cos(i / 200 * STIR_REQUIRED * 1.02) * .6, y: Math.sin(i / 200 * STIR_REQUIRED * 1.02) * .6 })
  assert.equal(model.stage, 'fill')
  assert.equal(cookeryProgress(model), 0)
  fillCookeryJar(model); fillCookeryJar(model)
  assert.equal(model.stage, 'fill')
  fillCookeryJar(model)
  assert.equal(model.stage, 'ready')
  let committed = 0
  assert.equal(completeCookery(model, () => { committed++; assert.equal(completeCookery(model, () => true), false); return true }), true)
  assert.equal(completeCookery(model, () => { committed++; return true }), false)
  assert.equal(committed, 1)
})

test('stationary samples, jumps across the pot and a tiny oscillation cannot finish stirring', () => {
  const model = addFruit('preserves')
  beginCookeryStroke(model, { x: .6, y: 0 })
  for (let i = 0; i < 1000; i++) moveCookeryStroke(model, { x: .6, y: i % 2 ? .02 : 0 })
  assert.equal(model.stage, 'stir')
  assert.ok(model.stirSectors.size < 14)
  endCookeryStroke(model)
  beginCookeryStroke(model, { x: -.9, y: 0 })
  const before = model.stirred
  moveCookeryStroke(model, { x: .9, y: 0 })
  assert.equal(model.stirred, before)
})

test('sprinkles cover swept paths even with sparse pointer samples; repeated local dusting cannot finish', () => {
  const model = addFruit('decorate')
  for (let i = 0; i < 100; i++) {
    beginCookeryStroke(model, { x: -.1, y: 0 })
    moveCookeryStroke(model, { x: .1, y: 0 })
    endCookeryStroke(model)
  }
  assert.equal(model.stage, 'sprinkle')
  assert.ok(model.sprinkled.size < 20)
  beginCookeryStroke(model, { x: -.7, y: 0 })
  moveCookeryStroke(model, { x: .7, y: 0 })
  endCookeryStroke(model)
  assert.equal(model.sprinkled.has(0), true, 'a full-width fast sweep dusts the intervening center')
  for (let y = -.75; y <= .75; y += .15) {
    const half = Math.sqrt(1 - y * y) * .9
    beginCookeryStroke(model, { x: -half, y })
    moveCookeryStroke(model, { x: 0, y })
    moveCookeryStroke(model, { x: half, y })
    endCookeryStroke(model)
  }
  assert.equal(model.stage, 'ready')
})

test('failed inventory transaction is retryable and cancellation never commits', () => {
  const model = addFruit('decorate')
  let calls = 0
  assert.equal(completeCookery(model, () => { calls++; return true }), false)
  assert.equal(calls, 0)
  model.stage = 'ready'
  assert.equal(completeCookery(model, () => false), false)
  assert.equal(model.stage, 'ready')
  assert.throws(() => completeCookery(model, () => { throw new Error('inventory') }))
  assert.equal(model.stage, 'ready')
  cancelCookery(model)
  assert.equal(completeCookery(model, () => { calls++; return true }), false)
  assert.equal(calls, 0)
})

test('all required phone and zoomed intermediate bounds preserve a visible stage and controls', () => {
  for (const [width, height] of [[360, 640], [390, 844], [568, 320], [844, 390], [520, 480], [1440, 900]]) {
    const fit = cookeryViewport(width, height)
    assert.ok(fit.width <= width - 20)
    assert.ok(fit.height <= height - 20)
    assert.ok(fit.stageHeight > 150)
    assert.ok(fit.stageHeight < fit.height)
  }
})

test('sprinkle flecks have deterministic bounded variation without a random global source', () => {
  for (let i = 0; i < 200; i++) {
    const a = cookeryParticle(i), b = cookeryParticle(i)
    assert.deepEqual(a, b)
    assert.ok(Math.abs(a.x) <= 1 && Math.abs(a.y) <= 1)
    assert.ok(a.size >= .7 && a.size <= 1.3)
  }
})
