import test from 'node:test'
import assert from 'node:assert/strict'
import { berryCropIds, canRenewBerryBed, createFarm, cropDefinitions, cropIds, getBerryRenewalPreview, harvestBerryAndKeep, type Bed } from '../src/farm.ts'
import { BerryRenewalSelection, renderBerryRenewal, restoreBerryRenewalFocus, berrySeedPreview, revealBerrySeedPreview } from '../src/berry-renewal-ui.ts'
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
  assert.match(list, /data-action="berry-renewal-source" data-value="2"[^>]* disabled/)
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
  for (const action of ['source', 'reset', 'bed', 'confirm', 'seeds']) assert.ok(isGuardedAction(`berry-renewal-${action}`))
  const clicks = new ActionClickGuard(), first = { detail: 1, timeStamp: 1000, clientX: 20, clientY: 20 }
  clicks.remember(first); assert.ok(clicks.blocks({ ...first, detail: 2, timeStamp: 1100 }))
  const keys = new ActivationKeyGuard(); assert.equal(keys.blocks({ key: 'Enter', repeat: false }, true), false)
  assert.ok(keys.blocks({ key: 'Enter', repeat: true }, false))
})


test('berry map keeps all sixteen physical slots and explains each unavailable kind', () => {
  const farm = garden(), selection = new BerryRenewalSelection()
  farm.beds[1] = { kind: 'empty' }
  farm.beds[3] = { kind: 'crop', crop: 'carrot', growth: 1, watered: true }
  farm.beds[4] = { kind: 'tilled' }
  farm.beds[14] = { kind: 'crop', crop: 'raspberry', growth: 2, watered: true, trait: 'sun' }
  farm.beds[15] = { kind: 'crop', crop: 'blueberry', growth: 3, watered: false }
  const before = structuredClone(farm), html = renderBerryRenewal(farm, selection, () => '')
  const cells = [...html.matchAll(/<button class="transplant-bed garden-cell"[^>]+>/g)].map(match => match[0])
  assert.equal(cells.length, 16)
  assert.deepEqual(cells.map(cell => Number(cell.match(/data-value="(\d+)"/)![1])), Array.from({ length: 16 }, (_, index) => index))
  assert.match(html, /role="group" aria-label="Свой ягодник: четыре ряда по четыре, как на поле"/)
  assert.doesNotMatch(html, /role="grid"/)
  assert.match(cells[1], / disabled[^>]*Сначала вскопайте и вырастите ягодную посадку/)
  assert.match(cells[2], / disabled[^>]*Сначала дождитесь зрелости/)
  assert.match(cells[3], / disabled[^>]*Бережный сбор доступен только ягодам/)
  assert.match(cells[4], / disabled[^>]*Посейте и вырастите ягодную посадку/)
  assert.match(cells[15], /Грядка 16, ряд 4, место 4[^>]*Выбрать бережный сбор/)
  for (const index of [0, 14, 15]) assert.doesNotMatch(cells[index], / disabled/)
  assert.match(html, /crop-strawberry.webp[^>]*background-position:0%/)
  assert.match(html, /crop-blueberry.webp[^>]*background-position:100%/)
  assert.equal(selection.choose(farm, 15), true)
  assert.match(renderBerryRenewal(farm, selection, () => ''), /Грядка 16 · Сохранить посадку/)
  selection.reset(); assert.deepEqual(farm, before)
})

test('cancel focus returns visibly to the same eligible source, with heading fallback', () => {
  function target() {
    const calls: string[] = [], classes = new Set<string>(); let onBlur: () => void = () => {}
    return {
      calls, classes,
      classList: { add: (name: string) => classes.add(name), remove: (name: string) => classes.delete(name) },
      addEventListener: (event: string, callback: () => void, options: { once: boolean }) => {
        assert.equal(event, 'blur'); assert.equal(options.once, true); onBlur = callback
      },
      focus: (options: { preventScroll: boolean }) => { assert.equal(options.preventScroll, true); calls.push('focus') },
      scrollIntoView: (options: { block: string; inline: string }) => { assert.deepEqual(options, { block: 'nearest', inline: 'nearest' }); calls.push('scroll') },
      blur: () => onBlur(),
    }
  }
  const source = target(), heading = target(), selectors: string[] = []
  let eligible = true
  const root = { querySelector: (selector: string) => {
    selectors.push(selector)
    return selector === '.transplant-step' ? heading : eligible ? source : null
  } } as unknown as HTMLElement
  restoreBerryRenewalFocus(root, 15)
  assert.match(selectors[0], /data-value="15"\]:not\(:disabled\)/)
  assert.deepEqual(source.calls, ['focus', 'scroll']); assert.deepEqual(heading.calls, [])
  assert.ok(source.classes.has('berry-renewal-focus')); source.blur(); assert.equal(source.classes.size, 0)
  eligible = false; restoreBerryRenewalFocus(root, 15)
  assert.deepEqual(heading.calls, ['focus', 'scroll']); assert.ok(heading.classes.has('berry-renewal-focus'))
  heading.blur(); assert.equal(heading.classes.size, 0)
  selectors.length = 0; restoreBerryRenewalFocus(root, undefined)
  assert.deepEqual(selectors, ['.transplant-step'])
})


