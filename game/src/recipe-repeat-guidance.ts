import { getSignatureAction, ingredientCount, type FarmState, type StockItem } from './farm.ts'

/** Uses the exact saved draft; guidance never substitutes a fruit, trait, or recipe. */
export function getRecipeRepeatGuide(farm: FarmState, id: string) {
  const recipe = farm.culinary.recipes.find(recipe => recipe.id === id)
  if (!recipe) return undefined
  const action = getSignatureAction(farm, recipe)
  const away = farm.island !== 'home' && !(farm.island === 'village' && farm.village.built)
  return {
    id: recipe.id, ...action, away,
    missing: action.items.filter(item => ingredientCount(farm, item) < item.quantity),
  }
}

export function renderRecipeRepeatGuide(farm: FarmState, id: string, stock: (item: StockItem) => string, expanded = false): string {
  const guide = getRecipeRepeatGuide(farm, id)
  if (!guide) return ''
  return `<section class="recipe-repeat-guide" aria-label="Точный повтор рецепта">
    ${!guide.available ? `<p class="recipe-repeat-reason">${guide.label}</p>` : ''}
    <details data-repeat-guide="${id}"${expanded ? ' open' : ''}><summary>Для точного повтора ×1</summary>
      <ul class="ingredients">${guide.items.map(stock).join('')}</ul>
      <p class="recipe-repeat-note">Тот же состав, особенности и оформление. Для партии ×3 нужно втрое больше каждого ингредиента.</p>
    </details>
    ${guide.away ? `<button type="button" class="dialog-button" data-action="recipe-repeat-home" data-value="${id}">На домашнюю кухню</button>` : ''}
  </section>`
}
