import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3, type BufferGeometry } from 'three';
import { createPearCut } from '../src/pear-cut.ts';
import { doughVolume } from '../src/workshop-geometry.ts';

function assertClosed(geometry: BufferGeometry): void {
  const p = geometry.getAttribute('position'), index = geometry.index!, edges = new Map<string, number>();
  const key = (i: number) => [p.getX(i), p.getY(i), p.getZ(i)].map(v => Math.round(v * 1e6)).join(',');
  for (let i = 0; i < index.count; i += 3) for (let j = 0; j < 3; j++) {
    const a = key(index.getX(i + j)), b = key(index.getX(i + (j + 1) % 3));
    const edge = a < b ? `${a}/${b}` : `${b}/${a}`; edges.set(edge, (edges.get(edge) ?? 0) + 1);
  }
  assert.ok([...edges.values()].every(count => count === 2), 'skin and cut flesh form a watertight solid');
}

test('pear is a deterministic closed broad bulb with a narrower neck and worktop support', () => {
  const a = createPearCut(), b = createPearCut(), p = a.wholeGeometry.getAttribute('position');
  assert.deepEqual(p.array, b.wholeGeometry.getAttribute('position').array);
  assert.ok(doughVolume(a.wholeGeometry) > .05);
  let neck = 0, bulb = 0;
  for (let i = 0; i < p.count; i++) {
    assert.ok(p.getY(i) >= 0);
    if (p.getZ(i) > .2) neck = Math.max(neck, Math.abs(p.getX(i)));
    if (p.getZ(i) < -.08) bulb = Math.max(bulb, Math.abs(p.getX(i)));
  }
  assert.ok(bulb > neck * 1.5, 'pear outline keeps its intentional broad shoulder and neck');
  assert.ok(p.count < 800); a.dispose(); b.dispose();
});

test('covered knife bins create a persistent directional physical kerf before separation', () => {
  const pear = createPearCut(), p = pear.wholeGeometry.getAttribute('position'), before = p.array.slice();
  pear.setKerf({ angle: Math.PI / 2, bins: [8, 9, 10, 11] });
  let changed = 0, minZ = Infinity, maxZ = -Infinity, deepest = 0;
  for (let i = 0; i < p.count; i++) if (before[i * 3 + 1] - p.getY(i) > .0001) {
    changed++;
    minZ = Math.min(minZ, p.getZ(i)); maxZ = Math.max(maxZ, p.getZ(i)); deepest = Math.max(deepest, before[i * 3 + 1] - p.getY(i));
    assert.ok(Math.abs(p.getX(i)) < .07, 'the groove lies under the actual blade plane');
    assert.ok(p.getZ(i) < .03, 'unvisited neck bins remain whole');
  }
  assert.ok(changed > 1 && maxZ - minZ > .08 && deepest > .005, 'a real incision spans the visited material');
  const partial = p.array.slice(); pear.setKerf({ angle: Math.PI / 2, bins: [8, 9, 10, 11] });
  assert.deepEqual(p.array, partial); pear.dispose();
});

test('the broad butt rounds into its tip rather than closing as a cone', () => {
  const pear = createPearCut(), p = pear.wholeGeometry.getAttribute('position');
  const tip = p.count - 1, near = 1 + 22 * 32, next = 1 + 21 * 32;
  const axialRatio = (p.getZ(next) - p.getZ(tip)) / (p.getZ(near) - p.getZ(tip));
  const radialRatio = Math.abs(p.getX(next) / p.getX(near));
  assert.ok(radialRatio > Math.sqrt(axialRatio) * .8 && radialRatio < Math.sqrt(axialRatio) * 1.2, 'elliptical curvature stays broad close to the end');
  assertClosed(pear.wholeGeometry); pear.dispose();
});

