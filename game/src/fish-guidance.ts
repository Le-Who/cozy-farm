import { getFishAction, type FarmState, type FishId, type OrchardIslandId } from './farm.ts';

export function rareFishClue(fish: FishId): string | undefined {
  if (fish !== 'moonfish' && fish !== 'lanternfish') return undefined;
  return `${fish === 'moonfish' ? 'Лунная рыба' : 'Рыба-фонарь'} может встретиться ${fish === 'moonfish' ? 'на глубине примерно 75–100 м' : 'глубже 100 м'} у Родного острова и в Солёной роще. Улов не гарантирован.`;
}

/** Rare species depend on depth, not the common species assigned to a shore. */
export function getFishSource(farm: FarmState, fish: FishId): OrchardIslandId {
  if (fish === 'perch') return 'home';
  if (fish === 'seaBass') return 'grove';
  const preferred = farm.island === 'grove' && farm.boatOwned ? 'grove' : 'home';
  const reachable: OrchardIslandId[] = preferred === 'grove' ? ['grove', 'home'] : farm.boatOwned ? ['home', 'grove'] : ['home'];
  return reachable.find(island => getFishAction({ ...farm, island }).available) ?? preferred;
}
