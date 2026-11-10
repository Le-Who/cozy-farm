import { orchardIslandIds, type FarmState, type OrchardIslandId, type TreeId } from './farm.ts';

type FruitSource = { island: OrchardIslandId; slot: number; kind: 'pick' | 'grow' | 'return' | 'plant' | 'space' };

/** Locate real trees before proposing purchases, including trees moved between orchards. */
export function getFruitSource(farm: FarmState, fruit: TreeId): FruitSource {
  const preferred = farm.island === 'grove' && farm.boatOwned ? 'grove' : 'home';
  const reachable: OrchardIslandId[] = preferred === 'grove' ? ['grove', 'home'] : farm.boatOwned ? ['home', 'grove'] : ['home'];
  for (const kind of ['pick', 'grow'] as const) {
    for (const island of reachable) {
      const slot = farm.trees[island].findIndex(tree => tree?.tree === fruit && (kind === 'grow' || tree.fruitReady > 0));
      if (slot >= 0) return { island, slot, kind };
    }
  }
  const stored = farm.treeNursery.some(entry => entry.tree.tree === fruit);
  // Preserve access guidance for the starter pear tree until the boat is owned.
  if (!stored && farm.saplings[fruit] === 0) {
    for (const island of orchardIslandIds.filter(island => !reachable.includes(island))) {
      const slot = farm.trees[island].findIndex(tree => tree?.tree === fruit);
      if (slot >= 0) return { island, slot, kind: farm.trees[island][slot]!.fruitReady > 0 ? 'pick' : 'grow' };
    }
  }
  for (const island of reachable) {
    const slot = farm.trees[island].findIndex(tree => tree === null);
    if (slot >= 0) return { island, slot, kind: stored ? 'return' : 'plant' };
  }
  return { island: preferred, slot: 0, kind: 'space' };
}
