import { getFairGuest, type FarmState, type StockItem } from './farm.ts'

/** Guest rotation reads the farm day and existing discoveries; looking ahead never advances them. */
export function getNextFairGuest(farm: FarmState) {
  const day = farm.day + 1
  const guest = getFairGuest({ ...farm, day })
  return guest ? { ...guest, day } : undefined
}

export function renderFairReturn(farm: FarmState, stock: (item: StockItem) => string): string {
  const today = getFairGuest(farm), next = getNextFairGuest(farm)
  if (!today || !next) return ''
  return `<aside class="fair-return" aria-label="Следующий гость ярмарки"><h2>Следующий гость · день ${next.day}</h2>
    <p><strong>${next.name}</strong> придёт после отдыха и попросит:</p><ul class="ingredients">${stock(next.item)}</ul>
    <p class="fair-return-note">${today.served ? 'Сегодняшний гость уже угощён.' : 'После отдыха сегодняшняя просьба сменится новой.'} Прогноз по нынешним открытиям фермы.</p></aside>`
}
