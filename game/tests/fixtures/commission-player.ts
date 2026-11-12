import * as F from '../../src/farm.ts'
import * as H from '../../src/harbour-economy.ts'
import * as C from '../../src/shop-commissions.ts'
import { advanceBayShop, setBayShopOpen, stockBayShop } from '../../src/bay-shop-model.ts'
import { foodDescriptors } from '../../src/farm.ts'
import { describeFood } from '../../src/intent-orders.ts'

/** Public actions only. A cooking receipt checks the model, not a manual gesture. */
export function commissionPlayer(opening: { name: string; args: unknown[] }[], onSnapshot?: (farm: F.FarmState) => void) {
  let state = F.createFarm(), actions = 0
  const commands = { ...F, ...H, ...C } as Record<string, Function>
  function reload() {
    const next = F.restoreCurrentFarm(JSON.parse(JSON.stringify(state)))
    if (!next) throw Error(`Invalid save after action ${actions}`)
    state = next
    onSnapshot?.(state)
  }
  function act(name: string, ...args: unknown[]) {
    const result = commands[name](state, ...args)
    if (!result.ok) throw Error(`${name}: ${result.message}`)
    actions++; reload(); return result
  }
  const visit = (island: F.IslandId) => { if (state.island !== island) act('sail', island) }
  const night = () => { visit('home'); act('endDay') }
  function fruit(id: 'apple' | 'pear', quantity: number) {
    const island = id === 'apple' ? 'home' : 'grove'
    for (let attempt = 0; state.fruit[id] < quantity; attempt++) {
      if (attempt > 30) throw Error(`No fruit progress: ${id}`)
      visit(island)
      const index = state.trees[island].findIndex(tree => tree?.tree === id && tree.fruitReady > 0)
      if (index >= 0) act('pickFruit', index); else night()
    }
  }
  function cook(recipeId?: string) {
    fruit('apple', 1); fruit('pear', 1); visit('village')
    return recipeId ? act('repeatSignature', recipeId).recipeId as string
      : act('completeSignature', { base: 'preserves', ingredients: [{ id: 'apple', quantity: 1 }, { id: 'pear', quantity: 1 }] },
        { family: 'preserves', processing: 'silky', fruit: [], steps: ['mix', 'pour'] }).recipeId as string
  }
  function shelf(recipeId: string) {
    const food = foodDescriptors(state).find(row => row.id === `signature:${recipeId}`)!
    if (!H.reserveShopGoods(state, String(food.id), 1) || !stockBayShop(state.bayShop, 0, { id: String(food.id), identity: String(food.id),
      name: food.name, image: '/art/lavender/ui-signature-silky.webp', basePrice: food.sellPrice,
      tags: [...food.ingredients, ...describeFood(food), food.processing ?? 'bright'], signature: true }, 1)) throw Error('Cannot stock')
    reload()
  }
  function sale() {
    setBayShopOpen(state.bayShop, true)
    const before = state.bayShop.sold
    for (let tick = 0; tick < 60 && state.bayShop.sold === before; tick++) {
      for (const sale of advanceBayShop(state.bayShop, 1000)) state.coins += sale.price
      reload()
    }
    setBayShopOpen(state.bayShop, false); reload()
    if (state.bayShop.sold !== before + 1) throw Error('No actual shop sale')
  }
  for (const action of opening) act(action.name, ...action.args)
  return { get state() { return state }, get actions() { return actions }, act, visit, night, fruit, cook, shelf, sale, reload }
}
