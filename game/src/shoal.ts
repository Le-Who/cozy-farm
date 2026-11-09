import { dayRoll } from './climate.ts';
import { isLunarTide, shellIds, type ShellId } from './tide.ts';

export const shoalFindIds = ['glass', 'pearl'] as const;
export type ShoalFindId = typeof shoalFindIds[number];

export const shoalDefinitions = {
  glass: { name: 'Морское стекло', icon: 'ui-sea-glass', price: 5, luminous: false },
  pearl: { name: 'Лунная жемчужина', icon: 'ui-moon-pearl', price: 18, luminous: true },
};

export function hasShoal(farm: { shellDiscoveries: readonly ShellId[] }): boolean {
  return shellIds.every((id) => farm.shellDiscoveries.includes(id));
}

export function getShoalFindAt(
  farm: { day: number; shellDiscoveries: readonly ShellId[]; shoalCollectedToday: readonly ShoalFindId[] },
  id: ShoalFindId,
): ShoalFindId | undefined {
  if (!hasShoal(farm) || farm.shoalCollectedToday.includes(id)) return undefined;
  if (id === 'glass' || id === 'pearl' && isLunarTide(farm.day) && ((farm.day - 6) % 10 === 5 || dayRoll(farm.day, 340) < 65)) return id;
  return undefined;
}
