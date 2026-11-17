/** Presentation only: move the complete existing care group, never clone
 * or recreate its labelled controls, descriptions, disabled state, or handlers. */
export function groupCoopServices(root: HTMLElement): void {
  const panel = root.querySelector<HTMLElement>('.coop-panel')
  if (!panel || panel.dataset.coopServices === 'true') return
  const care = panel.querySelector<HTMLElement>(':scope > .coop-care')
  if (!care) return
  panel.dataset.coopServices = 'true'
  panel.prepend(care)
}
