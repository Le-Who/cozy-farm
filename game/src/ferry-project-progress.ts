import { portProjects, type ExpeditionManifest, type FerryExpedition, type FerryExpeditions } from './ferry-expeditions.ts'

/** Read-only contribution of this shipment, not a new project payment or reward. */
export function ferryProjectProgress(world: FerryExpeditions, manifest: ExpeditionManifest | FerryExpedition) {
  if (manifest.kind !== 'trade') return
  const project = portProjects[manifest.port]
  const delivered = 'phase' in manifest && manifest.phase === 'ready'
  const needs = project.needs.map(item => {
    const supplied = world.markets[manifest.port].supplied[item.id] ?? 0
    const sent = manifest.outgoing.find(cargo => cargo.id === item.id)?.quantity ?? 0
    // Arrival already credited this cargo, even when its receipt is unclaimed.
    const before = Math.min(item.quantity,Math.max(0,supplied-(delivered ? sent : 0)))
    const after = Math.min(item.quantity,supplied+(delivered ? 0 : sent))
    return {id:item.id, before, after, required:item.quantity}
  })
  if (!needs.some(item => item.after > item.before)) return
  return {name:project.name, benefit:project.benefit, delivered, needs, complete:needs.every(item=>item.after===item.required)}
}
