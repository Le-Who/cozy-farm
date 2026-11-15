import { canSailTo, getCapeHoney, getCapeWax, type FarmState, type IslandId } from './farm.ts'

/** An optional return cue after an actual hive receipt, never a remote collection. */
export function getCapeJourneyStatus(farm: FarmState, destination: IslandId): string | undefined {
  if (destination !== 'cape' || farm.capeHoneyOn <= 0 || !canSailTo(farm, 'cape')) return
  // Preview the real destination without moving the player or advancing the day.
  const atCape = { ...farm, island: 'cape' as const }
  const harvest = getCapeHoney(atCape)
  if (!harvest.available) return
  const wax = getCapeWax(atCape)
  const items = [
    harvest.honey ? `цветочный мёд ×${harvest.honey}` : '',
    harvest.windHoney ? `мёд ветров ×${harvest.windHoney}` : '',
    wax ? `пчелиный воск ×${wax}` : '',
  ].filter(Boolean)
  return `На мысе можно собрать: ${items.join(' · ')}.`
}
