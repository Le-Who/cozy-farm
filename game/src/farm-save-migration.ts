import { restoreFarm, type FarmState } from './farm.ts'
import { visitFarmSaveKeys, friendshipFarmSaveKeys, commissionFarmSaveKeys, recoveredFarmSaveKeys, publishedFarmSaveKeys } from './farm-save-keys.ts'

/** The source generation decides which missing ledgers are legacy, not the bytes themselves. */
export function restoreLegacyFarm(value: unknown, sourceKey: string): FarmState | undefined {
  if (sourceKey === visitFarmSaveKeys.primary) {
    if (!value || typeof value !== 'object' || ['shopCommissions', 'henFriendship', 'neighborVisits'].some(key => !Object.hasOwn(value, key) || (value as Record<string, unknown>)[key] === undefined)) return
  } else if (sourceKey === friendshipFarmSaveKeys.primary) {
    if (!value || typeof value !== 'object' || !Object.hasOwn(value, 'shopCommissions') || !('shopCommissions' in value) || value.shopCommissions === undefined
      || !Object.hasOwn(value, 'henFriendship') || !('henFriendship' in value) || value.henFriendship === undefined) return
  } else if (sourceKey === commissionFarmSaveKeys.primary) {
    // v4 already owns real portions in escrow. Losing its ledger is corruption.
    if (!value || typeof value !== 'object' || !Object.hasOwn(value, 'shopCommissions')
      || !('shopCommissions' in value) || value.shopCommissions === undefined) return
  } else if (sourceKey !== recoveredFarmSaveKeys.primary && sourceKey !== publishedFarmSaveKeys.primary
    && sourceKey !== publishedFarmSaveKeys.legacy) return
  return restoreFarm(value)
}
