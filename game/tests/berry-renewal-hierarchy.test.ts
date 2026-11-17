import test from 'node:test'
import assert from 'node:assert/strict'
import { createFarm, buySeeds, selectSeed, workBed, endDay, getBerryRenewalPreview, restoreCurrentFarm, type FarmState } from '../src/farm.ts'
import { BerryRenewalSelection, renderBerryRenewal } from '../src/berry-renewal-ui.ts'

function earnedBerries() {
  const farm = createFarm()
  assert.ok(buySeeds(farm, 'blueberry').ok); assert.ok(selectSeed(farm, 'blueberry').ok)
  for (const index of [0, 0, 0, 13, 13]) assert.ok(workBed(farm, index, 0).ok)
  for (let n = 0; n < 4; n++) assert.ok(endDay(farm).ok)
  assert.equal(farm.day, 5)
  assert.deepEqual(restoreCurrentFarm(JSON.parse(JSON.stringify(farm))), farm)
  return farm
}
const visibleText = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
function render(farm: FarmState, index: number) {
  const before = structuredClone(farm), selection = new BerryRenewalSelection()
  assert.ok(selection.choose(farm, index))
  const html = renderBerryRenewal(farm, selection, () => '')
  assert.deepEqual(farm, before)
  return {html, selection}
}

test('earned rainbow and ordinary reviews lead with two static exact outcomes and one visibly primary existing action', () => {
  const farm = earnedBerries()
  for (const [index, small, full] of [[0, 'Радужная черника ×1', 'Черника ×2 (обычные) + Радужная черника ×1'], [13, 'Черника ×1 (обычные)', 'Черника ×3 (обычные)']] as const) {
    const {html, selection} = render(farm, index)
    const outcomes = html.match(/<dl class="berry-renewal-outcomes"[\s\S]*?<\/dl>/)?.[0]
    assert.ok(outcomes)
    const text = visibleText(outcomes)
    assert.ok(text.includes(`Бережный сбор: ${small}`))
    assert.ok(text.includes('Куст остаётся и начинает новый рост.'))
    assert.ok(text.includes(`Обычный сбор на поле: ${full}`))
    assert.ok(text.includes('Куст убирается, грядка свободна.'))
    assert.doesNotMatch(outcomes, /<button|data-action|tabindex/)
    const facts = html.match(/<ul class="berry-renewal-facts"[\s\S]*?<\/ul>/)?.[0]
    assert.ok(facts)
    assert.match(visibleText(facts), /3 ночи обычного роста.*один полив на новый цикл/)
    assert.match(visibleText(facts), /Семена не нужны.*Грядка занята.*план огорода не меняется/)
    assert.ok(html.indexOf(outcomes) < html.indexOf(facts) && html.indexOf(facts) < html.indexOf('class="dialog-actions"'))
    const buttons = [...html.matchAll(/<button[^>]*data-action="([^"]+)"[^>]*>/g)]
    assert.deepEqual(buttons.map(b => b[1]), ['berry-renewal-confirm', 'berry-renewal-bed', 'berry-renewal-reset'])
    assert.match(buttons[0][0], /class="dialog-button"/)
    assert.match(buttons[1][0], /class="dialog-button secondary"/)
    assert.match(buttons[2][0], /class="dialog-button secondary"/)
    assert.ok(buttons[0][0].includes(selection.selected!.token.replaceAll('"', '&quot;')))
    assert.equal(getBerryRenewalPreview(farm, index)!.token, selection.selected!.token)
  }
})

test('care facts describe current rain only when applicable, and ordinary berries retain their weather caveat', () => {
  const farm = earnedBerries()
  const dry = visibleText(render(farm, 0).html)
  assert.doesNotMatch(dry, /Новый цикл начнётся политым дождём/)
  assert.match(dry, /одна особая ягода в каждом урожае/)
  assert.match(visibleText(render(farm, 13).html), /Куст остаётся обычным; погода может дать ему особенность/)
  assert.ok(endDay(farm).ok)
  assert.equal(farm.day, 6)
  const wet = visibleText(render(farm, 0).html)
  assert.match(wet, /Новый цикл начнётся политым дождём/)
  assert.match(wet, /3 ночи обычного роста.*один полив на новый цикл/)
})

test('a two-night ordinary strawberry keeps nightly-watering facts without changing quote or controls', () => {
  const farm = createFarm()
  assert.ok(buySeeds(farm, 'strawberry').ok); assert.ok(selectSeed(farm, 'strawberry').ok)
  assert.ok(workBed(farm, 13, 0).ok); assert.ok(workBed(farm, 13, 0).ok)
  assert.ok(endDay(farm).ok); assert.ok(workBed(farm, 13, 0).ok); assert.ok(endDay(farm).ok)
  const text = visibleText(render(farm, 13).html)
  assert.match(text, /Бережный сбор: Клубника ×1 \(обычные\)/)
  assert.match(text, /Обычный сбор на поле: Клубника ×3 \(обычные\)/)
  assert.match(text, /2 ночи обычного роста.*Поливайте перед каждой ночью роста/)
  assert.doesNotMatch(text, /один полив|политым дождём|пикника/)
  assert.deepEqual(restoreCurrentFarm(JSON.parse(JSON.stringify(farm))), farm)
})

test('a stale review has no outcomes or primary action; cancellation still returns the untouched map', () => {
  const farm = earnedBerries(), selection = new BerryRenewalSelection()
  assert.ok(selection.choose(farm, 0)); assert.ok(endDay(farm).ok)
  const before = structuredClone(farm), stale = renderBerryRenewal(farm, selection, () => '')
  assert.match(stale, /role="alert"/)
  assert.doesNotMatch(stale, /berry-renewal-outcomes|berry-renewal-confirm|class="dialog-button"/)
  assert.match(stale, /class="dialog-button secondary" data-action="berry-renewal-reset"/)
  selection.reset()
  const map = renderBerryRenewal(farm, selection, () => '')
  assert.match(map, /Выберите зрелый куст/)
  assert.doesNotMatch(map, /berry-renewal-outcomes|berry-renewal-confirm|class="dialog-button"/)
  assert.deepEqual(farm, before)
})
