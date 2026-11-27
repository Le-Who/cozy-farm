/** A completed care action may disable or remove its old button. Keep the
 * result in the selected hen's existing, read-only progress, not another spend. */
export function henCareResultFocus(root: HTMLElement, previous: HTMLButtonElement): HTMLProgressElement | undefined {
  if (previous.disabled) return
  const { action, value } = previous.dataset
  const choice = action === 'pet' ? /^([0-4])$/.exec(value ?? '')
    : action === 'hen-treat' ? /^([0-4]):(?:carrot|leafyGreens|apple)$/.exec(value ?? '')
      : action === 'visit-introduce-hen' ? /^(?:[1-9]\d{0,6}):([0-4])$/.exec(value ?? '') : null
  if (!choice) return
  const selected = root.querySelector<HTMLButtonElement>('.hen-friend-select[aria-pressed="true"]')
  if (selected?.dataset.value !== choice[1]) return
  const current = root.querySelector<HTMLButtonElement>(`button[data-action="${action}"][data-value="${value}"]`)
  if (current && !current.disabled || !current && action === 'pet') return
  const progress = root.querySelector<HTMLProgressElement>('.hen-friend-progress progress')
  if (!progress) return
  progress.tabIndex = -1
  progress.classList.add('hen-care-focus')
  return progress
}
