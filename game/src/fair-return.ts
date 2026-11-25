import { cropDefinitions, getBedHarvestPreview, getCommunityOrders, getFairGuest, villageGuestTarget, type FarmState, type StockItem } from './farm.ts'
import { exposedTrait } from './climate.ts'
import { getRestPreview } from './rest-preview.ts'
import { getLocalWarehouseSupply } from './warehouse-guidance.ts'

/** Guest rotation reads the farm day and existing discoveries; looking ahead never advances them. */
export function getNextFairGuest(farm: FarmState) {
  const day = farm.day + 1
  const guest = getFairGuest({ ...farm, day })
  return guest ? { ...guest, day } : undefined
}

/** Suggest one task only if it can make tomorrow’s ordinary-crop request possible. */
export function getNextFairCropPrep(farm: FarmState, forecast = getRestPreview(farm)) {
  if (farm.island !== 'home' || farm.fairGuestsServed === 0) return
  const guest = getNextFairGuest(farm)
  if (!guest || guest.served || guest.item.kind !== 'produce') return
  const { item: crop, quantity: required } = guest.item
  const carried = farm.produce[crop]
  if (carried >= required) return
  // Count only ordinary produce. At dawn an eligible exposure can turn one
  // item rare, and today's picnic bonus cannot carry over to another day.
  const ordinaryAtDawn = (index: number) => {
    const bed = farm.beds[index]
    if (bed.kind !== 'crop') return 0
    return cropDefinitions[crop].yield - Number(!!(bed.trait ?? exposedTrait(guest.day, forecast.weather, index + 1)))
  }
  let available = carried + (getLocalWarehouseSupply(farm, guest.item)?.quantity ?? 0)
  let collectIndex: number | undefined
  for (const {index, crop: planted} of forecast.ready) {
    if (planted !== crop) continue
    available += ordinaryAtDawn(index)
    if (collectIndex === undefined && carried + (getBedHarvestPreview(farm, index)?.ordinary ?? 0) >= required) collectIndex = index
  }
  for (const {index, crop: planted} of forecast.ripening) if (planted === crop) available += ordinaryAtDawn(index)
  if (available >= required) return
  if (collectIndex !== undefined) return { task: 'harvest' as const, index: collectIndex, crop, guest: guest.name, carried, required }
  if (farm.water < 1) return
  for (const {index, crop: planted} of forecast.dry) {
    const bed = farm.beds[index]
    if (planted !== crop || bed.kind !== 'crop' || bed.growth + 1 < cropDefinitions[crop].days) continue
    // Keep the surfaced choice self-contained: bag plus this harvest, no
    // extra withdrawal or harvest elsewhere needed to make its claim true.
    if (carried + ordinaryAtDawn(index) >= required) return { task: 'water' as const, index, crop, guest: guest.name, carried, required }
  }
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
