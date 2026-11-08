import assert from 'node:assert/strict'
import {test} from 'node:test'
import {defaultHenPositions,henIdlePoint,isHenGround,projectHenToGround} from '../src/hen-roaming.ts'

test('the original flock and free garden, path and orchard ground are valid on the Home plate',()=>{
 for(const point of [...defaultHenPositions,{x:700,y:430},{x:800,y:600},{x:1120,y:600},{x:1376,y:553},{x:1226,y:742}]){
  assert.ok(isHenGround(point),JSON.stringify(point));assert.deepEqual(projectHenToGround(point),point)
 }
})

test('building ground footprints reject hens without treating the full roof illustration as solid ground',()=>{
 for(const point of [{x:350,y:345},{x:690,y:315},{x:905,y:285},{x:1250,y:350},{x:280,y:575}]){
  assert.equal(isHenGround(point),false);assert.ok(isHenGround(projectHenToGround(point)))
 }
 for(const point of [{x:350,y:250},{x:905,y:220},{x:1245,y:270}])assert.ok(isHenGround(point),'ground behind a roof remains available')
 const fromCoop=projectHenToGround({x:280,y:580});assert.ok(fromCoop.y>600&&Math.hypot(fromCoop.x-280,fromCoop.y-580)<43)
})

test('water, cliffs, dock and fence drops project to nearby safe grass rather than back to the pen',()=>{
 for(const point of [{x:0,y:0},{x:800,y:950},{x:1530,y:700},{x:470,y:880},{x:5000,y:-4000},{x:150,y:640}]){
  assert.equal(isHenGround(point),false);const safe=projectHenToGround(point);assert.ok(isHenGround(safe),JSON.stringify(safe))
  assert.deepEqual(projectHenToGround(safe),safe,'projection is stable after landing')
 }
 const shore=projectHenToGround({x:1530,y:700});assert.ok(shore.x>1400,'an orchard-side water drop stays near that shore')
 const fence=projectHenToGround({x:150,y:640});assert.ok(Math.hypot(fence.x-150,fence.y-640)<16)
})

test('expanded footprints follow the upgraded farmhouse, well and coop',()=>{
 const upgraded={farmhouse:2,well:2,coop:2}
 for(const point of [{x:550,y:350},{x:595,y:325},{x:220,y:625}]){
  assert.ok(isHenGround(point));assert.equal(isHenGround(point,upgraded),false);assert.ok(isHenGround(projectHenToGround(point,upgraded),upgraded))
 }
 for(const point of defaultHenPositions)assert.ok(isHenGround(projectHenToGround(point,upgraded),upgraded))
})

test('local idle pecking stays near its new drop anchor and never crosses a shore or footprint',()=>{
 for(const anchor of [{x:1120,y:590},projectHenToGround({x:1500,y:700}),projectHenToGround({x:280,y:580})])for(let frame=0;frame<200;frame++){
  const point=henIdlePoint(anchor,frame*.13,2)
  assert.ok(isHenGround(point));assert.ok(Math.hypot(point.x-anchor.x,point.y-anchor.y)<30)
 }
})

test('malformed coordinates still yield a finite safe landing',()=>{
 for(const point of [{x:NaN,y:400},{x:Infinity,y:-Infinity}])assert.ok(isHenGround(projectHenToGround(point)))
})

test('drop projection remains safe and idempotent around every coastline and footprint boundary',()=>{
 for(const levels of [{farmhouse:1,well:1,coop:1},{farmhouse:3,well:3,coop:3}])for(let x=0;x<=1600;x+=80)for(let y=120;y<=1000;y+=80){
  const projected=projectHenToGround({x,y},levels)
  assert.ok(isHenGround(projected,levels),`${x},${y} projected to ${JSON.stringify(projected)}`)
  assert.deepEqual(projectHenToGround(projected,levels),projected)
 }
})
