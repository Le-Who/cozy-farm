import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { runInNewContext } from 'node:vm'
import * as F from '../src/farm.ts'
import * as scene from '../src/neighbor-scene.ts'
import { commissionPlayer } from './fixtures/commission-player.ts'

const actions = JSON.parse(readFileSync(new URL('./fixtures/market-order-selection-commands.json', import.meta.url), 'utf8'))
const placements = [{ slot: 'food', x: 0, y: 0 }, { slot: 'cup', x: .4, y: .2 }, { slot: 'flowers', x: -.4, y: .2 }]
const basket = { kind: 'basket', settled: true, placements }
const source = readFileSync(new URL('../src/island.ts', import.meta.url), 'utf8')
const start = source.indexOf('function paintVillage(')
const end = source.indexOf('function paintBed(', start)
assert.ok(start >= 0 && end > start)
const paint = stripTypeScriptTypes(source.slice(start, end) + ';paintVillage(farm, 0, 1)')
function positions(farm: F.FarmState, reduced = true) {
  const before = structuredClone(farm)
  const actors = F.getNeighborPlans(farm).map(plan => ({
    id: plan.resident, plan, point: { x: 0, y: 0 }, route: [] as { x: number; y: number }[],
    gathering: false, serviceRequested: false, fetching: false, waitUntil: 100,
  }))
  runInNewContext(paint, {
    ...scene, farm, getNeighborPlans: F.getNeighborPlans, getVillageHomeCount: F.getVillageHomeCount,
    motion: { matches: reduced }, scenePoint: (x: number, y: number) => ({ x, y }), sceneScale: 1,
    village: { homes: [], table: { y: 0 } }, harbourPlacesOnMap: [], servedJars: new Map(),
    art: { draw() {}, image: () => undefined }, world: { shape() {} },
    villageActors: new Map(actors.map(actor => [actor.id, actor])), villageMealCelebration: 0,
    residentClock: 0, villageWelcome: 0, finnAboard: false, clamp: (x: number) => x,
    distance: (a: {x: number; y: number}, b: {x: number; y: number}) => Math.hypot(a.x - b.x, a.y - b.y),
    routeResident: (actor: typeof actors[number], target: { x: number; y: number }) => { actor.route = [target] },
  })
  assert.deepEqual(farm, before, 'drawing never changes farm state')
  return Object.fromEntries(actors.map(actor => [actor.id, reduced ? actor.point : actor.route[0]]))
}

function reachFirstFinnLunch(waveGoodbye: boolean) {
  const p = commissionPlayer(actions.slice(0, 116))
  assert.equal(p.state.day, 14)
  assert.deepEqual(p.state.village.residents, ['bea', 'finn'])
  assert.equal(F.getVillageHomeCount(p.state), 2)
  assert.equal(p.state.neighbors.bea.current?.phase, 'celebrating')
  const legacyTea = structuredClone(p.state.neighbors.bea.current)
  if (waveGoodbye) p.act('advanceNeighborPlan', 'bea:1')
  p.visit('home')
  if (!p.state.seeds.wheat) p.act('buySeeds', 'wheat')
  p.act('selectSeed', 'wheat'); p.act('workBed', 0)
  for (let attempts = 0; F.getBedStage(p.state.beds[0]) !== 'ripe'; attempts++) {
    assert.ok(attempts < 6)
    if (F.getBedAction(p.state, 0).kind === 'water') {
      if (!p.state.water) p.act('refillWater')
      p.act('workBed', 0)
    }
    p.night()
  }
  p.act('workBed', 0); p.act('bakeWorkshop', 'round'); p.visit('village')
  assert.equal(p.state.day, 16)
  if (!waveGoodbye) {
    // Restore the exact paid tea state that a genuinely earned D16 save could retain
    // under the older writer. Current ordinary dawn now advances it without farewell.
    p.state.neighbors.bea.current = legacyTea
    p.reload()
  }
  return p
}

test('earned first Finn lunch owns the shore even if Bea’s old tea was not dismissed', () => {
  const outcome = (waveGoodbye: boolean) => {
    const p = reachFirstFinnLunch(waveGoodbye)
    const { beaTea, finnShore } = scene.neighborSceneAnchors
    if (!waveGoodbye) {
      assert.equal(p.state.neighbors.bea.memories.at(-1)?.day, 14)
      assert.deepEqual(positions(p.state).finn, beaTea.guest, 'an old celebration still works if no current event')
    }
    p.act('joinNeighborPlan', 'finn:1')
    const stock = p.state.handmade.round
    p.act('serveNeighborPlan', 'finn:1', 'handmade:round')
    assert.equal(p.state.handmade.round, stock)
    assert.deepEqual(positions(p.state), { bea: finnShore.guest, finn: finnShore.stand })
    p.act('finishNeighborPlan', 'finn:1', basket)
    p.reload()
    assert.deepEqual(positions(p.state), { bea: finnShore.guest, finn: finnShore.stand })
    assert.deepEqual(positions(p.state, false), { bea: finnShore.guest, finn: undefined })
    assert.equal(p.state.handmade.round, stock - 1)
    assert.equal(p.state.neighbors.bea.memories.at(-1)?.day, 14, 'keep the earlier memory')
    assert.equal(p.state.neighbors.finn.helpReady, true)
    return [p.state.coins, p.state.village.meals, p.state.handmade.round]
  }
  assert.deepEqual(outcome(false), outcome(true))
})

test('two current gatherings each retain their own host; a freshly finished one precedes an arrangement', () => {
  const p = reachFirstFinnLunch(true), { beaBasket, finnShore } = scene.neighborSceneAnchors
  p.act('joinNeighborPlan', 'finn:1'); p.act('serveNeighborPlan', 'finn:1', 'handmade:round')
  p.act('joinNeighborPlan', 'bea:2'); p.act('serveNeighborPlan', 'bea:2', 'dish:orchardTart')
  assert.deepEqual(positions(p.state), { bea: beaBasket.stand, finn: finnShore.stand })
  p.act('finishNeighborPlan', 'finn:1', basket)
  const award = p.state.village.meals
  assert.deepEqual(positions(p.state), { bea: finnShore.guest, finn: finnShore.stand })
  assert.equal(p.state.neighbors.bea.current?.phase, 'arranging')
  p.act('finishNeighborPlan', 'bea:2', basket)
  assert.equal(p.state.village.meals, award, 'two gatherings cannot add an extra shared-supper credit that day')
  assert.deepEqual(positions(p.state), { bea: beaBasket.stand, finn: finnShore.stand })
})
