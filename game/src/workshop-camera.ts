import * as THREE from 'three'

export type WorkshopLayoutId = 'desktop' | 'portrait' | 'landscape'
export type ArtPoint = { u: number; v: number }
export type ArtBox = { u: number; v: number; width: number; height: number }
export type WorkshopLayout = {
  id: WorkshopLayoutId
  art: { path: string; width: number; height: number }
  board: { width: number; depth: number; corners: [ArtPoint, ArtPoint, ArtPoint, ArtPoint] }
  props: Record<'bowl' | 'spoon' | 'pin' | 'knife' | 'scraper' | 'hand', ArtBox>
  ui: Record<'bake' | 'close' | 'ingredients', ArtBox>
}

const box = (u: number, v: number, width: number, height: number): ArtBox => ({ u, v, width, height })
const points = (...pairs: [number, number][]): [ArtPoint, ArtPoint, ArtPoint, ArtPoint] => pairs.map(([u,v]) => ({ u,v })) as WorkshopLayout['board']['corners']

// Corners describe the usable top plane, inside the rounded bevel. Sprite/UI boxes use top-left coordinates.
export const workshopLayouts: Record<WorkshopLayoutId, WorkshopLayout> = {
  desktop: {
    id: 'desktop', art: { path: 'lavender/workshop-authored/room-desktop.webp', width: 1536, height: 1024 },
    board: { width: 6.8, depth: 4.5, corners: points([.232,.449],[.745,.449],[.821,.831],[.164,.831]) },
    props: { bowl: box(.065,.33,.215,.22), spoon: box(.092,.30,.115,.17), pin: box(.665,.365,.285,.14),
      knife: box(.806,.525,.153,.135), scraper: box(.838,.679,.144,.151), hand: box(.015,.866,.075,.115) },
    ui: { bake: box(.812,.865,.175,.11), close: box(.941,.013,.05,.075), ingredients: box(.02,.015,.166,.079) },
  },
  portrait: {
    id: 'portrait', art: { path: 'lavender/workshop-authored/room-portrait.webp', width: 1000, height: 1573 },
    board: { width: 6.8, depth: 9.5, corners: points([.066,482/1573],[.928,482/1573],[.936,.815],[.065,.815]) },
    props: { bowl: box(.14,.32,.35,.19), spoon: box(.2,.30,.16,.13), pin: box(.033,.326,.145,.49),
      knife: box(.772,.394,.178,.188), scraper: box(.716,.641,.233,.158), hand: box(.04,.908,.105,.063) },
    ui: { bake: box(.666,.914,.305,.068), close: box(.89,.018,.085,.052), ingredients: box(.03,.014,.29,.051) },
  },
  landscape: {
    id: 'landscape', art: { path: 'lavender/workshop-authored/room-landscape.webp', width: 1846, height: 852 },
    board: { width: 6.8, depth: 4.5, corners: points([105/1846,255/852],[1250/1846,255/852],[1361/1846,726/852],[35/1846,726/852]) },
    props: { bowl: box(.046,.335,.18,.265), spoon: box(.07,.315,.08,.2), pin: box(.335,.22,.33,.12),
      knife: box(.023,.647,.16,.206), scraper: box(.783,.5,.17,.212), hand: box(.019,.868,.05,.105) },
    ui: { bake: box(.803,.78,.18,.15), close: box(.945,.025,.043,.088), ingredients: box(.014,.023,.158,.09) },
  },
}

export function getWorkshopLayout(width: number, height: number): WorkshopLayout {
  return workshopLayouts[width / height < .86 ? 'portrait' : width / height > 1.85 || width>height&&height<=520 ? 'landscape' : 'desktop']
}

export function containArtwork(layout: WorkshopLayout, width: number, height: number) {
  return containRaster(layout.art,width,height)
}

/** Fit raster pixels with one scale, independently of transparent hit-area padding. */
export function containRaster(source:{width:number;height:number},width:number,height:number){
  const scale = Math.min(width / source.width, height / source.height)
  const w = Math.min(width,source.width * scale), h = Math.min(height,source.height * scale)
  return { x: (width-w)/2, y: (height-h)/2, width: w, height: h, scale }
}

