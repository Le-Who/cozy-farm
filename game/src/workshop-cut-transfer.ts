import * as THREE from 'three'
import { cutDoughGeometry, doughVolume } from './workshop-geometry.ts'

export interface PackedDoughGeometry {
  position: Float32Array
  normal?: Float32Array
  uv?: Float32Array
  index?: Uint32Array
  groups: {start:number;count:number;materialIndex?:number}[]
}
export interface DoughCutRequest { id:number; geometry:PackedDoughGeometry; normal:[number,number,number]; constant:number }
export interface DoughCutResult { id:number; halves?:PackedDoughGeometry[]; volumes?:number[]; error?:string }

/** Snapshot the mesh; transferring this packet never detaches live render buffers. */
export function packDoughGeometry(geometry:THREE.BufferGeometry):PackedDoughGeometry {
  const position=geometry.getAttribute('position'),normal=geometry.getAttribute('normal'),uv=geometry.getAttribute('uv')
  return {position:new Float32Array(position.array),normal:normal?new Float32Array(normal.array):undefined,uv:uv?new Float32Array(uv.array):undefined,index:geometry.index?new Uint32Array(geometry.index.array):undefined,groups:geometry.groups.map(group=>({...group}))}
}
export function unpackDoughGeometry(packet:PackedDoughGeometry):THREE.BufferGeometry {
  const geometry=new THREE.BufferGeometry()
  geometry.setAttribute('position',new THREE.BufferAttribute(packet.position,3))
  if(packet.normal)geometry.setAttribute('normal',new THREE.BufferAttribute(packet.normal,3))
  if(packet.uv)geometry.setAttribute('uv',new THREE.BufferAttribute(packet.uv,2))
  if(packet.index)geometry.setIndex(new THREE.BufferAttribute(packet.index,1))
  packet.groups.forEach(group=>geometry.addGroup(group.start,group.count,group.materialIndex))
  if(!packet.normal)geometry.computeVertexNormals()
  geometry.computeBoundingBox();geometry.computeBoundingSphere()
  return geometry
}
export function doughTransferBuffers(packet:PackedDoughGeometry):ArrayBuffer[] {
  return [packet.position,packet.normal,packet.uv,packet.index].filter((array):array is Float32Array|Uint32Array=>!!array).map(array=>array.buffer as ArrayBuffer)
}
export function executeDoughCut(request:DoughCutRequest):DoughCutResult {
  const source=unpackDoughGeometry(request.geometry)
  let halves:THREE.BufferGeometry[]|undefined
  try {
    halves=cutDoughGeometry(source,new THREE.Plane(new THREE.Vector3(...request.normal),request.constant))
    return halves?{id:request.id,halves:halves.map(packDoughGeometry),volumes:halves.map(doughVolume)}:{id:request.id}
  } catch(error) {return {id:request.id,error:error instanceof Error?error.message:'The cut could not be completed'}}
  finally {source.dispose();halves?.forEach(half=>half.dispose())}
}
