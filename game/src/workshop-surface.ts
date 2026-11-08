import * as THREE from 'three'

export type WorkshopSurface = {
  raw: THREE.MeshStandardMaterial
  cut: THREE.MeshStandardMaterial
  setBaked(amount: number): void
  invalidateGraphics(): void
  dispose(): void
}

const surfaceShader = /* glsl */ `
uniform float doughBaked;
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
// Texture detail is calibrated to an ivory base under the authored window lights.
// Its local flour and gluten variation remains, without the generated map's orange cast.
vec3 doughN = normalize(vDoughNormal);
vec3 doughWeights = pow(abs(doughN), vec3(4.0));
doughWeights /= max(dot(doughWeights, vec3(1.0)), 0.001);
vec3 doughTexturePosition = vDoughPosition * 0.53 + vec3(0.5);
vec3 doughSkinSample = doughTriplanar(doughSkinMap, doughTexturePosition, doughWeights);
vec3 doughVariation = clamp(doughSkinSample / max(doughTextureMean, vec3(0.01)), vec3(0.68), vec3(1.65));
vec3 doughRawColour = doughIvory * mix(vec3(1.0), doughVariation, 0.88);
float doughSkinHeight = dot(doughVariation, vec3(0.23, 0.57, 0.20));
float doughSide = 1.0 - abs(doughN.y);
float doughRidge = clamp((length(dFdx(doughN)) + length(dFdy(doughN))) * 9.0, 0.0, 1.0);
vec3 doughDx = dFdx(vDoughPosition), doughDy = dFdy(vDoughPosition);
float doughCurvature = (dot(dFdx(doughN), doughDx) + dot(dFdy(doughN), doughDy))
  / max(dot(doughDx, doughDx) + dot(doughDy, doughDy), 0.00001);
float doughValley = smoothstep(0.10, 1.5, -doughCurvature);
float doughMottle = doughNoise(vDoughPosition.xz * 3.7 + vDoughPosition.y * vec2(1.9, 0.7));
float doughGrain = doughNoise(vDoughPosition.xz * 94.0 + vDoughPosition.y * vec2(23.0, 41.0));
float doughProgress = clamp(doughBaked + doughBaked * (1.0 - doughBaked)
  * (0.35 * doughSide + 0.22 * doughRidge + 0.30 * (doughMottle - 0.5)), 0.0, 1.0);
float doughCrust = smoothstep(0.10, 0.96, doughProgress) * (1.0 - doughCutFace);
vec3 doughCrustSample = doughTriplanar(doughBakedMap, doughTexturePosition, doughWeights);
vec3 doughCrustVariation = clamp(doughCrustSample / max(doughBakedMean, vec3(0.01)), vec3(0.65), vec3(1.9));
vec3 doughCrustColour = doughHoney * mix(vec3(1.0), doughCrustVariation, 0.58);
float doughToastedRidge = smoothstep(0.60, 1.0, doughProgress)
  * (0.10 + doughRidge * 0.27 + doughSide * 0.10) * (0.50 + doughMottle * 0.50);
doughCrustColour = mix(doughCrustColour, doughToast, doughToastedRidge);
float doughFlourDust = smoothstep(1.015, 1.13, dot(doughVariation, vec3(0.23, 0.57, 0.20)))
  * (0.32 + 0.68 * max(0.0, doughN.y));
doughFlourDust = max(doughFlourDust, doughValley * smoothstep(0.42, 0.76, doughGrain) * 0.28);
doughRawColour = mix(doughRawColour, doughFlour, doughFlourDust * 0.13);
doughCrustColour = mix(doughCrustColour, doughFlour, doughFlourDust * 0.62);
vec3 doughInterior = mix(doughRawColour, doughRawColour * vec3(1.015, 0.985, 0.93), doughBaked * doughCutFace * 0.45);
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
  const bakedMap = { value: bakedFallback as THREE.Texture }
  const skinMaps = new Map<THREE.MeshStandardMaterial, { value: THREE.Texture }>()
  const srgb = (r: number, g: number, b: number) => new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace)
  const bakedMean = srgb(240.55, 145.43, 46.83)

  function makeMaterial(cutFace: boolean): THREE.MeshStandardMaterial {
    const material = new THREE.MeshStandardMaterial({
      color: '#ffffff', map: cutFace ? cutFallback : rawFallback,
      roughness: cutFace ? 0.61 : 0.42, metalness: 0,
      transparent: true, opacity: 1, vertexColors: false,
      depthTest: true, depthWrite: true, dithering: true,
    })
    material.name = cutFace ? 'Authored dense dough cut face' : 'Authored ivory dough and honey crust'
    skinMaps.set(material, { value: cutFace ? cutFallback : rawFallback })
    material.onBeforeCompile = shader => {
      shader.uniforms.doughBaked = bake
      shader.uniforms.doughCutFace = { value: Number(cutFace) }
      shader.uniforms.doughBakedMap = bakedMap
      shader.uniforms.doughSkinMap = skinMaps.get(material)!
      shader.uniforms.doughTextureMean = { value: cutFace ? srgb(237.91, 214.81, 180.25) : srgb(239.28, 215.01, 184.10) }
      shader.uniforms.doughBakedMean = { value: bakedMean }
      shader.uniforms.doughIvory = { value: new THREE.Color(cutFace ? '#eee0c7' : '#f7dda9') }
      shader.uniforms.doughHoney = { value: new THREE.Color('#cd995b') }
      shader.uniforms.doughToast = { value: new THREE.Color('#b47a41') }
      shader.uniforms.doughFlour = { value: new THREE.Color('#f4e9d5') }
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vDoughPosition;\nvarying vec3 vDoughNormal;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvDoughPosition = transformed;\nvDoughNormal = normalize(objectNormal);')
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\n' + surfaceShader)
        .replace('#include <map_fragment>', '#include <map_fragment>\n' + surfaceColour)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
          roughnessFactor = clamp(mix(roughnessFactor, 0.63, doughCrust)
            + doughFlourDust * 0.34 + (doughGrain - 0.5) * 0.045, 0.34, 0.94);`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
          #ifdef USE_BUMPMAP
            // Planar rest UVs collapse on vertical walls. Keep their fine gluten relief local.
            normal = perturbNormalArb(-vViewPosition, normal,
              vec2(dFdx(doughSkinHeight), dFdy(doughSkinHeight))
                * (0.006 - doughCutFace * 0.003) * doughSide, faceDirection);
          #endif`)
        .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
          // The near wooden board returns a little warmer indirect light to sides and creases.
          reflectedLight.indirectDiffuse *= mix(vec3(1.0), vec3(1.12, 0.99, 0.86),
            (0.35 + 0.65 * doughSide) * (1.0 - doughCrust * 0.5));`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          // A restrained material-local scatter floor keeps the compressed underside warm.
          totalEmissiveRadiance += diffuseColor.rgb * (0.042 - doughCutFace * 0.010);`)
    }
    material.customProgramCacheKey = () => `lavender-dough-surface-v4-${Number(cutFace)}`
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

  function applyTexture(material: THREE.MeshStandardMaterial, texture: THREE.Texture, strength: number): void {
    material.map = texture
    skinMaps.get(material)!.value = texture
    const bump = own(texture.clone())
    bump.colorSpace = THREE.NoColorSpace
    bump.needsUpdate = true
    material.bumpMap = bump
    material.bumpScale = strength
    material.needsUpdate = true
  }
  load('raw', texture => applyTexture(raw, texture, 0.014))
  load('cut', texture => applyTexture(cut, texture, 0.007))
  load('baked', texture => { bakedMap.value = texture })

  function invalidateGraphics(): void {
    textures.forEach(texture => texture.dispose())
    raw.dispose()
    cut.dispose()
  }

  return {
    raw, cut,
    invalidateGraphics,
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
