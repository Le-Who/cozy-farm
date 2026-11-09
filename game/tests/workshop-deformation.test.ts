import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as THREE from 'three'
import { latchDoughHandle, shapeDoughHandle } from '../src/workshop-deformation.ts'
import { createSculptedDough } from '../src/workshop-sculpt.ts'
import { cutDoughGeometry, doughVolume } from '../src/workshop-geometry.ts'

const board = new THREE.Box3(new THREE.Vector3(-3.4, 0, -2.3), new THREE.Vector3(3.4, 5, 2.3))
function bounds(g: THREE.BufferGeometry) { g.computeBoundingBox(); return g.boundingBox!.clone() }

test('a held hand press visibly flattens and spreads the actual material while preserving its volume', () => {
  const g = createSculptedDough({ shape: 'raw', mass: 1.93471, seed: 12 }), before = bounds(g).getSize(new THREE.Vector3())
  const handle = latchDoughHandle(g, 0, 0)
  shapeDoughHandle(g, handle, 0, 0, 2.2, 'knead', board)
  const after = bounds(g).getSize(new THREE.Vector3())
  assert.ok(after.y < before.y * .72, `height ${before.y} -> ${after.y}`)
  assert.ok(after.x > before.x * 1.12 && after.z > before.z * 1.12)
  assert.ok(Math.abs(doughVolume(g) - handle.volume) < 1e-5)
  g.dispose()
})

test('latched material follows long pulls past the old limit and creates an asymmetric result', () => {
  const g = createSculptedDough({ shape: 'raw', mass: 1.93471, seed: 12 })
  const handle = latchDoughHandle(g, .6, 0), before = bounds(g)
  shapeDoughHandle(g, handle, 2.5, .4, .2, 'knead', board)
  const after = bounds(g)
  assert.ok(after.max.x > before.max.x + 1.3)
  assert.ok(after.min.x > before.min.x && after.min.x < after.max.x - 1)
  assert.ok(Math.abs(doughVolume(g) - handle.volume) < 1e-5)
  g.dispose()
})

test('repeated kneading, cupping, folding and rolling stay finite and on the board; real cuts conserve volume', () => {
  const g = createSculptedDough({ shape: 'raw', mass: 1.93471, seed: 12 })
  for (let pass = 0; pass < 16; pass++) {
    const box = bounds(g), center = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3())
    const h = latchDoughHandle(g, center.x + Math.sin(pass * 2) * size.x * .2, center.z + Math.cos(pass) * size.z * .2)
    shapeDoughHandle(g, h, Math.sin(pass) * .6, Math.cos(pass) * .4, .25, (['knead', 'cup', 'fold', 'roll'] as const)[pass % 4], board)
    assert.ok([...g.attributes.position.array].every(Number.isFinite))
    const b = bounds(g)
    assert.ok(b.min.x >= board.min.x - 1e-5 && b.max.x <= board.max.x + 1e-5)
    assert.ok(b.min.z >= board.min.z - 1e-5 && b.max.z <= board.max.z + 1e-5)
    assert.ok(Math.abs(doughVolume(g) - h.volume) < 1e-5)
  }
  const center = bounds(g).getCenter(new THREE.Vector3()), halves = cutDoughGeometry(g, new THREE.Plane(new THREE.Vector3(1, 0, 0), -center.x))
  assert.ok(halves, 'deformed real mesh remains cuttable')
  assert.ok(Math.abs(halves.reduce((sum, half) => sum + doughVolume(half), 0) - doughVolume(g)) < 1e-4)
  halves.forEach(half => { assert.ok(half.groups.some(group => group.materialIndex === 1)); half.dispose() })
  g.dispose()
})

test('a latched press is independent of event/frame count and distinct gestures keep distinct geometry', () => {
  const a = createSculptedDough({ shape: 'raw', mass: .45, seed: 12 }), b = a.clone(), c = a.clone()
  const ha = latchDoughHandle(a, .2, 0), hb = latchDoughHandle(b, .2, 0), hc = latchDoughHandle(c, -.2, 0)
  for (let i = 1; i <= 120; i++) shapeDoughHandle(a, ha, i / 120 * .7, 0, i / 120, 'knead', board)
  shapeDoughHandle(b, hb, .7, 0, 1, 'knead', board)
  shapeDoughHandle(c, hc, -.7, .1, 1, 'knead', board)
  assert.deepEqual(a.attributes.position.array, b.attributes.position.array)
  assert.notDeepEqual(a.attributes.position.array, c.attributes.position.array)
  ;[a, b, c].forEach(g => g.dispose())
})

test('sustained rolling of a narrow cut section spreads material without inflating untouched tips', () => {
  const source=createSculptedDough({shape:'raw',mass:1.93471,seed:12})
  const halves=cutDoughGeometry(source,new THREE.Plane(new THREE.Vector3(1,0,0),-.55))!
  assert.ok(halves)
  const section=halves[0],initialHeight=bounds(section).getSize(new THREE.Vector3()).y,mass=doughVolume(section)
  for(let frame=0;frame<180;frame++){
    const center=bounds(section).getCenter(new THREE.Vector3())
    const handle=latchDoughHandle(section,center.x+.12,center.z+.2)
    shapeDoughHandle(section,handle,0,0,.008,'roll',board)
    assert.ok(bounds(section).getSize(new THREE.Vector3()).y<=initialHeight*1.003)
  }
  assert.ok(Math.abs(doughVolume(section)-mass)<1e-5)
  ;[source,...halves].forEach(g=>g.dispose())
})

test('many separate rolling strokes keep a real dough thickness instead of filling the entire board', () => {
  const g=createSculptedDough({shape:'round',mass:1.93471,seed:12}),mass=doughVolume(g)
  for(let stroke=0;stroke<240;stroke++){
    const box=bounds(g),center=box.getCenter(new THREE.Vector3())
    const handle=latchDoughHandle(g,center.x+Math.sin(stroke)*.4,center.z+Math.cos(stroke)*.3)
    shapeDoughHandle(g,handle,0,0,.16,'roll',board)
  }
  const box=bounds(g),size=box.getSize(new THREE.Vector3())
  assert.ok(size.y>=Math.cbrt(mass)*.239,`dough thickness remains ${size.y}`)
  assert.ok(size.x<6.2&&size.z<4.4,'a usable border stays around the portion')
  assert.ok(Math.abs(doughVolume(g)-mass)<1e-5)
  const beforePull=new Float32Array(g.attributes.position.array),center=box.getCenter(new THREE.Vector3())
  const hand=latchDoughHandle(g,center.x+size.x*.22,center.z)
  shapeDoughHandle(g,hand,.55,.15,.1,'knead',board)
  assert.notDeepEqual(g.attributes.position.array,beforePull,'a fully rolled portion can still be shaped by hand')
  assert.ok(Math.abs(doughVolume(g)-mass)<1e-5)
  g.dispose()
})

test('repeated cupping gathers the portion without growing a tower or replacing its mesh', () => {
  const g=createSculptedDough({shape:'round',mass:1.93471,seed:12}),mass=doughVolume(g),vertices=g.attributes.position.count
  for(let stroke=0;stroke<160;stroke++){
    const center=bounds(g).getCenter(new THREE.Vector3()),handle=latchDoughHandle(g,center.x,center.z)
    shapeDoughHandle(g,handle,0,0,.5,'cup',board)
  }
  assert.ok(bounds(g).getSize(new THREE.Vector3()).y<=Math.cbrt(mass)*1.051)
  assert.equal(g.attributes.position.count,vertices)
  assert.ok(Math.abs(doughVolume(g)-mass)<1e-5)
  g.dispose()
})
