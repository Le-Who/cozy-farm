import { fishDefinitions, getSignatureStock, getVillageMeal, type FarmState } from './farm.ts'
import { ruCount } from './ru.ts'
import type { SignatureRecipe } from './culinary.ts'

const escape = (text: string) => text.replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!))

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
