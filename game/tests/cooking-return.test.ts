import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { runInNewContext } from 'node:vm'
import * as farmApi from '../src/farm.ts'
import { communityReturnRoute } from '../src/community-return.ts'
import { getNeighborSceneState, stepNeighborWalker } from '../src/neighbor-scene.ts'
import { SalePresentation } from '../src/sale-presentation.ts'
import { cookingReturnFixture } from './fixtures/cooking-return.ts'

const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8')
const islandSource = readFileSync(new URL('../src/island.ts', import.meta.url), 'utf8')
const js = (source: string) => stripTypeScriptTypes(source)
const cookery = main.slice(main.indexOf("    case 'cookery': {"), main.indexOf("    case 'village-project':"))
const workshop = main.slice(main.indexOf("    case 'workshop': {"), main.indexOf("    case 'cookery': {"))
const closeSale = main.slice(main.indexOf('function closeContextualSale('), main.indexOf('function beginExactSale('))
const close = main.slice(main.indexOf('function closeCurrentPanel()'), main.indexOf("closeButton.addEventListener('click'"))
const back = main.slice(main.indexOf('function returnFromPanel('), main.indexOf("dialog.addEventListener('cancel'"))
const resume = main.slice(main.indexOf('async function resumeCommunityRequest('), main.indexOf('function requestedRecipe()'))

function setup(at: farmApi.IslandId, signature = false, from = at === 'cape' ? 'honey-kitchen' : 'kitchen') {
  const { farm, selection } = cookingReturnFixture(at)
  assert.ok(farmApi.restoreFarm(farm), 'fixture remains a valid save')
  const calls: string[] = [], state: any = {
    ...farmApi, farm, salePresentation: new SalePresentation(), selectedSale: undefined, panel: 'cookery', panelHistory: [{ panel: from }], communityRequest: selection.request,
    cookingDish: at === 'cape' ? 'honeyBiscuits' : 'orchardTart', cookingFish: 'seaBass', cookingMode: signature ? 'signature' : 'dish',
    signatureBase: 'tart', signatureSlots: [{ id: 'apple', quantity: 2 }], signatureRepeatId: undefined, signatureFamily: undefined,
    signatureFruitIds: [], signatureFruitNames: {}, familyRecipeName: () => undefined, signatureBookCapacity: () => ({ canCreate: true }),
    getSignatureAction: () => ({ available: true, items: [] }), stockLabel: () => ({ name: '', image: '' }), iconUrl: () => '',
    dialog: { open: true }, dialogContent: { innerHTML: '', querySelector: () => ({}) },
    createCookery: (_host: unknown, options: unknown) => { state.options = options; return { destroy() {} } },
    createWorkshop: (_host: unknown, options: unknown) => { state.options = options; return { destroy() {} } },
    workshopRecipe: 'pastry', pastryShape: 'round',
    leaveScene: () => { calls.push('local-back'); state.panel = state.panelHistory.pop()?.panel },
    goBack: () => { calls.push('local-back'); state.panel = state.panelHistory.pop()?.panel },
    closeDialog: () => { calls.push('close'); state.panel = undefined; state.dialog.open = false },
    openRecipeBook: () => { calls.push('recipe-book'); state.panel = 'recipes' },
    returnToRecipeIndex: () => false,
    resumeCommunityRequest: async () => { calls.push('community-travel'); if (farm.island !== 'village') assert.ok(farmApi.sail(farm, 'village').ok) },
  }
  return { state, calls, farm }
}
function mount(state: any, scene = 'cookery') {
  state.panel = scene
  runInNewContext(js(`switch('${scene}'){${scene === 'cookery' ? cookery : workshop}}`), state)
  assert.ok(state.options, 'real main branch mounted a playable cooking scene')
}

for (const at of ['home', 'village', 'cape'] as const) test(`ordinary cooking return ignores old neighbor selection at ${at}`, async () => {
  const { state, calls, farm } = setup(at)
  assert.equal(farmApi.getCookAction(farm, state.cookingDish).available, true)
  const before = JSON.stringify(farm)
  mount(state)
  assert.equal(state.options.returnLabel, 'На кухню')
  await state.options.onCancel()
  assert.deepEqual(calls, ['local-back'])
  assert.equal(state.panel, at === 'cape' ? 'honey-kitchen' : 'kitchen')
  assert.equal(JSON.stringify(farm), before)
})

test('Grove is not a cooking entry point and retains the real domain guard', () => {
  const { farm } = setup('grove'), before = JSON.stringify(farm)
  for (const dish of farmApi.dishIds) assert.equal(farmApi.getCookAction(farm, dish).available, false)
  assert.equal(JSON.stringify(farm), before)
})

for (const scene of ['cookery', 'workshop']) for (const path of ['close', 'escape']) test(`${scene} ${path} never interprets a saved neighbor as a travel command`, async () => {
  const { state, calls, farm } = setup('home'), before = JSON.stringify(farm)
  state.panel = scene
  if (path === 'close') await runInNewContext(js(`${close}; closeCurrentPanel()`), state)
  else {
    state.event = { defaultPrevented: false, preventDefault() { this.defaultPrevented = true } }
    await runInNewContext(js(`${closeSale}; ${back}; returnFromPanel(event)`), state)
    assert.equal(state.event.defaultPrevented, true)
  }
  assert.ok(calls.includes('close') || calls.includes('local-back'))
  assert.ok(!calls.includes('community-travel'))
  assert.equal(JSON.stringify(farm), before)
})

