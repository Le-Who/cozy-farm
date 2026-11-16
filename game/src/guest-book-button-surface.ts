import { GuestBookInvitationPicker } from './guest-book-invitation-picker.ts'
import type { FarmState } from './farm.ts'
import { henFriends } from './hen-friendship.ts'
import { GuestBookActionAdapter, type GuestBookFocus } from './guest-book-action-adapter.ts'
import { GuestBookView, type GuestBookAction, type GuestBookSelection, type GuestBookCommand } from './guest-book-view.ts'
import { visitActivities, visitActivityIds, visitName } from './neighbor-visits.ts'

type Host = {
  /** Explicit local/test opt-in. This module has no production imports. */
  enabled: true
  root: HTMLElement
  farm(): FarmState
  active(): boolean
  /** Execute the unchanged host visit-* branch once, including its domain guards. */
  dispatch(command: { action: GuestBookAction; value: string }): void
  view?: GuestBookView
}
const escape = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!))
const choice = (part: string, value: string, text: string) => `<button type="button" data-action="guest-book-choice" data-guest-choice="${part}" data-value="${value}" aria-pressed="false">${escape(text)}</button>`
const commands = [
  ['invite', 'visit-invite'], ['home', 'visit-book-home'], ['do', 'visit-do'],
  ...henFriends.map((_, i) => [`hen-${i}`, 'visit-introduce-hen']),
  ['quiet', 'visit-reply'], ['curious', 'visit-reply'], ['close', 'close'], ['finish', 'visit-finish'],
] as const

/**
 * Actual button event surface, NOT an approved layout or a live-game replacement.
 * Mount once. Every control and real data-action exists before first input;
 * render updates retained nodes, never remounts a select or moves a CTA node.
 * Host must opt its ONE installActionClickGuard(root, { guestBookButtons: true })
 * in before delegating click. This class installs no listeners, guard or storage.
 */
export class GuestBookButtonSurface {
  readonly view: GuestBookView
  private readonly host: Host
  private readonly adapter: GuestBookActionAdapter
  private readonly picker: GuestBookInvitationPicker

  constructor(host: Host) {
    if (host.enabled !== true) throw new Error('Guest Book button surface requires explicit opt-in')
    this.host = host
    this.view = host.view ?? new GuestBookView()
    host.root.innerHTML = `<section data-guest-surface aria-label="Гостевая книга: кнопочный прототип">
      <section data-screen="invitation">
        <h2 data-focus="invitation" tabindex="-1">Кого пригласить</h2>
        <div data-invitation-choices>
          <div data-invitation-field="resident">
            <h3>Гость</h3>
            <button type="button" data-guest-picker="resident" data-action="guest-book-choice" aria-expanded="false" aria-label="Выбрать гостя" aria-controls="guest-resident-options"><span data-text="selected-resident"></span><span aria-hidden="true">⌄</span></button>
            <nav id="guest-resident-options" data-invitation-options="resident" aria-label="Кого пригласить">${(['bea', 'finn'] as const).map(id => choice('resident', id, visitName(id))).join('')}</nav>
          </div>
          <div data-invitation-field="activity">
            <h3>Занятие</h3>
            <button type="button" data-guest-picker="activity" data-action="guest-book-choice" aria-expanded="false" aria-label="Выбрать занятие" aria-controls="guest-activity-options"><span data-text="selected-activity"></span><span aria-hidden="true">⌄</span></button>
            <div id="guest-activity-options" data-invitation-options="activity">${(['bea', 'finn'] as const).map(id => `<nav data-activities="${id}" aria-label="Занятия: ${visitName(id)}">${visitActivityIds.filter(activity => visitActivities[activity].resident === id).map(activity => choice('activity', activity, visitActivities[activity].title)).join('')}</nav>`).join('')}</div>
          </div>
        </div>
        <div data-invitation-overview><p data-text="goal"></p><p data-text="gate"></p></div>
        <details data-invitation-preparation><summary>Подготовка</summary><div>
          <p data-text="readiness"></p><p data-text="invitation-copy"></p>
          <p>Бесплатно. Один гость; уйдёт после отдыха или поездки.</p>
        </div></details>
      </section>
      <section data-screen="active" hidden>
        <h2 data-focus="active" tabindex="-1" data-text="active-title"></h2>
        <div data-active-detail tabindex="0" aria-label="Подробности визита">
        <p data-text="active-message"></p><p data-text="active-readiness"></p>
        <strong data-text="observation-subject"></strong><p data-text="observation-detail"></p><p data-text="observation-ledger"></p>
        <p data-text="hen-note"></p><p data-text="reply-quiet"></p><p data-text="reply-curious"></p>
        </div>
      </section>
      <section data-screen="memories" hidden>
        <h2 data-focus="memories" tabindex="-1" data-text="memory-count"></h2>
        <nav data-memory-list aria-label="Выберите встречу">${visitActivityIds.map(id => choice('memory', id, `${visitName(visitActivities[id].resident)} · ${visitActivities[id].title}`)).join('')}</nav>
        <article data-memory-detail tabindex="0" aria-label="Воспоминание">
        <p data-text="memory-empty"></p><h3 data-text="memory-title"></h3><small data-text="memory-day"></small>
        <strong data-text="memory-subject"></strong><p data-text="memory-copy"></p><p data-text="memory-detail"></p><p data-text="memory-reply"></p>
        </article>
      </section>
      <section data-screen="rules" hidden>
        <h2 data-focus="rules" tabindex="-1">О визитах</h2>
        <p>Теперь соседи могут прийти к вам. Чтобы пригласить соседа, сначала устройте встречу с ним в Лавандовой гавани. За визит не нужно платить или отдавать угощение.</p>
        <p>Один гость за раз. Он уйдёт после отдыха или поездки, а воспоминания останутся. Повторные визиты не дают монет, урожая или очков дружбы.</p>
      </section>
      <div data-command-list>${commands.map(([key, action]) => `<button type="button" data-command-key="${key}" data-action="${action}" data-guest-command="${action}" data-value="" data-context="" disabled hidden></button>`).join('')}</div>
      <nav aria-label="Разделы гостевой книги">${choice('page', 'memories', 'Наши встречи')}${choice('page', 'rules', 'О визитах')}
        <button type="button" data-action="guest-book-back" data-guest-back hidden>К приглашениям</button>
      </nav>
    </section>`
    this.picker = new GuestBookInvitationPicker(host.root)
    this.adapter = new GuestBookActionAdapter({ ...host, view: this.view, redraw: focus => this.render(focus) })
    this.render()
  }

