import { canSailTo, type FarmState } from './farm.ts'
import { freightStock } from './bay-freight-model.ts'
import { quoteExpedition } from './ferry-expeditions.ts'
import { expeditionWallet, getFerrySupplyRequirement } from './harbour-economy.ts'
import { getLocalWarehouseSupply } from './warehouse-guidance.ts'

/** One owned source for the selected Orchard barter, never a remote withdrawal. */
export function getFerryGroveBunSource(farm: FarmState, offerId: string) {
  const port = 'grove', bun = 'handmade:round'
  if (offerId !== 'orchard-buns' || farm.island === port || !canSailTo(farm, port) || !freightStock(farm.freight, port, bun)) return
  const shortage = getFerrySupplyRequirement(farm, offerId, bun)
  if (!shortage || getLocalWarehouseSupply(farm, shortage.item)) return
  const source = getLocalWarehouseSupply({ ...farm, island: port }, shortage.item)
  if (!source) return
  const world = farm.freight.expeditions, wallet = expeditionWallet(farm)
  const stocked = { ...wallet, bag: { ...wallet.bag, [bun]: (wallet.bag[bun] ?? 0) + source.quantity } }
  if (!quoteExpedition(world, offerId, stocked)?.available) return
  return { port: source.port, item: shortage.item, key: `grove-bun:${farm.day}:${farm.island}:${world.serial}` }
}
