/** Returning means a previous purchase, not necessarily a favourite. */
export function bayShopPurchaseReaction(purchase: { returning: boolean; liked: boolean }): string {
  if (purchase.liked) return purchase.returning ? 'Снова за любимым! Как раз по моему вкусу!' : 'Как раз по моему вкусу!'
  return purchase.returning ? 'Возьму ещё раз.' : 'Возьму попробовать.'
}
