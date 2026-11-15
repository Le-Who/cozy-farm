import { bayShopVisitors, type BayShopProduct, type BayShopState, type BayShopVisitorId } from './bay-shop-model.ts'
import { ruCount } from './ru.ts'

const escape = (v:string) => v.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!))
const money = (n:number) => ruCount(n,'монета','монеты','монет')

/** View-only selection; looking at a customer does not change visits, stock or sales. */
export class BayShopCustomerView {
  selected:BayShopVisitorId = 'bea'
  explanation = false
  choose(id:unknown):boolean {
    const person=bayShopVisitors.find(person=>person.id===id)
    if(!person)return false
    this.selected=person.id
    return true
  }
}

export function renderBayShopCustomers(state:BayShopState, view:BayShopCustomerView, catalog:readonly BayShopProduct[]=[]):string {
  const person=bayShopVisitors.find(person=>person.id===view.selected)??bayShopVisitors[0]
  const memory=state.memories[person.id], visitor=state.visitor?.id===person.id?state.visitor:null
  const purchases=Object.entries(memory.purchases).sort(([,a],[,b])=>b.liked-a.liked||b.bought-a.bought)
  const total=purchases.reduce((sum,[,purchase])=>sum+purchase.bought,0)
  const reputation=Object.entries(state.reputation).sort(([,a],[,b])=>b.liked-a.liked||b.sold-a.sold)
  // A renamed recipe keeps its learned identity; an archived one keeps its last observed name.
  const productName=(key:string)=>catalog.find(product=>key.startsWith('signature:')&&product.signature&&product.id===key&&product.identity===key)?.name??state.reputation[key].name
  return `<div class="bay-shop-customers">
    <div class="bay-shop-customer-roster" role="group" aria-label="Выберите покупателя">${bayShopVisitors.map(customer=>`<button type="button" data-customer="${customer.id}" aria-pressed="${customer.id===person.id}" aria-controls="bay-shop-customer-card"><img src="/art/lavender/${customer.art==='guest'?'fair-guest':`ui-${customer.art}`}.webp" alt="" draggable="false"><strong>${customer.name}</strong></button>`).join('')}</div>
    <article class="bay-shop-customer-card" id="bay-shop-customer-card" aria-label="${person.name}">
      <header><h3>${person.name}</h3><span>Встречи: ${memory.visits} · покупки: ${total}</span></header>
      <p class="bay-shop-customer-budget">${visitor?'Бюджет этого визита':'Базовый бюджет визита'}: <strong>${money(visitor?.budget??person.budget)}</strong><small>Не цена товара и не оценка качества.</small></p>
      ${memory.visits?`<p class="bay-shop-customer-wish">Просит: «${person.wish}».</p>`:''}
      ${purchases.length?`<ul class="bay-shop-customer-purchases" aria-label="Наблюдения после покупок">${purchases.map(([key,purchase])=>`<li data-customer-product="${escape(key)}"><strong data-user-text>${escape(productName(key))}</strong><span>Куплено: ${purchase.bought}${purchase.liked>0?` · Понравилось: ${purchase.liked}`:''}</span></li>`).join('')}</ul>`:`<p class="bay-shop-customer-unknown">${memory.visits?'Покупок пока нет. Любимые товары ещё неизвестны.':'Встреч ещё не было. Любимые товары ещё неизвестны.'}</p>`}
    </article>
    <button class="bay-shop-customer-help" type="button" data-customer-help aria-expanded="${view.explanation}" aria-controls="bay-shop-customer-explanation">${view.explanation?'Скрыть пояснение':'Как читать вкусы и бюджет'}</button>
    <div class="bay-shop-customer-explanation" id="bay-shop-customer-explanation"${view.explanation?'':' hidden'}><p>Здесь только реакции после покупок конкретного товара. Покупка сама по себе не означает, что вкус стал любимым. Знакомый понравившийся рецепт охотнее выбирают снова.</p><p>Бюджет — монеты на один визит. В следующих визитах он может быть больше базового. Даже в пределах бюджета покупатель сравнивает товар и цену: покупка не гарантирована.</p></div>
    <section class="bay-shop-customer-history" aria-label="Общий журнал лавки"><div class="bay-shop-customer-totals"><span>Продано: <strong>${state.sold}</strong></span><span>Выручка: <strong>${money(state.revenue)}</strong></span></div>
      ${reputation.length?`<h3>Продажи по товарам</h3>${reputation.map(([key,rep])=>{
        const fans=bayShopVisitors.filter(customer=>(state.memories[customer.id].purchases[key]?.liked??0)>0).map(customer=>customer.name)
        return `<div class="bay-shop-reputation"><strong data-user-text>${escape(productName(key))}</strong><span>Купили: ${rep.sold} · понравилось: ${rep.liked}</span><small>${fans.length?`Помнят вкус: ${fans.join(', ')}`:'Первое знакомство с вашим товаром'}</small></div>`
      }).join('')}`:''}
    </section>
  </div>`
}
