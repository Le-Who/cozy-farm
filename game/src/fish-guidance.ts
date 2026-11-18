import { getCoveHabitat, getFishAction, type FarmState, type FishId, type OrchardIslandId } from './farm.ts';
import { hasLanternfishDepth } from './fishing-model.ts';

const deepGrove = (farm: FarmState) => hasLanternfishDepth(getCoveHabitat({...farm,island:'grove'}));

export function rareFishClue(fish: FishId, farm?: FarmState): string | undefined {
  if (fish !== 'moonfish' && fish !== 'lanternfish') return undefined;
  if (fish === 'lanternfish' && farm && !deepGrove(farm)) return 'Рыба-фонарь может встретиться глубже 100 м у Родного острова. В тихой заводи для неё слишком мелко. Улов не гарантирован.';
  return `${fish === 'moonfish' ? 'Лунная рыба' : 'Рыба-фонарь'} может встретиться ${fish === 'moonfish' ? 'на глубине примерно 75–100 м' : 'глубже 100 м'} у Родного острова и в Солёной роще. Улов не гарантирован.`;
}

/** Rare species depend on depth, not the common species assigned to a shore. */
export function getFishSource(farm: FarmState, fish: FishId): OrchardIslandId {
  if (fish === 'perch') {
    if (!farm.boatOwned || getFishAction({...farm,island:'home'}).available) return 'home';
    const grove={...farm,island:'grove' as const};
    return getFishAction(grove).available && (getCoveHabitat(grove)?.perchWeight ?? 0)>0 ? 'grove' : 'home';
  }
  if (fish === 'seaBass') return 'grove';
  if (fish === 'lanternfish' && !deepGrove(farm)) return 'home';
  const preferred = farm.island === 'grove' && farm.boatOwned ? 'grove' : 'home';
  const reachable: OrchardIslandId[] = preferred === 'grove' ? ['grove', 'home'] : farm.boatOwned ? ['home', 'grove'] : ['home'];
  return reachable.find(island => getFishAction({ ...farm, island }).available) ?? preferred;
}
