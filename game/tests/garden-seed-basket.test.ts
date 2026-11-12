import test from 'node:test'
import assert from 'node:assert/strict'
import { createFarm, restoreCurrentFarm, workBed, type CropId } from '../src/farm.ts'
import { saveGardenPlan, followGardenPlan } from '../src/garden-plans.ts'
import { gardenSeedQuote, buyGardenSeeds } from '../src/garden-seed-basket.ts'

const setup = () => {
  const farm = createFarm()
  farm.coins = 100
  farm.beds = Array.from({ length: 16 }, () => ({ kind: 'tilled' as const }))
  farm.seeds.wheat = 1; farm.seeds.carrot = 0
  const crops: (CropId | null)[] = Array(16).fill(null)
  crops.fill('wheat', 0, 5); crops.fill('carrot', 5, 7)
  assert.ok(saveGardenPlan(farm, 0, { name: 'На пироги и суп', crops }, 0).ok)
  assert.ok(followGardenPlan(farm, 0, 1).ok)
  return farm
}

test('garden basket quotes exact ordinary packs, buys once and leaves all farm work manual', () => {
  const farm = setup(), before = structuredClone(farm)
  const quote = gardenSeedQuote(farm, 0, 'open')!
  assert.equal(quote.packs, 3); assert.equal(quote.total, 12); assert.equal(quote.seeds, 9)
  assert.deepEqual(farm, before)
  assert.ok(buyGardenSeeds(farm, quote.token).ok)
  assert.equal(farm.coins, 88); assert.equal(farm.seeds.wheat, 7); assert.equal(farm.seeds.carrot, 3)
  assert.deepEqual(farm.beds, before.beds); assert.equal(farm.gardenPlans.active, 0)
  assert.equal(farm.workToday, before.workToday); assert.equal(farm.day, before.day)
  const bought = structuredClone(farm)
  assert.equal(buyGardenSeeds(farm, quote.token).ok, false); assert.deepEqual(farm, bought)
  assert.deepEqual(restoreCurrentFarm(JSON.parse(JSON.stringify(farm))), farm)
  assert.ok(workBed(farm, 0, 0).ok); assert.equal(farm.seeds.wheat, 6)
})


test('occupied beds are excluded now but a full repeat can be prepared without removing plants', () => {
  const farm = setup(), current = createFarm().beds[1]
  farm.beds[0] = structuredClone(current); farm.beds[5] = structuredClone(current)
  const before = structuredClone(farm)
  const now = gardenSeedQuote(farm, 0, 'open')!, later = gardenSeedQuote(farm, 0, 'all')!
  assert.equal(now.total, 8); assert.equal(now.packs, 2)
  assert.equal(later.total, 12); assert.equal(later.packs, 3)
  assert.ok(buyGardenSeeds(farm, later.token).ok)
  assert.deepEqual(farm.beds, before.beds)
  assert.equal(gardenSeedQuote(farm, 0, 'all')!.packs, 0)
  const supplied = structuredClone(farm)
  assert.equal(buyGardenSeeds(farm, gardenSeedQuote(farm, 0, 'all')!.token).ok, false)
  assert.deepEqual(farm, supplied)
})

test('insufficient budget never buys a partial basket; enough coins allow the exact quoted purchase', () => {
  const farm = setup(); farm.coins = 11
  const quote = gardenSeedQuote(farm, 0, 'open')!, before = structuredClone(farm)
  assert.equal(quote.affordable, false); assert.equal(buyGardenSeeds(farm, quote.token).ok, false)
  assert.deepEqual(farm, before)
  farm.coins = 12
  assert.ok(buyGardenSeeds(farm, quote.token).ok); assert.equal(farm.coins, 0)
})

