import { canSailTo, getBedAction, getFestivalStatus, getTreeAction, type FarmState, type OrchardIslandId } from './farm.ts'
import { getLocalWarehouseSupply } from './warehouse-guidance.ts'

type HarvestTarget = { kind:'bed' | 'tree'; index:number }
type FestivalHarvestRoute = { island:OrchardIslandId; target:HarvestTarget; label:string }

/** A new ordinary or special harvest qualifies; stock already in the bag does not. */
export function getFestivalHarvestRoute(farm: FarmState): FestivalHarvestRoute | undefined {
  const active=getFestivalStatus(farm).active
  if (!active || active.waitingNight || !active.requirements.some(requirement => requirement.delivered<requirement.quantity
    && requirement.alternatives.some(alternative => alternative.event==='harvest' && alternative.available===0))) return
  const current:OrchardIslandId[]=farm.island==='home'||farm.island==='grove'?[farm.island]:[]
  const islands=[...new Set<OrchardIslandId>([...current,'home','grove'])]
    .filter(island=>island===farm.island||canSailTo(farm,island))
  for (const island of islands) {
    const local={...farm,island}
    if (island==='home') {
      const index=farm.beds.findIndex((_,index)=>getBedAction(local,index).kind==='harvest')
      if(index>=0)return {island,target:{kind:'bed',index},label:'К готовому урожаю дома'}
    }
    const index=farm.trees[island].findIndex((_,index)=>getTreeAction(local,index).kind==='pick')
    if(index>=0)return {island,target:{kind:'tree',index},label:island==='home'?'К готовым плодам дома':'К готовым плодам в Солёной роще'}
  }
  if(islands.includes('home'))return {island:'home',target:{kind:'bed',index:0},label:'К грядкам дома'}
}


/** Only the actual two-apple dressing choice, not generic orchard guidance. */
export function getFestivalDressingGrove(farm: FarmState) {
  const active = getFestivalStatus(farm).active, program = farm.festivals.active
  if (farm.island !== 'village' || farm.neighborVisits.active || !canSailTo(farm,'grove')
    || !program || active?.tradition !== 'harvest' || active.edition !== 2 || active.stage !== 1 || active.waitingNight) return
  const row = active.requirements.find(row=>row.id==='honey' && row.delivered<row.quantity)
  const apple = row?.alternatives.find(alt=>alt.id==='apple' && alt.quantity===2 && alt.available===0)
  const request = {kind:'fruit',item:'apple',quantity:2} as const
  if (!apple || farm.fruit.apple>=2 || getLocalWarehouseSupply(farm,request)) return
  const ordinary = (tree: FarmState['trees']['home'][number]) => tree?.tree==='apple' ? tree.fruitReady - Number(!!tree.trait) : 0
  const missing = 2-farm.fruit.apple
  const fromHome = getLocalWarehouseSupply({...farm,island:'home'},request)?.quantity ?? 0
  if (fromHome + farm.trees.home.reduce((sum,tree)=>sum+ordinary(tree),0) >= missing) return
  // A single exact Grove tree can finish the substitute without a second shore.
  const slot = farm.trees.grove.findIndex(tree=>ordinary(tree)>=missing)
  if (slot<0) return
  return {slot,token:`honey|apple|grove:${program.startedOn}:${farm.day}:${row!.delivered}:${farm.fruit.apple}:${slot}`}
}
