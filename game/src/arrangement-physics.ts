import type * as Rapier from '@dimforge/rapier3d-compat'
import { loadPhysics } from './physics-runtime.ts'

export type ArrangementMode = 'table' | 'basket' | 'eggs' | 'crate'
export type Point3 = { x: number; y: number; z: number }
export type Rotation4 = Point3 & { w: number }
export type ArrangementPiece = {
  id: string; slot: 'food' | 'cup' | 'flowers' | 'egg';
  position: Point3; half: Point3; vertices?: Float32Array; mass: number
}
export type ArrangementPose = { id: string; position: Point3; rotation: Rotation4; speed: number }
export type ArrangementImpact = { id: string; x: number; z: number; strength: number }
export const arrangementArea = { rx: 1.52, rz: .92, floor: .10 }

type Body = Rapier.RigidBody
type PieceBody = { definition: ArrangementPiece; body: Body; previousY: number }

export async function createArrangementPhysics(mode: ArrangementMode, pieces: readonly ArrangementPiece[]) {
  const R = await loadPhysics()
  const world = new R.World({ x: 0, y: -9.81, z: 0 })
  world.timestep = 1 / 120
  const target = { ...arrangementArea, rz: mode === 'crate' ? .38 : arrangementArea.rz }
  const container = mode !== 'table'
  const floor = world.createRigidBody(R.RigidBodyDesc.fixed())
  world.createCollider(R.ColliderDesc.cuboid(3.6, .08, 2.25).setTranslation(0, -.08, 0).setFriction(.72), floor)
  const support = new Float32Array(32 * 2 * 3)
  for (let i = 0; i < 32; i++) for (let side = 0; side < 2; side++) {
    const k = (i * 2 + side) * 3, angle = i / 32 * Math.PI * 2
    support[k] = Math.cos(angle) * target.rx; support[k + 1] = side ? .10 : 0; support[k + 2] = Math.sin(angle) * target.rz
  }
  const matCollider = R.ColliderDesc.convexHull(support)
  if (!matCollider) throw new Error('Invalid support geometry')
  world.createCollider(matCollider.setFriction(.85), floor)
  // The linen and basket bottom share a stable physical support plane.
  if (container) {
    world.createCollider(R.ColliderDesc.cuboid(target.rx, .05, target.rz).setTranslation(0, .05, 0).setFriction(.85), floor)
    if (mode === 'crate') {
      for (const side of [-1, 1]) {
        world.createCollider(R.ColliderDesc.cuboid(target.rx, .18, .035).setTranslation(0, .24, side * target.rz), floor)
        world.createCollider(R.ColliderDesc.cuboid(.035, .18, target.rz).setTranslation(side * target.rx, .24, 0), floor)
      }
    } else for (let i = 0; i < 36; i++) {
      const a = i / 36 * Math.PI * 2, next = (i + 1) / 36 * Math.PI * 2
      const x = Math.cos(a) * target.rx, z = Math.sin(a) * target.rz
      const nx = Math.cos(next) * target.rx, nz = Math.sin(next) * target.rz
      const rotation = { x: 0, y: Math.sin(-Math.atan2(nz - z, nx - x) / 2), z: 0, w: Math.cos(-Math.atan2(nz - z, nx - x) / 2) }
      world.createCollider(R.ColliderDesc.cuboid(Math.hypot(nx - x, nz - z) * .56, .23, .055)
        .setTranslation((x + nx) / 2, .30, (z + nz) / 2).setRotation(rotation).setFriction(.72).setRestitution(.08), floor)
    }
  }
  const bodies = new Map<string, PieceBody>()
  for (const piece of pieces) {
    const desc = R.RigidBodyDesc.dynamic().setTranslation(piece.position.x, piece.position.y, piece.position.z)
      .setLinearDamping(1.6).setAngularDamping(2.5).setCcdEnabled(true).setAdditionalSolverIterations(4)
    const body = world.createRigidBody(desc)
    // Keep serving dishes level as a player carries them. Eggs remain free to roll and tumble.
    if (piece.slot !== 'egg') body.setEnabledRotations(false, true, false, true)
    const shape = piece.vertices?.length ? R.ColliderDesc.convexHull(piece.vertices) : null
    const collider = (shape ?? R.ColliderDesc.roundCuboid(piece.half.x * .87, piece.half.y * .87, piece.half.z * .87, Math.min(piece.half.x, piece.half.y, piece.half.z) * .13))
      .setMass(piece.mass).setFriction(.82).setRestitution(.13)
    world.createCollider(collider, body)
    bodies.set(piece.id, { definition: piece, body, previousY: 0 })
  }
  const handle = world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 1.2, 0))
  let held: PieceBody | undefined, joint: Rapier.ImpulseJoint | undefined
  let cursor: Point3 = { x: 0, y: 1.2, z: 0 }, anchor: Point3 = { ...cursor }
  let accumulator = 0, settledFor = 0, disposed = false
  const impacts: ArrangementImpact[] = []
  const poses = (): ArrangementPose[] => [...bodies].map(([id, entry]) => ({ id, position: { ...entry.body.translation() }, rotation: { ...entry.body.rotation() }, speed: length(entry.body.linvel()) + length(entry.body.angvel()) * .1 }))

  function placement(entry: PieceBody) {
    const p = entry.body.translation(), half = entry.definition.half
    const nx = p.x / (target.rx - Math.min(half.x, .4) * .45)
    const nz = p.z / (target.rz - Math.min(half.z, .36) * .45)
    const extent = mode === 'crate' ? Math.max(Math.abs(nx), Math.abs(nz)) : Math.hypot(nx, nz)
    const inside = extent <= (entry.definition.slot === 'egg' ? .89 : .93)
    const onSurface = p.y >= target.floor - .04 && p.y <= target.floor + half.y * 2 + .12
    return { id: entry.definition.id, slot: entry.definition.slot, x: p.x / target.rx, y: p.z / target.rz,
      placed: inside && onSurface && entry !== held, inside }
  }
  function progress() {
    const items = [...bodies.values()].map(placement)
    for (const [index, item] of items.entries()) {
      if (items.slice(0, index).some(other => other.placed && Math.hypot(other.x - item.x, other.y - item.y) < .18)) item.placed = false
    }
    return items
  }
  function result() {
    if (held || settledFor < .42) return
    const items = progress()
    if (items.every(item => item.placed)) return items.map(({ slot, x, y }) => ({ slot, x, y }))
  }
  let pointerDrag = false

  return {
    mode, target,
    poses, progress,
    takePointer(id: string) {
      this.release()
      const entry = bodies.get(id)
      if (!entry || disposed) return false
      held = entry; pointerDrag = true
      entry.body.setBodyType(R.RigidBodyType.KinematicPositionBased, true)
      entry.body.collider(0).setSensor(true)
      return true
    },
    followPointer(point: Point3) {
      if (!held || !pointerDrag) return
      const center = { x: Math.max(-3, Math.min(3, point.x)), y: point.y, z: Math.max(-1.85, Math.min(1.85, point.z)) }
      held.body.setTranslation(center, true)
      held.body.setNextKinematicTranslation(center)
    },
    heldId: () => held?.definition.id,
    grab(id: string, point: Point3) {
      if (disposed) return false
      this.release()
      const entry = bodies.get(id)
      if (!entry) return false
      const local = inversePoint(entry.body, point)
      handle.setTranslation(point, true); handle.setNextKinematicTranslation(point)
      cursor = { ...point }; anchor = { ...point }
      joint = world.createImpulseJoint(R.JointData.spherical({ x: 0, y: 0, z: 0 }, local), handle, entry.body, true)
      joint.setContactsEnabled(false)
      entry.body.setAngularDamping(9); entry.body.setLinearDamping(3)
      entry.body.wakeUp(); held = entry; settledFor = 0
      return true
    },
    move(point: Point3) {
      if (!held) return
      const gripHeight = container ? Math.max(1.35, Math.min(1.65, point.y)) : Math.min(point.y, held.definition.half.y * 2 + .30)
      cursor = { x: Math.max(-3.0, Math.min(3.0, point.x)), y: gripHeight, z: Math.max(-1.8, Math.min(1.65, point.z)) }
    },
    rotate(radians: number) {
      if (!held) return
      if (pointerDrag) {
        const q = held.body.rotation(), c = Math.cos(radians / 2), s = Math.sin(radians / 2)
        held.body.setRotation({ x: q.x*c + q.z*s, y: q.y*c + q.w*s, z: q.z*c - q.x*s, w:q.w*c - q.y*s }, true)
        return
      }
      held.body.applyTorqueImpulse({ x: 0, y: Math.max(-.12, Math.min(.12, radians)) * held.definition.mass, z: 0 }, true)
    },
    release() {
      if (held && pointerDrag) {
        const body = held.body, p = body.translation()
        if (placement(held).inside) body.setTranslation({ ...p, y: Math.max(p.y, target.floor + held.definition.half.y + .014) }, true)
        body.setBodyType(R.RigidBodyType.Dynamic, true); body.collider(0).setSensor(false)
        body.setLinvel({ x: 0, y: 0, z: 0 }, true); body.setAngvel({ x: 0, y: 0, z: 0 }, true)
        pointerDrag = false
      }
      if (joint) world.removeImpulseJoint(joint, true)
      if (held) { held.body.setAngularDamping(held.definition.slot === 'egg' ? 7 : 2.5); held.body.setLinearDamping(held.definition.slot === 'egg' ? 3 : 1.6) }
      joint = undefined; held = undefined; settledFor = 0
    },
    step(dt: number) {
      if (disposed) return []
      accumulator = Math.min(.067, accumulator + Math.max(0, dt))
      impacts.length = 0
      let steps = 0
      while (accumulator >= 1 / 120 && steps++ < 8) {
        if (held && !pointerDrag) {
          const blend = 1 - Math.exp(-22 / 120)
          const clearsRim = held.body.translation().y - held.definition.half.y > .60
          // Lift before crossing the rim, so a fast touch gesture cannot wedge a prop into wicker.
          const travel = container && !clearsRim ? 0 : blend
          anchor.x += (cursor.x - anchor.x) * travel
          anchor.y += (cursor.y - anchor.y) * blend
          anchor.z += (cursor.z - anchor.z) * travel
          handle.setNextKinematicTranslation(anchor)
        }
        world.step()
        for (const [id, entry] of bodies) {
          const p = entry.body.translation(), v = entry.body.linvel()
          if (entry.previousY < -.5 && v.y > entry.previousY * .4 && p.y < entry.definition.half.y + .65)
            impacts.push({ id, x: p.x, z: p.z, strength: Math.min(1, -entry.previousY / 4) })
          entry.previousY = v.y
          entry.body.resetForces(false)
          if (Math.abs(p.x) > 3.15 || Math.abs(p.z) > 1.9)
            entry.body.addForce({ x: -p.x * entry.definition.mass * 12, y: 0, z: -p.z * entry.definition.mass * 12 }, true)
        }
        accumulator -= 1 / 120
      }
      const quiet = !held && [...bodies.values()].every(({ body, definition }) => length(body.linvel()) + length(body.angvel()) * definition.half.z < .13)
      settledFor = quiet ? settledFor + dt : 0
      return impacts.slice()
    },
    result,
    settledFor: () => settledFor,
    resting: () => !held && settledFor >= .42 && [...bodies.values()].every(entry => entry.body.isSleeping()),
    dispose() { if (disposed) return; this.release(); disposed = true; world.free() },
  }
}

function length(point: Point3) { return Math.hypot(point.x, point.y, point.z) }
function inversePoint(body: Body, point: Point3): Point3 {
  const p = body.translation(), q = body.rotation(), x = point.x - p.x, y = point.y - p.y, z = point.z - p.z
  const tx = 2 * (q.z * y - q.y * z), ty = 2 * (q.x * z - q.z * x), tz = 2 * (q.y * x - q.x * y)
  return { x: x + q.w * tx + q.z * ty - q.y * tz, y: y + q.w * ty + q.x * tz - q.z * tx, z: z + q.w * tz + q.y * tx - q.x * ty }
}
