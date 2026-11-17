const mountedCoopServices = new WeakMap<HTMLElement, () => void>()

/** Keep the existing complete care group in visual reading order: daily-left
 * then care-right on desktop; care first on compact. Never recreate controls. */
export function groupCoopServices(root: HTMLElement): () => void {
  mountedCoopServices.get(root)?.()
  const panel = root.querySelector<HTMLElement>('.coop-panel')
  const care = panel?.querySelector<HTMLElement>(':scope > .coop-care')
  const forecast = panel?.querySelector<HTMLElement>(':scope > .coop-forecast')
  const desktop = panel && care && forecast
    ? root.ownerDocument.defaultView?.matchMedia('(min-width: 900px) and (min-height: 600px)') : undefined
  if (!panel || !care || !forecast || !desktop) return () => {}
  panel.dataset.coopServices = 'true'
  let disposed = false
  const reorder = () => {
    if (disposed || !root.contains(panel)) return
    const before = desktop.matches ? forecast.nextElementSibling : panel.firstElementChild
    if (before === care) return
    const active = root.ownerDocument.activeElement as HTMLElement | null
    const focusedCare = care.contains(active) ? active : null
    const scroll = root.scrollTop
    panel.insertBefore(care, before)
    // Moving a focused subtree can clear native focus; keep the same control,
    // not a fresh selection, when a live resize crosses the layout breakpoint.
    if (focusedCare && root.ownerDocument.activeElement !== focusedCare) focusedCare.focus({ preventScroll: true })
    root.scrollTop = scroll
  }
  const dispose = () => {
    if (disposed) return
    disposed = true
    desktop.removeEventListener('change', reorder)
    if (mountedCoopServices.get(root) === dispose) mountedCoopServices.delete(root)
  }
  reorder()
  desktop.addEventListener('change', reorder)
  mountedCoopServices.set(root, dispose)
  return dispose
}
