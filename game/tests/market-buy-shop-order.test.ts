import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { runInNewContext } from 'node:vm'
import * as F from '../src/farm.ts'
import { ruPlural } from '../src/ru.ts'
import { earned416Mixed } from './fixtures/earned-416-market-orders.ts'

const source = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8')
function section(start: string, next: string) {
  const a = source.indexOf(start), b = source.indexOf(next, a + start.length)
  assert.ok(a >= 0 && b > a, start)
  return source.slice(a, b)
}
const render = stripTypeScriptTypes(
  section('function button(', 'function goods()') +
  section('function marketCareProducts(', 'function treeSelector()') + '\nmarketCards()',
)
const branches = [
  ['seeds', '<div class="market-seed-grid">', ['buy-seeds'], 10],
  ['trees', '<div class="market-tree-grid">', ['buy-sapling'], 3],
  ['care', '<div class="market-care-grid">', ['buy-feed', 'upgrade-can'], 2],
] as const
const tabs = ['buy','sell','orders','projects'] as const
function market(farm: F.FarmState, marketCategory: string, marketTab: typeof tabs[number] = 'buy') {
  return runInNewContext(render, {
    ...F, farm, marketCategory, marketTab, ruPlural, numberFormat: new Intl.NumberFormat('ru-RU'),
    icon: (id: string) => `<img data-icon="${id}" alt="">`,
    itemIcon: (id: string) => `<img data-icon="${id}" alt="">`,
    marketOrders: () => '<div data-existing-market-orders></div>',
    projectCard: () => '<div data-existing-project-card></div>',
    escapeHtml: (s: string) => s, marketBulkSaleControls: () => '',
    marketSaleQuery: '', marketSellGroup: 'all', marketSaleFamily: undefined,
    marketSaleSearchStatus: () => '', marketSaleResults: () => '<div data-existing-sale-results></div>',
  }) as string
}
function buttons(html: string) {
  return [...html.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)].map(match => {
    const tag = match[0].slice(0, match[0].indexOf('>') + 1)
    return {
      html: match[0], index: match.index, action: tag.match(/data-action="([^"]+)"/)?.[1],
      value: tag.match(/data-value="([^"]+)"/)?.[1],
      enabled: !/\sdisabled(?:\s|>|=)/.test(tag),
    }
  })
}
const isShop = (control: ReturnType<typeof buttons>[number]) => control.action === 'open-panel' && control.value === 'bay-shop'

test('earned Home and Harbour Buy put the one existing shop outlet before all three live catalogs without spending or losing options', () => {
  const p = earned416Mixed()
  assert.equal(p.actions, 552); assert.equal(p.state.day, 196)
  assert.equal(F.getSale(p.state).items, 416); assert.equal(p.state.coins, 60)
  const layout: [string, string, number, boolean][] = []
  for (const island of ['home','village'] as const) {
    p.visit(island)
    const before = structuredClone(p.state)
    for (const [category, grid, actions, count] of branches) {
      const html = market(p.state, category), all = buttons(html), outlets = all.filter(isShop)
      assert.equal(outlets.length, 1)
      const [shop] = outlets
      assert.ok(shop.enabled)
      assert.match(shop.html, /class="dialog-button secondary"/)
      assert.ok(shop.html.includes(island === 'home' ? 'В лавку в гавань' : 'Своя лавка'))
      assert.deepEqual(all.filter(b => b.action === 'market-tab').map(b => b.value), [...tabs])
      const categories = all.filter(b => b.action === 'market-category')
      assert.deepEqual(categories.map(b => b.value), ['seeds','trees','care','buildings'])
      assert.ok(categories.at(-1)!.index < shop.index)
      const products = all.filter(b => actions.some(a => a === b.action) && b.enabled)
      assert.equal(products.length, count)
      const beforeOutlet = products.filter(b => b.index < shop.index).length
      layout.push([island, category, beforeOutlet, shop.index < html.indexOf(grid)])
      if (category === 'trees') assert.equal(all.filter(b => b.action === 'market-orchard-space').length, 1)
      console.log(JSON.stringify({ day: before.day, island, category, products: count, beforeOutlet, route: shop.value }))
    }
    assert.deepEqual(p.state, before)
  }
  assert.deepEqual(layout, ['home','village'].flatMap(island => branches.map(([category]) => [island, category, 0, true])),
    'the existing shop outlet should be before every catalog and its purchase actions')
})

test('locked Harbour still renders no outlet; Sell, Orders, Projects and Buy Buildings keep one existing outlet', () => {
  const closed = F.createFarm(), before = structuredClone(closed)
  assert.ok(!closed.village.built)
  for (const [category, grid] of branches) {
    const html = market(closed, category)
    assert.ok(html.includes(grid))
    assert.equal(buttons(html).filter(isShop).length, 0)
  }
  assert.deepEqual(closed, before)
  const open = earned416Mixed().state, openedBefore = structuredClone(open)
  for (const tab of tabs) {
    const all = buttons(market(open, 'buildings', tab))
    assert.equal(all.filter(isShop).length, 1, tab)
  }
  assert.deepEqual(open, openedBefore)
})
