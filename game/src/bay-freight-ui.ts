import { freightPorts,
  setFreightStops, setFreightMode, setFreightPickup, startFreight, pauseFreight,
  type BayFreightState, type FreightPort, type FreightResult } from './bay-freight-model.ts';
import { expeditionPorts, expeditionPortNames, expeditionPortDescriptions, expeditionTrades, expeditionOfferIds, quoteExpedition, portDemand, portProjectComplete, portProjects, expeditionStock, type ExpeditionPort, type ExpeditionManifest } from './ferry-expeditions.ts';
import './bay-freight.css';
import { nextFerryExploration } from './ferry-discovery.ts';

export type FreightProduct = { id: string; name: string; icon: string; artwork?: string };
export type FreightPanelContext = {
  day: number;
  coins?: number;
  harvestTier?: number;
  boatOwned?: boolean;
  expeditionPort?: ExpeditionPort;
  expeditionOffer?: string;
  villageBuilt?: boolean;
  playerPort: FreightPort;
  selectedPort?: FreightPort;
  routeEditorOpen?: boolean;
  waxAvailable?: boolean;
  openedPorts: readonly FreightPort[];
  products: readonly FreightProduct[];
  carried: Record<string, number>;
  icon: (name: string, className?: string) => string;
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

const portArt: Record<ExpeditionPort, string> = { mill: 'mill-port-background', salt: 'salt-port-background', orchard: 'orchard-port-background' };
const primaryStock: Record<ExpeditionPort, string> = { mill: 'handmade:round', salt: 'seaSalt', orchard: 'peach' };
const demandLabels = { shortage: 'Высокий спрос', balanced: 'Припасов достаточно', surplus: 'Пока есть запас' };
const demandNeeds: Record<string,string> = { wheat:'Нужно зерно', eggs:'Нужны яйца', carrot:'Нужны овощи', seaBass:'Нужен улов', apple:'Нужны яблоки', 'handmade:round':'Ждут булочки' };
const sourceHints: Record<string, { label: string; panel: string }> = {
  wheat: { label: 'Где взять пшеницу', panel: 'market' }, carrot: { label: 'Где взять морковь', panel: 'market' },
  eggs: { label: 'Где взять яйца', panel: 'coop' }, seaBass: { label: 'Где взять улов', panel: 'fishing' },
  apple: { label: 'Где взять яблоки', panel: 'orchard' }, 'handmade:round': { label: 'К пекарю в посад', panel: 'mill' },
};

export function renderFreightPanel(state: BayFreightState, ctx: FreightPanelContext): string {
  const world = state.expeditions, active = world.active;
  const selected = ctx.expeditionPort ?? active?.port ?? 'mill';
  const open = world.discovered.includes(selected), choices = expeditionTrades(world, selected);
  const requested = ctx.expeditionOffer ?? choices[0].id, selectedIds = expeditionOfferIds(requested);
  const id = open ? selectedIds.length && selectedIds.every(value => choices.some(trade => trade.id === value)) ? requested : choices[0].id : 'explore-' + selected;
  const quote = quoteExpedition(world, id, { bag: ctx.carried, harvestTier: ctx.harvestTier, coins: ctx.coins ?? 0, boatOwned: ctx.boatOwned ?? true })!;
  const manifest: ExpeditionManifest = active ?? quote;
  const orderIds = expeditionOfferIds(manifest.id), combined = orderIds.length === 2;
  const port = manifest.port, phase = active?.phase ?? 'planning', exploring = manifest.kind === 'explore';
  const stockId = manifest.incoming[0]?.id ?? primaryStock[port];
  const demandItem = manifest.outgoing[0]?.id, demand = portDemand(world,port,demandItem);
  const demandText = !demandItem ? 'Запасы на продажу' : demand === 'shortage' ? demandNeeds[demandItem] ?? demandLabels.shortage : demandLabels[demand];
  const project = portProjects[port], projectDone = portProjectComplete(world, port);
  const projectTotal = project.needs.reduce((sum, item) => sum + item.quantity, 0);
  const projectHave = project.needs.reduce((sum, item) => sum + Math.min(item.quantity, world.markets[port].supplied[item.id] ?? 0), 0);
  const cargo = (items: ExpeditionManifest['outgoing'], outgoing: boolean) => items.map(item => {
    const entry = product(item.id, ctx), available = ctx.carried[item.id] ?? 0;
    return `<div class="expedition-cargo-item">${picture(item.id, ctx)}<span><strong>${esc(item.id === 'handmade:round' ? 'Булочка' : entry.name)} ×${item.quantity}</strong>${outgoing ? `<small>${active ? 'Уже погружено' : available >= item.quantity ? `Есть ${available} · останется ${available - item.quantity}` : `Есть ${available} · нужно ещё ${item.quantity - available}`}</small>` : ''}</span></div>`;
  }).join('');
  const missing = !active && manifest.outgoing.find(item => (ctx.carried[item.id] ?? 0) < item.quantity);
  const hint = missing ? sourceHints[missing.id] : undefined;
  const sourceAction = hint && missing ? button(hint.label, hint.panel === 'mill' ? 'expedition-port' : 'expedition-source', hint.panel === 'mill' ? 'mill' : `${id}|${missing.id}`, 'class="expedition-source"') : '';
  const production = world.markets[port].production;
  const effect = exploring ? 'Новый торговый порт будет открыт наверняка. Разведка не зависит от удачи.'
    : port === 'mill' ? 'Зерно и яйца идут в следующую выпечку.' : port === 'salt' ? 'Морковь и улов помогут открыть кухню у маяка.' : 'Яблоки идут на варенье, булочки ждут сборщики.';
  const displayPort = exploring && phase !== 'ready' ? 'Неизвестный берег' : expeditionPortNames[port];
  const nextExploration = nextFerryExploration(world, { bag:ctx.carried, coins:ctx.coins ?? 0, boatOwned:ctx.boatOwned ?? true });
  const discovery = nextExploration && nextExploration.port !== port ? nextExploration : undefined;
  const status = phase === 'sailing' ? `Вернётся утром дня ${active!.returnsOn}` : phase === 'ready' ? 'Паром вернулся. Груз вас дождётся.' : `${discovery ? `Выбран рейс «${manifest.name}». ` : ''}Вернётся следующим игровым утром`;
  return `<section class="bay-freight" data-expedition-phase="${phase}" data-combined="${combined}" aria-label="Торговые экспедиции">
    <header class="bay-freight-heading">${button('‹', 'back', '', 'class="bay-freight-back" aria-label="Назад"')}<h2>Паром «Ласточка»</h2><span class="expedition-balance">${ctx.icon('coin')} ${ctx.coins ?? 0}</span>${button('×', 'close', '', 'class="bay-freight-close" aria-label="Закрыть паром"')}</header>
    <div class="bay-freight-workspace">
      <div class="expedition-overview">
        ${discovery ? `<section class="expedition-next-discovery" aria-label="Следующая разведка"><h4>Можно разведать новый берег</h4><p>${discovery.port === 'salt' ? 'После торговли с Мельничным посадом можно разведать неизвестный маяк.' : 'После торговли у Соляного маяка можно пойти по следам садовых лодок.'}</p><p>Для разведки: ${discovery.outgoing.map(item => `${esc(product(item.id,ctx).name)} ×${item.quantity}`).join(', ')}. Припасы спишутся только при отправке.</p>${button('Подготовить разведку','expedition-discovery',discovery.port)}<small>Это только выбор рейса. Новый порт откроется после отдельного получения.</small></section>` : ''}
        <div class="expedition-scene" data-port="${port}" data-unknown="${exploring && phase !== 'ready'}">
          <img class="expedition-port-art" src="${import.meta.env.BASE_URL}art/lavender/bay/${exploring && phase !== 'ready' ? 'freight-harbor' : portArt[port]}.webp" alt="${esc(exploring ? 'Бухта перед дальней разведкой' : expeditionPortNames[port])}">
          <span class="expedition-place">${esc(displayPort)}</span>
          ${projectDone && !exploring ? `<span class="expedition-built">${esc(project.name)} работает</span>` : ''}
          <div class="expedition-ferry" aria-hidden="true"><div class="expedition-ferry-bob"><img src="${import.meta.env.BASE_URL}art/lavender/bay/ferry.webp" alt=""><span class="expedition-deck-cargo">${(phase === 'ready' ? manifest.incoming : manifest.outgoing).slice(0, 2).map(item => picture(item.id, ctx)).join('')}</span></div></div>
          ${phase === 'sailing' ? '<span class="expedition-at-sea">В море</span>' : phase === 'ready' ? '<span class="expedition-at-sea">С возвращением!</span>' : ''}
        </div>
        <nav class="expedition-chart" aria-label="Морские направления">
          <img src="${import.meta.env.BASE_URL}art/lavender/bay/expedition-chart-background.webp" alt="" class="expedition-chart-art">
          ${(['salt','orchard'] as const).filter(place=>world.discovered.includes(place)).map(place=>`<img src="${import.meta.env.BASE_URL}art/lavender/bay/expedition-chart-revealed.webp" alt="" class="expedition-chart-art expedition-chart-reveal" data-revealed="${place}">`).join('')}
          <svg viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true"><path d="M12 23 Q22 8 36 18 T62 18 T87 16" /></svg>
          <span class="expedition-home">Дом</span>
          ${expeditionPorts.map((place, index) => button(`<span class="expedition-map-symbol" data-known="${world.discovered.includes(place)}">${world.discovered.includes(place) ? '' : '?'}</span><strong class="expedition-map-long">${esc(world.discovered.includes(place) ? expeditionPortNames[place] : index === 1 ? 'Неизвестный маяк' : 'Неизвестный берег')}</strong><strong class="expedition-map-short">${place === 'mill' ? 'Посад' : place === 'salt' ? 'Маяк' : world.discovered.includes(place) ? 'Сады' : 'Берег'}</strong>`, 'expedition-port', place, `aria-label="${esc(world.discovered.includes(place) ? expeditionPortNames[place] : place === 'salt' ? 'Неизвестный маяк' : 'Неизвестный берег')}" class="expedition-map-port" style="--port-x:${[36,62,87][index]}%" aria-pressed="${port === place}" ${active ? 'disabled' : ''}`)).join('')}
        </nav>
        <p class="expedition-map-hint">${phase === 'sailing' ? 'Продолжайте заниматься фермой. Рейс завершится после отдыха в доме.' : 'Знакомый порт для торговли. Неизвестный берег для открытия.'}</p>

      </div>
      <div class="expedition-desk">
        <div class="expedition-card-scroll">
          <div class="expedition-eyebrow">${phase === 'ready' ? 'РЕЙС ЗАВЕРШЁН' : exploring ? 'РАЗВЕДКА НОВОГО БЕРЕГА' : 'ТОРГОВАЯ ЭКСПЕДИЦИЯ'}</div>
          <h3>${combined ? 'Два заказа в одном рейсе' : esc(manifest.name)}</h3>
          ${combined ? `<section class="expedition-selection" aria-label="Выбранные заказы"><ol>${manifest.name.split(' + ').map(name => `<li>${esc(name)}</li>`).join('')}</ol>${!active ? button('Оставить только первый заказ','expedition-offer',orderIds[0]) : ''}</section>` : ''}
          <p class="expedition-destination">⌖ ${esc(displayPort)}</p>
          ${!exploring ? `<div class="expedition-market-status"><span data-demand="${demand}">${demandText}</span><span>${picture(stockId, ctx)} ${expeditionStock(world, port, stockId)} в порту${active ? ' · ваш груз отложен' : ''}</span></div>` : ''}
          <div class="expedition-cargo-card"><h4>${active ? 'Отправили' : 'Отправим'}</h4>${cargo(manifest.outgoing, true)}${manifest.payCoins ? `<div class="expedition-cargo-item expedition-money">${ctx.icon('coin')}<span><strong>${manifest.payCoins} монет</strong><small>${active ? 'Уже оплачено' : `Останется ${Math.max(0,(ctx.coins ?? 0)-manifest.payCoins)}`}</small></span></div>` : ''}${!manifest.outgoing.length && !manifest.payCoins ? '<p>Пустой трюм</p>' : ''}</div>
          <div class="expedition-cargo-arrow" aria-hidden="true">↓</div>
          <div class="expedition-cargo-card expedition-return"><h4>${phase === 'ready' ? 'Привёз' : 'Привезёт'}</h4><div class="expedition-return-row">${cargo(manifest.incoming, false)}${manifest.earnCoins ? `<div class="expedition-cargo-item expedition-money">${ctx.icon('coin')}<strong>${manifest.earnCoins} монет</strong></div>` : ''}</div>${exploring ? `<div class="expedition-discovery">${ctx.icon('island')}<strong>${phase === 'ready' ? esc(expeditionPortNames[port]) : 'Новый торговый порт'}</strong></div>` : ''}</div>
          <p class="expedition-effect">${esc(effect)}${manifest.harvestBonus ? ` Включена доплата за урожай: ${manifest.harvestBonus} монет.` : ''}</p>
          ${!exploring ? `<details class="expedition-port-details"><summary>${esc(project.name)} <span>${projectHave}/${projectTotal}${projectDone ? ' · готово' : ''}</span></summary><p>${esc(project.benefit)}</p><p>Благодаря нашим поставкам:</p>${project.needs.map(item => `<div class="expedition-project-item">${picture(item.id, ctx)}<span>${esc(product(item.id, ctx).name)}</span><b>${Math.min(item.quantity,world.markets[port].supplied[item.id] ?? 0)}/${item.quantity}</b></div>`).join('')}<p>${esc(expeditionPortDescriptions[port])}</p>${production.length ? `<p>Сегодня приготовлено: ${production.map(item => `${esc(product(item.id, ctx).name)} ×${item.quantity}`).join(', ')}.</p>` : ''}<p>Спрос и остатки меняются после поставок и игровых утр. Условия отправленного рейса не меняются.</p></details>` : ''}
        ${!active && open ? `<details class="expedition-offers"><summary>Выбрать один или два заказа <span>${orderIds.length}/2</span></summary><div>${choices.map(trade => {
          const offer = quoteExpedition(world, trade.id, { bag: ctx.carried, harvestTier: ctx.harvestTier, coins: ctx.coins ?? 0, boatOwned: true })!;
          return `<div class="expedition-offer-choice">${button(`${esc(trade.name)}<small>${offer.incoming.map(item => `${esc(product(item.id, ctx).name)} ×${item.quantity}`).join(' + ')}${offer.earnCoins ? ` + ${offer.earnCoins} монет` : offer.payCoins ? ` · доплата ${offer.payCoins}` : ''}</small><small>Выбрать только этот заказ</small>`, 'expedition-offer', trade.id, `aria-pressed="${orderIds.includes(trade.id)}"`)}${trade.id !== orderIds[0] ? button(orderIds[1] === trade.id ? 'Убрать второй' : combined ? 'Заменить второй' : 'Добавить вторым', 'expedition-pair', trade.id, `class="expedition-add-order" aria-pressed="${orderIds[1] === trade.id}"`) : ''}</div>`;
        }).join('')}</div></details>` : ''}
          ${world.last && !active ? `<p class="expedition-receipt">${world.last.explored ? 'Новый порт на карте' : 'Прошлый груз получен'} · день ${world.last.day}</p>` : ''}
        </div>
        <footer class="expedition-departure"><p>${esc(status)}</p>${phase === 'sailing' ? `${button(ctx.playerPort === 'home' ? 'В дом · посмотреть утро' : 'Домой · посмотреть утро', 'expedition-rest', String(active!.serial), 'class="bay-freight-primary"')}<small>Переход не начинает ночь. Игровое утро начинается после сна. Настоящий таймер не идёт.</small>` : phase === 'ready' ? `${button(exploring ? 'Открыть новый порт' : 'Получить груз и выручку', 'expedition-claim', '', 'class="bay-freight-primary"')}<small>Без срока получения и потери груза.</small>` : `${quote.available ? '' : `<div class="expedition-reason" role="status">${esc(quote.reason)} ${sourceAction}</div>`}${button(exploring ? 'Отправить на разведку' : combined ? 'Загрузить 2 заказа и отправить' : 'Загрузить и отправить', 'expedition-send', id, `class="bay-freight-primary" ${quote.available ? '' : 'disabled'}`)}`}</footer>
      </div>
    </div>
  </section>`;
}
