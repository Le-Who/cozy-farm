import { canSailTo, getFestivalStatus, getFishAction, type FarmState, type OrchardIslandId } from './farm.ts'

type FestivalFishingRoute = { island: OrchardIslandId; panel: 'fishing' | 'rest'; label: string }

/** The participation is a new catch, not a particular species or a practice result. */
export function getFestivalFishingRoute(farm: FarmState): FestivalFishingRoute | undefined {
  const active = getFestivalStatus(farm).active
  if (!active || active.waitingNight || !active.requirements.some(requirement =>
    requirement.delivered < requirement.quantity && requirement.alternatives.some(alternative =>
      alternative.id === 'fish' && alternative.event === 'fish' && alternative.available === 0))) return
  const current: OrchardIslandId[] = farm.island === 'home' || farm.island === 'grove' ? [farm.island] : []
  const coasts = [...new Set<OrchardIslandId>([...current, 'grove', 'home'])]
    .filter(island => island === farm.island || canSailTo(farm, island))
  const coast = coasts.find(island => getFishAction({ ...farm, island }).available)
  if (coast) return { island: coast, panel: 'fishing', label: coast === 'home' ? 'Рыбачить у Родного острова' : 'Рыбачить в Солёной роще' }
  if (coasts.length && (farm.island === 'home' || canSailTo(farm, 'home'))) return { island: 'home', panel: 'rest', label: 'К отдыху дома' }
}
