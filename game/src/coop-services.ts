const mountedCoopServices = new WeakMap<HTMLElement, () => void>()

/** An available next hatch step belongs before optional care on compact screens. */
function hasLiveHatchStep(daily: HTMLElement): boolean {
  return !!daily.querySelector('[data-action="incubate-egg"]:not(:disabled), [data-action="incubate-rare-egg"]:not(:disabled), [data-action="incubator-basket"]:not(:disabled), [data-action="incubator-warehouse-egg"]:not(:disabled), [data-action="incubator-warehouse-basket"]:not(:disabled), [data-action="visit-rest"]:not(:disabled)')
    || !!daily.querySelector('[data-action="incubate-egg"]:disabled') && !!daily.querySelector('[data-action="collect"]:not(:disabled)')
}

/** Move the existing whole care group in reading order. Never recreate controls. */
export function groupCoopServices(root: HTMLElement): () => void {
  mountedCoopServices.get(root)?.()
  const panel = root.querySelector<HTMLElement>('.coop-panel')
  const daily = panel?.querySelector<HTMLElement>(':scope > .coop-primary')
  const care = panel?.querySelector<HTMLElement>(':scope > .coop-care')
  const forecast = panel?.querySelector<HTMLElement>(':scope > .coop-forecast')
  const desktop = panel && daily && care && forecast
    ? root.ownerDocument.defaultView?.matchMedia('(min-width: 900px) and (min-height: 600px)') : undefined
  if (!panel || !daily || !care || !forecast || !desktop) return () => {}
  panel.dataset.coopServices = 'true'
  let disposed = false
  const reorder = () => {
    if (disposed || !root.contains(panel)) return
    const before = desktop.matches ? forecast.nextElementSibling : hasLiveHatchStep(daily) ? forecast : panel.firstElementChild
    if (before === care || before === care.nextElementSibling) return
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
