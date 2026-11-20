import { getCommunityOrders, getFairGuest, villageGuestTarget, type FarmState, type StockItem } from './farm.ts'

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

/** Both uses are live, and the player cannot fulfill both with the food already carried. */
export function fairJamPicnicChoice(farm: FarmState) {
  if (farm.island !== 'home' || farm.village.built || farm.fairGuestsServed + 1 !== villageGuestTarget || farm.dishes.appleJam !== 1) return
  const guest = getFairGuest(farm)
  if (!guest || guest.served || guest.item.kind !== 'dishes' || guest.item.item !== 'appleJam' || guest.item.quantity !== 1) return
  const picnic = getCommunityOrders(farm).find(order => order.intentId === 'fruit' && order.unlocked && !order.delivered)
  if (!picnic) return
  const ready = picnic.offers.filter(offer => offer.available)
  if (ready.length === 1 && ready[0].id === 'dish:appleJam') return { id: picnic.id, reward: ready[0].reward }
}
