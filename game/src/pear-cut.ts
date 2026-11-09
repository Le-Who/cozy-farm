import { BufferAttribute, BufferGeometry, Plane, Quaternion, Vector3 } from 'three';
import { cutDoughGeometry, doughVolume } from './workshop-geometry.ts';

export type PearKerf = { angle: number; bins?: Iterable<number>; progress?: number; offset?: number };
export type PearHalf = { geometry: BufferGeometry; side: 1 | -1 };
export type PearCutResult = {
  halves: [PearHalf, PearHalf]; normal: Vector3; tangent: Vector3; center: Vector3;
  capBounds: { minU: number; maxU: number; minV: number; maxV: number }; volume: number;
  pose(open: number, rollRadians?: number, gap?: number): [{ position: Vector3; quaternion: Quaternion }, { position: Vector3; quaternion: Quaternion }];
};
const clamp = (n: number, low: number, high: number) => Math.max(low, Math.min(high, n));
const safe = (n: number | undefined, fallback: number) => n !== undefined && Number.isFinite(n) ? n : fallback;
const profile = [[0, 0], [.10, .32], [.25, .48], [.45, .78], [.65, 1]];
function widthAt(t: number): number {
  // A pear's broad butt closes as an ellipse, not a straight-sided cone.
  if (t >= .65) return Math.sqrt(Math.max(0, 1 - ((t - .65) / .35) ** 2));
  let i = 0;
  while (i < profile.length - 2 && t > profile[i + 1][0]) i++;
  const a = profile[i], b = profile[i + 1], before = profile[Math.max(0, i - 1)], after = profile[Math.min(profile.length - 1, i + 2)];
  const length = b[0] - a[0], u = clamp((t - a[0]) / length, 0, 1), u2 = u * u, u3 = u2 * u;
  const da = (b[1] - before[1]) / (b[0] - before[0]), db = b[0] === .65 ? 0 : (after[1] - a[1]) / (after[0] - a[0]);
  return Math.max(0, (2 * u3 - 3 * u2 + 1) * a[1] + (u3 - 2 * u2 + u) * length * da
    + (-2 * u3 + 3 * u2) * b[1] + (u3 - u2) * length * db);
}

/** A broad pear lies on X/Z, Y is height and its narrow neck points +Z.
 * Knife angle is local screen-down: tangent=(cos(a),0,-sin(a)). No random plane or replacement image. */
