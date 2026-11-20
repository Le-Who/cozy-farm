import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { runInNewContext } from 'node:vm'
import { createFarm, getTreeAction, treeDefinitions, type FarmState } from '../src/farm.ts'
import { commissionPlayer } from './fixtures/commission-player.ts'

const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8')
const from = main.indexOf('  inspect(target) {'), to = main.indexOf('  activate: activateTarget,', from)
assert.ok(from >= 0 && to > from)
const inspect = stripTypeScriptTypes('({' + main.slice(from,to) + '}).inspect({kind:"tree",index})')
function hint(farm: FarmState, index: number): string {
  return runInNewContext(inspect, {farm, index, treeDefinitions, getTreeAction, updateFieldContext() {}})
}

test('earned Grove plot offers stored tree, not a purchase; restoring is not harvesting', () => {
  const opening = JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json',import.meta.url),'utf8'))
  const p = commissionPlayer(opening.slice(0,15))
  p.visit('home'); p.night()
  p.act('plantTree',1,'apple') // Spend the starter sapling before testing the empty plot.
  const apple = structuredClone(p.state.trees.home[0])!
  assert.equal(apple.fruitReady,2); p.act('storeTree',0); p.visit('grove')
  const before = structuredClone(p.state)
  assert.equal(hint(p.state,1),'Место 2 · К деревьям на хранении')
  assert.deepEqual(p.state,before)
  p.act('returnNurseryTree',1,p.state.treeNursery[0].id)
  assert.deepEqual(p.state.trees.grove[1],apple)
  assert.equal(hint(p.state,1),'Яблоня · Плодов: 2 · Осмотреть')
  for (const key of ['fruit','seeds','saplings','coins'] as const) assert.deepEqual(p.state[key],before[key])
  p.act('pickFruit',1); assert.equal(p.state.fruit.apple,before.fruit.apple+2)
  assert.doesNotMatch(hint(p.state,1),/на хранении|Плодов: 2/)
})

test('no return is suggested for storage-free or occupied plots, including a full orchard', () => {
  const f = createFarm()
  const initial = structuredClone(f)
  assert.equal(hint(f,2),'Место 3 · Посмотреть саженцы')
  assert.deepEqual(f,initial)
  f.treeNursery.push({id:1,tree:{tree:'apple',age:2,fruitReady:2}}); f.treeNurserySerial=1
  f.trees.home = [f.trees.home[0],{tree:'pear',age:0,fruitReady:0},{tree:'apple',age:2,fruitReady:0}]
  const full = structuredClone(f)
  for(const i of [0,1,2]) assert.doesNotMatch(hint(f,i),/на хранении|Посмотреть саженцы/)
  assert.deepEqual(f,full)
  assert.equal(hint(f,3),'')
  f.island = 'cape'; assert.equal(hint(f,0),'')
})
