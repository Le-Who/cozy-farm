import { freightPorts, freightPortNames, freightStock, freightUsed, ferryUsed, warehouseCapacity, ferryCapacity,
  setFreightStops, setFreightMode, setFreightPickup, startFreight, pauseFreight,
  type BayFreightState, type FreightPort, type FreightResult } from './bay-freight-model.ts';
import './bay-freight.css';

export type FreightProduct = { id: string; name: string; icon: string; artwork?: string };
export type FreightPanelContext = {
  day: number;
  playerPort: FreightPort;
  selectedPort?: FreightPort;
  routeEditorOpen?: boolean;
  waxAvailable?: boolean;
  openedPorts: readonly FreightPort[];
  products: readonly FreightProduct[];
  carried: Record<string, number>;
  icon: (name: string, className?: string) => string;
};
const positions: Record<FreightPort, { x: number; y: number; short: string }> = {
  home: { x: 15, y: 65, short: 'Дом' }, grove: { x: 31, y: 36, short: 'Роща' },
  cape: { x: 68, y: 35, short: 'Мыс' }, village: { x: 86, y: 58, short: 'Гавань' },
};
const moorings: Record<FreightPort, { x: number; y: number }> = {
  home: { x: 34, y: 60 }, grove: { x: 44, y: 40 }, cape: { x: 66, y: 40 }, village: { x: 65, y: 55 },
};
const labels: Record<string, string> = { wheat: 'Пшеница', shells: 'Ракушки', seaSalt: 'Морская соль', beeswax: 'Пчелиный воск', 'handmade:round': 'Круглая булочка' };
const icons: Record<string, string> = { wheat: 'wheat', shells: 'shell', seaSalt: 'seaSalt', beeswax: 'beeswax', 'handmade:round': 'ui-handmade-round' };
const esc = (value: unknown) => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!));
const button = (label: string, action: string, value = '', extra = '') => `<button type="button" data-action="${action}" data-value="${esc(value)}" ${extra}>${label}</button>`;
const product = (id: string, ctx: FreightPanelContext): FreightProduct => ctx.products.find(item => item.id === id) ?? { id, name: labels[id] ?? 'Припасы', icon: icons[id] ?? 'ui-market' };
const picture = (id: string, ctx: FreightPanelContext) => {
  const item = product(id, ctx);
  return item.artwork ? `<img class="bay-freight-item-art" src="${esc(item.artwork)}" alt="">` : ctx.icon(item.icon, 'bay-freight-item-art');
};

export function freightControl(state: BayFreightState, action: string, value: string, day: number, openedPorts: readonly FreightPort[]): FreightResult | undefined {
  if (action === 'freight-start') return startFreight(state, day, openedPorts);
  if (action === 'freight-pause') return pauseFreight(state);
  if (action === 'freight-mode' && (value === 'mixed' || value === 'priority')) return setFreightMode(state, value);
  if (action === 'freight-route-port' && freightPorts.some(port => port === value)) {
    const port = value as FreightPort;
    return setFreightStops(state, state.route.stops.includes(port) ? state.route.stops.filter(stop => stop !== port) : [...state.route.stops, port], openedPorts);
  }
  const [portValue, id] = value.split('|');
  if (!freightPorts.some(port => port === portValue)) return;
  const port = portValue as FreightPort, pickup = state.route.pickups[port];
  if (action === 'freight-load') return setFreightPickup(state, port, pickup.destination,
    pickup.products.includes(id) ? pickup.products.filter(item => item !== id) : [...pickup.products, id]);
  if (action === 'freight-priority' && pickup.products.includes(id)) return setFreightPickup(state, port, pickup.destination, [id, ...pickup.products.filter(item => item !== id)]);
  if (action === 'freight-destination' && freightPorts.some(destination => destination === id)) return setFreightPickup(state, port, id as FreightPort, pickup.products);
}

