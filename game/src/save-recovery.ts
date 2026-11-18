import type { SaveIssue } from './protected-save'
import type { RecoveryOrigin } from './versioned-save'
import './save-recovery.css'

type RecoverySource = { readonly issue: SaveIssue | undefined; readonly raw: string | null | undefined; readonly blocked: boolean; readonly recoveryOrigin?: RecoveryOrigin }

/** Only the farm’s guarded writer may retry a recoverable write. Protected sessions never write. */
export function mountSaveRecovery(source: RecoverySource, saveCurrent: () => Promise<boolean>) {
  const notice = document.createElement('button')
  notice.type = 'button'
  notice.className = 'save-recovery-notice'
  const dialog = document.createElement('dialog')
  dialog.className = 'save-recovery-dialog'
  dialog.setAttribute('aria-labelledby','save-recovery-title')
  dialog.setAttribute('aria-describedby','save-recovery-detail')
  dialog.innerHTML = `<h1 id="save-recovery-title" aria-live="polite" aria-atomic="true">Сохранение под защитой</h1>
    <p id="save-recovery-detail"></p>
    <p class="save-recovery-warning" id="save-recovery-warning">Можно продолжить временно. Новый прогресс может исчезнуть после закрытия или перезагрузки страницы.</p>
    <div class="save-recovery-actions">
      <button type="button" class="dialog-button" data-recovery="save" hidden>Сохранить ещё раз</button>
      <button type="button" class="dialog-button" data-recovery="download">Скачать исходное сохранение</button>
      <button type="button" class="dialog-button secondary" data-recovery="retry" aria-describedby="save-recovery-warning">Перезагрузить без сохранения</button>
      <button type="button" class="dialog-button secondary" data-recovery="continue">Продолжить без сохранения</button>
    </div>`
  const title = dialog.querySelector<HTMLElement>('h1')!
  const detail = dialog.querySelector<HTMLElement>('#save-recovery-detail')!
  const warning = dialog.querySelector<HTMLElement>('.save-recovery-warning')!
  const save = dialog.querySelector<HTMLButtonElement>('[data-recovery="save"]')!
  const writableFailure = () => source.issue === 'write-failed' && !source.blocked
  let saving = false
  const download = dialog.querySelector<HTMLButtonElement>('[data-recovery="download"]')!
  const retry = dialog.querySelector<HTMLButtonElement>('[data-recovery="retry"]')!
  const resume = dialog.querySelector<HTMLButtonElement>('[data-recovery="continue"]')!
  let conflictNotified = source.issue === 'changed'
  const update = () => {
    notice.hidden = !source.issue
    notice.textContent = source.blocked ? 'Сохранение защищено · Подробнее' : 'Прогресс не сохранён · Подробнее'
    const writable = writableFailure()
    const heading = !source.issue ? 'Прогресс сохранён' : source.blocked ? 'Сохранение под защитой' : saving ? 'Сохраняем прогресс…' : 'Прогресс не сохранён'
    if (title.textContent !== heading) title.textContent = heading
    save.hidden = !writable
    save.setAttribute('aria-disabled', String(saving))
    retry.hidden = !source.blocked || !source.issue
    download.hidden = !source.issue
    download.className = writable ? 'dialog-button secondary' : 'dialog-button'
    resume.textContent = source.blocked ? 'Продолжить без сохранения' : 'Продолжить игру'
    warning.hidden = detail.hidden = !source.issue
    detail.textContent = source.issue === 'write-failed' && source.blocked
      ? 'Браузер не смог завершить перенос сохранения. Исходные данные сохранены. Освободите место или разрешите хранение данных сайта и перезагрузите страницу. Действия во временной игре не запишутся автоматически.'
      : source.issue === 'missing-primary'
      ? 'Запись новой версии отсутствует после завершённого переноса. Старый прогресс не будет загружен поверх нового. Скачайте исходный снимок для восстановления; автоматического сброса нет.'
      : source.issue === 'migration-invalid'
        ? 'Журнал переноса повреждён. Сохранённые данные не изменены. Скачайте доступную запись для восстановления; перенос не будет начат заново.'
        : source.issue === 'locking-unavailable'
          ? 'Браузер не дал защитить запись от одновременной работы вкладок. Ферму можно открыть временно, но прогресс не сохранится. Обновите браузер и повторите загрузку.'
          : source.issue === 'invalid'
      ? 'Не удалось открыть сохранённую ферму. Исходная запись не изменена и защищена от перезаписи. Скачайте её для восстановления или повторите загрузку после обновления игры.'
      : source.issue === 'changed'
        ? 'Сохранение изменилось вне этой страницы. Запись остановлена, чтобы не затереть другой прогресс. Скачайте текущую запись или загрузите её заново.'
        : source.issue === 'read-failed'
          ? 'Браузер не дал прочитать сохранение. Запись остановлена: существующая ферма не будет заменена новой. Проверьте доступ к данным сайта и повторите загрузку.'
          : 'Браузер не смог записать последний прогресс. Предыдущее сохранение не изменено. Освободите место или разрешите хранение данных сайта; следующее действие попробует сохранить снова.'
    download.disabled = typeof source.raw !== 'string'
    // An outside notice is inert behind an open game dialog. Surface a newly
    // detected collision once, but respect continuing the now read-only session.
    if (source.issue === 'changed' && !conflictNotified) {
      conflictNotified = true
      show()
    }
  }
  const show = () => {
    update()
    if (!dialog.open) dialog.showModal()
    ;(writableFailure() ? save : !source.issue ? resume : download.disabled ? retry : download).focus()
  }
  // Modal keyboard input must not trigger the farm's global shortcuts behind it.
  dialog.addEventListener('keydown',event => event.stopPropagation())
  notice.addEventListener('click',show)
  download.addEventListener('click',() => {
    if (typeof source.raw !== 'string') return
    const url = URL.createObjectURL(new Blob([source.raw],{type:'application/json'}))
    const link = document.createElement('a')
    link.href = url
    link.download = source.recoveryOrigin === 'journal' ? 'cozy-farm-migration-journal.json'
      : source.recoveryOrigin === 'legacy' || source.recoveryOrigin === 'snapshot' ? 'cozy-farm-original-snapshot.json' : 'cozy-farm-recovery.json'
    document.body.append(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url),1000)
  })
  save.addEventListener('click',async () => {
    if (saving || !writableFailure()) return
    saving = true
    update()
    try { await saveCurrent() } finally {
      saving = false
      update()
      if (dialog.open && !source.issue && (document.activeElement === save || document.activeElement === document.body)) resume.focus()
    }
  })
  retry.addEventListener('click',() => { if (source.issue && source.blocked) location.reload() })
  resume.addEventListener('click',() => dialog.close())
  document.body.append(notice,dialog)
  update()
  return {update,show}
}
