import { getBeaPastryCount, getIntentOffers, getNeighborPlans, getResidentService, runResidentService, workshopShapes, type FarmState } from './farm.ts'

/** A second way to prepare the selected treat, not a gift, invitation or journey. */
export function getRequestedBeaBatch(farm:FarmState, planId?:string, food?:string) {
  const shape = workshopShapes.find(shape => food === 'handmade:'+shape)
  if (!shape || !planId || farm.handmade[shape] || !getResidentService(farm,'bea',shape).available) return
  const plan = getNeighborPlans(farm).find(plan=>plan.id===planId)
  if (!plan || plan.phase !== 'joined' && plan.phase !== 'arranging'
    || !getIntentOffers(farm,plan.intentId).some(offer=>offer.id===food && offer.eligible)) return
  const count = getBeaPastryCount(farm)
  return {shape, count, key:[farm.day,planId,shape,count].join('|')}
}

export function bakeRequestedBeaBatch(farm:FarmState, planId:string|undefined, food:string|undefined, key:string|undefined) {
  const quote=getRequestedBeaBatch(farm,planId,food)
  if (!quote || quote.key!==key) return {ok:false,message:'Условия выпечки изменились. Проверьте угощение и запасы.'}
  return runResidentService(farm,'bea',quote.shape)
}
