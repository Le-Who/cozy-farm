import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import * as farmCommands from '../src/farm.ts'
import { saveGardenPlan, removeGardenPlan } from '../src/garden-plans.ts'
import { rememberRecipeDraft, resetRecipeDraft, recipeDraftKey } from '../src/recipe-draft.ts'
import { GardenPlanEditor, renderGardenPlans } from '../src/garden-plans-ui.ts'

function earnedChoice() {
  const farm = farmCommands.createFarm()
  const commands = JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json', import.meta.url), 'utf8')).slice(0, 24)
  for (const {name, args} of commands) {
    const command = farmCommands[name as keyof typeof farmCommands] as (...args: any[]) => {ok: boolean; message: string}
    const result = command(farm, ...(name === 'workBed' ? [...args, 0] : args))
    assert.ok(result.ok, `${name}: ${result.message}`)
  }
  assert.equal(farm.day, 3)
  assert.equal(farm.produce.wheat, 2)
  assert.ok(rememberRecipeDraft(farm, {base: 'tart', slots: [{id: 'apple', quantity: 1}, {id: 'apple', quantity: 1}], activeSlot: 0}))
  const crops: (farmCommands.CropId | null)[] = Array(16).fill(null); crops[4] = 'wheat'
  assert.ok(saveGardenPlan(farm, 0, {name: 'Два завтрака', crops}, farm.gardenPlans.revision).ok)
  return farm
}
const render = (farm: farmCommands.FarmState, editor = new GardenPlanEditor()) => {
  const before = structuredClone(farm)
  const html = renderGardenPlans(farm, editor, key => `<i data-icon="${key}"></i>`)
  assert.deepEqual(farm, before)
  return html
}

test('earned day-3 saved wheat plan reveals one ordinary-harvest shortfall for the explicit recipe and current pantry order without changing state or controls', () => {
  const farm = earnedChoice(), before = structuredClone(farm)
  assert.equal(farmCommands.getMarketOrders(farm).find(order => order.lane === 'pantry')!.status, 'ready')
  const html = render(farm)
  assert.equal((html.match(/class="garden-shared-harvest"/g) ?? []).length, 1)
  assert.match(html, /<span aria-hidden="true">Урожай · На рецепт и заказ: 2 из 3<\/span>/)
  assert.match(html, /Пшеница: обычного урожая 2 из 3/)
  assert.match(html, /Ящик к завтраку: 2; выбранный рецепт кухни: 1/)
  assert.match(html, /свободных мест 1, семян 2/)
  const cue = html.match(/<small class="garden-shared-harvest">[\s\S]*?<\/small>/)![0]
  assert.doesNotMatch(cue, /<button|data-action|tabindex|монет|ноч/)
  assert.deepEqual(farm, before)
  assert.equal(render(farm), html)
  assert.deepEqual(farm, before)
})

const noCue = (farm: farmCommands.FarmState, editor = new GardenPlanEditor()) => {
  const before = structuredClone(farm)
  assert.doesNotMatch(render(farm, editor), /garden-shared-harvest|На рецепт и заказ/)
  assert.deepEqual(farm, before)
}

test('the cue is absent without both explicit current goals and an overlapping crop in the selected saved plan', () => {
  for (const scenario of ['no-bookmark', 'partial-bookmark', 'preserves', 'no-page', 'other-page', 'other-crop', 'draft', 'shopping', 'away'] as const) {
    const farm = earnedChoice(), editor = new GardenPlanEditor()
    if (scenario === 'no-bookmark') assert.ok(resetRecipeDraft(farm, recipeDraftKey(farm.recipeDraft!)))
    if (scenario === 'partial-bookmark') assert.ok(rememberRecipeDraft(farm, {base: 'tart', slots: [{id:'apple',quantity:1}, null], activeSlot:1}))
    if (scenario === 'preserves') assert.ok(rememberRecipeDraft(farm, {base: 'preserves', slots: [{id:'apple',quantity:1}, {id:'apple',quantity:1}], activeSlot:0}))
    if (scenario === 'no-page') assert.ok(removeGardenPlan(farm, 0, farm.gardenPlans.revision).ok)
    if (scenario === 'other-page') assert.ok(editor.choose(1))
    if (scenario === 'other-crop') {
      const crops: (farmCommands.CropId | null)[] = Array(16).fill(null); crops[4] = 'carrot'
      assert.ok(saveGardenPlan(farm, 0, {name:'Другой урожай', crops}, farm.gardenPlans.revision).ok)
    }
    if (scenario === 'draft') assert.ok(editor.begin(farm))
    if (scenario === 'shopping') editor.shopping = 'open'
    if (scenario === 'away') assert.ok(farmCommands.sail(farm, 'grove').ok)
    noCue(farm, editor)
  }
})

