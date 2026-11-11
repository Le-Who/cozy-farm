/** A bookmark, not a quest ledger or a saved executable action. */
export type DiscoveryIdea = { id: string; label: string; detail: string };
export type DiscoveryPreferences = { quiet: boolean; idea: DiscoveryIdea | null };
export const createDiscoveryPreferences = (): DiscoveryPreferences => ({ quiet: false, idea: null });

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function text(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max && !/[\u0000-\u001f\u007f]/.test(value);
}
function copyIdea(value: unknown): DiscoveryIdea | undefined {
  if (!record(value) || !text(value.id, 240) || !text(value.label, 180) || !text(value.detail, 1000)) return;
  return { id: value.id, label: value.label, detail: value.detail };
}
export function restoreDiscoveryPreferences(value: unknown): DiscoveryPreferences | undefined {
  if (value === undefined) return createDiscoveryPreferences();
  if (!record(value) || typeof value.quiet !== 'boolean') return;
  const idea = value.idea === null ? null : copyIdea(value.idea);
  if (idea === undefined) return;
  return { quiet: value.quiet, idea };
}
export function chooseDiscoveryIdea(preferences: DiscoveryPreferences, value: unknown, expectedId: string): boolean {
  const idea = copyIdea(value);
  if (!idea || idea.id !== expectedId) return false;
  preferences.idea = idea;
  return true;
}
export function setDiscoveryPace(preferences: DiscoveryPreferences, quiet: boolean): void { preferences.quiet = quiet; }
export function resumeDiscoveryIdea(preferences: DiscoveryPreferences): boolean {
  if (!preferences.idea) return false;
  preferences.quiet = false;
  return true;
}
export function forgetDiscoveryIdea(preferences: DiscoveryPreferences): void { preferences.idea = null; }