  /** Use from the one existing delegated host handler, AFTER capture. */
  click(event: MouseEvent): boolean {
    if (this.host.active() && this.picker.click(event)) return true
    const target = event.target as Element | null
    const control = target?.closest?.<HTMLButtonElement>('button[data-guest-command],button[data-guest-choice],button[data-guest-back]')
    if (!control || !this.host.root.contains(control)) return false
    // Owned but invalid specimens must not fall into an unrelated live branch.
    if (event.defaultPrevented || !this.host.active() || control.disabled || control.closest('[hidden],[inert]')) return true
    const document = control.ownerDocument
    const ownedCommandFocus = control.hasAttribute('data-guest-command') && document.activeElement === control
    let hostChoseFocus = false
    const trackFocus = (focus: FocusEvent) => { if (focus.target !== control) hostChoseFocus = true }
    if (ownedCommandFocus) document.addEventListener('focusin', trackFocus, true)
    try { this.adapter.click(event); this.picker.afterChoice(control, event) }
    finally { if (ownedCommandFocus) document.removeEventListener('focusin', trackFocus, true) }
    // Only this explicit, synchronous activation can hand off its hidden focus.
    // Passive render, a closed host, or a host-selected destination keep ownership.
    if (ownedCommandFocus && !hostChoseFocus && this.host.active() && this.host.root.contains(control)
      && control.closest('[hidden],[inert]')
      && (document.activeElement === control || document.activeElement === document.body)) {
      const next = [...this.host.root.querySelectorAll<HTMLButtonElement>('button[data-guest-command]')]
        .find(button => !button.disabled && !button.closest('[hidden],[inert]'))
      next?.focus({ preventScroll: true })
      next?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
    }
    return true
  }

  /** Nested pages own Back first; root falls through to existing parent history. */
  back(event: Event): boolean {
    if (event.defaultPrevented || !this.host.active()) return false
    if (this.picker.back(event)) return true
    if ('repeat' in event && event.repeat) { event.preventDefault(); return true }
    return this.adapter.back(event)
  }

  snapshot(): GuestBookSelection { return this.view.snapshot() }

  /** Explicit panel-history return only. Passive render never restores focus/scroll. */
  restore(selection: unknown, focus?: GuestBookFocus): boolean {
    if (!this.view.restore(selection)) return false
    this.render(focus)
    return true
  }

