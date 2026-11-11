import { neighborFoodFixture } from './neighbor-food.ts'
import { restoreFarm } from '../../src/farm.ts'
import { reserveShopGoods } from '../../src/harbour-economy.ts'
import { advanceBayShop, createBayShop, setBayShopOpen, stockBayShop } from '../../src/bay-shop-model.ts'

/** Six genuine simulated visits, then Bea returns. The next purchase happens in the real UI. */
export function shopSpeechFixture(liked = false) {
  const { farm } = neighborFoodFixture()
  farm.bayShop = createBayShop(farm.day)
  farm.concertDay = farm.day
  farm.fruit.pear = 100
  const id = liked ? 'pear' : 'apple'
  const product = { id, identity: id, name: liked ? 'Груша' : 'Яблоко', image: `/art/lavender/ui-tree-${id}.webp`, basePrice: liked ? 6 : 4, tags: [id, 'fruit', 'sweet'] }
  if (!reserveShopGoods(farm, id, 12) || !stockBayShop(farm.bayShop, 0, product, 12)) throw Error('Не заполнена лавка')
  setBayShopOpen(farm.bayShop, true)
  for (let ticks = 0; ticks < 2000 && !(farm.bayShop.visitsToday === 6 && !farm.bayShop.visitor); ticks++) {
    for (const sale of advanceBayShop(farm.bayShop, 100, 1)) farm.coins += sale.price
  }
  if (farm.bayShop.visitsToday !== 6 || farm.bayShop.visitor || !restoreFarm(farm)) throw Error('Некорректная проверочная лавка')
  return farm
}
