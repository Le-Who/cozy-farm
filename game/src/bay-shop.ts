import {
  advanceBayShop, bayShopDailyLimit, bayShopPhaseDuration, bayShopVisitors, removeBayShopStock, setBayShopOpen,
  setBayShopPrice, stockBayShop, syncBayShopProducts, type BayShopProduct, type BayShopState, type BayShopStock,
} from './bay-shop-model.ts';
import './bay-shop.css';
import { applyIngredientFinishes } from './ingredient-finish';

export type BayShopOptions = {
  state: BayShopState;
  catalog?: readonly BayShopProduct[];
  products(): BayShopStock[];
  takeStock(id: string, quantity: number): boolean;
  returnStock(id: string, quantity: number): void;
  onEarn(coins: number): void;
  onChange(): void;
  onClose(): void;
  onOpenFreight?(): void;
  renderProduct?(product: BayShopProduct, className: string): string;
  performanceBonus?(): number;
  background?: string;
};
const escape = (v: string) => v.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const money = (n: number) => n.toLocaleString('ru-RU');
const visitorMessages = {
  empty: 'На полках пока пусто. Загляну чуть позже!', expensive: 'Красиво, но за такую цену я пока подожду.',
  budget: 'Сегодня у меня не хватит монет. Вернусь в другой раз!', closed: 'До скорой встречи!',
} as const;

