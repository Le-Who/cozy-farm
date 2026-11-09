import test from 'node:test'
import assert from 'node:assert/strict'
import { createArrangementPhysics, type ArrangementPiece } from '../src/arrangement-physics.ts'

const piece = (id: string, x: number, z: number, slot: ArrangementPiece['slot'] = 'egg'): ArrangementPiece => ({ id, slot, position: { x, y: .5, z }, half: { x: .17, y: .22, z: .17 }, mass: .12 })
const tick = (physics: Awaited<ReturnType<typeof createArrangementPhysics>>, seconds: number) => { for (let i = 0; i < seconds * 120; i++) physics.step(1 / 120) }

test('physical packing waits for release and settling; separate eggs occupy real space', async () => {
  const physics = await createArrangementPhysics('eggs', [piece('a', -.45, 0), piece('b', .45, 0), piece('c', 0, .4)])
  try {
    assert.equal(physics.result(), undefined)
    tick(physics, 3)
    assert.equal(physics.result()?.length, 3)
    const poses = physics.poses()
    for (let i = 0; i < poses.length; i++) for (let j = i + 1; j < poses.length; j++) assert.ok(Math.hypot(poses[i].position.x - poses[j].position.x, poses[i].position.z - poses[j].position.z) > .3)
    const a = poses[0]
    assert.equal(physics.grab('a', { ...a.position, y: a.position.y + .20 }), true)
    assert.equal(physics.result(), undefined)
    physics.move({ x: -.45, y: 1.2, z: 0 }); tick(physics, .8)
    assert.ok(physics.poses()[0].position.y > .8, 'a real grip joint lifts the body')
    physics.release(); assert.equal(physics.result(), undefined)
    tick(physics, 4); assert.equal(physics.result()?.length, 3)
  } finally { physics.dispose() }
})

test('draft objects outside the basket cannot finish; dragging carries a body into it', async () => {
  const physics = await createArrangementPhysics('eggs', [piece('egg', 0, -1.6)])
  try {
    tick(physics, 2); assert.equal(physics.result(), undefined)
    const start = physics.poses()[0].position
    physics.grab('egg', { ...start, y: start.y + .18 })
    physics.move({ x: 0, y: 1.3, z: 0 }); tick(physics, 1.5)
    assert.ok(Math.abs(physics.poses()[0].position.z) < .28, 'the gripped top follows the cursor while the volume hangs below it')
    physics.release(); tick(physics, 4)
    assert.equal(physics.result()?.length, 1)
    assert.ok(Math.abs(physics.result()![0].x) <= 1 && Math.abs(physics.result()![0].y) <= 1)
  } finally { physics.dispose(); physics.dispose() }
})

test('two independent physics scenes never share bodies or disposal', async () => {
  const a = await createArrangementPhysics('table', [piece('food', 0, 0, 'food')])
  const b = await createArrangementPhysics('crate', [piece('egg', .2, 0)])
  tick(a, 2); tick(b, 2); a.dispose()
  try { tick(b, 1); assert.equal(b.result()?.length, 1) } finally { b.dispose() }
})

test('mouse carries an egg at its original grip height and restores contacts on release', async () => {
  const sim=await createArrangementPhysics('eggs',[piece('a',-.9,1.3)]);
  try {
    tick(sim,2);
    const before=sim.poses()[0].position;
    assert.ok(sim.takePointer('a')); tick(sim,.5);
    assert.deepEqual(sim.poses()[0].position,before);
    sim.followPointer({x:.12,y:before.y,z:.05}); tick(sim,.5);
    assert.ok(Math.abs(sim.poses()[0].position.y-before.y)<.003);
    assert.equal(sim.progress()[0].placed,false);
    sim.release();tick(sim,2);
    assert.ok(sim.progress()[0].placed);
    assert.equal(sim.result()?.length,1);
  } finally {sim.dispose()}
})
