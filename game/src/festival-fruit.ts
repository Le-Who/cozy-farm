import {traitIds, type Trait} from './climate.ts';
import {traitLabel} from './ru.ts';
import type {TreeId} from './farm.ts';

export type FestivalFruit = { item: TreeId; trait: Trait };
export const festivalFruitArt = {
  apple: { name:'яблоко', icon:'apple', path:'icons/apple' },
  pear: { name:'груша', icon:'ui-pear', path:'lavender/ui-pear' },
  peach: { name:'персик', icon:'ui-peach-fruit', path:'lavender/ui-peach-fruit' },
} satisfies Record<TreeId,{name:string;icon:string;path:string}>;

export function festivalFruitLabel(fruit:FestivalFruit): string {
  return `${traitLabel(fruit.trait,fruit.item)} ${festivalFruitArt[fruit.item].name}`;
}

export function isFestivalFruit(value:unknown):value is FestivalFruit {
  if (!value || typeof value !== 'object') return false;
  const fruit=value as Partial<FestivalFruit>;
  return typeof fruit.item==='string' && Object.hasOwn(festivalFruitArt,fruit.item)
    && traitIds.some(trait=>trait===fruit.trait);
}