test('workshop cancel stays local and standalone recipe completion returns to the recipe book', async () => {
  const bakery = setup('home'), before = JSON.stringify(bakery.farm)
  mount(bakery.state, 'workshop'); await bakery.state.options.onCancel()
  assert.deepEqual(bakery.calls, ['local-back']); assert.equal(JSON.stringify(bakery.farm), before)
  const signature = setup('home', true, 'signature')
  mount(signature.state); await signature.state.options.onCancel()
  assert.equal(signature.state.options.returnLabel, 'Мои рецепты')
  assert.deepEqual(signature.calls, ['recipe-book']); assert.equal(signature.farm.island, 'home')
})

test('cooking entered from a requested recipe returns to that local recipe; travel remains a separate action', async () => {
  const { state, calls, farm } = setup('home', false, 'request-food'), before = JSON.stringify(farm)
  mount(state)
  assert.equal(state.options.returnLabel, 'К рецепту')
  await state.options.onCancel()
  assert.deepEqual(calls, ['local-back']); assert.equal(state.panel, 'request-food'); assert.equal(JSON.stringify(farm), before)
})

test('completing a real dish does not travel or close the current cooking session', () => {
  const { state, calls, farm } = setup('home')
  state.perform = (action: () => {ok:boolean}) => action().ok
  const before = structuredClone(farm)
  mount(state)
  const result = {family:'decorate', processing:'chunky', fruit:[{ingredientId:'apple',x:.2,y:-.3,angle:.4}], steps:['arrange-fruit','dust-sugar']}
  assert.equal(state.options.onComplete(result), true)
  assert.equal(farm.dishes.orchardTart, before.dishes.orchardTart + 1)
  assert.equal(farm.island, 'home'); assert.equal(state.panel, 'cookery'); assert.deepEqual(calls, [])
  const made = JSON.stringify(farm)
  assert.equal(state.options.onComplete(result), true)
  assert.equal(JSON.stringify(farm), made, 'repeated completion is idempotent')
})

test('the actual explicit meeting action still sails once without joining or consuming the food', async () => {
  const { state, calls, farm } = setup('home'), before = structuredClone(farm)
  Object.assign(state, { communityReturnRoute, requestedFood: undefined, canSailTo: farmApi.canSailTo,
    island: { isCrossing: () => false, crossIsland: async (commit: () => boolean) => { calls.push('cross'); commit() } },
    fieldViewButton: { getAttribute: () => 'false' },
    perform: (action: () => {ok:boolean}) => { const result = action(); if (result.ok) calls.push('save'); return result.ok },
    openPanel: (panel: string) => { state.panel = panel; calls.push(panel) },
  })
  await runInNewContext(js(`${resume}; resumeCommunityRequest('request')`), state)
  assert.equal(farm.island, 'village'); assert.deepEqual(farm, { ...before, island: 'village' })
  assert.deepEqual(calls, ['close','cross','save','neighbor'])
})

test('real autonomous basket-preparation branch changes only the visual actor, not cooking or farm location', () => {
  const { state, farm } = setup('home'), before = JSON.stringify(farm)
  const basket = farmApi.getNeighborPlans(farm).find(plan => plan.arrangement === 'basket' && plan.phase === 'preparing')!
  assert.ok(basket, 'a real next-day basket plan exists')
  const place = getNeighborSceneState(basket)
  const actor = { id: basket.resident, slot: 1, point: {...place.stand}, route: [], facingRight: true, stride: 0,
    gathering: false, serviceRequested: false, fetching: false, waitUntil: 0, atStationSince: 0, plan: basket }
  const source = islandSource.slice(islandSource.indexOf('    const actors = [...villageActors.values()];'), islandSource.indexOf('    for (const plan of getNeighborPlans(farm)) {', islandSource.indexOf('    const actors = [...villageActors.values()];')))
  Object.assign(state, { villageActors: new Map([[basket.resident, actor]]), gatheringPlan: undefined, motion: {matches:false},
    moment: 20_000, elapsed: .05, scenePoint: (x:number,y:number) => ({x,y}), getNeighborSceneState, stepNeighborWalker,
    distance: (a:any,b:any) => Math.hypot(a.x-b.x,a.y-b.y), routeResident: (who:any, target:any) => {who.route=[target]},
  })
  runInNewContext(js(`{${source}}`), state)
  assert.equal(actor.fetching, true, 'actual preparation timer starts fetching the basket supplies')
  assert.deepEqual(actor.route, [place.source])
  for (let frame=0; frame<400; frame++) { state.moment+=50; runInNewContext(js(`{${source}}`), state) }
  assert.equal(state.panel, 'cookery'); assert.equal(JSON.stringify(farm), before)
  assert.doesNotMatch(source, /activate\(|crossIsland|sail\(|openPanel|resumeCommunityRequest/)
})
