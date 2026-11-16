import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as Farm from '../../../src/farm.ts'
import * as Harbour from '../../../src/harbour-economy.ts'
import * as Visits from '../../../src/neighbor-visits.ts'

export const sourceCommit = '6df90d199421164123617b2ec9301eb8e13da254'
export const nativeSourceCommit = '3248e4f51812209194fc672b6211f69913f173cc'
export const commands = JSON.parse(fs.readFileSync(new URL('earned-home-commands.json', import.meta.url), 'utf8'))

/** Earned by public reducers, not a direct grant of stock, gates, crops or memories.
 * This is a deterministic precondition fixture, NOT 119 browser interactions.
 */
export function createEarnedFixture() {
  const reducers = { ...Farm, ...Harbour, ...Visits }
  const farm = Farm.createFarm()
  const trace = []
  for (const { name, args } of commands) {
    assert.equal(typeof reducers[name], 'function', name)
    const result = reducers[name](farm, ...args)
    assert.ok(result.ok, `${name}: ${result.message}`)
    assert.deepEqual(Farm.restoreCurrentFarm(JSON.parse(JSON.stringify(farm))), farm, `restore after ${name}`)
    trace.push({ name, args, day: farm.day, island: farm.island, result: result.message })
  }
  assert.equal(farm.day, 15)
  assert.equal(farm.island, 'home')
  assert.ok(Visits.canInviteNeighbor(farm, 'bea'))
  assert.equal(Visits.canInviteNeighbor(farm, 'finn'), false)
  assert.deepEqual(farm.neighborVisits, { serial: 0, active: null, memories: [] })
  const ripe = farm.beds.flatMap((bed, index) => bed.kind === 'crop' && Farm.getBedStage(bed) === 'ripe'
    ? [{ index, crop: bed.crop, subject: Farm.cropDefinitions[bed.crop].name, bed: structuredClone(bed) }] : [])
  const first = ripe[0], second = ripe.find(bed => bed.crop !== first.crop)
  assert.ok(first && second, 'two different ripe crops must be earned')
  // visit-do focuses the first ripe bed. Require this pair to be reached without
  // any intervening hidden harvest or retargeting hook.
  assert.deepEqual(ripe.slice(0, 2), [first, second])
  return { farm, crops: [first, second], trace }
}

/** Pure expected outcomes for the native runner; never transplanted mid-run. */
export function repeatOracle(initial) {
  const farm = structuredClone(initial.farm), steps = []
  for (const [i, crop] of initial.crops.entries()) {
    const serial = i + 1, reply = i === 0 ? 'quiet' : 'curious'
    for (const [name, args] of [
      ['inviteNeighborVisit', ['beaHarvest']], ['workBed', [crop.index]],
      ['finishNeighborVisit', [serial, reply]],
    ]) {
      const result = (name === 'workBed' ? Farm : Visits)[name](farm, ...args)
      assert.ok(result.ok, `${name}: ${result.message}`)
      assert.deepEqual(Farm.restoreCurrentFarm(JSON.parse(JSON.stringify(farm))), farm)
      steps.push({ name, args, state: structuredClone(farm) })
    }
  }
  assert.equal(farm.neighborVisits.serial, 2)
  assert.equal(farm.neighborVisits.memories.length, 1)
  assert.equal(farm.neighborVisits.memories[0].subject, initial.crops[0].subject)
  assert.equal(farm.neighborVisits.memories[0].reply, 'quiet')
  assert.deepEqual(steps[4].state.neighborVisits.memories, steps[2].state.neighborVisits.memories,
    'second observed crop must not rewrite first completed memory')
  assert.deepEqual(farm.neighborVisits.memories, steps[2].state.neighborVisits.memories,
    'later curious reply must not rewrite first quiet reply or its subject/detail/day/serial')
  return steps
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const output = path.resolve(process.argv[2] ?? 'guest-book-repeat-evidence')
  fs.mkdirSync(output, { recursive: true })
  const fixture = createEarnedFixture(), oracle = repeatOracle(fixture)
  fs.writeFileSync(path.join(output, 'earned-home.json'), JSON.stringify(fixture.farm, null, 2) + '\n')
  fs.writeFileSync(path.join(output, 'public-trace.json'), JSON.stringify(fixture.trace, null, 2) + '\n')
  fs.writeFileSync(path.join(output, 'repeat-oracle.json'), JSON.stringify(oracle, null, 2) + '\n')
  console.log(JSON.stringify({ sourceCommit, commands: commands.length, day: fixture.farm.day,
    eligible: 'bea', locked: 'finn', crops: fixture.crops, oracleSteps: oracle.length }, null, 2))
}
