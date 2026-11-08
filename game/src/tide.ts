import { dayRoll } from './climate.ts';

export const shellIds = ['regular', 'moon'] as const;
export type ShellId = typeof shellIds[number];
export const shellSpotCount = 3;
export const shellDefinitions = {
  regular: { name: 'Seashell', icon: 'ui-shell', price: 3, luminous: false },
  moon: { name: 'Moon shell', icon: 'ui-moon-shell', price: 12, luminous: true },
};

export function isLunarTide(day: number): boolean {
  return day >= 6 && (day - 6) % 5 === 0;
}

export function shellForSpot(day: number, spot: number): ShellId {
  return isLunarTide(day) && dayRoll(day, 300 + spot) < 30 ? 'moon' : 'regular';
}
