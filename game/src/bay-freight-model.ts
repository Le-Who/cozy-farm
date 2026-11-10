import { createFerryExpeditions, restoreFerryExpeditions, advanceExpeditions, type FerryExpeditions } from './ferry-expeditions.ts';
export const freightPorts = ['home', 'grove', 'cape', 'village'] as const;
export type FreightPort = typeof freightPorts[number];
export const freightPortNames: Record<FreightPort, string> = { home: 'Родной остров', grove: 'Солёная роща', cape: 'Цветочный мыс', village: 'Лавандовая гавань' };
export const warehouseCapacity = 36;
export const ferryCapacity = 8;
export const freightProductionBuffer = 8;
export type FreightStock = Record<string, number>;
export type FreightItem = { id: string; quantity: number };
export type FreightCargo = FreightItem & { destination: FreightPort };
export type FreightPickup = { destination: FreightPort; products: string[] };
export type FreightShip = { phase: 'docked'; port: FreightPort; cargo: FreightCargo[] }
  | { phase: 'sailing'; from: FreightPort; to: FreightPort; arrivesOn: number; cargo: FreightCargo[] };
export type FreightEvent = { day: number; kind: 'loading' | 'sailing' | 'unloading' | 'production' | 'blocked'; port: FreightPort; items: FreightItem[]; to?: FreightPort };
export type BayFreightState = {
  expeditions: FerryExpeditions;
  harvestStore?: number;
  warehouses: Record<FreightPort, FreightStock>;
  route: { stops: FreightPort[]; mode: 'mixed' | 'priority'; running: boolean; pickups: Record<FreightPort, FreightPickup> };
  ship: FreightShip;
  lastDay: number;
  events: FreightEvent[];
};
export type FreightResult = { ok: boolean; message: string };

const isPort = (value: unknown): value is FreightPort => freightPorts.some(port => port === value);
const validId = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,100}$/.test(value) && !['constructor', 'prototype'].includes(value);
const count = (value: unknown, maximum = 999999) => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(maximum, Math.floor(value))) : 0;
const record = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const ok = (message: string): FreightResult => ({ ok: true, message });
const fail = (message: string): FreightResult => ({ ok: false, message });

export function createFreight(day = 1): BayFreightState {
  return {
    expeditions: createFerryExpeditions(day),
    harvestStore: 0,
    warehouses: { home: {}, grove: {}, cape: {}, village: {} },
    route: { stops: ['home', 'village'], mode: 'mixed', running: false, pickups: {
      home: { destination: 'village', products: ['wheat'] },
      grove: { destination: 'village', products: ['seaSalt'] },
      cape: { destination: 'village', products: ['beeswax'] },
      village: { destination: 'home', products: ['handmade:round'] },
    } },
    ship: { phase: 'docked', port: 'home', cargo: [] }, lastDay: Math.max(1, count(day)), events: [],
  };
}

export function freightStock(state: BayFreightState, port: FreightPort, id: string): number {
  return Object.hasOwn(state.warehouses[port], id) ? state.warehouses[port][id] : 0;
}
export function freightUsed(state: BayFreightState, port: FreightPort): number {
  return Object.values(state.warehouses[port]).reduce((sum, amount) => sum + amount, 0);
}
export function freightCapacity(state: BayFreightState, port: FreightPort): number {
  const tier = Math.max(0, Math.min(3, Math.floor(state.harvestStore ?? 0)));
  return warehouseCapacity + (port === 'village' && tier > 0 ? 8 + tier * 4 : 0);
}
export function ferryUsed(state: BayFreightState): number {
  return state.ship.cargo.reduce((sum, item) => sum + item.quantity, 0);
}
export function addFreightStock(state: BayFreightState, port: FreightPort, id: string, quantity: number): boolean {
  if (!validId(id) || !Number.isSafeInteger(quantity) || quantity <= 0 || freightUsed(state, port) + quantity > freightCapacity(state, port)) return false;
  state.warehouses[port][id] = freightStock(state, port, id) + quantity;
  return true;
}
export function consumeFreightStock(state: BayFreightState, port: FreightPort, items: readonly FreightItem[]): boolean {
  const wanted = new Map<string, number>();
  for (const item of items) {
    if (!validId(item.id) || !Number.isSafeInteger(item.quantity) || item.quantity <= 0) return false;
    wanted.set(item.id, (wanted.get(item.id) ?? 0) + item.quantity);
  }
  if ([...wanted].some(([id, quantity]) => freightStock(state, port, id) < quantity)) return false;
  for (const [id, quantity] of wanted) {
    state.warehouses[port][id] -= quantity;
    if (!state.warehouses[port][id]) delete state.warehouses[port][id];
  }
  return true;
}
export function takeFreightStock(state: BayFreightState, port: FreightPort, id: string, quantity: number): boolean {
  return consumeFreightStock(state, port, [{ id, quantity }]);
}
export function transferFreightStock(state: BayFreightState, from: FreightPort, to: FreightPort, id: string, quantity: number): boolean {
  if (from === to || !validId(id) || !Number.isSafeInteger(quantity) || quantity <= 0 || freightStock(state, from, id) < quantity || freightUsed(state, to) + quantity > freightCapacity(state, to)) return false;
  takeFreightStock(state, from, id, quantity);
  addFreightStock(state, to, id, quantity);
  return true;
}