  render(focus?: GuestBookFocus): void {
    const root = this.host.root, farm = this.host.farm(), screen = this.view.current(farm), selection = this.view.snapshot()
    root.querySelector<HTMLElement>('[data-guest-surface]')!.dataset.guestScreen = screen.kind
    const activity = visitActivities[screen.activity]
    const text = (key: string, value: string) => {
      const element = root.querySelector<HTMLElement>(`[data-text="${key}"]`)!
      if (element.textContent !== value) element.textContent = value
    }
    for (const section of root.querySelectorAll<HTMLElement>('[data-screen]')) section.hidden = section.dataset.screen !== screen.kind
    for (const group of root.querySelectorAll<HTMLElement>('[data-activities]')) group.hidden = group.dataset.activities !== screen.resident
    for (const button of root.querySelectorAll<HTMLButtonElement>('[data-guest-choice]')) {
      const { guestChoice: part, value } = button.dataset
      const memory = screen.memories.find(item => item.activity === value)
      button.hidden = part === 'memory' ? !memory : part === 'page' && selection.page === value
      button.setAttribute('aria-pressed', String(part === 'resident' ? value === selection.resident : part === 'activity' ? value === selection.activity : part === 'memory' ? value === screen.memory?.activity : value === selection.page))
      if (part === 'memory' && memory) button.textContent = `${visitName(visitActivities[memory.activity].resident)} · ${visitActivities[memory.activity].title} · День ${memory.day}`
      if (part === 'page' && value === 'memories') button.textContent = `Наши встречи · ${screen.memories.length}/${visitActivityIds.length}`
    }
    text('selected-resident', visitName(screen.resident)); text('selected-activity', activity.title)
    root.querySelector('[data-guest-picker="resident"]')!.setAttribute('aria-label', `Гость: ${visitName(screen.resident)}. Выбрать гостя`)
    root.querySelector('[data-guest-picker="activity"]')!.setAttribute('aria-label', `Занятие: ${activity.title}. Выбрать занятие`)
    root.querySelector<HTMLElement>('[data-text="goal"]')!.hidden = !!screen.gate
    root.querySelector<HTMLElement>('[data-text="gate"]')!.hidden = !screen.gate
    text('goal', activity.goal); text('readiness', screen.readiness ?? ''); text('gate', screen.gate ?? ''); text('invitation-copy', activity.invitation)
    const active = screen.active, observation = active?.observation
    const recorded = !!active && screen.memories.some(memory => memory.activity === active.activity && memory.serial === active.serial)
    text('active-title', `${visitName(screen.resident)} · ${activity.title}`)
    text('active-message', observation ? recorded ? activity.memory : 'О чём поговорим перед уходом?' : `${activity.invitation} ${activity.goal}`)
    text('active-readiness', observation ? '' : screen.readiness ?? '')
    text('observation-subject', observation ? `${recorded ? '' : 'Сегодня: '}${observation.subject}` : '')
    text('observation-detail', observation?.detail ?? '')
    text('observation-ledger', observation ? recorded ? 'Воспоминание добавлено в книгу.' : 'В книге осталась ваша первая встреча за этим занятием.' : '')
    text('hen-note', active && !observation && activity.kind === 'hen' ? 'Знакомство с гостем не даёт дополнительных шагов дружбы с курочкой.' : '')
    text('reply-quiet', observation ? activity.quiet : ''); text('reply-curious', observation ? activity.curious : '')
    const memory = screen.memory, remembered = memory && visitActivities[memory.activity]
    text('memory-count', `Наши домашние встречи · ${screen.memories.length}/${visitActivityIds.length}`)
    text('memory-empty', memory ? '' : 'Здесь останутся первые встречи: урожай, выпечка и знакомства с вашими курочками. Можно собирать их в любом порядке.')
    text('memory-title', remembered?.title ?? ''); text('memory-day', memory && remembered ? `${visitName(remembered.resident)} · День ${memory.day}` : '')
    text('memory-subject', memory?.subject ?? ''); text('memory-copy', remembered?.memory ?? ''); text('memory-detail', memory?.detail ?? '')
    text('memory-reply', memory?.reply && remembered ? remembered[memory.reply] : '')
    const commandKey = (command: GuestBookCommand) => command.action === 'visit-invite' ? 'invite' : command.action === 'visit-book-home' ? 'home' : command.action === 'visit-do' ? 'do' : command.action === 'visit-introduce-hen' ? `hen-${command.value.split(':')[1]}` : command.action === 'visit-reply' ? command.value.split(':')[1] : command.action === 'visit-finish' ? 'finish' : 'close'
    for (const button of root.querySelectorAll<HTMLButtonElement>('[data-command-key]')) {
      const command = screen.commands.find(item => commandKey(item) === button.dataset.commandKey)
      button.hidden = !command; button.disabled = !command?.enabled
      button.dataset.context = command?.context ?? ''; button.dataset.value = command?.value ?? ''
      if (button.textContent !== (command?.label ?? '')) button.textContent = command?.label ?? ''
    }
    const back = root.querySelector<HTMLButtonElement>('[data-guest-back]')!
    back.hidden = selection.page === 'visit'; back.textContent = farm.neighborVisits.active ? 'К гостю' : 'К приглашениям'
    if (!focus) return
    if (focus.part === 'memory') root.querySelector<HTMLElement>('[data-memory-detail]')!.scrollTop = 0
    const choice = [...root.querySelectorAll<HTMLElement>('[data-guest-choice]')].find(button => button.dataset.guestChoice === focus.part && button.dataset.value === focus.value && !button.closest('[hidden]'))
    const command = focus.part === 'command' ? [...root.querySelectorAll<HTMLElement>('[data-command-key]')].find(button => button.dataset.commandKey === focus.value && !button.closest('[hidden]') && !button.hasAttribute('disabled')) : undefined
    const destination = command ?? choice ?? root.querySelector<HTMLElement>(`[data-focus="${screen.kind}"]`)
    this.picker.reveal(destination)
    destination?.focus({ preventScroll: true })
    // Explicit navigation alone may reveal its target. Passive redraws return above.
    if (screen.kind === 'active' || screen.kind === 'memories') destination?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
  }
}
