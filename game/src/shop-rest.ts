import { getShopRestForecast, type FarmState } from './farm.ts'
import { setBayShopOpen } from './bay-shop-model.ts'
import { ruCount } from './ru.ts'

const escape = (text: string) => text.replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!))

export function closeShopBeforeRest(farm: FarmState, expectedDay: string | undefined) {
  if (!farm.village.built || farm.island !== 'home' || expectedDay !== String(farm.day) || !farm.bayShop.open) {
    return { ok: false, message: 'Проверьте текущее состояние лавки в доме.' }
  }
  setBayShopOpen(farm.bayShop, false)
  return { ok: true, message: 'Лавка закрыта. Товары на полках сохранены; день не изменился.' }
}

export function renderShopRest(farm: FarmState): string {
  if (!farm.village.built) return ''
  const forecast = getShopRestForecast(farm)
  // A never-stocked closed shop needs no reminder on every early night.
  if (!forecast.open && !forecast.shelves.length) return ''
  const detail = !forecast.open ? 'Лавка закрыта. Товары на полках останутся до открытия.'
    : !forecast.remainingVisitors ? 'Все сегодняшние гости уже пришли. При отдыхе дополнительных продаж не будет.'
    : !forecast.shelves.length ? 'Лавка открыта, но полки пусты. При отдыхе продаж не будет.'
    : !forecast.sold ? 'При нынешних полках и состоянии лавки дополнительных покупок не будет. Товары останутся на полках.'
    : `При «До утра» оставшиеся гости сегодняшнего дня купят товары с полок: ${forecast.sold}. Выручка: ${ruCount(forecast.revenue, 'монета', 'монеты', 'монет')}.`
  return `<section class="shop-rest" aria-label="Лавка к утру"><h2>Лавка к утру</h2><p>${detail}</p>
    ${forecast.shelves.length ? `<details><summary>Остаток на полках после отдыха</summary><ul>${forecast.shelves.map(shelf => `<li><span>${escape(shelf.name)}</span><strong>×${shelf.remaining}</strong>${shelf.sold ? `<small>Будет куплено: ${shelf.sold}</small>` : ''}</li>`).join('')}</ul></details>` : ''}
    ${forecast.open ? '<p class="shop-rest-note">Прогноз по нынешним полкам и ценам. Чтобы сохранить товары, закройте лавку до отдыха.</p>' : '<p class="shop-rest-note">Для новых продаж снова откройте лавку в гавани.</p>'}
    <nav aria-label="Лавка перед отдыхом">${forecast.open ? `<button type="button" class="dialog-button secondary" data-action="rest-close-shop" data-value="${farm.day}">Закрыть лавку</button>` : ''}<button type="button" class="dialog-button secondary" data-action="open-panel" data-value="bay-shop">К лавке</button></nav>
  </section>`
}
