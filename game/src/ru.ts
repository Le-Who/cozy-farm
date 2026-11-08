import type { Trait } from './climate.ts';

export function ruPlural(count: number, forms: readonly [string, string, string]): string {
  const value = Math.abs(count);
  if (!Number.isInteger(value)) return forms[1];
  const lastTwo = value % 100, last = value % 10;
  return forms[lastTwo >= 11 && lastTwo <= 14 ? 2 : last === 1 ? 0 : last >= 2 && last <= 4 ? 1 : 2];
}

export function formatRuNumber(value: number): string { return value.toLocaleString('ru-RU'); }

export function ruCount(count: number, ...forms: [string, string, string]): string {
  return `${formatRuNumber(count)} ${ruPlural(count, forms)}`;
}

export function traitLabel(trait: Trait, resource?: string): string {
  const stems: Record<Trait, string> = { dew: 'Росист', frost: 'Морозн', rainbow: 'Радужн', star: 'Звёздн' };
  const feminine = ['carrot', 'cabbage', 'beetroot', 'pumpkin', 'wheat', 'pear', 'strawberry', 'blueberry', 'raspberry'];
  const ending = resource === 'egg' || resource === 'apple' ? 'ое' : resource === 'leafyGreens' ? 'ая' : resource && feminine.includes(resource) ? 'ая' : 'ый';
  return stems[trait] + ending;
}