/** A scene owns its animation; the farm owns inventory, earnings and persistence. */
export function mountBayShop(host: HTMLElement, options: BayShopOptions): { destroy(): void; refresh(): void } {
  const state = options.state;
  if (options.catalog && syncBayShopProducts(state, options.catalog)) options.onChange();
  let selected = state.slots.findIndex(slot => slot === null); if (selected < 0) selected = 0;
  let tab: 'stock' | 'journal' = 'stock', notice = '', noticeTimer = 0, destroyed = false, frame = 0, lastTime = performance.now();
  let lastPhase = '', lastVisitor = '', lastSpeech = '', savedAt = 0, rendering = false;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const art = (product: BayShopProduct, cls = '') => options.renderProduct?.(product, cls)
    ?? `<img class="${cls}" src="${escape(product.image)}" alt="" draggable="false">`;
  function visitorSpeech(): string {
    const visitor = state.visitor;
    if (!visitor) return state.open ? state.visitsToday >= bayShopDailyLimit(options.performanceBonus?.() ?? 0, state.festivalVisitors)
      ? 'Новые гости придут завтра.' : ''
      : '';
    const person = bayShopVisitors.find(v => v.id === visitor.id)!;
    if (visitor.phase === 'approaching') return `${person.name}: ${person.wish}.`;
    if (visitor.phase === 'browsing') return `${person.name} выбирает · с собой ${money(visitor.budget)} монет`;
    if (visitor.outcome?.kind === 'bought') {
      const bought = visitor.outcome;
      return `${person.name}: ${bought.returning ? 'Снова за любимым! ' : ''}${bought.liked ? 'Как раз по моему вкусу! ' : 'Возьму попробовать. '}«${bought.name}» · ${money(bought.price)} монет`;
    }
    return `${person.name}: ${visitor.outcome ? visitorMessages[visitor.outcome.kind] : 'До встречи!'}`;
  }
  function stockControls(): string {
    const slot = state.slots[selected], products = options.products().filter(p => p.quantity > 0);
    const selectedPanel = slot ? `<div class="bay-shop-selected">
      <span class="bay-shop-selected-art">${art(slot.product)}</span><div><strong data-user-text>${escape(slot.product.name)}</strong><span>На полке ×${slot.quantity}</span></div>
      <label class="bay-shop-price">Цена <span><input data-price type="number" inputmode="numeric" min="1" max="10000" step="1" value="${slot.price}" aria-label="Цена товара в монетах"><span aria-hidden="true">●</span></span></label>
      <div class="bay-shop-price-presets" aria-label="Быстрая цена">${[[.8, '−20%'], [1, 'Обычно'], [1.35, '+35%']].map(([factor, label]) => `<button type="button" data-price-factor="${factor}" aria-label="${label}: ${Math.max(1, Math.round(slot.product.basePrice * Number(factor)))} монет" aria-pressed="${slot.price === Math.max(1, Math.round(slot.product.basePrice * Number(factor)))}">${label}</button>`).join('')}</div>
      <button type="button" class="bay-shop-return" data-return aria-label="Убрать товар в запас" title="Убрать в запас">↶</button>
      </div>` : `<p class="bay-shop-empty-slot">Нажмите товар — он появится на полке.</p>`;
    return `${selectedPanel}<div class="bay-shop-stock-heading"><strong>Припасы</strong></div>
      <div class="bay-shop-products">${products.length ? products.map(product => {
        return `<button type="button" class="bay-shop-product" data-user-text data-stock="${escape(product.id)}" aria-label="Выставить товар: ${escape(product.name)}. В запасе: ${product.quantity}"><span class="bay-shop-product-art">${art(product)}</span><span data-user-text>${escape(product.name)}</span><small>×${product.quantity}</small>${product.signature ? '<em title="Мой рецепт" aria-label="Мой рецепт">♥</em>' : ''}</button>`;
      }).join('') : `<div class="bay-shop-stock-empty"><p>Привезите продукты или испеките булочки.</p>${options.onOpenFreight ? '<button type="button" data-freight>Открыть склад</button>' : ''}</div>`}</div>`;
  }
  function journal(): string {
    const reputation = Object.entries(state.reputation).sort(([, a], [, b]) => b.liked - a.liked || b.sold - a.sold);
    return `<div class="bay-shop-journal"><div class="bay-shop-journal-totals"><span>Продано <strong>${state.sold}</strong></span><span>Выручка <strong>${money(state.revenue)} <small>монет</small></strong></span></div>
      <h3>Товары, за которыми возвращаются</h3>${reputation.length ? reputation.map(([key, rep]) => {
        const fans = bayShopVisitors.filter(person => (state.memories[person.id].purchases[key]?.liked ?? 0) > 0).map(person => person.name);
        return `<div class="bay-shop-reputation"><strong data-user-text>${escape(rep.name)}</strong><span>Купили: ${rep.sold} · понравилось: ${rep.liked}</span><small>${fans.length ? `Помнят вкус: ${fans.join(', ')}` : 'Первое знакомство с вашим товаром'}</small></div>`;
      }).join('') : '<p>После первых покупок здесь появятся любимые товары жителей. Они запоминают конкретный рецепт и охотнее выбирают его снова.</p>'}
      <h3>Кто заходит в лавку</h3><div class="bay-shop-customer-list">${bayShopVisitors.map(person => {
        const memory = state.memories[person.id], purchases = Object.values(memory.purchases).reduce((sum, p) => sum + p.bought, 0);
        return `<div><strong>${person.name}</strong><span>${person.wish}</span><small>${memory.visits ? `Встречи: ${memory.visits} · покупки: ${purchases}` : `Бюджет от ${person.budget} монет`}</small></div>`;
      }).join('')}</div></div>`;
  }
  function render(): void {
    if (destroyed) return;
    const active = document.activeElement instanceof HTMLElement && host.contains(document.activeElement) ? document.activeElement : null;
    const priceDraft = active instanceof HTMLInputElement && active.hasAttribute('data-price') ? active.value : undefined;
    const focusAttribute = active ? ['data-slot', 'data-stock', 'data-tab', 'data-price-factor', 'data-price', 'data-open', 'data-return', 'data-close', 'data-freight'].find(key => active.hasAttribute(key)) : undefined;
    const focusValue = focusAttribute ? active!.getAttribute(focusAttribute)! : '';
    const scroll = host.querySelector('.bay-shop-desk-content')?.scrollTop ?? 0;
    rendering = true;
    host.innerHTML = `<section class="bay-shop" aria-label="Своя лавка у моря">
      <header class="bay-shop-header"><div><h2>Своя лавка</h2></div><div class="bay-shop-header-actions"><button type="button" class="bay-shop-open" data-open aria-pressed="${state.open}">${state.open ? 'Закрыть лавку' : 'Открыть лавку'}</button><button type="button" class="bay-shop-close" data-close aria-label="Закрыть лавку и вернуться">×</button></div></header>
      <div class="bay-shop-scene"><div class="bay-shop-stage" style="background-image:url('${escape(options.background ?? '/art/lavender/bay/shop.webp')}')">
        <div class="bay-shop-display" aria-label="Четыре места на прилавке">${state.slots.map((slot, index) => `<button type="button" class="bay-shop-shelf ${index === selected ? 'is-selected' : ''}" data-user-text data-slot="${index}" aria-pressed="${index === selected}" aria-label="Место ${index + 1}${slot ? `: ${escape(slot.product.name)}, остаток ${slot.quantity}, цена ${slot.price} монет` : ': свободно'}">
          <span class="bay-shop-shelf-product">${slot && slot.quantity > 0 ? art(slot.product) : `<span class="bay-shop-shelf-empty">${slot ? 'Продано' : '+'}</span>`}</span>${slot ? `<span class="bay-shop-shelf-label">${money(slot.price)} <span aria-hidden="true">●</span><small>×${slot.quantity}</small></span>` : ''}</button>`).join('')}</div>
        <div class="bay-shop-visitor" aria-hidden="true"><span class="bay-shop-contact-shadow"></span><span class="bay-shop-person"></span><span class="bay-shop-purchase"></span></div>
      </div><div class="bay-shop-speech" data-user-text role="status" aria-live="polite"></div></div>
      <div class="bay-shop-desk"><nav class="bay-shop-tabs" aria-label="Управление лавкой"><button type="button" data-tab="stock" aria-pressed="${tab === 'stock'}">Прилавок</button><button type="button" data-tab="journal" aria-pressed="${tab === 'journal'}">Покупатели</button>${options.performanceBonus?.() ? '<span title="Сегодня ещё два гостя из сада">+2 гостя ♫</span>' : ''}</nav>
      <p class="bay-shop-notice" role="status">${escape(notice)}</p><div class="bay-shop-desk-content">${tab === 'stock' ? stockControls() : journal()}</div></div>
      </section>`;
    rendering = false;
    const priceInput = host.querySelector<HTMLInputElement>('[data-price]');
    if (priceInput && priceDraft !== undefined) priceInput.value = priceDraft;
    lastVisitor = ''; lastSpeech = ''; fitStage(); paintVisitor(); applyIngredientFinishes(host);
    paintNotice();
    const content = host.querySelector('.bay-shop-desk-content'); if (content) content.scrollTop = scroll;
    if (focusAttribute) {
      const target = host.querySelector<HTMLElement>(`[${focusAttribute}="${CSS.escape(focusValue)}"]`);
      (target && !target.matches(':disabled') ? target : host.querySelector<HTMLElement>(`[data-slot="${selected}"]`))?.focus({ preventScroll: true });
    }
  }
  function paintNotice(): void {
    const status = host.querySelector('.bay-shop-notice'); if (status) status.textContent = notice;
    clearTimeout(noticeTimer);
    if (notice) noticeTimer = window.setTimeout(() => { notice = ''; const status = host.querySelector('.bay-shop-notice'); if (status) status.textContent = ''; }, 3500);
  }
  function fitStage(): void {
    const scene = host.querySelector<HTMLElement>('.bay-shop-scene'), stage = host.querySelector<HTMLElement>('.bay-shop-stage');
    if (!scene || !stage) return;
    const width = Math.max(scene.clientWidth, scene.clientHeight * 1.5), height = width / 1.5;
    Object.assign(stage.style, { width: `${width}px`, height: `${height}px`, left: `${(scene.clientWidth - width) / 2}px`, top: `${(scene.clientHeight - height) * .72}px` });
  }
  function paintVisitor(): void {
    const node = host.querySelector<HTMLElement>('.bay-shop-visitor'), speech = host.querySelector<HTMLElement>('.bay-shop-speech');
    if (!node || !speech) return;
    const message = visitorSpeech();
    if (message !== lastSpeech) { speech.textContent = message; lastSpeech = message; }
    const visitor = state.visitor;
    node.hidden = !visitor;
    if (!visitor) return;
    const person = bayShopVisitors.find(p => p.id === visitor.id)!;
    const progress = visitor.elapsed / bayShopPhaseDuration[visitor.phase];
    const approaching = visitor.phase === 'approaching', departing = visitor.phase === 'departing', walking = approaching || departing;
    const x = approaching ? -9 + 53 * progress : departing ? 44 + 66 * progress : 44;
    node.style.left = `${x}%`; node.style.opacity = String(approaching ? Math.min(1, progress * 7) : departing ? Math.min(1, (1 - progress) * 7) : 1);
    const sprite = node.querySelector<HTMLElement>('.bay-shop-person')!;
    const sheet = person.art === 'guest' ? 'fair-guest-walk' : `village-${person.art}`;
    const frames = person.art === 'guest' ? 4 : 6;
    const spriteFrame = walking && !reducedMotion.matches ? person.art === 'guest' ? Math.floor(visitor.elapsed / 190) % 4 : 1 + Math.floor(visitor.elapsed / 190) % 4 : visitor.outcome?.kind === 'bought' && person.art !== 'guest' ? 5 : 0;
    sprite.style.backgroundImage = `url('/art/lavender/${sheet}.webp')`;
    sprite.style.backgroundSize = `${frames * 100}% 100%`;
    sprite.style.backgroundPosition = `${spriteFrame / (frames - 1) * 100}% 0`;
    const key = `${visitor.serial}:${visitor.phase}`;
    if (key !== lastVisitor) {
      node.dataset.phase = visitor.phase;
      const item = node.querySelector<HTMLElement>('.bay-shop-purchase')!;
      const outcome = visitor.outcome;
      if (outcome?.kind === 'bought') {
        const product = state.slots.find(slot => slot?.product.identity === outcome.identity)?.product ?? options.products().find(p => p.identity === outcome.identity);
        item.innerHTML = product ? art(product) : ''; item.hidden = !product; applyIngredientFinishes(item);
      } else { item.innerHTML = ''; item.hidden = true; }
      lastVisitor = key;
    }
  }
  function changed(): void { options.onChange(); render(); }
  function click(event: Event): void {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!button || !host.contains(button) || button.disabled) return;
    if (button.hasAttribute('data-close')) { options.onClose(); return; }
    if (button.hasAttribute('data-freight')) { options.onOpenFreight?.(); return; }
    if (button.hasAttribute('data-open')) {
      if (!state.open && !state.slots.some(slot => slot && slot.quantity > 0)) { notice = 'Сначала поставьте хотя бы один товар на прилавок.'; render(); return; }
      setBayShopOpen(state, !state.open); notice = state.open ? 'Лавка открыта' : 'Лавка закрыта'; changed(); return;
    }
    if (button.dataset.slot !== undefined) { selected = Number(button.dataset.slot); tab = 'stock'; notice = ''; render(); return; }
    if (button.dataset.tab) { tab = button.dataset.tab as typeof tab; notice = ''; render(); return; }
    if (button.hasAttribute('data-return')) {
      const returned = removeBayShopStock(state, selected);
      if (returned && returned.quantity > 0) options.returnStock(returned.id, returned.quantity);
      notice = returned?.quantity ? 'Товары в припасах.' : 'Место на прилавке освобождено.'; changed(); return;
    }
    if (button.dataset.priceFactor) {
      const slot = state.slots[selected]; if (!slot) return;
      setBayShopPrice(state, selected, Math.max(1, Math.min(10_000, Math.round(slot.product.basePrice * Number(button.dataset.priceFactor)))));
      notice = ''; changed(); return;
    }
    if (button.dataset.stock) {
      const product = options.products().find(p => p.id === button.dataset.stock);
      if (!product || product.quantity < 1) return;
      const slot = state.slots[selected];
      if (slot && (slot.product.id !== product.id || slot.product.identity !== product.identity || slot.quantity >= 999)) {
        const matching = state.slots.findIndex(item => item?.product.id === product.id && item.product.identity === product.identity && item.quantity < 999);
        const empty = state.slots.findIndex(item => item === null);
        if (matching < 0 && empty < 0) { notice = 'Все места заняты. Уберите товар кнопкой ↶.'; render(); return; }
        selected = matching >= 0 ? matching : empty;
      }
      if (!options.takeStock(product.id, 1)) { notice = 'В местном запасе этот товар уже закончился.'; render(); return; }
      if (!stockBayShop(state, selected, product, 1)) { options.returnStock(product.id, 1); notice = 'Не удалось выставить товар.'; }
      else notice = '+1 на полке';
      changed();
    }
  }
  function change(event: Event): void {
    if (rendering) return;
    const input = event.target as HTMLInputElement;
    if (!input.matches('[data-price]')) return;
    if (event.type === 'focusout' && input.value === String(state.slots[selected]?.price)) return;
    if (!setBayShopPrice(state, selected, Number(input.value))) {
      notice = 'Укажите целую цену от 1 до 10 000 монет.';
      input.value = String(state.slots[selected]?.price ?? 1);
    } else {
      notice = 'Цена сохранена'; options.onChange();
      const slot = state.slots[selected]!, shelf = host.querySelector<HTMLElement>(`[data-slot="${selected}"]`);
      shelf?.setAttribute('aria-label', `Место ${selected + 1}: ${slot.product.name}, остаток ${slot.quantity}, цена ${slot.price} монет`);
      const label = shelf?.querySelector('.bay-shop-shelf-label');
      if (label) label.innerHTML = `${money(slot.price)} <span aria-hidden="true">●</span><small>×${slot.quantity}</small>`;
      for (const preset of host.querySelectorAll<HTMLButtonElement>('[data-price-factor]')) {
        preset.setAttribute('aria-pressed', String(slot.price === Math.max(1, Math.round(slot.product.basePrice * Number(preset.dataset.priceFactor)))));
      }
    }
    paintNotice();
  }
  function tick(now: number): void {
    if (destroyed) return;
    const elapsed = now - lastTime; lastTime = now;
    if (!document.hidden && elapsed < 1500) {
      const sales = advanceBayShop(state, elapsed, options.performanceBonus?.() ?? 0);
      for (const sale of sales) options.onEarn(sale.price);
      const phase = state.visitor ? `${state.visitor.serial}:${state.visitor.phase}` : 'idle';
      if (sales.length) { options.onChange(); render(); savedAt = now; }
      else if (phase !== lastPhase || now - savedAt > 5000 && state.visitor) { options.onChange(); savedAt = now; }
      lastPhase = phase; paintVisitor();
    }
    frame = requestAnimationFrame(tick);
  }
  const resizeObserver = new ResizeObserver(fitStage); resizeObserver.observe(host);
  host.addEventListener('click', click); host.addEventListener('change', change); host.addEventListener('focusout', change);
  render(); frame = requestAnimationFrame(tick);
  return {
    refresh: render,
    destroy() { if (destroyed) return; destroyed = true; clearTimeout(noticeTimer); cancelAnimationFrame(frame); resizeObserver.disconnect(); host.removeEventListener('click', click); host.removeEventListener('change', change); host.removeEventListener('focusout', change); options.onChange(); host.innerHTML = ''; },
  };
}
