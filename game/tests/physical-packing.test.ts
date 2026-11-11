import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { packEggBasket, packEggCrate, unpackEggBasket, unpackEggCrate, restoreFarm, type PackingResult } from '../src/farm.ts'
import { installActionClickGuard, isGuardedAction } from '../src/action-click-guard.ts'
import { physicalPackingFixture } from './fixtures/physical-packing.ts'

const proof = (kind: PackingResult['kind']): PackingResult => ({
  kind, settled: true,
  placements: (kind === 'basket' ? [-.5, 0, .5] : [-.8, -.4, 0, .4, .8]).map(x => ({ x, y: 0 })),
})

test('the physical packing fixture preserves exact basket and crate quantities across reload and unpacking', () => {
  const farm = physicalPackingFixture()
  const before = structuredClone(farm)
  assert.ok(packEggBasket(farm, proof('basket')).ok)
  assert.equal(farm.eggs, 13)
  assert.equal(farm.eggBaskets, 1)
  assert.equal(farm.eggCrates, 0)
  assert.equal(farm.workToday, 1)
  let loaded = restoreFarm(JSON.parse(JSON.stringify(farm)))!
  assert.deepEqual(loaded, farm)
  assert.ok(packEggCrate(loaded, proof('crate')).ok)
  assert.equal(loaded.eggs, 8)
  assert.equal(loaded.eggBaskets, 1)
  assert.equal(loaded.eggCrates, 1)
  assert.equal(loaded.workToday, 2)
  assert.equal(loaded.coins, before.coins)
  assert.equal(loaded.day, before.day)
  assert.deepEqual(loaded.variants, before.variants)
  loaded = restoreFarm(JSON.parse(JSON.stringify(loaded)))!
  assert.ok(unpackEggBasket(loaded).ok)
  assert.ok(unpackEggCrate(loaded).ok)
  assert.equal(loaded.eggs, before.eggs)
  assert.equal(loaded.eggBaskets, 0)
  assert.equal(loaded.eggCrates, 0)
  assert.equal(loaded.workToday, 2, 'unpacking does not undo completed work')
})

test('stale packing resources, location and proof fail without spending anything', () => {
  for (const kind of ['basket', 'crate'] as const) {
    for (const failure of ['resources', 'location', 'overlap', 'count', 'gate'] as const) {
      const farm = physicalPackingFixture(), layout = proof(kind)
      if (failure === 'resources') farm.eggs = kind === 'basket' ? 2 : 4
      if (failure === 'location') farm.island = 'village'
      if (failure === 'gate') {
        farm.buildingLevels.coop = 1
        farm.coopSpecialization = null
      }
      if (failure === 'overlap') layout.placements = layout.placements.map(() => ({ x: 0, y: 0 }))
      if (failure === 'count') layout.placements = layout.placements.slice(1)
      const before = structuredClone(farm)
      assert.equal((kind === 'basket' ? packEggBasket : packEggCrate)(farm, layout).ok, false, `${kind}: ${failure}`)
      assert.deepEqual(farm, before)
    }
  }
})

test('packing finish is wired to the shared capture guard, without changing neighbor assembly', () => {
  const source = readFileSync(new URL('../src/arrangement.ts', import.meta.url), 'utf8')
  assert.match(source, /const packing = options\.mode === 'eggs' \|\| options\.mode === 'crate'/)
  assert.ok(source.includes('${packing ? \' data-action="finish-egg-packing"\' : \'\'} disabled>Готово'))
  assert.equal(isGuardedAction('finish-egg-packing'), true)
})

test('the installed capture handler absorbs the redraw click before the dialog backdrop closes', () => {
  class Control {
    dataset: { action?: string }
    disabled = false
    private button: boolean
    constructor(action?: string, button = true) { this.dataset = { action }; this.button = button }
    closest(selector: string) { return selector === 'button' && this.button ? this : null }
  }
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'Element')
  Object.defineProperty(globalThis, 'Element', { configurable: true, value: Control })
  try {
    let capture: (event: unknown) => void = () => { throw Error('Capture handler not installed') }
    const root = {
      addEventListener(name: string, handler: typeof capture, capturePhase: boolean) {
        assert.equal(name, 'click'); assert.equal(capturePhase, true); capture = handler
      },
      ownerDocument: { addEventListener() {}, defaultView: { addEventListener() {} } },
    }
    installActionClickGuard(root as unknown as HTMLElement)
    const click = (target: Control, timeStamp: number, detail = 1, clientX = 850) => {
      const event = { target, timeStamp, detail, clientX, clientY: 630, prevented: false, stopped: false,
        preventDefault() { this.prevented = true }, stopImmediatePropagation() { this.stopped = true } }
      capture(event)
      assert.equal(event.prevented, event.stopped)
      return event.prevented
    }
    const finish = new Control('finish-egg-packing'), backdrop = new Control(undefined, false)
    const farm = physicalPackingFixture()
    assert.equal(click(finish, 100), false)
    assert.ok(packEggBasket(farm, proof('basket')).ok)
    for (const detail of [1, 2]) assert.equal(click(backdrop, 180, detail), true, 'a replaced target may restart detail at one')
    assert.equal(farm.eggs, 13); assert.equal(farm.eggBaskets, 1); assert.equal(farm.workToday, 1)
    assert.equal(click(new Control(), 200, 1, 750), false, 'a separate close button at another position works')
    assert.equal(click(backdrop, 701), false, 'a deliberate later backdrop close works')
    assert.equal(click(finish, 800), false)
    assert.equal(click(new Control(), 810, 0), false, 'independent keyboard activation works')
    finish.disabled = true
    assert.equal(click(finish, 1400), false)
    assert.equal(click(backdrop, 1450, 2), false, 'disabled confirmation does not start the guard')
  } finally {
    if (previous) Object.defineProperty(globalThis, 'Element', previous)
    else Reflect.deleteProperty(globalThis, 'Element')
  }
})
