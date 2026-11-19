import { canSailTo, getFishAction, type FarmState } from './farm.ts'

/** Scout help is spent by a cast, never by looking at a route or sailing there. */
export function getFinnFishingRoute(farm: FarmState) {
  if (farm.island !== 'village' || !farm.village.scouting || !farm.village.residents.includes('finn') || !canSailTo(farm,'home')) return
  for (const coast of ['home','grove'] as const) {
    if (canSailTo(farm,coast) && getFishAction({...farm,island:coast}).available)
      return { island:coast, panel:'fishing' as const, label:coast==='home'?'К причалу на Родном острове':'К причалу Солёной рощи' }
  }
  return { island:'home' as const, panel:'rest' as const, label:'Домой к отдыху' }
}
