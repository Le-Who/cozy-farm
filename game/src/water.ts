import {
  DataTexture, LinearFilter, Mesh, PlaneGeometry, RedFormat, type Scene,
  ShaderMaterial, UnsignedByteType, Vector2, Vector3, Vector4,
} from 'three';

type Point = { x: number; y: number };
type Rect = Point & { w: number; h: number };
type Boat = Point & { speed: number };

type WaterLayer = {
  resize(width: number, height: number, dpr?: number): void;
  setShore(image: HTMLImageElement, rect: Rect, minY: number): void;
  paint(time: number, boat?: Boat, bobber?: Point, lunarTide?: boolean): void;
  dispose(): void;
};

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  varying vec2 vUv;
  uniform vec2 uSize;
  uniform float uTime;
  uniform sampler2D uShore;
  uniform vec4 uShoreRect;
  uniform vec2 uShoreScale;
  uniform vec3 uBoat;
  uniform vec3 uBobber;
  uniform float uLunarTide;

  float hash(vec2 cell) {
    vec3 p = fract(vec3(cell.xyx) * 0.1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
  }

  float noise(vec2 p) {
    vec2 cell = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(cell), hash(cell + vec2(1.0, 0.0)), f.x),
      mix(hash(cell + vec2(0.0, 1.0)), hash(cell + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }

  float band(float center, float spread, float distance) {
    return 1.0 - smoothstep(0.0, spread, abs(distance - center));
  }

  float boatWake(vec2 p) {
    if (uBoat.z < 0.0) return 0.0;
    vec2 d = p - uBoat.xy;
    if (abs(d.x) > 146.0 || abs(d.y) > 65.0) return 0.0;
    float drift = sin(uTime * 1.5) * 1.5;
    float ringDistance = length(d * vec2(1.0, 2.75));
    float mooring = band(29.0 + drift, 3.1, ringDistance) * 0.42
                  + band(38.0 - drift, 2.2, ringDistance) * 0.22;
    float behind = d.x - 10.0;
    float span = 24.0 + 114.0 * uBoat.z;
    float edge = abs(d.y - behind * 0.17) - (4.0 + behind * 0.19);
    float plume = band(0.0, 3.0 + behind * 0.018, edge);
    float cross = 0.48 + 0.52 * sin(behind * 0.23 - uTime * 7.0 + d.y * 0.18);
    float travel = smoothstep(0.0, 15.0, behind) * (1.0 - smoothstep(span * 0.43, span, behind));
    return mooring + uBoat.z * travel * plume * (0.38 + 0.62 * cross);
  }

  float bobberWake(vec2 p) {
    if (uBobber.z < 0.0) return 0.0;
    vec2 d = p - uBobber.xy;
    if (abs(d.x) > 39.0 || abs(d.y) > 22.0) return 0.0;
    float radius = length(d * vec2(1.0, 2.0));
    float pulse = fract(uTime * 0.55);
    float second = fract(pulse + 0.48);
    return band(3.0 + 29.0 * pulse, 2.15, radius) * (1.0 - pulse)
         + band(3.0 + 29.0 * second, 1.6, radius) * (1.0 - second) * 0.55;
  }

  void main() {
    vec2 uv = vec2(vUv.x, 1.0 - vUv.y);
    vec2 p = uv * uSize;
    vec2 flow = vec2(p.x * 0.017, p.y * 0.061) / (0.94 + 0.15 * uv.y);
    float t = uTime;
    float a = dot(flow, vec2(0.13, 0.92)) - t * 0.74;
    float b = dot(flow, vec2(-0.44, 0.69)) + t * 0.55;
    float c = dot(flow, vec2(0.93, 1.28)) - t * 1.21;
    float swell = sin(a + sin(b) * 0.46);
    float cross = sin(b + sin(c) * 0.24);
    float pattern = noise(flow * vec2(0.83, 0.58) + vec2(t * 0.12, -t * 0.17));
    // Match the matte turquoise of the desktop master and keep highlights subordinate to the island.
    vec3 color = mix(vec3(0.130, 0.481, 0.589), vec3(0.106, 0.443, 0.543), uv.y);
    color = mix(color, vec3(0.131, 0.277, 0.507), uLunarTide * 0.56);
    color *= 0.985 + 0.024 * swell + 0.017 * cross + 0.038 * pattern;
    float ribbons = smoothstep(0.79, 0.985, swell) * smoothstep(0.42, 0.79, pattern);
    float dashes = smoothstep(0.88, 0.995, sin(c + swell * 0.3)) * smoothstep(0.63, 0.91, pattern);
    vec3 light = mix(vec3(0.64, 0.88, 0.88), vec3(0.73, 0.81, 1.0), uLunarTide);
    color = mix(color, light, ribbons * 0.12 + dashes * 0.11);
    float caustic = smoothstep(0.91, 0.997, sin(a * 1.55 + cross * 0.8))
                  * smoothstep(0.43, 0.82, pattern);
    color = mix(color, vec3(0.36, 0.73, 0.73), caustic * 0.13);

    if (uShoreScale.x > 0.0 && p.y > uShoreScale.y) {
      vec2 shoreUV = (p - uShoreRect.xy) / uShoreRect.zw;
      if (all(greaterThanEqual(shoreUV, vec2(0.0))) && all(lessThanEqual(shoreUV, vec2(1.0)))) {
        float shoreDistance = texture2D(uShore, shoreUV).r;
        float distance = shoreDistance * uShoreScale.x;
        float mask = smoothstep(uShoreScale.y, uShoreScale.y + 38.0, p.y)
                   * (1.0 - smoothstep(0.72, 0.98, shoreDistance));
        float shallows = (1.0 - smoothstep(1.0, 73.0, distance)) * mask;
        float tide = distance + swell * 3.6 + cross * 1.8;
        float contact = (1.0 - smoothstep(0.0, 7.0, distance)) * mask;
        float foam = band(7.0, 4.0, tide) * (0.20 + smoothstep(0.22, 0.78, pattern) * 0.80)
                   + band(18.0 + cross * 2.0, 5.8, tide) * smoothstep(0.48, 0.88, pattern) * 0.40;
        color *= 1.0 - contact * 0.07;
        color = mix(color, vec3(0.18, 0.52, 0.52), shallows * 0.33);
        color = mix(color, light, foam * mask * 0.26);
        float moonWash = band(25.0 + sin(t * 1.15) * 5.0, 8.0, tide);
        color = mix(color, vec3(0.61, 0.65, 0.99), uLunarTide * moonWash * mask
          * (0.06 + pattern * 0.21));
      }
    }

    color = mix(color, light, min(0.64, boatWake(p) * 0.46 + bobberWake(p) * 0.62));
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;

const shoreWidth = 480;
const shorePadding = 48;
const shoreRange = 64;

type ShoreTexture = { texture: DataTexture; width: number; height: number };

function createShoreTexture(image: HTMLImageElement): ShoreTexture | undefined {
  const height = Math.max(1, Math.round(shoreWidth * image.naturalHeight / image.naturalWidth));
  const fullWidth = shoreWidth + shorePadding * 2;
  const fullHeight = height + shorePadding * 2;
  const mask = document.createElement('canvas');
  mask.width = fullWidth;
  mask.height = fullHeight;
  const ctx = mask.getContext('2d', { willReadFrequently: true });
  if (!ctx) return undefined;
  ctx.drawImage(image, shorePadding, shorePadding, shoreWidth, height);
  const alpha = ctx.getImageData(0, 0, fullWidth, fullHeight).data;
  const distances = Float32Array.from({ length: fullWidth * fullHeight }, (_, index) => (
    alpha[index * 4 + 3] >= 160 ? 0 : shoreRange
  ));

  // Two distance sweeps turn the painted alpha silhouette into a reusable shore mask.
  for (let y = 1; y < fullHeight - 1; y++) {
    for (let x = 1; x < fullWidth - 1; x++) {
      const i = y * fullWidth + x;
      if (!distances[i]) continue;
      const row = i - fullWidth;
      distances[i] = Math.min(distances[i], distances[i - 1] + 1, distances[row] + 1,
        distances[row - 1] + Math.SQRT2, distances[row + 1] + Math.SQRT2);
    }
  }
  for (let y = fullHeight - 2; y > 0; y--) {
    for (let x = fullWidth - 2; x > 0; x--) {
      const i = y * fullWidth + x;
      if (!distances[i]) continue;
      const row = i + fullWidth;
      distances[i] = Math.min(distances[i], distances[i + 1] + 1, distances[row] + 1,
        distances[row - 1] + Math.SQRT2, distances[row + 1] + Math.SQRT2);
    }
  }
  const data = Uint8Array.from(distances, (distance) => Math.round(distance * 255 / shoreRange));
  const texture = new DataTexture(data, fullWidth, fullHeight, RedFormat, UnsignedByteType);
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.needsUpdate = true;
  return { texture, width: shoreWidth, height };
}

export function createWaterLayer(scene: Scene): WaterLayer {
  let disposed = false;

  const shores = new Map<HTMLImageElement, ShoreTexture | undefined>();
  const uniforms = {
    uSize: { value: new Vector2(1, 1) },
    uTime: { value: 0 },
    uShore: { value: null as DataTexture | null },
    uShoreRect: { value: new Vector4() },
    uShoreScale: { value: new Vector2() },
    uBoat: { value: new Vector3(0, 0, -1) },
    uBobber: { value: new Vector3(0, 0, -1) },
    uLunarTide: { value: 0 },
  };
  const material = new ShaderMaterial({ vertexShader, fragmentShader, uniforms, depthTest: false, depthWrite: false, toneMapped: false });
  const geometry = new PlaneGeometry(2, 2);
  const plane = new Mesh(geometry, material);
  plane.name = 'water';
  plane.renderOrder = -1000;
  plane.frustumCulled = false;
  scene.add(plane);

  return {
    resize(width, height) {
      if (disposed) return;
      uniforms.uSize.value.set(width, height);
    },

    setShore(image, rect, minY) {
      if (disposed || !image.naturalWidth || !image.naturalHeight) return;
      if (!shores.has(image)) {
        try {
          shores.set(image, createShoreTexture(image));
        } catch {
          shores.set(image, undefined);
        }
      }
      const shore = shores.get(image);
      uniforms.uShore.value = shore?.texture ?? null;
      uniforms.uShoreScale.value.set(0, minY);
      if (!shore) return;
      const px = rect.w / shore.width;
      const py = rect.h / shore.height;
      const padX = shorePadding * px;
      const padY = shorePadding * py;
      uniforms.uShoreRect.value.set(rect.x - padX, rect.y - padY, rect.w + padX * 2, rect.h + padY * 2);
      uniforms.uShoreScale.value.x = Math.min(px, py) * shoreRange;
    },

    paint(time, boat, bobber, lunarTide) {
      if (disposed) return;
      uniforms.uTime.value = time;
      uniforms.uLunarTide.value = Number(Boolean(lunarTide));
      uniforms.uBoat.value.set(boat?.x ?? 0, boat?.y ?? 0, boat ? Math.max(0, Math.min(1, boat.speed)) : -1);
      uniforms.uBobber.value.set(bobber?.x ?? 0, bobber?.y ?? 0, bobber ? 1 : -1);
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      plane.removeFromParent();
      for (const shore of shores.values()) shore?.texture.dispose();
      shores.clear();
      material.dispose();
      geometry.dispose();
    },
  };
}
