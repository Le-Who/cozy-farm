import { readFileSync } from 'node:fs'
import { commissionPlayer } from './commission-player.ts'
import type { SignatureDraft, SignatureProcessing } from '../../src/culinary.ts'

/** Ten distinct saved recipes, earned through public actions, with every save restored. */
export function earnedRecipeBookPlayer() {
  const opening = JSON.parse(readFileSync(new URL('./home-progress-actions.json', import.meta.url), 'utf8'))
  const p = commissionPlayer(opening)
  const processing = ['bright', 'silky', 'chunky'] as const
  const cook = (ingredients: SignatureDraft['ingredients'], kind: SignatureProcessing) => {
    p.visit('home')
    p.act('completeSignature', { base: 'preserves', ingredients },
      { family: 'preserves', processing: kind, fruit: [], steps: ['stir', 'pour'] })
  }
  for (const kind of processing) {
    p.fruit('apple', 2); cook([{ id: 'apple', quantity: 2 }], kind)
    p.fruit('pear', 2); cook([{ id: 'pear', quantity: 2 }], kind)
    p.fruit('apple', 1); p.fruit('pear', 1)
    cook([{ id: 'apple', quantity: 1 }, { id: 'pear', quantity: 1 }], kind)
  }
  p.visit('home'); p.act('buyAndPlantTree', 1, 'peach')
  for (let attempt = 0; p.state.fruit.peach < 4; attempt++) {
    if (attempt > 30) throw Error('No peach harvest progress')
    if (p.state.trees.home[1]!.fruitReady) p.act('pickFruit', 1)
    else p.night()
  }
  cook([{ id: 'peach', quantity: 2 }], 'bright')
  return p
}
