import { canSailTo, fishDefinitions, getFishAction, getSignatureStock, getVillageHomeCount, getVillageMeal, orchardIslandIds, type FarmState } from './farm.ts'
import { getFishSource } from './fish-guidance.ts'
import { getLocalWarehouseSupply } from './warehouse-guidance.ts'
import { ruCount } from './ru.ts'
import type { SignatureRecipe } from './culinary.ts'

const escape = (text: string) => text.replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!))

const supperFishItem = (item: 'perch' | 'seaBass') => ({ kind: 'fish', item, quantity: 1 } as const)

/** One ordinary fish is interchangeable at supper; a charter's exact fish are not. */
export function getSupperFishRecovery(farm: FarmState) {
  const preferred = getVillageMeal(farm).fish
  for (const fish of [preferred, preferred === 'perch' ? 'seaBass' : 'perch'] as const) {
    const item = supperFishItem(fish)
    if (getLocalWarehouseSupply(farm, item)) return { kind: 'warehouse', item } as const
  }
  const shore = orchardIslandIds.find(island => island === farm.island && getFishAction(farm).available)
    ?? [getFishSource(farm, preferred), ...orchardIslandIds].find(island =>
      canSailTo(farm, island) && getFishAction({ ...farm, island }).available)
  return shore ? { kind: 'shore', shore, item: supperFishItem(shore === 'home' ? 'perch' : 'seaBass') } as const
    : { kind: 'rest' } as const
}

/** Existing signature supper rules, exposed without reserving or spending anything. */
export function getReadySignatureSuppers(farm: FarmState) {
  const meal = getVillageMeal(farm)
  const available = farm.island === 'village' && farm.village.built && !meal.served && farm.fish[meal.fish] >= 1
    && Number.isSafeInteger(farm.workToday + 1) && Number.isSafeInteger(farm.village.meals + 1)
  return getSignatureStock(farm).filter(({ count }) => count > 0).map(({ recipe, count }) => ({ recipe, count, fish: meal.fish, available }))
}

export function renderSignatureSuppers(farm: FarmState, picture: (recipe: SignatureRecipe) => string): string {
  if (!farm.village.built || getVillageMeal(farm).served) return ''
  const choices = getReadySignatureSuppers(farm)
  if (!choices.length) return ''
  return `<section class="shared-supper-recipes" aria-label="Готовые блюда к ужину"><h2>Готовое блюдо вместо выпечки</h2>
    <div class="shared-supper-choices">${choices.map(({recipe,count,fish,available}) => `<button type="button" class="shared-supper-choice" data-action="supper-signature" data-value="${escape(recipe.id)}" ${available?'':'disabled'} aria-label="Подать ${escape(recipe.name)}. Расход: 1 порция и 1 рыба — ${fishDefinitions[fish].name.toLowerCase()}. В запасе: ${ruCount(count, 'порция', 'порции', 'порций')}.">
      <span class="shared-supper-picture" aria-hidden="true">${picture(recipe)}</span><strong>${escape(recipe.name)}</strong><span>В запасе: ×${count}</span><small>Подать 1 порцию</small>
    </button>`).join('')}</div></section>`
}

/** A shared table can point at a free house. Opening it is never an invitation. */
export function supperCottageReady(farm: FarmState): boolean {
  return farm.island === 'village' && getVillageMeal(farm).served && getVillageHomeCount(farm) === 2 && !farm.village.residents[1]
}

export function renderSupperResult(farm: FarmState, cottageArt: string, homeButton: string): string {
  if (farm.island !== 'village' || !getVillageMeal(farm).served) return ''
  if (farm.village.meals === 1) return `<p class="dialog-status" tabindex="-1" data-supper-result>До второго домика: 1 из 2 ужинов. Следующий ужин завтра.</p>${homeButton}`
  if (!supperCottageReady(farm)) return `<p class="dialog-status">Сегодня общий ужин уже состоялся. Следующий ужин завтра.</p>${homeButton}`
  return `<section class="supper-result"><div class="supper-result-head"><span aria-hidden="true">${cottageArt}</span><div><small>Общий ужин состоялся</small><h2 tabindex="-1" data-supper-result>Второй домик свободен</h2></div></div><div class="supper-result-actions"><button type="button" class="dialog-button" data-action="supper-cottage">К домику 2</button>${homeButton}</div></section>`
}
