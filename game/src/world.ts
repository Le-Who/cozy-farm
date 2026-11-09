import {
  BufferAttribute, BufferGeometry, Color, DoubleSide, Group, HemisphereLight, DirectionalLight, Line,
  LineBasicMaterial, LinearFilter, Matrix4, Mesh,
  MeshStandardMaterial, OrthographicCamera, PlaneGeometry, Scene, ShaderMaterial,
  SphereGeometry, SRGBColorSpace, Texture, Vector4, WebGLRenderer,
} from 'three';
import { createWaterLayer } from './water';

type Box = { x: number; y: number; w: number; h: number };
type Raster = HTMLImageElement | HTMLCanvasElement;
export type SpriteOptions = {
  frame?: number;
  opacity?: number;
  flip?: boolean;
  shadow?: boolean;
  fullCell?: boolean;
  baseline?: number;
  angle?: number;
  bend?: number;
  scaleY?: number;
  footY?: number;
  layer?: number;
  lift?: number;
  edgeFade?: { left?: number; top?: number; right?: number; bottom?: number };
};
type Shape = 'ellipse' | 'outline' | 'ripple' | 'shade' | 'diamond' | 'panel' | 'plot';

// X is across the island, Z is along the ground and Y is elevation. The
// authored image coordinates are the orthographic projection of that ground.
const pitch = Math.PI * 40 / 180;
const sin = Math.sin(pitch);
const cos = Math.cos(pitch);
const distance = 3600;
const background = -100;
const decals = -40;
const overlay = 40;
const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const fragmentShader = `
  varying vec2 vUv;
  uniform sampler2D uMap;
  uniform vec4 uRect;
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform vec4 uEdgeFade;
  uniform int uMode;
  void main() {
    vec4 color = vec4(uColor, uOpacity);
    if (uMode < 2) {
      vec4 art = texture2D(uMap, uRect.xy + vUv * uRect.zw);
      if (uMode == 0) color.rgb *= art.rgb;
      color.a *= art.a;
      if (uEdgeFade.x > 0.0) color.a *= smoothstep(0.0, uEdgeFade.x, vUv.x);
      if (uEdgeFade.y > 0.0) color.a *= smoothstep(0.0, uEdgeFade.y, 1.0 - vUv.y);
      if (uEdgeFade.z > 0.0) color.a *= smoothstep(0.0, uEdgeFade.z, 1.0 - vUv.x);
      if (uEdgeFade.w > 0.0) color.a *= smoothstep(0.0, uEdgeFade.w, vUv.y);
      if (uMode == 1) color.a *= mix(1.0, 0.45, vUv.y);
    } else {
      vec2 p = (vUv - 0.5) * 2.0;
      float d = length(p);
      float edge = max(fwidth(d), 0.008);
      if (uMode == 2) color.a *= 1.0 - smoothstep(1.0 - edge, 1.0, d);
      if (uMode == 3 || uMode == 4) {
        color.a *= smoothstep(0.84 - edge, 0.86, d) * (1.0 - smoothstep(0.97 - edge, 1.0, d));
        if (uMode == 4) color.a *= smoothstep(-0.95, 0.30, p.x + p.y * 0.6);
      }
      if (uMode == 5) color.a *= pow(max(0.0, 1.0 - d * d), 2.1);
      if (uMode == 6) color.a *= 1.0 - smoothstep(0.89, 1.0, abs(p.x) + abs(p.y));
      if (uMode == 8) {
        vec2 q = abs(p * vec2(1.0, 0.54)) - vec2(0.79, 0.34);
        float rim = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - 0.13;
        color.a *= 1.0 - smoothstep(0.015, 0.015 + fwidth(rim), abs(rim));
      }
    }
    if (color.a < 0.009) discard;
    gl_FragColor = color;
    #include <colorspace_fragment>
  }
`;
const modes = { ellipse: 2, outline: 3, ripple: 4, shade: 5, diamond: 6, panel: 7, plot: 8 } satisfies Record<Shape, number>;

