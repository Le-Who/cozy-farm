export type HintRect = { x: number; y: number; width: number; height: number }
export type FieldHintBands = { top: number; bottom: number; obstacles: HintRect[] }

export function fieldHintOverlaps(hint: HintRect, obstacles: readonly HintRect[]) {
  return obstacles.some(box => box.width > 0 && box.height > 0 && hint.x < box.x + box.width
    && hint.x + hint.width > box.x && hint.y < box.y + box.height && hint.y + hint.height > box.y)
}

/** Free side margins for the existing hint, never soil, HUD, or a result toast. */
export function compactFieldHintRooms(view: { width: number; height: number }, field: { left: number; right: number }, bands: FieldHintBands) {
  if (view.width <= view.height || view.width > 900 || view.height >= 480) return []
  const top = Math.max(8, bands.top + 8), bottom = Math.min(view.height - 8, bands.bottom - 8)
  const rooms: { x: number; top: number; bottom: number; maxWidth: number }[] = []
  for (const side of ['right', 'left'] as const) {
    const left = side === 'right' ? Math.max(10, field.right + 8) : 10
    const right = side === 'right' ? view.width - 10 : Math.min(view.width - 10, field.left - 8)
    const maxWidth = Math.min(200, right - left)
    if (maxWidth < 96) continue
    const x = side === 'right' ? right - maxWidth : left
    let gaps = [{ top, bottom }]
    for (const box of bands.obstacles) {
      if (box.width <= 0 || box.height <= 0 || box.x >= x + maxWidth || box.x + box.width <= x) continue
      gaps = gaps.flatMap(gap => box.y - 8 >= gap.bottom || box.y + box.height + 8 <= gap.top ? [gap]
        : [{ top: gap.top, bottom: Math.min(gap.bottom, box.y - 8) }, { top: Math.max(gap.top, box.y + box.height + 8), bottom: gap.bottom }])
        .filter(gap => gap.bottom - gap.top >= 30)
    }
    for (const gap of gaps.filter(gap => gap.bottom - gap.top >= 30).sort((a,b) => b.bottom - a.bottom)) rooms.push({ x, ...gap, maxWidth })
  }
  return rooms
}
