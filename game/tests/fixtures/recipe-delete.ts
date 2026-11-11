import { completeSignature, createFarm, restoreFarm } from '../../src/farm.ts'

export function recipeDeleteFixture() {
  const farm = createFarm()
  farm.day = 5
  farm.buildingLevels.farmhouse = 2
  farm.beds = farm.beds.map(() => ({ kind: 'empty' }))
  farm.orientation = { collections: true, islands: true }
  farm.progress = { till: 1, plant: 1, water: 1, rest: 1, harvest: 3, sell: 1, feed: 1, collect: 1 }
  farm.fruit = { apple: 20, pear: 20, peach: 20 }
  farm.produce.wheat = farm.eggs = 20
  for (const fruit of ['apple', 'pear', 'peach'] as const) {
    const made = completeSignature(farm, { base: 'tart', ingredients: [{ id: fruit, quantity: 2 }] }, {
      family: 'decorate', processing: 'chunky', fruit: [{ ingredientId: fruit, x: .2, y: -.3, angle: .4 }], steps: ['fruit', 'bake'],
      baking: { method: 'oven', finish: 'golden', seconds: 90 },
    })
    if (!made.ok || !made.recipeId) throw Error('Не подготовлен рецепт')
    farm.culinary.stock[made.recipeId] = 0
  }
  if (!restoreFarm(farm)) throw Error('Некорректная книга рецептов')
  return farm
}
