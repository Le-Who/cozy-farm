import {getBedHarvestPreview, type FarmState} from './farm.ts'
import {henFriends} from './hen-friendship.ts'
import {canWalkWithHen, henWalkPath,type HenCompanion} from './hen-companion.ts'
import {isHenGround, type HenNativePoint} from './hen-roaming.ts'

export type HenFieldTarget={kind:'bed'|'tree';index:number}
export const guideKey=(target:HenFieldTarget)=>`${target.kind}:${target.index}`
export function henFieldSources(farm:FarmState,id:number):HenFieldTarget[] {
  if (!canWalkWithHen(farm,id)) return []
  const favorite=henFriends[id].favorite
  if (!farm.henFriendship.hens[id].tasted.includes(favorite)) return []
  if (favorite==='apple') return farm.trees.home.flatMap((tree,index)=>tree?.tree==='apple' && tree.fruitReady>Number(!!tree.trait) ? [{kind:'tree' as const,index}] : [])
  return farm.beds.flatMap((_bed,index)=>{
    const harvest=getBedHarvestPreview(farm,index)
    return harvest?.crop===favorite && harvest.ordinary>0 ? [{kind:'bed' as const,index}] : []
  })
}

/** The offered target is real and reachable from this hen; use authored world stops, not a guessed grid. */
export function henFieldRoute(farm:FarmState,id:number,from:HenNativePoint,stopFor:(target:HenFieldTarget)=>HenNativePoint|undefined) {
  for (const target of henFieldSources(farm,id)) {
    const stop=stopFor(target)
    if (!stop || !isHenGround(stop,farm.buildingLevels)) continue
    const path=henWalkPath(from,stop,farm.buildingLevels)
    if (path.length) return {target,stop,path}
  }
}

/** Other ordinary work may already have picked this exact spot. No silent retargeting. */
export function refreshHenFieldWalk(farm:FarmState,walk:HenCompanion) {
  const guide=walk.guide
  if (!guide || henFieldSources(farm,walk.id).some(t=>guideKey(t)===guideKey(guide.target))) return
  delete walk.guide;walk.path=[];walk.target=undefined;walk.planAfter=0
}
