import { canSailTo, getFishAction, type FarmState } from './farm.ts'
import { quoteExpedition } from './ferry-expeditions.ts'
import { expeditionWallet, getFerrySupplyRequirement } from './harbour-economy.ts'
import { getLocalWarehouseSupply } from './warehouse-guidance.ts'

/** A stored exact Salt Kitchen shipment can beat waiting, not a live fishing choice. */
export function getFerryGroveFishSource(farm: FarmState, offerId: string) {
  const port = 'grove', id = 'seaBass'
  if (offerId !== 'salt-catch' || farm.island === port || !canSailTo(farm,port)) return
  // This optional route must not end an ongoing Home visit without warning.
  if (farm.island === 'home' && farm.neighborVisits.active?.startedOn === farm.day) return
  const shortage = getFerrySupplyRequirement(farm,offerId,id)
  if (!shortage || getLocalWarehouseSupply(farm,shortage.item)) return
  const grove = {...farm,island:port} as const
  if (getFishAction(grove).available) return
  const supply = getLocalWarehouseSupply(grove,shortage.item)
  if (!supply) return
  const world = farm.freight.expeditions, wallet = expeditionWallet(farm)
  const projected = {...wallet,bag:{...wallet.bag,[id]:supply.carried+supply.quantity}}
  if (!quoteExpedition(world,offerId,projected)?.available) return
  return {port,item:shortage.item,key:`grove-fish:${farm.day}:${farm.island}:${world.serial}:${supply.carried}:${supply.quantity}`} as const
}
