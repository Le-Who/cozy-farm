import { foodQualities, intentDefinitions, type FoodOfferId, type FoodQuality, type IntentId } from './intent-orders.ts';

export type NeighborId = 'bea' | 'finn';
export type NeighborArrangement = 'table' | 'basket';
export const neighborEpisodeIds = ['beaTea', 'beaBasket', 'finnShore', 'finnLantern'] as const;
export type NeighborEpisodeId = typeof neighborEpisodeIds[number];
export const neighborEpisodes: Record<NeighborEpisodeId, { resident: NeighborId; title: string; preparation: string; dialogue: string; intentId: IntentId; arrangement: NeighborArrangement }> = {
  beaTea: { resident: 'bea', title: 'Чай у Беа', preparation: 'Беа расставляет чашки и накрывает стол скатертью.', dialogue: 'Я затеяла чаепитие. Присоединишься? Принеси что-нибудь нежное и сладкое — рецепт выбирай сам.', intentId: 'delicate', arrangement: 'table' },
  beaBasket: { resident: 'bea', title: 'Корзинка для прогулки', preparation: 'Беа выстилает корзинку салфеткой и выбирает тропинку.', dialogue: 'Хочу пройтись вдоль берега. Возьмём выпечку, которую удобно есть в дороге?', intentId: 'portable', arrangement: 'basket' },
  finnShore: { resident: 'finn', title: 'Обед у воды', preparation: 'Финн складывает сеть и готовит место для обеда у причала.', dialogue: 'Сегодня не спешу за уловом. Давай пообедаем у воды? Принеси что-нибудь сытное и несладкое.', intentId: 'hearty', arrangement: 'basket' },
  finnLantern: { resident: 'finn', title: 'Вечер фонариков', preparation: 'Финн развешивает фонарики и собирает общий стол.', dialogue: 'Хочу собрать соседей под фонариками. Нужно сладкое угощение, которым легко поделиться.', intentId: 'sharing', arrangement: 'table' },
};
export type NeighborFood = { id: FoodOfferId; name: string; qualities: FoodQuality[] };
export type NeighborMemory = { day: number; episode: NeighborEpisodeId; foodName: string; qualities: FoodQuality[] };
type PlanBase = { serial: number; startedOn: number };
export type NeighborPlan = PlanBase & (
  | { phase: 'preparing' | 'joined'; food: null }
  | { phase: 'arranging' | 'celebrating' | 'remembered'; food: NeighborFood }
);
export type NeighborHistory = { completed: number; helpReady: boolean; current: NeighborPlan | null; memories: NeighborMemory[] };
export type NeighborState = Record<NeighborId, NeighborHistory>;
export type NeighborAssembly = { kind: NeighborArrangement; placements: readonly { slot: 'food' | 'cup' | 'flowers'; x: number; y: number }[]; settled: true };
export function createNeighborState(): NeighborState {
  return { bea: { completed: 0, helpReady: false, current: null, memories: [] }, finn: { completed: 0, helpReady: false, current: null, memories: [] } };
}
export function episodeFor(resident: NeighborId, serial: number): NeighborEpisodeId {
  return resident === 'bea' ? serial % 2 ? 'beaTea' : 'beaBasket' : serial % 2 ? 'finnShore' : 'finnLantern';
}
export function prepareNeighbor(history: NeighborHistory, day: number): NeighborPlan {
  return { serial: history.completed + 1, startedOn: day, phase: 'preparing', food: null };
}
export function validNeighborAssembly(value: unknown, kind: NeighborArrangement): value is NeighborAssembly {
  if (!record(value) || value.kind !== kind || value.settled !== true || !Array.isArray(value.placements) || value.placements.length !== 3) return false;
  const slots = new Set<string>();
  const points: { x: number; y: number }[] = [];
  for (const point of value.placements) {
    if (!record(point) || !['food', 'cup', 'flowers'].includes(point.slot as string) || slots.has(point.slot as string)
      || !finite(point.x) || !finite(point.y)) return false;
    if (points.some(other => Math.hypot((point.x as number) - other.x, (point.y as number) - other.y) < .18)) return false;
    slots.add(point.slot as string); points.push({ x: point.x, y: point.y });
  }
  return true;
}
export function restoreNeighborState(value: unknown, day: number, residents: readonly (NeighborId | null)[]): NeighborState | undefined {
  if (value === undefined) {
    const state = createNeighborState();
    for (const resident of residents) if (resident) state[resident].current = prepareNeighbor(state[resident], day);
    return state;
  }
  if (!record(value) || Object.keys(value).length !== 2) return;
  const state = createNeighborState();
  for (const resident of ['bea', 'finn'] as const) {
    const raw = value[resident];
    if (!record(raw) || !count(raw.completed, day) || typeof raw.helpReady !== 'boolean' || raw.helpReady && raw.completed === 0
      || !Array.isArray(raw.memories) || raw.memories.length !== Math.min(12, raw.completed)) return;
    const memories: NeighborMemory[] = [];
    for (const [index, item] of raw.memories.entries()) {
      if (!record(item) || !count(item.day, day) || item.day === 0 || !neighborEpisodeIds.includes(item.episode as NeighborEpisodeId)
        || neighborEpisodes[item.episode as NeighborEpisodeId].resident !== resident || !text(item.foodName) || !qualities(item.qualities)
        || item.episode !== episodeFor(resident, raw.completed - raw.memories.length + index + 1)
        || !intentDefinitions[neighborEpisodes[item.episode as NeighborEpisodeId].intentId].requiredQualities.every(quality => (item.qualities as FoodQuality[]).includes(quality)) || item.day <= (memories.at(-1)?.day ?? 0)) return;
      memories.push({ day: item.day, episode: item.episode as NeighborEpisodeId, foodName: item.foodName, qualities: [...item.qualities] });
    }
    let current: NeighborPlan | null = null;
    if (raw.current !== null) {
      const plan = raw.current;
      if (!record(plan) || !count(plan.serial) || plan.serial < 1 || !count(plan.startedOn, day) || plan.startedOn < 1
        || !['preparing', 'joined', 'arranging', 'celebrating', 'remembered'].includes(plan.phase as string)
        || plan.serial !== raw.completed + Number(plan.phase !== 'celebrating' && plan.phase !== 'remembered')) return;
      if (plan.phase === 'preparing' || plan.phase === 'joined') {
        if (plan.food !== null) return;
        current = { serial: plan.serial, startedOn: plan.startedOn, phase: plan.phase, food: null };
      } else {
        const food = plan.food;
        if (!record(food) || !text(food.name) || !validFoodId(food.id) || !qualities(food.qualities)
          || !intentDefinitions[neighborEpisodes[episodeFor(resident, plan.serial)].intentId].requiredQualities.every(quality => (food.qualities as FoodQuality[]).includes(quality))) return;
        if ((plan.phase === 'celebrating' || plan.phase === 'remembered') && (memories.at(-1)?.episode !== episodeFor(resident, plan.serial) || memories.at(-1)?.foodName !== food.name || memories.at(-1)!.day < plan.startedOn)) return;
        current = { serial: plan.serial, startedOn: plan.startedOn, phase: plan.phase as 'arranging' | 'celebrating' | 'remembered', food: { id: food.id, name: food.name, qualities: [...food.qualities] } };
      }
    } else if (raw.completed > 0) return;
    state[resident] = { completed: raw.completed, helpReady: raw.helpReady, current, memories };
  }
  return state;
}
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const count = (value: unknown, max = 1_000_000): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= max;
const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 80 && !/[<>\x00-\x1f]/.test(value);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 1;
const qualities = (value: unknown): value is FoodQuality[] => Array.isArray(value) && value.length > 0 && value.length <= foodQualities.length && new Set(value).size === value.length && value.every(id => foodQualities.includes(id));
const validFoodId = (value: unknown): value is FoodOfferId => typeof value === 'string' && /^(dish:[a-zA-Z]{1,32}|handmade:(round|folded|long)|signature:s[1-9]\d{0,5})$/.test(value);
