import { getFestivalStatus, type FarmState } from './farm.ts'

export type FestivalConcertState = 'needed' | 'ready'

/** Only the chosen, current concert requirement. This never contributes or starts music. */
export function getFestivalConcertState(farm: FarmState): FestivalConcertState | undefined {
  const active = getFestivalStatus(farm).active
  if (!active || active.waitingNight) return
  const concert = active.requirements.find(requirement => requirement.delivered < requirement.quantity
    && requirement.alternatives.some(alternative => alternative.event === 'concert'))
  if (!concert) return
  return concert.alternatives.some(alternative => alternative.event === 'concert' && alternative.available > 0) ? 'ready' : 'needed'
}
