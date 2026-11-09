import * as THREE from 'three';

export type SculptedDoughOptions = {
  shape: 'raw' | 'round' | 'long' | 'folded';
  /** Enclosed volume, in the same units used by the cutting model. */
  mass: number;
  stretch?: number;
  seed?: number;
};

const TAU = Math.PI * 2;
const RIM = .065;
const rings = 32;
const segments = 120;
const rimBands = 6;
const smooth = (a: number, b: number, x: number) => {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const bell = (x: number, width: number) => Math.exp(-((x / width) ** 2));
const templates = new Map<string, THREE.BufferGeometry>();

function sculptTemplate(shape: 'raw' | 'folded', seed: number): THREE.BufferGeometry {
  const key = `${shape}:${seed >>> 0}`;
  const existing = templates.get(key);
  if (existing) return existing;
  const geometry = createImplicitDough({ shape, seed: seed >>> 0, mass: 1 });
  if (templates.size >= 16) {
    const oldest = templates.keys().next().value!;
    templates.get(oldest)!.dispose(); templates.delete(oldest);
  }
  templates.set(key, geometry); return geometry;
}

/** Call each shape separately from an idle callback before its first gesture. */
export function prewarmSculptedDough(seed = 1, shape?: 'raw' | 'folded'): void {
  for (const item of shape ? [shape] : ['raw', 'folded'] as const) sculptTemplate(item, seed);
}

/**
 * One closed solid per portion. Raw folds and the open pastry lap are sampled
 * volumetric surfaces; cupped and rolled forms use a shared-boundary soft rim.
 */
export function createSculptedDough(options: SculptedDoughOptions): THREE.BufferGeometry {
  if (!Number.isFinite(options.mass) || options.mass <= 0) throw new RangeError('Dough mass must be positive and finite.');
  if (options.shape === 'raw' || options.shape === 'folded') {
    const geometry = sculptTemplate(options.shape, options.seed ?? 1).clone();
    geometry.scale(...Array(3).fill(Math.cbrt(options.mass)) as [number, number, number]);
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    geometry.userData.sculptedDough = { ...options, implicit: true };
    return geometry;
  }
  const { shape } = options;
  const stretch = THREE.MathUtils.clamp(Number.isFinite(options.stretch) ? options.stretch! : 1, .55, 3);
  const seed = (options.seed ?? 1) >>> 0;
  const phase = (seed * .61803398875 % 1) * TAU;
  const rim = RIM;
  const exponent = shape === 'long' ? 2.0 : 2.15;
  const sx = shape === 'long' ? 1.65 * Math.sqrt(stretch) : 1.03;
  const sz = shape === 'long' ? .65 / Math.sqrt(stretch) : .98;
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [];

  function domain(radius: number, angle: number, outward = 0): [number, number] {
    const c = Math.cos(angle), s = Math.sin(angle);
    const boundary = (Math.abs(c) ** exponent + Math.abs(s) ** exponent) ** (-1 / exponent);
    const irregular = 1 + .038 * Math.sin(angle * 3 + phase) + .022 * Math.sin(angle * 5 - phase * .7);
    let u = radius * boundary * c * irregular;
    let v = radius * boundary * s * irregular;
    // A stretched petal and a broader shoulder break the radial, machine-made outline.
    if (shape === 'long') { u *= 1 + .09 * c; v += .055 * Math.sin(u * 2.4 + phase) * radius; }
    u += c * outward / sx;
    v += s * outward / sz;
    return [u, v];
  }

  function point(u: number, v: number, radius: number, face: number): [number, number, number] {
    const envelope = Math.max(0, 1 - radius * radius) ** .64;
    const x = u * sx, z = v * sz, y = .12;
    let top = rim + (shape === 'round' ? .47 : .62) * envelope;
    const bottom = rim + (.12 - rim) * (1 - smooth(.58, 1, radius));
    if (shape === 'long') {
      const strand = v + .09 * Math.sin(u * 2.2 + phase);
      top += envelope * (.055 * bell(strand + .13, .13) - .045 * bell(strand - .03, .085));
      top *= 1 - .18 * smooth(.25, 1.15, u);
    } else if (shape === 'round') {
      top += envelope * .021 * Math.sin(u * 3 + phase) * Math.cos(v * 4 - .6);
      top -= .027 * smooth(.5, .9, radius) * bell(v + .35 + .12 * Math.sin(u * 4), .1);
    }

    return [x, y + (face >= 0 ? top * face : bottom * face), z];
  }

  function vertex(radius: number, angle: number, face: number, outward = 0): number {
    const [u, v] = domain(radius, angle, outward);
    const index = positions.length / 3;
    positions.push(...point(u, v, radius, face));
    uvs.push(THREE.MathUtils.clamp(.5 + u / 2.5, 0, 1), THREE.MathUtils.clamp(.5 + v / 2.5, 0, 1));
    return index;
  }

  function disk(face: 1 | -1): number[] {
    const center = vertex(0, 0, face);
    let previous: number[] = [];
    for (let ring = 1; ring <= rings; ring++) {
      const row = Array.from({ length: segments }, (_, j) => vertex(ring / rings, j / segments * TAU, face));
      for (let j = 0; j < segments; j++) {
        const next = (j + 1) % segments;
        const triangles = ring === 1 ? [[center, row[next], row[j]]]
          : [[previous[j], row[next], row[j]], [previous[j], previous[next], row[next]]];
        for (const triangle of triangles) indices.push(...(face === 1 ? triangle : triangle.reverse()));
      }
      previous = row;
    }
    return previous;
  }
  const top = disk(1), bottom = disk(-1);
  let previous = top;
  for (let band = 1; band <= rimBands; band++) {
    const angle = band / rimBands * Math.PI;
    const row = band === rimBands ? bottom : Array.from({ length: segments }, (_, j) => vertex(1, j / segments * TAU, Math.cos(angle), rim * Math.sin(angle)));
    for (let j = 0; j < segments; j++) {
      const next = (j + 1) % segments;
      indices.push(previous[j], previous[next], row[j], previous[next], row[next], row[j]);
    }
    previous = row;
  }

  let volume = 0;
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i] * 3, b = indices[i + 1] * 3, c = indices[i + 2] * 3;
    volume += (positions[a] * (positions[b + 1] * positions[c + 2] - positions[b + 2] * positions[c + 1])
      + positions[a + 1] * (positions[b + 2] * positions[c] - positions[b] * positions[c + 2])
      + positions[a + 2] * (positions[b] * positions[c + 1] - positions[b + 1] * positions[c])) / 6;
  }
  if (volume < 0) for (let i = 0; i < indices.length; i += 3) [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
  if (!Number.isFinite(volume) || Math.abs(volume) < 1e-8) throw new Error('Dough sculpture has no enclosed volume.');
  const scale = Math.cbrt(options.mass / Math.abs(volume));
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions.map(value => value * scale), 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.addGroup(0, indices.length, 0);
  geometry.computeBoundingBox();
  const center = geometry.boundingBox!.getCenter(new THREE.Vector3());
  geometry.translate(-center.x, -geometry.boundingBox!.min.y, -center.z);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  geometry.userData.sculptedDough = { shape, mass: options.mass, stretch, seed };
  geometry.userData.openFold = false;
  return geometry;
}

