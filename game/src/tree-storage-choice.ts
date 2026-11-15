import {treeDefinitions,type FarmState} from './farm.ts'
import {traitLabel} from './ru.ts'

/** A browsing choice only: no slot reservation, tree copy or saved mode. */
export class TreeStorageChoice {
  private id: number | undefined
  current(farm: FarmState) {
    return farm.treeNursery.find(entry => entry.id === this.id) ?? farm.treeNursery[0]
  }
  choose(farm: FarmState, value: string | undefined) {
    if (farm.island !== 'home' && farm.island !== 'grove') return false
    const entry = farm.treeNursery.find(entry => String(entry.id) === value)
    if (!entry) return false
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
