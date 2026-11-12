import type { FarmState } from './farm.ts'
import { bayShopVisitors, type BayShopVisitorId } from './bay-shop-model.ts'
import { getShopCommission, getShopCommissionOffers, getShopAssortment } from './shop-commissions.ts'
import { ShopAssortmentChoice } from './shop-assortment-choice.ts'
import { ruCount } from './ru.ts'
const escape = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!))
const button = (label: string, action: string, value = '', enabled = true) => `<button type="button" class="dialog-button" data-action="${action}" data-value="${escape(value)}"${enabled ? '' : ' disabled'}>${label}</button>`
const coins = (amount: number) => ruCount(amount, 'монета', 'монеты', 'монет')
const navigation = () => `<nav class="commission-actions" aria-label="Подготовка заказа">${button('Мои рецепты', 'open-panel', 'recipes')}${button('В свою лавку', 'open-panel', 'bay-shop')}</nav>`
function assortment(farm: FarmState, customer: BayShopVisitorId, choice: ShopAssortmentChoice, picture: (id: string) => string) {
  if (farm.shopCommissions.completed[customer] < 2) return '<p class="commission-timing">После двух заказов можно собрать набор: по две порции конфитюра и тарта, которые этот покупатель уже купил и полюбил.</p>'
  const offers = getShopCommissionOffers(farm).filter(offer => offer.customer === customer)
  const recipes = offers.map(offer => farm.culinary.recipes.find(recipe => recipe.id === offer.recipeId)!)
  if (!recipes.some(recipe => recipe.base === 'tart') || !recipes.some(recipe => recipe.base === 'preserves')) return '<p class="commission-timing">Доступны наборы 2+2. Познакомьте покупателя в лавке с авторским конфитюром и тартом: оба должны быть куплены и понравиться. Обычный заказ остаётся доступен.</p>'
  const first = choice.customer === customer ? recipes.find(recipe => recipe.id === choice.first) : undefined
  const second = first ? recipes.find(recipe => recipe.id === choice.second && recipe.base !== first.base) : undefined
  const offer = getShopAssortment(farm, customer, first?.id, second?.id)
  const select = (part: 'first' | 'second') => `<label>${part === 'first' ? 'Первый рецепт' : 'Второй рецепт другого типа'}<select data-commission-pair="${part}" data-customer="${customer}"${part === 'second' && !first ? ' disabled' : ''}><option value="">Выберите рецепт</option>${recipes.filter(recipe => part === 'first' || recipe.base !== first?.base).map(recipe => `<option value="${recipe.id}"${recipe.id === (part === 'first' ? first?.id : second?.id) ? ' selected' : ''}>${escape(recipe.name)} · ${coins(recipe.sellPrice)}</option>`).join('')}</select></label>`
  return `<section class="commission-assortment" aria-label="Набор для покупателя"><h3>Два любимых рецепта</h3><p>По две порции каждого: четыре всего, премия 12 монет за весь набор. Без срока. Можно выбрать прежний заказ на одно блюдо.</p>${select('first')}${select('second')}
    ${offer ? `${offer.lines.map(line => `<div class="commission-recipe">${picture(line.recipeId)}<p><span data-user-text>${escape(line.recipeName)}</span> ×2 · ${coins(2 * line.unitPrice)}</p></div>`).join('')}<p>Стоимость блюд ${offer.total - 12} + премия 12 = <strong>${coins(offer.total)}</strong>.</p>` : '<p>Выбор не тратит продукты. Оплата появится только после передачи полного набора.</p>'}
    ${button('Принять набор 2+2', 'commission-accept', offer?.key ?? '', !!offer)}</section>`
}
export function renderShopCommissions(farm: FarmState, picture: (recipeId: string) => string, choice = new ShopAssortmentChoice()): string {
  const state = farm.shopCommissions, active = getShopCommission(farm), offers = getShopCommissionOffers(farm)
  if (active) return `<section class="shop-commissions" aria-label="Текущий заказ лавки">
    <header><p>${active.customerName} · заказ для компании №${active.serial}</p><h2 data-user-text>${escape(active.recipeName)}</h2><strong>Отложено ${active.delivered} из ${active.quantity}</strong></header>
    <p>Цена партии и премия: ${active.lines.map(line => `${line.quantity} × ${line.unitPrice}`).join(' + ')} + ${active.bonus} за заказ = <strong>${coins(active.total)}</strong>.</p>
    <p class="commission-timing">Срока нет: продолжайте в удобное время. Покупатель заберёт партию, когда она будет готова.</p>
    ${active.lines.map(line => `<article class="commission-offer"><div class="commission-recipe">${picture(line.recipeId)}<div>${active.mixed ? `<h3 data-user-text>${escape(line.recipeName)}</h3>` : ''}<strong>Отложено ${line.delivered} из ${line.quantity}</strong><p>Припасы: ${line.inBag} · склад гавани: ${line.warehouse}</p></div></div>
      ${line.remaining ? `<div class="commission-actions">${button('Отложить 1 порцию', 'commission-deliver', line.actionValue, line.canDeliver)}${button('Повторить этот рецепт…', 'commission-recipe', line.actionValue)}</div>` : '<p>Эта часть готова.</p>'}</article>`).join('')}
    ${active.remaining ? '<p>Можно сдавать по одной порции. Сначала используется склад гавани, затем припасы. Товары на прилавке остаются в лавке.</p>'
      : `<p role="status">Вся партия собрана. Передайте её покупателю и получите оплату.</p>${button(`Передать партию · ${coins(active.total)}`, 'commission-finish', String(active.serial), active.canClaim)}`}
    <details class="commission-cancel"><summary>Отменить заказ</summary><p>Все отложенные порции (${active.delivered}) вернутся в припасы; каждый рецепт отдельно. Оплаты и продвижения не будет.</p>${button('Отменить и вернуть порции', 'commission-cancel', String(active.serial))}</details>
    ${navigation()}</section>`
  const completed = Object.values(state.completed).reduce((sum, count) => sum + count, 0), last = state.last
  const receipt = last && ('lines' in last ? last.lines : [last])
  return `<section class="shop-commissions" aria-label="Заказы постоянных покупателей"><p>Гости, которым понравился ваш авторский рецепт в лавке, заказывают его для своих встреч. Вы выбираете одну партию, готовите без спешки и сдаёте частями.</p>
    <p>Первый заказ покупателя: 2 порции и 6 монет сверх стоимости партии. Второй: 3 порции и 9 монет. Начиная с третьего: 4 порции и 12 монет. Завершено заказов: <strong>${completed}</strong>.</p>
    ${last && receipt ? `<div class="commission-receipt" role="status"><strong>Последняя партия получена</strong><p>${bayShopVisitors.find(person => person.id === last.customer)!.name} · день ${last.day}</p>${receipt.map(line => `<p><span data-user-text>${escape(line.recipeName)}</span> ×${line.quantity}</p>`).join('')}<p>Выплачено: ${coins(receipt.reduce((sum, line) => sum + line.unitPrice * line.quantity, last.bonus))}.</p></div>` : ''}
    ${state.lastCompletedOn === farm.day ? `<p>На сегодня заказ выполнен. Новую партию можно выбрать следующим игровым утром.</p>${button('К отдыху дома', 'commission-rest')}` : offers.length ? `<div class="commission-customers">${bayShopVisitors.map(person => {
      const choices = offers.filter(offer => offer.customer === person.id)
      if (!choices.length) return ''
      return `<details${choice.customer === person.id || offers.every(offer => offer.customer === person.id) ? ' open' : ''}><summary>${person.name} · выполнено: ${state.completed[person.id]}</summary>${assortment(farm, person.id, choice, picture)}${choices.map(offer => `<article class="commission-offer"><div class="commission-recipe">${picture(offer.recipeId)}<h3 data-user-text>${escape(offer.recipeName)}</h3></div><p>${offer.quantity} порции · ${offer.quantity} × ${offer.unitPrice} + ${offer.bonus} = <strong>${coins(offer.total)}</strong></p><p>Без срока и штрафа за отмену. Готовую партию можно передать сразу.</p>${button('Принять заказ', 'commission-accept', offer.key)}</article>`).join('')}</details>`
    }).join('')}</div>` : `<p class="commission-empty">${farm.culinary.recipes.length ? 'Выставьте свой рецепт в лавке. Когда посетитель купит его и ему понравится вкус, здесь появится предложение именно на это блюдо.' : 'Сначала приготовьте свой рецепт, затем предложите его покупателю в лавке. Обычные блюда не открывают авторские заказы.'}</p>`}
    ${navigation()}</section>`
}
