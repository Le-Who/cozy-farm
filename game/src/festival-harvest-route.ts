import { canSailTo, getBedAction, getFestivalStatus, getTreeAction, type FarmState, type OrchardIslandId } from './farm.ts'

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
