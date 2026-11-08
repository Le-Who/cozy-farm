export interface SpringScalar { value: number; velocity: number }
export interface SpringOptions { frequency?: number; damping?: number }
export interface ViscousFollower { x: number; y: number; vx: number; vy: number }
export interface FruitLanding { height: number; velocity: number; bounces: number; settled: boolean }
export interface FruitLandingOptions { gravity?: number; restitution?: number; settleSpeed?: number }

// Exact solution of x'' + 2 ζω x' + ω²(x − target) = 0. Frequency is in Hz.
function springCoefficients(dt: number, frequency: number, damping: number) {
  const omega = Math.max(0, frequency) * 2 * Math.PI
  const ratio = Math.max(0, damping)
  if (omega === 0) return { a: 1, b: dt, c: 0, d: 1 }
  if (Math.abs(ratio - 1) < 1e-6) {
    const decay = Math.exp(-omega * dt)
    return { a: decay * (1 + omega * dt), b: decay * dt, c: -decay * omega * omega * dt, d: decay * (1 - omega * dt) }
  }
  if (ratio < 1) {
    const damped = omega * Math.sqrt(1 - ratio * ratio)
    const decay = Math.exp(-ratio * omega * dt)
    const sine = Math.sin(damped * dt) / damped
    const cosine = Math.cos(damped * dt)
    return { a: decay * (cosine + ratio * omega * sine), b: decay * sine, c: -decay * omega * omega * sine, d: decay * (cosine - ratio * omega * sine) }
  }
  const root = Math.sqrt(ratio * ratio - 1)
  const slow = -omega / (ratio + root)
  const fast = -omega * (ratio + root)
  const slowDecay = Math.exp(slow * dt), fastDecay = Math.exp(fast * dt), span = slow - fast
  return {
    a: (-fast * slowDecay + slow * fastDecay) / span,
    b: (slowDecay - fastDecay) / span,
    c: slow * fast * (fastDecay - slowDecay) / span,
    d: (slow * slowDecay - fast * fastDecay) / span,
  }
}

/** Mutates a spring for elapsed seconds. A fixed target gives the same result at any frame rate. */
export function stepSpring(state: SpringScalar, target: number, dt: number, options: SpringOptions = {}): SpringScalar {
  if (!(dt > 0) || !Number.isFinite(dt)) return state
  const { a, b, c, d } = springCoefficients(dt, options.frequency ?? 5, options.damping ?? .65)
  const offset = state.value - target, velocity = state.velocity
  state.value = target + a * offset + b * velocity
  state.velocity = c * offset + d * velocity
  return state
}

export function createViscousFollower(x = 0, y = 0): ViscousFollower {
  return { x, y, vx: 0, vy: 0 }
}

/** Response is angular frequency per second; 12 gives a soft, roughly .17 second cursor lag. */
export function stepViscousFollower(state: ViscousFollower, x: number, y: number, dt: number, response = 12): ViscousFollower {
  if (!(dt > 0) || !Number.isFinite(dt)) return state
  const { a, b, c, d } = springCoefficients(dt, response / (2 * Math.PI), 1)
  const dx = state.x - x, dy = state.y - y, vx = state.vx, vy = state.vy
  state.x = x + a * dx + b * vx
  state.y = y + a * dy + b * vy
  state.vx = c * dx + d * vx
  state.vy = c * dy + d * vy
  return state
}

export function createFruitLanding(height = .12, velocity = 0): FruitLanding {
  return { height: Math.max(0, height), velocity, bounces: 0, settled: height <= 0 && velocity === 0 }
}

/** Height is above the food surface, positive velocity is upward. Impacts consume their exact fraction of dt. */
export function stepFruitLanding(state: FruitLanding, dt: number, options: FruitLandingOptions = {}): FruitLanding {
  if (state.settled || !(dt > 0) || !Number.isFinite(dt)) return state
  const gravity = Math.max(.001, options.gravity ?? 3.6)
  const restitution = Math.max(0, Math.min(.8, options.restitution ?? .25))
  const settleSpeed = Math.max(.001, options.settleSpeed ?? .035)
  let remaining = dt
  while (remaining > 0) {
    const height = Math.max(0, state.height), velocity = state.velocity
    const root = Math.sqrt(velocity * velocity + 2 * gravity * height)
    const impactTime = velocity < 0 ? 2 * height / (root - velocity) : (velocity + root) / gravity
    if (impactTime > remaining) {
      state.height = Math.max(0, height + velocity * remaining - .5 * gravity * remaining * remaining)
      state.velocity = velocity - gravity * remaining
      break
    }
    remaining -= impactTime
    state.height = 0
    state.velocity = Math.max(0, (gravity * impactTime - velocity) * restitution)
    state.bounces++
    if (state.velocity <= settleSpeed) {
      state.velocity = 0
      state.settled = true
      break
    }
  }
  return state
}
