import { playBaySound } from './game-sound'
import { bayShopDayGuidance } from './bay-shop-day'
import { bayShopPurchaseReaction } from './bay-shop-speech'
import { ruCount } from './ru'
import {
  advanceBayShop, bayShopPhaseDuration, bayShopVisitors, removeBayShopStock, setBayShopOpen,
  setBayShopPrice, syncBayShopProducts, type BayShopProduct, type BayShopState, type BayShopStock, type BayShopVisitorId,
} from './bay-shop-model.ts';
import './bay-shop.css';
import { BayShopCustomerView, renderBayShopCustomers } from './bay-shop-customers';
import './bay-shop-customers.css';
import { currentShopRecipeRefill, placeShopQuantity, shopQuantityPreview, shopStockSlot, type ShopRecipeRefill } from './bay-shop-quantity';
import { shopRemainderQuote, shopReturnLabel } from './bay-shop-price-copy';
import { applyIngredientFinishes } from './ingredient-finish';

export type BayShopStockGroup = 'harvest' | 'kitchen' | 'shore';
type StockGroup = 'all' | BayShopStockGroup;
type GroupedStock = BayShopStock & { group?: BayShopStockGroup };

export type BayShopCommissionPreview = { customer: BayShopVisitorId; recipeId: string; key: string };

