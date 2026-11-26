import {treeDefinitions,type FarmState} from './farm.ts'
import {traitLabel} from './ru.ts'

/** A browsing choice only: no slot reservation, tree copy or saved mode. */
export class TreeStorageChoice {
  private id: number | undefined
  private source?: { id:number; day:number; island:FarmState['island']; owns:()=>boolean }

  /** A ripe ingredient can own just one explicit store in its exact Orchard visit. */
  guideSpace(farm: FarmState, id: number, owns: () => boolean) {
    if (this.choose(farm, String(id))) this.source = {id, day:farm.day, island:farm.island, owns}
  }
  afterStore(farm: FarmState) {
    const source = this.source
    this.source = undefined
    const tree = source && farm.treeNursery.find(entry => entry.id === source.id)?.tree
    if (source && tree && tree.fruitReady > Number(!!tree.trait) && source.id === this.id
      && source.day === farm.day && source.island === farm.island && source.owns()) return
    this.choose(farm, String(farm.treeNurserySerial))
  }
  current(farm: FarmState) {
    return farm.treeNursery.find(entry => entry.id === this.id) ?? farm.treeNursery[0]
  }
  otherPlot(farm: FarmState) {
    const from=farm.island
    if(!farm.boatOwned||(from!=='home'&&from!=='grove')||farm.trees[from].includes(null))return
    const tree=this.current(farm),to=from==='home'?'grove' as const:'home' as const
    const slot=farm.trees[to].findIndex(tree=>tree===null)
    if(!tree||slot<0)return
    return {from,to,slot,id:tree.id,key:[from,to,slot,tree.id].join(':')}
  }
  choose(farm: FarmState, value: string | undefined) {
    if (farm.island !== 'home' && farm.island !== 'grove') return false
    const entry = farm.treeNursery.find(entry => String(entry.id) === value)
    if (!entry) return false
    if (entry.id !== this.id) this.source = undefined
    this.id = entry.id
    return true
  }
}

export function storedTreeChoiceLabel(entry: FarmState['treeNursery'][number]) {
  const {id,tree}=entry,definition=treeDefinitions[tree.tree]
  return `${definition.treeName} · №${id}${tree.trait ? ` · ${traitLabel(tree.trait,tree.tree)}` : ''}`
}

/** Do not focus an action on entry: revealing it must never become a return. */
export function revealTreeStorageReturn(root: HTMLElement) {
  root.querySelector<HTMLElement>('.tree-storage [data-action="return-nursery-tree"]:not(:disabled)')?.scrollIntoView({block:'nearest',inline:'nearest'})
}
