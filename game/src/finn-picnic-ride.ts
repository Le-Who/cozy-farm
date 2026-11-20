import { advanceNeighborPlan, canSailTo, getNeighborPlans, sail, type ActionResult, type FarmState } from './farm.ts'
import { canInviteNeighbor, inviteNeighborVisit } from './neighbor-visits.ts'

/** A seat on the player's ordinary return, never a cargo expedition or a generic invitation. */
export function finnPicnicRide(farm:FarmState) {
  if(farm.island!=='village'||!canSailTo(farm,'home')||farm.neighborVisits.active||farm.neighborVisits.serial>=1_000_000
    ||!canInviteNeighbor({...farm,island:'home'},'finn')||!farm.trees.home.some(t=>t&&t.fruitReady>0))return
  const plan=getNeighborPlans(farm).find(p=>p.resident==='finn')
  if(plan?.phase==='celebrating'&&plan.episode==='finnShore'&&plan.memory?.day===farm.day)return plan.id+':'+farm.day
}

export function sailHomeWithFinn(farm:FarmState,token:string):ActionResult {
  if(finnPicnicRide(farm)!==token || typeof token!=='string')return {ok:false,message:'Эта прогулка сейчас недоступна.'}
  // The predicate checks all three ordinary actions before any mutation. No extra reward.
  advanceNeighborPlan(farm,token.slice(0,token.lastIndexOf(':')))
  sail(farm,'home')
  return inviteNeighborVisit(farm,'finnOrchard')
}