test('current delivery removes the cue, without replacing it with the next request or retaining a stale plan', () => {
  const farm = earnedChoice(), editor = new GardenPlanEditor()
  assert.match(render(farm, editor), /На рецепт и заказ: 2 из 3/)
  assert.ok(farmCommands.deliverMarketOrder(farm, 'pantry').ok)
  noCue(farm, editor)
  assert.ok(farmCommands.endDay(farm).ok)
  assert.equal(farmCommands.getMarketOrders(farm).find(order => order.lane === 'pantry')!.name, 'Заказ пекарни')
  noCue(farm, editor)
  const current = earnedChoice()
  const crops: (farmCommands.CropId | null)[] = Array(16).fill(null); crops[4] = 'carrot'
  assert.ok(saveGardenPlan(current, 0, {name:'Изменённый план', crops}, current.gardenPlans.revision).ok)
  noCue(current, editor)
})

test('planting, watering, and growth cannot count as stock; actual harvest and same-day spending recompute the shortfall', () => {
  const farm = earnedChoice(), editor = new GardenPlanEditor()
  assert.ok(farmCommands.selectSeed(farm, 'wheat').ok)
  assert.ok(farmCommands.workBed(farm, 4, 0).ok)
  assert.ok(farmCommands.workBed(farm, 4, 0).ok)
  assert.match(render(farm, editor), /На рецепт и заказ: 2 из 3/)
  assert.ok(farmCommands.endDay(farm).ok)
  assert.match(render(farm, editor), /На рецепт и заказ: 2 из 3/)
  assert.ok(farmCommands.workBed(farm, 4, 0).ok)
  assert.ok(farmCommands.endDay(farm).ok)
  assert.match(render(farm, editor), /На рецепт и заказ: 2 из 3/)
  assert.ok(farmCommands.workBed(farm, 4, 0).ok)
  assert.ok(farm.produce.wheat >= 4)
  noCue(farm, editor)
  assert.ok(farmCommands.sellMarketItem(farm, 'produce:wheat', farm.produce.wheat - 3).ok)
  assert.equal(farm.produce.wheat, 3)
  noCue(farm, editor)
  assert.ok(farmCommands.sellMarketItem(farm, 'produce:wheat', 1).ok)
  const before = structuredClone(farm)
  assert.match(render(farm, editor), /На рецепт и заказ: 2 из 3/)
  assert.deepEqual(farm, before)
})

test('earned special wheat does not substitute for the shared ordinary crop', () => {
  const farm = earnedChoice()
  assert.ok(farmCommands.workBed(farm, 11, 0).ok)
  assert.ok(farmCommands.endDay(farm).ok)
  assert.ok(farmCommands.endDay(farm).ok)
  assert.ok(farmCommands.workBed(farm, 11, 0).ok)
  assert.equal(farm.variants.wheat?.rainbow, 1)
  assert.equal(farm.produce.wheat, 4)
  assert.ok(farmCommands.sellMarketItem(farm, 'produce:wheat', 2).ok)
  const before = structuredClone(farm)
  assert.match(render(farm), /На рецепт и заказ: 2 из 3/)
  assert.deepEqual(farm, before)
})

test('canonical save restore preserves the same cue and all gameplay state; clearing the explicit recipe removes it', () => {
  const farm = earnedChoice(), before = structuredClone(farm)
  const restored = farmCommands.restoreFarm(JSON.parse(JSON.stringify(farm)))!
  assert.ok(restored)
  assert.equal(render(restored), render(farm))
  assert.deepEqual(restored, before)
  assert.deepEqual(farm, before)
  assert.ok(resetRecipeDraft(restored, recipeDraftKey(restored.recipeDraft!)))
  noCue(restored)
  const controls = (html: string) => [...html.matchAll(/<button[^>]*>/g)].map(match => match[0])
  assert.deepEqual(controls(render(farm)), controls(render(restored)))
})
