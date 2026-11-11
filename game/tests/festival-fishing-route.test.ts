import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { beginFishingTrip, contributeFestival, finishFishingTrip, getFestivalStatus, restoreFarm, sail } from '../src/farm.ts'
import { createFishingPractice } from '../src/fishing-practice.ts'
import { getFestivalFishingRoute } from '../src/festival-fishing-route.ts'
import { festivalFishingFixture } from './fixtures/festival-fishing.ts'

const reload = (farm: ReturnType<typeof festivalFishingFixture>) => restoreFarm(JSON.parse(JSON.stringify(farm)))!

test('festival participation seeks a reachable coast with a remaining quota, not a fixed exhausted grove', () => {
  const groveFull = festivalFishingFixture('grove')
  assert.deepEqual(getFestivalFishingRoute(groveFull), { island: 'home', panel: 'fishing', label: 'Рыбачить у Родного острова' })
  const homeFull = festivalFishingFixture('home')
  assert.deepEqual(getFestivalFishingRoute(homeFull), { island: 'grove', panel: 'fishing', label: 'Рыбачить в Солёной роще' })
  homeFull.fishCaughtToday.home = 0
  assert.ok(sail(homeFull, 'home').ok)
  assert.equal(getFestivalFishingRoute(homeFull)?.island, 'home', 'keep a usable current coast')
  assert.ok(sail(homeFull, 'grove').ok)
  assert.equal(getFestivalFishingRoute(homeFull)?.island, 'grove')
})

test('only exhausted reachable coasts lead to a separate home rest preview; inaccessible coasts do not count', () => {
  const farm = festivalFishingFixture('both')
  assert.deepEqual(getFestivalFishingRoute(farm), { island: 'home', panel: 'rest', label: 'К отдыху дома' })
  farm.boatOwned = false
  assert.equal(getFestivalFishingRoute(farm), undefined, 'cannot sail from the village without a boat')
  farm.island = 'home'
  farm.fishCaughtToday.grove = 0
  assert.equal(getFestivalFishingRoute(farm)?.panel, 'rest', 'the unreachable grove is not offered')
  farm.fishCaughtToday.home = 0
  assert.equal(getFestivalFishingRoute(farm)?.panel, 'fishing', 'local fishing needs no boat')
})

test('route reads and reload preserve the program, quota, stock and preparation', () => {
  const farm = festivalFishingFixture(), before = structuredClone(farm)
  for (let i = 0; i < 4; i++) assert.equal(getFestivalFishingRoute(farm)?.island, 'home')
  assert.deepEqual(farm, before)
  const loaded = reload(farm)
  assert.deepEqual(loaded, before)
  assert.deepEqual(getFestivalFishingRoute(loaded), getFestivalFishingRoute(farm))
})

test('old fish and practice do not qualify; a new home catch enables only the separate contribution', () => {
  const farm = festivalFishingFixture(), before = structuredClone(farm.festivals)
  assert.equal(getFestivalStatus(farm).active!.requirements[0].available, 0)
  assert.ok(sail(farm, 'grove').ok)
  const practice = createFishingPractice(farm)!
  assert.ok(practice.cast()); assert.ok(practice.finish([{ kind: 'fish', species: 'seaBass', variant: 'regular' }]))
  assert.deepEqual(farm.festivals, before)
  assert.ok(sail(farm, 'home').ok)
  const trip = beginFishingTrip(farm)
  assert.ok(trip.ok); assert.ok(finishFishingTrip(farm, trip.token!, 1).ok)
  assert.equal(farm.festivals.active!.activity.fish, true)
  assert.equal(farm.festivals.active!.delivered.participation, undefined)
  assert.equal(getFestivalFishingRoute(farm), undefined, 'stale fishing link no longer routes away')
  assert.ok(sail(farm, 'village').ok)
  const stock = structuredClone(farm.fish), coins = farm.coins
  assert.ok(contributeFestival(farm, 'participation', 'fish').ok)
  assert.equal(contributeFestival(farm, 'participation', 'fish').ok, false)
  assert.deepEqual(farm.fish, stock)
  assert.equal(farm.coins, coins)
  assert.equal(reload(farm).festivals.active!.delivered.participation, 1)
})

test('obsolete, completed or waiting preparation cannot revive a fishing navigation link', () => {
  const farm = festivalFishingFixture()
  farm.festivals.active!.readyOn = farm.day + 1
  assert.equal(getFestivalFishingRoute(farm), undefined)
  farm.festivals.active!.readyOn = farm.day
  farm.festivals.active!.delivered.participation = 1
  assert.equal(getFestivalFishingRoute(farm), undefined)
  farm.festivals.active = null
  assert.equal(getFestivalFishingRoute(farm), undefined)
})

test('festival UI labels the available coast or explicit rest, without changing the farm', async () => {
  const server = await createServer({ root: fileURLToPath(new URL('..', import.meta.url)), configFile: false, server: { middlewareMode: true }, appType: 'custom' })
  try {
    const { renderFestivalPanel } = await server.ssrLoadModule('/src/bay-festival-ui.ts')
    for (const mode of ['grove', 'home', 'both'] as const) {
      const farm = festivalFishingFixture(mode), before = structuredClone(farm)
      const html = renderFestivalPanel(farm)
      assert.ok(html.includes(getFestivalFishingRoute(farm)!.label))
      if (mode === 'both') assert.match(html, /На доступных берегах сегодняшняя квота исчерпана/)
      assert.deepEqual(farm, before)
    }
  } finally { await server.close() }
})

test('the real festival activity handler rechecks the open panel and only navigates', async () => {
  const source = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8')
  const body = source.split("case 'festival-activity': {")[1].split("case 'festival-village':")[0]
  const AsyncFunction = Object.getPrototypeOf(async function() {}).constructor
  const run = new AsyncFunction('farm', 'panel', 'dialog', 'getFestivalFishingRoute', 'visitPanelAt', `const value='fish';switch('festival-activity'){case 'festival-activity':{${body}}`)
  const farm = festivalFishingFixture(), before = structuredClone(farm), visits: unknown[][] = []
  const visit = (...args: unknown[]) => { visits.push(args) }
  await run(farm, 'festival', { open: true }, getFestivalFishingRoute, visit)
  assert.deepEqual(visits, [['home', 'fishing']]); assert.deepEqual(farm, before)
  visits.length = 0
  await run(farm, 'festival', { open: false }, getFestivalFishingRoute, visit)
  await run(farm, 'recipes', { open: true }, getFestivalFishingRoute, visit)
  farm.festivals.active!.activity.fish = true
  await run(farm, 'festival', { open: true }, getFestivalFishingRoute, visit)
  assert.deepEqual(visits, [])
})
