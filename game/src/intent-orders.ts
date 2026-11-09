import type { CookeryResult, SignatureProcessing, SignatureIngredient } from './culinary.ts';

export const foodQualities = ['berry', 'fruit', 'delicate', 'hearty', 'portable', 'sharing', 'sweet', 'savoury'] as const;
export type FoodQuality = typeof foodQualities[number];
export type FoodOfferId = `dish:${string}` | `handmade:${string}` | `signature:${string}`;
export type FoodDescriptor = {
  id: FoodOfferId; name: string; source: 'dish' | 'handmade' | 'signature';
  identity: string; ingredients: readonly string[]; processing?: SignatureProcessing;
  recipeIngredients?: readonly SignatureIngredient[]; preparation?: CookeryResult; count: number; sellPrice: number;
};
export const qualityNames: Record<FoodQuality, string> = {
  berry: 'С ягодами', fruit: 'С фруктами', delicate: 'Нежное',
  hearty: 'Сытное', portable: 'Удобно взять с собой', sharing: 'К общему столу',
  sweet: 'Сладкое', savoury: 'Несладкое',
};
export const intentIds = ['berry', 'fruit', 'delicate', 'hearty', 'portable', 'sharing'] as const;
export type IntentId = typeof intentIds[number];
export const intentDefinitions: Record<IntentId, { title: string; request: string; requiredQualities: readonly [FoodQuality, FoodQuality] }> = {
  berry: { title: 'Ягодное угощение', request: 'Нужно ягодное угощение, которым удобно поделиться за столом.', requiredQualities: ['berry', 'sharing'] },
  fruit: { title: 'Садовый пикник', request: 'Возьмём садовые фрукты в пироге или баночке: угощение должно переносить дорогу.', requiredQualities: ['fruit', 'portable'] },
  delicate: { title: 'Нежное к чаю', request: 'Хочется сладкого с нежной текстурой. Подойдут мягкий десерт или гладкий конфитюр.', requiredQualities: ['delicate', 'sweet'] },
  hearty: { title: 'Сытный перерыв', request: 'Нужно сытное несладкое блюдо для обеденного перерыва.', requiredQualities: ['hearty', 'savoury'] },
  portable: { title: 'В дорогу', request: 'Принесите сытное угощение, которое удобно взять с собой.', requiredQualities: ['portable', 'hearty'] },
  sharing: { title: 'Для всех за столом', request: 'Нужно сладкое угощение, которым удобно поделиться с соседями.', requiredQualities: ['sharing', 'sweet'] },
};

// Identity describes the actual recipe/shape. Player-provided names never affect eligibility.
export function describeFood(food: FoodDescriptor): FoodQuality[] {
  const qualities = new Set<FoodQuality>();
  if (food.ingredients.some(id => ['strawberry', 'blueberry', 'raspberry'].includes(id))) qualities.add('berry');
  if (food.ingredients.some(id => ['apple', 'pear', 'peach'].includes(id))) qualities.add('fruit');
  const tart = food.identity === 'tart' || food.identity.endsWith('Tart');
  const bread = food.source === 'handmade' || ['farmhouseBread', 'honeyCake', 'honeyBiscuits'].includes(food.identity);
  const sweet = qualities.has('berry') || qualities.has('fruit') || food.ingredients.some(id => id === 'honey' || id === 'windHoney');
  qualities.add(sweet ? 'sweet' : 'savoury');
  const creamTart = food.source === 'signature' && food.identity === 'tart' || food.source === 'dish' && ['strawberryTart', 'blueberryTart', 'raspberryTart'].includes(food.identity);
  if (creamTart || food.processing === 'silky' || ['honeyPear', 'windParfait', 'honeyCake'].includes(food.identity) || food.source === 'handmade' && food.identity === 'folded') qualities.add('delicate');
  if (tart || bread || food.identity === 'grilledFish') qualities.add('hearty');
  if (tart || bread || food.identity === 'preserves' || ['appleJam', 'orchardPreserves'].includes(food.identity)) qualities.add('portable');
  if (tart || ['farmhouseBread', 'honeyCake', 'honeyBiscuits'].includes(food.identity) || food.source === 'handmade' && food.identity === 'long') qualities.add('sharing');
  return foodQualities.filter(quality => qualities.has(quality));
}

export type IntentOffer = FoodDescriptor & { qualities: FoodQuality[]; chips: string[]; requiredQualities: readonly FoodQuality[]; requestChips: string[]; matchedQualities: FoodQuality[]; matchCount: number; eligible: boolean; available: boolean; reward: number };
export function evaluateFood(food: FoodDescriptor, intent: IntentId): IntentOffer {
  const qualities = describeFood(food), requiredQualities = intentDefinitions[intent].requiredQualities;
  const matchedQualities = requiredQualities.filter(quality => qualities.includes(quality)), eligible = matchedQualities.length === requiredQualities.length;
  return { ...food, qualities, chips: qualities.map(quality => qualityNames[quality]), requiredQualities: [...requiredQualities], requestChips: requiredQualities.map(quality => qualityNames[quality]), matchedQualities, matchCount: matchedQualities.length, eligible, available: eligible && food.count > 0, reward: food.sellPrice + 12 };
}
export type IntentOrderState = Record<IntentId, { completed: number; deliveredOn: number }>;
export function createIntentOrders(): IntentOrderState {
  return Object.fromEntries(intentIds.map(id => [id, { completed: 0, deliveredOn: 0 }])) as IntentOrderState;
}
export function currentIntentIds(day: number): IntentId[] {
  return [0, 2, 4].map(offset => intentIds[(day - 1 + offset) % intentIds.length]);
}
export function restoreIntentOrders(value: unknown, day: number): IntentOrderState | undefined {
  if (value === undefined) return createIntentOrders();
  if (!record(value) || Object.keys(value).length !== intentIds.length) return;
  const restored = createIntentOrders();
  for (const id of intentIds) {
    const entry = value[id];
    if (!record(entry) || !count(entry.completed) || !count(entry.deliveredOn, day)
      || entry.completed > entry.deliveredOn || (entry.completed === 0) !== (entry.deliveredOn === 0)) return;
    restored[id] = { completed: entry.completed, deliveredOn: entry.deliveredOn };
  }
  return restored;
}
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const count = (value: unknown, max = 1_000_000): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= max;
