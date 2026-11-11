import { getShoalFindAt, hasShoal, type ShoalFindId } from './shoal.ts'
import { type ShellId } from './tide.ts'

type ShoalDay = { day: number; shellDiscoveries: readonly ShellId[]; shoalCollectedToday: readonly ShoalFindId[] }

/** Calendar preview only; today keeps its collection ledger, later days start fresh. */
export function getShoalReturn(farm: ShoalDay, id: ShoalFindId) {
  if (!hasShoal(farm)) return { status: 'locked' as const, nextDay: undefined }
  if (getShoalFindAt(farm, id)) return { status: 'available' as const, nextDay: farm.day }
  const status = farm.shoalCollectedToday.includes(id) ? 'collected' as const : 'waiting' as const
  // Every second lunar tide guarantees a pearl. Ten future game days suffice.
  for (let offset = 1; offset <= 10; offset++) {
    const day = farm.day + offset
    if (!Number.isSafeInteger(day)) break
    if (getShoalFindAt({ ...farm, day, shoalCollectedToday: [] }, id)) return { status, nextDay: day }
  }
  return { status, nextDay: undefined }
}

export function shoalReturnCopy(farm: ShoalDay, id: ShoalFindId): string {
  const forecast = getShoalReturn(farm, id)
  if (forecast.status === 'locked') return 'Сначала найдите обычную и лунную ракушки, чтобы открыть отмель.'
  if (forecast.status === 'available') return 'На берегу сегодня.'
  const when = forecast.nextDay === undefined ? 'в один из следующих игровых дней'
    : forecast.nextDay === farm.day + 1 ? `завтра, день ${forecast.nextDay}` : `день ${forecast.nextDay}`
  return `${forecast.status === 'collected' ? 'Сегодня собрано. ' : ''}Следующая находка: ${when}.`
}
