import { canSailTo, getHarborOrder, type FarmState, type StockItem } from './farm.ts';
import { bayProductId } from './bay-product-id.ts';
import { getLocalWarehouseSupply } from './warehouse-guidance.ts';

type HarborStoredDish = { item: StockItem; quantity: number };

/** The crossing is worth making when every requirement is either present or
 * only the exact finished dish still needs a separate pickup at the pier. */
export function getHarborOrderArrival(farm: FarmState, order = getHarborOrder(farm)):
  { token: string; storedDish?: HarborStoredDish } | undefined {
  if (!order || order.status !== 'locked' || !canSailTo(farm,'grove')) return;
  const token = `${farm.day}:${farm.orders.harbor.completed}:${farm.farmhouseSpecialization}`;
  const missing = order.items.filter(({item,delivered,available}) => delivered + available !== item.quantity);
  if (!missing.length && order.items.some(line => line.available > 0)) return {token};
  if (missing.length !== 1 || farm.island !== 'home' || farm.neighborVisits.active) return;
  const {item,delivered,available} = missing[0];
  if (item.kind !== 'dishes') return;
  const shortage = item.quantity - delivered - available;
  const id = bayProductId(item);
  if (shortage < 1 || (farm.freight.warehouses.grove[id] ?? 0) < shortage) return;
  const supply = getLocalWarehouseSupply({...farm,island:'grove'},{...item,quantity:item.quantity-delivered});
  if (!supply || supply.port !== 'grove' || supply.quantity !== shortage) return;
  return {token:`${token}:stored:${id}:${supply.carried}:${supply.quantity}:${supply.stored}`,
    storedDish:{item,quantity:supply.quantity}};
}

export function readyHarborOrderRoute(farm: FarmState, order = getHarborOrder(farm)) {
  return getHarborOrderArrival(farm,order)?.token;
}

/** Only a completed manual delivery advances. No day is spent and no reward is forecast. */
export function getNextHarborOrder(farm: FarmState) {
  if (getHarborOrder(farm)?.status !== 'completed') return undefined;
  const day=farm.day+1;
  if (!Number.isSafeInteger(day)) return undefined;
  const next=getHarborOrder({...farm,day});
  return next ? {day,name:next.name,items:next.items.map(({item})=>({...item}))} : undefined;
}

export function canVisitHarborRest(farm: FarmState, day: string | undefined, context: {panel:string|undefined;open:boolean;tab:string}) {
  return context.open && (context.panel==='harbor'||context.panel==='market'&&context.tab==='orders')
    && day===String(farm.day) && getNextHarborOrder(farm)!==undefined;
}

const escape=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function renderNextHarborOrder(next: NonNullable<ReturnType<typeof getNextHarborOrder>>, stock:(item:StockItem)=>string) {
  return `<section class="harbor-return" aria-label="Следующий заказ причала"><h3>После отдыха · день ${next.day}</h3>
    <p><b>${escape(next.name)}</b></p><p>Можно подготовить заранее:</p><ul class="ingredients order-items">${next.items.map(stock).join('')}</ul>
    <p>Состав по нынешнему основному направлению кухни. Припасы не отправляются автоматически.</p></section>`;
}
