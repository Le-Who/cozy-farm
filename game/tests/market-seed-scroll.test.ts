import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import { buySeeds, createFarm, cropDefinitions, seedPackSize } from '../src/farm.ts'

const source = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8')
const start = source.indexOf("    case 'buy-seeds':")
const end = source.indexOf("    case 'garden-shop':", start)
assert.ok(start >= 0 && end > start)
const buy = stripTypeScriptTypes("switch ('buy-seeds') {" + source.slice(start, end) + '}')

function purchase(scroll: number | undefined, coins: number) {
  const crop = 'raspberry', farm = createFarm(), cost = cropDefinitions[crop].seedPrice
  farm.coins = coins
  const before = structuredClone(farm), oldGrid = { scrollTop: scroll ?? 0 }
  let grid = oldGrid, redraws = 0, restores = 0, sounds = 0
  const control = { closest: (selector: string) => selector === '.market-seed-grid' && scroll !== undefined ? oldGrid : null }
  const dialogContent = { querySelector(selector: string) {
    assert.equal(selector, '.market-seed-grid')
    return { set scrollTop(value: number) { grid.scrollTop = value; restores++ } }
  } }
  runInNewContext(buy, { crop, farm, buySeeds, control, dialogContent,
    perform(act: () => { ok: boolean }) {
      if (!act().ok) return false
      // Replacing the market markup creates a different, initially unscrolled grid.
      grid = { scrollTop: 0 }; redraws++
      return true
    },
    playBaySound(cue: string) { assert.equal(cue, 'trade.pay'); sounds++ },
  })
  if (coins < cost) assert.deepEqual(farm, before)
  else {
    before.coins -= cost; before.seeds[crop] += seedPackSize
    assert.deepEqual(farm, before)
  }
  return {scroll: grid.scrollTop, redraws, restores, sounds}
}

test('buying a later seed pack leaves the rebuilt market grid at the same offset', () => {
  assert.deepEqual(purchase(641, 20), {scroll:641, redraws:1, restores:1, sounds:1})
})

test('the first pack, a purchase outside the market grid and a rejected purchase never force scrolling', () => {
  for (const scroll of [0, undefined])
    assert.deepEqual(purchase(scroll, 20), {scroll:0, redraws:1, restores:0, sounds:1})
  assert.deepEqual(purchase(641, 0), {scroll:641, redraws:0, restores:0, sounds:0})
})

const draw = source.indexOf('function drawPanel()'), captureAt = source.indexOf('  const focused =', draw)
const restoreAt = source.indexOf("  if (focused && panel !== 'bay-freight'", captureAt)
const capture = source.slice(captureAt, source.indexOf('  switch (panel)', captureAt))
const restore = source.slice(restoreAt, source.indexOf('\n}', restoreAt))
const redrawFocus = stripTypeScriptTypes(capture + '\nredraw();\n' + restore)

function redrawPack({ keyboard = true, affordable = false, onShelf = true, hasStock = true } = {}) {
  let didRedraw = false, landed = '', stockLookups = 0
  class Button {
    dataset = { action: 'buy-seeds', crop: 'carrot' }
    key: string
    constructor(key: string) { this.key = key }
    matches(selector: string) {
      assert.ok(!didRedraw, 'keyboard modality must be captured before replacing the card')
      assert.equal(selector, '[data-seed-pack] [data-action="buy-seeds"]:focus-visible')
      return onShelf && keyboard
    }
    focus(options: FocusOptions) { assert.equal(options.preventScroll, true); landed = this.key }
  }
  const chosen = new Button('carrot'), stock = { focus(options: FocusOptions) { assert.equal(options.preventScroll, true); landed = 'stock' } }
  const dialogContent = {
    contains: (el: Button) => el === chosen,
    querySelectorAll(selector: string) {
      assert.equal(selector, 'button:not(:disabled)')
      return affordable ? [new Button('other-pack'), new Button('carrot')] : [new Button('other-pack')]
    },
    querySelector(selector: string) {
      assert.ok(didRedraw); stockLookups++
      assert.equal(selector, '[data-seed-pack="carrot"] .market-seed-limit')
      return hasStock ? stock : null
    },
  }
  runInNewContext(redrawFocus, { document: { activeElement: chosen }, HTMLButtonElement: Button, dialogContent,
    panel: 'market', CSS: { escape: (s: string) => s }, focusKey: (el: Button) => el.key,
    closeButton: new Button('close'), redraw() { didRedraw = true } })
  return { landed, stockLookups }
}

test('keyboard stays on the same pack’s updated stock without arming a second action or adding a tab stop', () => {
  assert.match(source, /class="market-seed-limit" role="group" tabindex="-1" aria-label="\$\{definition\.name\}\. \$\{stock\}"/)
  assert.deepEqual(redrawPack(), { landed: 'stock', stockLookups: 1 })
})

test('an affordable replacement, pointer purchase or another surface keeps its usual focus', () => {
  assert.deepEqual(redrawPack({ affordable: true }), { landed: 'carrot', stockLookups: 0 })
  for (const options of [{ keyboard: false }, { onShelf: false }])
    assert.deepEqual(redrawPack(options), { landed: 'close', stockLookups: 0 })
  assert.deepEqual(redrawPack({ hasStock: false }), { landed: 'close', stockLookups: 1 })
})
