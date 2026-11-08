import assert from 'node:assert/strict'
import test from 'node:test'
import * as THREE from 'three'
import { cutDoughGeometry, doughVolume } from '../src/workshop-geometry.ts'

test('a real cut creates two closed pieces and retains dough volume', () => {
  const dough = new THREE.SphereGeometry(1, 48, 30)
  dough.scale(1.3, .55, .9)
  const original = doughVolume(dough)
  const pieces = cutDoughGeometry(dough, new THREE.Plane(new THREE.Vector3(1, 0, .3).normalize(), -.18))!
  assert.equal(pieces.length, 2)
  assert.ok(pieces.every(piece => piece.groups.some(group => group.materialIndex === 1 && group.count > 0)))
  assert.ok(pieces.every(piece => doughVolume(piece) > original * .1))
  assert.ok(Math.abs(pieces.reduce((sum, piece) => sum + doughVolume(piece), 0) - original) < original * .0001)
  const next = cutDoughGeometry(pieces[0], new THREE.Plane(new THREE.Vector3(0, 0, 1), 0))!
  assert.ok(Math.abs(next.reduce((sum, piece) => sum + doughVolume(piece), 0) - doughVolume(pieces[0])) < original * .0001)
  ;[dough, ...pieces, ...next].forEach(piece => piece.dispose())
})

test('a cut outside the dough does not invent a piece', () => {
  const dough = new THREE.SphereGeometry(1, 24, 16)
  assert.equal(cutDoughGeometry(dough, new THREE.Plane(new THREE.Vector3(1, 0, 0), -3)), undefined)
  dough.dispose()
})

function closed(geometry: THREE.BufferGeometry) {
  const positions = geometry.getAttribute('position'), index = geometry.index
  const edges = new Map<string, number>()
  const key = (i: number) => [positions.getX(i), positions.getY(i), positions.getZ(i)].map(v => Math.round(v * 10000)).join(',')
  for (let i = 0; i < (index?.count ?? positions.count); i += 3) {
    const corners = [0, 1, 2].map(j => key(index ? index.getX(i + j) : i + j))
    if (new Set(corners).size < 3) continue
    for (let j = 0; j < 3; j++) {
      const edge = [corners[j], corners[(j + 1) % 3]].sort().join('|')
      edges.set(edge, (edges.get(edge) ?? 0) + 1)
    }
  }
  return [...edges.values()].every(count => count === 2)
}

for (const shape of ['rolled', 'folded', 'kneaded'] as const) {
  test(`cuts stay closed and conserve volume after ${shape}, including reverse and edge cuts`, () => {
    const geometry = new THREE.SphereGeometry(1, 48, 30)
    const positions = geometry.getAttribute('position')
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i)
      positions.setXYZ(i, x * (shape === 'rolled' ? 2.4 : 1.3), (y + 1) * .5 - (shape === 'kneaded' && y > 0 ? Math.exp(-(x * x + z * z) * 8) * .16 : 0), shape === 'folded' ? ((z + Math.sqrt(Math.max(0, 1 - x * x))) * .5 - .38) : z * .9)
    }
    const original = doughVolume(geometry)
    for (const [nx, nz, distance] of [[1, .3, 0], [-1, -.3, 0], [1, 0, -.8], [0, 1, -.1]]) {
      const pieces = cutDoughGeometry(geometry, new THREE.Plane(new THREE.Vector3(nx, 0, nz).normalize(), distance))!
      assert.ok(pieces, 'cut crosses the dough')
      assert.ok(pieces.every(closed), 'both new cut faces close the mesh')
      assert.ok(Math.abs(pieces.reduce((sum, piece) => sum + doughVolume(piece), 0) - original) < original * .0001)
      pieces.forEach(piece => piece.dispose())
    }
    let pieces = [geometry]
    for (let i = 1; i < 6; i++) {
      pieces.sort((a, b) => doughVolume(b) - doughVolume(a))
      const biggest = pieces.shift()!
      biggest.computeBoundingBox()
      const center = biggest.boundingBox!.getCenter(new THREE.Vector3())
      const normal = i % 2 ? new THREE.Vector3(1, 0, .2).normalize() : new THREE.Vector3(.2, 0, 1).normalize()
      const divided = cutDoughGeometry(biggest, new THREE.Plane().setFromNormalAndCoplanarPoint(normal, center))!
      assert.ok(divided.every(closed))
      pieces.push(...divided)
      biggest.dispose()
    }
    assert.equal(pieces.length, 6)
    assert.ok(pieces.every(piece => Array.from(piece.getAttribute('position').array).every(Number.isFinite)))
    assert.ok(Math.abs(pieces.reduce((sum, piece) => sum + doughVolume(piece), 0) - original) < original * .0002)
    pieces.forEach(piece => piece.dispose())
  })
}

test('concave folded sections, disconnected loops and an interior hole get closed caps', () => {
  const outline = new THREE.Shape()
  outline.moveTo(-1, -1); outline.lineTo(1, -1); outline.lineTo(1, 1); outline.lineTo(.3, 1)
  outline.lineTo(.3, 0); outline.lineTo(-.3, 0); outline.lineTo(-.3, 1); outline.lineTo(-1, 1); outline.closePath()
  const concave = new THREE.ExtrudeGeometry(outline, { depth: .6, bevelEnabled: false })
  const ring = new THREE.TorusGeometry(1, .27, 24, 64)
  for (const [geometry, normal, distance] of [[concave, new THREE.Vector3(0, 0, 1), -.3], [ring, new THREE.Vector3(0, 0, 1), 0], [ring, new THREE.Vector3(1, 0, 0), 0]] as const) {
    const pieces = cutDoughGeometry(geometry, new THREE.Plane(normal, distance))!
    assert.ok(pieces)
    assert.ok(pieces.every(closed), 'cap boundary segments pair exactly with the original surface')
    const mass = doughVolume(geometry)
    assert.ok(Math.abs(pieces.reduce((sum, piece) => sum + doughVolume(piece), 0) - mass) < mass * .0001)
    pieces.forEach(piece => piece.dispose())
  }
  concave.dispose(); ring.dispose()
})
