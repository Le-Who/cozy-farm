import * as THREE from 'three'

export type WorkshopSurface = {
  raw: THREE.MeshStandardMaterial
  cut: THREE.MeshStandardMaterial
  setBaked(amount: number): void
  setCrustRoughness(amount: number): void
  invalidateGraphics(): void
  dispose(): void
}

const surfaceShader = /* glsl */ `
uniform float doughBaked;
uniform float doughCrustRoughness;
uniform float doughCutFace;
uniform sampler2D doughBakedMap;
uniform sampler2D doughSkinMap;
uniform vec3 doughTextureMean;
uniform vec3 doughBakedMean;
uniform vec3 doughIvory;
uniform vec3 doughHoney;
uniform vec3 doughToast;
uniform vec3 doughFlour;
varying vec3 vDoughPosition;
varying vec3 vDoughNormal;
varying float vDoughScore;

float doughHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float doughNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(doughHash(i), doughHash(i + vec2(1.0, 0.0)), f.x),
    mix(doughHash(i + vec2(0.0, 1.0)), doughHash(i + vec2(1.0)), f.x), f.y);
}
vec3 doughTriplanar(sampler2D surfaceMap, vec3 p, vec3 weights) {
  return texture2D(surfaceMap, p.zy).rgb * weights.x
    + texture2D(surfaceMap, p.xz).rgb * weights.y
    + texture2D(surfaceMap, p.xy).rgb * weights.z;
}
`

const surfaceColour = /* glsl */ `
// Current object-space distance keeps the surface scale constant while the hands reshape it.
// Geometry normals describe the folds; no UV or texture derivatives perturb those normals.
vec3 doughN = normalize(vDoughNormal);
vec3 doughWeights = pow(abs(doughN), vec3(4.0));
doughWeights /= max(dot(doughWeights, vec3(1.0)), 0.001);
vec3 doughTexturePosition = vDoughPosition * 0.53 + vec3(0.5);
vec3 doughSkinSample = doughTriplanar(doughSkinMap, doughTexturePosition, doughWeights);
float doughSkinTone = clamp(dot(doughSkinSample, vec3(0.2126, 0.7152, 0.0722))
  / max(dot(doughTextureMean, vec3(0.2126, 0.7152, 0.0722)), 0.01), 0.82, 1.18);
float doughSide = 1.0 - abs(doughN.y);
float doughMottle = doughNoise(vDoughPosition.xz * 1.45 + vDoughPosition.y * vec2(0.7, 0.4));
vec3 doughRawColour = doughIvory * (1.0 + (doughSkinTone - 1.0) * 0.16);
doughRawColour = mix(doughRawColour, doughFlour, 0.025 * doughMottle);
float doughProgress = clamp(doughBaked + doughBaked * (1.0 - doughBaked)
  * (0.16 * doughSide + 0.12 * (doughMottle - 0.5)), 0.0, 1.0);
float doughCrust = smoothstep(0.10, 0.96, doughProgress) * (1.0 - doughCutFace);
vec3 doughCrustSample = doughTriplanar(doughBakedMap, doughTexturePosition, doughWeights);
float doughCrustTone = clamp(dot(doughCrustSample, vec3(0.2126, 0.7152, 0.0722))
  / max(dot(doughBakedMean, vec3(0.2126, 0.7152, 0.0722)), 0.01), 0.58, 1.42);
float doughGoldenEdge = smoothstep(0.45, 1.0, doughProgress)
  * (0.04 + doughSide * 0.58 + (doughMottle - 0.5) * 0.08);
vec3 doughCrustColour = mix(doughHoney, doughToast, doughGoldenEdge)
  * (1.0 + (doughCrustTone - 1.0) * 0.42);
doughCrustColour = mix(doughCrustColour, doughHoney * mix(vec3(1.10, 1.03, 0.87), vec3(0.66, 0.57, 0.48), smoothstep(0.65, 1.0, vDoughScore)), vDoughScore * doughBaked * 0.9);
vec3 doughInterior = mix(doughRawColour, doughRawColour * vec3(1.0, 0.99, 0.96), doughBaked * doughCutFace * 0.35);
diffuseColor.rgb = mix(doughInterior, doughCrustColour, doughCrust);
`

function placeholder(rgb: readonly [number, number, number]): THREE.DataTexture {
  const texture = new THREE.DataTexture(new Uint8Array([...rgb, 255]), 1, 1, THREE.RGBAFormat)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.needsUpdate = true
  return texture
}

