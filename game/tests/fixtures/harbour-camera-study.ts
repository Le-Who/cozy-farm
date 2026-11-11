/** Camera study only. Not imported by the game, never persisted in a save. */
export type HarbourStudyView = 'overview' | 'west' | 'square' | 'east';
export const harbourStudyViews = [
  { id: 'overview', label: 'Весь остров', nativeX: 800 },
  { id: 'west', label: 'Мастерская', nativeX: 450 },
  { id: 'square', label: 'Площадь', nativeX: 800 },
  { id: 'east', label: 'Лавка', nativeX: 1130 },
] as const;

export function harbourStudyCamera(width: number, height: number, selected: HarbourStudyView) {
  const wide = Math.min(width / 1440, height / 900);
  const portrait = width <= 680 && height > width && height >= 480;
  if (!portrait || selected === 'overview') return { scale: wide, center: { x: 720, y: 450 }, close: false };
  // Three overlapping horizontal views of the same authored island. Keep the
  // entire vertical island extent below controls and above the action toolbar.
  const safe = { top: 180, bottom: 96 };
  const available = Math.max(140, height - safe.top - safe.bottom);
  const scale = Math.min(width / 540, available / 744);
  // A nearly square/short portrait cannot fit the reserved HUD and enlarge the
  // island. Keep overview rather than silently crop the vertical artwork.
  if (scale <= wide) return { scale: wide, center: { x: 720, y: 450 }, close: false };
  const contentMidY = safe.top + available / 2;
  const nativeX = harbourStudyViews.find(view => view.id === selected)!.nativeX;
  return {
    scale,
    center: { x: 125.25 + nativeX * .75, y: 409 - (contentMidY - height / 2) / scale },
    close: true,
  };
}

export function projectHarbourStudyPoint(width: number, height: number, selected: HarbourStudyView, x: number, y: number) {
  const view = harbourStudyCamera(width, height, selected);
  return { x: width / 2 + (125.25 + x * .75 - view.center.x) * view.scale,
    y: height / 2 + (37 + y * .75 - view.center.y) * view.scale };
}
