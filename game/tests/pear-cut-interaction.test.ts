import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import * as THREE from 'three'

let server: Awaited<ReturnType<typeof createServer>>, createHoneyPears: typeof import('../src/honey-pear-view.ts').createHoneyPears
let modelApi: typeof import('../src/honey-cookery-model.ts')
before(async () => {
  server = await createServer({ root: fileURLToPath(new URL('..', import.meta.url)), configFile: false, server: { middlewareMode: true }, appType: 'custom' })
  ;({ createHoneyPears } = await server.ssrLoadModule('/src/honey-pear-view.ts'))
  modelApi = await server.ssrLoadModule('/src/honey-cookery-model.ts')
})
after(async () => { await server.close() })

function kitchen() {
  const scene = new THREE.Scene(), camera = new THREE.OrthographicCamera(0, 1000, 0, 700, .1, 2000)
  camera.position.z = 1000
  const texture = new THREE.Texture(), resources = { geometries: new Set<THREE.BufferGeometry>(), materials: new Set<THREE.Material>(), textures: new Set<THREE.Texture>() }
  const view = createHoneyPears(scene, camera, { skin: texture, flesh: texture, honey: texture, crown: texture }, resources)
  view.layout({ x: 500, y: 420, rx: 240, ry: 120 }, 1000, 700)
  const model = modelApi.createHoneyModel('honeyPear')
  function stroke(from: {x:number;y:number}, to: {x:number;y:number}, steps = 50) {
    modelApi.beginHoneyStroke(model, 'knife', { x: 0, y: 0 })
    const record = (index:number, angle:number, bins:Iterable<number>, offset:number) => modelApi.recordHoneyKnife(model, index, angle, bins, offset)
    view.trace(from, from, record)
    for (let i = 1; i <= steps; i++) {
      view.trace({ x: from.x + (to.x - from.x) * (i - 1) / steps, y: from.y + (to.y - from.y) * (i - 1) / steps }, { x: from.x + (to.x - from.x) * i / steps, y: from.y + (to.y - from.y) * i / steps }, record)
      // Match the gameplay feedback loop: retained kerfs deform the very mesh
      // hit by the next gesture. Completed-half rasterization belongs to native QA.
      if (!model.cuts.size) view.update(model, 1 / 60)
    }
    view.releaseTrace(); modelApi.endHoneyStroke(model)
  }
  return { view, model, stroke, dispose() { for (const group of Object.values(resources)) for (const resource of group) resource.dispose(); texture.dispose() } }
}

test('a full visible cut after an accidental short nick follows the new gesture', () => {
  const k = kitchen()
  try {
    assert.ok(k.view.wholeHit({ x: 375, y: 315 }), 'the retry starts on the visible skin')
    k.stroke({ x: 375, y: 400 }, { x: 403, y: 400 })
    assert.ok(k.model.cutTracks[0].progress > 0 && k.model.cutTracks[0].progress < .5)
    k.stroke({ x: 375, y: 315 }, { x: 375, y: 515 })
    assert.ok(k.model.cuts.has(0), 'a complete vertical retry must not stay locked to the accidental horizontal nick')
  } finally { k.dispose() }
})


test('parallel retries on a new visible line do not inherit unrelated partial bins', () => {
  const k = kitchen()
  try {
    k.stroke({ x: 375, y: 315 }, { x: 375, y: 370 })
    const before = k.model.cutTracks[0].progress
    assert.ok(before > 0 && before < .5)
    k.stroke({ x: 414, y: 340 }, { x: 414, y: 511 })
    assert.ok(k.model.cuts.has(0), 'a deliberate offset retry cuts at the new contact line')
    assert.ok(k.model.cutTracks[0].offset > .08)
  } finally { k.dispose() }
})

test('resuming the existing kerf preserves work while a stationary retry never erases it', () => {
  const k = kitchen()
  try {
    k.stroke({ x: 375, y: 315 }, { x: 375, y: 400 })
    const before = k.model.cutTracks[0].progress
    k.stroke({ x: 414, y: 400 }, { x: 414, y: 400 })
    assert.equal(k.model.cutTracks[0].progress, before)
    k.stroke({ x: 375, y: 390 }, { x: 375, y: 515 })
    assert.ok(k.model.cuts.has(0))
  } finally { k.dispose() }
})

test('a cut crossing the rendered pear works with a single fast move, dense samples, and either direction', () => {
  for (const steps of [1, 3, 150]) for (const reverse of [false, true]) {
    const k = kitchen()
    try {
      const a = { x: 375, y: 300 }, b = { x: 375, y: 525 }
      assert.equal(k.view.wholeHit(a), false)
      k.stroke(reverse ? b : a, reverse ? a : b, steps)
      assert.ok(k.model.cuts.has(0), `steps=${steps}, reverse=${reverse}`)
      assert.equal(k.model.cuts.size, 1, 'the neighbouring pear remains whole')
    } finally { k.dispose() }
  }
})


test('a short perpendicular retry cannot finish a nearly complete abandoned plane', () => {
  const k = kitchen()
  try {
    k.stroke({ x: 375, y: 315 }, { x: 375, y: 450 })
    const before = k.model.cutTracks[0].progress
    assert.ok(before >= .65 && before < .875, `near-complete initial cut: ${before}`)
    k.stroke({ x: 375, y: 490 }, { x: 385, y: 490 })
    assert.equal(k.model.cuts.size, 0, 'the short perpendicular start must not irreversibly complete the old vertical cut')
    assert.equal(k.model.cutTracks[0].progress, before)
  } finally { k.dispose() }
})
