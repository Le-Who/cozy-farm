import { canSailTo, getFishAction, getFishLimit, getFishingTripConfig, getResumableFishingTrip, type FarmState } from './farm.ts'

type Shore = 'home' | 'grove'
type FishingPier = { island: Shore; panel: 'fishing' | 'rest'; label: string; value: string }
type FinnFishingRoute = FishingPier & { addsSlot: boolean; alternate?: FishingPier }

function fishingPier(farm: FarmState, coast: Shore) {
  const there = { ...farm, island: coast }
  if (!canSailTo(farm, coast) || !getFishAction(there).available) return
  const paid = getResumableFishingTrip(there)
  const config = paid?.config ?? getFishingTripConfig(there)
  const remaining = getFishLimit(farm, coast) - farm.fishCaughtToday[coast]
  const capacity = Math.min(config.capacity, remaining)
  const ordinary = getFishingTripConfig({ ...there, village: { ...farm.village, scouting: false } }).capacity
  const pier = {
    island: coast, panel: 'fishing' as const, value: `${coast}:fishing`,
    label: coast === 'home' ? 'К причалу на Родном острове' : 'К причалу Солёной рощи',
  }
  return { pier, capacity, resuming: !!paid, addsSlot: !paid && capacity > Math.min(ordinary, remaining) }
}

/** Scout help is spent by a new cast, never by looking at a route or sailing there. */
export function getFinnFishingRoute(farm: FarmState): FinnFishingRoute | undefined {
  if (farm.island !== 'village' || !farm.village.scouting || !farm.village.residents.includes('finn') || !canSailTo(farm,'home')) return
  const home = fishingPier(farm, 'home'), grove = fishingPier(farm, 'grove')
  // Offer the second shore only if it can use the slot that today's usual pier cannot.
  // A paid preview remains its own cast; it does not consume or advertise a new scout.
  if (home && !home.resuming && !home.addsSlot && grove?.addsSlot) {
    const key = `${farm.day}:${home.capacity}:${grove.capacity}`
    return { ...home.pier, value: `home:fishing:${key}`, label: `Родной причал · до ${home.capacity} рыб`, addsSlot: false,
      alternate: { ...grove.pier, value: `grove:fishing:${key}`, label: `Причал рощи · до ${grove.capacity} рыб` } }
  }
  const usual = home ?? grove
  return usual ? { ...usual.pier, addsSlot: usual.addsSlot }
    : { island: 'home', panel: 'rest', label: 'Домой к отдыху', value: 'home:rest', addsSlot: false }
}
