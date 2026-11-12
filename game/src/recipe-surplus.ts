import { getMarketBasket, getSignatureAction, ingredientCount, marketKey, sellMarketBasket, unitPrice, type ActionResult, type FarmState } from './farm.ts'

/** Keep only the exact ingredients for a chosen repeat; no goods are reserved by this view. */
export function recipeSurplusQuote(farm: FarmState, recipeId: string, quantity: 1 | 3) {
  if (farm.island !== 'home' || (quantity !== 1 && quantity !== 3)) return undefined
  const recipe = farm.culinary.recipes.find(recipe => recipe.id === recipeId)
  if (!recipe) return undefined
  const ingredients = getSignatureAction(farm, recipe).items
  if (!ingredients.length) return undefined
  const lines = ingredients.map(ingredient => {
    const item = { ...ingredient, quantity: ingredient.quantity * quantity }
    const stock = ingredientCount(farm, item), required = item.quantity, price = unitPrice(item, farm)
    const kept = Math.min(stock, required), sell = Math.max(0, stock - required), missing = Math.max(0, required - stock)
    return { item, key: marketKey(item), stock, required, kept, sell, missing, price, total: sell * price }
  })
  const items = lines.reduce((sum, line) => sum + line.sell, 0)
  const total = lines.reduce((sum, line) => sum + line.total, 0)
  if (lines.some(line => !Number.isSafeInteger(line.stock) || line.stock < 0 || !Number.isSafeInteger(line.total))
    || !Number.isSafeInteger(items) || !Number.isSafeInteger(total)) return undefined
  const basket = items ? getMarketBasket(farm, lines.filter(line => line.sell > 0).map(line => ({ key: line.key, quantity: line.sell }))) : undefined
  if (items && !basket) return undefined
  const token = `rs1;${recipe.id};${quantity};${JSON.stringify([recipe, farm.day, farm.workToday, farm.progress.sell, farm.coins,
    lines.map(line => [line.key, line.stock, line.required, line.price]), basket?.token ?? null])}`
  return { recipeId, recipeName: recipe.name, quantity, lines, items, total,
    missing: lines.reduce((sum, line) => sum + line.missing, 0), token }
}

/** Re-read both the saved recipe and every ingredient stock before one atomic sale. */
export function sellRecipeSurplus(farm: FarmState, token: unknown): ActionResult {
  const stale = (): ActionResult => ({ ok: false, message: 'Рецепт или запасы изменились. Проверьте излишки заново.' })
  if (typeof token !== 'string' || token.length > 100_000) return stale()
  const head = /^rs1;(s[1-9]\d{0,5});(1|3);/.exec(token)
  if (!head) return stale()
  const quote = recipeSurplusQuote(farm, head[1], Number(head[2]) as 1 | 3)
  if (!quote || quote.token !== token) return stale()
  if (!quote.items) return { ok: false, message: 'Излишков ингредиентов этого рецепта нет. Ничего не продано.' }
  const requests = quote.lines.filter(line => line.sell > 0).map(line => ({ key: line.key, quantity: line.sell }))
  const basket = getMarketBasket(farm, requests)
  return basket ? sellMarketBasket(farm, requests, basket.token) : stale()
}
