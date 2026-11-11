import {
  canSailTo, getBedHarvestPreview, ingredientCount, variantLabel,
  type FarmState, type StockItem, type TreeSlot,
} from './farm.ts';

type VariantRequest = Extract<StockItem, {kind:'variants'}>;
export type ReadyVariantSource = {kind:'bed';island:'home';index:number}
  | {kind:'tree';island:'home'|'grove';index:number}
  | {kind:'nest';island:'home'};

/** A stored trait is already known; weather alone never promises a rare harvest. */
export function getReadyVariantSource(farm: FarmState, request: VariantRequest): ReadyVariantSource | undefined {
  if (ingredientCount(farm,request) >= request.quantity) return undefined;
  if (request.item === 'egg') return farm.eggsReady > 0 && farm.eggTrait === request.trait
    ? {kind:'nest',island:'home'} : undefined;
  if (request.item === 'apple' || request.item === 'pear' || request.item === 'peach') {
    const islands = farm.island === 'grove' ? ['grove','home'] as const : ['home','grove'] as const;
    for (const island of islands) {
      if (island === 'grove' && !canSailTo(farm,island)) continue;
      const index = farm.trees[island].findIndex(tree => tree?.tree === request.item && tree.trait === request.trait && tree.fruitReady > 0);
      if (index >= 0) return {kind:'tree',island,index};
    }
    return undefined;
  }
  const home = farm.island === 'home' ? farm : {...farm,island:'home' as const};
  const index = farm.beds.findIndex((_,index) => {
    const harvest = getBedHarvestPreview(home,index);
    return harvest?.crop === request.item && harvest.trait === request.trait && harvest.special > 0;
  });
  return index >= 0 ? {kind:'bed',island:'home',index} : undefined;
}

export function readyVariantNotice(request: VariantRequest): string {
  return `Уже можно собрать: ${variantLabel(request.item,request.trait).name} ×1. Сбор нужно подтвердить отдельно.`;
}

/** The existing harvest yields one special fruit; the rest remain ordinary. */
export function treeVariantCopy(tree: TreeSlot): string {
  if (!tree.trait || !tree.fruitReady) return '';
  return [tree.fruitReady > 1 ? `Обычные плоды ×${tree.fruitReady-1}` : '', `${variantLabel(tree.tree,tree.trait).name} ×1`].filter(Boolean).join(' · ');
}
