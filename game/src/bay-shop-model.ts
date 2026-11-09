export type BayShopProduct = {
  id: string; identity: string; name: string; image: string; basePrice: number;
  tags: string[]; signature?: boolean;
};
export type BayShopStock = BayShopProduct & { quantity: number };
export type BayShopSlot = { product: BayShopProduct; quantity: number; price: number } | null;
export const bayShopVisitors = [
  { id: 'bea', name: 'Беа', art: 'bea', budget: 95, likes: ['pear', 'delicate', 'silky'], wish: 'Нежное к чаю' },
  { id: 'finn', name: 'Финн', art: 'finn', budget: 145, likes: ['blueberry', 'hearty', 'chunky'], wish: 'Что-нибудь сытное' },
  { id: 'mira', name: 'Мира', art: 'guest', budget: 72, likes: ['berry', 'sweet', 'strawberry'], wish: 'Ягодное угощение' },
  { id: 'oskar', name: 'Оскар', art: 'guest', budget: 110, likes: ['portable', 'savoury', 'bread'], wish: 'Перекус в дорогу' },
  { id: 'lina', name: 'Лина', art: 'bea', budget: 180, likes: ['fruit', 'sharing', 'bright'], wish: 'Угостить друзей' },
  { id: 'mark', name: 'Марк', art: 'finn', budget: 60, likes: ['apple', 'portable', 'sweet'], wish: 'Вкусно и по карману' },
] as const;
export type BayShopVisitorId = typeof bayShopVisitors[number]['id'];
export type BayShopOutcome = { kind: 'bought'; productId: string; identity: string; name: string; price: number; liked: boolean; returning: boolean }
  | { kind: 'empty' | 'expensive' | 'budget' | 'closed' };
