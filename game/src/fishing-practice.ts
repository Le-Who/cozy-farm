import { getFishLimit, getFishingTripConfig, type FarmState } from './farm.ts';

export function canPracticeFishing(farm: FarmState): boolean {
  return (farm.island === 'home' || farm.island === 'grove')
    && farm.fishCaughtToday[farm.island] >= getFishLimit(farm)
    && farm.pendingFishingTrip === null;
}

/** Practice owns no farm reference, reward token or persisted state. */
export function createFishingPractice(farm: FarmState) {
  if (!canPracticeFishing(farm)) return undefined;
  const config = structuredClone(getFishingTripConfig(farm));
  const fish = farm.island === 'grove' ? 'seaBass' as const : 'perch' as const;
  const seed = farm.day * 1009 + (farm.fishingTripSerial + 1) * 9176 + (farm.island === 'grove' ? 71 : 17);
  let phase: 'ready' | 'casting' | 'finished' | 'closed' = 'ready';
  return {
    config, fish, seed,
    cast(): boolean {
      if (phase !== 'ready') return false;
      phase = 'casting';
      return true;
    },
    // Deliberately discard every result, including fish, shells and junk.
    finish(_result: unknown): boolean {
      if (phase !== 'casting') return false;
      phase = 'finished';
      return true;
    },
    cancel(): void { phase = 'closed'; },
  };
}
