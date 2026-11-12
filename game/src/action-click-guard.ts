type Click = { detail: number; timeStamp: number; clientX: number; clientY: number }

/** A redraw can replace the target between the two clicks of one gesture. */
export class ActionClickGuard {
  private last: Click | undefined
  blocks(event: Click): boolean {
    const last = this.last
    return !!last && event.detail > 0 && event.timeStamp >= last.timeStamp
      && event.timeStamp - last.timeStamp <= 500
      && Math.hypot(event.clientX - last.clientX, event.clientY - last.clientY) <= 8
  }
  remember(event: Click) {
    if (event.detail > 0) this.last = { detail: event.detail, timeStamp: event.timeStamp, clientX: event.clientX, clientY: event.clientY }
  }
}

const guardedActions = new Set([
  'signature-base', 'signature-slot', 'signature-fruit', 'start-signature',
  'recipe-surplus-choose', 'recipe-surplus-quantity', 'recipe-surplus-refresh', 'recipe-surplus-reset', 'recipe-surplus-confirm', 'recipe-surplus-recipe',
  'berry-renewal-source', 'berry-renewal-reset', 'berry-renewal-bed', 'berry-renewal-confirm',
  'garden-shop', 'garden-shop-scope', 'garden-shop-back', 'garden-buy-seeds',
  'garden-slot', 'garden-edit', 'garden-copy', 'garden-cancel', 'garden-brush', 'garden-paint', 'garden-save', 'garden-follow', 'garden-delete', 'garden-remove', 'garden-bed',
  'visit-invite', 'visit-finish', 'visit-reply', 'visit-introduce-hen', 'visit-do', 'visit-book-home',
  'hen-walk-start', 'hen-walk-return',
  'hen-friendship-open', 'hen-treat', 'pet',
  'chicken-feed-open', 'mix-chicken-feed',
  'harbour-fish-trade', 'harbour-fish-catch',
  'berry-nursery-ingredient', 'berry-nursery-source', 'berry-nursery-destination', 'berry-nursery-confirm', 'berry-nursery-reset',
  'commission-accept', 'commission-deliver', 'commission-cancel', 'commission-finish', 'commission-recipe', 'commission-rest',
  'ferry-return', 'expedition-rest', 'expedition-discovery', 'expedition-restock', 'expedition-source', 'work-context', 'resume-recipe-draft', 'reset-recipe-draft',
  'forget-signature', 'follow-task', 'buy-feed', 'festival-contribute', 'market-next-rest', 'harbor-next-rest',
  'show-requirement', 'warehouse-supply', 'warehouse-supply-withdraw', 'recipe-repeat-home', 'recipe-warehouse-withdraw',
  'return-nursery-tree', 'supper-signature', 'share-meal', 'serve-guest',
  'sell-item', 'sell-signature', 'sale-again', 'confirm-sale', 'sell', 'make-signature', 'batch-signature',
  'rest-intent-request', 'rest-close-shop', 'shop-stock-select', 'shop-stock-confirm', 'freight-withdraw',
  'neighbor-repeat-food', 'neighbor-shelf-food', 'neighbor-stored-food', 'request-repeat-exact', 'choose-neighbor-food',
  'transplant-source', 'transplant-destination', 'transplant-reset',
  'unpack-egg-basket', 'unpack-egg-crate', 'finish-egg-packing', 'expedition-claim', 'expedition-send', 'expedition-offer', 'expedition-pair',
])

export function isGuardedAction(action: string | undefined) { return guardedActions.has(action ?? '') }

/** Keep ownership of a held key even when redraw moves focus to another control. */
export class ActivationKeyGuard {
  private held = new Set<string>()
  blocks(event: { key: string; repeat: boolean }, guardedTarget: boolean): boolean {
    if (event.key !== 'Enter' && event.key !== ' ') return false
    if (event.repeat && (this.held.has(event.key) || guardedTarget)) {
      this.held.add(event.key)
      return true
    }
    if (!event.repeat) {
      if (guardedTarget) this.held.add(event.key)
      else this.held.delete(event.key)
    }
    return false
  }
  release(key: string) { this.held.delete(key) }
  reset() { this.held.clear() }
}

export function installActionClickGuard(root: HTMLElement) {
  const guard = new ActionClickGuard()
  const keys = new ActivationKeyGuard()
  root.addEventListener('click', event => {
    if (guard.blocks(event)) {
      event.preventDefault()
      event.stopImmediatePropagation()
      return
    }
    const control = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button') : null
    if (control && !control.disabled && isGuardedAction(control.dataset.action)) guard.remember(event)
  }, true)
  // A removed button may send keyup/repeat to the dialog, body or close button.
  // Listen on the document so release is always seen, not only inside the app.
  root.ownerDocument.addEventListener('keydown', event => {
    const target = event.target instanceof Element && root.contains(event.target) ? event.target : null
    const button = target?.closest<HTMLButtonElement>('button')
    const guarded = !!target?.closest('[data-sale-quantity],[data-stock-quantity]') || !!button && !button.disabled && isGuardedAction(button.dataset.action)
    if (keys.blocks(event, guarded)) {
      event.preventDefault()
      event.stopImmediatePropagation()
    }
  }, true)
  root.ownerDocument.addEventListener('keyup', event => keys.release(event.key), true)
  root.ownerDocument.defaultView?.addEventListener('blur', () => keys.reset())
}