test('map eligibility stays equal to the authoritative preview across crop and harvest contexts', () => {
  const beds: Bed[] = [{ kind: 'empty' }, { kind: 'tilled' }]
  for (const crop of cropIds) for (const growth of [0, cropDefinitions[crop].days - 1, cropDefinitions[crop].days, cropDefinitions[crop].days + 1]) {
    for (const watered of [false, true]) for (const trait of [undefined, 'dew'] as const) {
      beds.push({ kind: 'crop', crop, growth, watered, ...(trait ? { trait } : {}) })
    }
  }
  for (const day of [1, 6]) for (const processing of [null, 'chunky', 'bright', 'expired'] as const) {
    const farm = createFarm(), selection = new BerryRenewalSelection()
    farm.day = day
    farm.culinary.picnic = processing === null ? null : { day: processing === 'expired' ? day - 1 : day, processing: processing === 'expired' ? 'chunky' : processing }
    for (let offset = 0; offset < beds.length; offset += 16) {
      farm.beds = Array.from({ length: 16 }, (_, index) => beds[(offset + index) % beds.length])
      const before = structuredClone(farm)
      const cells = [...renderBerryRenewal(farm, selection, () => '').matchAll(/<button class="transplant-bed garden-cell"[^>]+>/g)].map(match => match[0])
      assert.equal(cells.length, 16)
      cells.forEach((cell, index) => {
        const bed = farm.beds[index]
        const expected = bed.kind === 'crop' && berryCropIds.some(crop => crop === bed.crop) && bed.growth >= cropDefinitions[bed.crop].days
        assert.equal(canRenewBerryBed(farm, index), expected)
        assert.equal(!cell.includes(' disabled'), getBerryRenewalPreview(farm, index) !== undefined, `bed ${index}, day ${day}, picnic ${processing}`)
      })
      assert.deepEqual(farm, before)
    }
  }
})

test('mapping ripe beds does not serialize harvest tokens; selection and review still do', t => {
  const farm = createFarm(), selection = new BerryRenewalSelection()
  farm.beds = Array.from({ length: 16 }, () => ({ kind: 'crop', crop: 'blueberry', growth: 3, watered: false, trait: 'dew' }))
  const stringify = t.mock.method(JSON, 'stringify')
  const html = renderBerryRenewal(farm, selection, () => '')
  assert.equal(stringify.mock.callCount(), 0, 'a read-only map needs eligibility, not 16 complete quotes')
  assert.equal((html.match(/data-action="berry-renewal-source"/g) ?? []).length, 16)
  assert.ok(selection.choose(farm, 15))
  assert.equal(stringify.mock.callCount(), 1, 'the explicit choice still freezes its exact quote')
  assert.match(renderBerryRenewal(farm, selection, () => ''), /data-action="berry-renewal-confirm"/)
  assert.equal(stringify.mock.callCount(), 2, 'review still revalidates the quote')
})


test('shared renewal eligibility keeps home and exact-index guards without creating quotes', t => {
  const farm = garden(), stringify = t.mock.method(JSON, 'stringify')
  assert.equal(canRenewBerryBed(farm, 0), true)
  for (const index of [-1, 0.5, NaN, Infinity, 16]) assert.equal(canRenewBerryBed(farm, index), false)
  for (const island of ['grove', 'cape', 'village'] as const) {
    farm.island = island
    assert.equal(canRenewBerryBed(farm, 0), false)
    assert.equal(getBerryRenewalPreview(farm, 0), undefined)
  }
  assert.equal(stringify.mock.callCount(), 0)
})


test('berry seed entry prefers an owned berry and never changes the farm or active sowing choice', () => {
  const farm = createFarm(), before = structuredClone(farm)
  assert.equal(berrySeedPreview(farm), 'strawberry')
  assert.deepEqual(farm, before)
  farm.coins = 0; farm.seeds.raspberry = 2
  farm.gardenPlans = { revision: 1, active: 0, pages: [{ name: 'Морковь', crops: Array(16).fill('carrot') }, null, null, null] }
  const planned = structuredClone(farm)
  assert.equal(berrySeedPreview(farm), 'raspberry')
  assert.deepEqual(farm, planned)
  farm.seeds.blueberry = 1; assert.equal(berrySeedPreview(farm), 'blueberry')
  farm.seeds.strawberry = 1; assert.equal(berrySeedPreview(farm), 'strawberry')
  assert.match(renderBerryRenewal(farm, new BerryRenewalSelection(), () => ''), /data-action="berry-renewal-seeds"/)
  assert.equal(farm.selectedSeed, 'carrot'); assert.equal(farm.gardenPlans.active, 0)
})

test('berry seed entry reveals the existing detail and focuses its heading, never its purchase action', () => {
  const calls: string[] = [], classes = new Set<string>(); let blur: () => void = () => {}
  const heading = {
    tabIndex: 0,
    classList: { add: (name: string) => classes.add(name), remove: (name: string) => classes.delete(name) },
    addEventListener: (event: string, callback: () => void, options: { once: boolean }) => {
      assert.equal(event, 'blur'); assert.equal(options.once, true); blur = callback
    },
    focus: (options: { preventScroll: boolean }) => { assert.equal(options.preventScroll, true); calls.push('heading focus') },
  }
  const detail = {
    querySelector: (selector: string) => { assert.equal(selector, 'h2'); return heading },
    scrollIntoView: (options: { block: string; inline: string }) => { assert.deepEqual(options, { block: 'center', inline: 'nearest' }); calls.push('detail scroll') },
  }
  const root = { querySelector: (selector: string) => { assert.equal(selector, '.seed-detail'); return detail } } as unknown as HTMLElement
  revealBerrySeedPreview(root)
  assert.deepEqual(calls, ['detail scroll', 'heading focus'])
  assert.equal(heading.tabIndex, -1); assert.ok(classes.has('berry-renewal-focus'))
  blur(); assert.equal(classes.size, 0)
})
