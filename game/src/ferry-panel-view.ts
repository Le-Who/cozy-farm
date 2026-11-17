type FerryFocus = { action: string; value: string; area: 'offers' | 'selection' | 'panel' } | { summary: 'offers' | 'port-details' } | { receipt: true };
export type FerryPanelView = {
  offersOpen?: boolean;
  portDetailsOpen?: boolean;
  scroll: number[];
  focus?: FerryFocus;
};
const scrollAreas = ['.bay-freight-workspace', '.expedition-card-scroll', '.expedition-overview'] as const;

/** Ephemeral UI state only: no port, selected order, quote or farm state. */
export function captureFerryPanelView(host: HTMLElement): FerryPanelView | undefined {
  const panel = host.querySelector<HTMLElement>('.bay-freight');
  if (!panel) return undefined;
  const offers = panel.querySelector<HTMLDetailsElement>('.expedition-offers');
  const portDetails = panel.querySelector<HTMLDetailsElement>('.expedition-port-details');
  const active = host.ownerDocument.activeElement;
  const focus: FerryFocus | undefined = active && panel.contains(active)
    ? active.matches('button[data-action]')
      ? { action: (active as HTMLElement).dataset.action!, value: (active as HTMLElement).dataset.value ?? '',
        area: active.closest('.expedition-offers') ? 'offers' : active.closest('.expedition-selection') ? 'selection' : 'panel' }
      : active === offers?.querySelector('summary') ? { summary: 'offers' }
        : active === portDetails?.querySelector('summary') ? { summary: 'port-details' }
          : active.matches('.expedition-receipt') ? { receipt: true } : undefined
    : undefined;
  return { offersOpen: offers?.open, portDetailsOpen: portDetails?.open,
    scroll: scrollAreas.map(selector => panel.querySelector<HTMLElement>(selector)?.scrollTop ?? 0), focus };
}

function canFocus(control: HTMLElement | undefined): control is HTMLElement {
  if (!control || control.matches(':disabled') || control.closest('[hidden]')) return false;
  // A matching button inside a closed disclosure must never be focused or opened for focus.
  for (let ancestor = control.parentElement; ancestor; ancestor = ancestor.parentElement) {
    if (ancestor.tagName === 'DETAILS' && !(ancestor as HTMLDetailsElement).open
      && !ancestor.querySelector(':scope > summary')?.contains(control)) return false;
  }
  return true;
}

export function restoreFerryPanelView(host: HTMLElement, view: FerryPanelView | undefined): void {
  const panel = host.querySelector<HTMLElement>('.bay-freight');
  if (!panel || !view) return;
  const offers = panel.querySelector<HTMLDetailsElement>('.expedition-offers');
  const portDetails = panel.querySelector<HTMLDetailsElement>('.expedition-port-details');
  if (offers && view.offersOpen !== undefined) offers.open = view.offersOpen;
  if (portDetails && view.portDetailsOpen !== undefined) portDetails.open = view.portDetailsOpen;
  for (const [index, selector] of scrollAreas.entries()) {
    const area = panel.querySelector<HTMLElement>(selector);
    if (area) area.scrollTop = view.scroll[index];
  }
  const focus = view.focus;
  if (!focus) return;
  const matches = 'action' in focus ? [...panel.querySelectorAll<HTMLButtonElement>('button[data-action]')]
    .filter(button => button.dataset.action === focus.action && (button.dataset.value ?? '') === focus.value) : [];
  const target = 'receipt' in focus ? panel.querySelector<HTMLElement>('.expedition-receipt') ?? undefined : 'summary' in focus
    ? panel.querySelector<HTMLElement>(`.expedition-${focus.summary} > summary`) ?? undefined
    : matches.find(button => focus.area === 'panel' || button.closest(`.expedition-${focus.area}`)) ?? matches.find(canFocus);
  const picker = 'action' in focus && (focus.action === 'expedition-offer' || focus.action === 'expedition-pair');
  const fallback = picker ? offers?.querySelector<HTMLElement>('summary') ?? undefined : undefined;
  const close = panel.querySelector<HTMLElement>('.bay-freight-close') ?? undefined;
  const next = canFocus(target) ? target : canFocus(fallback) ? fallback : canFocus(close) ? close : undefined;
  next?.focus({ preventScroll: true });
  // A changed cargo card may leave the retained picker position clipping its focused choice.
  // Preserve ordinary scroll restoration; reveal only that choice when it no longer fits.
  const area = picker && next === target ? panel.querySelector<HTMLElement>('.expedition-card-scroll') : undefined;
  if (area && next) {
    const frame = area.getBoundingClientRect(), control = next.getBoundingClientRect();
    if (control.top < frame.top || control.bottom > frame.bottom) next.scrollIntoView({ block: 'nearest' });
  }
}
