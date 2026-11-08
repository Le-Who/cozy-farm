import test from 'node:test';
import assert from 'node:assert/strict';
import { createFoodDeformation, foodMeshVolume } from '../src/food-deformation.ts';

const positions = (body: ReturnType<typeof createFoodDeformation>) => body.geometry.getAttribute('position').array as Float32Array;
const press = { point: { x: .15, y: -.1 }, delta: { x: 0, y: 0 }, pressure: .9 };
const maxDifference = (a: ArrayLike<number>, b: ArrayLike<number>) => Math.max(...Array.from(a, (value, i) => Math.abs(value - b[i])));
function assertSolid(body: ReturnType<typeof createFoodDeformation>) {
  const p = positions(body), index = body.geometry.index!.array;
  assert.ok(p.every(Number.isFinite));
  assert.ok(body.geometry.getAttribute('normal').array.every(Number.isFinite));
  assert.ok(Math.abs(foodMeshVolume(p, index) / body.volume - 1) < 2e-6, 'enclosed volume survives deformation');
  for (let i = 1; i < p.length; i += 3) assert.ok(p[i] >= 0, 'food stays on or above its support');
}

test('biscuit starts as a closed solid with a real top, sidewall and supported underside', () => {
  const body = createFoodDeformation(), p = positions(body), indices = body.geometry.index!.array;
  const edges = new Map<string, number>();
  for (let i = 0; i < indices.length; i += 3) for (let j = 0; j < 3; j++) {
    const a = indices[i + j], b = indices[i + (j + 1) % 3], key = a < b ? `${a}:${b}` : `${b}:${a}`;
    edges.set(key, (edges.get(key) ?? 0) + 1);
  }
  assert.ok([...edges.values()].every(count => count === 2), 'every edge has two incident faces');
  assert.ok(body.volume > .04 && body.volume < .2);
  assert.ok(Math.max(...p.filter((_, i) => i % 3 === 1)) > .17);
  assert.ok(body.geometry.getAttribute('position').count <= 400, 'rounded shoulder stays within the small phone mesh budget');
  assertSolid(body); body.geometry.dispose();
});

test('repeated local strokes keep a broad worked mark without isolated pits', () => {
  const body = createFoodDeformation(), initial = positions(body).slice();
  for (let i = 0; i < 45; i++) {
    body.applyStroke({ point: { x: .18 + Math.sin(i * .3) * .10, y: -.1 }, delta: { x: .012, y: .005 }, pressure: 1, radius: .20 });
    body.update(1 / 60);
  }
  body.release(); for (let i = 0; i < 90; i++) body.update(1 / 60);
  const p = positions(body), index = body.geometry.index!.array, adjacent = Array.from({ length: p.length / 3 }, () => new Set<number>());
  for (let i = 0; i < index.length; i += 3) for (let j = 0; j < 3; j++) {
    const a = index[i + j], b = index[i + (j + 1) % 3];
    if (initial[a * 3 + 1] < .045 || initial[b * 3 + 1] < .045) continue;
    adjacent[a].add(b); adjacent[b].add(a);
  }
  let sharpest = 0;
  adjacent.forEach((neighbours, vertex) => {
    if (!neighbours.size) return;
    let average = 0;
    for (const next of neighbours) average += p[next * 3 + 1] - initial[next * 3 + 1];
    sharpest = Math.max(sharpest, Math.abs(p[vertex * 3 + 1] - initial[vertex * 3 + 1] - average / neighbours.size));
  });
  assert.ok(initial[1] - p[1] > .015, 'fairing retains a visible worked indentation');
  assert.ok(sharpest < .018, 'neighbouring top vertices share the strain rather than forming a pit');
  assertSolid(body); body.geometry.dispose();
});

test('pressure has inertia, springs back on release and retains a plastic indentation', () => {
  const body = createFoodDeformation(), initial = positions(body).slice(), originalTop = initial[1];
  body.applyStroke(press);
  assert.deepEqual(positions(body), initial, 'input changes force/rest shape, never teleports the visible food');
  body.update(1 / 120); const first = positions(body)[1];
  for (let i = 0; i < 60; i++) body.update(1 / 60);
  const pressed = positions(body)[1];
  assert.ok(first < originalTop && first > pressed);
  body.release();
  for (let i = 0; i < 180; i++) body.update(1 / 60);
  const recovered = positions(body)[1];
  assert.ok(recovered > pressed + .015, 'elastic pressure recovers visibly');
  assert.ok(recovered < originalTop - .015, 'worked dough retains a permanent shape');
  assertSolid(body); body.geometry.dispose();
});

test('drag transports material gradually and the worked volume survives baking and restore', () => {
  const body = createFoodDeformation(), initial = positions(body).slice();
  for (let i = 0; i < 20; i++) {
    body.applyStroke({ point: { x: .25 + i * .015, y: .1 }, delta: { x: .035, y: -.015 }, pressure: .8 });
    body.update(1 / 60);
  }
  body.release(); for (let i = 0; i < 60; i++) body.update(1 / 60);
  assert.ok(maxDifference(initial, positions(body)) > .025);
  body.setBaked(1); const baked = positions(body).slice(), snapshot = body.snapshot();
  body.applyStroke({ ...press, delta: { x: .5, y: .5 } });
  for (let i = 0; i < 120; i++) body.update(1 / 60);
  assert.ok(maxDifference(baked, positions(body)) < .00001, 'baking keeps the actual worked silhouette');
  const restored = createFoodDeformation(); assert.equal(restored.restore(snapshot), true);
  assert.ok(maxDifference(positions(body), positions(restored)) < .00001);
  assertSolid(body); assertSolid(restored); body.geometry.dispose(); restored.geometry.dispose();
});

test('a long heavy press cannot collapse volume or create invalid vertices', () => {
  const body = createFoodDeformation(); body.applyStroke({ ...press, pressure: 1 });
  for (let i = 0; i < 1800; i++) body.update(1 / 30);
  assertSolid(body);
  const p = positions(body);
  assert.ok(p[1] > .18 * .2, 'the pressed top retains physical thickness');
  assert.ok(Math.max(...p.filter((_, i) => i % 3 === 0).map(Math.abs)) < 1.3, 'displaced mass spreads within a bounded footprint');
  body.geometry.dispose();
});

test('bounded substeps handle phone frame stalls and ordinary frame rates agree', () => {
  const simulate = (dt: number, count: number) => {
    const body = createFoodDeformation(); body.applyStroke(press);
    for (let i = 0; i < count; i++) body.update(dt);
    body.release(); for (let i = 0; i < count; i++) body.update(dt);
    return body;
  };
  const fast = simulate(1 / 120, 120), slow = simulate(1 / 30, 30);
  assert.ok(maxDifference(positions(fast), positions(slow)) < .012, 'frame cadence does not change the worked shape');
  const bounded = createFoodDeformation(), stalled = createFoodDeformation();
  bounded.applyStroke(press); stalled.applyStroke(press);
  assert.equal(stalled.update(100000).steps, 8); bounded.update(1 / 15);
  assert.deepEqual(positions(stalled), positions(bounded), 'a stalled frame has an explicit fixed work budget');
  stalled.applyStroke({ point: { x: NaN, y: Infinity }, delta: { x: Infinity, y: NaN }, pressure: Infinity });
  stalled.update(NaN); stalled.update(1 / 60); assertSolid(stalled);
  for (const body of [fast, slow, bounded, stalled]) body.geometry.dispose();
});
