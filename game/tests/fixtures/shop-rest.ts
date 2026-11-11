import { neighborFoodFixture } from './neighbor-food.ts'
import { restoreFarm } from '../../src/farm.ts'
import { reserveShopGoods } from '../../src/harbour-economy.ts'
import { createBayShop, setBayShopOpen, stockBayShop } from '../../src/bay-shop-model.ts'

export function shopRestFixture(open = true) {
  const { farm } = neighborFoodFixture()
  farm.bayShop = createBayShop(farm.day)
  const product = { id:'apple', identity:'apple', name:'Яблоко', image:'/art/lavender/ui-tree-apple.webp', basePrice:4, tags:['apple','fruit','sweet'] }
  if (!reserveShopGoods(farm, product.id, 6) || !stockBayShop(farm.bayShop, 0, product, 6)) throw Error('Не заполнена проверочная лавка')
  setBayShopOpen(farm.bayShop, open)
  farm.island = 'home'
  if (!restoreFarm(farm)) throw Error('Некорректная проверочная ферма')
  return farm
}
