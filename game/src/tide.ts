import { dayRoll } from './climate.ts';

export const shellIds = ['regular', 'moon'] as const;
export type ShellId = typeof shellIds[number];
export const shellSpotCount = 3;
export const shellDefinitions = {
  regular: { name: 'Ракушка', icon: 'ui-shell', price: 3, luminous: false },
  moon: { name: 'Лунная ракушка', icon: 'ui-moon-shell', price: 12, luminous: true },
};

export function isLunarTide(day: number): boolean {
  return day >= 6 && (day - 6) % 5 === 0;
}

export function shellForSpot(day: number, spot: number): ShellId {
  if (!isLunarTide(day)) return 'regular';
  const ownRoll = dayRoll(day, 300 + spot);
  if (ownRoll < 30) return 'moon';
  // On an otherwise empty tide the lowest roll glows. Break ties by shore position.
  for (let other = 0; other < shellSpotCount; other++) {
    if (other === spot) continue;
    const roll = dayRoll(day, 300 + other);
    if (roll < ownRoll || roll === ownRoll && other < spot) return 'regular';
  }
  return 'moon';
}
