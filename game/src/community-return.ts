import type { IslandId } from './farm.ts'

/** The HUD prefers a missing recipe, but every other return belongs at the request's shore. */
export function communityReturnRoute(kind: 'neighbor' | 'intent', island: IslandId,
  preferred: 'request' | 'recipe', foodCount?: number) {
  if (preferred === 'recipe' && foodCount === 0) return {
    mode: 'recipe' as const, destination: undefined, travel: false, label: 'К рецепту',
  }
  const destination = kind === 'neighbor' ? 'village' as const : 'home' as const
  const travel = island !== destination
  return {
    mode: 'request' as const, destination, travel,
    label: kind === 'neighbor' ? travel ? 'К встрече в гавани' : 'К встрече'
      : travel ? 'К просьбе домой' : 'К просьбе',
  }
}
