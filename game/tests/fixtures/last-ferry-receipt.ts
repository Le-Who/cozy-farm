import { endDay, type FarmState } from '../../src/farm.ts'
import { receiveFerryExpedition, sendFerryExpedition } from '../../src/harbour-economy.ts'
import { earlyFerryFarm, tendEarlyFerryFarm } from './early-ferry.ts'

const act = (result: { ok: boolean; message: string }) => { if (!result.ok) throw new Error(result.message) }
/** Public farm commands only. Three ports, then the day-seven ten-coin grain sale. */
export function lastFerryReceiptFarm(): FarmState {
  const farm = earlyFerryFarm()
  for (const id of ['mill-sale', 'explore-salt', 'salt-carrots', 'explore-orchard']) {
    act(sendFerryExpedition(farm, id)); act(endDay(farm))
    if (farm.day < 5) tendEarlyFerryFarm(farm)
    act(receiveFerryExpedition(farm))
  }
  act(endDay(farm)); tendEarlyFerryFarm(farm)
  act(sendFerryExpedition(farm, 'mill-grain')); act(endDay(farm))
  tendEarlyFerryFarm(farm); act(receiveFerryExpedition(farm))
  act(sendFerryExpedition(farm, 'mill-sale'))
  return farm
}
export function delayedLastFerryReceiptFarm(): FarmState {
  const farm = lastFerryReceiptFarm()
  act(endDay(farm)); tendEarlyFerryFarm(farm)
  act(endDay(farm)); act(endDay(farm))
  return farm
}
