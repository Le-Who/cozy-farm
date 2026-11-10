/** A small, finite trading world. Prices and cargo are fixed when a voyage leaves. */
export const expeditionPorts = ['mill', 'salt', 'orchard'] as const;
export type ExpeditionPort = typeof expeditionPorts[number];
export type ExpeditionItem = { id: string; quantity: number };
export type PortDemand = 'shortage' | 'balanced' | 'surplus';
export type PortMarket = {
  stock: Record<string, number>;
  supplied: Record<string, number>;
  visits: number;
  production: ExpeditionItem[];
};
export type ExpeditionManifest = {
  id: string;
  port: ExpeditionPort;
  kind: 'trade' | 'explore';
  name: string;
  outgoing: ExpeditionItem[];
  incoming: ExpeditionItem[];
  payCoins: number;
  earnCoins: number;
  harvestBonus?: number;
};
export type FerryExpedition = ExpeditionManifest & {
  serial: number;
  departedOn: number;
  returnsOn: number;
  phase: 'sailing' | 'ready';
};
export type FerryExpeditions = {
  version: 1;
  lastDay: number;
  serial: number;
  completed: number;
  discovered: ExpeditionPort[];
  markets: Record<ExpeditionPort, PortMarket>;
  active: FerryExpedition | null;
  last: { name: string; port: ExpeditionPort; day: number; explored: boolean } | null;
};
export type ExpeditionWallet = { bag: Record<string, number>; coins: number; boatOwned: boolean; harvestTier?: number };
export type ExpeditionQuote = ExpeditionManifest & { available: boolean; reason: string };
type Trade = { id: string; port: ExpeditionPort; name: string; outgoing: ExpeditionItem[]; incoming: ExpeditionItem[]; project?: boolean };
const lot = (id: string, quantity: number): ExpeditionItem => ({ id, quantity });
export const expeditionPortNames: Record<ExpeditionPort, string> = {
  mill: 'Мельничный посад', salt: 'Соляной маяк', orchard: 'Садовая пристань',
};
export const expeditionPortDescriptions: Record<ExpeditionPort, string> = {
  mill: 'Пекарь превращает ваше зерно в булочки. Выпечку можно продать, подать к столу или отвезти садовникам.',
  salt: 'У солеваров есть соль для кухни. Морковь и улов помогут открыть рыбную кухню у маяка.',
  orchard: 'Здесь можно найти недостающие фрукты. Яблоки идут на варенье, а булочки ждут сборщики урожая.',
};
export const portProjects = {
  mill: { name: 'Вторая печь', needs: [lot('wheat', 10)], benefit: 'Пекарь сможет выпекать до двух булочек за утро.' },
  salt: { name: 'Рыбная кухня', needs: [lot('carrot', 6), lot('seaBass', 4)], benefit: 'В продаже появится рыба на гриле из местной соли, вашего улова и моркови.' },
  orchard: { name: 'Стол заготовок', needs: [lot('apple', 8), lot('handmade:round', 2)], benefit: 'Две банки варенья за утро и новая смешанная фруктовая корзина.' },
} as const;
const trades: readonly Trade[] = [
  { id: 'mill-grain', port: 'mill', name: 'Зерно для пекаря', outgoing: [lot('wheat', 4)], incoming: [lot('handmade:round', 1)] },
  { id: 'mill-sale', port: 'mill', name: 'Продать немного зерна', outgoing: [lot('wheat', 2)], incoming: [] },
  { id: 'mill-baking', port: 'mill', name: 'Две булочки к столу', outgoing: [lot('wheat', 4)], incoming: [lot('handmade:round', 2)] },
  { id: 'mill-eggs', port: 'mill', name: 'Яйца для свежей выпечки', outgoing: [lot('eggs', 4)], incoming: [lot('handmade:round', 1)] },
  { id: 'mill-buy', port: 'mill', name: 'Купить булочку', outgoing: [], incoming: [lot('handmade:round', 1)] },
  { id: 'salt-carrots', port: 'salt', name: 'Овощи для маяка', outgoing: [lot('carrot', 3)], incoming: [lot('seaSalt', 2)] },
  { id: 'salt-catch', port: 'salt', name: 'Улов для рыбной кухни', outgoing: [lot('seaBass', 2)], incoming: [lot('seaSalt', 2)] },
  { id: 'salt-buy', port: 'salt', name: 'Соль для своей кухни', outgoing: [], incoming: [lot('seaSalt', 2)] },
  { id: 'salt-grill', port: 'salt', name: 'Обед у маяка', outgoing: [], incoming: [lot('dish:grilledFish', 1)], project: true },
  { id: 'orchard-apples', port: 'orchard', name: 'Яблоки для варенья', outgoing: [lot('apple', 3)], incoming: [lot('dish:appleJam', 1)] },
  { id: 'orchard-buns', port: 'orchard', name: 'Угощение для сборщиков', outgoing: [lot('handmade:round', 1)], incoming: [lot('peach', 2)] },
  { id: 'orchard-pears', port: 'orchard', name: 'Груши для рецепта', outgoing: [], incoming: [lot('pear', 2)] },
  { id: 'orchard-peaches', port: 'orchard', name: 'Персики для рецепта', outgoing: [], incoming: [lot('peach', 2)] },
  { id: 'orchard-mixed', port: 'orchard', name: 'Фруктовая корзина', outgoing: [], incoming: [lot('apple', 1), lot('pear', 1), lot('peach', 1)], project: true },
];
const bids: Record<ExpeditionPort, Record<string, number>> = {
  mill: { wheat: 5, eggs: 5 }, salt: { carrot: 4, seaBass: 12 }, orchard: { apple: 5, 'handmade:round': 24 },
};
const asks: Record<ExpeditionPort, Record<string, number>> = {
  mill: { 'handmade:round': 15 }, salt: { seaSalt: 5, 'dish:grilledFish': 32 },
  orchard: { apple: 6, pear: 7, peach: 8, 'dish:appleJam': 12 },
};
const knownItems = new Set(['wheat', 'eggs', 'carrot', 'seaBass', 'seaSalt', 'apple', 'pear', 'peach', 'handmade:round', 'dish:appleJam', 'dish:grilledFish']);
const count = (value: unknown, max = 999999): number => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(max, Math.floor(value))) : 0;
const record = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const isPort = (value: unknown): value is ExpeditionPort => expeditionPorts.some(port => port === value);
const cloneItems = (items: readonly ExpeditionItem[]) => items.map(item => ({ ...item }));
export function createFerryExpeditions(day = 1): FerryExpeditions {
  return { version: 1, lastDay: Math.max(1, count(day)), serial: 0, completed: 0, discovered: ['mill'], active: null, last: null, markets: {
    mill: { stock: { wheat: 0, eggs: 2, 'handmade:round': 3 }, supplied: {}, visits: 0, production: [] },
    salt: { stock: { carrot: 0, seaBass: 2, seaSalt: 6, 'dish:grilledFish': 0 }, supplied: {}, visits: 0, production: [] },
    orchard: { stock: { apple: 0, pear: 4, peach: 4, 'handmade:round': 0, 'dish:appleJam': 1 }, supplied: {}, visits: 0, production: [] },
  } };
}
export function expeditionStock(state: FerryExpeditions, port: ExpeditionPort, id: string): number {
  return state.markets[port].stock[id] ?? 0;
}
export function portProjectComplete(state: FerryExpeditions, port: ExpeditionPort): boolean {
  return portProjects[port].needs.every(item => (state.markets[port].supplied[item.id] ?? 0) >= item.quantity);
}
export function portDemand(state: FerryExpeditions, port: ExpeditionPort, id = port === 'mill' ? 'wheat' : port === 'salt' ? 'carrot' : 'apple'): PortDemand {
  const stock = expeditionStock(state, port, id);
  return stock < 4 ? 'shortage' : stock < 10 ? 'balanced' : 'surplus';
}
export function expeditionBid(state: FerryExpeditions, port: ExpeditionPort, id: string): number {
  const base = bids[port][id] ?? 0;
  return base ? Math.max(1, base - (portDemand(state, port, id) === 'shortage' ? 0 : portDemand(state, port, id) === 'balanced' ? 1 : 2)) : 0;
}
export function expeditionTrades(state: FerryExpeditions, port: ExpeditionPort): readonly Trade[] {
  return trades.filter(trade => trade.port === port && (!trade.project || portProjectComplete(state, port)));
}
export function explorationReason(state: FerryExpeditions, port: ExpeditionPort): string {
  if (state.discovered.includes(port)) return 'Этот порт уже нанесён на карту.';
  if (port === 'salt' && state.markets.mill.visits < 1) return 'Сначала получите груз из Мельничного посада.';
  if (port === 'orchard' && state.markets.salt.visits < 1) return 'Сначала завершите торговый рейс к Соляному маяку.';
  return port === 'mill' ? 'Этот порт уже нанесён на карту.' : '';
}
export function quoteExpedition(state: FerryExpeditions, id: string, wallet: ExpeditionWallet): ExpeditionQuote | undefined {
  const trade = trades.find(entry => entry.id === id);
  const explorePort = id.startsWith('explore-') ? id.slice(8) : '';
  const exploring = !trade && isPort(explorePort) && explorePort !== 'mill';
  if (!trade && !exploring) return;
  const port = trade?.port ?? explorePort as ExpeditionPort;
  const outgoing = trade ? cloneItems(trade.outgoing) : [lot('wheat', 2)];
  const incoming = trade ? cloneItems(trade.incoming) : [];
  const harvestBonus = trade ? Math.min(count(wallet.harvestTier, 3), outgoing.filter(item => ['wheat','carrot','apple'].includes(item.id)).reduce((sum,item)=>sum+item.quantity,0)) : 0;
  const balance = trade ? harvestBonus + outgoing.reduce((sum, item) => sum + expeditionBid(state, port, item.id) * item.quantity, 0)
    - incoming.reduce((sum, item) => sum + (asks[port][item.id] ?? 0) * item.quantity, 0) : 0;
  const payCoins = Math.max(0, -balance), earnCoins = Math.max(0, balance);
  let reason = !wallet.boatOwned ? 'Купите лодку у домашнего причала.' : state.active ? 'Сначала дождитесь своего парома и получите его груз.'
    : exploring ? explorationReason(state, port) : !state.discovered.includes(port) ? 'Сначала разведайте этот берег.'
    : trade?.project && !portProjectComplete(state, port) ? 'Сначала помогите порту завершить свой проект.' : '';
  if (!reason && trade && incoming.some(item => expeditionStock(state, port, item.id) < item.quantity)) reason = 'Сейчас не хватает товара в порту. Посмотрите, какие припасы нужны для новой партии.';
  if (!reason && trade && outgoing.some(item => expeditionStock(state, port, item.id) + item.quantity > (port === 'orchard' && item.id === 'handmade:round' ? 2 : 24))) reason = 'В порту пока достаточно этих припасов. Выберите другой груз.';
  if (!reason && outgoing.some(item => (wallet.bag[item.id] ?? 0) < item.quantity)) reason = 'Не хватает припасов. Их точное количество показано в грузе.';
  if (!reason && wallet.coins < payCoins) reason = 'Не хватает монет для выбранной покупки. Можно отправить другой груз.';
  return { id, port, kind: exploring ? 'explore' : 'trade', name: trade?.name ?? (port === 'salt' ? 'За огнём на горизонте' : 'По следам садовых лодок'), outgoing, incoming, payCoins, earnCoins, harvestBonus, available: !reason, reason };
}
export function dispatchExpedition(state: FerryExpeditions, id: string, day: number, wallet: ExpeditionWallet): { ok: boolean; message: string; manifest?: ExpeditionManifest } {
  const quote = quoteExpedition(state, id, wallet);
  if (!quote?.available) return { ok: false, message: quote?.reason ?? 'Выберите рейс на карте.' };
  const { available: _available, reason: _reason, ...manifest } = quote;
  for (const item of manifest.incoming) state.markets[manifest.port].stock[item.id] -= item.quantity;
  state.active = { ...manifest, serial: ++state.serial, departedOn: day, returnsOn: day + 1, phase: 'sailing' };
  return { ok: true, message: 'Паром отправился. Точный груз вернётся следующим игровым утром.', manifest };
}
export function finishExpedition(state: FerryExpeditions, day: number): ExpeditionManifest | undefined {
  const voyage = state.active;
  if (!voyage || voyage.phase !== 'ready') return;
  if (voyage.kind === 'explore') {
    if (!state.discovered.includes(voyage.port)) state.discovered.push(voyage.port);
  } else state.markets[voyage.port].visits++;
  state.completed++;
  state.last = { name: voyage.name, port: voyage.port, day, explored: voyage.kind === 'explore' };
  state.active = null;
  return { id: voyage.id, port: voyage.port, kind: voyage.kind, name: voyage.name, outgoing: cloneItems(voyage.outgoing), incoming: cloneItems(voyage.incoming), payCoins: voyage.payCoins, earnCoins: voyage.earnCoins, harvestBonus: voyage.harvestBonus ?? 0 };
}
function grow(market: PortMarket, id: string, quantity: number, capacity: number): void {
  const existing = market.stock[id] ?? 0;
  market.stock[id] = existing + Math.min(quantity, Math.max(0, capacity - existing));
}
function make(market: PortMarket, ingredients: ExpeditionItem[], output: string, limit: number, capacity: number): void {
  let produced = 0;
  while (produced < limit && (market.stock[output] ?? 0) < capacity && ingredients.every(item => (market.stock[item.id] ?? 0) >= item.quantity)) {
    for (const item of ingredients) market.stock[item.id] -= item.quantity;
    market.stock[output] = (market.stock[output] ?? 0) + 1;
    produced++;
  }
  if (produced) market.production.push(lot(output, produced));
}
export function advanceExpeditions(state: FerryExpeditions, day: number): void {
  const target = Math.max(state.lastDay, count(day));
  for (let current = state.lastDay + 1; current <= target; current++) {
    const voyage = state.active;
    if (voyage?.phase === 'sailing' && voyage.returnsOn <= current) {
      if (voyage.kind === 'trade') for (const item of voyage.outgoing) {
        const market = state.markets[voyage.port];
        market.stock[item.id] = (market.stock[item.id] ?? 0) + item.quantity;
        market.supplied[item.id] = Math.min(999999, (market.supplied[item.id] ?? 0) + item.quantity);
      }
      voyage.phase = 'ready';
    }
    const { mill, salt, orchard } = state.markets;
    for (const market of Object.values(state.markets)) market.production = [];
    grow(mill, 'eggs', 1, 6);
    make(mill, [lot('wheat', 2), lot('eggs', 1)], 'handmade:round', portProjectComplete(state, 'mill') ? 2 : 1, portProjectComplete(state, 'mill') ? 8 : 4);
    grow(salt, 'seaSalt', 2, 6); grow(salt, 'seaBass', 1, 6);
    if (portProjectComplete(state, 'salt')) make(salt, [lot('seaBass', 1), lot('seaSalt', 1), lot('carrot', 1)], 'dish:grilledFish', 1, 4);
    // Fruit grows locally; imported bread feeds people, not trees. Orders recover when it is eaten.
    grow(orchard, current % 2 ? 'pear' : 'peach', 2, 4);
    if (current % 2 === 0 && (orchard.stock['handmade:round'] ?? 0) > 0) orchard.stock['handmade:round']--;
    make(orchard, [lot('apple', 2)], 'dish:appleJam', portProjectComplete(state, 'orchard') ? 2 : 1, portProjectComplete(state, 'orchard') ? 6 : 3);
    state.lastDay = current;
  }
}
/** Ownership of imported goods is independent from learning how to produce them. */
export function restoreFerryExpeditions(value: unknown, day = 1): FerryExpeditions {
  const state = createFerryExpeditions(day), raw = record(value), markets = record(raw.markets);
  if (value === undefined) return state;
  if (raw.version !== 1) throw new Error('Unsupported ferry expedition save');
  if (!Object.hasOwn(raw, 'active')) throw new Error('Missing ferry expedition state');
  state.lastDay = Math.min(day, Math.max(1, count(raw.lastDay) || day));
  state.serial = count(raw.serial); state.completed = count(raw.completed);
  state.discovered = [...new Set(['mill' as const, ...(Array.isArray(raw.discovered) ? raw.discovered.filter(isPort) : [])])];
  for (const port of expeditionPorts) {
    const saved = record(markets[port]);
    for (const [id, quantity] of Object.entries(record(saved.stock))) if (knownItems.has(id)) state.markets[port].stock[id] = count(quantity, 24);
    for (const [id, quantity] of Object.entries(record(saved.supplied))) if (knownItems.has(id)) state.markets[port].supplied[id] = count(quantity);
    state.markets[port].visits = count(saved.visits);
    state.markets[port].production = safeItems(saved.production);
  }
  const active = record(raw.active), trade = trades.find(entry => entry.id === active.id);
  const exploration = active.id === 'explore-salt' || active.id === 'explore-orchard';
  if (isPort(active.port) && (trade?.port === active.port || exploration && active.id === 'explore-' + active.port)
    && (active.phase === 'sailing' || active.phase === 'ready')) {
    const outgoing = safeItems(active.outgoing), incoming = safeItems(active.incoming);
    // A damaged manifest cannot become an arbitrary item grant or an oversized cargo.
    const expectedOut = trade?.outgoing ?? [lot('wheat', 2)], expectedIn = trade?.incoming ?? [];
    if (JSON.stringify(outgoing) === JSON.stringify(expectedOut) && JSON.stringify(incoming) === JSON.stringify(expectedIn)) {
      state.active = { id: String(active.id), port: active.port, kind: exploration ? 'explore' : 'trade', name: trade?.name ?? (active.port === 'salt' ? 'За огнём на горизонте' : 'По следам садовых лодок'), outgoing, incoming,
        harvestBonus: count(active.harvestBonus, 3), payCoins: count(active.payCoins, 100), earnCoins: count(active.earnCoins, 100), serial: count(active.serial) || state.serial,
        departedOn: Math.min(day, Math.max(1, count(active.departedOn))), returnsOn: Math.min(day + 1, Math.max(1, count(active.returnsOn))), phase: active.phase };
    }
  }
  const last = record(raw.last);
  if (isPort(last.port) && typeof last.name === 'string') state.last = { port: last.port, name: last.name.slice(0, 100), day: Math.min(day, count(last.day)), explored: last.explored === true };
  // Never erase a paid, in-flight shipment silently when its save is damaged.
  if (raw.active !== null && raw.active !== undefined && !state.active) throw new Error('Invalid ferry expedition manifest');
  if (state.active && (!Number.isSafeInteger(active.payCoins) || !Number.isSafeInteger(active.earnCoins)
    || active.payCoins !== state.active.payCoins || active.earnCoins !== state.active.earnCoins
    || count(active.departedOn) !== active.departedOn || count(active.returnsOn) !== active.returnsOn
    || Number(active.returnsOn) !== Number(active.departedOn) + 1)) throw new Error('Invalid ferry expedition receipt');
  // Every dispatch has exactly one receipt until it is claimed. A lost receipt is
  // damage to this versioned ledger, not a legacy save that may be reset.
  if (raw.serial !== state.serial || raw.completed !== state.completed
    || state.serial !== state.completed + (state.active ? 1 : 0)
    || state.active && active.serial !== state.serial) throw new Error('Invalid ferry expedition bookkeeping');
  return state;
}
function safeItems(value: unknown): ExpeditionItem[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 8).map(record).filter(item => typeof item.id === 'string' && knownItems.has(item.id) && count(item.quantity, 24) > 0)
    .map(item => lot(String(item.id), count(item.quantity, 24)));
}
