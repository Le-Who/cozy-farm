import { getIntentOffers, getNeighborPlans, repeatSignature, type FarmState, type FoodOfferId } from './farm.ts'
import type { IntentId } from './intent-orders.ts'
import { getStoredSignature } from './stored-signature.ts'

/** Derive recovery from current stock, never rewrite the saved meeting. */
export function getNeighborFoodRecovery(farm: FarmState, planId: string) {
  const plan = getNeighborPlans(farm).find(plan => plan.id === planId)
  if (!plan || plan.phase !== 'arranging' || !plan.food) return undefined
  const offer = getIntentOffers(farm, plan.intentId).find(offer => offer.id === plan.food!.id)
  const state = !offer ? 'deleted' : !offer.eligible ? 'changed' : offer.available ? 'ready' : 'spent'
  const shelved = state === 'spent' ? farm.bayShop.slots.reduce((total,slot)=>total+(slot?.product.id===offer!.id?slot.quantity:0),0) : 0
  const stored = state === 'spent' && offer?.source === 'signature' ? getStoredSignature(farm,offer.id.slice('signature:'.length)) : undefined
  const warehouse = stored ? {kind:'signature' as const,...stored} : undefined
  const message = state === 'deleted' ? 'Выбранный рецепт удалён. Выберите другое угощение: встреча и её прогресс сохранены.'
    : state === 'changed' ? 'Это блюдо больше не подходит. Выберите другое угощение: встреча и её прогресс сохранены.'
    : warehouse ? `Выбранное угощение уже на местном складе: ${warehouse.stored}. Готовить заново не нужно. Заберите одну порцию отдельно и вернитесь к встрече. Встреча и её прогресс сохранены.`
    : shelved ? `Выбранное угощение на прилавке вашей лавки: ${shelved}. В лавке выберите его полку и нажмите «Убрать товар в запас», затем вернитесь к встрече. ${farm.bayShop.open?'Лавка открыта: покупатели могут забрать порции, пока они на полке.':'Лавка закрыта: покупатели пока не заберут порции.'} Встреча и её прогресс сохранены.`
    : state === 'spent' ? 'Выбранное угощение закончилось. Приготовьте ещё порцию или выберите другое. Встреча и её прогресс сохранены.' : ''
  return { plan, offer, state, message, shelved, warehouse } as const
}

/** A recovery action makes a missing portion, never an extra batch on a stale click. */
export function repeatRequestedSignature(farm: FarmState, intent: IntentId, foodId: FoodOfferId) {
  const offer = getIntentOffers(farm, intent).find(offer => offer.id === foodId)
  if (!offer || offer.source !== 'signature' || !offer.eligible) return { ok: false, message: 'Этот рецепт недоступен. Выберите другое подходящее угощение.' }
  if (offer.count > 0) return { ok: false, message: 'Угощение уже готово. Вернитесь к встрече или просьбе.' }
  return repeatSignature(farm, foodId.slice('signature:'.length), undefined, 1)
}

export function repeatNeighborFood(farm: FarmState, planId: string) {
  const recovery = getNeighborFoodRecovery(farm, planId)
  if (!recovery || recovery.state !== 'spent' || !recovery.plan.food) return { ok: false, message: 'Выберите встречу с недостающим угощением.' }
  return repeatRequestedSignature(farm, recovery.plan.intentId, recovery.plan.food.id)
}