function event(state: BayFreightState, day: number, kind: FreightEvent['kind'], port: FreightPort, items: FreightItem[] = [], to?: FreightPort) {
  state.events.unshift({ day, kind, port, items, ...(to ? { to } : {}) });
  state.events.length = Math.min(state.events.length, 12);
}
function editable(state: BayFreightState): boolean { return state.ship.phase === 'docked' && !state.route.running; }
export function reconcileFreightPorts(state: BayFreightState, openedPorts: readonly FreightPort[]): void {
  if (!editable(state) || state.ship.phase !== 'docked' || state.ship.cargo.length || state.route.stops.every(port => openedPorts.includes(port))) return;
  const current = state.ship.port;
  const available = [...new Set(openedPorts.filter(isPort))];
  if (!available.includes(current) || available.length < 2) return;
  state.route.stops = [current, ...available.filter(port => port !== current)].slice(0, 2);
  for (const port of state.route.stops) {
    const pickup = state.route.pickups[port];
    if (!state.route.stops.includes(pickup.destination)) {
      pickup.destination = state.route.stops.find(stop => stop !== port)!;
      if (port === 'home' && (pickup.products.join(',') === 'wheat' || pickup.products.join(',') === 'wheat,shells')) pickup.products = [];
    }
  }
}
export function setFreightStops(state: BayFreightState, stops: readonly FreightPort[], openedPorts: readonly FreightPort[]): FreightResult {
  if (!editable(state)) return fail('Остановите паром и дождитесь причала, чтобы изменить путь.');
  if (stops.length < 2 || stops.length > 4 || new Set(stops).size !== stops.length || stops.some(port => !isPort(port) || !openedPorts.includes(port))) return fail('Выберите от двух открытых причалов.');
  if (state.ship.phase !== 'docked' || !stops.includes(state.ship.port)) return fail('Текущий причал должен остаться на маршруте.');
  if (state.ship.cargo.some(item => !stops.includes(item.destination))) return fail('Сначала доставьте груз к его причалу.');
  state.route.stops = [...stops];
  return ok('Новый путь сохранён.');
}
export function setFreightMode(state: BayFreightState, mode: 'mixed' | 'priority'): FreightResult {
  if (mode !== 'mixed' && mode !== 'priority') return fail('Выберите способ погрузки.');
  state.route.mode = mode;
  return ok(mode === 'mixed' ? 'Место в трюме делится между выбранными товарами.' : 'Первый товар заполняет трюм раньше остальных.');
}
export function setFreightPickup(state: BayFreightState, port: FreightPort, destination: FreightPort, products: readonly string[]): FreightResult {
  if (!isPort(port) || !isPort(destination) || port === destination || products.length > 40 || products.some(id => !validId(id))) return fail('Выберите другой причал и товары для него.');
  state.route.pickups[port] = { destination, products: [...new Set(products)] };
  return ok('Погрузка сохранена для следующих рейсов.');
}

