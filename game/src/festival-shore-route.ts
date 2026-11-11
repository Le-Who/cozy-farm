import { canSailTo, getFestivalStatus, getShellAt, type FarmState, type ShoreTarget } from './farm.ts'
import { getShoalFindAt, shoalFindIds } from './shoal.ts'
import { shellSpotCount } from './tide.ts'

type FestivalShoreRoute =
  | { island:'grove'; target:ShoreTarget; panel?:undefined; label:string }
  | { island:'home'; panel:'rest'; target?:undefined; label:string }

/** A new pickup after choosing the program counts; existing stock is not participation. */
export function getFestivalShoreRoute(farm:FarmState):FestivalShoreRoute|undefined {
  const active=getFestivalStatus(farm).active
  if(!active||active.waitingNight||!active.requirements.some(requirement=>
    requirement.delivered<requirement.quantity&&requirement.alternatives.some(alternative=>
      alternative.id==='shore'&&alternative.event==='shore'&&alternative.available===0)))return
  if(farm.island!=='grove'&&!canSailTo(farm,'grove'))return
  for(let index=0;index<shellSpotCount;index++)if(getShellAt(farm,index))
    return {island:'grove',target:{kind:'shell',index},label:'К ракушке на берегу'}
  const id=shoalFindIds.find(id=>getShoalFindAt(farm,id))
  if(id)return {island:'grove',target:{kind:'shoal-find',id},label:'К находке на Лунной отмели'}
  if(farm.island==='home'||canSailTo(farm,'home'))return {island:'home',panel:'rest',label:'К отдыху дома'}
}
