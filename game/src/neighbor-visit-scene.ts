import type { FarmState, ResidentId } from './farm.ts'
import { visitActivities } from './neighbor-visits.ts'
import { henWalkPath } from './hen-companion.ts'
import { stepNeighborWalker, type NeighborWalker } from './neighbor-scene.ts'
export type HomeVisitor=NeighborWalker&{serial:number;day:number;resident:ResidentId;leaving:boolean}
export const visitorLanding={x:505,y:767}
export function syncHomeVisitor(actor:HomeVisitor|undefined,farm:FarmState):HomeVisitor|undefined{
  if(farm.island!=='home')return
  const visit=farm.neighborVisits.active
  if(actor&&actor.day!==farm.day)actor=undefined
  if(visit&&actor?.serial!==visit.serial){const a=visitActivities[visit.activity];return {serial:visit.serial,day:farm.day,resident:a.resident,leaving:false,point:{...visitorLanding},route:henWalkPath(visitorLanding,a.point,farm.buildingLevels),facingRight:true,stride:0}}
  if(!visit&&actor&&!actor.leaving){actor.leaving=true;actor.route=henWalkPath(actor.point,visitorLanding,farm.buildingLevels)}
  return actor
}
export function stepHomeVisitor(actor:HomeVisitor,dt:number,reducedMotion:boolean):boolean{
  if(reducedMotion){if(actor.route.length)actor.point={...actor.route.at(-1)!};actor.route=[]}
  else stepNeighborWalker(actor,dt,105)
  return actor.leaving&&actor.route.length===0
}