function unload(state: BayFreightState, day: number, port: FreightPort) {
  const unloaded: FreightItem[] = [];
  for (const item of state.ship.cargo) {
    if (item.destination !== port) continue;
    const quantity = Math.min(item.quantity, freightCapacity(state, port) - freightUsed(state, port));
    if (quantity > 0) {
      addFreightStock(state, port, item.id, quantity);
      item.quantity -= quantity;
      unloaded.push({ id: item.id, quantity });
    }
  }
  state.ship.cargo = state.ship.cargo.filter(item => item.quantity > 0);
  if (unloaded.length) event(state, day, 'unloading', port, unloaded);
  if (state.ship.cargo.some(item => item.destination === port)) event(state, day, 'blocked', port);
}

function depart(state: BayFreightState, day: number, openedPorts: readonly FreightPort[]): FreightResult {
  if (state.ship.phase !== 'docked') return fail('Паром уже в пути.');
  const from = state.ship.port;
  const stops = state.route.stops;
  if (stops.some(port => !openedPorts.includes(port))) { state.route.running = false; return fail('Откройте все причалы выбранного пути.'); }
  const pickup = state.route.pickups[from];
  if (pickup.products.length && !stops.includes(pickup.destination)) { state.route.running = false; return fail('Добавьте причал назначения груза в путь или измените погрузку.'); }
  if (state.ship.cargo.some(item => item.destination === from)) { state.route.running = false; return fail('Склад заполнен. Освободите место для оставшегося груза.'); }
  const loaded: FreightItem[] = [];
  const loadOne = (id: string, quantity: number) => {
    if (!takeFreightStock(state, from, id, quantity)) return;
    const existing = state.ship.cargo.find(item => item.id === id && item.destination === pickup.destination);
    if (existing) existing.quantity += quantity;
    else state.ship.cargo.push({ id, quantity, destination: pickup.destination });
    const row = loaded.find(item => item.id === id);
    if (row) row.quantity += quantity; else loaded.push({ id, quantity });
  };
  if (state.route.mode === 'priority') {
    for (const id of pickup.products) {
      const quantity = Math.min(freightStock(state, from, id), ferryCapacity - ferryUsed(state));
      if (quantity) loadOne(id, quantity);
    }
  } else {
    while (ferryUsed(state) < ferryCapacity) {
      const available = pickup.products.filter(id => freightStock(state, from, id) > 0);
      if (!available.length) break;
      for (const id of available) { if (ferryUsed(state) >= ferryCapacity) break; loadOne(id, 1); }
    }
  }
  if (loaded.length) event(state, day, 'loading', from, loaded, pickup.destination);
  const to = stops[(stops.indexOf(from) + 1) % stops.length];
  state.ship = { phase: 'sailing', from, to, arrivesOn: day + 1, cargo: state.ship.cargo };
  event(state, day, 'sailing', from, [], to);
  return ok(loaded.length ? 'Груз на борту. Разгрузка на следующем игровом утре.' : 'Паром вышел к следующему причалу без нового груза.');
}
export function startFreight(state: BayFreightState, day: number, openedPorts: readonly FreightPort[]): FreightResult {
  if (state.route.running) return fail('Паром уже следует расписанию.');
  if (state.ship.phase === 'sailing') { state.route.running = true; return ok('После прибытия паром продолжит путь.'); }
  const result = depart(state, day, openedPorts);
  if (result.ok) state.route.running = true;
  return result;
}
export function pauseFreight(state: BayFreightState): FreightResult {
  state.route.running = false;
  return ok(state.ship.phase === 'sailing' ? 'Паром разгрузится и останется у следующего причала.' : 'Паром остаётся у причала.');
}

function produce(state: BayFreightState, day: number, openedPorts: readonly FreightPort[], waxAvailable:boolean) {
  const outputs = [{ port: 'home' as const, id: 'shells', quantity: 1 }, { port: 'grove' as const, id: 'seaSalt', quantity: 2 }, { port: 'cape' as const, id: 'beeswax', quantity: 2 }];
  for (const output of outputs) {
    const quantity = Math.min(output.quantity, Math.max(0, freightProductionBuffer - freightStock(state, output.port, output.id)), freightCapacity(state, output.port) - freightUsed(state, output.port));
    if ((output.id!=='beeswax' || waxAvailable) && openedPorts.includes(output.port) && quantity > 0 && addFreightStock(state, output.port, output.id, quantity)) event(state, day, 'production', output.port, [{ id: output.id, quantity }]);
  }
  if (openedPorts.includes('village') && freightStock(state, 'village', 'wheat') >= 2) {
    takeFreightStock(state, 'village', 'wheat', 2);
    addFreightStock(state, 'village', 'handmade:round', 1);
    event(state, day, 'production', 'village', [{ id: 'handmade:round', quantity: 1 }]);
  }
}
export function advanceFreight(state: BayFreightState, day: number, openedPorts: readonly FreightPort[], waxAvailable=true): void {
  advanceExpeditions(state.expeditions, day);
  const target = Math.max(state.lastDay, count(day));
  for (let current = state.lastDay + 1; current <= target; current++) {
    if (state.ship.phase === 'sailing' && current >= state.ship.arrivesOn) {
      const port = state.ship.to;
      state.ship = { phase: 'docked', port, cargo: state.ship.cargo };
      unload(state, current, port);
    } else if (state.ship.phase === 'docked') {
      unload(state, current, state.ship.port);
    }
    produce(state, current, openedPorts, waxAvailable);
    if (state.ship.phase === 'docked' && state.route.running) depart(state, current, openedPorts);
    state.lastDay = current;
  }
}

