import { expeditionPorts, explorationReason, quoteExpedition, type FerryExpeditions, type ExpeditionWallet } from './ferry-expeditions.ts'

/** A completed trade opens a route, not a free departure or a discovered port. */
export function nextFerryExploration(world: FerryExpeditions, wallet: ExpeditionWallet) {
  if (!wallet.boatOwned || world.active) return
  const port = expeditionPorts.find(port => !world.discovered.includes(port) && !explorationReason(world, port))
  return port ? quoteExpedition(world, `explore-${port}`, wallet) : undefined
}
