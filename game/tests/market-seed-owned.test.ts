import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { runInNewContext } from 'node:vm'
import * as F from '../src/farm.ts'
import { ruPlural } from '../src/ru.ts'

const source = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8')
const branch = source.slice(source.indexOf("  if(marketCategory==='seeds')return"), source.indexOf("  if(marketCategory==='trees')return"))
const helpers = source.slice(source.indexOf('function button('), source.indexOf('function row('))

function render(farm: ReturnType<typeof F.createFarm>) {
  // Execute the shipped card and button/quantity helpers, as the existing Buy tests do.
  const context = { farm, marketCategory: 'seeds', tabs: '', categories: '', stall: '', seedPacks: undefined,
    cropIds: F.cropIds, cropDefinitions: F.cropDefinitions, seedPackSize: F.seedPackSize,
    ruPlural, numberFormat: new Intl.NumberFormat('ru-RU'), icon: (id: string) => `<img alt="" src="${id}">` }
  const html = runInNewContext(stripTypeScriptTypes(`${helpers}\nfunction render(){${branch}}\nrender()`), context) as string
  const cards = new Map(Array.from(html.matchAll(/<section data-seed-pack="([^"]+)">([\s\S]*?)<\/section>/g), match => [match[1], match[2]]))
  return { html, cards }
}

test('Buy seed cards distinguish actual owned seeds from the fixed pack and its price, without mutation', () => {
  const farm = F.createFarm(), before = structuredClone(farm), { cards } = render(farm)
  assert.deepEqual([...cards.keys()], F.cropIds)
  assert.match(cards.get('carrot')!, /В запасе: 3 семени<\/p>/)
  assert.match(cards.get('cabbage')!, /В запасе: 2 семени<\/p>/)
  assert.match(cards.get('beetroot')!, /В запасе: 1 семя<\/p>/)
  assert.match(cards.get('blueberry')!, /В запасе: 0 семян<\/p>/)
  for (const crop of F.cropIds) {
    const card = cards.get(crop)!, definition = F.cropDefinitions[crop]
    assert.ok(card.includes(`<h2>${definition.name}</h2>`))
    assert.match(card, /<p>В пакете: 3 семени<\/p>/)
    assert.ok(card.includes(`${definition.seedPrice} <img alt="" src="coin"> за пакет`))
    assert.equal((card.match(/<button /g) ?? []).length, 1)
    assert.match(card, new RegExp(`data-crop="${crop}"`))
    assert.match(card, /aria-label="Купить пакет, /)
    assert.equal(card.includes('disabled'), farm.coins < definition.seedPrice)
  }
  assert.deepEqual(farm, before)
})

test('one existing purchase refreshes only the chosen stock fact and spends the unchanged pack price', () => {
  const farm = F.createFarm(), before = structuredClone(farm), initial = render(farm)
  assert.ok(F.buySeeds(farm, 'carrot').ok)
  const expected = structuredClone(before)
  expected.coins = 14
  expected.seeds.carrot = 6
  assert.deepEqual(farm, expected)
  const after = render(farm)
  assert.match(after.cards.get('carrot')!, /В запасе: 6 семян<\/p>/)
  assert.match(after.cards.get('carrot')!, /В пакете: 3 семени<\/p>/)
  assert.match(after.cards.get('carrot')!, /aria-label="Купить пакет, Морковь, 3 семени за 4 монеты"/)
  for (const crop of F.cropIds.filter(crop => crop !== 'carrot')) assert.equal(after.cards.get(crop), initial.cards.get(crop))
  assert.deepEqual(farm, expected)
  assert.deepEqual(F.restoreCurrentFarm(structuredClone(farm)), expected)
})

test('earned zero coins keep the owned stock visible without enabling or applying another purchase', () => {
  const farm = F.createFarm()
  assert.ok(F.buySeeds(farm, 'tomato').ok)
  assert.ok(F.buySeeds(farm, 'tomato').ok)
  assert.ok(F.buySeeds(farm, 'carrot').ok)
  assert.equal(farm.coins, 0)
  const before = structuredClone(farm), { cards } = render(farm)
  assert.match(cards.get('tomato')!, /В запасе: 7 семян<\/p>/)
  assert.match(cards.get('blueberry')!, /В запасе: 0 семян<\/p>/)
  for (const card of cards.values()) assert.match(card, /disabled/)
  assert.equal(F.buySeeds(farm, 'blueberry').ok, false)
  assert.deepEqual(farm, before)
})

test('long restore-valid stock stays exact and has a seed-only wrapping/auto-height fallback', () => {
  // Synthetic boundary rendering only, not an earned-player or native fixture.
  const farm = F.createFarm()
  farm.seeds.raspberry = 123456789
  assert.deepEqual(F.restoreCurrentFarm(structuredClone(farm)), farm)
  const before = structuredClone(farm), { cards } = render(farm)
  assert.match(cards.get('raspberry')!, /В запасе: 123\u00a0456\u00a0789 семян<\/p>/)
  assert.match(cards.get('carrot')!, /В запасе: 3 семени<\/p>/)
  assert.deepEqual(farm, before)
  const css = readFileSync(new URL('../src/market-buy-seeds.css', import.meta.url), 'utf8')
  assert.match(css, /\.market-seed-stock\s*\{overflow-wrap:anywhere\}/)
  assert.match(css, /grid-template-rows:minmax\(86px,auto\) auto/)
  assert.match(css, /\.market-seed-grid \.dialog-button\s*\{[^}]*min-height:46px/)
})
