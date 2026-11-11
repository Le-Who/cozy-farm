import { getEggUnpackAction, type FarmState } from './farm.ts'

/** Ordinary eggs already held in a package; finding them never opens it. */
export function getPackedEggSource(farm: FarmState, needed: number) {
  if (!Number.isSafeInteger(needed) || needed < 1 || farm.eggs >= needed || farm.eggsReady > 0) return undefined
  // The contents travel with the player, but the existing unpack action is home-only.
  const atHome = { ...farm, island: 'home' as const }
  for (const kind of ['basket', 'crate'] as const) {
    const action = getEggUnpackAction(atHome, kind)
    if (action.available) return { kind, eggs: action.eggs, action: kind === 'basket' ? 'unpack-egg-basket' : 'unpack-egg-crate' }
  }
  return undefined
}
