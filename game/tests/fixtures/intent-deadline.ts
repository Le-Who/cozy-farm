import { neighborFoodFixture } from './neighbor-food.ts'
import { getCommunityOrders, repeatSignature, restoreFarm, sail } from '../../src/farm.ts'

export function intentDeadlineFixture() {
  const { farm, recipeId } = neighborFoodFixture()
  if (!repeatSignature(farm, recipeId).ok) throw Error('Не подготовлена готовая порция')
  farm.day = 6
  if (!sail(farm, 'home').ok) throw Error('Не выполнен возврат домой')
  const order = getCommunityOrders(farm).find(order => order.intentId === 'fruit')!
  if (!order || !restoreFarm(farm)) throw Error('Некорректная проверочная просьба')
  return { farm, orderId: order.id }
}
