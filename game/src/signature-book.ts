import { signatureRecipeLimit, type CulinaryState } from './culinary.ts'

/** Capacity applies only to new manual variants, never to an exact saved repeat. */
export function signatureBookCapacity(culinary: Pick<CulinaryState, 'recipes' | 'serial'>) {
  const full = culinary.recipes.length >= signatureRecipeLimit
  const exhausted = culinary.serial >= 999999
  return {
    canCreate: !full && !exhausted,
    count: culinary.recipes.length,
    limit: signatureRecipeLimit,
    message: exhausted
      ? 'Новые номера рецептов закончились. Можно повторять сохранённые рецепты и готовить обычные блюда.'
      : full
        ? 'Книга заполнена. Выберите блюдо без порций, звёздочки и активного заказа. Нажмите «Удалить пустой рецепт». Повторы ×1 и ×3 не требуют места.'
        : '',
  }
}
