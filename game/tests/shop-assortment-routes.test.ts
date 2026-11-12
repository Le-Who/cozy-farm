import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { assortmentRoute } from './fixtures/assortment-routes.ts'
const opening = JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json', import.meta.url), 'utf8'))

test('seven twelve-order routes earn ingredients, survive every reload and never inflate a set premium', () => {
  for (const [policy, logistics] of [['jam','bag'],['tart','bag'],['set','bag'],['jam','warehouse'],['set','warehouse'],['set','paused'],['alternating','bag']] as const) {
    let snapshots = 0
    const route = assortmentRoute(opening, policy, logistics, farm => { snapshots++; assert.ok(farm.coins >= 0) })
    assert.equal(route.end.completed, 14); assert.ok(snapshots > 300)
    for (const row of route.log) {
      assert.equal(row.premium, 12)
      assert.equal(row.payment, row.kind === 'jam' ? 88 : row.kind === 'tart' ? 140 : 114)
    }
    assert.equal(route.end.version, policy === 'set' ? 2 : 1)
  }
})
