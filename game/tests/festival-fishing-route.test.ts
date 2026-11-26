import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createServer } from './fixtures/ssr-vite.ts'
import { beginFishingTrip, contributeFestival, finishFishingTrip, getFestivalStatus, restoreFarm, sail } from '../src/farm.ts'
import { createFishingPractice } from '../src/fishing-practice.ts'
import { getFestivalFishingRoute } from '../src/festival-fishing-route.ts'
import { festivalFishingFixture } from './fixtures/festival-fishing.ts'
import { commissionPlayer } from './fixtures/commission-player.ts'

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


test('first earned harbour lights put today’s step and its consequences before progress and cancellation', async () => {
  const opening = JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json', import.meta.url), 'utf8'))
  const p = commissionPlayer(opening.slice(0, opening.findIndex((a: { name: string }) => a.name === 'serveVillageMeal') + 1))
  assert.equal(p.state.day, 10); assert.equal(p.state.village.meals, 1)
  const coins = p.state.coins, fish = structuredClone(p.state.fish)
  const server = await createServer({ root: fileURLToPath(new URL('..', import.meta.url)), configFile: false, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
  try {
    const { renderFestivalPanel } = await server.ssrLoadModule('/src/bay-festival-ui.ts')
    const read = (): string => {
      const before = structuredClone(p.state), html = renderFestivalPanel(p.state)
      assert.deepEqual(p.state, before, 'viewing does not contribute, cancel or advance time')
      return html
    }
    const ordered = (html: string, ...needles: string[]) => {
      let previous = -1
      for (const needle of needles) {
        const position = html.indexOf(needle)
        assert.ok(position > previous, `Missing or out of order: ${needle}`); previous = position
      }
    }
    p.act('beginFestival', 'lights')
    assert.equal(read().match(/<button[^>]*data-action="([^"]+)"/)?.[1], 'festival-activity', 'first control is the current route, not cancellation')
    ordered(read(), 'Гостей в день · 6 → 7', 'Улов для причала', 'После вклада или участия',
      'data-action="festival-activity" data-value="fish"', 'festival-stages', 'data-action="festival-cancel" data-value="lights">')
    p.act('cancelFestival', 'lights')
    assert.equal(p.state.festivals.active, null); assert.deepEqual(p.state.fish, fish); assert.equal(p.state.coins, coins)

    p.act('beginFestival', 'lights'); p.visit(getFestivalFishingRoute(p.state)!.island); p.act('catchFish', true); p.visit('village')
    const afterCatch = read()
    ordered(afterCatch, 'data-value="participation|fish"', 'data-value="fish|seaBass"', 'festival-stages', 'id="festival-cancel-reason"', 'data-action="festival-cancel" data-value="lights" disabled')
    assert.equal(getFestivalStatus(p.state).active!.materialValue, 0)
    p.act('contributeFestival', 'participation', 'fish')
    assert.equal(read().match(/<button[^>]*data-value="([^"]+)"/)?.[1], 'fish|seaBass', 'offer the fish just caught before directions for missing fish')
    ordered(read(), 'data-action="festival-contribute" data-value="fish|seaBass"', 'data-action="festival-source" data-value="fish|perch"',
      'data-action="festival-source" data-value="fish|moonfish"', 'data-action="festival-source" data-value="fish|lanternfish"')
    assert.equal(p.state.fish.seaBass, 1); assert.equal(p.state.coins, coins)
    p.act('contributeFestival', 'fish', 'seaBass')
    ordered(read(), '1/3', 'Окунь', 'На празднике: 10 монет за припасы + 24 монеты гонорара', 'festival-stages', 'data-action="festival-cancel"')
    assert.equal(p.state.fish.seaBass, 0); assert.equal(p.state.coins, coins)

    p.visit('home'); p.act('catchFish', true); p.act('catchFish', true); p.visit('village')
    p.act('contributeFestival', 'fish', 'perch'); p.act('contributeFestival', 'fish', 'perch')
    ordered(read(), 'Утро 11-го дня', 'data-action="festival-rest"', 'Что подготовить к утру', 'festival-stages', 'data-action="festival-cancel"')
    assert.equal(p.state.day, 10); assert.equal(p.state.coins, coins)
    p.night(); p.visit('village')
    ordered(read(), 'Украшения берега', 'data-value="shore|shells"', 'festival-stages', 'data-action="festival-cancel"')
  } finally { await server.close() }
})
