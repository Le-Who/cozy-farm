import * as THREE from 'three'

/** A fixed authored 40° prop is displayed once in camera space. Its cavity stays on the world contact point. */
export function createFishPanView(texture: THREE.Texture, width:number, height:number) {
  const geometry=new THREE.PlaneGeometry(1,height/width)
  // Authored static scenery paints before the physical food; its camera-facing sheet
  // must never become an invisible depth wall through the cooking cavity.
  const material=new THREE.MeshBasicMaterial({map:texture,alphaTest:.15,alphaToCoverage:true,toneMapped:false,depthWrite:false})
  const mesh=new THREE.Mesh(geometry,material)
  mesh.renderOrder=-10
  const right=new THREE.Vector3(),up=new THREE.Vector3()
  // Source 08: normalized centre of the actual ribbed cooking cavity, excluding the front apron and handle.
  const anchor={x:.418,y:.596}
  return{mesh,geometry,material,
    layout(camera:THREE.Camera,cavity:THREE.Vector3,size:number){
      camera.updateMatrixWorld(true);right.setFromMatrixColumn(camera.matrixWorld,0);up.setFromMatrixColumn(camera.matrixWorld,1)
      mesh.quaternion.copy(camera.quaternion);mesh.scale.setScalar(size)
      mesh.position.copy(cavity).addScaledVector(right,(.5-anchor.x)*size).addScaledVector(up,(anchor.y-.5)*size*height/width)
      mesh.updateMatrixWorld(true)
    },
  }
}
