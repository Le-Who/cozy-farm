import { cropDefinitions, type CropId, type FarmState } from './farm.ts'
import { getClimate, type Weather } from './climate.ts'

type RestBed = { index: number; crop: CropId }
export type RestPreview = {
  day: number; weather: Weather;
  ripening: RestBed[]; growing: RestBed[]; dry: RestBed[]; ready: RestBed[];
}

/** Only already-watered beds grow tonight. Tomorrow's rain waters them afterwards. */
export function getRestPreview(farm: Pick<FarmState, 'day' | 'beds'>): RestPreview {
  const day = farm.day + 1
  const preview: RestPreview = { day, weather: getClimate(day).weather, ripening: [], growing: [], dry: [], ready: [] }
  for (const [index, bed] of farm.beds.entries()) {
    if (bed.kind !== 'crop') continue
    const maturity = cropDefinitions[bed.crop].days
    const group = bed.growth >= maturity ? preview.ready : !bed.watered ? preview.dry
      : bed.growth + 1 >= maturity ? preview.ripening : preview.growing
    group.push({ index, crop: bed.crop })
  }
  return preview
}

/** A stale confirmation can never spend another night after a redraw or reload. */
export function canConfirmRest(farm: Pick<FarmState, 'island' | 'day'>, expectedDay: string | undefined): boolean {
  return farm.island === 'home' && expectedDay === String(farm.day)
}
