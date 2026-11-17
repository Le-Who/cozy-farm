/** Reveal only the current keyboard preview, inside its own content scroller. */
export function revealSeedPickerFocus(host: HTMLElement, target: HTMLElement): void {
  if (!host.contains(target) || host.ownerDocument.activeElement !== target
    || !target.matches('button.seed-picker-tile[data-action="preview-seed"]:focus-visible')
    || !target.getClientRects().length) return
  const header = target.closest('.seed-picker')?.querySelector<HTMLElement>('.seed-picker-current')
  if (!header) return
  const frame = host.getBoundingClientRect(), tile = target.getBoundingClientRect()
  // Leave room for the existing 3px outline and 2px offset, not CSS scroll margins.
  const top = Math.max(frame.top, header.getBoundingClientRect().bottom) + 5
  const bottom = frame.bottom - 5
  const delta = tile.bottom > bottom ? tile.bottom - bottom : tile.top < top ? tile.top - top : 0
  if (delta) host.scrollTop += delta
}
