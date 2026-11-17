import { capeDishIds, dishDefinitions, type DishId } from './farm.ts'

export type HoneyKitchenRecipe = typeof capeDishIds[number]
type HoneyKitchenContext = { panel: string | undefined; open: boolean; island: string; capeLevel: number }

/** A read-only menu choice. Cooking and ingredient validation remain in the existing card/handler. */
export function chooseHoneyKitchenRecipe(value: string | undefined, context: HoneyKitchenContext): HoneyKitchenRecipe | undefined {
  if (context.panel !== 'honey-kitchen' || !context.open || context.island !== 'cape' || context.capeLevel < 3) return
  return capeDishIds.find(id => id === value)
}

export function renderHoneyKitchenMenu(selected: HoneyKitchenRecipe, icon: (id: HoneyKitchenRecipe) => string, cards: (ids: readonly DishId[]) => string): string {
  return `<div class="honey-kitchen-menu"><nav class="honey-kitchen-choices" aria-label="Медовая кухня">${capeDishIds.map(id => `<button type="button" class="dialog-button secondary" data-action="honey-kitchen-recipe" data-value="${id}" aria-pressed="${id === selected}" aria-controls="honey-kitchen-selected-recipe">${icon(id)}<span>${dishDefinitions[id].name}</span></button>`).join('')}</nav><div class="honey-kitchen-selected" id="honey-kitchen-selected-recipe">${cards([selected])}</div></div>`
}
