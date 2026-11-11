import type { FarmState } from './farm.ts';

/** Derived from existing communal suppers, never a second progression ledger. */
export function villageHomeStage(farm: Pick<FarmState, 'village'>): 0 | 1 | 2 {
  return farm.village.built ? Math.min(2, farm.village.meals) as 0 | 1 | 2 : 0;
}

// Source pixels of the accepted 1586×992 village plate. The finished house is
// still the original artwork. Only this small plot receives an authored patch.
export const villageHomePatch = { x: 995, y: 48, w: 342, h: 310 } as const;
export const villageHomeStages = [
  { key: 'village-home-frame', path: 'lavender/village-home-frame' },
  { key: 'village-home-finishing', path: 'lavender/village-home-finishing' },
] as const;

export function villageHomeArtKey(farm: Pick<FarmState, 'village'>): string {
  const stage = villageHomeStage(farm);
  return stage === 2 ? 'village-plate' : villageHomeStages[stage].key;
}

export function villageHomeProgress(farm: Pick<FarmState, 'village'>): string {
  const stage = villageHomeStage(farm);
  return stage === 2 ? 'Домик готов' : `${stage === 0 ? 'Каркас' : 'Отделка'} · общие ужины ${stage}/2`;
}

/** Cache owned by one scene. The roof opening must erase the finished roof,
 * not alpha-overlay it. A local replacement also preserves every other pixel
 * of the accepted island. Canvas is immutable after its first texture upload. */
export function createVillageHomePlates() {
  const plates = new Map<HTMLImageElement, HTMLCanvasElement>();
  return (base: HTMLImageElement, patch?: HTMLImageElement): HTMLImageElement | HTMLCanvasElement => {
    // A delayed/failed optional art request must never remove the whole island.
    // Keep the original readable world; accessible stage labels remain exact.
    if (!patch) return base;
    const cached = plates.get(patch);
    if (cached) return cached;
    const plate = document.createElement('canvas');
    plate.width = base.naturalWidth; plate.height = base.naturalHeight;
    const context = plate.getContext('2d')!;
    context.drawImage(base, 0, 0);
    const { x, y, w, h } = villageHomePatch;
    context.clearRect(x, y, w, h);
    context.drawImage(patch, x, y);
    plates.set(patch, plate);
    return plate;
  };
}
