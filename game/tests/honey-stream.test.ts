import test from 'node:test';
import assert from 'node:assert/strict';
import { createHoneyStream, type HoneyStreamUpdate } from '../src/honey-stream.ts';
import { foodMeshVolume } from '../src/food-deformation.ts';
const input: HoneyStreamUpdate = { from: { x: 100, y: 100, z: 21 }, to: { x: 100, y: 230, z: 21 }, velocity: { x: 0, y: 0 }, radius: 5, tail: 0, flow: 1, time: 0 };

test('honey is a continuous closed round strand joining the real nozzle and receiving surface', () => {
  const stream = createHoneyStream(); assert.equal(stream.update(input).visible, true);
  const p = stream.geometry.getAttribute('position'), indices = stream.geometry.index!, count = p.count;
  assert.ok(count <= 200);
  assert.deepEqual([p.getX(count - 2), p.getY(count - 2), p.getZ(count - 2)], [100, 100, 21]);
  assert.deepEqual([p.getX(count - 1), p.getY(count - 1), p.getZ(count - 1)], [100, 230, 21]);
  const z = Array.from({ length: 9 }, (_, j) => p.getZ(10 * 9 + j));
  assert.ok(Math.max(...z) - Math.min(...z) > 8, 'the strand has depth, not just screen-space width');
  assert.ok(foodMeshVolume(p.array, indices.array) > 500);
  const edges = new Map<string, number>(), key = (i: number) => [p.getX(i), p.getY(i), p.getZ(i)].map(v => Math.round(v * 1e4)).join(',');
  for (let i = 0; i < indices.count; i += 3) for (let j = 0; j < 3; j++) {
    const a = key(indices.getX(i + j)), b = key(indices.getX(i + (j + 1) % 3)), edge = a < b ? `${a}/${b}` : `${b}/${a}`;
    edges.set(edge, (edges.get(edge) ?? 0) + 1);
  }
  assert.ok([...edges.values()].every(n => n === 2), 'both endpoints are capped'); stream.dispose();
});

test('motion bows the strand behind the pour while endpoints and lighting seam remain continuous', () => {
  const stream = createHoneyStream(); stream.update(input);
  const p = stream.geometry.getAttribute('position'), centre = () => (p.getX(90) + p.getX(94)) / 2, still = centre();
  stream.update({ ...input, velocity: { x: 400, y: -20 } });
  assert.ok(centre() < still - 4);
  const normals = stream.geometry.getAttribute('normal');
  for (let i = 0; i <= 20; i++) for (let axis = 0; axis < 3; axis++) assert.equal(normals.array[i * 27 + axis], normals.array[(i * 9 + 8) * 3 + axis]);
  assert.ok(p.array.every(Number.isFinite)); stream.dispose();
});

test('a stationary pour advects material down the tube at consecutive 30fps samples',()=>{
 const stream=createHoneyStream(),frames:Float32Array[]=[]
 for(let frame=0;frame<12;frame++){stream.update({...input,time:frame/30});frames.push(new Float32Array(stream.geometry.getAttribute('position').array))}
 for(let frame=1;frame<frames.length;frame++){
  const a=frames[frame-1],b=frames[frame];let moved=0
  for(let i=0;i<a.length-6;i++)moved+=Math.abs(a[i]-b[i])
  assert.ok(moved>1,'material cross-sections advance between adjacent frames')
  assert.deepEqual(Array.from(b.slice(-6)),Array.from(a.slice(-6)),'the attached nozzle and food contact stay fixed')
 }
 stream.dispose()
})

test('release detaches the upper neck and carries its tapered remainder down toward the food', () => {
  const stream = createHoneyStream(); const full = stream.update(input);
  const volume = foodMeshVolume(stream.geometry.getAttribute('position').array, stream.geometry.index!.array);
  const tail = stream.update({ ...input, tail: .65 });
  const p = stream.geometry.getAttribute('position');
  assert.ok(tail.length < full.length * .5);
  assert.ok(p.getY(p.count - 2) > input.from.y + 70, 'the upper end lets go of the nozzle');
  assert.ok(foodMeshVolume(p.array, stream.geometry.index!.array) < volume * .5);
  assert.equal(p.getY(p.count - 1), input.to.y);
  assert.equal(stream.update({ ...input, tail: 1 }).visible, false); stream.dispose();
});

test('buffers are reused and degenerate or large 3D inputs keep finite positions and normals', () => {
  const stream = createHoneyStream(), p = stream.geometry.getAttribute('position'), n = stream.geometry.getAttribute('normal');
  for (const value of [input, { ...input, velocity: { x: 1e6, y: -1e6 } }, { ...input, to: { x: 100, y: 100, z: 400 } }, { ...input, to: input.from }, { ...input, flow: NaN, radius: Infinity }, { ...input, from: { x: NaN, y: Infinity, z: NaN } }]) {
    stream.update(value); assert.equal(stream.geometry.getAttribute('position'), p); assert.equal(stream.geometry.getAttribute('normal'), n);
    assert.ok(p.array.every(Number.isFinite)); assert.ok(n.array.every(Number.isFinite));
  }
  stream.dispose();
});