export function createWorld(canvas: HTMLCanvasElement, onAvailability: (available: boolean) => void) {
  let renderer: WebGLRenderer | undefined;
  const context = canvas.getContext('webgl2', { alpha: false, antialias: true });
  if (context) {
    try {
      renderer = new WebGLRenderer({ canvas, context, alpha: false, antialias: true });
    } catch (error) {
      console.warn('Could not initialize the island renderer', error);
    }
  }
  const scene = new Scene();
  const camera = new OrthographicCamera(-720, 720, 450, -450, 1, 9000);
  const water = createWaterLayer(scene);
  const unitPlane = new PlaneGeometry(1, 1);
  const textures = new Map<Raster, Texture>();
  const palette = new Map<string, { rgb: Color; alpha: number }>();
  const pool: Mesh<PlaneGeometry, ShaderMaterial>[] = [];
  let view = { x: 720, y: 450, w: 1440, h: 900 };
  let active = 0, previousActive = 0;
  let available = Boolean(renderer);
  const light = new DirectionalLight('#fff0c9', 2.4);
  light.position.set(-350, 500, -180);
  scene.add(light, new HemisphereLight('#fff3cf', '#64a1a1', 1.5));
  const bobber = new Group();
  const floatGeometry = new SphereGeometry(1, 16, 10);
  const floatBase = new Mesh(floatGeometry, new MeshStandardMaterial({ color: '#f88463', roughness: 0.65 }));
  const floatTop = new Mesh(floatGeometry, new MeshStandardMaterial({ color: '#fff1c5', roughness: 0.76 }));
  floatBase.scale.set(3.3, 3, 3.3);
  floatTop.scale.set(2.2, 1.7, 2.2);
  floatTop.position.y = 2.3;
  bobber.add(floatBase, floatTop);
  bobber.visible = false;
  scene.add(bobber);
  const linePoints = new BufferAttribute(new Float32Array(36), 3);
  const lineGeometry = new BufferGeometry();
  lineGeometry.setAttribute('position', linePoints);
  const lineMaterial = new LineBasicMaterial({ color: '#fff5d1', transparent: true, opacity: 0.67, depthWrite: false });
  const line = new Line(lineGeometry, lineMaterial);
  line.visible = false;
  line.frustumCulled = false;
  scene.add(line);

  function status(next: boolean): void {
    available = next;
    canvas.dataset.worldRenderer = next ? 'three' : 'unavailable';
    onAvailability(next);
  }
  function lost(event: Event): void {
    event.preventDefault();
    status(false);
  }
  function restored(): void { status(Boolean(renderer)); }
  canvas.addEventListener('webglcontextlost', lost);
  canvas.addEventListener('webglcontextrestored', restored);
  canvas.dataset.worldRenderer = available ? 'three' : 'unavailable';

  function mesh(layer: number): Mesh<PlaneGeometry, ShaderMaterial> {
    let node = pool[active++];
    if (!node) {
      const material = new ShaderMaterial({
        vertexShader, fragmentShader, transparent: true, toneMapped: false, side: DoubleSide, forceSinglePass: true,
        uniforms: {
          uMap: { value: null }, uRect: { value: new Vector4() },
          uColor: { value: new Color() }, uOpacity: { value: 1 }, uMode: { value: 0 }, uEdgeFade: { value: new Vector4() },
        },
      });
      node = new Mesh(unitPlane, material);
      node.frustumCulled = false;
      node.matrixAutoUpdate = false;
      pool.push(node);
      scene.add(node);
    }
    node.visible = true;
    node.renderOrder = layer;
    node.material.depthTest = layer === 0;
    node.material.depthWrite = layer === 0;
    return node;
  }

  function ink(color: string): { rgb: Color; alpha: number } {
    let value = palette.get(color);
    if (!value) {
      const alpha = color.length === 9 ? Number.parseInt(color.slice(7), 16) / 255 : 1;
      value = { rgb: new Color(color.length === 9 ? color.slice(0, 7) : color), alpha };
      palette.set(color, value);
    }
    return value;
  }

  function texture(source: Raster): Texture {
    let map = textures.get(source);
    if (!map) {
      map = new Texture(source);
      map.colorSpace = SRGBColorSpace;
      // Linear filtering without atlas-wide mipmaps avoids bleeding across poses.
      map.minFilter = LinearFilter;
      map.generateMipmaps = false;
      map.needsUpdate = true;
      textures.set(source, map);
    }
    return map;
  }

  function billboard(matrix: Matrix4, x: number, y: number, footY: number, w: number, h: number,
    origin: number, baseline: number, angle: number, bend: number, flip: boolean): void {
    const c = Math.cos(angle), s = Math.sin(angle);
    const a = c * (flip ? -1 : 1), b = s - c * bend;
    const d = -s * (flip ? -1 : 1), e = c + s * bend;
    const px = (0.5 - origin) * w;
    const py = (baseline - 0.5) * h;
    const up = footY - y + d * px + e * py;
    matrix.set(
      a * w, b * h, 0, x + a * px + b * py,
      d * w * cos, e * h * cos, sin, up * cos,
      -d * w * sin, -e * h * sin, cos, footY / sin - up * sin,
      0, 0, 0, 1,
    );
  }

  // Project the four corners of a unit quad onto the island camera axes.
  // Using its rotated, sheared matrix also covers wind-bent foliage and long shadows.
  function inView(matrix: Matrix4): boolean {
    const m = matrix.elements;
    const halfWidth = (Math.abs(m[0]) + Math.abs(m[4])) * .5;
    const halfHeight = (Math.abs(m[2] * sin - m[1] * cos) + Math.abs(m[6] * sin - m[5] * cos)) * .5;
    const screenY = m[14] * sin - m[13] * cos;
    return Math.abs(m[12] - view.x) <= view.w * .5 + halfWidth + 1 &&
      Math.abs(screenY - view.y) <= view.h * .5 + halfHeight + 1;
  }

  function sprite(source: Raster, src: Box, x: number, y: number, w: number, h: number,
    options: SpriteOptions = {}, origin = 0.5): void {
    if (options.opacity === 0 || !w || !h) return;
    const shadow = options.shadow;
    const layer = options.layer ?? (shadow ? decals : 0);
    const node = mesh(layer);
    const uniforms = node.material.uniforms;
    const sourceWidth = source instanceof HTMLImageElement ? source.naturalWidth : source.width;
    const sourceHeight = source instanceof HTMLImageElement ? source.naturalHeight : source.height;
    uniforms.uMap.value = texture(source);
    if (src.w === sourceWidth && src.h === sourceHeight) uniforms.uRect.value.set(0, 0, 1, 1);
    else uniforms.uRect.value.set(
      (src.x + 0.5) / sourceWidth, 1 - (src.y + src.h - 0.5) / sourceHeight,
      Math.max(0, src.w - 1) / sourceWidth, Math.max(0, src.h - 1) / sourceHeight,
    );
    uniforms.uMode.value = shadow ? 1 : 0;
    uniforms.uEdgeFade.value.set(options.edgeFade?.left ?? 0, options.edgeFade?.top ?? 0, options.edgeFade?.right ?? 0, options.edgeFade?.bottom ?? 0);
    uniforms.uColor.value.copy(ink(shadow ? '#595842' : '#ffffff').rgb);
    const lift = options.lift ?? 0;
    uniforms.uOpacity.value = (options.opacity ?? 1) * (shadow ? 0.17 / (1 + lift * 0.033) : 1);
    const displayedHeight = h * (options.scaleY ?? 1);
    if (shadow) {
      // Compose the sprite's pose with the ground projection, around its foot pivot.
      const c = Math.cos(options.angle ?? 0), s = Math.sin(options.angle ?? 0);
      const flip = options.flip ? -1 : 1;
      const a = c * flip, b = s - c * (options.bend ?? 0);
      const d = -s * flip, e = c + s * (options.bend ?? 0);
      const ax = a + 0.24 * d, bx = b + 0.24 * e;
      const az = 0.13 * d / sin, bz = 0.13 * e / sin;
      const px = (0.5 - origin) * w;
      const py = ((options.baseline ?? 1) - 0.5) * displayedHeight;
      node.matrix.set(
        ax * w, bx * displayedHeight, 0, x + ax * px + bx * py + lift * 0.31,
        0, 0, 1, 0.3,
        az * w, bz * displayedHeight, 0, (options.footY ?? y) / sin + az * px + bz * py + lift * 0.18 / sin,
        0, 0, 0, 1,
      );
    } else {
      billboard(node.matrix, x, y, options.footY ?? y, w, displayedHeight, origin, options.baseline ?? 1,
        options.angle ?? 0, options.bend ?? 0, Boolean(options.flip));
    }
    node.visible = inView(node.matrix);
    node.matrixWorldNeedsUpdate = true;
  }

  function shape(kind: Shape, x: number, y: number, w: number, h: number, color: string,
    opacity = 1, layer = decals, angle = 0, footY = y): void {
    const tint = ink(color);
    if (opacity <= 0 || tint.alpha === 0 || !w || !h) return;
    const node = mesh(layer);
    const uniforms = node.material.uniforms;
    uniforms.uMode.value = modes[kind];
    uniforms.uEdgeFade.value.set(0, 0, 0, 0);
    uniforms.uColor.value.copy(tint.rgb);
    uniforms.uOpacity.value = opacity * tint.alpha;
    billboard(node.matrix, x, y, footY, w * 2, h * 2, 0.5, 0.5, angle, 0, false);
    node.visible = inView(node.matrix);
    node.matrixWorldNeedsUpdate = true;
  }

  function setView(width: number, height: number, scale: number, center: { x: number; y: number }) {
      view = { ...center, w: width / scale, h: height / scale };
      camera.left = -width / (scale * 2);
      camera.right = -camera.left;
      camera.top = height / (scale * 2);
      camera.bottom = -camera.top;
      const z = center.y / sin;
      camera.position.set(center.x, distance * sin, z + distance * cos);
      camera.lookAt(center.x, 0, z);
      camera.updateProjectionMatrix();
  }

  return {
    water, sprite, shape, overlay, decals, setView,
    get available() { return available; },
    resize(width: number, height: number, dpr: number, scale: number, center: { x: number; y: number }) {
      setView(width, height, scale, center);
      renderer?.setDrawingBufferSize(width, height, Math.min(dpr, 1.7, Math.sqrt(2_400_000 / (width * height))));
      water.resize(width, height);
    },
    begin() {
      previousActive = active; active = 0;
      bobber.visible = false;
      line.visible = false;
    },
    plate(image: HTMLImageElement, bounds: Box, patch = false, opacity = 1, edgeFade?: SpriteOptions['edgeFade']) {
      sprite(image, { x: 0, y: 0, w: image.naturalWidth, h: image.naturalHeight },
        bounds.x + bounds.w / 2, bounds.y, bounds.w, bounds.h, { baseline: 0, layer: background + Number(patch), opacity, edgeFade });
    },
    occluder(image: HTMLImageElement, bounds: Box & { footY: number }) {
      sprite(image, { x: 0, y: 0, w: image.naturalWidth, h: image.naturalHeight },
        bounds.x + bounds.w / 2, bounds.y, bounds.w, bounds.h, { baseline: 0, footY: bounds.footY });
    },
    float(x: number, y: number, time: number, bite: number) {
      bobber.visible = true;
      // The buoy floats in front of the painted shore, with actual volume and lighting.
      const height = 2.6 - 1.2 * bite;
      bobber.position.set(x, height, (y + height * cos) / sin);
      bobber.rotation.z = Math.sin(time * 3.2) * 0.19 + 0.68 * bite;
    },
    fishingLine(fromX: number, fromY: number, x: number, y: number) {
      for (let i = 0; i < linePoints.count; i++) {
        const t = i / (linePoints.count - 1);
        const px = fromX + (x - fromX) * t + 10 * t * (1 - t);
        const py = fromY + (y - fromY) * t + 14 * t * (1 - t);
        const height = 3 + (1 - t) * 44;
        linePoints.setXYZ(i, px, height, (py + height * cos) / sin);
      }
      linePoints.needsUpdate = true;
      line.visible = true;
    },
    wash(color: string) {
      shape('panel', view.x, view.y, view.w / 2, view.h / 2, color, 1, overlay + 10);
    },
    render() {
      for (let i = active; i < previousActive; i++) pool[i].visible = false;
      if (available) renderer?.render(scene, camera);
    },
    dispose() {
      canvas.removeEventListener('webglcontextlost', lost);
      canvas.removeEventListener('webglcontextrestored', restored);
      water.dispose();
      unitPlane.dispose();
      floatGeometry.dispose();
      floatBase.material.dispose();
      floatTop.material.dispose();
      lineGeometry.dispose();
      lineMaterial.dispose();
      for (const node of pool) node.material.dispose();
      for (const map of textures.values()) map.dispose();
      renderer?.dispose();
    },
  };
}

export type IslandWorld = ReturnType<typeof createWorld>;
