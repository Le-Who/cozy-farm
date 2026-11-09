import { loadPhysics } from './physics-runtime'
import type { RigidBody, World, Collider } from '@dimforge/rapier3d-compat'

type V = {x:number;y:number;z:number}
export async function createFishPhysics(vertices: Float32Array) {
  const R=await loadPhysics(),world:World=new R.World({x:0,y:-9.81,z:0})
  const fish:RigidBody=world.createRigidBody(R.RigidBodyDesc.dynamic().setLinearDamping(3.8).setAngularDamping(5.5).setCcdEnabled(true))
  const hull=R.ColliderDesc.convexHull(vertices)
  if(!hull){world.free();throw new Error('Fish hull is empty')}
  const collider:Collider=world.createCollider(hull.setMass(.55).setFriction(.8).setRestitution(.08),fish)
  const floor=world.createCollider(R.ColliderDesc.cuboid(20,.05,20).setTranslation(0,-.05,0).setFriction(.8))
  const supports=[world.createCollider(R.ColliderDesc.cuboid(3.05,.11,1.3)),world.createCollider(R.ColliderDesc.cuboid(2.4,.08,1.65)),world.createCollider(R.ColliderDesc.cuboid(2.7,.04,1.5))]
  let accumulator=0,freed=false,scale=0
  return {
    fish,
    support(stage:string){supports[0].setEnabled(['season','transfer'].includes(stage));supports[1].setEnabled(['grill','plate'].includes(stage));supports[2].setEnabled(['garnish','ready','committing','finished'].includes(stage))},
    layout(board:V,pan:V,plate:V,size:number){
      const resized = scale!==size
      scale=size
      supports[0].setTranslation({x:board.x,y:.11,z:board.z});if(resized)supports[0].setShape(new R.Cuboid(3.05*(size>1?1.28:1),.11,1.3*(size>1?1.28:1)))
      supports[1].setTranslation({x:pan.x-.68,y:.08,z:pan.z+.1});if(resized)supports[1].setShape(new R.Cuboid(2.4*(size>1?1.06:1),.08,1.65*(size>1?1.06:1)))
      supports[2].setTranslation({x:plate.x,y:.04,z:plate.z});if(resized)supports[2].setShape(new R.Cuboid(2.7*(size>1?1.22:1),.04,1.5*(size>1?1.22:1)))
      if(!resized)return
      const scaled=new Float32Array(vertices.length);for(let i=0;i<vertices.length;i++)scaled[i]=vertices[i]*scale
      const h=R.ColliderDesc.convexHull(scaled);if(h)collider.setShape(h.shape)
    },
    reset(position:V,roll=0){fish.setTranslation(position,true);fish.setRotation({x:Math.sin(roll/2),y:0,z:0,w:Math.cos(roll/2)},true);fish.setLinvel({x:0,y:0,z:0},true);fish.setAngvel({x:0,y:0,z:0},true)},
    step(dt:number,target:V,roll:number,grip:V|null,lifted:boolean){
      accumulator+=Math.min(.06,dt)
      while(accumulator>=1/120){
        world.timestep=1/120;fish.resetForces(true);fish.resetTorques(true)
        const p=fish.translation(),v=fish.linvel(),a=fish.angvel(),q=fish.rotation(),tx=Math.sin(roll/2),tw=Math.cos(roll/2)
        const sign=tw*q.w+tx*q.x<0?-1:1
        const error={x:(tx*q.w-tw*q.x)*sign,y:(-tw*q.y+tx*q.z)*sign,z:(-tw*q.z-tx*q.y)*sign}
        const stiffness=lifted?38:12,point=grip?{x:p.x+grip.x*scale,y:p.y,z:p.z+grip.z*scale}:p
        fish.addForceAtPoint({x:(target.x-p.x)*stiffness-v.x*6,y:lifted?(target.y-p.y)*60-v.y*8+fish.mass()*9.81:0,z:(target.z-p.z)*stiffness-v.z*6},point,true)
        fish.addTorque({x:error.x*64-a.x*4,y:error.y*64-a.y*4,z:error.z*64-a.z*4},true)
        world.step();accumulator-=1/120
      }
      let panContact=false
      world.contactPair(collider,supports[1],manifold=>{for(let i=0;i<manifold.numContacts();i++)if(manifold.contactDist(i)<.04)panContact=true})
      return {position:fish.translation(),rotation:fish.rotation(),velocity:fish.linvel(),panContact}
    },
    destroy(){if(!freed){freed=true;world.free()}},
  }
}
