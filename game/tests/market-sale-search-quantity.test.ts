import test from 'node:test'
import assert from 'node:assert/strict'
import { namedMarketSaleQuantity, searchMarketSaleView } from '../src/market-sale-search.ts'

const apple = { key: 'fruit:apple', name: 'Яблоко', count: 315, group: 'harvest' }
const rare = { key: 'variants:fruit:apple:rainbow', name: 'Радужное яблоко', count: 1, group: 'harvest' }
const pear = { key: 'fruit:pear', name: 'Груша', count: 4, group: 'harvest' }
const jar = { key: 'dish:appleJam', name: 'Яблочное варенье', count: 4, group: 'kitchen' }
const stock = [apple, rare, pear, jar]
test('only a unique exact visible market name chooses the existing multi-quantity editor', () => {
  const visible = searchMarketSaleView(stock, 'harvest', 'Яблоко').items
  assert.deepEqual(visible, [apple, rare])
  assert.equal(namedMarketSaleQuantity(visible, '  ЯБЛОКО  '), apple)
  assert.equal(namedMarketSaleQuantity(visible, 'яблоки'), undefined)
  assert.equal(namedMarketSaleQuantity(visible, 'яб'), undefined)
  assert.equal(namedMarketSaleQuantity(visible, 'Радужное яблоко'), undefined)
  assert.equal(namedMarketSaleQuantity(visible, 'Груша'), undefined)
  assert.equal(namedMarketSaleQuantity([apple, { ...apple, key: 'another-item', count: 1 }], 'яблоко'), undefined)
  assert.equal(namedMarketSaleQuantity([apple, { ...apple, key: 'sold-out', count: 0 }], 'яблоко'), apple)
  assert.equal(namedMarketSaleQuantity(searchMarketSaleView(stock, 'kitchen', 'Яблоко').items, 'яблоко'), undefined)
  assert.deepEqual(stock, [apple, rare, pear, jar])
})
