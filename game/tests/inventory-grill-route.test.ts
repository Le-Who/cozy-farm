import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { test } from 'node:test'
import ts from 'typescript'
import * as F from '../src/farm.ts'
import { MarketSaleBrowseMemory } from '../src/market-sale-browse.ts'
import { getBerryNurserySource } from '../src/berry-nursery.ts'
import { getRequirementHint } from '../src/requirement-guidance.ts'
import { getLocalWarehouseSupply, warehouseConfirmationValue, warehouseConfirmation, withdrawWarehouseSupply } from '../src/warehouse-guidance.ts'
import { commissionPlayer } from './fixtures/commission-player.ts'

const source = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8')
const ast = ts.createSourceFile('main.ts', source, ts.ScriptTarget.Latest, true)
const names = ['button','nav','stockLabel','stockTile','requirementLink','recipeDestination','recipeCards','kitchenFamilies','openPanel','goBack','focusKey']
const definitions = names.map(name => {
  const node = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name)
  assert.ok(node, name); return node.getText(ast)
})
const icons = ast.statements.find(node => ts.isVariableStatement(node) && node.declarationList.declarations.some(d => d.name.getText(ast) === 'dishIcons'))!
let clause: ts.CaseClause | undefined
const visit = (node: ts.Node) => {
  if (ts.isCaseClause(node) && node.expression.getText(ast) === "'fish-kitchen'") clause = node
  ts.forEachChild(node, visit)
}
visit(ast); assert.ok(clause)
const code = ts.transpileModule(`${icons.getText(ast)}\n${definitions.join('\n')}\nasync function chooseFish(value) { switch('fish-kitchen') { ${clause.getText(ast)} } }`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
const noop = () => {}
function screen(farm: F.FarmState, group = 'preserves') {
  const state: Record<string, any> = {
    ...F, farm, getBerryNurserySource, icon: (name: string) => `<img data-icon="${name}" alt="">`, fishImage: (id: string) => id,
    numberFormat: new Intl.NumberFormat('ru-RU'), requirementLinks: new Map(), pastryIcons: {},
    kitchenGroups: ['tart','preserves','dishes'], kitchenGroup: group, kitchenTart: 'orchardTart', kitchenPreserves: 'appleJam', kitchenDish: 'honeyCake', cookingFish: 'seaBass',
    panel: 'inventory', panelHistory: [], marketSaleBrowse: new MarketSaleBrowseMemory(), inventoryGroup: 'shore', marketTab: 'sell', marketCategory: 'trees', selectedWarehouseRequest: undefined,
    salePresentation: { place: undefined }, island: { isCrossing: () => false, setViewMode: noop, setCoveFocus: noop, crossIsland: async (fn: () => unknown) => fn() },
    dialog: { open: true, showModal: noop, querySelectorAll: () => [] }, dialogContent: { scrollTop: 19, querySelectorAll: () => [], querySelector: () => null },
    transplantSelection: { reset: noop }, berryNurserySelection: { reset: noop }, berryRenewalSelection: { reset: noop }, gardenEditor: { reset: noop }, recipeSurplusSelection: { reset: noop },
    seedPickerBed: undefined, previewSeed: farm.selectedSeed, celebratedFestival: undefined, stopHarbour: noop, stopFishing: noop, stopWorkshop: noop, stopCookery: noop, stopArrangement: noop,
    playBaySound: noop, app: { dataset: {} }, toast: {}, dialogFeedback: {}, closeButton: { focus: noop }, updateCommunityReturn: noop,
    recipeBook: { load: noop }, restoreFerryPanelView: noop, panelRenderVersion: 0, requestAnimationFrame: (fn: () => void) => fn(),
    draws: 0, html: '', saves: 0, visits: [] as string[],
    perform: (fn: () => {ok: boolean}) => { const result = fn(); if (result.ok) state.saves++; return result.ok },
    closeDialog: () => { state.panel = undefined; state.panelHistory.length = 0; state.dialog.open = false },
    rememberPanel: () => ({ panel: state.panel, kitchenGroup: state.kitchenGroup, kitchenDish: state.kitchenDish, kitchenTart: state.kitchenTart,
      kitchenPreserves: state.kitchenPreserves, cookingFish: state.cookingFish, inventoryGroup: state.inventoryGroup, warehouseRequest: state.selectedWarehouseRequest,
      marketTab: state.marketTab, marketCategory: state.marketCategory, marketNextOpen: [], signatureSlots: [null,null], previewSeed: state.previewSeed, scroll: state.dialogContent.scrollTop }),
    drawPanel: () => { state.draws++; state.visits.push(state.panel); state.html = state.panel === 'kitchen' ? state.kitchenFamilies() : ''; state.panelRenderVersion++ },
  }
  runInNewContext(code, state)
  return state
}
function ordinary() {
  const farm = F.createFarm(); assert.equal(F.catchFish(farm, true).ok, true)
  return F.restoreCurrentFarm(JSON.parse(JSON.stringify(farm)))!
}
function earned() {
  const opening = JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json', import.meta.url), 'utf8'))
  const p = commissionPlayer(opening); p.visit('home'); p.act('catchFish', true)
  return p
}
function grill(html: string, fish: string) {
  assert.match(html, /<h2>Рыба на гриле<\/h2>/)
  assert.match(html, /data-action="kitchen-group" data-value="dishes" aria-pressed="true"/)
  assert.match(html, new RegExp(`data-action="grill-fish" data-value="${fish}" aria-pressed="true"`))
  assert.equal((html.match(/<section class="recipe(?: recipe-locked)?">/g) ?? []).length, 1)
}

test('the explicit inventory CTA opens the chosen grill card once; an ordinary first farm still sees its real level gate', async () => {
  const farm = ordinary(), before = structuredClone(farm), s = screen(farm, 'tart')
  await s.chooseFish('perch')
  grill(s.html, 'perch'); assert.match(s.html, /Улучшите дом для этого блюда/); assert.doesNotMatch(s.html, /data-action="cook"/)
  assert.equal(s.draws, 1); assert.equal(s.saves, 0); assert.deepEqual(farm, before)
  s.goBack(); assert.equal(s.panel, 'inventory'); assert.equal(s.kitchenGroup, 'tart'); assert.equal(s.cookingFish, 'seaBass')
  s.openPanel('kitchen'); assert.match(s.html, /<h2>Фруктовый пирог<\/h2>/)
  assert.deepEqual(farm, before)
})

test('an earned missing-ingredient route returns from the warehouse to the exact selected fish and live quantities', async () => {
  const p = earned(); p.visit('grove'); p.act('gatherSeaSalt'); p.visit('home')
  p.act('transferBayGoods', 'deposit', 'home', 'seaSalt', p.state.seaSalt)
  const farm = p.state, before = structuredClone(farm), s = screen(farm)
  await s.chooseFish('perch'); grill(s.html, 'perch')
  assert.match(s.html, /data-action="cook"[\s\S]*?data-value="grilledFish"[^>]*disabled/)
  const request = { kind: 'seaSalt', quantity: 1 } as const
  const hint = getRequirementHint(farm, { kind: 'stock', item: request })
  assert.equal(hint.action.target, 'warehouse-supply'); assert.deepEqual(farm, before)
  s.selectedWarehouseRequest = request; s.openPanel('warehouse-supply')
  const supply = getLocalWarehouseSupply(farm, request)!; assert.equal(supply.quantity, 1)
  assert.equal(withdrawWarehouseSupply(farm, request, warehouseConfirmation(warehouseConfirmationValue(supply))).ok, true)
  const expected = structuredClone(before); expected.seaSalt++; expected.freight.warehouses.home.seaSalt!--
  assert.deepEqual(farm, expected); assert.ok(F.restoreCurrentFarm(JSON.parse(JSON.stringify(farm))))
  s.goBack(); grill(s.html, 'perch'); assert.equal(s.panel, 'kitchen')
  assert.match(s.html, /data-action="cook"[\s\S]*?data-value="grilledFish"[^>]*>Готовить/)
  assert.equal(F.getCookAction(farm, 'grilledFish', 'perch').available, true)
  assert.equal(F.getCookAction(farm, 'grilledFish', 'seaBass').available, false)
  s.goBack(); assert.equal(s.panel, 'inventory'); assert.equal(s.inventoryGroup, 'shore'); assert.equal(s.kitchenGroup, 'preserves')
  s.openPanel('kitchen'); assert.match(s.html, /<h2>Яблочное варенье<\/h2>/)
  assert.deepEqual(farm, expected); assert.equal(s.saves, 0, 'navigation never performs cooking or a transaction')
})

test('invalid or no-longer-owned fish cannot redirect or cross an island from a stale inventory row', async () => {
  for (const id of [undefined, 'unknown', 'seaBass']) {
    const farm = ordinary(), before = structuredClone(farm), s = screen(farm)
    await s.chooseFish(id)
    assert.equal(s.panel, 'inventory'); assert.equal(s.draws, 0); assert.equal(s.saves, 0)
    assert.equal(s.kitchenGroup, 'preserves'); assert.equal(s.cookingFish, 'seaBass'); assert.deepEqual(farm, before)
  }
})

test('the existing explicit remote route still travels Home once and never cooks or spends the selected fish', async () => {
  const p = earned(); p.visit('grove'); p.act('catchFish', true)
  const farm = p.state, before = structuredClone(farm), s = screen(farm)
  await s.chooseFish('seaBass'); grill(s.html, 'seaBass')
  assert.equal(s.saves, 1); assert.equal(farm.island, 'home'); assert.equal(s.panelHistory.length, 0)
  const expected = structuredClone(before); expected.island = 'home'; assert.deepEqual(farm, expected)
})


test('an old inventory action cannot override a newer page or a closed dialog', async () => {
  for (const closed of [false, true]) {
    const farm = ordinary(), before = structuredClone(farm), s = screen(farm)
    if (closed) s.dialog.open = false
    else s.panel = 'kitchen'
    const panel = s.panel
    await s.chooseFish('perch')
    assert.equal(s.panel, panel); assert.equal(s.draws, 0); assert.equal(s.kitchenGroup, 'preserves'); assert.equal(s.saves, 0)
    assert.deepEqual(farm, before)
  }
})

test('the existing seed preview entry stays scoped and ordinary kitchen opening is not forced to grill', () => {
  const farm = ordinary(), before = structuredClone(farm), s = screen(farm)
  s.openPanel('seeds', true, farm.island, 'page.unfold', undefined, { seedPreview: 'raspberry' })
  assert.equal(s.previewSeed, 'raspberry'); assert.equal(s.kitchenGroup, 'preserves'); assert.equal(s.cookingFish, 'seaBass')
  s.goBack(); assert.equal(s.previewSeed, farm.selectedSeed)
  s.openPanel('kitchen'); assert.match(s.html, /<h2>Яблочное варенье<\/h2>/)
  assert.deepEqual(farm, before); assert.equal(s.saves, 0)
})

test('ordinary kitchen entry offers the first earned Home perch rather than sending a ready cook for sea bass', () => {
  const opening = JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json', import.meta.url), 'utf8'))
  const farm = commissionPlayer(opening.slice(0, 35)).state, s = screen(farm, 'dishes')
  assert.equal(farm.day, 4); assert.equal(F.getGrillFish(farm), 'seaBass')
  s.kitchenDish = 'grilledFish'; s.closeDialog()
  assert.ok(F.catchFish(farm, true).ok); assert.ok(F.sail(farm, 'grove').ok)
  assert.ok(F.gatherSeaSalt(farm).ok); assert.ok(F.sail(farm, 'home').ok)
  const ready = structuredClone(farm)
  s.openPanel('kitchen'); grill(s.html, 'perch')
  assert.ok(s.html.includes('<span>Окунь</span><strong>1/1</strong>'))
  assert.match(s.html, /data-value="grilledFish"\s+aria-label="Готовить, Рыба на гриле"\s*>Готовить/)
  assert.ok(!farm.bayDiscoveries.includes('seaBass')); assert.deepEqual(farm, ready); assert.equal(s.saves, 0)
})
