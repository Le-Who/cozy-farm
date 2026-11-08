import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { createSculptedDough, prewarmSculptedDough } from '../src/workshop-sculpt.ts';
import { cutDoughGeometry, doughVolume } from '../src/workshop-geometry.ts';

const shapes = ['raw', 'round', 'long', 'folded'] as const;

function checkClosed(geometry: THREE.BufferGeometry, byPosition = false): void {
  const position = geometry.getAttribute('position'), index = geometry.index!;
  assert.ok(index);
  const edges = new Map<string, number>();
  const vertex = (i: number) => byPosition
    ? [position.getX(i), position.getY(i), position.getZ(i)].map(n => Math.round(n * 1e7)).join(',') : String(i);
  for (let i = 0; i < index.count; i += 3) {
    const points = [index.getX(i), index.getX(i + 1), index.getX(i + 2)].map(vertex);
    if (new Set(points).size < 3) continue;
    for (let j = 0; j < 3; j++) {
      const a = points[j], b = points[(j + 1) % 3];
      if (a === b) continue;
      const key = a < b ? `${a}|${b}` : `${b}|${a}`;
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  }
  const open = [...edges.values()].filter(count => count !== 2);
  assert.equal(open.length, 0, `${open.length} geometric edges are not shared by exactly two faces`);
}

test('every sculpture is indexed, closed, finite and grounded, with skin UVs', () => {
  for (const shape of shapes) {
    const geometry = createSculptedDough({ shape, mass: 1.93471, seed: 12 });
    checkClosed(geometry);
    for (const attribute of Object.values(geometry.attributes)) {
      assert.ok([...attribute.array].every(Number.isFinite), `${shape} has a non-finite attribute`);
    }
    assert.ok(Math.abs(geometry.boundingBox!.min.y) < 1e-7);
    assert.equal(geometry.getAttribute('uv').count, geometry.getAttribute('position').count);
    assert.equal(geometry.groups[0].materialIndex, 0);
    geometry.dispose();
  }
});

test('sculpting, seed variation and stretch preserve requested physical volume', () => {
  for (const shape of shapes) for (const mass of [.18, 1.93471, 3.7]) {
    const geometry = createSculptedDough({ shape, mass, stretch: 1.8, seed: 31 });
    assert.ok(Math.abs(doughVolume(geometry) - mass) < mass * 1e-6, shape);
    geometry.dispose();
  }
  assert.throws(() => createSculptedDough({ shape: 'raw', mass: 0 }), /positive/);
  assert.throws(() => createSculptedDough({ shape: 'raw', mass: Number.NaN }), /finite/);
});

test('sculpture seeds are reproducible and affect the silhouette', () => {
  const a = createSculptedDough({ shape: 'raw', mass: 2, seed: 44 });
  const b = createSculptedDough({ shape: 'raw', mass: 2, seed: 44 });
  const c = createSculptedDough({ shape: 'raw', mass: 2, seed: 45 });
  assert.deepEqual(a.attributes.position.array, b.attributes.position.array);
  assert.notDeepEqual(a.attributes.position.array, c.attributes.position.array);
  [a, b, c].forEach(g => g.dispose());
});

test('cached normalized templates survive mutation and disposal of returned meshes', () => {
  prewarmSculptedDough(91, 'raw');
  const first = createSculptedDough({ shape: 'raw', mass: .5, seed: 91 });
  first.attributes.position.setX(0, 1e6);
  first.index!.setX(0, 0);
  first.dispose();
  const second = createSculptedDough({ shape: 'raw', mass: 2, seed: 91 });
  assert.ok(Math.abs(doughVolume(second) - 2) < 2e-6);
  assert.ok(second.boundingBox!.max.x < 10);
  checkClosed(second);
  second.dispose();
});

test('actual sculpted raw and overlap forms cut into two capped, volume-preserving meshes', () => {
  const planes = [
    new THREE.Plane(new THREE.Vector3(1, 0, 0), 0),
    new THREE.Plane(new THREE.Vector3(0, 0, 1), 0),
    new THREE.Plane(new THREE.Vector3(1, 0, 1).normalize(), -.1),
    new THREE.Plane(new THREE.Vector3(0, 1, 0), -.34),
  ];
  for (const shape of ['raw', 'folded'] as const) for (const plane of planes) {
    const geometry = createSculptedDough({ shape, mass: 1.93471, seed: 12 });
    const halves = cutDoughGeometry(geometry, plane);
    assert.ok(halves, `${shape} did not cut on ${plane.normal.toArray()}`);
    const volume = halves.reduce((sum, half) => sum + doughVolume(half), 0);
    assert.ok(Math.abs(volume - 1.93471) < 1e-4, `${shape} lost volume: ${volume}`);
    for (const half of halves) {
      checkClosed(half, true);
      assert.ok(half.groups.some(group => group.materialIndex === 1 && group.count > 0));
      half.dispose();
    }
    geometry.dispose();
  }
});

test('a real overlapping sculpture remains closed and conserves mass after a repeated cut', () => {
  const geometry = createSculptedDough({ shape: 'folded', mass: 1.93471, seed: 12 });
  const halves = cutDoughGeometry(geometry, new THREE.Plane(new THREE.Vector3(1, 0, 0), 0));
  assert.ok(halves);
  const quarters = cutDoughGeometry(halves[0], new THREE.Plane(new THREE.Vector3(0, 0, 1), 0));
  assert.ok(quarters);
  const pieces = [halves[1], ...quarters];
  assert.ok(Math.abs(pieces.reduce((sum, g) => sum + doughVolume(g), 0) - 1.93471) < 1e-4);
  pieces.forEach(g => { checkClosed(g, true); g.dispose(); });
  halves[0].dispose(); geometry.dispose();
});
