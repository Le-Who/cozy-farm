import { readFileSync } from 'node:fs'
import { commissionPlayer } from './commission-player.ts'

/** Earn boat/gardens from the normal opening, collect a real apple harvest,
 * then store its next ripe fruit and fill the vacated local garden by hand. */
export function storedTreeCrossingPlayer() {
  const opening=JSON.parse(readFileSync(new URL('./home-progress-actions.json',import.meta.url),'utf8'))
  const p=commissionPlayer(opening);p.visit('home');p.act('pickFruit',0);p.night()
  p.act('buyAndPlantTree',1,'pear');p.act('storeTree',1)
  const stored=structuredClone(p.state.trees.home[0])!
  if(!stored.fruitReady)throw Error('Expected earned ripe fruit before storage')
  p.act('storeTree',0);const id=p.state.treeNurserySerial
  for(const [slot,tree] of [[0,'peach'],[1,'apple'],[2,'pear']] as const)p.act('buyAndPlantTree',slot,tree)
  p.night()
  return {p,id,stored}
}
