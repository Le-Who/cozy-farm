import { BufferAttribute, BufferGeometry, DynamicDrawUsage, Sphere } from 'three';

export type HoneyStreamPoint = { x: number; y: number; z: number };
export type HoneyStreamUpdate = {
  from: HoneyStreamPoint; to: HoneyStreamPoint; velocity: { x: number; y: number };
  radius: number; tail: number; flow: number; time: number;
};
const clamp = (n: number, low: number, high: number) => Math.max(low, Math.min(high, n));
const finite = (n: number, fallback = 0) => Number.isFinite(n) ? n : fallback;
const smooth = (t: number) => { const x = clamp(t, 0, 1); return x * x * (3 - 2 * x); };

/** Pixel-space XYZ (screen Y down), independent of material, droplet and deposited coating.
 * Tail=0 pours from the nozzle; tail=1 has necked off and reached the receiving food.
 * The same closed tube and buffers survive every update. */
export function createHoneyStream(options: { radialSegments?: number; longitudinalSegments?: number } = {}) {
  const radial = clamp(Math.round(finite(options.radialSegments ?? 8, 8)), 6, 12);
  const longitudinal = clamp(Math.round(finite(options.longitudinalSegments ?? 20, 20)), 8, 28);
  const stride = radial + 1, count = stride * (longitudinal + 1) + 2;
  const positions = new Float32Array(count * 3), normals = new Float32Array(count * 3), uv = new Float32Array(count * 2), indices: number[] = [];
  for (let i = 0; i <= longitudinal; i++) for (let j = 0; j <= radial; j++) {
    const k = i * stride + j; uv[k * 2] = j / radial; uv[k * 2 + 1] = i / longitudinal;
    if (i < longitudinal && j < radial) {
      const a = k, b = k + 1, c = k + stride, d = c + 1; indices.push(a, b, c, b, d, c);
    }
  }
  const start = count - 2, end = count - 1;
  for (let j = 0; j < radial; j++) indices.push(start, j + 1, j, end, longitudinal * stride + j, longitudinal * stride + j + 1);
  uv[start * 2] = uv[end * 2] = .5; uv[start * 2 + 1] = 0; uv[end * 2 + 1] = 1;
  const geometry = new BufferGeometry();
  const positionAttribute = new BufferAttribute(positions, 3).setUsage(DynamicDrawUsage), normalAttribute = new BufferAttribute(normals, 3).setUsage(DynamicDrawUsage);
  geometry.setAttribute('position', positionAttribute); geometry.setAttribute('normal', normalAttribute);
  geometry.setAttribute('uv', new BufferAttribute(uv, 2)); geometry.setIndex(indices); geometry.boundingSphere = new Sphere();

  return {
    geometry,
    update(input: HoneyStreamUpdate): { visible: boolean; length: number } {
      const fx = finite(input.from.x), fy = finite(input.from.y), fz = finite(input.from.z);
      const tx = finite(input.to.x, fx), ty = finite(input.to.y, fy), tz = finite(input.to.z, fz);
      const dx = tx - fx, dy = ty - fy, dz = tz - fz, length = Math.hypot(dx, dy, dz);
      const tail = clamp(finite(input.tail), 0, 1), flow = clamp(finite(input.flow), 0, 1), radius = clamp(finite(input.radius), 0, 100);
      const visible = flow > .001 && tail < .9999 && radius > .001 && length > .001;
      if (!visible) {
        for (let i = 0; i < count; i++) { const k = i * 3; positions[k] = tx; positions[k + 1] = ty; positions[k + 2] = tz; normals[k] = normals[k + 1] = 0; normals[k + 2] = 1; }
        geometry.boundingSphere!.center.set(tx, ty, tz); geometry.boundingSphere!.radius = 0;
        positionAttribute.needsUpdate = normalAttribute.needsUpdate = true;
        return { visible: false, length: 0 };
      }
      // A viscous strand trails the moving pour point. The bow is constrained by its span.
      let bowX = -finite(input.velocity.x) * .022, bowY = -finite(input.velocity.y) * .022 + Math.min(12, length * .035);
      const bowLength = Math.hypot(bowX, bowY), maxBow = length * .22;
      if (bowLength > maxBow) { bowX *= maxBow / bowLength; bowY *= maxBow / bowLength; }
      const first = .97 * tail ** .85, remaining = 1 - first, strength = radius * Math.sqrt(flow) * Math.sqrt(1 - tail);
      const useZ = Math.abs(dz / length) < .85;
      for (let i = 0; i <= longitudinal; i++) {
        const t = i / longitudinal, u = first + t * remaining, arch = 4 * u * (1 - u);
        const x = fx + dx * u + bowX * arch, y = fy + dy * u + bowY * arch, z = fz + dz * u;
        let ax = dx + bowX * 4 * (1 - 2 * u), ay = dy + bowY * 4 * (1 - 2 * u), az = dz;
        const magnitude = Math.hypot(ax, ay, az); ax /= magnitude; ay /= magnitude; az /= magnitude;
        let ux = useZ ? ay : -az, uy = useZ ? -ax : 0, uz = useZ ? 0 : ax;
        let uLength = Math.hypot(ux, uy, uz);
        if (uLength < .000001) { ux = -az; uy = 0; uz = ax; uLength = Math.hypot(ux, uy, uz); }
        ux /= uLength; uy /= uLength; uz /= uLength;
        const vx = ay * uz - az * uy, vy = az * ux - ax * uz, vz = ax * uy - ay * ux;
        const neck = 1 - tail * .94 * (1 - smooth((t - .06) / .54));
        // Material packets accelerate down the strand. Their changing cross-section
        // carries the highlight with the falling liquid even with a still hand.
        const phase = u * 2.8 - finite(input.time) * 2.1;
        const packet = 1 + .10 * Math.sin(phase * Math.PI * 2) * Math.sin(Math.PI*u);
        const r = strength * (1.03 - .25 * t) * neck * packet;
        for (let j = 0; j <= radial; j++) {
          const angle = (j === radial ? 0 : j) / radial * Math.PI * 2, cosine = Math.cos(angle), sine = Math.sin(angle), k = (i * stride + j) * 3;
          positions[k] = x + r * (ux * cosine + vx * sine);
          positions[k + 1] = y + r * (uy * cosine + vy * sine);
          positions[k + 2] = z + r * (uz * cosine + vz * sine);
        }
      }
      const arch = 4 * first * (1 - first);
      positions[start * 3] = fx + dx * first + bowX * arch; positions[start * 3 + 1] = fy + dy * first + bowY * arch; positions[start * 3 + 2] = fz + dz * first;
      positions[end * 3] = tx; positions[end * 3 + 1] = ty; positions[end * 3 + 2] = tz;
      positionAttribute.needsUpdate = true; geometry.computeVertexNormals();
      // The UV seam is a shared physical circle, so its lighting must also be continuous.
      for (let i = 0; i <= longitudinal; i++) {
        const a = i * stride * 3, b = (i * stride + radial) * 3;
        const x = normals[a] + normals[b], y = normals[a + 1] + normals[b + 1], z = normals[a + 2] + normals[b + 2], magnitude = Math.hypot(x, y, z) || 1;
        normals[a] = normals[b] = x / magnitude; normals[a + 1] = normals[b + 1] = y / magnitude; normals[a + 2] = normals[b + 2] = z / magnitude;
      }
      normalAttribute.needsUpdate = true;
      geometry.boundingSphere!.center.set((fx + tx) / 2, (fy + ty) / 2, (fz + tz) / 2);
      geometry.boundingSphere!.radius = length / 2 + Math.hypot(bowX, bowY) + radius * 1.1;
      return { visible: true, length: length * remaining };
    },
    dispose(): void { geometry.dispose(); },
  };
}