type Point3 = readonly [number, number, number];
type Segment = { x: number; y: number; z: number; dx: number; dy: number; dz: number; inverse: number; taper: number };

function createImplicitDough(options: SculptedDoughOptions): THREE.BufferGeometry {
  const phase = (((options.seed ?? 1) >>> 0) * .61803398875 % 1) * TAU;
  const min = (a: number, b: number, k: number) => {
    const h = Math.max(0, k - Math.abs(a - b)) / k;
    return Math.min(a, b) - h * h * k * .25;
  };
  const mound = (x: number, y: number, z: number, rx: number, ry: number, rz: number, q = 2) =>
    (Math.sqrt((Math.abs(x / rx) ** q + Math.abs(z / rz) ** q) ** (2 / q) + (y / ry) ** 2) - 1) * Math.min(rx, ry, rz);
  function path(points: Point3[], yScale = 1, tapered = false): Segment[] {
    const result: Segment[] = [];
    for (let i = 0; i + 1 < points.length; i++) {
      const [x, y, z] = points[i], [bx, by, bz] = points[i + 1];
      const dx = bx - x, dy = (by - y) * yScale, dz = bz - z;
      const taper = tapered ? .18 + .82 * Math.sin(Math.PI * (i + .5) / (points.length - 1)) ** .7 : 1;
      result.push({ x, y: y * yScale, z, dx, dy, dz, inverse: 1 / Math.max(1e-12, dx * dx + dy * dy + dz * dz), taper });
    }
    return result;
  }
  function curve(a: Point3, b: Point3, c: Point3, d: Point3, count = 18): Point3[] {
    return Array.from({ length: count + 1 }, (_, i) => {
      const t = i / count, s = 1 - t;
      return [0, 1, 2].map(k => s ** 3 * a[k] + 3 * s * s * t * b[k] + 3 * s * t * t * c[k] + t ** 3 * d[k]) as unknown as Point3;
    });
  }
  function tube(x: number, y: number, z: number, line: Segment[], radius: number, yScale = 1): number {
    let distance = Infinity;
    for (const s of line) {
      const px = x - s.x, py = y * yScale - s.y, pz = z - s.z;
      const t = THREE.MathUtils.clamp((px * s.dx + py * s.dy + pz * s.dz) * s.inverse, 0, 1);
      distance = Math.min(distance, (px - t * s.dx) ** 2 + (py - t * s.dy) ** 2 + (pz - t * s.dz) ** 2);
    }
    return Math.sqrt(distance) - radius;
  }
  const flowA = path(curve([-.95, .26, .10], [-.90, .75, -.75], [.65, .75, -.65], [.45, .30, .22]), 1.05);
  const flowB = path(curve([-.45, .28, .65], [.50, .65, .85], [.95, .65, -.10], [.10, .30, -.38]), 1.1);
  const triangle = [[-1.05, -.58], [1.07, -.65], [.12, .65]];
  function triangleDistance(x: number, z: number): number {
    let squared = Infinity, inside = true;
    for (let i = 0; i < 3; i++) {
      const a = triangle[i], b = triangle[(i + 1) % 3];
      const dx = b[0] - a[0], dz = b[1] - a[1], px = x - a[0], pz = z - a[1];
      const t = THREE.MathUtils.clamp((px * dx + pz * dz) / (dx * dx + dz * dz), 0, 1);
      squared = Math.min(squared, (px - t * dx) ** 2 + (pz - t * dz) ** 2);
      if (dx * pz - dz * px < 0) inside = false;
    }
    return Math.sqrt(squared) * (inside ? -1 : 1);
  }
  function body(x: number, y: number, z: number): number {
    if (options.shape === 'raw') {
      const angle = Math.atan2(z, x);
      const uneven = 1 + .035 * Math.sin(angle * 5 + phase) + .075 * Math.sin(angle * 3 - .3);
      const px = (x + .045 * Math.sin(z * 3 + phase)) / uneven;
      let value = mound(px, y - .25, z, 1.08, .26, .88, 2.35);
      value = min(value, tube(x, y, z, flowA, .24, 1.05), .11);
      value = min(value, tube(x, y, z, flowB, .23, 1.1), .105);
      value = min(value, mound(x + .68, y - .15, z - .43, .53, .14, .39, 2.4), .09);
      return -min(-value, y, .035);
    }
    const outline = triangleDistance(x, z);
    const lowerVertical = Math.abs(y - .20) - .035;
    const lx = Math.max(outline, 0), ly = Math.max(lowerVertical, 0);
    const base = Math.sqrt(lx * lx + ly * ly) + Math.min(Math.max(outline, lowerVertical), 0) - .15;
    let horizontal = outline;
    horizontal += .012 * Math.sin(x * 27 + z * 19) * bell(horizontal, .075) * smooth(-.45, .4, z);
    const pinch = .025 * bell(horizontal + .035, .045) * smooth(-.4, .5, z) * (.7 + .3 * Math.sin(x * 22 + z * 16));
    const center = .57 + .07 * Math.exp(-(x * x / .8 + (z + .2) ** 2 / .7)) - .024 * (z + .4) ** 2 + pinch;
    const vertical = Math.abs(y - center) - .015;
    const hx = Math.max(horizontal, 0), hy = Math.max(vertical, 0);
    const flap = Math.sqrt(hx * hx + hy * hy) + Math.min(Math.max(horizontal, vertical), 0) - .12;
    const hinge = mound(x - .02, y - .30, z + .60, 1.13, .28, .25, 2.8);
    let seam = Infinity, undercut = Infinity;
    // The pinched border belongs to the same implicit solid. The lower dough
    // shares the flap's footprint; there is no circular display disc beneath it.
    for (const [a, b] of [[triangle[1], triangle[2]], [triangle[2], triangle[0]]]) {
      const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
      const t = THREE.MathUtils.clamp(((x - a[0]) * dx + (z - a[1]) * dz) / (length * length), 0, 1);
      const ex = a[0] + dx * t, ez = a[1] + dz * t, nx = dz / length, nz = -dx / length;
      const wave = t * Math.PI * 8 + .35 * Math.sin(t * 7 + phase);
      const radius = .10 + .018 * Math.cos(wave);
      const sx = x - ex - nx * .08, sy = y - .45 - .02 * Math.sin(wave), sz = z - ez - nz * .08;
      seam = Math.min(seam, Math.sqrt(sx * sx + sy * sy + sz * sz) - radius);
      const ux = x - ex - nx * .135, uy = y - .565 - .01 * Math.sin(wave), uz = z - ez - nz * .135;
      undercut = Math.min(undercut, Math.sqrt(ux * ux + uy * uy + uz * uz) - .04);
    }
    let value = min(min(base, hinge, .07), flap, .14);
    value = min(value, seam, .065);
    value = -min(-value, undercut, .012);
    return -min(-value, y, .035);
  }
  // The crease cutter follows the actual outer surface, so it opens into the
  // air instead of leaving a sealed internal cavity or painted dark line.
  const grooves: Segment[][] = [];
  if (options.shape === 'raw') {
    const traces = [curve([-.86, 0, .03], [-.68, 0, -.52], [.35, 0, -.52], [.39, 0, .12]),
      curve([-.35, 0, .55], [.35, 0, .60], [.70, 0, .02], [.10, 0, -.20])];
    for (const trace of traces) {
      const lifted = trace.map(([x, , z]): Point3 => {
        let lo = .2, hi = 1.05;
        for (let i = 0; i < 15; i++) { const mid = (lo + hi) / 2; if (body(x, mid, z) < 0) lo = mid; else hi = mid; }
        return [x, hi + .015, z];
      });
      grooves.push(path(lifted, 1, true));
    }
  }
  function field(x: number, y: number, z: number): number {
    if (options.shape === 'raw') { x *= Math.sqrt(1.24); y /= 1.24; z *= Math.sqrt(1.24); }
    let value = body(x, y, z);
    for (const groove of grooves) {
      let cutter = Infinity;
      for (const s of groove) {
        const px = x - s.x, py = y - s.y, pz = z - s.z;
        const t = THREE.MathUtils.clamp((px * s.dx + py * s.dy + pz * s.dz) * s.inverse, 0, 1);
        const dx = px - t * s.dx, dy = py - t * s.dy, dz = pz - t * s.dz;
        cutter = Math.min(cutter, Math.sqrt(dx * dx + dy * dy + dz * dz) - .14 * s.taper);
      }
      value = -min(-value, cutter, .04);
    }
    return value;
  }

  const step = .055, nx = 61, ny = 26, nz = 49;
  const origin: Point3 = [-1.65, -.137, -1.32];
  const count = nx * ny * nz;
  const values = new Float32Array(count), points = new Float32Array(count * 3);
  const grid = (x: number, y: number, z: number) => x + nx * (y + ny * z);
  for (let z = 0; z < nz; z++) for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
    const id = grid(x, y, z), px = origin[0] + x * step, py = origin[1] + y * step, pz = origin[2] + z * step;
    points[id * 3] = px; points[id * 3 + 1] = py; points[id * 3 + 2] = pz; values[id] = field(px, py, pz);
  }
  const vertices: number[] = [], faces: number[] = [], edges = new Map<string, number>();
  function crossing(a: number, b: number): number {
    const key = a < b ? `${a}:${b}` : `${b}:${a}`;
    const old = edges.get(key); if (old !== undefined) return old;
    const t = values[a] / (values[a] - values[b]), index = vertices.length / 3;
    for (let k = 0; k < 3; k++) vertices.push(points[a * 3 + k] + (points[b * 3 + k] - points[a * 3 + k]) * t);
    edges.set(key, index); return index;
  }
  function triangleFace(a: number, b: number, c: number, inside: number[]): void {
    const ax = vertices[a * 3], ay = vertices[a * 3 + 1], az = vertices[a * 3 + 2];
    const bx = vertices[b * 3] - ax, by = vertices[b * 3 + 1] - ay, bz = vertices[b * 3 + 2] - az;
    const cx = vertices[c * 3] - ax, cy = vertices[c * 3 + 1] - ay, cz = vertices[c * 3 + 2] - az;
    let ix = 0, iy = 0, iz = 0;
    for (const id of inside) { ix += points[id * 3]; iy += points[id * 3 + 1]; iz += points[id * 3 + 2]; }
    const dot = (by * cz - bz * cy) * (ax - ix / inside.length) + (bz * cx - bx * cz) * (ay - iy / inside.length) + (bx * cy - by * cx) * (az - iz / inside.length);
    if (dot < 0) faces.push(a, c, b); else faces.push(a, b, c);
  }
  const tetrahedra = [[0, 1, 2, 6], [0, 2, 3, 6], [0, 3, 7, 6], [0, 7, 4, 6], [0, 4, 5, 6], [0, 5, 1, 6]];
  for (let z = 0; z + 1 < nz; z++) for (let y = 0; y + 1 < ny; y++) for (let x = 0; x + 1 < nx; x++) {
    const cube = [grid(x, y, z), grid(x + 1, y, z), grid(x + 1, y + 1, z), grid(x, y + 1, z), grid(x, y, z + 1), grid(x + 1, y, z + 1), grid(x + 1, y + 1, z + 1), grid(x, y + 1, z + 1)];
    let negative = 0;
    for (const id of cube) if (values[id] < 0) negative++;
    if (negative === 0 || negative === 8) continue;
    for (const tetrahedron of tetrahedra) {
      const ids = tetrahedron.map(i => cube[i]), inner = ids.filter(i => values[i] < 0), outer = ids.filter(i => values[i] >= 0);
      if (!inner.length || !outer.length) continue;
      if (inner.length === 2) {
        const a = crossing(inner[0], outer[0]), b = crossing(inner[0], outer[1]), c = crossing(inner[1], outer[1]), d = crossing(inner[1], outer[0]);
        triangleFace(a, b, c, inner); triangleFace(a, c, d, inner);
      } else {
        const solo = inner.length === 1 ? inner[0] : outer[0], other = inner.length === 1 ? outer : inner;
        triangleFace(crossing(solo, other[0]), crossing(solo, other[1]), crossing(solo, other[2]), inner);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(faces); geometry.addGroup(0, faces.length, 0);
  let volume = 0;
  for (let i = 0; i < faces.length; i += 3) {
    const a = faces[i] * 3, b = faces[i + 1] * 3, c = faces[i + 2] * 3;
    volume += (vertices[a] * (vertices[b + 1] * vertices[c + 2] - vertices[b + 2] * vertices[c + 1])
      + vertices[a + 1] * (vertices[b + 2] * vertices[c] - vertices[b] * vertices[c + 2])
      + vertices[a + 2] * (vertices[b] * vertices[c + 1] - vertices[b + 1] * vertices[c])) / 6;
  }
  const scale = Math.cbrt(options.mass / volume);
  geometry.scale(scale, scale, scale); geometry.computeBoundingBox();
  const center = geometry.boundingBox!.getCenter(new THREE.Vector3());
  geometry.translate(-center.x, -geometry.boundingBox!.min.y, -center.z);
  const position = geometry.getAttribute('position'), uv: number[] = [], normals: number[] = [];
  for (let i = 0; i < position.count; i++) uv.push(.5 + position.getX(i) / (3.3 * scale), .5 + position.getZ(i) / (2.64 * scale));
  for (let i = 0; i < vertices.length; i += 3) {
    const x = vertices[i], y = vertices[i + 1], z = vertices[i + 2], h = .003;
    const normal = new THREE.Vector3(field(x + h, y, z) - field(x - h, y, z), field(x, y + h, z) - field(x, y - h, z), field(x, y, z + h) - field(x, y, z - h)).normalize();
    normals.push(normal.x, normal.y, normal.z);
  }
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  geometry.userData.sculptedDough = { ...options, implicit: true };
  geometry.userData.openFold = false;
  return geometry;
}
