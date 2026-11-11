import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { forgetSignature, repeatSignature, restoreFarm } from '../src/farm.ts'
import { ActivationKeyGuard, installActionClickGuard, isGuardedAction } from '../src/action-click-guard.ts'
import { recipeDeleteFixture } from './fixtures/recipe-delete.ts'

const reload = (farm: ReturnType<typeof recipeDeleteFixture>) => restoreFarm(JSON.parse(JSON.stringify(farm)))!

test('empty recipe deletion owns the gesture, preserving the next recipe and its exact repeat after reload', () => {
  class Control {
    disabled = false
    dataset: { action: string; value: string }
    constructor(id: string) { this.dataset = { action: 'forget-signature', value: id } }
    closest(selector: string) { return selector === 'button' ? this : null }
  }
  const old = Object.getOwnPropertyDescriptor(globalThis, 'Element')
  Object.defineProperty(globalThis, 'Element', { configurable: true, value: Control })
  try {
    let capture: (event: unknown) => void = () => { throw Error('Missing capture') }
    const root = {
      addEventListener(name: string, handler: typeof capture, phase: boolean) { assert.equal(name, 'click'); assert.equal(phase, true); capture = handler },
      ownerDocument: { addEventListener() {}, defaultView: { addEventListener() {} } },
    }
    installActionClickGuard(root as unknown as HTMLElement)
    const farm = recipeDeleteFixture(), before = structuredClone(farm)
    let actions = 0
    const click = (id: string, timeStamp: number, detail = 1) => {
      const event = { target: new Control(id), timeStamp, detail, clientX: 280, clientY: 430, prevented: false,
        preventDefault() { this.prevented = true }, stopImmediatePropagation() {} }
      capture(event)
      if (!event.prevented) { actions++; forgetSignature(farm, id) }
      return event.prevented
    }
    assert.equal(click('s1', 100), false)
    assert.equal(click('s2', 200, 2), true, 'redraw puts the next delete button under the same pointer')
    assert.equal(click('s2', 201, 1), true, 'a replaced element may restart detail at one')
    assert.equal(actions, 1)
    const expected = structuredClone(before)
    expected.culinary.recipes = expected.culinary.recipes.filter(r => r.id !== 's1')
    delete expected.culinary.stock.s1
    assert.deepEqual(farm, expected)
    assert.deepEqual(reload(farm), expected)
    const loaded = reload(farm), recipe = structuredClone(loaded.culinary.recipes.find(r => r.id === 's2')!)
    assert.ok(repeatSignature(loaded, 's2').ok)
    assert.equal(loaded.culinary.serial, 3)
    assert.deepEqual(loaded.culinary.recipes.find(r => r.id === 's2'), { ...recipe, batches: recipe.batches + 1 })
    assert.equal(loaded.culinary.stock.s2, 1)
    assert.equal(click('s2', 800), false, 'a new deliberate click can delete the next empty recipe')
    assert.equal(click('s3', 810, 0), false, 'independent keyboard activation is not a pointer double-click')
    assert.equal(farm.culinary.recipes.length, 0)
    assert.ok(reload(farm))
  } finally {
    if (old) Object.defineProperty(globalThis, 'Element', old)
    else Reflect.deleteProperty(globalThis, 'Element')
  }
})

test('deletion keeps existing protection of favorites, portions and stored portions, and rejects stale IDs', () => {
  for (const block of ['favorite', 'stock', 'warehouse', 'stale'] as const) {
    const farm = recipeDeleteFixture()
    if (block === 'favorite') farm.culinary.recipes[0].favorite = true
    if (block === 'stock') farm.culinary.stock.s1 = 1
    if (block === 'warehouse') farm.freight.warehouses.home['signature:s1'] = 1
    if (block === 'stale') assert.ok(forgetSignature(farm, 's1').ok)
    assert.ok(reload(farm))
    const before = structuredClone(farm)
    assert.equal(forgetSignature(farm, 's1').ok, false)
    assert.deepEqual(farm, before)
  }
})

test('held activation cannot leak from a deleted recipe to the replacement control', () => {
  assert.equal(isGuardedAction('forget-signature'), true)
  const guard = new ActivationKeyGuard()
  assert.equal(guard.blocks({ key: 'Enter', repeat: false }, true), false)
  assert.equal(guard.blocks({ key: 'Enter', repeat: true }, false), true)
  guard.release('Enter')
  assert.equal(guard.blocks({ key: 'Enter', repeat: false }, true), false)
})

test('book deletion continues to carry the exact recipe ID into the domain action', () => {
  const ui = readFileSync(new URL('../src/culinary-ui.ts', import.meta.url), 'utf8')
  const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8')
  assert.ok(ui.includes('data-action="forget-signature" data-value="${recipe.id}"'))
  assert.match(main, /case 'forget-signature':if\(value\)perform\(\(\)=>forgetSignature\(farm,value!\),false,true\)/)
})