test('arbitrary actual blade directions produce two capped complementary solid halves', () => {
  for (const angle of [0, Math.PI / 2, .43, -1.1]) {
    const pear = createPearCut(), full = doughVolume(pear.wholeGeometry);
    const cut = pear.cut(angle); assert.ok(cut, `cut direction ${angle} must work`);
    assert.ok(Math.abs(cut.normal.dot(cut.tangent)) < 1e-10);
    assert.ok(cut.tangent.distanceTo(new Vector3(Math.cos(angle), 0, -Math.sin(angle))) < 1e-10);
    assert.ok(Math.abs(cut.halves.reduce((sum, half) => sum + doughVolume(half.geometry), 0) / full - 1) < .00002);
    for (const half of cut.halves) {
      assertClosed(half.geometry);
      const p = half.geometry.getAttribute('position'), uv = half.geometry.getAttribute('uv'), index = half.geometry.index!;
      assert.ok(p.array.every(Number.isFinite)); assert.ok(uv.array.every(Number.isFinite));
      const caps = half.geometry.groups.filter(group => group.materialIndex === 1);
      assert.ok(caps.length && caps[0].count > 6, 'the newly exposed flesh is a real closed cap');
      for (const group of caps) for (let j = group.start; j < group.start + group.count; j++) {
        const i = index.getX(j), v = new Vector3(p.getX(i), p.getY(i), p.getZ(i));
        assert.ok(Math.abs(v.clone().sub(cut.center).dot(cut.normal)) < 1e-6);
        assert.ok(uv.getX(i) >= -.00001 && uv.getX(i) <= 1.00001 && uv.getY(i) >= -.00001 && uv.getY(i) <= 1.00001);
      }
    }
    assert.equal(pear.cut(angle + 1), cut, 'completed halves retain the first real cut, never reroll');
    pear.dispose();
  }
});

test('a longitudinal flesh face has two curved pear sides and a raised neck', () => {
  const pear = createPearCut(), cut = pear.cut(Math.PI / 2)!;
  assert.ok(cut);
  assert.ok(pear.neckAnchor.y > .15 && pear.neckAnchor.z > .4);
  for (const half of cut.halves) {
    const p = half.geometry.getAttribute('position'), index = half.geometry.index!;
    const neck: number[] = [], bulb: number[] = [];
    for (const group of half.geometry.groups) if (group.materialIndex === 1) for (let j = group.start; j < group.start + group.count; j++) {
      const i = index.getX(j), z = p.getZ(i);
      if (z > .20 && z < .35) neck.push(p.getY(i));
      if (z > -.22 && z < -.05) bulb.push(p.getY(i));
    }
    assert.ok(neck.length && bulb.length);
    assert.ok(Math.min(...neck) > Math.min(...bulb) + .03, 'lower flesh outline curves upward into the neck');
    assert.ok(Math.max(...neck) < Math.max(...bulb) - .03, 'upper flesh outline also narrows into the neck');
    assert.ok(Math.abs((Math.min(...neck) + Math.max(...neck)) / 2 - pear.neckAnchor.y) < .00001, 'the neck closes around the central fruit axis');
  }
  pear.dispose();
});

test('halves start seamlessly, roll their flesh upward and separate along the cut normal above the worktop', () => {
  const pear = createPearCut(), cut = pear.cut(.71)!; assert.ok(cut);
  const initial = cut.pose(0), open = cut.pose(1);
  for (let h = 0; h < 2; h++) {
    assert.ok(initial[h].position.length() === 0);
    assert.ok(Math.hypot(initial[h].quaternion.x, initial[h].quaternion.y, initial[h].quaternion.z) === 0 && initial[h].quaternion.w === 1);
    const capNormal = cut.normal.clone().multiplyScalar(-cut.halves[h].side).applyQuaternion(open[h].quaternion);
    assert.ok(capNormal.y > .95, 'the freshly cut flesh faces upward after rolling');
    const p = cut.halves[h].geometry.getAttribute('position');
    let support = Infinity;
    for (let i = 0; i < p.count; i++) {
      const v = new Vector3(p.getX(i), p.getY(i), p.getZ(i)).applyQuaternion(open[h].quaternion).add(open[h].position);
      assert.ok(v.y >= -1e-6, 'rolling uses the outer supported edge, not an underground hinge');
      support = Math.min(support, v.y);
    }
    assert.ok(Math.abs(support) < 1e-6, 'each rolled half rests on the worktop instead of floating');
  }
  assert.ok(open[0].position.clone().sub(open[1].position).dot(cut.normal) > .1);
  pear.dispose();
});

test('offset cuts keep the real plane and partial kerfs do not destroy the closed-cut volume', () => {
  const pear = createPearCut(); pear.setKerf({ angle: .25, progress: .8, offset: .04 });
  const cut = pear.cut(.25, .04); assert.ok(cut);
  assert.ok(Math.abs(cut.center.dot(cut.normal) - .04) < 1e-8);
  assert.ok(Math.abs(cut.halves.reduce((sum, half) => sum + doughVolume(half.geometry), 0) / cut.volume - 1) < .00002);
  pear.dispose();
});