test('changed plan, stock or relevant occupancy rejects an old quote without spending', () => {
  for (const change of ['plan', 'stock', 'occupancy', 'island', 'revision-limit'] as const) {
    const farm = setup(), quote = gardenSeedQuote(farm, 0, 'open')!
    if (change === 'plan') saveGardenPlan(farm, 0, farm.gardenPlans.pages[0], farm.gardenPlans.revision)
    if (change === 'stock') farm.seeds.wheat++
    if (change === 'occupancy') farm.beds[0] = structuredClone(createFarm().beds[1])
    if (change === 'island') farm.island = 'grove'
    if (change === 'revision-limit') farm.gardenPlans.revision = 1_000_000
    const before = structuredClone(farm)
    assert.equal(buyGardenSeeds(farm, quote.token).ok, false, change); assert.deepEqual(farm, before)
  }
})

test('invalid tokens or slots cannot invent a basket; manual sowing mode and unrelated supplies stay unchanged', () => {
  const farm = setup(); followGardenPlan(farm, null, farm.gardenPlans.revision)
  const quote = gardenSeedQuote(farm, 0, 'open')!, before = structuredClone(farm)
  for (const value of [null, {}, '', quote.token + ';extra', quote.token.replace(';0;open;', ';1;open;'), quote.token.replace(';open;', ';__proto__;')]) {
    assert.equal(buyGardenSeeds(farm, value).ok, false); assert.deepEqual(farm, before)
  }
  for (const slot of [-1, 4, NaN, 0.5, 1]) assert.equal(gardenSeedQuote(farm, slot, 'open'), undefined)
  assert.equal(gardenSeedQuote(farm, 0, 'bad' as any), undefined)
  assert.ok(buyGardenSeeds(farm, quote.token).ok)
  assert.equal(farm.gardenPlans.active, null); assert.equal(farm.selectedSeed, before.selectedSeed)
  assert.equal(farm.seeds.blueberry, before.seeds.blueberry); assert.equal(farm.feed, before.feed)
  assert.deepEqual(farm.produce, before.produce); assert.deepEqual(farm.neighborVisits, before.neighborVisits)
})

test('review is read-only, exposes exact cost/scope, and only a separate guarded purchase spends', async () => {
  const { GardenPlanEditor, renderGardenPlans } = await import('../src/garden-plans-ui.ts')
  const { isGuardedAction, ActionClickGuard, ActivationKeyGuard } = await import('../src/action-click-guard.ts')
  const farm = setup(), editor = new GardenPlanEditor(), before = structuredClone(farm)
  assert.doesNotMatch(renderGardenPlans(farm, editor, () => ''), /data-action="garden-buy-seeds"/)
  editor.shopping = 'open'
  const html = renderGardenPlans(farm, editor, () => '')
  assert.match(html, /Для свободных грядок/); assert.match(html, /На полный посев/)
  assert.match(html, /Весь список: 3 пакета · 12 монет/)
  assert.match(html, /У вас: 100 монет/); assert.match(html, /Купить список за 12 монет/)
  assert.match(html, /Покупка не сеет/); assert.deepEqual(farm, before)
  farm.coins = 11
  assert.match(renderGardenPlans(farm, editor, () => ''), /data-action="garden-buy-seeds"[^>]+ disabled/)
  editor.shopping = 'all'; assert.match(renderGardenPlans(farm, editor, () => ''), /Растущие культуры остаются на месте/)
  editor.reset(); assert.equal(editor.shopping, undefined)
  for (const action of ['garden-shop', 'garden-shop-scope', 'garden-shop-back', 'garden-buy-seeds']) assert.ok(isGuardedAction(action))
  const click = new ActionClickGuard(), first = { detail: 1, timeStamp: 1000, clientX: 20, clientY: 20 }
  click.remember(first); assert.ok(click.blocks({ ...first, timeStamp: 1100, detail: 2 }))
  const keys = new ActivationKeyGuard(); assert.equal(keys.blocks({ key: 'Enter', repeat: false }, true), false)
  assert.ok(keys.blocks({ key: 'Enter', repeat: true }, false))
})
