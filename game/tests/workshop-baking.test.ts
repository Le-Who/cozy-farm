import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createSculptedDough } from '../src/workshop-sculpt.ts'
import { prepareDoughBaking, riseDough } from '../src/workshop-baking.ts'
import { doughVolume } from '../src/workshop-geometry.ts'

test('proofing keeps the player silhouette, cut topology and board contact while increasing volume', () => {
  for (const shape of ['round', 'long', 'folded'] as const) {
    const geometry = createSculptedDough({ shape, mass: 1.9, seed: 7 })
    const position = geometry.getAttribute('position')
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i), z = position.getZ(i)
      position.setXYZ(i, x + .16 * Math.sin(z * 2), position.getY(i) * .6, z + .07 * x * x)
    }
    geometry.computeVertexNormals(); geometry.computeBoundingBox()
    const before = doughVolume(geometry), source = new Float32Array(position.array), indices = Array.from(geometry.index!.array)
    const dough = prepareDoughBaking(geometry, shape)
    riseDough(geometry, dough, .5)
    assert.ok(doughVolume(geometry) > before * 1.15)
    riseDough(geometry, dough, 1)
    assert.ok(doughVolume(geometry) > before * 1.3)
    for (let i = 0; i < position.count; i++) {
      assert.equal(position.getX(i), source[i * 3])
      assert.equal(position.getZ(i), source[i * 3 + 2])
    }
    assert.ok(Math.abs(geometry.boundingBox!.min.y) < 1e-6)
    assert.deepEqual(Array.from(geometry.index!.array), indices)
    assert.ok(Array.from(geometry.getAttribute('normal').array).every(Number.isFinite))
    if (shape !== 'folded') assert.ok(Math.max(...dough.scores) > .8)
    const finished = new Float32Array(position.array)
    riseDough(geometry, dough, 1)
    assert.deepEqual(position.array, finished)
    geometry.dispose()
  }
})
