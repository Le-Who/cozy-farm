/** New releases must not let older JavaScript write their save format. */
export const publishedFarmSaveKeys = {
  primary: 'cozy-farm-island-v2',
  legacy: 'cozy-farm-island-v1',
  journal: 'cozy-farm-island-v2-migration',
  lock: 'cozy-farm-island-v2-write',
} as const

/** Recovery build: keep new kitchen progress separate from already-open published tabs. */
export const recoveredFarmSaveKeys = {
  primary: 'cozy-farm-island-v3',
  legacy: publishedFarmSaveKeys.primary,
  journal: 'cozy-farm-island-v3-migration',
  lock: 'cozy-farm-island-v3-write',
  legacyFallback: { key: publishedFarmSaveKeys.legacy, journal: publishedFarmSaveKeys.journal },
} as const

/** Orders hold real portions: already-open v3 code must never erase their ledger. */
export const commissionFarmSaveKeys = {
  primary: 'cozy-farm-island-v4',
  legacy: recoveredFarmSaveKeys.primary,
  journal: 'cozy-farm-island-v4-migration',
  lock: 'cozy-farm-island-v4-write',
  legacyFallback: { key: publishedFarmSaveKeys.primary, journal: recoveredFarmSaveKeys.journal,
    fallback: { key: publishedFarmSaveKeys.legacy, journal: publishedFarmSaveKeys.journal } },
} as const

/** Individual friendships must survive writes from already-open v4 tabs. */
export const farmSaveKeys = {
  primary: 'cozy-farm-island-v5',
  legacy: commissionFarmSaveKeys.primary,
  journal: 'cozy-farm-island-v5-migration',
  lock: 'cozy-farm-island-v5-write',
  legacyFallback: { key: recoveredFarmSaveKeys.primary, journal: commissionFarmSaveKeys.journal,
    fallback: commissionFarmSaveKeys.legacyFallback },
} as const
