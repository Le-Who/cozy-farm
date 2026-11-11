import { getMarketStock, type FarmState } from './farm.ts'

export type SaleTarget = { kind: 'market' | 'signature'; key: string }

export function saleStock(farm: FarmState, target: SaleTarget) {
  if (farm.island !== 'home') return undefined
  if (target.kind === 'signature') {
    const recipe = farm.culinary.recipes.find(recipe => recipe.id === target.key)
    return recipe ? { count: farm.culinary.stock[recipe.id] ?? 0, price: recipe.sellPrice, name: recipe.name } : undefined
  }
  return getMarketStock(farm).find(item => item.key === target.key)
}

export function exactSaleQuote(raw: string, stock: number, unitPrice: number) {
  const quantity = /^\d+$/.test(raw) ? Number(raw) : NaN
  const valid = Number.isSafeInteger(quantity) && quantity > 0 && quantity <= stock
    && Number.isSafeInteger(quantity * unitPrice)
  return { valid, quantity, total: valid ? quantity * unitPrice : 0, remaining: valid ? stock - quantity : stock }
}