/** Shared dough materials; deformation, normals, depth and draw order belong to the scene. */
export function createWorkshopSurface(): WorkshopSurface {
  const textures = new Set<THREE.Texture>()
  const loader = typeof document === 'undefined' ? undefined : new THREE.TextureLoader()
  let disposed = false
  const own = <T extends THREE.Texture>(texture: T): T => { textures.add(texture); return texture }
  const rawFallback = own(placeholder([239, 215, 184]))
  const cutFallback = own(placeholder([238, 215, 180]))
  const bakedFallback = own(placeholder([241, 145, 47]))
  const bake = { value: 0 }
  const crustRoughness = { value: .65 }
  const bakedMap = { value: bakedFallback as THREE.Texture }
  const skinMaps = new Map<THREE.MeshStandardMaterial, { value: THREE.Texture }>()
  const srgb = (r: number, g: number, b: number) => new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace)
  const bakedMean = srgb(240.55, 145.43, 46.83)

  function makeMaterial(cutFace: boolean): THREE.MeshStandardMaterial {
    const material = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: cutFace ? 0.72 : 0.49, metalness: 0,
      transparent: true, opacity: 1, vertexColors: false,
      depthTest: true, depthWrite: true, dithering: true,
    })
    material.name = cutFace ? 'Authored dense dough cut face' : 'Authored ivory dough and honey crust'
    skinMaps.set(material, { value: cutFace ? cutFallback : rawFallback })
    material.onBeforeCompile = shader => {
      shader.uniforms.doughBaked = bake
      shader.uniforms.doughCrustRoughness = crustRoughness
      shader.uniforms.doughCutFace = { value: Number(cutFace) }
      shader.uniforms.doughBakedMap = bakedMap
      shader.uniforms.doughSkinMap = skinMaps.get(material)!
      shader.uniforms.doughTextureMean = { value: cutFace ? srgb(237.91, 214.81, 180.25) : srgb(239.28, 215.01, 184.10) }
      shader.uniforms.doughBakedMean = { value: bakedMean }
      shader.uniforms.doughIvory = { value: new THREE.Color(cutFace ? '#ffebc5' : '#ffe3ad') }
      shader.uniforms.doughHoney = { value: new THREE.Color('#ef9e45') }
      shader.uniforms.doughToast = { value: new THREE.Color('#c16e35') }
      shader.uniforms.doughFlour = { value: new THREE.Color('#fff4df') }
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vDoughPosition;\nvarying vec3 vDoughNormal;\nvarying float vDoughScore;\nattribute float doughScore;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvDoughPosition = transformed;\nvDoughNormal = normalize(objectNormal);\nvDoughScore = doughScore;')
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\n' + surfaceShader)
        .replace('#include <map_fragment>', surfaceColour)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
          roughnessFactor = mix(roughnessFactor, doughCrustRoughness, doughCrust);`)
        .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
          // The near wooden board returns a little warmer indirect light to sides and creases.
          reflectedLight.indirectDiffuse *= mix(vec3(1.0), vec3(1.04, 1.0, 0.96),
            (0.35 + 0.65 * doughSide) * (1.0 - doughCrust * 0.5));`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          // A restrained material-local scatter floor keeps the compressed underside warm.
          totalEmissiveRadiance += diffuseColor.rgb
            * mix(0.27 + 0.10 * doughSide, 0.16, doughCrust);`)
    }
    material.customProgramCacheKey = () => `lavender-dough-surface-v6-${Number(cutFace)}`
    return material
  }

  const raw = makeMaterial(false)
  const cut = makeMaterial(true)

  function load(name: string, accept: (texture: THREE.Texture) => void): void {
    if (!loader) return
    const base = import.meta.env?.BASE_URL ?? '/'
    own(loader.load(`${base}art/lavender/workshop-authored/dough-${name}-surface.webp`, texture => {
      if (disposed) { texture.dispose(); return }
      texture.colorSpace = THREE.SRGBColorSpace
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping
      texture.anisotropy = 4
      texture.repeat.set(1.6, 1.6)
      accept(texture)
    }, undefined, () => { /* The authored ivory fallback remains usable if a map is unavailable. */ }))
  }

  function applyTexture(material: THREE.MeshStandardMaterial, texture: THREE.Texture): void {
    skinMaps.get(material)!.value = texture
  }
  load('raw', texture => applyTexture(raw, texture))
  load('cut', texture => applyTexture(cut, texture))
  load('baked', texture => { bakedMap.value = texture })

  function invalidateGraphics(): void {
    textures.forEach(texture => texture.dispose())
    raw.dispose()
    cut.dispose()
  }

  return {
    raw, cut,
    invalidateGraphics,
    setCrustRoughness(amount: number): void { crustRoughness.value = THREE.MathUtils.clamp(amount, .3, 1) },
    setBaked(amount: number): void {
      if (disposed) return
      bake.value = Number.isFinite(amount) ? THREE.MathUtils.clamp(amount, 0, 1) : 0
    },
    dispose(): void {
      if (disposed) return
      disposed = true
      invalidateGraphics()
      textures.clear()
      skinMaps.clear()
    },
  }
}
