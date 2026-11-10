/** New releases must not let older JavaScript write their save format. */
export const farmSaveKeys = {
  primary: 'cozy-farm-island-v2',
  legacy: 'cozy-farm-island-v1',
  journal: 'cozy-farm-island-v2-migration',
  lock: 'cozy-farm-island-v2-write',
} as const
