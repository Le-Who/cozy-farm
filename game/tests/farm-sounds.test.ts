import test from 'node:test'
import assert from 'node:assert/strict'
import { bedWorkSound, orchardPickSound } from '../src/farm-sounds.ts'
import { cropDefinitions, cropIds, type Bed } from '../src/farm.ts'

test('harvest sound follows the material of every planted crop', () => {
  const expected = [
    'field.root-pull', 'field.leaf-pick', 'field.root-pull', 'field.firm-pick', 'field.pumpkin',
    'field.grain-pick', 'field.leaf-pick', 'field.berry-pick', 'field.berry-pick', 'field.berry-pick',
  ]
  assert.deepEqual(cropIds.map(crop => bedWorkSound({ kind: 'crop', crop, growth: cropDefinitions[crop].days, watered: false }, 'harvest')), expected)
})

test('watering exposed seedlings differs from watering developed leaves', () => {
  const seedling: Bed = { kind: 'crop', crop: 'cabbage', growth: 0, watered: false }
  const leaves: Bed = { ...seedling, growth: 1 }
  assert.equal(bedWorkSound(seedling, 'water'), 'field.can-soil')
  assert.equal(bedWorkSound(leaves, 'water'), 'field.can-pour')
  assert.equal(bedWorkSound(seedling, 'wait'), undefined)
  assert.equal(bedWorkSound({kind:'empty'}, 'till'), 'field.till')
  assert.equal(bedWorkSound({kind:'tilled'}, 'plant'), 'field.seed')
})

test('soft orchard fruit is handled separately from firm apples and pears', () => {
  assert.equal(orchardPickSound('apple'), 'orchard.firm-pick')
  assert.equal(orchardPickSound('pear'), 'orchard.firm-pick')
  assert.equal(orchardPickSound('peach'), 'orchard.soft-pick')
})
