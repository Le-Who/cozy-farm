import type { SaveIssue } from './protected-save'
import type { RecoveryOrigin } from './versioned-save'
import './save-recovery.css'

type RecoverySource = { readonly issue: SaveIssue | undefined; readonly raw: string | null | undefined; readonly blocked: boolean; readonly recoveryOrigin?: RecoveryOrigin }

/** Recovery never clears or rewrites the original save. */
export function mountSaveRecovery(source: RecoverySource) {
  const notice = document.createElement('button')
  notice.type = 'button'
  notice.className = 'save-recovery-notice'
  const dialog = document.createElement('dialog')
  dialog.className = 'save-recovery-dialog'
  dialog.setAttribute('aria-labelledby','save-recovery-title')
  dialog.setAttribute('aria-describedby','save-recovery-detail')
  dialog.innerHTML = `<h1 id="save-recovery-title">Сохранение под защитой</h1>
    <p id="save-recovery-detail"></p>
    <p class="save-recovery-warning">Можно продолжить временно. Новый прогресс может исчезнуть после закрытия или перезагрузки страницы.</p>
    <div class="save-recovery-actions">
      <button type="button" class="dialog-button" data-recovery="download">Скачать исходное сохранение</button>
      <button type="button" class="dialog-button secondary" data-recovery="retry">Повторить загрузку</button>
      <button type="button" class="dialog-button secondary" data-recovery="continue">Продолжить без сохранения</button>
    </div>`
  const title = dialog.querySelector<HTMLElement>('h1')!
  const detail = dialog.querySelector<HTMLElement>('#save-recovery-detail')!
  const download = dialog.querySelector<HTMLButtonElement>('[data-recovery="download"]')!
  const retry = dialog.querySelector<HTMLButtonElement>('[data-recovery="retry"]')!
  const resume = dialog.querySelector<HTMLButtonElement>('[data-recovery="continue"]')!
  const update = () => {
    notice.hidden = !source.issue
    notice.textContent = source.blocked ? 'Сохранение защищено · Подробнее' : 'Прогресс не сохранён · Подробнее'
    title.textContent = source.blocked ? 'Сохранение под защитой' : 'Прогресс не сохранён'
    detail.textContent = source.issue === 'write-failed' && source.blocked
      ? 'Браузер не смог завершить перенос сохранения. Исходные данные сохранены. Освободите место или разрешите хранение данных сайта и нажмите «Повторить загрузку». Действия во временной игре не запишутся автоматически.'
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
  }
  const show = () => {
    update()
    if (!dialog.open) dialog.showModal()
    ;(download.disabled ? retry : download).focus()
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
  retry.addEventListener('click',() => location.reload())
  resume.addEventListener('click',() => dialog.close())
  document.body.append(notice,dialog)
  update()
  return {update,show}
}
