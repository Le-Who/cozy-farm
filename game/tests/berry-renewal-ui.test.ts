import test from 'node:test'
import assert from 'node:assert/strict'
import { createFarm, harvestBerryAndKeep } from '../src/farm.ts'
import { BerryRenewalSelection, renderBerryRenewal } from '../src/berry-renewal-ui.ts'
import { isGuardedAction, ActionClickGuard, ActivationKeyGuard } from '../src/action-click-guard.ts'

function garden() {
  const farm = createFarm()
  farm.beds[0] = { kind: 'crop', crop: 'blueberry', growth: 3, watered: false, trait: 'dew' }
  farm.beds[2] = { kind: 'crop', crop: 'strawberry', growth: 0, watered: false }
  return farm
}

test('berry garden explains both choices and keeps selection, preview and cancellation read-only', () => {
  const farm = garden(), before = structuredClone(farm), selection = new BerryRenewalSelection()
  const list = renderBerryRenewal(farm, selection, () => '')
  assert.match(list, /Обычное нажатие на зрелую грядку/)
  assert.match(list, /data-action="berry-renewal-source" data-value="0"/)
  assert.match(list, /data-action="berry-renewal-source" data-value="2" disabled/)
  assert.equal(selection.choose(farm, 2), false); assert.equal(selection.choose(farm, 99), false)
  assert.equal(selection.choose(farm, 0), true)
  const html = renderBerryRenewal(farm, selection, () => '')
  assert.match(html, /Бережный сбор: Росистая черника ×1/)
  assert.match(html, /Обычный сбор на поле: Черника ×2 \(обычные\) \+ Росистая черника ×1/)
  assert.match(html, /3 ночи/); assert.match(html, /один полив на новый цикл/)
  assert.match(html, /data-action="berry-renewal-confirm"/); assert.match(html, /&quot;crop&quot;/)
  assert.deepEqual(farm, before); selection.reset(); assert.deepEqual(farm, before)
  assert.equal(selection.selected, undefined)
})

test('picnic and changed harvest stay visible, and a stale review cannot expose a new confirmation', () => {
  const farm = garden(), selection = new BerryRenewalSelection()
  farm.culinary.picnic = { day: farm.day, processing: 'chunky' }
  selection.choose(farm, 0)
  const html = renderBerryRenewal(farm, selection, () => '')
  assert.match(html, /Черника ×1 \(обычные\) \+ Росистая черника ×1/)
  assert.match(html, /Бережно собрать ×2/); assert.match(html, /Этот бонус расходуется один раз/)
  farm.culinary.picnic = null
  const stale = renderBerryRenewal(farm, selection, () => '')
  assert.match(stale, /Посадка или урожай изменились/); assert.doesNotMatch(stale, /berry-renewal-confirm/)
  selection.choose(farm, 0); const token = selection.selected!.token
  assert.ok(harvestBerryAndKeep(farm, token).ok)
  assert.doesNotMatch(renderBerryRenewal(farm, selection, () => ''), /berry-renewal-confirm/)
  assert.equal(harvestBerryAndKeep(farm, token).ok, false)
})

test('empty gardens, travel and repeat input have safe explicit UI paths', () => {
  const farm = createFarm(), selection = new BerryRenewalSelection()
  assert.match(renderBerryRenewal(farm, selection, () => ''), /Начните с клубники, черники или малины/)
  farm.island = 'grove'; assert.equal(selection.choose(farm, 0), false)
  assert.match(renderBerryRenewal(farm, selection, () => ''), /Родном острове/)
  for (const action of ['source', 'reset', 'bed', 'confirm']) assert.ok(isGuardedAction(`berry-renewal-${action}`))
  const clicks = new ActionClickGuard(), first = { detail: 1, timeStamp: 1000, clientX: 20, clientY: 20 }
  clicks.remember(first); assert.ok(clicks.blocks({ ...first, detail: 2, timeStamp: 1100 }))
  const keys = new ActivationKeyGuard(); assert.equal(keys.blocks({ key: 'Enter', repeat: false }, true), false)
  assert.ok(keys.blocks({ key: 'Enter', repeat: true }, false))
})
