import { canStockBayShop, stockBayShop, type BayShopState, type BayShopStock } from './bay-shop-model.ts'

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
