import type { FarmState } from './farm.ts'
import { bayShopVisitors, type BayShopVisitorId } from './bay-shop-model.ts'
import { getShopCommission, getShopCommissionOffers, getShopAssortment } from './shop-commissions.ts'
import { ShopAssortmentChoice } from './shop-assortment-choice.ts'
import { ShopCommissionView } from './shop-commission-view.ts'
import { ruCount } from './ru.ts'
const escape=(value:string)=>value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!))
const button=(label:string,action:string,value='',enabled=true)=>`<button type="button" class="dialog-button" data-action="${action}" data-value="${escape(value)}"${enabled?'':' disabled'}>${label}</button>`
const coins=(amount:number)=>ruCount(amount,'монета','монеты','монет')
const portions=(amount:number)=>ruCount(amount,'порция','порции','порций')
const navigation=()=>`<nav class="commission-actions commission-navigation" aria-label="Подготовка заказа">${button('Мои рецепты','open-panel','recipes')}${button('В лавку','open-panel','bay-shop')}</nav>`
const stock=(farm:FarmState,id:string)=>({bag:farm.culinary.stock[id]??0,warehouse:farm.freight.warehouses.village[`signature:${id}`]??0})
const stockText=(farm:FarmState,id:string)=>{const s=stock(farm,id);return `Припасы: ${s.bag} · склад гавани: ${s.warehouse}`}
const reward=(total:number,bonus:number)=>`<div class="commission-reward"><strong>За всю партию: ${coins(total)}</strong><small>Включая премию ${coins(bonus)} · без срока</small></div>`
const help=()=>`<details class="commission-help"><summary>Как работают заказы</summary><p>Предложение появляется после покупки вашего авторского рецепта, который понравился этому покупателю. Первое: 2 порции + премия 6 монет; второе: 3 + 9; далее: 4 + 12.</p><p>Принятие не тратит припасы. Можно откладывать по одной порции: сначала со склада гавани, затем из припасов. Прилавок не используется. Оплата — только после передачи всей партии. Отмена вернёт отложенное без награды.</p></details>`
function assortment(farm:FarmState,customer:BayShopVisitorId,choice:ShopAssortmentChoice,picture:(id:string)=>string){
  const offers=getShopCommissionOffers(farm).filter(offer=>offer.customer===customer)
  const recipes=offers.map(offer=>farm.culinary.recipes.find(recipe=>recipe.id===offer.recipeId)!)
  if(!recipes.some(recipe=>recipe.base==='tart')||!recipes.some(recipe=>recipe.base==='preserves'))return `<section class="commission-assortment"><p>Для набора нужны понравившиеся покупки двух ваших рецептов: конфитюра и тарта.</p><p>Один рецепт пока можно заказать отдельно.</p></section>`
  const first=choice.customer===customer?recipes.find(recipe=>recipe.id===choice.first):undefined
  const second=first?recipes.find(recipe=>recipe.id===choice.second&&recipe.base!==first.base):undefined
  const offer=getShopAssortment(farm,customer,first?.id,second?.id)
  const select=(part:'first'|'second')=>`<label>${part==='first'?'Первый рецепт':'Другой тип'}<select data-commission-pair="${part}" data-customer="${customer}"${part==='second'&&!first?' disabled':''}><option value="">Выберите рецепт</option>${recipes.filter(recipe=>part==='first'||recipe.base!==first?.base).map(recipe=>`<option value="${recipe.id}"${recipe.id===(part==='first'?first?.id:second?.id)?' selected':''}>${escape(recipe.name)}</option>`).join('')}</select></label>`
  return `<section class="commission-assortment" aria-label="Набор для покупателя"><p class="commission-note">Конфитюр + тарт · по 2 порции · без срока</p><div class="commission-selectors">${select('first')}${select('second')}</div>
    ${offer?`${offer.lines.map(line=>`<div class="commission-preview-line"><div class="commission-recipe">${picture(line.recipeId)}<div><strong data-user-text>${escape(line.recipeName)}</strong><small>Нужно 2 · ${stockText(farm,line.recipeId)}</small></div></div></div>`).join('')}${reward(offer.total,12)}<small class="commission-note">Стоимость блюд ${offer.total-12} + премия 12.</small>`:'<p class="commission-note">Выберите оба рецепта. Просмотр ничего не расходует.</p>'}
    ${button('Принять набор 2+2','commission-accept',offer?.key??'',!!offer&&farm.island==='village')}</section>`
}
export function renderShopCommissions(farm:FarmState,picture:(recipeId:string)=>string,choice=new ShopAssortmentChoice(),selection?:ShopCommissionView):string {
  const state=farm.shopCommissions,active=getShopCommission(farm)
  if(active)return `<section class="shop-commissions" aria-label="Текущий заказ лавки">
    <header class="commission-current" tabindex="-1"><strong>${active.customerName} · ${active.mixed?'набор 2+2':portions(active.quantity)}</strong><span>Отложено ${active.delivered}/${active.quantity}</span></header>
    ${reward(active.total,active.bonus)}
    ${!active.remaining?`<div class="commission-ready" role="status"><span>Партия готова</span>${button(`Передать · ${coins(active.total)}`,'commission-finish',String(active.serial),active.canClaim)}</div>`:''}
    <div class="commission-lines">${active.lines.map(line=>`<article class="commission-line" data-commission-line="${escape(line.actionValue)}"><div class="commission-recipe">${picture(line.recipeId)}<div><h3 data-user-text>${escape(line.recipeName)}</h3><strong>Отложено ${line.delivered}/${line.quantity}</strong><small>${stockText(farm,line.recipeId)}</small></div></div>
      ${line.remaining?`<div class="commission-actions">${button('Отложить 1','commission-deliver',line.actionValue,line.canDeliver)}${button('Открыть рецепт','commission-recipe',line.actionValue)}</div>`:'<p class="commission-line-ready">Эта часть готова</p>'}</article>`).join('')}</div>
    ${active.remaining?'<p class="commission-note">Сначала склад гавани, затем припасы. Прилавок не расходуется. Оплата после всей партии.</p>':''}
    <details class="commission-cancel"><summary>Отменить заказ</summary><p>Отложенные порции (${active.delivered}) вернутся в припасы, каждый рецепт отдельно. Без оплаты и продвижения.</p>${button('Отменить и вернуть','commission-cancel',String(active.serial),farm.island==='village')}</details>
    ${navigation()}</section>`
  const view=selection??new ShopCommissionView()
  if(!selection&&choice.customer){view.customer=choice.customer;if(choice.first)view.mode='set'}
  const {offers,customer,choices,offer}=view.current(farm),completed=Object.values(state.completed).reduce((sum,n)=>sum+n,0),last=state.last
  const receipt=last&&('lines'in last?last.lines:[last])
  const completedToday=state.lastCompletedOn===farm.day
  const receiptHtml=last&&receipt?`<details class="commission-receipt"${completedToday?' open':''}><summary>Последняя партия · ${coins(receipt.reduce((sum,line)=>sum+line.unitPrice*line.quantity,last.bonus))}</summary><p>${bayShopVisitors.find(person=>person.id===last.customer)!.name} · день ${last.day}</p>${receipt.map(line=>`<p><span data-user-text>${escape(line.recipeName)}</span> ×${line.quantity}</p>`).join('')}<p>Выплачено: ${coins(receipt.reduce((sum,line)=>sum+line.unitPrice*line.quantity,last.bonus))}.</p></details>`:''
  let preview=''
  if(completedToday)preview=`${receiptHtml}<p class="commission-timing" tabindex="-1">Сегодня заказ выполнен. Следующий — после отдыха.</p>${button('К отдыху дома','commission-rest')}`
  else if(offer&&customer){
    const customers=bayShopVisitors.filter(person=>offers.some(o=>o.customer===person.id)),set=view.mode==='set'&&offer.completed>=2,s=stock(farm,offer.recipeId)
    preview=`<div class="commission-selectors"><label>Покупатель<select data-commission-view="customer">${customers.map(person=>`<option value="${person.id}"${person.id===customer?' selected':''}>${person.name}</option>`).join('')}</select></label><label>Заказ<select data-commission-view="request">${choices.map(o=>`<option value="${o.recipeId}"${!set&&o.recipeId===offer.recipeId?' selected':''}>${escape(o.recipeName)} · ×${o.quantity}</option>`).join('')}${offer.completed>=2?`<option value="set"${set?' selected':''}>Набор 2+2</option>`:''}</select></label></div>
      ${set?assortment(farm,customer,choice,picture):`<article class="commission-selected" aria-label="Выбранный заказ"><div class="commission-recipe">${picture(offer.recipeId)}<div><h3 data-user-text>${escape(offer.recipeName)}</h3><strong>Нужно ${portions(offer.quantity)}</strong><small>${stockText(farm,offer.recipeId)}</small></div></div>${offer.completed<2?`<small class="commission-note">Набор 2+2 после двух заказов · ${offer.completed}/2</small>`:''}<p class="commission-note">${s.bag+s.warehouse>=offer.quantity?'Готовых порций уже хватает.':`Не хватает: ${portions(offer.quantity-s.bag-s.warehouse)}.`}</p><div class="commission-decision">${reward(offer.total,offer.bonus)}${button('Принять заказ','commission-accept',offer.key,farm.island==='village')}<small class="commission-note">При принятии припасы не расходуются.</small></div></article>`}`
  }else preview=`<p class="commission-empty">${farm.culinary.recipes.length?'Предложите свой рецепт в лавке. Нужна покупка, после которой этот вкус понравился.':'Приготовьте свой рецепт и предложите в лавке. Обычные блюда не открывают авторские заказы.'}</p>`
  return `<section class="shop-commissions" aria-label="Заказы постоянных покупателей">${preview}${navigation()}${help()}<p class="commission-note">Завершено заказов: ${completed}</p>
    ${completedToday?'':receiptHtml}</section>`
}
