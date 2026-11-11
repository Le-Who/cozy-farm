/** New releases must not let older JavaScript write their save format. */
export const publishedFarmSaveKeys = {
  primary: 'cozy-farm-island-v2',
  legacy: 'cozy-farm-island-v1',
  journal: 'cozy-farm-island-v2-migration',
  lock: 'cozy-farm-island-v2-write',
} as const

/** Recovery build: keep new kitchen progress separate from already-open published tabs. */
export const farmSaveKeys = {
  primary: 'cozy-farm-island-v3',
  legacy: publishedFarmSaveKeys.primary,
  journal: 'cozy-farm-island-v3-migration',
  lock: 'cozy-farm-island-v3-write',
  legacyFallback: { key: publishedFarmSaveKeys.legacy, journal: publishedFarmSaveKeys.journal },
} as const
