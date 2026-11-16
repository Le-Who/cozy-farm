import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createEarnedFixture, repeatOracle, commands } from './fixture.mjs'
import { GuestBookView } from '../../../src/guest-book-view.ts'

test('119 earned public commands give distinct naturally ripe crops and a real asymmetric gate', () => {
  const { farm, crops, trace } = createEarnedFixture()
  assert.equal(trace.length, 119)
  assert.equal(commands.length, 119)
  assert.deepEqual(crops.map(({ index, crop }) => ({ index, crop })), [{ index: 1, crop: 'carrot' }, { index: 5, crop: 'beetroot' }])
  const before = JSON.stringify(farm), view = new GuestBookView()
  assert.equal(view.current(farm).commands[0].enabled, true)
  view.choose(farm, 'resident', 'finn')
  assert.equal(view.current(farm).commands[0].enabled, false)
  assert.match(view.current(farm).gate, /общую встречу/)
  view.choose(farm, 'activity', 'finnOrchard')
  const selection = view.snapshot()
  view.choose(farm, 'page', 'memories'); assert.ok(view.back())
  assert.deepEqual(view.snapshot(), selection)
  const restored = new GuestBookView()
  assert.ok(restored.restore(selection))
  assert.deepEqual(restored.snapshot(), selection)
  assert.equal(restored.current(farm).commands[0].enabled, false)
  assert.equal(JSON.stringify(farm), before, 'selection/history are not persistent farm writes')
})

test('oracle is two separate invitations and real harvests, not two observations injected into one visit', () => {
  const initial = createEarnedFixture(), before = JSON.stringify(initial.farm)
  const steps = repeatOracle(initial)
  assert.deepEqual(steps.map(({ name, args }) => ({ name, args })), [
    { name: 'inviteNeighborVisit', args: ['beaHarvest'] }, { name: 'workBed', args: [1] },
    { name: 'finishNeighborVisit', args: [1, 'quiet'] },
    { name: 'inviteNeighborVisit', args: ['beaHarvest'] }, { name: 'workBed', args: [5] },
    { name: 'finishNeighborVisit', args: [2, 'curious'] },
  ])
  assert.equal(steps[1].state.neighborVisits.active.observation.subject, 'Морковь')
  assert.equal(steps[4].state.neighborVisits.active.observation.subject, 'Свёкла')
  assert.equal(steps[3].state.neighborVisits.active.observation, null)
  assert.equal(steps[5].state.neighborVisits.active, null)
  assert.equal(JSON.stringify(initial.farm), before, 'oracle does not modify its input fixture')
})

test('fixture is not pulled into the production startup entry', () => {
  const main = fs.readFileSync(new URL('../../../src/main.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(main, /guest-book\/qa|native-repeat|createEarnedFixture/)
})
