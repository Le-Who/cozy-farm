import { neighborTastingsFixture } from './neighbor-tastings.ts'
import { completeSignature, restoreFarm, runResidentService, sail, tasteSignature, useSignature } from '../../src/farm.ts'

/** Synthetic, accepted save using the same existing service and picnic actions as play. */
export function fishingReturnFixture() {
  const { farm, recipeId } = neighborTastingsFixture()
  if (!tasteSignature(farm, recipeId, 'finn').ok || !runResidentService(farm, 'finn').ok) throw Error('Не подготовлена снасть Финна')
  const made = completeSignature(farm, { base: 'preserves', ingredients: [{ id: 'apple', quantity: 2 }] }, {
    family: 'preserves', processing: 'bright', fruit: [{ ingredientId: 'apple', x: 0, y: 0, angle: 0 }], steps: ['fruit', 'stir', 'jar'],
  })
  if (!made.recipeId || !useSignature(farm, made.recipeId).ok || !sail(farm, 'home').ok) throw Error('Не подготовлен пикник')
  farm.beds = farm.beds.map(() => ({ kind: 'empty' }))
  farm.orientation = { collections: true, islands: true }
  farm.discoveryPreferences.quiet = true
  if (!restoreFarm(farm)) throw Error('Некорректная ферма рыбалки')
  return farm
}
