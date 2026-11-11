import { getMarketOrders, type FarmState, type StockItem } from './farm.ts';

/** Only a delivered lane advances at the next in-game morning. Reading never ends the day. */
export function getNextMarketOrders(farm: FarmState) {
  const delivered = new Set(getMarketOrders(farm).filter(order => order.status === 'delivered').map(order => order.lane));
  const day = farm.day + 1;
  if (!delivered.size || !Number.isSafeInteger(day)) return [];
  return getMarketOrders({ ...farm, day }).filter(order => delivered.has(order.lane)).map(order => ({ ...order, day }));
}
/** A detached button may belong to another page or an earlier morning. */
export function canVisitMarketRest(farm: FarmState, day: string | undefined, context: { panel: string | undefined; open: boolean; tab: string }) {
  return context.panel === 'market' && context.open && context.tab === 'orders'
    && day === String(farm.day) && getNextMarketOrders(farm).length > 0;
}
const esc = (value: string) => value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function renderNextMarketOrder(next: ReturnType<typeof getNextMarketOrders>[number], stock: (item: StockItem) => string) {
  return `<details class="market-return" data-market-next="${next.lane}"><summary>После отдыха · день ${next.day}: ${esc(next.name)}</summary>
    <p>Можно подготовить заранее:</p><ul class="ingredients order-items">${next.items.map(stock).join('')}</ul>
    <p class="market-return-note">Состав по нынешним открытиям фермы. Это просмотр, не новая доставка.</p></details>`;
}
