export type CookeryRecoveryOptions = {
  onCancel: () => void
  returnLabel?: string
  signal: AbortSignal
}

/** A renderer may fail before resize runs. Keep recovery in normal document flow. */
export function showCookeryRecovery(root: HTMLElement, options: CookeryRecoveryOptions): void {
  const document = root.ownerDocument
  root.dataset.unavailable = 'true'
  const panel = document.createElement('div')
  panel.className = 'cookery-recovery'
  panel.setAttribute('role', 'status')
  const title = document.createElement('h2')
  title.textContent = 'Не удалось открыть кухонный стол'
  const reason = document.createElement('p')
  reason.textContent = 'Браузер не смог запустить трёхмерную графику. Ингредиенты не потрачены. Вернитесь в книгу рецептов: сохранённый рецепт можно повторить без ручной мастерской.'
  const back = document.createElement('button')
  back.type = 'button'
  back.className = 'dialog-button'
  back.textContent = options.returnLabel ?? 'В книгу рецептов'
  let returned = false
  const leave = () => {
    if (returned || options.signal.aborted) return
    returned = true
    options.onCancel()
  }
  back.addEventListener('click', leave, { signal: options.signal })
  root.addEventListener('keydown', event => {
    if (!['Enter', ' ', 'Escape'].includes(event.key)) return
    event.preventDefault()
    event.stopPropagation()
    if (!event.repeat) leave()
  }, { signal: options.signal })
  panel.append(title, reason, back)
  root.replaceChildren(panel)
  back.focus({ preventScroll: true })
}
