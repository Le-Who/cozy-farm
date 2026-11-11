/** Portrait framing of the existing harbour plate, in the world's coordinates. */
export type HarbourView = 'overview' | 'west' | 'square' | 'east';
export type HarbourPoint = { x: number; y: number };
export type HarbourViewport = { width: number; height: number; top: number; bottom: number };
export const harbourViews = [
  { id: 'overview', label: 'Весь остров', nativeX: 800 },
  { id: 'west', label: 'Мастерская', nativeX: 450 },
  { id: 'square', label: 'Площадь', nativeX: 800 },
  { id: 'east', label: 'Лавка', nativeX: 1130 },
] as const;
export const isHarbourView = (value: string): value is HarbourView => harbourViews.some(view => view.id === value);
export const isHarbourPortrait = ({ width, height }: Pick<HarbourViewport, 'width' | 'height'>) =>
  width <= 680 && width > 0 && height > width && height >= 480;

export function harbourCamera(viewport: HarbourViewport, selected: HarbourView) {
  const { width, height } = viewport;
  const wide = Math.max(.001, Math.min(Math.max(1, width) / 1440, Math.max(1, height) / 900));
  const portrait = isHarbourPortrait(viewport);
  const top = Math.max(0, viewport.top), bottom = Math.max(0, viewport.bottom);
  const available = Math.max(0, height - top - bottom);
  // Even overview must avoid the stacked portrait HUD. Wide layouts are unchanged.
  const overviewScale = portrait ? Math.max(.001, Math.min(wide, available / 900)) : wide;
  const overview = { scale: overviewScale, center: { x: 720,
    y: portrait ? 450 - (top + available / 2 - height / 2) / overviewScale : 450 }, close: false };
  if (!portrait || selected === 'overview') return overview;
  const scale = Math.min(width / 540, available / 744);
  if (scale <= wide) return overview;
  const nativeX = harbourViews.find(view => view.id === selected)!.nativeX;
  return { scale, center: { x: 125.25 + nativeX * .75,
    y: 409 - (top + available / 2 - height / 2) / scale }, close: true };
}

export function harbourScreenPoint(viewport: HarbourViewport, selected: HarbourView, point: HarbourPoint) {
  const { scale, center } = harbourCamera(viewport, selected);
  return { x: viewport.width / 2 + (point.x - center.x) * scale,
    y: viewport.height / 2 + (point.y - center.y) * scale };
}
export function harbourWorldPoint(viewport: HarbourViewport, selected: HarbourView, point: HarbourPoint) {
  const { scale, center } = harbourCamera(viewport, selected);
  return { x: center.x + (point.x - viewport.width / 2) / scale,
    y: center.y + (point.y - viewport.height / 2) / scale };
}
export function harbourPointVisible(viewport: HarbourViewport, selected: HarbourView, point: HarbourPoint, margin = 22) {
  const p = harbourScreenPoint(viewport, selected, point);
  return p.x >= margin && p.x <= viewport.width - margin
    && p.y >= viewport.top + margin && p.y <= viewport.height - viewport.bottom - margin;
}
/** Keep the present framing when possible. Overview is an explicit player choice. */
export function harbourViewForPoint(viewport: HarbourViewport, selected: HarbourView, point: HarbourPoint): HarbourView {
  if (selected === 'overview' || !harbourCamera(viewport, selected).close
    || harbourPointVisible(viewport, selected, point)) return selected;
  const choices = harbourViews.slice(1).filter(view => harbourPointVisible(viewport, view.id, point));
  return choices.sort((a, b) => Math.abs(harbourCamera(viewport, a.id).center.x - point.x)
    - Math.abs(harbourCamera(viewport, b.id).center.x - point.x))[0]?.id ?? 'overview';
}
/** A long route uses a temporary overview, never teleports or changes the route. */
export function harbourRouteNeedsOverview(viewport: HarbourViewport, selected: HarbourView, points: readonly HarbourPoint[]) {
  return harbourCamera(viewport, selected).close && points.some(point => !harbourPointVisible(viewport, selected, point));
}

/** Restoring DOM focus must not cut a visible journey short. A new command may. */
export function harbourFocus(viewport: HarbourViewport, selected: HarbourView, point: HarbourPoint,
  traveling: boolean, explicit = false) {
  if (traveling && !explicit) return { view: selected, traveling };
  return { view: harbourViewForPoint(viewport, selected, point), traveling: false };
}
