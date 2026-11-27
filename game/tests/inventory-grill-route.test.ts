import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { test } from 'node:test'
import ts from 'typescript'
import * as F from '../src/farm.ts'
import { bayProductId } from '../src/bay-product-id.ts'
import { MarketSaleBrowseMemory } from '../src/market-sale-browse.ts'
import { getBerryNurserySource } from '../src/berry-nursery.ts'
import { transferBayGoods } from '../src/harbour-economy.ts'
import { getRequirementHint } from '../src/requirement-guidance.ts'
import { getLocalWarehouseSupply, warehouseConfirmationValue, warehouseConfirmation, withdrawWarehouseSupply } from '../src/warehouse-guidance.ts'
import { commissionPlayer } from './fixtures/commission-player.ts'
import { earned416Mixed } from './fixtures/earned-416-market-orders.ts'

const source = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8')
const ast = ts.createSourceFile('main.ts', source, ts.ScriptTarget.Latest, true)
const names = ['button','nav','stockLabel','stockTile','stockTileWithSource','requirementLink','recipeDestination','recipeCards','kitchenReadyDishes','kitchenFamilies','openPanel','goBack','focusKey']
const definitions = names.map(name => {
  const node = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name)
  assert.ok(node, name); return node.getText(ast)
})
const icons = ast.statements.find(node => ts.isVariableStatement(node) && node.declarationList.declarations.some(d => d.name.getText(ast) === 'dishIcons'))!
let clause: ts.CaseClause | undefined
const kitchenCases = new Set(["'kitchen-group'","'recipe-family'","'cook'"]), actions: string[] = []
const visit = (node: ts.Node) => {
  if (ts.isCaseClause(node) && node.expression.getText(ast) === "'fish-kitchen'") clause = node
  if (ts.isCaseClause(node) && kitchenCases.has(node.expression.getText(ast))) actions.push(node.getText(ast))
  ts.forEachChild(node, visit)
}
visit(ast); assert.ok(clause)
const code = ts.transpileModule(`${icons.getText(ast)}\n${definitions.join('\n')}\nasync function chooseFish(value) { switch('fish-kitchen') { ${clause.getText(ast)} } }
function choose(action, value, family) { const control={dataset:{family}}; switch(action) {${actions.join('\n')} } }`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
const noop = () => {}
function screen(farm: F.FarmState, group = 'preserves') {
  const state: Record<string, any> = {
    ...F, farm, getBerryNurserySource, getRequirementHint, escapeHtml: (text: string) => text, icon: (name: string) => `<img data-icon="${name}" alt="">`, fishImage: (id: string) => id,
    numberFormat: new Intl.NumberFormat('ru-RU'), requirementLinks: new Map(), pastryIcons: {},
    kitchenGroups: ['tart','preserves','dishes'], kitchenGroup: group, kitchenTart: 'orchardTart', kitchenPreserves: 'appleJam', kitchenDish: 'honeyCake', cookingFish: 'seaBass',
    panel: 'inventory', panelHistory: [], marketSaleBrowse: new MarketSaleBrowseMemory(), inventoryGroup: 'shore', marketTab: 'sell', marketCategory: 'trees', selectedWarehouseRequest: undefined, pickedMarketOrder: undefined,
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

function coldWorkbench(steps: [string, ...unknown[]][]) {
  const p = commissionPlayer(steps.map(([name, ...args]) => ({name, args})))
  const s = screen(p.state)
  // The existing route harness starts from a remembered menu. Use the actual cold defaults instead.
  for (const name of ['kitchenGroup','kitchenTart','kitchenPreserves','kitchenDish','cookingFish']) {
    const d = ast.statements.filter(ts.isVariableStatement).flatMap(n => [...n.declarationList.declarations])
      .find(d => d.name.getText(ast) === name)!
    s[name] = d.initializer ? runInNewContext(d.initializer.getText(ast), s) : undefined
  }
  s.closeDialog()
  return { farm:p.state, s }
}
const jamDayOne: [string, ...unknown[]][] = [
  ['workBed',3], ['sellMarketItem','produce:tomato',1], ['upgradeBuilding','farmhouse'], ['pickFruit',0],
]
const grillDayOne: [string, ...unknown[]][] = [
  ['workBed',3], ['workBed',7], ['workBed',9], ['sellMarketItem','produce:tomato',3],
  ['sellMarketItem','produce:pumpkin',2], ['sellMarketItem','produce:carrot',1], ['upgradeBuilding','farmhouse'],
  ['buyBoat'], ['beginFishingTrip'], ['finishFishingTrip',1,[{kind:'fish',species:'perch',variant:'regular'}]],
  ['sail','grove'], ['gatherSeaSalt'], ['sail','home'],
]
function visibleCard(s: ReturnType<typeof screen>, dish: F.DishId, enabled: boolean) {
  assert.match(s.html, new RegExp('<h2>' + F.dishDefinitions[dish].name + '</h2>'))
  const button = s.html.match(/<button\b[^>]*data-action="cook"[^>]*>/g) ?? []
  assert.equal(button.length, 1)
  assert.ok(button[0].includes('data-value="' + dish + '"'))
  assert.equal(button[0].includes('disabled'), !enabled)
}

test('first ordinary Home workbench preserves its sole ready card and empty default, and no longer strands tied recipes', () => {
  const cases: {steps:[string,...unknown[]][]; ready:F.DishId[]; shown:F.DishId; origin?:string}[] = [
    {steps:grillDayOne,ready:['grilledFish'],shown:'grilledFish'},
    {steps:jamDayOne,ready:['appleJam'],shown:'appleJam',origin:'rest'},
    {steps:[['pickFruit',0],['collectEggs'],['workBed',4]],ready:['orchardTart'],shown:'orchardTart'},
    {steps:[],ready:[],shown:'orchardTart'},
    {steps:[...grillDayOne,['pickFruit',0]],ready:['grilledFish','appleJam'],shown:'grilledFish'},
  ]
  for (const {steps, ready, shown, origin} of cases) {
    const {farm,s} = coldWorkbench(steps), before = structuredClone(farm)
    assert.equal(farm.day,1)
    assert.deepEqual(F.dishIds.filter(id=>F.getCookAction(farm,id).available),ready)
    if (origin) { s.panel=origin; s.dialog.open=true }
    s.openPanel('kitchen')
    visibleCard(s,shown,ready.includes(shown))
    assert.deepEqual(s.visits,['kitchen']); assert.equal(s.saves,0); assert.deepEqual(farm,before)
  }
})

test('explicit fish, source entry, and a deliberately chosen family survive a different sole ready recipe', async () => {
  const steps: [string,...unknown[]][] = [...jamDayOne,['beginFishingTrip'],['finishFishingTrip',1,1]]
  const {farm,s} = coldWorkbench(steps), before = structuredClone(farm)
  assert.deepEqual(F.dishIds.filter(id=>F.getCookAction(farm,id).available),['appleJam'])
  s.panel='inventory'; s.dialog.open=true
  await s.chooseFish('perch'); grill(s.html,'perch'); visibleCard(s,'grilledFish',false)
  s.goBack(); assert.equal(s.panel,'inventory')
  // A contextual return to the workbench is not the initial Home recommendation.
  s.panel='cookery'; s.openPanel('kitchen'); visibleCard(s,'orchardTart',false)
  // Exercise the actual tab and family choice handlers, not just their field values.
  s.choose('kitchen-group','preserves'); s.choose('kitchen-group','tart'); s.choose('recipe-family','blueberryTart','tart')
  visibleCard(s,'blueberryTart',false)
  s.openPanel('inventory'); s.goBack(); visibleCard(s,'blueberryTart',false)
  s.closeDialog(); s.openPanel('kitchen'); visibleCard(s,'blueberryTart',false)
  assert.equal(s.saves,0); assert.deepEqual(farm,before)
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

test('only the sole missing grill salt previews its real local or sailing route, before opening it', () => {
  const opening = JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json', import.meta.url), 'utf8'))
  const farm = commissionPlayer(opening.slice(0,35)).state, s = screen(farm, 'dishes')
  assert.ok(F.catchFish(farm,true).ok); s.kitchenDish = 'grilledFish'
  function inspect(caption?: string) {
    const before = structuredClone(farm); s.requirementLinks.clear(); s.closeDialog(); s.openPanel('kitchen')
    const tiles: string[] = s.html.match(/<li\b[^>]*>[\s\S]*?<\/li>/g) ?? []
    const slot = tiles.find(tile => tile.includes('<span>Морская соль</span>'))!
    assert.ok(slot); assert.deepEqual(farm,before); assert.equal(s.saves,0)
    if (!caption) { assert.doesNotMatch(slot, /<small|aria-describedby/); return }
    const link = slot.match(/data-action="show-requirement" data-value="(\d+)" aria-label="Где найти: Морская соль, 0 из 1" aria-describedby="([^"]+)"/)
    assert.ok(link, 'same salt button and accessible name, with an in-tile source description')
    assert.ok(slot.includes(`<small id="${link[2]}">${caption}</small></button>`))
    assert.deepEqual({...s.requirementLinks.get(link[1]).item},{kind:'seaSalt',quantity:1})
    assert.equal(tiles.filter(tile=>tile.includes('aria-describedby')).length,1)
    assert.doesNotMatch(s.html, /aria-label="Готовить, Рыба на гриле"\s*>Готовить/)
  }
  inspect('Плыть в Солёную рощу')
  assert.ok(F.sail(farm,'grove').ok); assert.ok(F.gatherSeaSalt(farm).ok); assert.ok(F.sail(farm,'home').ok)
  inspect(); assert.match(s.html, /aria-label="Готовить, Рыба на гриле"\s*>Готовить/)
  assert.ok(transferBayGoods(farm,'deposit','home','seaSalt',2).ok); inspect('На местном складе')
  assert.ok(F.sellMarketItem(farm,'fish:perch',1).ok); inspect() // two short, despite salt in the local warehouse.
  assert.ok(F.catchFish(farm,true).ok)
  assert.ok(transferBayGoods(farm,'withdraw','home','seaSalt',2).ok); assert.ok(F.sellMarketItem(farm,'seaSalt',2).ok)
  const stocked = farm.freight.warehouses.grove.seaSalt
  assert.ok(stocked > 0, 'this ordinary save produced salt in the Grove warehouse overnight')
  inspect('Плыть в Солёную рощу') // the field quota is spent, but the warehouse is a real same-day source.
  assert.ok(F.sail(farm,'grove').ok)
  assert.ok(transferBayGoods(farm,'withdraw','grove','seaSalt',stocked).ok)
  assert.ok(F.sail(farm,'home').ok)
  assert.ok(F.sellMarketItem(farm,'seaSalt',stocked).ok)
  assert.equal(F.getCookAction(farm,'grilledFish','perch').available,false)
  inspect() // with both sources exhausted, Rest is again the truthful next action.
})

function dayFourKitchen() {
  const opening = JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json', import.meta.url), 'utf8'))
  return commissionPlayer(opening.slice(0, 38))
}
function homeKitchen(farm: F.FarmState) {
  const s = screen(farm); s.panel = 'rest'; s.kitchenGroup = undefined; s.kitchenDish = 'grilledFish'
  s.openPanel('kitchen')
  return s
}
const kitchenTabs = (html: string) => [...html.matchAll(/data-action="kitchen-group" data-value="([^"]+)"/g)].map(match => match[1])
const shelf = (html: string) => [...html.matchAll(/data-family="ready" data-value="([^"]+)" aria-pressed="(true|false)"/g)].map(match => [match[1],match[2]])
test('earned day 4: Home shows jam and cake, selection only previews; cook and Back use that very card', () => {
  const p=dayFourKitchen(); p.act('sellMarketItem','eggs',p.state.eggs); p.act('pickFruit',0)
  const f=p.state, before=structuredClone(f), s=homeKitchen(f)
  assert.equal(p.actions,40); assert.deepEqual([f.day,f.fruit.apple,f.produce.wheat,f.honey,f.eggs],[4,2,2,3,0])
  assert.deepEqual(shelf(s.html),[['appleJam','true'],['honeyCake','false']]); visibleCard(s,'appleJam',true)
  assert.match(s.html,/Можно приготовить/); assert.ok(s.html.indexOf('data-family="ready"') < s.html.indexOf('data-action="cook"')); assert.ok(s.html.indexOf('data-action="cook"') < s.html.indexOf('data-action="kitchen-group"'))
  assert.deepEqual(kitchenTabs(s.html),['ready','tart','preserves','dishes']); assert.doesNotMatch(s.html,/<details|<summary/)
  s.choose('recipe-family','honeyCake','ready')
  assert.equal(s.panel,'kitchen'); assert.deepEqual(shelf(s.html),[['appleJam','false'],['honeyCake','true']]);visibleCard(s,'honeyCake',true)
  assert.deepEqual(f,before);assert.equal(s.saves,0)
  s.choose('cook','honeyCake');assert.equal(s.panel,'cookery');assert.equal(s.cookingDish,'honeyCake')
  s.goBack();assert.equal(s.panel,'kitchen');visibleCard(s,'honeyCake',true);assert.deepEqual(shelf(s.html)[1],['honeyCake','true'])
  s.choose('kitchen-group','preserves');assert.deepEqual(shelf(s.html),[]);visibleCard(s,'appleJam',true)
  const visits=s.draws; s.choose('recipe-family','honeyCake','ready');assert.equal(s.draws,visits,'a retired tile cannot override an explicit category')
  s.choose('cook','appleJam');s.goBack();assert.equal(s.kitchenGroup,'preserves');visibleCard(s,'appleJam',true)
  assert.equal(s.cookingFish,'seaBass');assert.deepEqual(f,before)
})

test('four earned Home recipes share one ready shelf; the ordinary dish category and explicit grill still work', async () => {
  const p=dayFourKitchen();p.act('pickFruit',0);p.act('catchFish',true);p.visit('grove');p.act('gatherSeaSalt');p.visit('home')
  const f=p.state, before=structuredClone(f), s=homeKitchen(f)
  assert.equal(p.actions,43); assert.deepEqual(F.dishIds.filter(dish=>F.getCookAction(f,dish,'perch').available),['orchardTart','grilledFish','appleJam','honeyCake'])
  assert.deepEqual(shelf(s.html),[['orchardTart','true'],['grilledFish','false'],['appleJam','false'],['honeyCake','false']])
  const draws=s.draws;s.choose('recipe-family','honeyBiscuits','ready');assert.equal(s.draws,draws,'a recipe not cookable here cannot act')
  s.choose('recipe-family','honeyCake','ready');visibleCard(s,'honeyCake',true)
  s.choose('kitchen-group','dishes');s.choose('recipe-family','honeyCake','dishes');visibleCard(s,'honeyCake',true)
  s.openPanel('inventory');await s.chooseFish('perch');grill(s.html,'perch');assert.deepEqual(shelf(s.html),[]);visibleCard(s,'grilledFish',true)
  assert.deepEqual(f,before)
})

test('the home grill’s missing perch keeps its recipe behind the pier; keeping and releasing lead to different live cards', async () => {
  const fish: F.StockItem = {kind:'fish',item:'perch',quantity:1}
  const shoreCode = ['showRequirement','activateTarget','stopFishing','stockSourceItem'].map(name =>
    ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name)!.getText(ast)).join('\n')
  async function setup(salted = true) {
    // Buy the boat/upgrade and, optionally, collect our own salt before the first cast.
    const steps = grillDayOne.filter(([name]) => !['beginFishingTrip','finishFishingTrip'].includes(name) &&
      (salted || !['sail','gatherSeaSalt'].includes(name)))
    const {farm,s} = coldWorkbench(steps)
    assert.equal(farm.day,1);assert.equal(farm.fishCaughtToday.home,0)
    s.dialog.showModal=()=>{s.dialog.open=true}
    s.openPanel('kitchen',true,'home',undefined,undefined,{grillFish:'perch'})
    let mapTarget='',focus=''
    Object.assign(s,{bayProductId,fishingLanding:undefined,fishingGame:undefined,fishingPractice:undefined,fishingToken:undefined,
      activeTool:undefined,status:noop,fieldViewButton:{getAttribute:()=> 'false'},highlightControl:noop})
    s.island.visit=noop;s.island.setFishing=noop;s.island.focusTarget=(t:{kind:string})=>{mapTarget=t.kind}
    s.dialogContent.querySelector=(selector:string)=>selector==='[data-action="recipe-family"][aria-pressed="true"]'&&s.html.includes('data-value="grilledFish" aria-pressed="true"')?{focus(){focus='grilledFish'}}:null
    function missingPerch() {
      const key=s.html.match(/data-action="show-requirement" data-value="([^"]+)" aria-label="Где найти: Окунь,/i)?.[1]
      return key===undefined?[]:[{dataset:{action:'show-requirement',value:key},getClientRects:()=>[{}],focus(){focus='fish:perch'}}]
    }
    s.dialog.querySelectorAll=()=>missingPerch()
    const remember=s.rememberPanel;s.rememberPanel=()=>({...remember(),kitchenSourceItem:s.stockSourceItem(missingPerch()[0])})
    runInNewContext(ts.transpileModule(shoreCode,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,s)
    return {farm,s,map:()=>mapTarget,focus:()=>focus}
  }
  for (const mode of ['keep','release','no salt']) {
    const {farm,s,focus}=await setup(mode!=='no salt')
    grill(s.html,'perch');visibleCard(s,'grilledFish',false)
    const before=structuredClone(farm)
    await s.showRequirement({kind:'stock',item:fish})
    assert.equal(s.panel,'fishing','a local recipe detour should open the pier with Back, not clear the dialog and highlight a map spot')
    assert.equal(s.panelHistory.at(-1).panel,'kitchen')
    assert.deepEqual(farm,before)
    const cast=F.beginFishingTrip(farm);assert.ok(cast.ok)
    const landed=F.finishFishingTrip(farm,cast.token!,[{kind:'fish',species:'perch',variant:'regular'}],true)
    assert.ok(landed.landed);s.fishingLanding=landed.landed
    assert.equal(farm.fish.perch,0,'still on the hook');if(mode==='release')assert.ok(landed.landed.release())
    s.goBack(true)
    assert.equal(s.panel,'kitchen');grill(s.html,'perch');visibleCard(s,'grilledFish',mode==='keep')
    assert.equal(focus(),mode==='release'?'fish:perch':'grilledFish');assert.equal(farm.fish.perch,Number(mode!=='release'))
    assert.equal(farm.fishCaughtToday.home,1);assert.equal(farm.fishingTripSerial,1)
    assert.equal(farm.coins,before.coins);assert.equal(farm.seaSalt,before.seaSalt);assert.deepEqual(farm.produce,before.produce)
    assert.deepEqual(farm.dishes,before.dishes);assert.equal(farm.island,'home')
    assert.deepEqual(F.restoreCurrentFarm(JSON.parse(JSON.stringify(farm))),farm)
  }
  const {farm,s,map}=await setup()
  await s.showRequirement({kind:'stock',item:{kind:'fish',item:'seaBass',quantity:1}})
  assert.equal(farm.island,'grove');assert.equal(map(),'pier');assert.equal(s.panelHistory.length,0,'no Home return across water')
})

test('earned D193 Home lists six live dishes and separately starts, returns and completes the exact honey cake',t=>{
 const p=earned416Mixed(false),f=p.state,before=structuredClone(f),s=homeKitchen(f)
 assert.deepEqual([p.actions,f.day,f.island],[543,193,'home'])
 const expected=['orchardTart','strawberryTart','blueberryTart','raspberryTart','appleJam','honeyCake']
 assert.deepEqual(F.dishIds.filter(dish=>F.getCookAction(f,dish,s.cookingFish).available),expected)
 assert.deepEqual(shelf(s.html),expected.map((id,i)=>[id,String(i===0)]))
 visibleCard(s,'orchardTart',true)
 assert.deepEqual(kitchenTabs(s.html),['ready','tart','preserves','dishes'])
 assert.doesNotMatch(s.html,/<details|<summary/)
 s.choose('recipe-family','honeyCake','ready');visibleCard(s,'honeyCake',true)
 s.choose('cook','honeyCake')
 assert.deepEqual([s.panel,s.cookingDish,s.saves],['cookery','honeyCake',0])
 assert.deepEqual(f,before)
 s.goBack(true);visibleCard(s,'honeyCake',true)
 assert.deepEqual(shelf(s.html).at(-1),['honeyCake','true'])
 assert.deepEqual(f,before)
 s.choose('cook','honeyCake')
 const mount=source.slice(source.indexOf("    case 'cookery': {"),source.indexOf("    case 'village-project':"))
 Object.assign(s,{signatureBase:'tart',signatureSlots:[null,null],signatureRepeatId:undefined,signatureFamily:undefined,cookeryGame:undefined,
  iconUrl:(picture:string)=>picture,signatureFruitIds:['apple'],signatureFruitNames:{apple:'Яблоко'},signatureBookCapacity:()=>({canCreate:true}),
  createCookery(_host:unknown,options:Record<string,any>){s.cookeryOptions=options;return {destroy(){}}},leaveScene:()=>s.goBack(true),
  bayAudio:{primeEvents:async()=>{}}})
 runInNewContext(ts.transpileModule("switch('cookery'){"+mount+"}",{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,s)
 assert.deepEqual([s.cookeryOptions.recipe.id,s.cookeryOptions.recipe.kind,s.cookeryOptions.returnLabel],['honeyCake','honeyCake','На кухню'])
 const result={family:'honeyCake',fruit:[],steps:['mix','bake','glaze'],baking:{method:'oven',finish:'golden',seconds:4}}
 assert.equal(s.cookeryOptions.onComplete(result),true)
 assert.equal(s.cookeryOptions.onComplete(result),true,'the same finish cannot spend twice')
 assert.deepEqual([f.produce.wheat,f.honey,f.dishes.honeyCake,f.coins,s.saves],
  [before.produce.wheat-2,before.honey-1,before.dishes.honeyCake+1,before.coins,1])
 const paid=structuredClone(f)
 s.cookeryOptions.onCancel()
 assert.equal(s.panel,'kitchen')
 assert.match(s.html,/<h2 data-kitchen-return-dish tabindex="-1">Медовый кекс<\/h2>/)
 assert.deepEqual(shelf(s.html),[['appleJam','false']])
 const displayed=s.html
 s.choose('recipe-family','honeyCake','ready')
 assert.equal(s.html,displayed,'the now unavailable dish cannot re-enter the ready shelf')
 s.goBack(true);assert.equal(s.panel,'rest')
 assert.deepEqual(f,paid)
 t.diagnostic(JSON.stringify({day:f.day,actions:p.actions,choices:expected,ordinaryDefault:expected[0],payment:[2,1],saves:s.saves}))
})

test('earned D9 sole Home jam, manual family, and Harbour ready selection do not grow or change',()=>{
 const opening=JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json',import.meta.url),'utf8'))
 const p=commissionPlayer(opening.slice(0,80));p.fruit('apple',2);p.visit('home')
 const f=p.state,before=structuredClone(f),s=homeKitchen(f)
 assert.deepEqual([p.actions,f.day],[84,9])
 assert.deepEqual(shelf(s.html),[]);visibleCard(s,'appleJam',true)
 assert.doesNotMatch(s.html,/aria-label="Можно приготовить"/)
 assert.deepEqual(f,before)
 const mature=earned416Mixed(false)
 const manual=screen(mature.state,'preserves');manual.panel='rest';manual.openPanel('kitchen')
 visibleCard(manual,'appleJam',true);assert.deepEqual(shelf(manual.html),[])
 mature.visit('village')
 const cottage=screen(mature.state);cottage.cookingFish=F.getGrillFish(mature.state)
 assert.deepEqual(Array.from(cottage.kitchenReadyDishes()),['orchardTart','strawberryTart','blueberryTart'])
})

test('earned D193 can deliberately return to live Home recipes without losing the manually inspected tart',()=>{
  const p=earned416Mixed(false), farm=p.state, before=structuredClone(farm), s=homeKitchen(farm)
  assert.deepEqual([p.actions,farm.day,farm.island],[543,193,'home'])
  const live=['orchardTart','strawberryTart','blueberryTart','raspberryTart','appleJam','honeyCake']
  const tab=(pressed:boolean)=>new RegExp(`data-action="kitchen-group" data-value="ready" aria-pressed="${pressed}">Можно приготовить</button>`)
  s.choose('kitchen-group','tart');s.choose('recipe-family','blueberryTart','tart')
  assert.deepEqual(shelf(s.html),[]);visibleCard(s,'blueberryTart',true)
  assert.match(s.html,tab(false),'browsing Tarts leaves a native route back to live recipes')
  s.recipeBook.view={mode:'index'}
  s.dialog.showModal=()=>{s.dialog.open=true}
  s.openPanel('recipes');s.goBack(true);visibleCard(s,'blueberryTart',true)
  s.closeDialog()
  const closedDraws=s.draws;s.choose('kitchen-group','ready');assert.equal(s.draws,closedDraws)
  s.openPanel('kitchen');visibleCard(s,'blueberryTart',true);assert.match(s.html,tab(false))
  s.choose('kitchen-group','ready')
  assert.match(s.html,tab(true));assert.doesNotMatch(s.html,/<strong class="kitchen-ready-heading"/)
  assert.deepEqual(shelf(s.html),live.map(id=>[id,String(id==='blueberryTart')]))
  visibleCard(s,'blueberryTart',true)
  s.choose('recipe-family','honeyCake','ready');visibleCard(s,'honeyCake',true)
  s.choose('kitchen-group','ready');visibleCard(s,'honeyCake',true)
  s.choose('kitchen-group','tart');visibleCard(s,'blueberryTart',true)
  assert.deepEqual([s.panel,s.saves],['kitchen',0]);assert.deepEqual(farm,before)

  const {farm:early,s:sole}=coldWorkbench(jamDayOne), stocked=structuredClone(early)
  sole.openPanel('kitchen');assert.doesNotMatch(sole.html,tab(false));assert.doesNotMatch(sole.html,tab(true))
  const draws=sole.draws;sole.choose('kitchen-group','ready')
  visibleCard(sole,'appleJam',true);assert.equal(sole.draws,draws);assert.deepEqual(early,stocked)
})