export function createPearCut(options: { radiusX?: number; radiusZ?: number; height?: number } = {}) {
  const rx = clamp(safe(options.radiusX, .32), .08, 2), rz = clamp(safe(options.radiusZ, .46), .12, 3), height = clamp(safe(options.height, .35), .06, 2);
  const sides = 32, rings = 24, p: number[] = [0, height / 2, rz], uv: number[] = [.5, 1], triangles: number[] = [];
  for (let ring = 1; ring < rings; ring++) {
    const t = .5 - .5 * Math.cos(ring / rings * Math.PI), w = widthAt(t), z = rz * (1 - t * 2), h = height * w ** .72;
    for (let j = 0; j < sides; j++) {
      const angle = j / sides * Math.PI * 2, x = Math.cos(angle) * rx * w, y = height / 2 + h * Math.sin(angle) * .5;
      p.push(x, y, z); uv.push(.5 + x / (2.1 * rx), .5 + z / (2 * rz));
    }
  }
  for (let j = 0; j < sides; j++) triangles.push(0, 1 + j, 1 + (j + 1) % sides);
  for (let ring = 1; ring < rings - 1; ring++) for (let j = 0; j < sides; j++) {
    const a = 1 + (ring - 1) * sides + j, b = 1 + (ring - 1) * sides + (j + 1) % sides, c = a + sides, d = b + sides;
    triangles.push(a, c, b, b, c, d);
  }
  const end = p.length / 3; p.push(0, height / 2, -rz); uv.push(.5, 0);
  const last = 1 + (rings - 2) * sides;
  for (let j = 0; j < sides; j++) triangles.push(end, last + (j + 1) % sides, last + j);
  let support = Infinity;
  for (let i = 1; i < p.length; i += 3) support = Math.min(support, p[i]);
  for (let i = 1; i < p.length; i += 3) p[i] -= support;
  const neckAnchor = new Vector3(0, height / 2 - support, rz);
  const wholeGeometry = new BufferGeometry();
  wholeGeometry.setAttribute('position', new BufferAttribute(new Float32Array(p), 3));
  wholeGeometry.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2)); wholeGeometry.setIndex(triangles);
  wholeGeometry.addGroup(0, triangles.length, 0); wholeGeometry.computeVertexNormals(); wholeGeometry.computeBoundingSphere();
  const original = new Float32Array(p), volume = doughVolume(wholeGeometry);
  let result: PearCutResult | undefined;
  function axes(angle: number, offset: number) {
    const a = safe(angle, 0), tangent = new Vector3(Math.cos(a), 0, -Math.sin(a));
    const normal = new Vector3(Math.sin(a), 0, Math.cos(a));
    const center = normal.clone().multiplyScalar(clamp(safe(offset, 0), -Math.min(rx, rz) * .72, Math.min(rx, rz) * .72));
    return { tangent, normal, center };
  }
  return {
    wholeGeometry, neckAnchor,
    setKerf(value: PearKerf): void {
      if (result) return;
      const { tangent, normal, center } = axes(value.angle, value.offset ?? 0), covered = new Set(value.bins ?? []);
      const progress = clamp(safe(value.progress, 0), 0, 1), positions = wholeGeometry.getAttribute('position') as BufferAttribute;
      const out = positions.array as Float32Array, length = Math.hypot(tangent.x * rx, tangent.z * rz);
      for (let i = 0; i < out.length; i += 3) {
        const x = original[i] - center.x, z = original[i + 2] - center.z;
        const along = (x * tangent.x + z * tangent.z) / (2 * length) + .5, across = x * normal.x + z * normal.z;
        const bin = Math.floor(along * 16), hit = covered.size ? covered.has(bin) : progress > 0 && along >= 0 && along <= progress;
        const groove = hit ? Math.exp(-((across / (Math.min(rx, rz) * .11)) ** 2)) : 0;
        out[i] = original[i]; out[i + 1] = Math.max(0, original[i + 1] - height * .12 * groove * (original[i + 1] / height) ** 2); out[i + 2] = original[i + 2];
      }
      positions.needsUpdate = true; wholeGeometry.computeVertexNormals();
    },
    cut(angle: number, offset = 0): PearCutResult | undefined {
      if (result) return result;
      const { tangent, normal, center } = axes(angle, offset), source = wholeGeometry.clone();
      (source.getAttribute('position') as BufferAttribute).array.set(original);
      const cut = cutDoughGeometry(source, new Plane().setFromNormalAndCoplanarPoint(normal, center)); source.dispose();
      if (!cut) return;
      const volumes = cut.map(doughVolume);
      if (volumes.some(v => v < volume * .025) || Math.abs((volumes[0] + volumes[1]) / volume - 1) > .002) { cut.forEach(value => value.dispose()); return; }
      let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
      for (const geometry of cut) {
        const pos = geometry.getAttribute('position'), index = geometry.index;
        for (const group of geometry.groups) if (group.materialIndex === 1) for (let i = group.start; i < group.start + group.count; i++) {
          const v = index ? index.getX(i) : i, along = pos.getX(v) * tangent.x + pos.getZ(v) * tangent.z;
          minU = Math.min(minU, along); maxU = Math.max(maxU, along); minV = Math.min(minV, pos.getY(v)); maxV = Math.max(maxV, pos.getY(v));
        }
      }
      const span = Math.max(maxU - minU, maxV - minV), verticalSign = tangent.z < -.0001 ? -1 : 1;
      const halves = cut.map((geometry, i) => {
        const pos = geometry.getAttribute('position'), tex = geometry.getAttribute('uv') as BufferAttribute, index = geometry.index;
        for (const group of geometry.groups) if (group.materialIndex === 1) for (let j = group.start; j < group.start + group.count; j++) {
          const v = index ? index.getX(j) : j, along = pos.getX(v) * tangent.x + pos.getZ(v) * tangent.z;
          // A single isotropic texel scale preserves the albedo grain and keeps the seed cavity vertical.
          tex.setXY(v, .5 + (pos.getY(v) - (minV + maxV) / 2) / span, .5 + verticalSign * (along - (minU + maxU) / 2) / span);
        }
        tex.needsUpdate = true;
        return { geometry, side: (i ? -1 : 1) as 1 | -1 };
      }) as [PearHalf, PearHalf];
      const hinges = halves.map(half => {
        const pos = half.geometry.getAttribute('position'); let boundary = half.side > 0 ? -Infinity : Infinity;
        for (let i = 0; i < pos.count; i++) {
          const n = pos.getX(i) * normal.x + pos.getZ(i) * normal.z;
          boundary = half.side > 0 ? Math.max(boundary, n) : Math.min(boundary, n);
        }
        return normal.clone().multiplyScalar(boundary);
      });
      result = { halves, normal, tangent, center, capBounds: { minU, maxU, minV, maxV }, volume,
        pose(open, rollRadians = Math.PI * .46, gap = .12) {
          const amount = clamp(safe(open, 0), 0, 1.07), roll = clamp(safe(rollRadians, Math.PI * .46), 0, Math.PI / 2 / 1.07);
          return halves.map((half, i) => {
            const quaternion = new Quaternion().setFromAxisAngle(tangent, half.side * roll * amount), pivot = hinges[i];
            const position = pivot.clone().sub(pivot.clone().applyQuaternion(quaternion)).addScaledVector(normal, half.side * Math.max(0, safe(gap, .12)) * amount);
            const points = half.geometry.getAttribute('position'), angle = half.side * roll * amount, cosine = Math.cos(angle), sine = Math.sin(angle);
            let support = Infinity;
            for (let j = 0; j < points.count; j++) {
              const across = (points.getX(j) - pivot.x) * normal.x + (points.getZ(j) - pivot.z) * normal.z;
              support = Math.min(support, points.getY(j) * cosine - across * sine);
            }
            // The raised half first settles out of the intact pear, avoiding a split-frame jump.
            const settling = clamp(amount / .14, 0, 1);
            position.y -= support * settling * settling * (3 - 2 * settling);
            return { position, quaternion };
          }) as [{ position: Vector3; quaternion: Quaternion }, { position: Vector3; quaternion: Quaternion }];
        } };
      return result;
    },
    dispose(): void { wholeGeometry.dispose(); result?.halves.forEach(half => half.geometry.dispose()); },
  };
}
