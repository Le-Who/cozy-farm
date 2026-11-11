import type { FarmState } from './farm'
import { bayShopVisitors } from './bay-shop-model'
import { getShopCommission, getShopCommissionOffers } from './shop-commissions'
import { ruCount } from './ru'
import './shop-commissions.css'
const escape = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!))
const button = (label: string, action: string, value = '', enabled = true) => `<button type="button" class="dialog-button" data-action="${action}" data-value="${escape(value)}"${enabled ? '' : ' disabled'}>${label}</button>`
const coins = (amount: number) => ruCount(amount, 'монета', 'монеты', 'монет')
const navigation = () => `<nav class="commission-actions" aria-label="Подготовка заказа">${button('Мои рецепты', 'open-panel', 'recipes')}${button('В свою лавку', 'open-panel', 'bay-shop')}</nav>`
export function renderShopCommissions(farm: FarmState, picture: (recipeId: string) => string): string {
  const state = farm.shopCommissions, active = getShopCommission(farm), offers = getShopCommissionOffers(farm)
  if (active) return `<section class="shop-commissions" aria-label="Текущий заказ лавки">
    <header><p>${active.customerName} · заказ для компании №${active.serial}</p><h2 data-user-text>${escape(active.recipeName)}</h2></header>
    <div class="commission-recipe">${picture(active.recipeId)}<div><strong>Отложено ${active.delivered} из ${active.quantity}</strong><p>Припасы: ${active.inBag} · склад гавани: ${active.warehouse}</p></div></div>
    <p>Цена партии и премия: ${active.quantity} × ${active.unitPrice} + ${active.bonus} за заказ = <strong>${ruCount(active.total, 'монета', 'монеты', 'монет')}</strong>.</p>
    <p class="commission-timing">Срока нет: продолжайте в удобное время. Покупатель заберёт партию, когда она будет готова.</p>
    ${active.remaining ? `<p>Можно сдавать по одной порции. Сначала используется склад гавани, затем припасы. Товары на прилавке остаются в лавке.</p><div class="commission-actions">${button('Отложить 1 порцию', 'commission-deliver', String(active.serial), active.canDeliver)}${button('Повторить этот рецепт…', 'commission-recipe', String(active.serial))}</div>`
      : `<p role="status">Вся партия собрана. Передайте её покупателю и получите оплату.</p>${button(`Передать партию · ${coins(active.total)}`, 'commission-finish', String(active.serial), active.canClaim)}`}
    <details class="commission-cancel"><summary>Отменить заказ</summary><p>Все отложенные порции (${active.delivered}) вернутся в припасы. Оплаты и продвижения не будет.</p>${button('Отменить и вернуть порции', 'commission-cancel', String(active.serial))}</details>
    ${navigation()}</section>`
  const completed = Object.values(state.completed).reduce((sum, count) => sum + count, 0), last = state.last
  return `<section class="shop-commissions" aria-label="Заказы постоянных покупателей"><p>Гости, которым понравился ваш авторский рецепт в лавке, заказывают его для своих встреч. Вы выбираете одну партию, готовите без спешки и сдаёте частями.</p>
    <p>Первый заказ покупателя: 2 порции и 6 монет сверх стоимости партии. Второй: 3 порции и 9 монет. Начиная с третьего: 4 порции и 12 монет. Завершено заказов: <strong>${completed}</strong>.</p>
    ${last ? `<div class="commission-receipt" role="status"><strong>Последняя партия получена</strong><p>${bayShopVisitors.find(person => person.id === last.customer)!.name} · <span data-user-text>${escape(last.recipeName)}</span> ×${last.quantity} · день ${last.day}</p><p>Выплачено: ${coins(last.unitPrice * last.quantity + last.bonus)}.</p></div>` : ''}
    ${state.lastCompletedOn === farm.day ? `<p>На сегодня заказ выполнен. Новую партию можно выбрать следующим игровым утром.</p>${button('К отдыху дома', 'commission-rest')}` : offers.length ? `<div class="commission-customers">${bayShopVisitors.map(person => {
      const choices = offers.filter(offer => offer.customer === person.id)
      if (!choices.length) return ''
      return `<details${offers.every(offer => offer.customer === person.id) ? ' open' : ''}><summary>${person.name} · выполнено: ${state.completed[person.id]}</summary>${choices.map(offer => `<article class="commission-offer"><div class="commission-recipe">${picture(offer.recipeId)}<h3 data-user-text>${escape(offer.recipeName)}</h3></div><p>${offer.quantity} порции · ${offer.quantity} × ${offer.unitPrice} + ${offer.bonus} = <strong>${coins(offer.total)}</strong></p><p>Без срока и штрафа за отмену. Готовую партию можно передать сразу.</p>${button('Принять заказ', 'commission-accept', offer.key)}</article>`).join('')}</details>`
    }).join('')}</div>` : `<p class="commission-empty">${farm.culinary.recipes.length ? 'Выставьте свой рецепт в лавке. Когда посетитель купит его и ему понравится вкус, здесь появится предложение именно на это блюдо.' : 'Сначала приготовьте свой рецепт, затем предложите его покупателю в лавке. Обычные блюда не открывают авторские заказы.'}</p>`}
    ${navigation()}</section>`
}
