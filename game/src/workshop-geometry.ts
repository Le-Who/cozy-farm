import * as THREE from 'three'
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'

type Vertex = { p: THREE.Vector3; uv: THREE.Vector2 }
type Triangle = { vertices: Vertex[]; material: number }
const epsilon = .0000001
const pointKey = (p: THREE.Vector3) => p.toArray().map(value => Math.round(value / epsilon)).join(',')

export function doughVolume(geometry: THREE.BufferGeometry): number {
  const positions = geometry.getAttribute('position'), index = geometry.index
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3()
  let volume = 0
  for (let i = 0; i < (index?.count ?? positions.count); i += 3) {
    a.fromBufferAttribute(positions, index ? index.getX(i) : i)
    b.fromBufferAttribute(positions, index ? index.getX(i + 1) : i + 1)
    c.fromBufferAttribute(positions, index ? index.getX(i + 2) : i + 2)
    volume += a.dot(b.cross(c)) / 6
  }
  return Math.abs(volume)
}

/** Clips closed surfaces, traces each intersection contour, and triangulates concave caps and holes. */
export function cutDoughGeometry(geometry: THREE.BufferGeometry, plane: THREE.Plane): [THREE.BufferGeometry, THREE.BufferGeometry] | undefined {
  const source = geometry.index ? geometry.toNonIndexed() : geometry.clone()
  const position = source.getAttribute('position'), uv = source.getAttribute('uv')
  const vertices = new Map<string, THREE.Vector3>(), segments = new Map<string, [string, string]>()
  const halves: Triangle[][] = [[], []]
  for (let i = 0; i < position.count; i += 3) {
    const triangle = [0, 1, 2].map(j => ({ p: new THREE.Vector3().fromBufferAttribute(position, i + j), uv: uv ? new THREE.Vector2(uv.getX(i + j), uv.getY(i + j)) : new THREE.Vector2() }))
    const distances = triangle.map(vertex => plane.distanceToPoint(vertex.p))
    const crossing = new Map<string, THREE.Vector3>()
    for (let j = 0; j < 3; j++) {
      const a = triangle[j], b = triangle[(j + 1) % 3], da = distances[j], db = distances[(j + 1) % 3]
      if (Math.abs(da) <= epsilon) crossing.set(pointKey(a.p), a.p)
      if (da > epsilon && db < -epsilon || da < -epsilon && db > epsilon) {
        const p = a.p.clone().lerp(b.p, da / (da - db))
        crossing.set(pointKey(p), p)
      }
    }
    if (crossing.size === 2 && !distances.every(distance => Math.abs(distance) <= epsilon)) {
      const keys = [...crossing.keys()].sort()
      crossing.forEach((point, key) => vertices.set(key, point))
      segments.set(keys.join('|'), [keys[0], keys[1]])
    }
    const group = source.groups.find(group => i >= group.start && i < group.start + group.count)
    for (const [side, sign] of [[0, 1], [1, -1]]) {
      const clipped: Vertex[] = []
      for (let j = 0; j < 3; j++) {
        const a = triangle[j], b = triangle[(j + 1) % 3], da = distances[j] * sign, db = distances[(j + 1) % 3] * sign
        if (da >= -epsilon) clipped.push(a)
        if (da > epsilon && db < -epsilon || da < -epsilon && db > epsilon) {
          const t = da / (da - db)
          clipped.push({ p: a.p.clone().lerp(b.p, t), uv: a.uv.clone().lerp(b.uv, t) })
        }
      }
      for (let j = 1; j + 1 < clipped.length; j++) halves[side].push({ vertices: [clipped[0], clipped[j], clipped[j + 1]], material: group?.materialIndex ?? 0 })
    }
  }
  source.dispose()
  if (segments.size < 3) return undefined
  const adjacency = new Map<string, string[]>()
  segments.forEach(([a, b]) => {
    adjacency.set(a, [...(adjacency.get(a) ?? []), b])
    adjacency.set(b, [...(adjacency.get(b) ?? []), a])
  })
  if ([...adjacency.values()].some(neighbours => neighbours.length !== 2)) return undefined
  const remaining = new Set(segments.keys())
  const loops: THREE.Vector3[][] = []
  while (remaining.size) {
    const [a, b] = segments.get(remaining.values().next().value!)!
    const loop = [vertices.get(a)!]
    let previous = a, current = b
    remaining.delete([a, b].sort().join('|'))
    for (let count = 0; current !== a && count <= segments.size; count++) {
      loop.push(vertices.get(current)!)
      const next = adjacency.get(current)!.find(key => key !== previous)!
      remaining.delete([current, next].sort().join('|'))
      previous = current; current = next
    }
    if (current !== a || loop.length < 3) return undefined
    loops.push(loop)
  }
  const axis = Math.abs(plane.normal.y) < .9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)
  const u = new THREE.Vector3().crossVectors(axis, plane.normal).normalize()
  const v = new THREE.Vector3().crossVectors(plane.normal, u).normalize()
  const project = (p: THREE.Vector3) => new THREE.Vector2(p.dot(u), p.dot(v))
  const contours = loops.map(loop => loop.map(project))
  const areas = contours.map(contour => Math.abs(THREE.ShapeUtils.area(contour)))
  function contains(p: THREE.Vector2, polygon: THREE.Vector2[]) {
    let inside = false
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const a = polygon[i], b = polygon[j]
      if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside
    }
    return inside
  }
  const parent = contours.map((contour, i) => contours.map((other, j) => j !== i && areas[j] > areas[i] && contains(contour[0], other) ? j : -1).filter(j => j >= 0).sort((a, b) => areas[a] - areas[b])[0] ?? -1)
  const depth = (i: number): number => parent[i] < 0 ? 0 : depth(parent[i]) + 1
  const capTriangles: THREE.Vector3[][] = []
  for (let i = 0; i < loops.length; i++) {
    if (depth(i) % 2) continue
    const holes = loops.map((_, j) => parent[j] === i && depth(j) % 2 ? j : -1).filter(j => j >= 0)
    const allPoints = [loops[i], ...holes.map(j => loops[j])].flat()
    const faces = THREE.ShapeUtils.triangulateShape(contours[i].map(p => p.clone()), holes.map(j => contours[j].map(p => p.clone())))
    const used = new Set(faces.flat())
    // Earcut omits collinear boundary vertices. Preserve each original contour's
    // ordered chain instead of looking for points near any projected triangle edge:
    // on a thin pressed section unrelated bottom edges can lie within epsilon.
    const boundaryChains = new Map<string, number[]>()
    const edgeKey = (a:number,b:number) => a < b ? `${a},${b}` : `${b},${a}`
    let contourOffset=0
    for(const contour of [loops[i],...holes.map(j=>loops[j])]){
      const surviving=contour.map((_,j)=>j).filter(j=>used.has(contourOffset+j))
      for(let j=0;j<surviving.length;j++){
        const start=surviving[j],end=surviving[(j+1)%surviving.length],chain=[contourOffset+start]
        for(let k=(start+1)%contour.length;k!==end;k=(k+1)%contour.length)chain.push(contourOffset+k)
        chain.push(contourOffset+end)
        if(chain.length>2)boundaryChains.set(edgeKey(chain[0],chain[chain.length-1]),chain)
      }
      contourOffset+=contour.length
    }
    const pending = faces.map(face => face.map(index => index))
    while (pending.length) {
      const face = pending.pop()!
      let split = false
      for (let edge = 0; edge < 3 && !split; edge++) {
        const ia = face[edge], ib = face[(edge + 1) % 3], ic = face[(edge + 2) % 3]
        const key=edgeKey(ia,ib),chain=boundaryChains.get(key)
        if (chain) {
          const line=chain[0]===ia?chain:[...chain].reverse()
          boundaryChains.delete(key)
          for (let k = 0; k + 1 < line.length; k++) pending.push([line[k], line[k + 1], ic])
          split = true
        }
      }
      if (!split) capTriangles.push(face.map(index => allPoints[index]))
    }
  }
  for (const triangle of capTriangles) {
    const [a, b, c] = triangle
    const outward = new THREE.Vector3().crossVectors(b.clone().sub(a), c.clone().sub(a)).dot(plane.normal)
    const ordered = outward >= 0 ? triangle : [a, c, b]
    halves[1].push({ vertices: ordered.map(p => ({ p, uv: project(p) })), material: 1 })
    halves[0].push({ vertices: [ordered[0], ordered[2], ordered[1]].map(p => ({ p, uv: project(p) })), material: 1 })
  }
  return halves.map(half => {
    const geometry = new THREE.BufferGeometry(), positions: number[] = [], uvs: number[] = []
    for (const material of [0, 1]) {
      const start = positions.length / 3
      half.filter(triangle => triangle.material === material).forEach(triangle => triangle.vertices.forEach(vertex => { positions.push(...vertex.p.toArray()); uvs.push(...vertex.uv.toArray()) }))
      geometry.addGroup(start, positions.length / 3 - start, material)
    }
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    const welded = mergeVertices(geometry, epsilon);geometry.dispose();welded.computeVertexNormals();welded.computeBoundingSphere()
    return welded
  }) as [THREE.BufferGeometry, THREE.BufferGeometry]
}
