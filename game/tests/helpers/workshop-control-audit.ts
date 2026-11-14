/** Read-only checks for the native workshop fixture, shared with fast regression tests. */
export type ControlRect = { x: number; y: number; width: number; height: number }
export type WorkshopControlSnapshot = {
  stage: string
  activeTool: string
  bounds: ControlRect
  hand: ControlRect
  bake: ControlRect
  guide: { rect: ControlRect; visible: boolean; title: string; hint: string }
  paletteVisible: boolean
  tools: {
    id: string
    label: string
    selected: boolean
    selectedMarkerVisible: boolean
    rect: ControlRect
    labelRect: ControlRect
    receivesPointer: boolean
  }[]
}

const tolerance = .75
const within = (inner: ControlRect, outer: ControlRect) => inner.x >= outer.x - tolerance && inner.y >= outer.y - tolerance
  && inner.x + inner.width <= outer.x + outer.width + tolerance && inner.y + inner.height <= outer.y + outer.height + tolerance
const overlaps = (a: ControlRect, b: ControlRect) => a.width > 0 && a.height > 0 && b.width > 0 && b.height > 0
  && a.x < b.x + b.width - tolerance && a.x + a.width > b.x + tolerance
  && a.y < b.y + b.height - tolerance && a.y + a.height > b.y + tolerance

export function auditWorkshopControls(snapshot: WorkshopControlSnapshot): string[] {
  const issues: string[] = []
  if (!snapshot.guide.visible || !snapshot.guide.title || !snapshot.guide.hint) issues.push('guide:missing')
  if (!within(snapshot.guide.rect, snapshot.bounds)) issues.push('guide:outside-workshop')
  if (snapshot.stage !== 'working') {
    if (snapshot.paletteVisible) issues.push('palette:visible-outside-working-stage')
    return issues
  }
  const selected = snapshot.tools.filter(tool => tool.selected)
  if (selected.length !== 1 || selected[0].id !== snapshot.activeTool) issues.push('selection:inconsistent')
  if (selected.length === 1 && !snapshot.guide.title.includes(selected[0].label)) issues.push('guide:stale-tool')
  // Closed compact menus intentionally have no rendered button bounds or pointer targets.
  if (!snapshot.paletteVisible) return issues
  for (const tool of snapshot.tools) {
    if (tool.rect.width + tolerance < Math.max(76, snapshot.hand.width)
      || tool.rect.height + tolerance < Math.max(64, snapshot.hand.height)) issues.push(`${tool.id}:smaller-than-hand`)
    if (!within(tool.rect, snapshot.bounds)) issues.push(`${tool.id}:outside-workshop`)
    if (!within(tool.labelRect, tool.rect)) issues.push(`${tool.id}:label-overflow`)
    if (overlaps(tool.rect, snapshot.guide.rect)) issues.push(`${tool.id}:covers-mode-guide`)
    if (overlaps(tool.rect, snapshot.hand)) issues.push(`${tool.id}:covers-hand`)
    if (overlaps(tool.rect, snapshot.bake)) issues.push(`${tool.id}:covers-bake`)
    if (!tool.receivesPointer) issues.push(`${tool.id}:pointer-obstructed`)
    if (tool.selected !== tool.selectedMarkerVisible) issues.push(`${tool.id}:selection-marker-mismatch`)
  }
  return issues
}
