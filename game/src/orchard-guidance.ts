import { orchardIslandIds, treeDefinitions, type FarmState, type OrchardIslandId, type TreeId, type TreeSlot } from './farm.ts';
import { ruCount } from './ru.ts';

type FruitSource = { island: OrchardIslandId; slot: number; kind: 'pick' | 'grow' | 'return' | 'plant' | 'space'; nights?: number; nurseryId?: number };

/** Planted trees grow once per rest; an empty adult refills on the next morning. */
export function nightsToFruit(tree: TreeSlot): number {
  return tree.fruitReady > 0 ? 0 : Math.max(1, treeDefinitions[tree.tree].days - tree.age);
}

export function nurseryFruitDetail(tree: TreeSlot): string {
  if (tree.fruitReady > 0) return `Плодов к сбору: ${tree.fruitReady}. Можно собрать сразу после возврата.`;
  const nights = nightsToFruit(tree);
  return nights === 1 ? 'После возврата в сад: плоды следующим утром.' : `После возврата в сад: ${ruCount(nights, 'ночь', 'ночи', 'ночей')} до плодов.`;
}

/** Locate the nearest harvest without buying or moving anything on the player's behalf. */
export function getFruitSource(farm: FarmState, fruit: TreeId): FruitSource {
  const preferred = farm.island === 'grove' && farm.boatOwned ? 'grove' : 'home';
  const reachable: OrchardIslandId[] = preferred === 'grove' ? ['grove', 'home'] : farm.boatOwned ? ['home', 'grove'] : ['home'];
  const planted = reachable.flatMap(island => farm.trees[island].flatMap((tree, slot) => tree?.tree === fruit
    ? [{ island, slot, nights: nightsToFruit(tree) }] : [])).sort((a, b) => a.nights - b.nights);
  const best = planted[0];
  if (best?.nights === 0) return { ...best, kind: 'pick' };
  const stored = farm.treeNursery.filter(entry => entry.tree.tree === fruit)
    .map(entry => ({ nurseryId: entry.id, nights: nightsToFruit(entry.tree) })).sort((a, b) => a.nights - b.nights)[0];
  const space = reachable.flatMap(island => {
    const slot = farm.trees[island].findIndex(tree => tree === null);
    return slot >= 0 ? [{ island, slot }] : [];
  })[0];
  // Ripe stored fruit can be collected today after the player explicitly frees a slot.
  if (stored?.nights === 0 && !space) return { island: preferred, slot: 0, kind: 'space' };
  // Prefer an already planted tree on ties. A paused tree needs a reachable free slot.
  if (stored && space && (!best || stored.nights < best.nights)) return { ...space, ...stored, kind: 'return' };
  if (best) return { ...best, kind: 'grow' };
  // Preserve access guidance for the starter pear tree until the boat is owned.
  if (!stored && farm.saplings[fruit] === 0) {
    for (const island of orchardIslandIds.filter(island => !reachable.includes(island))) {
      const slot = farm.trees[island].findIndex(tree => tree?.tree === fruit);
      if (slot >= 0) return { island, slot, kind: farm.trees[island][slot]!.fruitReady > 0 ? 'pick' : 'grow', nights: nightsToFruit(farm.trees[island][slot]!) };
    }
  }
  if (space) return { ...space, kind: 'plant' };
  return { island: preferred, slot: 0, kind: 'space' };
}
