import {
  DataTexture, LinearFilter, LinearMipmapLinearFilter, Mesh, PlaneGeometry, RedFormat, type Scene,
  ShaderMaterial, SRGBColorSpace, Texture, UnsignedByteType, Vector2, Vector3, Vector4,
} from 'three';

type Point = { x: number; y: number };
type Rect = Point & { w: number; h: number };
type Boat = Point & { speed: number };

type WaterLayer = {
  resize(width: number, height: number, dpr?: number): void;
  setTexture(image: HTMLImageElement): void;
  setShore(image: HTMLImageElement, rect: Rect, minY: number): void;
  paint(time: number, boat?: Boat, bobber?: Point): void;
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
  uniform sampler2D uPaint;
  uniform float uPaintAspect;
  uniform sampler2D uShore;
  uniform vec4 uShoreRect;
  uniform vec2 uShoreScale;
  uniform vec3 uBoat;
  uniform vec3 uBobber;

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
    float behind = -d.x - 10.0;
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
    vec2 flow = vec2(p.x * 0.022, p.y * 0.064) / (0.80 + 0.34 * uv.y);
    float t = uTime;
    float a = dot(flow, vec2(0.29, 0.92)) - t * 0.88;
    float b = dot(flow, vec2(-0.68, 0.57)) + t * 0.62;
    float c = dot(flow, vec2(0.93, 1.28)) - t * 1.21;
    float swell = sin(a + sin(b) * 0.46);
    float cross = sin(b + sin(c) * 0.24);
    float pattern = noise(flow * vec2(0.83, 0.58) + vec2(t * 0.12, -t * 0.17));
    vec3 color = mix(vec3(0.035, 0.36, 0.40), vec3(0.016, 0.205, 0.32), uv.y);
    if (uPaintAspect > 0.0) {
      float aspect = uSize.x / uSize.y;
      vec2 cover = vec2(min(1.0, aspect / uPaintAspect), min(1.0, uPaintAspect / aspect));
      vec2 paintUV = (uv - 0.5) * cover * 0.974 + 0.5;
      paintUV += vec2(cross * 0.009, swell * 0.007) * cover;
      color = mix(texture2D(uPaint, vec2(paintUV.x, 1.0 - paintUV.y)).rgb, color, 0.26);
    }

    color *= 0.99 + swell * 0.032 + cross * 0.022;
    float lightDistance = (uv.x - 0.31 + uv.y * 0.20) * 2.8;
    float sunlight = exp(-lightDistance * lightDistance) * (1.0 - uv.y * 0.45);
    float ribbons = smoothstep(0.79, 0.995, swell) * smoothstep(0.40, 0.81, pattern);
    float glints = smoothstep(0.86, 0.99, sin(c + swell * 0.42)) * smoothstep(0.72, 0.91, pattern);
    vec3 light = vec3(0.68, 0.86, 0.69);
    color = mix(color, light, ribbons * (0.064 + sunlight * 0.095) + glints * sunlight * 0.32);

    if (uShoreScale.x > 0.0 && p.y > uShoreScale.y) {
      vec2 shoreUV = (p - uShoreRect.xy) / uShoreRect.zw;
      if (all(greaterThanEqual(shoreUV, vec2(0.0))) && all(lessThanEqual(shoreUV, vec2(1.0)))) {
        float shoreDistance = texture2D(uShore, shoreUV).r;
        float distance = shoreDistance * uShoreScale.x;
        float mask = smoothstep(uShoreScale.y, uShoreScale.y + 38.0, p.y)
                   * (1.0 - smoothstep(0.72, 0.98, shoreDistance));
        float shallows = (1.0 - smoothstep(1.0, 73.0, distance)) * mask;
        float tide = distance + swell * 2.3 + cross * 1.6;
        float contact = (1.0 - smoothstep(0.0, 7.0, distance)) * mask;
        float foam = band(7.0, 4.0, tide) * (0.20 + smoothstep(0.22, 0.78, pattern) * 0.80)
                   + band(17.0, 5.8, tide) * smoothstep(0.48, 0.88, pattern) * 0.40;
        color *= 1.0 - contact * 0.13;
        color = mix(color, vec3(0.068, 0.44, 0.35), shallows * 0.53);
        color = mix(color, light, foam * mask * 0.40);
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

  const painted = new Texture();
  painted.colorSpace = SRGBColorSpace;
  painted.minFilter = LinearMipmapLinearFilter;
  const shores = new Map<HTMLImageElement, ShoreTexture | undefined>();
  const uniforms = {
    uSize: { value: new Vector2(1, 1) },
    uTime: { value: 0 },
    uPaint: { value: painted },
    uPaintAspect: { value: 0 },
    uShore: { value: null as DataTexture | null },
    uShoreRect: { value: new Vector4() },
    uShoreScale: { value: new Vector2() },
    uBoat: { value: new Vector3(0, 0, -1) },
    uBobber: { value: new Vector3(0, 0, -1) },
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

    setTexture(image) {
      if (disposed || painted.image === image || !image.naturalWidth || !image.naturalHeight) return;
      painted.image = image;
      painted.needsUpdate = true;
      uniforms.uPaintAspect.value = image.naturalWidth / image.naturalHeight;
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

    paint(time, boat, bobber) {
      if (disposed) return;
      uniforms.uTime.value = time;
      uniforms.uBoat.value.set(boat?.x ?? 0, boat?.y ?? 0, boat ? Math.max(0, Math.min(1, boat.speed)) : -1);
      uniforms.uBobber.value.set(bobber?.x ?? 0, bobber?.y ?? 0, bobber ? 1 : -1);
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      plane.removeFromParent();
      painted.dispose();
      for (const shore of shores.values()) shore?.texture.dispose();
      shores.clear();
      material.dispose();
      geometry.dispose();
    },
  };
}
