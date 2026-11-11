import { neighborFoodFixture } from './neighbor-food.ts'
import { restoreFarm } from '../../src/farm.ts'
import { reserveShopGoods } from '../../src/harbour-economy.ts'
import { advanceBayShop, createBayShop, setBayShopOpen, stockBayShop } from '../../src/bay-shop-model.ts'

export function shopDayFixture(completed = false) {
  const { farm } = neighborFoodFixture()
  farm.bayShop = createBayShop(farm.day)
  if (completed) farm.concertDay = farm.day
  const product = { id: 'apple', identity: 'apple', name: 'Яблоко', image: '/art/lavender/ui-tree-apple.webp', basePrice: 4, tags: ['apple', 'fruit', 'sweet'] }
  if (!reserveShopGoods(farm, product.id, 12) || !stockBayShop(farm.bayShop, 0, product, 12)) throw Error('Не заполнена лавка')
  setBayShopOpen(farm.bayShop, true)
  const target = completed ? 8 : 5
  for (let ticks = 0; ticks < 2000 && !(farm.bayShop.visitsToday === target && !farm.bayShop.visitor); ticks++) {
    for (const sale of advanceBayShop(farm.bayShop, 100, Number(completed))) farm.coins += sale.price
  }
  if (farm.bayShop.visitsToday !== target || farm.bayShop.visitor || !restoreFarm(farm)) throw Error('Некорректная проверочная лавка')
  return farm
}
