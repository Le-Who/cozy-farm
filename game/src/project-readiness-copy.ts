import type { getProject } from './farm.ts'

/** Copy only: available is the canonical capped contribution, not total stock. */
export function projectContributionCopy({ item, delivered, available }: ReturnType<typeof getProject>['items'][number]) {
  return { delivered: `Внесено: ${delivered}/${item.quantity}`, available: `Можно внести: ${available}` }
}
export function projectLevelCopy(level: number) { return `Ур. ${level}${level < 2 ? ' → 2' : ''}` }
export function projectRewardLabel(status: ReturnType<typeof getProject>['status']) { return status === 'completed' ? 'Получено' : 'Награда' }
