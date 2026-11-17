import test from 'node:test'
import assert from 'node:assert/strict'
import { orchardMarketReturnIndex } from '../src/orchard-market-return.ts'
const visit = (panel: string, marketTab = 'buy', marketCategory = 'trees') => ({ panel, marketTab, marketCategory })

test('only the exact Market Trees space-making origin permits one-step return through Orchard and Tree', () => {
  const origin = visit('market'), history = [visit('guide'), origin, visit('orchard')], before = structuredClone(history)
  assert.equal(orchardMarketReturnIndex(history, origin, 'tree', 'home'), 1)
  assert.equal(orchardMarketReturnIndex(history.slice(0, 2), origin, 'orchard', 'home'), 1)
  assert.deepEqual(history, before)
})

test('ordinary entries, replaced histories, other markets, shores and intervening routes cannot borrow the shortcut', () => {
  const origin = visit('market')
  for (const [history, marker, panel, island] of [
    [[origin], undefined, 'orchard', 'home'],
    [[{...origin}], origin, 'tree', 'home'],
    [[], origin, 'tree', 'home'],
    [[origin], origin, 'market', 'home'],
    [[origin], origin, undefined, 'home'],
    [[origin], origin, 'tree', 'grove'],
    [[origin, visit('guide')], origin, 'orchard', 'home'],
  ] as const) assert.equal(orchardMarketReturnIndex(history, marker, panel, island), -1)
  for (const origin of [visit('guide'), visit('market', 'sell'), visit('market', 'buy', 'seeds')]) {
    assert.equal(orchardMarketReturnIndex([origin], origin, 'orchard', 'home'), -1)
  }
})