export function artworkNdc(layout: WorkshopLayout, width: number, height: number, u: number, v: number): THREE.Vector2 {
  const rect = containArtwork(layout,width,height)
  return new THREE.Vector2(2*(rect.x+u*rect.width)/width-1, 1-2*(rect.y+v*rect.height)/height)
}

function solve(matrix: number[][], values: number[]): number[] {
  const rows = matrix.map((row,i) => [...row,values[i]])
  for (let i=0;i<values.length;i++) {
    let pivot=i
    for(let j=i+1;j<rows.length;j++)if(Math.abs(rows[j][i])>Math.abs(rows[pivot][i]))pivot=j
    ;[rows[i],rows[pivot]]=[rows[pivot],rows[i]]
    const divisor=rows[i][i]
    if(Math.abs(divisor)<1e-12)throw new Error('The artwork board corners must form a non-degenerate quadrilateral.')
    for(let k=i;k<=values.length;k++)rows[i][k]/=divisor
    for(let j=0;j<rows.length;j++)if(j!==i){const factor=rows[j][i];for(let k=i;k<=values.length;k++)rows[j][k]-=factor*rows[i][k]}
  }
  return rows.map(row=>row[values.length])
}

/** Calibrate the actual projection; rendered geometry and pointer rays use the same inverse. */
export function configureWorkshopCamera(camera: THREE.PerspectiveCamera, layout: WorkshopLayout, width: number, height: number): void {
  camera.fov=35; camera.aspect=width/height; camera.near=.01; camera.far=200
  camera.position.set(0,9,10); camera.up.set(0,1,0); camera.lookAt(0,0,0)
  camera.updateProjectionMatrix(); camera.updateMatrixWorld(true)
  const w=layout.board.width/2,d=layout.board.depth/2
  const world=[new THREE.Vector3(-w,0,-d),new THREE.Vector3(w,0,-d),new THREE.Vector3(w,0,d),new THREE.Vector3(-w,0,d)]
  const rows: number[][]=[],values:number[]=[]
  world.forEach((point,i)=>{
    const p=point.project(camera), target=artworkNdc(layout,width,height,layout.board.corners[i].u,layout.board.corners[i].v)
    rows.push([p.x,p.y,1,0,0,0,-target.x*p.x,-target.x*p.y],[0,0,0,p.x,p.y,1,-target.y*p.x,-target.y*p.y])
    values.push(target.x,target.y)
  })
  const [a,b,c,d0,e,f,g,h]=solve(rows,values)
  // Depth must follow the new homogeneous w as well, or correct XY can still clip the dough.
  const depthScale=-camera.projectionMatrix.elements[10]
  const registration=new THREE.Matrix4().set(a,b,0,c, d0,e,0,f, depthScale*g,depthScale*h,1,0, g,h,0,1)
  camera.projectionMatrix.premultiply(registration)
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert()
}

export function artworkToBoard(camera: THREE.PerspectiveCamera, layout: WorkshopLayout, width: number, height: number, u: number, v: number, y=0): THREE.Vector3|null {
  const ray=new THREE.Raycaster()
  ray.setFromCamera(artworkNdc(layout,width,height,u,v),camera)
  return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),-y),new THREE.Vector3())
}

/** Reuse scratch objects when projecting an entire moving mixture surface. */
export function createArtworkProjector(camera: THREE.PerspectiveCamera, layout: WorkshopLayout, width: number, height: number) {
  const rect=containArtwork(layout,width,height),ray=new THREE.Raycaster(),ndc=new THREE.Vector2(),plane=new THREE.Plane(new THREE.Vector3(0,1,0),0)
  return { toBoard(u:number,v:number,y=0,target=new THREE.Vector3()):THREE.Vector3|null {
    ndc.set(2*(rect.x+u*rect.width)/width-1,1-2*(rect.y+v*rect.height)/height)
    ray.setFromCamera(ndc,camera);plane.constant=-y
    return ray.ray.intersectPlane(plane,target)
  } }
}

export function boardToArtwork(camera: THREE.PerspectiveCamera, layout: WorkshopLayout, width: number, height: number, point: THREE.Vector3): ArtPoint {
  const ndc=point.clone().project(camera),rect=containArtwork(layout,width,height)
  return {u:((ndc.x+1)*width/2-rect.x)/rect.width,v:((1-ndc.y)*height/2-rect.y)/rect.height}
}
