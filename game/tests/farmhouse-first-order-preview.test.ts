import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import test from 'node:test'
import { createContext, runInContext } from 'node:vm'
import * as F from '../src/farm.ts'
import { ruPlural } from '../src/ru.ts'
import { commissionPlayer } from './fixtures/commission-player.ts'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')
const source = read('../src/main.ts')
const range = (a: string, b: string) => {
  const first = source.indexOf(a), last = source.indexOf(b, first + a.length)
  assert.ok(first >= 0 && last > first, a)
  return source.slice(first, last)
}
const renderAndAct = stripTypeScriptTypes(
  range('function button(', 'function row(')
  + range('function specializationCards()', 'function flockFeedRow(').replaceAll('import.meta.env.BASE_URL', '"/"')
  + range('function stockLabel(', 'function stockTile(')
  + range('function perform(', '\nfunction ')
  + 'function use(action, value) { switch (action) {'
  + range("    case 'specialize': {", "    case 'kitchen':")
  + '} }'
)
const opening = JSON.parse(read('./fixtures/market-order-selection-commands.json')).slice(0, -1)
const branches = [
  { id: 'bakery', other: 'preserves', recipe: 'Домашний хлеб', order: 'Хлебная корзина', extra: 'Пшеница',
    lines: [['dishes:farmhouseBread', 1], ['produce:wheat', 2]] },
  { id: 'preserves', other: 'bakery', recipe: 'Садовый конфитюр', order: 'Ящик садового конфитюра', extra: 'Яблоко',
    lines: [['dishes:orchardPreserves', 1], ['fruit:apple', 2]] },
] as const

function earned() {
  const p = commissionPlayer(opening), f = p.state
  assert.deepEqual([p.actions, f.day, f.island, f.buildingLevels.farmhouse, f.coins, f.farmhouseSpecialization], [118, 14, 'home', 2, 99, null])
  return p
}

const specialty = (farm: F.FarmState) => F.getMarketOrders(farm).find(o => o.lane === 'specialty')
function mount(farm: F.FarmState) {
  let saves = 0, redraws = 0
  const upgrades: string[] = []
  const ctx = createContext({
    ...F, farm, ruPlural, numberFormat: new Intl.NumberFormat('ru-RU'),
    specializationBuilding: 'farmhouse', previewSpecialization: undefined,
    specializationStages: Object.fromEntries(['bakery', 'preserves'].map(id => [id, {mask:{path:id}}])),
    branchDefinitions: F.specializationDefinitions, branchChoices: { farmhouse: F.specializationIds },
    dishIcons: {}, icon: () => '',
    dialog: { open: true, close() { this.open = false } },
    openPanel(panel: string) { assert.equal(panel, 'specialize'); ctx.dialog.open = true },
    drawPanel: () => { redraws++ }, refresh: () => {}, saveFarm: () => { saves++ },
    island: { showUpgrade(building: string) { upgrades.push(building) } },
    notify: () => {}, playBaySound: () => {},
  })
  runInContext(renderAndAct, ctx)
  const use = (action: string, value: string) => runInContext(`use(${JSON.stringify(action)}, ${JSON.stringify(value)})`, ctx)
  const html = () => (runInContext('specializationCards()', ctx) as string).replace(/\s+/g, ' ')
  const select = (branch: string) => use('preview-specialization', branch)
  const open = () => use('specialize', 'farmhouse')
  const control = (action: string, value = '') => [...html().matchAll(/<button\b([^>]*)>(.*?)<\/button>/g)]
    .find(([, attrs]) => attrs.includes(`data-action="${action}"`) && (!value || attrs.includes(`data-value="${value}"`)))
  return { use, open, select, html, control, saves: () => saves, redraws: () => redraws, upgrades }
}

test('earned D14 first house choice compares both exact future orders in the existing buttons without spending', () => {
  const farm = earned().state, view = mount(farm), initial = JSON.stringify(farm)
  const readout = /Первое направление задаёт заказы\. Второе можно освоить позже\./
  view.open()
  assert.equal(specialty(farm), undefined)
  assert.match(view.control('build-specialization')![1], /\bdisabled\b/)
  for (const branch of branches) {
    const card = view.control('preview-specialization', branch.id)!
    assert.match(card[1], /aria-pressed="false"/)
    assert.match(card[2], new RegExp(branch.recipe))
    assert.match(card[2], new RegExp(`Первый заказ: «${branch.order}» · 40 монет`))
    assert.match(card[2], new RegExp(`${branch.recipe} ×1 · ${branch.extra} ×2`))
  }
  assert.match(view.html(), readout)
  for (const branch of branches) {
    view.select(branch.id)
    assert.match(view.control('preview-specialization', branch.id)![1], /aria-pressed="true"/)
    assert.match(view.control('preview-specialization', branch.other)![1], /aria-pressed="false"/)
    const confirm = view.control('build-specialization', branch.id)!
    assert.doesNotMatch(confirm[1], /\bdisabled\b/)
    assert.match(confirm[1], /aria-label="Освоить, [^"]+, 58 монет"/)
    assert.match(view.html(), readout)
    assert.equal(JSON.stringify(farm), initial)
  }
  assert.deepEqual([view.saves(), view.redraws(), view.upgrades], [0, 2, []])
})

test('one explicit purchase grants its quoted order and the later recipe cannot replace it', () => {
  for (const branch of branches) {
    const p = earned(), farm = p.state, view = mount(farm)
    view.open(); view.select(branch.id)
    const before = structuredClone(farm)
    view.use('build-specialization', branch.id)
    const actual = specialty(farm)!
    assert.deepEqual([actual.name, actual.reward, actual.items.map(i => [F.marketKey(i),i.quantity])], [branch.order, 40, branch.lines])
    assert.deepEqual(
      [farm.coins, farm.island, farm.day, farm.buildingLevels.farmhouse, farm.farmhouseSpecialization, view.saves(), view.upgrades],
      [41, 'home', 14, 3, branch.id, 1, ['farmhouse']]
    )
    assert.deepEqual([farm.produce, farm.fruit, farm.dishes, farm.eggs, farm.orders], [before.produce, before.fruit, before.dishes, before.eggs, before.orders])
    view.open(); view.select(branch.other)
    assert.doesNotMatch(view.html(), /Первый заказ: «|Первое направление задаёт заказы/)
    assert.match(view.control('build-specialization', branch.other)![1], /\bdisabled\b/)
    assert.match(view.html(), /Не хватает монет на это направление/)
    assert.equal(view.saves(), 1)

    // Selling the already earned tart earns enough for the second skill, without advancing either order.
    p.act('sellMarketItem', 'dishes:orchardTart', 1)
    const secondary = mount(p.state)
    secondary.open(); secondary.select(branch.other)
    assert.equal(p.state.coins, 66)
    assert.match(secondary.html(), /Освоить второе направление/)
    assert.doesNotMatch(secondary.html(), /Первый заказ: «/)
    assert.doesNotMatch(secondary.control('build-specialization', branch.other)![1], /\bdisabled\b/)
    secondary.use('build-specialization', branch.other)
    assert.deepEqual([p.state.coins,p.state.farmhouseSpecialization,p.state.farmhouseSecondarySpecialization,secondary.saves()], [8,branch.id,branch.other,1])
    assert.deepEqual(specialty(p.state), actual)
    assert.ok(F.specializationIds.every(id => F.hasFarmhouseSpecialization(p.state,id)))
  }
})
