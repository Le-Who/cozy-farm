import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer, type ViteDevServer } from 'vite'
import { beginFestival, contributeFestival, endDay, forgetSignature, getFestivalStatus, nameSignature, restoreFarm, sail, sellSignature, type FarmState } from '../src/farm.ts'
import { noteFestivalActivity } from '../src/bay-festival.ts'
import { festivalNextFixture } from './fixtures/festival-next.ts'
import { neighborFoodFixture } from './fixtures/neighbor-food.ts'

let server: ViteDevServer, render: (farm: FarmState) => string
before(async () => {
  server = await createServer({ root: fileURLToPath(new URL('..', import.meta.url)), configFile: false, server: { middlewareMode: true }, appType: 'custom' })
  render = (await server.ssrLoadModule('/src/bay-festival-ui.ts')).renderFestivalPanel
})
after(async () => { await server?.close() })
const preview = (farm: FarmState) => render(farm).match(/<details class="festival-next-preview">([\s\S]*?)<\/details>/)?.[1]
function morning(farm: FarmState) {
  assert.ok(sail(farm, 'home').ok); assert.ok(endDay(farm).ok); assert.ok(sail(farm, 'village').ok)
}
function stage(farm: FarmState) {
  const stageNumber = farm.festivals.active!.stage
  while (farm.festivals.active!.stage === stageNumber) {
    const requirement = getFestivalStatus(farm).active!.requirements.find(item => item.available > 0)!
    assert.ok(requirement)
    assert.ok(contributeFestival(farm, requirement.id, requirement.alternatives.find(item => item.available > 0)!.id).ok)
  }
}

test('tomorrow preview exposes exact requirements without an actionable contribution or mutation', () => {
  const farm = festivalNextFixture(), before = structuredClone(farm), html = preview(farm)
  assert.ok(html)
  assert.match(html, /Что подготовить к утру/)
  assert.match(html, /Корнеплоды[\s\S]*3 вклада/)
  assert.match(html, /Морковь[\s\S]*×3/)
  assert.match(html, /Зелень или зерно[\s\S]*2 вклада/)
  assert.match(html, /Пшеница[\s\S]*×2/)
  assert.doesNotMatch(html, /<button|data-action|href=/)
  assert.equal(contributeFestival(farm, 'greens', 'wheat').ok, false)
  assert.deepEqual(farm, before)
  assert.equal(preview(restoreFarm(JSON.parse(JSON.stringify(farm)))!), html)
})

test('the same chosen requirements become actionable only after the real morning', () => {
  const farm = festivalNextFixture(), requirements = structuredClone(getFestivalStatus(farm).active!.requirements)
  morning(farm)
  assert.equal(preview(farm), undefined)
  assert.deepEqual(getFestivalStatus(farm).active!.requirements, requirements)
  const wheat = farm.produce.wheat
  assert.ok(contributeFestival(farm, 'greens', 'wheat').ok)
  assert.equal(farm.produce.wheat, wheat - 1)
  assert.equal(farm.festivals.active!.delivered.greens, 1)
})

test('replacement quantities are totals for the remaining group, not one item per contribution', () => {
  const { farm } = neighborFoodFixture()
  farm.festivals.completed.harvest = 1; farm.festivals.lastCompletedOn = farm.day - 1
  farm.produce.carrot = 20; farm.fruit.apple = 20
  assert.ok(beginFestival(farm, 'harvest').ok)
  noteFestivalActivity(farm.festivals, 'harvest'); stage(farm)
  const html = preview(farm)!
  assert.match(html, /Мёд|мёд/)
  assert.match(html, /Цветочный мёд[\s\S]*×2/)
  assert.match(html, /Яблоки вместо мёда[\s\S]*×4/)
  assert.ok(restoreFarm(farm))
})

test('concert and received cargo remain event requirements, never a promise of free stock or rewards', () => {
  for (const tradition of ['stage', 'lights'] as const) {
    const { farm } = neighborFoodFixture()
    farm.fruit.apple = farm.produce.wheat = farm.produce.carrot = farm.handmade.round = farm.fish.perch = farm.shells.regular = 20
    assert.ok(beginFestival(farm, tradition).ok)
    if (tradition === 'lights') noteFestivalActivity(farm.festivals, 'fish')
    stage(farm); morning(farm); stage(farm)
    const view = getFestivalStatus(farm).active!, html = preview(farm)!, before = structuredClone(farm)
    assert.equal(view.stage, 2)
    assert.ok(html.includes(tradition === 'stage' ? 'Сыгранный концерт' : 'Доставленный после выбора груз'))
    assert.doesNotMatch(html, /Награда|Бесплатно|Засчитано|Готово/)
    assert.deepEqual(farm, before)
    const requirements = structuredClone(view.requirements)
    morning(farm)
    assert.deepEqual(getFestivalStatus(farm).active!.requirements, requirements)
  }
})

test('recipe alternatives are derived afresh and names are escaped, without reserving stock', () => {
  const farm = festivalNextFixture()
  morning(farm); farm.produce.carrot = 3; stage(farm)
  const recipe = farm.culinary.recipes[0]
  assert.ok(nameSignature(farm, recipe.id, 'Тарт "Дом & Сад"').ok)
  const before = structuredClone(farm), html = preview(farm)!
  assert.match(html, /Тарт &quot;Дом &amp; Сад&quot;/)
  assert.doesNotMatch(html, /Тарт "Дом & Сад"/)
  assert.deepEqual(farm, before)
  assert.ok(sail(farm, 'home').ok)
  assert.ok(sellSignature(farm, recipe.id, farm.culinary.stock[recipe.id]).ok)
  assert.ok(forgetSignature(farm, recipe.id).ok)
  assert.ok(restoreFarm(farm))
  assert.doesNotMatch(preview(farm)!, /Дом &amp; Сад/)
})

test('no next-preparation disclosure is invented for a current step, final wait or finished festival', () => {
  const farm = festivalNextFixture()
  morning(farm)
  assert.equal(preview(farm), undefined)
  farm.festivals.active!.stage = 3; farm.festivals.active!.readyOn = farm.day + 1
  assert.equal(preview(farm), undefined)
  farm.festivals.active = null
  assert.equal(preview(farm), undefined)
})
