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
