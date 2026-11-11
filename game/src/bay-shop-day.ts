import { bayShopDailyLimit, type BayShopState } from './bay-shop-model.ts'

/** Guidance only: visitor allowance and settlement remain owned by the shop model. */
export function bayShopDayGuidance(state: BayShopState, performanceBonus = 0, canPlayConcert = false) {
  const limit = bayShopDailyLimit(performanceBonus, state.festivalVisitors)
  const remaining = Math.max(0, limit - state.visitsToday)
  const count = `Гости сегодня: ${state.visitsToday} из ${limit}`
  if (state.visitor) return { count, remaining, action: undefined,
    detail: remaining === 0 ? 'Последний гость ещё в лавке.' : 'Гость ещё в лавке.' }
  if (remaining === 0) return canPlayConcert && performanceBonus === 0
    ? { count, remaining, action: 'music' as const, detail: 'Концерт сегодня может пригласить ещё двух гостей.' }
    : { count, remaining, action: 'rest' as const, detail: 'Все гости сегодня уже пришли. Новые придут после отдыха дома.' }
  return { count, remaining, action: undefined, detail: !state.open ? 'Лавка закрыта. Откройте её для гостей.'
    : state.slots.some(slot => slot && slot.quantity > 0) ? 'Лавка открыта. Следующий гость скоро придёт.'
    : 'На полках пусто. Выставьте товар, пока не пришёл следующий гость.' }
}
