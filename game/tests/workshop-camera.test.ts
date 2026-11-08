import assert from 'node:assert/strict'
import test from 'node:test'
import * as THREE from 'three'
import {workshopLayouts,configureWorkshopCamera,boardToArtwork,artworkToBoard,containArtwork,containRaster,getWorkshopLayout,createArtworkProjector} from '../src/workshop-camera.ts'
import {createSculptedDough} from '../src/workshop-sculpt.ts'

test('short landscape phones use their authored layout without switching to the desktop table',()=>{
  assert.equal(getWorkshopLayout(548,300).id,'landscape')
  assert.equal(getWorkshopLayout(824,370).id,'landscape')
  assert.equal(getWorkshopLayout(370,824).id,'portrait')
  assert.equal(getWorkshopLayout(1420,980).id,'desktop')
})

test('rooms and raster props keep one pixel scale across viewport shapes and minimum hit areas',()=>{
  const sources=[...Object.values(workshopLayouts).map(layout=>layout.art),{width:816,height:385},{width:509,height:310},{width:502,height:513}]
  for(const source of sources)for(const [width,height]of [[1440,1000],[390,844],[568,320],[520,480],[90,44],[132,44]]){
    const rect=containRaster(source,width,height)
    assert.ok(Math.abs(rect.width/source.width-rect.height/source.height)<1e-12)
    assert.ok(rect.x>=0&&rect.y>=0&&rect.x+rect.width<=width+1e-8&&rect.y+rect.height<=height+1e-8)
  }
})

test('all artwork corners and pointer rays share the calibrated board on every layout',()=>{
  for(const layout of Object.values(workshopLayouts))for(const [width,height]of [[1440,1000],[390,844],[568,320]]){
    const camera=new THREE.PerspectiveCamera()
    configureWorkshopCamera(camera,layout,width,height)
    const w=layout.board.width/2,d=layout.board.depth/2
    const vertices=[[-w,-d],[w,-d],[w,d],[-w,d]]
    for(let i=0;i<vertices.length;i++){
      const [x,z]=vertices[i],point=new THREE.Vector3(x,0,z),art=boardToArtwork(camera,layout,width,height,point),target=layout.board.corners[i]
      assert.ok(Math.abs(art.u-target.u)*layout.art.width<.001)
      assert.ok(Math.abs(art.v-target.v)*layout.art.height<.001)
      const clip=point.clone().project(camera)
      assert.ok(clip.z>-1&&clip.z<1, 'the registered board must remain inside the depth clipping planes')
      assert.ok(artworkToBoard(camera,layout,width,height,art.u,art.v)!.distanceTo(point)<1e-8)
    }
    const middle=new THREE.Vector3(.7,0,-.3),art=boardToArtwork(camera,layout,width,height,middle)
    assert.ok(artworkToBoard(camera,layout,width,height,art.u,art.v)!.distanceTo(middle)<1e-8)
    const target=new THREE.Vector3(),projector=createArtworkProjector(camera,layout,width,height)
    assert.equal(projector.toBoard(art.u,art.v,0,target),target)
    assert.ok(target.distanceTo(middle)<1e-8)
    for(const y of [.2,1.2]){
      const raised=new THREE.Vector3(.3,y,.4),art=boardToArtwork(camera,layout,width,height,raised),clip=raised.clone().project(camera)
      assert.ok(artworkToBoard(camera,layout,width,height,art.u,art.v,y)!.distanceTo(raised)<1e-8)
      assert.ok(clip.z>-1&&clip.z<1)
    }
    const rect=containArtwork(layout,width,height)
    assert.ok(rect.x>=0&&rect.y>=0&&rect.x+rect.width<=width+.001&&rect.y+rect.height<=height+.001)
  }
})

test('the long portrait board keeps the same pastry proportions instead of stretching its depth',()=>{
  const geometry=createSculptedDough({shape:'folded',mass:1,seed:1}),position=geometry.getAttribute('position'),ratios:number[]=[]
  for(const layout of Object.values(workshopLayouts)){
    const camera=new THREE.PerspectiveCamera(),bounds=new THREE.Box2()
    configureWorkshopCamera(camera,layout,layout.art.width,layout.art.height)
    for(let i=0;i<position.count;i++){
      const point=boardToArtwork(camera,layout,layout.art.width,layout.art.height,new THREE.Vector3(position.getX(i),position.getY(i)+.018,position.getZ(i)))
      bounds.expandByPoint(new THREE.Vector2(point.u*layout.art.width,point.v*layout.art.height))
    }
    const size=bounds.getSize(new THREE.Vector2());ratios.push(size.x/size.y)
  }
  assert.ok(Math.max(...ratios)/Math.min(...ratios)<1.3,`pastry aspect differs between layouts: ${ratios}`)
  geometry.dispose()
})
