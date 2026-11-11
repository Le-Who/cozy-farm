import { getHarborOrder, type FarmState, type StockItem } from './farm.ts';

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