export type BayShopOptions = {
  state: BayShopState;
  stockProduct?: string;
  recipeProduct?: string;
  recipeRefill?: ShopRecipeRefill;
  returnToRecipe?: boolean;
  catalog?: readonly BayShopProduct[];
  products(): GroupedStock[];
  takeStock(id: string, quantity: number): boolean;
  returnStock(id: string, quantity: number): void;
  onEarn(coins: number): void;
  onChange(): void;
  onClose(): void;
  onReturnMarket?(): void;
  onOpenFreight?(): void;
  commissionCustomers?(): readonly BayShopVisitorId[];
  readyCommission?(customer: BayShopVisitorId, recipeId: string): BayShopCommissionPreview | undefined;
  onOpenCommissions?(customer?: BayShopVisitorId, preview?: BayShopCommissionPreview): void;
  onOpenMusic?(): void;
  onGoRest?(): void;
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

const stockGroupLabels = [['all','Всё'],['harvest','Урожай'],['kitchen','Кухня'],['shore','Берег']] as const;
const productGroup = (product: GroupedStock) => product.group ?? 'harvest';
function shopStockGroups(products: GroupedStock[], group: StockGroup) {
  const choices = stockGroupLabels.filter(([id]) => id === 'all' || products.some(product => productGroup(product) === id));
  // Skip shallow lists, but don't discard an active category on small stock changes.
  return choices.length > 2 && (products.length > 12 || group !== 'all' && choices.some(([id]) => id === group)) ? choices : [];
}

/** A scene owns its animation; the farm owns inventory, earnings and persistence. */
export function mountBayShop(host: HTMLElement, options: BayShopOptions): { destroy(): void; refresh(): void; focusListing(id: string): void } {
  const state = options.state;
  const hasShelfStock = () => state.slots.some(slot => slot && slot.quantity > 0);
  const canToggleOpen = () => state.open || hasShelfStock();
  const customerView = new BayShopCustomerView();
  // Exact entry is only a quote. Defer catalog writes to an explicit placement.
  const quotedProduct = options.stockProduct ?? options.recipeRefill?.id ?? options.recipeProduct;
  const recipeReturn = !!options.stockProduct || !!options.recipeRefill || options.returnToRecipe;
  const closeLabel = recipeReturn ? 'К рецепту' : 'Вернуться в бухту';
  if (!quotedProduct && options.catalog && syncBayShopProducts(state, options.catalog)) options.onChange();
  let savedShopState = JSON.stringify(state);
  function saveChanges() { options.onChange(); savedShopState = JSON.stringify(state); }
  let selected = state.slots.findIndex(slot => slot === null); if (selected < 0) selected = 0;
  type ShelfListing = { slot: NonNullable<BayShopState['slots'][number]>; product: BayShopProduct; price: number };
  type LiveRefill = ShelfListing & { index: number; day: number };
  let mountedLiveRefill: LiveRefill | undefined;
  let pending: { id: string; identity: string; quantity: string; listScroll: number; soldShelf?: number; liveRefill?: LiveRefill; replacing?: ShelfListing; refill?: ShopRecipeRefill } | undefined;
  let stockGroup: StockGroup = 'all';
  let tab: 'stock' | 'journal' = 'stock', notice = '', noticeTimer = 0, destroyed = false, frame = 0, lastTime = performance.now();
  let lastPhase = !state.open && !state.visitor ? 'idle' : '', lastVisitor = '', lastSpeech = '', savedAt = 0, rendering = false;
  // Only this live scene owns a recently observed refusal. The save and customer ledger stay unchanged.
  let lastRefusal: { buyer: BayShopVisitorId; serial: number; day: number; kind: 'expensive' | 'budget' } | undefined;
  // A new order belongs only to the sale this open scene actually observed.
  let earnedOrder: BayShopCommissionPreview | undefined;
  function readyEarnedOrder(): BayShopCommissionPreview | undefined {
    const order = earnedOrder;
    if (!order || tab !== 'stock' || !state.open || pending || hasShelfStock()) return;
    return options.readyCommission?.(order.customer, order.recipeId)?.key === order.key ? order : undefined;
  }
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const art = (product: BayShopProduct, cls = '') => options.renderProduct?.(product, cls)
    ?? `<img class="${cls}" src="${escape(product.image)}" alt="" draggable="false">`;
  function visitorSpeech(): string {
    const visitor = state.visitor;
    if (!visitor) return '';
    const person = bayShopVisitors.find(v => v.id === visitor.id)!;
    if (visitor.phase === 'approaching') return `${person.name}: ${person.wish}.`;
    if (visitor.phase === 'browsing') return `${person.name} выбирает · с собой ${money(visitor.budget)} монет`;
    if (visitor.outcome?.kind === 'bought') {
      const bought = visitor.outcome;
      return `${person.name}: ${bayShopPurchaseReaction(bought)} «${bought.name}» · ${money(bought.price)} монет`;
    }
    return `${person.name}: ${visitor.outcome ? visitorMessages[visitor.outcome.kind] : 'До встречи!'}`;
  }
  function selectedShelfStock(products: readonly GroupedStock[]) {
    const shelf = state.slots[selected];
    if (!shelf) return;
    return products.find(product => product.quantity > 0 && product.id === shelf.product.id &&
      product.identity === shelf.product.identity && shopQuantityPreview(state,selected,product,1).valid);
  }
  function soldShelfStock(products: readonly GroupedStock[]) {
    if (state.slots[selected]?.quantity === 0) return selectedShelfStock(products);
  }
  function currentLiveRefill(quote: LiveRefill): boolean {
    return quote.index === selected && quote.day === state.businessDay && state.slots[selected] === quote.slot
      && quote.slot.product === quote.product && quote.slot.price === quote.price;
  }
  function stockForPending(products: readonly GroupedStock[]) {
    const quote = pending;
    if (!quote || quote.refill && !currentShopRecipeRefill(state, quote.refill)) return;
    // A purchase may reduce this same listing to zero while a player is choosing quantity.
    // Keep that live count, but never let a different/repriced listing inherit its quote.
    const product = quote.liveRefill ? currentLiveRefill(quote.liveRefill) ? selectedShelfStock(products) : undefined
      : quote.soldShelf === undefined ? products.find(p => p.id === quote.id && p.identity === quote.identity)
      : quote.soldShelf === selected ? soldShelfStock(products) : undefined;
    return product?.id === quote.id && product.identity === quote.identity ? product : undefined;
  }
  function quotedShelf(index: number, replacing?: ShelfListing): BayShopState | undefined {
    if (!replacing) return state;
    const slot = state.slots[index];
    if (slot !== replacing.slot || slot.quantity !== 0 || slot.product !== replacing.product || slot.price !== replacing.price) return;
    // Quote and validate the empty place without erasing the live listing.
    const slots = [...state.slots]; slots[index] = null;
    return { ...state, slots };
  }
  function previewStock(product: BayShopStock, preferred: number, soldShelf?: number, replacing?: ShelfListing, refill?: ShopRecipeRefill, liveRefill?: LiveRefill): boolean {
    const slot = replacing ? preferred : liveRefill?.index ?? soldShelf ?? shopStockSlot(state, product, preferred);
    const quote = quotedShelf(slot, replacing);
    if (!quote || !shopQuantityPreview(quote,slot,product,1).valid) return false;
    selected = slot;
    pending = { id: product.id, identity: product.identity, quantity: '1', listScroll: host.querySelector('.bay-shop-products')?.scrollTop ?? 0, soldShelf, liveRefill, replacing, refill };
    return true;
  }
  function stockButton(product: GroupedStock, shelf?: number, live?: LiveRefill) {
    const pin = shelf === undefined ? '' : ` data-stock-${live ? 'live' : 'sold'}-shelf="${shelf}" data-stock-identity="${escape(product.identity)}"`;
    const balance = live ? `На полке ×${live.slot.quantity}` : '';
    return `<button type="button" class="bay-shop-product${pin ? ' bay-shop-refill' : ''}" data-user-text data-stock="${escape(product.id)}" data-action="shop-stock-select"${pin} aria-label="Выбрать товар: ${escape(product.name)}. В запасе: ${product.quantity}${balance ? `. ${balance}` : ''}"><span class="bay-shop-product-art">${art(product)}</span><span data-user-text>${escape(product.name)}</span>${balance ? `<span class="bay-shop-live-count">${balance}</span>` : ''}<small>×${product.quantity}</small>${product.signature ? '<em title="Мой рецепт" aria-label="Мой рецепт">♥</em>' : ''}</button>`;
  }
  function stockControls(): string {
    const slot = state.slots[selected], products = options.products().filter(p => p.quantity > 0);
    if (pending) {
      const product = stockForPending(products), quote = quotedShelf(selected, pending.replacing);
      if (!product || !quote) return `<p>${pending.soldShelf === undefined && !pending.liveRefill && !pending.replacing ? 'Этот товар уже закончился.' : 'Проверьте количество и свободное место на полке.'}</p><button type="button" data-stock-cancel>Вернуться к припасам</button>`;
      const preview = shopQuantityPreview(quote, selected, product, Number(pending.quantity));
      const replaces = pending.replacing ? ` · вместо «${escape(pending.replacing.product.name)}»` : '';
      return `<div class="bay-shop-quantity"><h3 data-user-text>${escape(product.name)}</h3><p>Место ${selected + 1}${replaces} · в припасах и на складе гавани: ${product.quantity}</p>
        <form data-stock-form><label>Количество на полку<input data-stock-quantity type="number" inputmode="numeric" min="1" max="${preview.maximum}" step="1" value="${escape(pending.quantity)}" aria-label="Количество на полку"></label>
        <p data-stock-preview role="status"></p><div class="bay-shop-quantity-actions"><button type="submit" data-stock-confirm data-action="shop-stock-confirm">Выставить</button><button type="button" data-stock-cancel>Отмена</button></div></form></div>`;
    }
    const refill = selectedShelfStock(products);
    if (refill && slot && slot.quantity > 0)
      mountedLiveRefill = { index: selected, slot, product: slot.product, price: slot.price, day: state.businessDay };
    const selectedPanel = slot ? `<div class="bay-shop-selected">
      ${refill ? stockButton(refill,selected,mountedLiveRefill) : `<span class="bay-shop-selected-art">${art(slot.product)}</span><div><strong data-user-text>${escape(slot.product.name)}</strong><span>На полке ×${slot.quantity}</span></div>`}
      <label class="bay-shop-price">За 1 шт. <span><input data-price type="number" inputmode="numeric" min="1" max="10000" step="1" value="${slot.price}" aria-label="Цена за одну штуку в монетах"><span aria-hidden="true">●</span></span></label>
      <div class="bay-shop-price-presets" aria-label="Быстрая цена">${[[.8, '−20%'], [1, 'Обычно'], [1.35, '+35%']].map(([factor, label]) => `<button type="button" data-price-factor="${factor}" aria-label="${label}: ${Math.max(1, Math.round(slot.product.basePrice * Number(factor)))} монет" aria-pressed="${slot.price === Math.max(1, Math.round(slot.product.basePrice * Number(factor)))}">${label}</button>`).join('')}</div>
      <button type="button" class="bay-shop-return" data-return aria-label="${shopReturnLabel(slot.quantity)}" title="${shopReturnLabel(slot.quantity)}">↶</button>
      <p class="bay-shop-remainder" data-shelf-quote>${shopRemainderQuote(slot.quantity,slot.price)}</p>
      </div>` : `<p class="bay-shop-empty-slot">Выберите товар и количество для полки.</p>`;
    const groups = shopStockGroups(products,stockGroup);
    if (!groups.some(([id]) => id === stockGroup)) stockGroup = 'all';
    const heading = groups.length ? `<div class="bay-shop-stock-heading bay-shop-stock-groups" role="group" aria-label="Группы припасов">${groups.map(([id,label]) =>
      `<button type="button" data-stock-group="${id}" aria-pressed="${id === stockGroup}" aria-controls="bay-shop-stock-grid">${label}</button>`).join('')}</div>`
      : '<div class="bay-shop-stock-heading"><strong>Припасы</strong></div>';
    const visible = stockGroup === 'all' ? products : products.filter(product => productGroup(product) === stockGroup);
    return `${selectedPanel}${heading}
      <div class="bay-shop-products" id="bay-shop-stock-grid">${visible.length ? visible.filter(product => product !== refill).map(product => stockButton(product)).join('')
        : `<div class="bay-shop-stock-empty"><p>Привезите продукты или испеките булочки.</p>${options.onOpenFreight ? '<button type="button" data-freight>К парому</button>' : ''}</div>`}</div>`;
  }
  function commissionCustomer() {
    return tab === 'journal' ? bayShopVisitors.find(person => person.id === customerView.selected && options.commissionCustomers?.().includes(person.id)) : undefined;
  }
  type StockReturn = { id?: string; listScroll: number };
  function render(returnStock?: StockReturn): void {
    if (destroyed) return;
    const commission = commissionCustomer(), earned = readyEarnedOrder();
    const commissionName = earned ? bayShopVisitors.find(person => person.id === earned.customer)?.name : commission?.name;
    const active = document.activeElement instanceof HTMLElement && host.contains(document.activeElement) ? document.activeElement : null;
    const priceDraft = active instanceof HTMLInputElement && active.hasAttribute('data-price') ? active.value : undefined;
    const focusAttribute = returnStock?.id ? 'data-stock' : active ? ['data-customer', 'data-customer-help', 'data-customer-history', 'data-slot', 'data-stock', 'data-stock-group', 'data-tab', 'data-price-factor', 'data-price', 'data-stock-quantity', 'data-stock-confirm', 'data-stock-cancel', 'data-open', 'data-return', 'data-close', 'data-shop-market-home', 'data-freight', 'data-shop-next', 'data-commissions'].find(key => active.hasAttribute(key)) : undefined;
    const focusValue = returnStock?.id ?? (focusAttribute ? active!.getAttribute(focusAttribute)! : '');
    const scroll = host.querySelector('.bay-shop-desk-content')?.scrollTop ?? 0;
    // The catalog scrolls inside the desk; the desk itself is clipped in this view.
    const listScroll = returnStock?.listScroll ?? host.querySelector('.bay-shop-products')?.scrollTop;
    rendering = true;
    mountedLiveRefill = undefined;
    host.innerHTML = `<section class="bay-shop" aria-label="Своя лавка у моря">
      <header class="bay-shop-header"><div><h2>Своя лавка</h2></div><div class="bay-shop-header-actions"><button type="button" class="bay-shop-open" data-open aria-pressed="${state.open}"${canToggleOpen() ? '' : ' disabled'}>${state.open ? 'Закрыть лавку' : 'Открыть лавку'}</button>${options.onReturnMarket ? '<button type="button" class="bay-shop-market-home" data-shop-market-home data-action="shop-market-home">Рынок дома</button>' : ''}<button type="button" class="bay-shop-close${options.returnToRecipe ? ' bay-shop-recipe-back' : ''}" data-close aria-label="${closeLabel}" title="${recipeReturn ? closeLabel : closeLabel + '; работа лавки не меняется'}">${options.returnToRecipe ? closeLabel : '×'}</button></div></header>
      <div class="bay-shop-scene"><div class="bay-shop-stage" style="background-image:url('${escape(options.background ?? '/art/lavender/bay/shop.webp')}')">
        <div class="bay-shop-display" aria-label="Четыре места на прилавке">${state.slots.map((slot, index) => `<button type="button" class="bay-shop-shelf ${index === selected ? 'is-selected' : ''}" data-user-text data-slot="${index}" aria-pressed="${index === selected}" aria-label="Место ${index + 1}${slot ? `: ${escape(slot.product.name)}, остаток ${slot.quantity}, цена ${slot.price} монет` : ': свободно'}">
          <span class="bay-shop-shelf-product">${slot && slot.quantity > 0 ? art(slot.product) : `<span class="bay-shop-shelf-empty">${slot ? 'Продано' : '+'}</span>`}</span>${slot ? `<span class="bay-shop-shelf-label">${money(slot.price)} <span aria-hidden="true">●</span><small>×${slot.quantity}</small></span>` : ''}</button>`).join('')}</div>
        <div class="bay-shop-visitor" aria-hidden="true"><span class="bay-shop-contact-shadow"></span><span class="bay-shop-person"></span><span class="bay-shop-purchase"></span></div>
      </div><div class="bay-shop-speech" data-user-text role="status" aria-live="polite"></div></div>
      <div class="bay-shop-desk"><nav class="bay-shop-tabs" aria-label="Управление лавкой"><button type="button" data-tab="stock" aria-pressed="${tab === 'stock'}">Прилавок</button><button type="button" data-tab="journal" aria-pressed="${tab === 'journal'}">Покупатели</button>${options.onOpenCommissions ? `<button type="button" data-commissions>Заказы${commissionName ? ` · ${commissionName}` : ''}</button>` : ''}${options.performanceBonus?.() ? '<span title="Сегодня ещё два гостя из сада">+2 гостя ♫</span>' : ''}</nav>
      <section class="bay-shop-day" aria-label="Гости сегодня" ${pending ? 'hidden' : ''}><div><p class="bay-shop-day-count"></p><p class="bay-shop-day-detail" role="status" aria-live="polite"></p></div><button type="button" data-shop-next hidden></button></section>
      <p class="bay-shop-notice" role="status">${escape(notice)}</p><div class="bay-shop-desk-content">${tab === 'stock' ? stockControls() : renderBayShopCustomers(state, customerView, options.catalog)}</div></div>
      </section>`;
    rendering = false;
    const priceInput = host.querySelector<HTMLInputElement>('[data-price]');
    if (priceInput && priceDraft !== undefined) priceInput.value = priceDraft;
    paintQuantity();
    lastVisitor = ''; lastSpeech = ''; fitStage(); paintVisitor(); paintDayGuidance(); applyIngredientFinishes(host);
    paintNotice();
    const content = host.querySelector('.bay-shop-desk-content'); if (content) content.scrollTop = scroll;
    const catalog = host.querySelector('.bay-shop-products'); if (catalog && listScroll !== undefined) catalog.scrollTop = listScroll;
    if (focusAttribute) {
      const target = host.querySelector<HTMLElement>(`[${focusAttribute}="${CSS.escape(focusValue)}"]`);
      (target && !target.matches(':disabled') ? target : host.querySelector<HTMLElement>(`[data-slot="${selected}"]`))?.focus({ preventScroll: true });
    }
  }
  const dayGuidance = () => bayShopDayGuidance(state, options.performanceBonus?.() ?? 0, !!options.onOpenMusic);
  function paintDayGuidance(): void {
    const guidance = dayGuidance(), count = host.querySelector<HTMLElement>('.bay-shop-day-count'), detail = host.querySelector<HTMLElement>('.bay-shop-day-detail');
    if (count && count.textContent !== guidance.count) count.textContent = guidance.count;
    const refusal = lastRefusal;
    const buyer = refusal && state.open && !state.visitor && state.serial === refusal.serial
      && state.businessDay === refusal.day
      ? bayShopVisitors.find(person => person.id === refusal.buyer) : undefined;
    const nextVisit = guidance.action === 'music' ? ' Концерт: ещё 2 гостя.'
      : guidance.action === 'rest' ? ' Новые гости после отдыха.' : '';
    const message = buyer && refusal
      ? `${buyer.name}: ${refusal.kind === 'expensive' ? 'цена не подошла' : 'не хватило монет'}.${nextVisit}`
      : guidance.detail;
    if (detail && detail.textContent !== message) detail.textContent = message;
    const next = host.querySelector<HTMLButtonElement>('[data-shop-next]');
    if (!next) return;
    next.hidden = !(guidance.action === 'music' && options.onOpenMusic || guidance.action === 'rest' && options.onGoRest);
    const label = guidance.action === 'music' ? 'Пригласить музыкой' : 'Домой к отдыху';
    if (next.textContent !== label) next.textContent = label;
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
  function changed(returnStock?: StockReturn): void { saveChanges(); render(returnStock); }
  function click(event: Event): void {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!button || !host.contains(button) || button.disabled) return;
    if (button.hasAttribute('data-customer')) {
      if (customerView.choose(button.getAttribute('data-customer'))) { render(); const content=host.querySelector('.bay-shop-desk-content'); if(content)content.scrollTop=0; }
      return;
    }
    if (button.hasAttribute('data-customer-help')) { customerView.explanation=!customerView.explanation; render(); return; }
    if (button.hasAttribute('data-customer-history')) { customerView.historyOpen=!customerView.historyOpen; render(); return; }
    if (button.hasAttribute('data-shop-next')) {
      const next = dayGuidance().action;
      if (next === 'music') options.onOpenMusic?.(); else if (next === 'rest') options.onGoRest?.();
      return;
    }
    if (button.hasAttribute('data-commissions')) {
      const preview = readyEarnedOrder();
      if (preview) options.onOpenCommissions?.(preview.customer, preview);
      else options.onOpenCommissions?.(commissionCustomer()?.id);
      return;
    }
    if (button.hasAttribute('data-close')) { options.onClose(); return; }
    if (button.hasAttribute('data-shop-market-home')) { options.onReturnMarket?.(); return; }
    if (button.hasAttribute('data-freight')) { options.onOpenFreight?.(); return; }
    if (button.hasAttribute('data-open')) {
      if (!canToggleOpen()) { playBaySound('menu.blocked',.8); notice = 'Сначала поставьте хотя бы один товар на прилавок.'; render(); return; }
      setBayShopOpen(state, !state.open); lastRefusal = undefined; earnedOrder = undefined;
      notice = state.open ? 'Лавка открыта' : 'Лавка закрыта'; changed(); return;
    }
    if (button.dataset.slot !== undefined) { pending = undefined; selected = Number(button.dataset.slot); tab = 'stock'; notice = ''; render(); return; }
    if (button.dataset.tab) {
      pending = undefined; tab = button.dataset.tab as typeof tab;
      if (tab === 'journal') customerView.enter(state.visitor?.id);
      notice = ''; render(); return;
    }
    if (button.hasAttribute('data-stock-cancel')) {
      const origin = pending;
      const exactShelf = (!origin?.liveRefill && origin?.soldShelf === undefined) || stockForPending(options.products()) !== undefined;
      pending = undefined;
      const ownedCancel = (event as MouseEvent).detail === 0 && document.activeElement === button;
      const available = origin && exactShelf && options.products().some(p => p.id === origin.id && p.identity === origin.identity && p.quantity > 0);
      render(available ? { id: ownedCancel ? origin.id : undefined, listScroll: origin.listScroll } : undefined);
      return;
    }
    if (button.hasAttribute('data-return')) {
      const returned = removeBayShopStock(state, selected);
      if (returned) lastRefusal = undefined;
      if (returned && returned.quantity > 0) options.returnStock(returned.id, returned.quantity);
      notice = returned?.quantity ? 'Товары в припасах.' : 'Место на прилавке освобождено.'; changed(); return;
    }
    if (button.dataset.priceFactor) {
      const slot = state.slots[selected]; if (!slot) return;
      const price = Math.max(1, Math.min(10_000, Math.round(slot.product.basePrice * Number(button.dataset.priceFactor))));
      if (price !== slot.price && setBayShopPrice(state, selected, price)) lastRefusal = undefined;
      notice = ''; changed(); return;
    }
    const groupValue = button.getAttribute('data-stock-group');
    if (groupValue) {
      if (tab !== 'stock' || pending) return;
      const group = shopStockGroups(options.products().filter(p => p.quantity > 0),stockGroup).find(([id]) => id === groupValue)?.[0];
      if (group && group !== stockGroup) { stockGroup = group; render({ listScroll: 0 }); }
      return;
    }
    if (button.dataset.stock) {
      const sold = button.getAttribute('data-stock-sold-shelf'), live = button.getAttribute('data-stock-live-shelf');
      const pin = sold ?? live, quote = live === null ? undefined : mountedLiveRefill;
      if (live !== null && (!quote || !currentLiveRefill(quote) || quote.slot.quantity === 0)) { render(); return; }
      const products = options.products();
      const product = quote ? selectedShelfStock(products)
        : sold === null ? products.find(p => p.id === button.dataset.stock) : soldShelfStock(products);
      if (pin !== null && (tab !== 'stock' || pending || pin !== String(selected) ||
        product?.id !== button.dataset.stock || product.identity !== button.getAttribute('data-stock-identity'))) { render(); return; }
      if (!product || product.quantity < 1) return;
      if (!previewStock(product, selected, sold === null ? undefined : selected, undefined, undefined, quote)) { playBaySound('menu.blocked',.8); notice = 'Все места заняты. Уберите товар кнопкой ↶.'; render(); return; }
      notice = ''; render();
      host.querySelector<HTMLInputElement>('[data-stock-quantity]')?.focus();
    }
  }
  function paintQuantity(): void {
    if (!pending) return;
    const product = stockForPending(options.products()), quote = quotedShelf(selected, pending.replacing);
    const output = host.querySelector<HTMLElement>('[data-stock-preview]'), confirm = host.querySelector<HTMLButtonElement>('[data-stock-confirm]');
    if (!product || !quote || !output || !confirm) return;
    const preview = shopQuantityPreview(quote, selected, product, Number(pending.quantity));
    confirm.disabled = !preview.valid;
    output.textContent = preview.valid ? `На полке будет: ${preview.after} · в запасе останется: ${preview.remaining}. За 1: ${ruCount(preview.price,'монета','монеты','монет')}. ${shopRemainderQuote(preview.after,preview.price)} Оплата только за купленное.`
      : `Укажите целое количество от 1 до ${preview.maximum}.`;
  }
  function quantityInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (pending && input.matches('[data-stock-quantity]')) { pending.quantity = input.value; paintQuantity(); }
  }
  function submitStock(event: Event): void {
    if (!(event.target instanceof Element) || !event.target.matches('[data-stock-form]')) return;
    event.preventDefault();
    if (!pending) return;
    const product = stockForPending(options.products()), quantity = Number(pending.quantity), quote = quotedShelf(selected, pending.replacing);
    if (!product || !quote || !placeShopQuantity(quote, selected, product, quantity, options.takeStock)) {
      const staleShelf = (!product || !quote) && (pending.soldShelf !== undefined || pending.liveRefill || pending.replacing)
        ? {listScroll:pending.listScroll} : undefined;
      if (staleShelf) pending = undefined;
      playBaySound('menu.blocked',.8); notice = 'Проверьте количество и свободное место на полке.'; render(staleShelf); return;
    }
    if (pending.replacing) state.slots[selected] = quote.slots[selected];
    lastRefusal = undefined; earnedOrder = undefined;
    if (quotedProduct && options.catalog) syncBayShopProducts(state, options.catalog);
    const listScroll = pending.listScroll;
    pending = undefined;
    playBaySound('harbour.crate',.6); notice = `На полку добавлено: ${quantity}.`; changed({ listScroll });
    host.querySelector<HTMLElement>(`[data-slot="${selected}"]`)?.focus({preventScroll:true});
  }
  function change(event: Event): void {
    if (rendering) return;
    const input = event.target as HTMLInputElement;
    if (!input.matches('[data-price]')) return;
    const previousPrice = state.slots[selected]?.price;
    if (event.type === 'focusout' && input.value === String(previousPrice)) return;
    if (!setBayShopPrice(state, selected, Number(input.value))) {
      playBaySound('menu.blocked',.8); notice = 'Укажите целую цену от 1 до 10 000 монет.';
      input.value = String(state.slots[selected]?.price ?? 1);
    } else {
      notice = 'Цена сохранена'; saveChanges();
      const slot = state.slots[selected]!, shelf = host.querySelector<HTMLElement>(`[data-slot="${selected}"]`);
      if (mountedLiveRefill?.slot === slot && mountedLiveRefill.price === previousPrice) mountedLiveRefill.price = slot.price;
      if (slot.price !== previousPrice) { lastRefusal = undefined; paintDayGuidance(); }
      shelf?.setAttribute('aria-label', `Место ${selected + 1}: ${slot.product.name}, остаток ${slot.quantity}, цена ${slot.price} монет`);
      const quote = host.querySelector<HTMLElement>('[data-shelf-quote]');
      if (quote) quote.textContent = shopRemainderQuote(slot.quantity,slot.price);
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
      // Snapshot the undecided serial before the model mutates the live visitor.
      const undecided = state.visitor?.outcome === null ? state.visitor.serial : undefined;
      const sales = advanceBayShop(state, elapsed, options.performanceBonus?.() ?? 0);
      const visitor = state.visitor;
      if (visitor && visitor.serial === undecided && visitor.outcome) {
        const kind = visitor.outcome.kind;
        lastRefusal = kind === 'expensive' || kind === 'budget'
          ? { buyer: visitor.id, serial: visitor.serial, day: state.businessDay, kind } : undefined;
      }
      for (const sale of sales) {
        options.onEarn(sale.price);
        const { id, identity, signature } = sale.product;
        const liked = state.memories[sale.visitor].purchases[identity]?.liked;
        earnedOrder = sale.liked && liked === 1 && signature && id === identity && id.startsWith('signature:') && !hasShelfStock()
          ? options.readyCommission?.(sale.visitor, id.slice('signature:'.length)) : undefined;
      }
      const phase = state.visitor ? `${state.visitor.serial}:${state.visitor.phase}` : 'idle';
      if (sales.length) { saveChanges(); render(); savedAt = now; }
      else if (phase !== lastPhase || now - savedAt > 5000 && state.visitor) { saveChanges(); savedAt = now; }
      if (phase !== lastPhase) { paintDayGuidance(); if(tab === 'journal' && !sales.length) render(); }
      lastPhase = phase; paintVisitor();
    }
    frame = requestAnimationFrame(tick);
  }
  const resizeObserver = new ResizeObserver(fitStage); resizeObserver.observe(host);
  host.addEventListener('input', quantityInput); host.addEventListener('submit', submitStock); host.addEventListener('click', click); host.addEventListener('change', change); host.addEventListener('focusout', change);
  if (options.recipeRefill) {
    const refill = options.recipeRefill;
    const product = options.products().find(item => item.id === refill.id && item.identity === refill.id && item.quantity > 0);
    if (product && currentShopRecipeRefill(state, refill))
      previewStock(product, refill.shelf, refill.shelf, undefined, refill);
  } else if (quotedProduct) {
    const product = options.products().find(item => item.id === quotedProduct && item.identity === quotedProduct
      && (options.stockProduct ? item.quantity === 1 : item.quantity > 0));
    if (product && !previewStock(product,-1) && options.recipeProduct) {
      const index = !options.stockProduct && shopStockSlot(state, product, -1) < 0 ? state.slots.findIndex(slot => slot?.quantity === 0) : -1;
      const slot = state.slots[index];
      if (!slot || !previewStock(product, index, undefined, {slot, product:slot.product, price:slot.price}))
        notice = 'Все места заняты. Уберите товар кнопкой ↶.';
    }
  }
  render(); frame = requestAnimationFrame(tick);
  return {
    refresh: render,
    focusListing(id) {
      if (destroyed || pending || tab !== 'stock') return;
      const index = state.slots.findIndex(slot => slot && slot.quantity > 0 && slot.product.id === id && slot.product.identity === id);
      if (index < 0) return;
      selected = index;
      render();
      host.querySelector<HTMLElement>(`[data-slot="${index}"]`)?.focus({preventScroll:true});
    },
    destroy() { if (destroyed) return; destroyed = true; lastRefusal = undefined; clearTimeout(noticeTimer); cancelAnimationFrame(frame); resizeObserver.disconnect(); host.removeEventListener('input', quantityInput); host.removeEventListener('submit', submitStock); host.removeEventListener('click', click); host.removeEventListener('change', change); host.removeEventListener('focusout', change); if (state.open || state.visitor || JSON.stringify(state) !== savedShopState) saveChanges(); host.innerHTML = ''; },
  };
}
