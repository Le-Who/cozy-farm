import { BufferAttribute, BufferGeometry } from 'three';

export type FoodPoint = { x: number; y: number };
export type FoodStroke = { point: FoodPoint; delta: FoodPoint; pressure: number; radius?: number };
export type FoodShapeSnapshot = { version: 1; plastic: number[]; baked: number };
export type FoodDeformationOptions = { radiusX?: number; radiusZ?: number; height?: number; segments?: number; rings?: number };
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
const finite = (value: number, fallback = 0) => Number.isFinite(value) ? value : fallback;

/** Actual enclosed volume, independent of vertex order and mesh translation. */
export function foodMeshVolume(positions: ArrayLike<number>, indices: ArrayLike<number>): number {
  let total = 0;
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i] * 3, b = indices[i + 1] * 3, c = indices[i + 2] * 3;
    total += positions[a] * (positions[b + 1] * positions[c + 2] - positions[b + 2] * positions[c + 1])
      + positions[a + 1] * (positions[b + 2] * positions[c] - positions[b] * positions[c + 2])
      + positions[a + 2] * (positions[b] * positions[c + 1] - positions[b + 1] * positions[c]);
  }
  return Math.abs(total / 6);
}

/** X/Z is the worktop, Y is height, bottom Y=0. Stroke Y is screen-down (-Z).
 * For a screen-Y-down kitchen camera, rotate X by Math.PI-.95: height rises on screen.
 * The renderer owns geometry disposal; baking and glazing keep this same geometry. */
