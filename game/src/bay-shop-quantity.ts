import { canStockBayShop, stockBayShop, type BayShopState, type BayShopStock } from './bay-shop-model.ts'
import type { FarmState } from './farm.ts'

export type ShopRecipeRefill = { id: string; shelf: number; day: number; price: number; key: string }

function sameProductSlot(state: BayShopState, id: string) {
  const matching = state.slots.flatMap((slot, shelf) => slot && (slot.product.id === id || slot.product.identity === id) ? [shelf] : [])
  if (matching.length !== 1) return
  const shelf = matching[0], slot = state.slots[shelf]!
  if (slot.product.id === id && slot.product.identity === id && slot.quantity === 0) return { shelf, slot }
}

/** The local recipe may refill its only old listing, never silently pick another shelf. */
export function shopRecipeRefill(farm: FarmState, recipe: string): ShopRecipeRefill | undefined {
  const state = farm.bayShop, id = 'signature:' + recipe, day = farm.day
  if (farm.island !== 'village' || !farm.village.built || !state.open || state.businessDay !== day ||
      !state.reputation[id]?.sold || !(farm.culinary.stock[recipe] > 0) ||
      !farm.culinary.recipes.some(row => row.id === recipe)) return
  const match = sameProductSlot(state, id)
  if (!match || !canStockBayShop(state, match.shelf, match.slot.product, 1)) return
  const { shelf, slot: { price } } = match
  return { id, shelf, day, price, key: `${day}:${id}:${shelf}:${price}` }
}

export function currentShopRecipeRefill(state: BayShopState, quote: ShopRecipeRefill) {
  if (!state.open || state.businessDay !== quote.day || !state.reputation[quote.id]?.sold) return false
  const match = sameProductSlot(state, quote.id)
  return !!match && match.shelf === quote.shelf && match.slot.price === quote.price
}

/** Keep an explicitly selected compatible shelf; exact recipe entry reuses its own shelf first. */
export function shopStockSlot(state: BayShopState, product: Pick<BayShopStock, 'id' | 'identity'>, selected = -1) {
  const matches = (slot: BayShopState['slots'][number]) => !!slot && slot.quantity < 999
    && slot.product.id === product.id && slot.product.identity === product.identity
  if (state.slots[selected] === null || matches(state.slots[selected])) return selected
  const matching = state.slots.findIndex(matches)
  return matching >= 0 ? matching : state.slots.indexOf(null)
}

export function shopQuantityPreview(state: BayShopState, index: number, product: BayShopStock, quantity: number) {
  const slot = state.slots[index]
  const compatible = Number.isSafeInteger(index) && index >= 0 && index < state.slots.length
    && (!slot || slot.product.id === product.id && slot.product.identity === product.identity)
  const onShelf = compatible ? slot?.quantity ?? 0 : 0
  const maximum = compatible ? Math.max(0, Math.min(product.quantity, 999 - onShelf)) : 0
  const valid = Number.isSafeInteger(quantity) && quantity > 0 && quantity <= maximum
    && canStockBayShop(state, index, product, quantity)
  return { maximum, valid, onShelf, remaining: valid ? product.quantity - quantity : product.quantity,
    after: valid ? onShelf + quantity : onShelf, price: slot?.price ?? product.basePrice }
}

/** Validate the full batch before taking any goods. No clipping or partial reservation. */
export function placeShopQuantity(state: BayShopState, index: number, product: BayShopStock, quantity: number,
  takeStock: (id: string, count: number) => boolean) {
  if (!shopQuantityPreview(state, index, product, quantity).valid || !takeStock(product.id, quantity)) return false
  return stockBayShop(state, index, product, quantity)
}
