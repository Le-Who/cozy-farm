import * as THREE from 'three'

export type BreadForm = 'round' | 'folded' | 'long'
export type BakingDough = { source: Float32Array; scores: Float32Array; floor: number; height: number }

/** Capture the actual hand-shaped mesh once. Rising never replaces its outline. */
export function prepareDoughBaking(geometry: THREE.BufferGeometry, shape: BreadForm): BakingDough {
  geometry.computeBoundingBox()
  const box = geometry.boundingBox!, size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3())
  const position = geometry.getAttribute('position'), normal = geometry.getAttribute('normal')
  const source = new Float32Array(position.array), scores = new Float32Array(position.count)
  for (let i = 0; i < position.count; i++) {
    const x = (position.getX(i) - center.x) / Math.max(.01, size.x) * 2
    const z = (position.getZ(i) - center.z) / Math.max(.01, size.z) * 2
    const top = THREE.MathUtils.smoothstep(normal.getY(i), .15, .65)
      * THREE.MathUtils.smoothstep((position.getY(i) - box.min.y) / Math.max(.01, size.y), .4, .85)
    const edge = 1 - THREE.MathUtils.smoothstep(Math.max(Math.abs(x), Math.abs(z)), .65, .93)
    let score = 0
    if (shape === 'long') {
      for (const cut of [-.44, 0, .44]) score = Math.max(score, Math.exp(-(((x - cut - z * .22) / .026) ** 2)))
    } else if (shape === 'round') {
      score = Math.max(Math.exp(-(((x + z * .12) / .03) ** 2)), Math.exp(-(((z - x * .12) / .03) ** 2)))
    }
    scores[i] = score * top * edge
  }
  geometry.setAttribute('doughScore', new THREE.BufferAttribute(scores, 1))
  return { source, scores, floor: box.min.y, height: size.y }
}

export function riseDough(geometry: THREE.BufferGeometry, dough: BakingDough, amount: number): void {
  const t = THREE.MathUtils.clamp(amount, 0, 1), rise = t * t * (3 - 2 * t)
  const position = geometry.getAttribute('position') as THREE.BufferAttribute
  for (let i = 0; i < position.count; i++) {
    const k = i * 3, y = dough.source[k + 1] - dough.floor
    const upper = THREE.MathUtils.smoothstep(y / Math.max(.01, dough.height), .15, .95)
    position.setXYZ(i, dough.source[k], dough.floor + y * (1 + .32 * rise)
      + upper * Math.min(.16, dough.height * .24) * rise
      - dough.scores[i] * Math.min(.085, dough.height * .10) * rise, dough.source[k + 2])
  }
  position.needsUpdate = true
  geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere()
}