export function renderFreightPanel(state: BayFreightState, ctx: FreightPanelContext): string {
  const selected = ctx.openedPorts.includes(ctx.selectedPort ?? ctx.playerPort) ? ctx.selectedPort ?? ctx.playerPort : ctx.openedPorts[0] ?? 'home';
  const port = selected as FreightPort, pickup = state.route.pickups[port], local = ctx.playerPort === port;
  const ship = state.ship, at = ship.phase === 'sailing' ? ship.from : ship.port;
  const from = moorings[at], to = moorings[ship.phase === 'sailing' ? ship.to : ship.port];
  const portStock = state.warehouses[port];
  const ids = [...new Set([...Object.keys(portStock), ...(local ? Object.keys(ctx.carried).filter(id => ctx.carried[id] > 0) : []), ...pickup.products])];
  const used = freightUsed(state, port);
  const editable = ship.phase === 'docked' && !state.route.running;
  const status = ship.phase === 'sailing' ? `→ ${positions[ship.to].short} · утром дня ${ship.arrivesOn}`
    : `У причала: ${positions[ship.port].short}`;
  const path = state.route.stops.map(stop => `${moorings[stop].x},${moorings[stop].y}`).join(' ');
  const nextPort = state.route.stops[(state.route.stops.indexOf(at) + 1) % state.route.stops.length];
  const heading = (ship.phase === 'sailing' ? to.x : moorings[nextPort].x) > from.x ? 'right' : 'left';
  const lastDelivery = state.events.find(item => item.kind === 'unloading' && item.day === ctx.day);
  const loading = state.events.find(item => item.kind === 'loading' && item.day === ctx.day);
  const blocked = ship.phase === 'docked' && ship.cargo.some(item => item.destination === ship.port);
  const latestProduction = state.events.find(item => item.kind === 'production' && item.port === 'village');
  const candidateIds = [...new Set([...ids, ...pickup.products])];
  const needsStock = local && !candidateIds.some(id => freightStock(state, port, id) > 0 || (ctx.carried[id] ?? 0) > 0);
  const warehouseRows = candidateIds.map(id => {
    const item = product(id, ctx), quantity = freightStock(state, port, id), available = local ? ctx.carried[id] ?? 0 : 0;
    const selectedProduct = pickup.products.includes(id);
    const depositReason = used >= warehouseCapacity ? 'Склад заполнен: заберите припасы' : available < 1 ? 'Нет с собой: привезите или соберите товар' : 'Положить на склад';
    return `<div class="bay-freight-stock-row">${picture(id, ctx)}<span class="bay-freight-stock-name">${esc(item.name)}<small>Склад <b>${quantity}</b>${local ? ` · с собой ${available}` : ''}</small></span>
      ${local ? `<span class="bay-freight-transfer">${button('−', 'freight-withdraw', `${port}|${id}|1`, `title="${quantity ? 'Забрать с собой' : 'Склад пуст'}" aria-label="Забрать: ${esc(item.name)}${quantity ? '' : '. Склад пуст'}" ${quantity ? '' : 'disabled'}`)}${button('+', 'freight-deposit', `${port}|${id}|1`, `title="${depositReason}" aria-label="Положить: ${esc(item.name)}. ${depositReason}" ${available > 0 && used < warehouseCapacity ? '' : 'disabled'}`)}${available >= 5 ? button('+5', 'freight-deposit', `${port}|${id}|5`, `title="Положить пять" aria-label="Положить пять: ${esc(item.name)}" ${used + 5 <= warehouseCapacity ? '' : 'disabled'}`) : ''}</span>` : ''}
      ${button(selectedProduct ? '✓' : '', 'freight-load', `${port}|${id}`, `class="bay-freight-load" title="${selectedProduct ? 'Убрать из погрузки' : 'Грузить в рейс'}" role="checkbox" aria-label="Грузить в рейс: ${esc(item.name)}" aria-checked="${selectedProduct}"`)}
    </div>`;
  }).join('');
  return `<section class="bay-freight" aria-label="Грузовой паром">
    <header class="bay-freight-heading">${button('‹', 'back', '', 'class="bay-freight-back" aria-label="Назад"')}<h2>Паром «Ласточка»</h2><span class="bay-freight-capacity" title="Груз в трюме">${ctx.icon('boat')}<strong>${ferryUsed(state)}/${ferryCapacity}</strong></span>${button('×', 'close', '', 'class="bay-freight-close" aria-label="Закрыть паром"')}</header>
    <div class="bay-freight-workspace"><div class="bay-freight-overview">
    <div class="bay-freight-scene" data-phase="${ship.phase}" aria-label="${esc(status)}">
      <div class="bay-freight-map">
      <svg class="bay-freight-waterway" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polyline points="${path} ${moorings[state.route.stops[0]].x},${moorings[state.route.stops[0]].y}" /></svg>
      ${freightPorts.map(stop => {
        const place = positions[stop], open = ctx.openedPorts.includes(stop), index = state.route.stops.indexOf(stop);
        return button(`<span>${open ? index >= 0 ? index + 1 : '•' : '⌁'}</span><strong>${place.short}</strong>`, open ? 'freight-port' : 'freight-unlock', stop,
          `class="bay-freight-pier" style="left:${place.x}%;top:${place.y}%" data-selected="${port === stop}" data-open="${open}" title="${open ? freightPortNames[stop] : 'Откройте остров на карте'}" aria-label="${open ? esc(freightPortNames[stop]) : `Как открыть ${esc(freightPortNames[stop])}`}"`);
      }).join('')}
      <div class="bay-freight-boat" data-heading="${heading}" style="--from-x:${from.x}%;--from-y:${from.y}%;--to-x:${to.x}%;--to-y:${to.y}%" aria-hidden="true"><span class="bay-freight-facing"><img src="${import.meta.env.BASE_URL}art/lavender/bay/ferry.webp" class="bay-freight-boat-art" alt=""></span><span class="bay-freight-wake"></span>${ship.cargo.length ? `<span class="bay-freight-hold">${ship.cargo.slice(0, 3).map(item => picture(item.id, ctx)).join('')}</span>` : ''}</div>
      ${loading ? `<span class="bay-freight-moving-crate" style="left:${positions[loading.port].x}%;top:${positions[loading.port].y - 8}%" aria-label="Погрузка">${picture(loading.items[0].id, ctx)}</span>` : ''}
      ${lastDelivery ? `<span class="bay-freight-delivery" style="left:${positions[lastDelivery.port].x}%;top:${positions[lastDelivery.port].y + 9}%">Выгружено +${lastDelivery.items.reduce((sum, item) => sum + item.quantity, 0)}</span>` : ''}
      </div>
    </div>
    <div class="bay-freight-voyage"><p>${esc(status)}</p>${state.route.running ? button('Приостановить', 'freight-pause') : button(ship.phase === 'sailing' ? 'Продолжать рейсы' : 'Отправить паром', 'freight-start', '', `class="bay-freight-primary"`)}</div>
    ${blocked ? `<p class="bay-freight-blocked">Склад полон. Заберите припасы — груз выгрузится утром.</p>` : ''}
    ${ship.cargo.length ? `<div class="bay-freight-cargo" aria-label="Груз в трюме">${ship.cargo.map(item => `<span>${picture(item.id, ctx)}<b>${item.quantity}</b><small>→ ${positions[item.destination].short}</small></span>`).join('')}</div>` : `<p class="bay-freight-hint">${ship.phase === 'docked' ? `Следующая остановка — ${freightPortNames[nextPort]}.` : 'Трюм пуст. Выберите товары для погрузки у следующего причала.'}</p>`}
    ${ctx.openedPorts.length < freightPorts.length ? `<p class="bay-freight-locked">Закрытые причалы: ${button('Открыть карту', 'open-panel', 'map')}</p>` : ''}
    <details class="bay-freight-log"><summary>Журнал рейсов</summary><ol>${state.events.filter(item => item.kind !== 'production').slice(0, 5).map(item => `<li><small>День ${item.day}</small> ${item.kind === 'sailing' ? `${positions[item.port].short} → ${positions[item.to!].short}` : item.kind === 'blocked' ? `${positions[item.port].short}: склад заполнен, груз остаётся на борту` : `${item.kind === 'loading' ? 'Погружено' : 'Выгружено'}: ${item.items.map(entry => `${esc(product(entry.id, ctx).name)} ×${entry.quantity}`).join(', ')}`}</li>`).join('') || '<li>Первый рейс ещё впереди.</li>'}</ol></details>
    </div><div class="bay-freight-desk"><div class="bay-freight-warehouse"><header><h3>${positions[port].short}: склад</h3><span>${used}/${warehouseCapacity}</span></header><meter min="0" max="${warehouseCapacity}" value="${used}" aria-label="Заполненность склада"></meter>
      <div class="bay-freight-destinations" aria-label="Куда отправлять товары"><strong>Грузить →</strong>${state.route.stops.filter(stop => stop !== port).map(stop => button(positions[stop].short, 'freight-destination', `${port}|${stop}`, `aria-pressed="${pickup.destination === stop}"`)).join('')}</div>
      <div class="bay-freight-stock-label"><span>${local ? '− с собой · + на склад' : 'Передача: посетите остров'}</span><span>В рейс</span></div>
      ${used >= warehouseCapacity ? '<p class="bay-freight-hint">Склад полон: заберите припасы кнопкой −.</p>' : ''}
      ${needsStock ? `<p class="bay-freight-hint">${port === 'home' ? 'Соберите урожай, затем положите его на склад кнопкой +.' : port === 'village' ? 'Привезите продукты или испеките булочки в гавани.' : 'Соберите местные припасы, затем положите их на склад кнопкой +.'} ${button('К острову', 'close')}</p>` : ''}
      <div class="bay-freight-stock">${warehouseRows || '<p class="bay-freight-hint">Здесь пока нет припасов.</p>'}</div>
      ${port === 'village' ? `<div class="bay-freight-bakery"><div>${picture('wheat', ctx)}<b>2 →</b>${picture('handmade:round', ctx)}<b>3</b></div><small>${latestProduction?.day === ctx.day ? 'Сегодня испечены' : freightStock(state, 'village', 'wheat') < 2 ? 'Привезите 2 пшеницы' : used >= warehouseCapacity ? 'Освободите склад' : 'Каждое утро'}</small></div>` : `<p class="bay-freight-production">${picture(port === 'home' ? 'shells' : port === 'grove' ? 'seaSalt' : 'beeswax', ctx)}${port === 'cape' && ctx.waxAvailable === false ? 'Улучшите пасеку: 2 воска в день' : `+${port === 'home' ? 1 : 2} каждое утро`}</p>`}
    </div>
    <details class="bay-freight-plan" ${ctx.routeEditorOpen ? 'open' : ''}><summary>Маршрут <span>${state.route.stops.map(stop => positions[stop].short).join(' → ')} ↻</span></summary>
      <div class="bay-freight-stops" aria-label="Причалы маршрута">${freightPorts.map(stop => button(positions[stop].short, 'freight-route-port', stop, `aria-pressed="${state.route.stops.includes(stop)}" ${editable && (ctx.openedPorts.includes(stop) || state.route.stops.includes(stop)) ? '' : 'disabled'}`)).join('')}</div>
      ${editable ? '' : '<p class="bay-freight-hint">Для смены причалов приостановите паром и дождитесь прибытия.</p>'}
      <div class="bay-freight-mode" aria-label="Способ погрузки">${button('Поровну', 'freight-mode', 'mixed', `aria-pressed="${state.route.mode === 'mixed'}"`)}${button('По приоритету', 'freight-mode', 'priority', `aria-pressed="${state.route.mode === 'priority'}"`)}</div>
      ${state.route.mode === 'priority' ? `<div class="bay-freight-manifest" aria-label="Очередь погрузки">${pickup.products.map(id => {
        const item = product(id, ctx), selectedProduct = pickup.products.includes(id);
        return `<div><span>${picture(id, ctx)}${esc(item.name)}</span>${selectedProduct ? button('↑', 'freight-priority', `${port}|${id}`, `aria-label="Поднять приоритет: ${esc(item.name)}"`) : ''}</div>`;
      }).join('')}</div>` : ''}
    </details>
    </div></div>
  </section>`;
}
