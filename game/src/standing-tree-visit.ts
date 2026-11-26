import { treeDefinitions, type ActionResult, type FarmState } from './farm.ts'
import { noteNeighborVisit } from './neighbor-visits.ts'

/** Existing ripe fruit takes priority. A planted adult normally empties only after picking. */
export function restingHomeTree(farm: FarmState) {
  if(farm.island!=='home'||farm.trees.home.some(tree=>tree&&tree.fruitReady>0))return
  for(const [index,slot] of farm.trees.home.entries()){
    // Undiscovered legacy empty trees are not evidence of an earlier harvest.
    if(!slot||slot.sprouting||slot.fruitReady!==0||slot.age!==treeDefinitions[slot.tree].days||!farm.discoveries[slot.tree]?.regular)continue
    return {index,tree:slot.tree}
  }
}

export function standingVisitTree(farm: FarmState) {
  const visit=farm.neighborVisits.active
  if(visit?.activity!=='finnOrchard'||visit.startedOn!==farm.day||visit.observation)return
  const choice=restingHomeTree(farm)
  if(choice)return {...choice,token:[visit.serial,farm.day,farm.workToday,choice.index,choice.tree].join(':')}
}

export function showStandingVisitTree(farm: FarmState, token: string): ActionResult {
  const choice=standingVisitTree(farm)
  if(!choice||choice.token!==token)return {ok:false,message:'Это дерево сейчас нельзя показать.'}
  const memory=noteNeighborVisit(farm,'fruit',treeDefinitions[choice.tree].treeName,'Показали домашнее дерево. Плоды не собирали.')
  return {ok:true,message:memory.trim()}
}