export type BayShopVisitor = {
  id: BayShopVisitorId; serial: number; phase: 'approaching' | 'browsing' | 'reacting' | 'departing';
  elapsed: number; budget: number; outcome: BayShopOutcome | null;
};
export type BayShopMemory = { visits: number; purchases: Record<string, { bought: number; liked: number }> };
export type BayShopReputation = { name: string; sold: number; liked: number; revenue: number };
export type BayShopState = {
  version: 1; open: boolean; slots: BayShopSlot[]; serial: number; waitMs: number;
  businessDay: number; visitsToday: number;
  visitor: BayShopVisitor | null; memories: Record<BayShopVisitorId, BayShopMemory>;
  reputation: Record<string, BayShopReputation>; sold: number; revenue: number;
};
export type BayShopSale = { visitor: BayShopVisitorId; product: BayShopProduct; quantity: 1; price: number; liked: boolean };
export const bayShopPhaseDuration = { approaching: 3200, browsing: 3000, reacting: 3400, departing: 2800 } as const;
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const integer = (v: unknown, max = 1_000_000): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && v <= max;
const finite = (v: unknown, max: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max;
const text = (v: unknown, max: number): v is string => typeof v === 'string' && v.length > 0 && v.length <= max && !/[<>\x00-\x1f]/.test(v);
const productId = (v: unknown): v is string => typeof v === 'string' && /^[a-zA-Z][a-zA-Z0-9:_-]{0,100}$/.test(v);
const identity = (v: unknown): v is string => text(v, 6000) && v !== 'prototype' && !Object.hasOwn(Object.prototype, v);
const visitorId = (v: unknown): v is BayShopVisitorId => bayShopVisitors.some(person => person.id === v);
const copyProduct = (p: BayShopProduct): BayShopProduct => ({ id: p.id, identity: p.identity, name: p.name, image: p.image, basePrice: p.basePrice, tags: [...p.tags], ...(p.signature ? { signature: true } : {}) });
export function isBayShopProduct(value: unknown): value is BayShopProduct {
  return record(value) && productId(value.id) && identity(value.identity) && text(value.name, 80)
    && typeof value.image === 'string' && /^\/art\/[a-zA-Z0-9/_-]+\.(webp|png)$/.test(value.image)
    && integer(value.basePrice, 10_000) && value.basePrice > 0
    && Array.isArray(value.tags) && value.tags.length <= 24 && value.tags.every(tag => text(tag, 40))
    && (value.signature === undefined || typeof value.signature === 'boolean');
}
export function createBayShop(day = 1): BayShopState {
  return { version: 1, open: false, slots: [null, null, null, null], serial: 0, waitMs: 1200, visitor: null, businessDay: day, visitsToday: 0,
    memories: Object.fromEntries(bayShopVisitors.map(v => [v.id, { visits: 0, purchases: {} }])) as BayShopState['memories'],
    reputation: {}, sold: 0, revenue: 0 };
}
export function bayShopDailyLimit(performanceBonus = 0): number {
  return 6 + Math.floor(Number.isFinite(performanceBonus) ? Math.max(0, Math.min(3, performanceBonus)) : 0) * 2;
}
function arrive(state: BayShopState): BayShopVisitor {
  const person = bayShopVisitors[state.serial % bayShopVisitors.length];
  state.serial++; state.visitsToday++; state.memories[person.id].visits++;
  return { id: person.id, serial: state.serial, phase: 'approaching', elapsed: 0,
    budget: person.budget + (Math.floor((state.serial - 1) / bayShopVisitors.length) % 3) * 8, outcome: null };
}
/** Display stock is a separate stock owner. The caller transfers inventory before this command. */
export function stockBayShop(state: BayShopState, index: number, product: BayShopProduct, quantity: number): boolean {
  if (!integer(index, 3) || !isBayShopProduct(product) || !integer(quantity, 999) || quantity < 1) return false;
  const slot = state.slots[index];
  if (slot && (slot.product.id !== product.id || slot.product.identity !== product.identity || slot.quantity + quantity > 999)) return false;
  if (slot) slot.quantity += quantity;
  else state.slots[index] = { product: copyProduct(product), quantity, price: product.basePrice };
  return true;
}
export function removeBayShopStock(state: BayShopState, index: number): { id: string; quantity: number } | null {
  if (!integer(index, 3)) return null;
  const slot = state.slots[index];
  if (!slot) return null;
  state.slots[index] = null;
  return { id: slot.product.id, quantity: slot.quantity };
}
export function setBayShopPrice(state: BayShopState, index: number, price: number): boolean {
  if (!integer(index, 3) || !integer(price, 10_000) || price < 1 || !state.slots[index]) return false;
  state.slots[index]!.price = price;
  return true;
}
export function setBayShopOpen(state: BayShopState, open: boolean): void {
  state.open = open;
  if (!open && state.visitor && ['approaching', 'browsing'].includes(state.visitor.phase)) {
    state.visitor.phase = 'departing'; state.visitor.elapsed = 0; state.visitor.outcome = { kind: 'closed' };
  }
}
export function bayShopInterest(state: BayShopState, id: BayShopVisitorId, slot: NonNullable<BayShopSlot>) {
  const person = bayShopVisitors.find(v => v.id === id)!;
  const matched = person.likes.filter(tag => slot.product.tags.includes(tag)).length;
  const memory = state.memories[id].purchases[slot.product.identity];
  const reputation = state.reputation[slot.product.identity];
  const familiar = Math.min(3, memory?.liked ?? 0);
  const known = Math.min(.18, (reputation?.liked ?? 0) * .025);
  const willingness = Math.round(slot.product.basePrice * (1.05 + matched * .2 + familiar * .1 + known));
  return { matched, willingness, returning: Boolean(memory?.bought), liked: matched > 0,
    score: matched * 10 + familiar * 4 + known * 10 + (willingness - slot.price) / slot.product.basePrice * 8 };
}
function choosePurchase(state: BayShopState, visitor: BayShopVisitor): BayShopSale | undefined {
  const stocked = state.slots.filter((slot): slot is NonNullable<BayShopSlot> => slot !== null && slot.quantity > 0);
  const affordable = stocked.filter(slot => slot.price <= visitor.budget);
  const choices = affordable.map(slot => ({ slot, interest: bayShopInterest(state, visitor.id, slot) }))
    .filter(choice => choice.slot.price <= choice.interest.willingness)
    .sort((a, b) => b.interest.score - a.interest.score);
  const selected = choices[0];
  if (!selected) { visitor.outcome = { kind: !stocked.length ? 'empty' : !affordable.length ? 'budget' : 'expensive' }; return; }
  const { slot, interest } = selected, key = slot.product.identity;
  if (state.sold >= 1_000_000 || state.revenue + slot.price > 10_000_000_000) { visitor.outcome = { kind: 'closed' }; state.open = false; return; }
  const memory = state.memories[visitor.id];
  slot.quantity--; state.sold++; state.revenue += slot.price;
  const purchase = memory.purchases[key] ??= { bought: 0, liked: 0 };
  purchase.bought++; if (interest.liked) purchase.liked++;
  const reputation = state.reputation[key] ??= { name: slot.product.name, sold: 0, liked: 0, revenue: 0 };
  reputation.sold++; reputation.revenue += slot.price; reputation.name = slot.product.name;
  if (interest.liked) reputation.liked++;
  visitor.outcome = { kind: 'bought', productId: slot.product.id, identity: key, name: slot.product.name, price: slot.price, liked: interest.liked, returning: interest.returning };
  return { visitor: visitor.id, product: copyProduct(slot.product), quantity: 1, price: slot.price, liked: interest.liked };
}
/** Only visible, active play advances the shop. No offline simulation or catch-up sales. */
export function advanceBayShop(state: BayShopState, elapsedMs: number, performanceBonus = 0): BayShopSale[] {
  const sales: BayShopSale[] = [];
  let remaining = typeof elapsedMs === 'number' && Number.isFinite(elapsedMs) ? Math.max(0, Math.min(1000, elapsedMs)) : 0;
  while (remaining > 0) {
    const visitor = state.visitor;
    if (!visitor) {
      if (!state.open || state.serial >= 1_000_000 || state.visitsToday >= bayShopDailyLimit(performanceBonus)) break;
      const step = Math.min(remaining, state.waitMs); state.waitMs -= step; remaining -= step;
      if (state.waitMs > 0) break;
      state.visitor = arrive(state);
      continue;
    }
    const duration = bayShopPhaseDuration[visitor.phase];
    const step = Math.min(remaining, duration - visitor.elapsed); visitor.elapsed += step; remaining -= step;
    if (visitor.elapsed < duration) break;
    visitor.elapsed = 0;
    if (visitor.phase === 'approaching') visitor.phase = 'browsing';
    else if (visitor.phase === 'browsing') {
      visitor.phase = 'reacting';
      const sale = choosePurchase(state, visitor); if (sale) sales.push(sale);
    } else if (visitor.phase === 'reacting') visitor.phase = 'departing';
    else {
      state.visitor = null;
      const bonus = Number.isFinite(performanceBonus) ? Math.max(0, Math.min(3, performanceBonus)) : 0;
      state.waitMs = Math.round(4200 / (1 + bonus * .4));
    }
  }
  return sales;
}
/** End-of-day settlement shares the visible visitor allowance; repeating a day pays nothing. */
export function advanceBayShopDay(state: BayShopState, newDay: number, performanceBonus = 0): BayShopSale[] {
  if (!integer(newDay) || newDay <= state.businessDay) return [];
  const sales: BayShopSale[] = [];
  if (state.open) {
    if (state.visitor && state.visitor.outcome === null) {
      const sale = choosePurchase(state, state.visitor); if (sale) sales.push(sale);
    }
    while (state.open && state.visitsToday < bayShopDailyLimit(performanceBonus) && state.serial < 1_000_000) {
      const visitor = arrive(state), sale = choosePurchase(state, visitor); if (sale) sales.push(sale);
    }
  }
  state.visitor = null; state.waitMs = 1200; state.visitsToday = 0; state.businessDay = newDay;
  return sales;
}
export function restoreBayShop(value: unknown, day = 1): BayShopState | undefined {
  if (value === undefined) return createBayShop(day);
  if (!record(value) || value.version !== 1 || typeof value.open !== 'boolean' || !Array.isArray(value.slots) || value.slots.length !== 4
    || !integer(value.serial) || !finite(value.waitMs, 10_000) || !integer(value.sold) || !integer(value.revenue, 10_000_000_000)
    || !integer(value.businessDay, day) || value.businessDay < 1 || !integer(value.visitsToday, 12) || value.visitsToday > value.serial
    || !record(value.memories) || Object.keys(value.memories).length !== bayShopVisitors.length || !record(value.reputation) || Object.keys(value.reputation).length > Number(value.sold)) return;
  const restored = createBayShop();
  for (let i = 0; i < 4; i++) {
    const raw = value.slots[i];
    if (raw === null) continue;
    if (!record(raw) || !isBayShopProduct(raw.product) || !integer(raw.quantity, 999) || !integer(raw.price, 10_000) || raw.price < 1) return;
    restored.slots[i] = { product: copyProduct(raw.product), quantity: raw.quantity, price: raw.price };
  }
  let sold = 0, revenue = 0, liked = 0, visits = 0, rememberedSales = 0, rememberedLikes = 0;
  const perProduct: Record<string, { bought: number; liked: number }> = {};
  for (const [key, raw] of Object.entries(value.reputation)) {
    if (!identity(key) || !record(raw) || !text(raw.name, 80) || !integer(raw.sold) || raw.sold < 1 || !integer(raw.liked, raw.sold)
      || !integer(raw.revenue, 10_000_000_000) || raw.revenue < raw.sold || raw.revenue > raw.sold * 10_000) return;
    restored.reputation[key] = { name: raw.name, sold: raw.sold, liked: raw.liked, revenue: raw.revenue };
    sold += raw.sold; revenue += raw.revenue; liked += raw.liked;
  }
  for (const [personIndex, person] of bayShopVisitors.entries()) {
    const raw = value.memories[person.id];
    if (!record(raw) || !integer(raw.visits) || raw.visits !== Math.floor(value.serial / bayShopVisitors.length) + (personIndex < value.serial % bayShopVisitors.length ? 1 : 0)
      || !record(raw.purchases) || Object.keys(raw.purchases).length > Number(raw.visits)) return;
    const memory: BayShopMemory = { visits: raw.visits, purchases: {} }; let bought = 0;
    for (const [key, entry] of Object.entries(raw.purchases)) {
      if (!identity(key) || !restored.reputation[key] || !record(entry) || !integer(entry.bought, raw.visits) || entry.bought < 1 || !integer(entry.liked, entry.bought)) return;
      memory.purchases[key] = { bought: entry.bought, liked: entry.liked }; bought += entry.bought;
      rememberedSales += entry.bought; rememberedLikes += entry.liked;
      const sum = perProduct[key] ??= { bought: 0, liked: 0 }; sum.bought += entry.bought; sum.liked += entry.liked;
    }
    if (bought > raw.visits) return;
    visits += raw.visits; restored.memories[person.id] = memory;
  }
  if (sold !== value.sold || revenue !== value.revenue || visits !== value.serial || rememberedSales !== sold || rememberedLikes !== liked
    || Object.entries(restored.reputation).some(([key, rep]) => perProduct[key]?.bought !== rep.sold || perProduct[key]?.liked !== rep.liked)) return;
  const rawVisitor = value.visitor;
  if (rawVisitor !== null) {
    if (!record(rawVisitor) || !visitorId(rawVisitor.id) || !integer(rawVisitor.serial, value.serial) || rawVisitor.serial !== value.serial || rawVisitor.serial < 1
      || !['approaching', 'browsing', 'reacting', 'departing'].includes(rawVisitor.phase as string)
      || !finite(rawVisitor.elapsed, bayShopPhaseDuration[rawVisitor.phase as BayShopVisitor['phase']]) || rawVisitor.elapsed >= bayShopPhaseDuration[rawVisitor.phase as BayShopVisitor['phase']]
      || !integer(rawVisitor.budget, 1000) || rawVisitor.budget < 1
      || bayShopVisitors[(rawVisitor.serial - 1) % bayShopVisitors.length].id !== rawVisitor.id
      || rawVisitor.budget !== bayShopVisitors[(rawVisitor.serial - 1) % bayShopVisitors.length].budget + (Math.floor((rawVisitor.serial - 1) / bayShopVisitors.length) % 3) * 8) return;
    let outcome: BayShopOutcome | null = null;
    if (rawVisitor.outcome !== null) {
      const raw = rawVisitor.outcome;
      if (!record(raw)) return;
      if (raw.kind === 'bought') {
        if (!productId(raw.productId) || !identity(raw.identity) || !text(raw.name, 80) || !integer(raw.price, rawVisitor.budget) || raw.price < 1
          || typeof raw.liked !== 'boolean' || typeof raw.returning !== 'boolean' || !restored.memories[rawVisitor.id].purchases[raw.identity]
          || !restored.reputation[raw.identity] || raw.liked && restored.memories[rawVisitor.id].purchases[raw.identity].liked < 1) return;
        outcome = { kind: 'bought', productId: raw.productId, identity: raw.identity, name: raw.name, price: raw.price, liked: raw.liked, returning: raw.returning };
      } else if (['empty', 'expensive', 'budget', 'closed'].includes(raw.kind as string)) outcome = { kind: raw.kind as 'empty' };
      else return;
    }
    if ((['approaching', 'browsing'].includes(rawVisitor.phase as string)) !== (outcome === null) || !value.open && outcome === null) return;
    restored.visitor = { id: rawVisitor.id, serial: rawVisitor.serial, phase: rawVisitor.phase as BayShopVisitor['phase'], elapsed: rawVisitor.elapsed, budget: rawVisitor.budget, outcome };
  }
  Object.assign(restored, { open: value.open, serial: value.serial, waitMs: value.waitMs, sold: value.sold, revenue: value.revenue, businessDay: value.businessDay, visitsToday: value.visitsToday });
  return restored;
}
