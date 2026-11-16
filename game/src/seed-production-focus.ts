type Control = { disabled: boolean; dataset: { action?: string; value?: string } }
type Current = { crop: string; exchangeToken: string | undefined; selectionToken: string }

/** Select only a fresh rendered command. Never copy an old token or activate it. */
export function seedProductionFocus<T extends Control>(controls: Iterable<T>, current: Current): T | undefined {
  const enabled = Array.from(controls).filter(control => !control.disabled)
  return enabled.find(control => current.exchangeToken !== undefined
      && control.dataset.action === 'save-crop-seeds' && control.dataset.value === current.exchangeToken)
    ?? enabled.find(control => control.dataset.action === 'choose-seed' && control.dataset.value === current.selectionToken)
    ?? enabled.find(control => control.dataset.action === 'preview-seed' && control.dataset.value === current.crop)
}
