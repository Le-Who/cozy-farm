import type { DiscoveryTask } from './discovery-path.ts';
import type { DiscoveryPreferences } from './discovery-preferences.ts';

export type GuidanceTask = DiscoveryTask & { bookmarkOnly?: boolean };

/** Current rewards and actions are derived again; an old bookmark can only open the journal. */
export function getGuidanceTask(preferences: DiscoveryPreferences, current: DiscoveryTask | undefined): GuidanceTask | undefined {
  if (preferences.quiet) return undefined;
  if (!preferences.idea) return current;
  if (current?.id === preferences.idea.id) return current;
  return {
    ...preferences.idea, icon: 'star', progress: 0, target: 1, bookmarkOnly: true,
    action: { label: 'К своей задумке', target: 'open-panel', value: 'journal' },
  };
}
