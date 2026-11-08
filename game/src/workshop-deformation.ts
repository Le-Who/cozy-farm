import * as THREE from 'three'

export type DoughHandAction = 'knead' | 'cup' | 'fold' | 'roll'
export interface DoughHandle {
  positions: Float32Array
  x: number
  z: number
  radius: number
  height: number
  volume: number
}

function volume(positions: Float32Array, index: THREE.BufferGeometry['index']): number {
  let sum = 0
  const count = index?.count ?? positions.length / 3
  for (let i = 0; i < count; i += 3) {
    const a = (index ? index.getX(i) : i) * 3, b = (index ? index.getX(i + 1) : i + 1) * 3, c = (index ? index.getX(i + 2) : i + 2) * 3
    sum += positions[a] * (positions[b + 1] * positions[c + 2] - positions[b + 2] * positions[c + 1])
      + positions[a + 1] * (positions[b + 2] * positions[c] - positions[b] * positions[c + 2])
      + positions[a + 2] * (positions[b] * positions[c + 1] - positions[b + 1] * positions[c])
  }
  return Math.abs(sum / 6)
}

export function latchDoughHandle(geometry: THREE.BufferGeometry, x: number, z: number): DoughHandle {
  geometry.computeBoundingBox()
  const bounds = geometry.boundingBox!, size = bounds.getSize(new THREE.Vector3())
  const positions = new Float32Array(geometry.getAttribute('position').array)
  return { positions, x, z, radius: Math.max(.16, Math.min(size.x, size.z) * .42), height: size.y, volume: volume(positions, geometry.index) }
}

/** A latched material handle: its smooth support widens as the same patch stretches.
 * All seam duplicates receive the same transform, including the underside and cut caps. */
export function shapeDoughHandle(geometry: THREE.BufferGeometry, handle: DoughHandle, dx: number, dz: number, pressure: number, action: DoughHandAction, board: THREE.Box3): void {
  const positions = geometry.getAttribute('position') as THREE.BufferAttribute, out = positions.array as Float32Array
  const travel = Math.hypot(dx, dz), radius = Math.max(handle.radius, travel * 1.15)
  const press = Math.min(2.2, Math.max(0, pressure)), floor = .002
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, minY = Infinity, maxY = -Infinity
  for (let i = 0; i < out.length; i += 3) {
    const x = handle.positions[i], y = handle.positions[i + 1], z = handle.positions[i + 2]
    const sourceX = x - handle.x, sourceZ = z - handle.z, weight = Math.exp(-(sourceX * sourceX + sourceZ * sourceZ) / (radius * radius))
    // Compose two smooth maps. Adding a large pull to an inward cup can invert
    // triangles; transport the column first, then apply the pressure around it.
    const movedX=x+dx*weight,movedZ=z+dz*weight,centerX=handle.x+dx,centerZ=handle.z+dz
    const rx=movedX-centerX,rz=movedZ-centerZ
    const pressWeight = Math.exp(-(rx * rx + rz * rz) / ((handle.radius * 1.85) ** 2))
    const upper = Math.max(0, Math.min(1, y / Math.max(.05, handle.height)))
    const squeeze = action === 'cup' ? -press * .2 : press * (action === 'roll' ? .48 : .38)
    const spread = Math.exp(squeeze * pressWeight)
    let px = centerX + rx * spread, pz = centerZ + rz * spread
    let py = floor + Math.max(0, y - floor) * Math.exp(-2 * squeeze * pressWeight)
    if (action === 'fold') py += Math.sin(Math.min(1, travel / Math.max(.1, handle.radius * 1.8)) * Math.PI) * handle.height * .65 * weight * upper
    // A rolling pin spreads across its barrel and along its stroke rather than replacing the loaf.
    if (action === 'roll') { px += rx * weight * press * .16; pz += rz * weight * press * .05 }
    out[i] = px; out[i + 1] = py; out[i + 2] = pz
    minX = Math.min(minX, px); maxX = Math.max(maxX, px); minZ = Math.min(minZ, pz); maxZ = Math.max(maxZ, pz); minY = Math.min(minY, py)
    maxY = Math.max(maxY, py)
  }
  // Correct the pressure field's volume error by spreading sideways first.
  // Repeated local rolling must not inflate untouched tips vertically.
  const deformedVolume=volume(out,geometry.index),spreadCorrection=deformedVolume>1e-9?Math.sqrt(handle.volume/deformedVolume):1
  const scaleX = Math.min(spreadCorrection, (board.max.x - board.min.x) / Math.max(.001, maxX - minX)), scaleZ = Math.min(spreadCorrection, (board.max.z - board.min.z) / Math.max(.001, maxZ - minZ))
  const centerX = (minX + maxX) / 2, centerZ = (minZ + maxZ) / 2
  const shiftX = Math.max(board.min.x - (centerX + (minX - centerX) * scaleX), Math.min(0, board.max.x - (centerX + (maxX - centerX) * scaleX)))
  const shiftZ = Math.max(board.min.z - (centerZ + (minZ - centerZ) * scaleZ), Math.min(0, board.max.z - (centerZ + (maxZ - centerZ) * scaleZ)))
  for (let i = 0; i < out.length; i += 3) {
    out[i] = centerX + (out[i] - centerX) * scaleX + shiftX
    out[i + 1] -= minY
    out[i + 2] = centerZ + (out[i + 2] - centerZ) * scaleZ + shiftZ
  }
  // Incompressibility: displaced dough spreads sideways; the remaining small error
  // is corrected vertically, preserving the authored topology and actual cut volume.
  const currentVolume = volume(out, geometry.index), correction = currentVolume > 1e-9 ? handle.volume / currentVolume : 1
  const maxHeight=action==='knead'||action==='roll'?handle.height*1.00001:Math.max(handle.height,Math.cbrt(handle.volume)*(action==='cup'?1.45:1.65))
  if((maxY-minY)*correction>maxHeight){out.set(handle.positions);positions.needsUpdate=true;return}
  for (let i = 1; i < out.length; i += 3) out[i] *= correction
  positions.needsUpdate = true
}