export function restoreFreight(value: unknown, day = 1): BayFreightState {
  const state = createFreight(day), raw = record(value), stores = record(raw.warehouses), route = record(raw.route), ship = record(raw.ship);
  state.expeditions = restoreFerryExpeditions(raw.expeditions, day);
  state.harvestStore = count(raw.harvestStore, 3);
  state.lastDay = Math.min(state.lastDay, Math.max(1, count(raw.lastDay) || state.lastDay));
  for (const port of freightPorts) {
    for (const [id, amount] of Object.entries(record(stores[port]))) {
      const quantity = Math.min(count(amount), freightCapacity(state, port) - freightUsed(state, port));
      if (validId(id) && quantity > 0) addFreightStock(state, port, id, quantity);
    }
  }
  const stops = Array.isArray(route.stops) ? [...new Set(route.stops.filter(isPort))] : [];
  if (stops.length >= 2) state.route.stops = stops;
  state.route.mode = route.mode === 'priority' ? 'priority' : 'mixed';
  state.route.running = route.running === true;
  const pickups = record(route.pickups);
  for (const port of freightPorts) {
    const pickup = record(pickups[port]);
    if (isPort(pickup.destination) && pickup.destination !== port && Array.isArray(pickup.products)) {
      state.route.pickups[port] = { destination: pickup.destination, products: [...new Set(pickup.products.filter(validId))].slice(0, 40) };
    }
  }
  const cargo: FreightCargo[] = [];
  let room = ferryCapacity;
  for (const entry of Array.isArray(ship.cargo) ? ship.cargo : []) {
    const item = record(entry), quantity = Math.min(room, count(item.quantity));
    if (validId(item.id) && isPort(item.destination) && state.route.stops.includes(item.destination) && quantity > 0) {
      const existing = cargo.find(row => row.id === item.id && row.destination === item.destination);
      if (existing) existing.quantity += quantity; else cargo.push({ id: item.id, quantity, destination: item.destination });
      room -= quantity;
    }
  }
  if (ship.phase === 'sailing' && isPort(ship.from) && isPort(ship.to) && ship.from !== ship.to && state.route.stops.includes(ship.from) && state.route.stops.includes(ship.to)) {
    state.ship = { phase: 'sailing', from: ship.from, to: ship.to, arrivesOn: state.lastDay + 1, cargo };
  } else {
    const port = isPort(ship.port) && state.route.stops.includes(ship.port) ? ship.port : state.route.stops[0];
    state.ship = { phase: 'docked', port, cargo };
  }
  for (const entry of Array.isArray(raw.events) ? raw.events.slice(0, 12) : []) {
    const item = record(entry);
    if (!isPort(item.port) || !['loading', 'sailing', 'unloading', 'production', 'blocked'].includes(String(item.kind))) continue;
    const items = (Array.isArray(item.items) ? item.items : []).map(record).filter(row => validId(row.id) && count(row.quantity) > 0).map(row => ({ id: String(row.id), quantity: count(row.quantity) }));
    if (item.kind === 'sailing' && !isPort(item.to) || ['loading', 'unloading', 'production'].includes(String(item.kind)) && !items.length) continue;
    state.events.push({ day: count(item.day), kind: item.kind as FreightEvent['kind'], port: item.port, items,
      ...(isPort(item.to) ? { to: item.to } : {}) });
  }
  return state;
}
