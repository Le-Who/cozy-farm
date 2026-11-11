import { cropDefinitions, type CropId, type FarmState } from './farm.ts';

/** Fewest growth steps with ordinary explicit care, not a promise to grow without watering. */
export function getNextHarvestBed(farm: Pick<FarmState,'beds'>, crop?: CropId): number | undefined {
  const candidates=farm.beds.flatMap((bed,index)=>bed.kind==='crop'&&(!crop||bed.crop===crop)
    ? [{index,remaining:Math.max(0,cropDefinitions[bed.crop].days-bed.growth),watered:bed.watered}] : []);
  candidates.sort((a,b)=>a.remaining-b.remaining || Number(b.watered)-Number(a.watered) || a.index-b.index);
  return candidates[0]?.index;
}

export function getNextCropBed(farm: Pick<FarmState,'beds'>, crop: CropId): number | undefined {
  return getNextHarvestBed(farm,crop);
}