export function createFoodDeformation(options: FoodDeformationOptions = {}) {
  const rx = clamp(finite(options.radiusX ?? .5, .5), .05, 10);
  const rz = clamp(finite(options.radiusZ ?? .36, .36), .05, 10);
  const height = clamp(finite(options.height ?? .18, .18), .025, 4);
  const segments = clamp(Math.round(finite(options.segments ?? 32, 32)), 12, 48);
  const rings = clamp(Math.round(finite(options.rings ?? 8, 8)), 4, 12);
  const points: number[] = [0, height, 0], uv: number[] = [.5, .5], triangles: number[] = [];
  const add = (r: number, y: number, angle: number) => {
    const edge = 1 + .018 * Math.sin(angle * 3) + .012 * Math.sin(angle * 5 + .7);
    const x = Math.cos(angle) * r * edge, z = Math.sin(angle) * r * edge;
    points.push(x * rx, y, z * rz); uv.push(.5 + x * .5, .5 + z * .5);
  };
  for (let ring = 1; ring <= rings; ring++) {
    const angle = ring / rings * Math.PI / 2, r = Math.sin(angle);
    for (let j = 0; j < segments; j++) add(r, height * (.25 + .75 * Math.cos(angle)), j / segments * Math.PI * 2);
  }
  for (let j = 0; j < segments; j++) triangles.push(0, 1 + (j + 1) % segments, 1 + j);
  for (let ring = 1; ring < rings; ring++) for (let j = 0; j < segments; j++) {
    const a = 1 + (ring - 1) * segments + j, b = 1 + (ring - 1) * segments + (j + 1) % segments;
    const c = a + segments, d = b + segments;
    triangles.push(a, b, c, b, d, c);
  }
  let previousRing = 1 + (rings - 1) * segments;
  // A rounded shoulder turns into the worktop gradually, without a single hard rim band.
  for (const [r, y] of [[1.012, height * .13], [.985, height * .035], [.93, 0]]) {
    const nextRing = points.length / 3;
    for (let j = 0; j < segments; j++) add(r, y, j / segments * Math.PI * 2);
    for (let j = 0; j < segments; j++) {
      const a = previousRing + j, b = previousRing + (j + 1) % segments;
      triangles.push(a, b, nextRing + j, b, nextRing + (j + 1) % segments, nextRing + j);
    }
    previousRing = nextRing;
  }
  const bottomRing = previousRing;
  const bottomCenter = points.length / 3; points.push(0, 0, 0); uv.push(.5, .5);
  for (let j = 0; j < segments; j++) triangles.push(bottomCenter, bottomRing + j, bottomRing + (j + 1) % segments);
  const geometry = new BufferGeometry(), positions = new Float32Array(points), original = positions.slice(), plastic = positions.slice();
  const velocity = new Float32Array(points.length), targets = new Float32Array(points.length), fair = new Float32Array(points.length), indices = new Uint16Array(triangles);
  const adjacent = Array.from({ length: points.length / 3 }, () => new Set<number>());
  for (let i = 0; i < indices.length; i += 3) for (let j = 0; j < 3; j++) {
    const a = indices[i + j], b = indices[i + (j + 1) % 3]; adjacent[a].add(b); adjacent[b].add(a);
  }
  const neighbours = adjacent.map(values => [...values]);
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2)); geometry.setIndex(new BufferAttribute(indices, 1));
  geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  const volume = foodMeshVolume(original, indices);
  let contact: { x: number; z: number; pressure: number; radius: number } | null = null, baked = 0, bakedLatched = false, lastSpeed = 0;

  function conserve(array: Float32Array): void {
    const actual = foodMeshVolume(array, indices);
    if (!(actual > volume * .02) || !Number.isFinite(actual)) { array.set(original); return; }
    const spread = Math.sqrt(volume / actual);
    for (let i = 0; i < array.length; i += 3) { array[i] *= spread; array[i + 2] *= spread; }
  }
  function updateGeometry(): void {
    geometry.getAttribute('position').needsUpdate = true;
    geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  }
  function weight(x: number, z: number): number {
    if (!contact) return 0;
    const dx = x / rx - contact.x, dz = z / rz - contact.z;
    return Math.exp(-(dx * dx + dz * dz) / (contact.radius * contact.radius));
  }
  function fairPlastic(amount: number): void {
    // Smooth only worked displacement: preserve the authored dome and broad finger marks.
    for (let vertex = 0; vertex < neighbours.length; vertex++) for (let axis = 0; axis < 3; axis++) {
      const i = vertex * 3 + axis;
      let average = 0;
      for (const next of neighbours[vertex]) average += plastic[next * 3 + axis] - original[next * 3 + axis];
      average /= neighbours[vertex].length;
      fair[i] = plastic[i] + (average - (plastic[i] - original[i])) * amount;
      if (axis === 1) fair[i] = original[i] === 0 ? 0 : Math.max(original[i] * .48, fair[i]);
    }
    plastic.set(fair);
  }

  return {
    geometry,
    get volume() { return volume; },
    applyStroke(stroke: FoodStroke): void {
      if (baked >= .95) return;
      contact = { x: clamp(finite(stroke.point.x), -1.4, 1.4), z: -clamp(finite(stroke.point.y), -1.4, 1.4),
        pressure: clamp(finite(stroke.pressure), 0, 1), radius: clamp(finite(stroke.radius ?? .48, .48), .32, .85) };
      const softness = 1 - baked, dx = clamp(finite(stroke.delta.x), -.16, .16) * rx * .65 * softness;
      const dz = -clamp(finite(stroke.delta.y), -.16, .16) * rz * .65 * softness;
      for (let i = 0; i < plastic.length; i += 3) {
        const w = weight(plastic[i], plastic[i + 2]) * contact.pressure;
        plastic[i] = clamp(plastic[i] + dx * w, original[i] - rx * .65, original[i] + rx * .65);
        plastic[i + 2] = clamp(plastic[i + 2] + dz * w, original[i + 2] - rz * .65, original[i + 2] + rz * .65);
        // Tangential friction accelerates the material; it does not teleport the visible mesh.
        velocity[i] += dx * w * 7; velocity[i + 2] += dz * w * 7;
      }
      fairPlastic(.12); conserve(plastic);
    },
    release(): void { contact = null; },
    update(elapsed: number): { maxSpeed: number; settled: boolean; steps: number } {
      const dt = clamp(finite(elapsed), 0, 1 / 15), steps = dt ? Math.min(8, Math.ceil(dt * 120)) : 0;
      if (!steps) return { maxSpeed: lastSpeed, settled: !contact && lastSpeed < .0002, steps: 0 };
      if (contact && baked < .95) {
        const dose = 1 - Math.exp(-dt * contact.pressure * .85 * (1 - baked));
        for (let i = 0; i < plastic.length; i += 3) if (original[i + 1] > 0) {
          const floor = original[i + 1] * .48;
          plastic[i + 1] += (floor - plastic[i + 1]) * weight(plastic[i], plastic[i + 2]) * dose;
        }
        fairPlastic(1 - Math.exp(-dt * 2.3)); conserve(plastic);
      }
      const h = dt / steps, frequency = Math.sqrt(180 + baked * 720), damping = .68 + baked * .25;
      const decay = damping * frequency, omega = frequency * Math.sqrt(1 - damping * damping), envelope = Math.exp(-decay * h);
      const sine = Math.sin(omega * h), cosine = Math.cos(omega * h);
      const a = envelope * (cosine + decay / omega * sine), b = envelope * sine / omega;
      const c = -envelope * frequency * frequency * sine / omega, d = envelope * (cosine - decay / omega * sine);
      for (let i = 0; i < positions.length; i += 3) {
        const w = weight(plastic[i], plastic[i + 2]) * (contact?.pressure ?? 0) * (1 - baked);
        targets[i] = plastic[i] + (plastic[i] - (contact?.x ?? 0) * rx) * w * .11;
        targets[i + 2] = plastic[i + 2] + (plastic[i + 2] - (contact?.z ?? 0) * rz) * w * .11;
        targets[i + 1] = Math.max(original[i + 1] * .26, plastic[i + 1] - height * .32 * w * Math.min(1, original[i + 1] / (height * .5)));
      }
      for (let step = 0; step < steps; step++) for (let i = 0; i < positions.length; i += 3) {
        for (let axis = 0; axis < 3; axis++) {
          const target = targets[i + axis], offset = positions[i + axis] - target, speed = velocity[i + axis];
          positions[i + axis] = target + a * offset + b * speed; velocity[i + axis] = c * offset + d * speed;
        }
        if (original[i + 1] === 0) { positions[i + 1] = 0; velocity[i + 1] = 0; }
        else if (positions[i + 1] < original[i + 1] * .22) { positions[i + 1] = original[i + 1] * .22; velocity[i + 1] = Math.max(0, velocity[i + 1]); }
      }
      conserve(positions); updateGeometry();
      let maxSpeed = 0;
      for (let i = 0; i < velocity.length; i++) maxSpeed = Math.max(maxSpeed, Math.abs(velocity[i]));
      lastSpeed = maxSpeed;
      return { maxSpeed, settled: !contact && maxSpeed < .0002, steps };
    },
    setBaked(amount = 1): void {
      baked = clamp(finite(amount), 0, 1);
      if (baked >= .95 && !bakedLatched) { contact = null; conserve(positions); plastic.set(positions); velocity.fill(0); lastSpeed = 0; bakedLatched = true; }
    },
    snapshot(): FoodShapeSnapshot { return { version: 1, plastic: Array.from(plastic), baked }; },
    restore(snapshot: FoodShapeSnapshot): boolean {
      if (snapshot.version !== 1 || snapshot.plastic.length !== plastic.length || !snapshot.plastic.every(Number.isFinite)
        || snapshot.plastic.some((value, i) => i % 3 === 1 ? value < 0 || value > height * 3 : Math.abs(value) > Math.max(rx, rz) * 4)) return false;
      plastic.set(snapshot.plastic); conserve(plastic); positions.set(plastic); velocity.fill(0); lastSpeed = 0; contact = null;
      baked = clamp(finite(snapshot.baked), 0, 1); bakedLatched = baked >= .95; updateGeometry(); return true;
    },
  };
}
