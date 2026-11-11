import { harbourCamera, isHarbourPortrait, type HarbourView, type HarbourViewport } from './harbour-view.ts';

/** Measure the actual HUD, including wrapped tasks and the return-to-request chip. */
export function createHarbourControls(canvas: HTMLCanvasElement, context: HTMLElement, nav: HTMLElement,
  bottom: HTMLElement, resume: HTMLElement, onLayout: (viewport: HarbourViewport) => void) {
  let village = false;
  let selected: HarbourView = 'overview';
  let traveling = false;
  const live = nav.querySelector<HTMLElement>('[aria-live]')!;
  let destroyed = false;
  function layout() {
    if (destroyed) return;
    const rect = canvas.getBoundingClientRect();
    const eligible = village && isHarbourPortrait(rect);
    context.dataset.harbour = String(eligible);
    nav.hidden = !eligible;
    const top = eligible ? context.getBoundingClientRect().bottom - rect.top + 12 : 180;
    const bottomY = Math.min(bottom.getBoundingClientRect().top,
      resume.hidden ? Infinity : resume.getBoundingClientRect().top);
    const viewport = { width: rect.width, height: rect.height, top, bottom: Math.max(0, rect.bottom - bottomY + 12) };
    const available = harbourCamera(viewport, 'west').close;
    const effective = available && !traveling ? selected : 'overview';
    for (const button of nav.querySelectorAll<HTMLButtonElement>('[data-harbour-view]')) {
      button.disabled = !available && button.dataset.harbourView !== 'overview';
      button.setAttribute('aria-pressed', String(button.dataset.harbourView === effective));
    }
    const message = traveling ? 'Показываем путь целиком. После прибытия вернётся близкий вид.'
      : eligible && !available ? 'Для близкого вида нужно больше места по высоте.' : '';
    if (live.textContent !== message) live.textContent = message;
    onLayout(viewport);
  }
  const observer = new ResizeObserver(layout);
  for (const node of [canvas, context, bottom, resume]) observer.observe(node);
  return {
    sync(island: string) { village = island === 'village'; layout(); },
    select(view: HarbourView, journey: boolean) { selected = view; traveling = journey; layout(); },
    destroy() { destroyed = true; observer.disconnect(); },
  };
}
