import type { FarmState } from './farm.ts'
import type { GuestBookAction, GuestBookView } from './guest-book-view.ts'

/** Proposed exact keys, not installed in production's guard or renderer. */
export const guestBookGuardProposal = ['guest-book-choice', 'guest-book-back'] as const
export type GuestBookFocus = { part: string; value: string }
type Command = { action: GuestBookAction; value: string }
type Host = {
  root: HTMLElement
  view: GuestBookView
  farm(): FarmState
  active(): boolean
  redraw(focus: GuestBookFocus): void
  /** Call the existing domain/route branch once; never synthesize another click. */
  dispatch(command: Command): void
}

/**
 * Opt-in prototype only. Installs NO listeners and owns NO save/gesture state.
 * Call from the host's one delegated handler AFTER its existing capture guard.
 * All controls must have their real data-action BEFORE DOM insertion. The two
 * proposed button keys and native-select gesture contract are not yet shipped.
 */
export class GuestBookActionAdapter {
  private readonly host: Host
  constructor(host: Host) { this.host = host }

  private control(event: Event, selector: string): HTMLElement | undefined {
    if (event.defaultPrevented || !this.host.active()) return
    const target = event.target as Element | null
    if (!target || typeof target.closest !== 'function') return
    const control = target.closest<HTMLElement>(selector)
    if (!control || !this.host.root.contains(control) || control.hasAttribute('disabled')) return
    return control
  }

  click(event: MouseEvent): boolean {
    const control = this.control(event, 'button[data-guest-command],button[data-guest-choice],button[data-guest-back]')
    if (!control) return false
    const { action, guestCommand, guestChoice, value = '', context } = control.dataset
    if (guestCommand !== undefined) {
      if (action !== guestCommand) return false
      const command = this.host.view.resolve(this.host.farm(), { action, value, context })
      if (command) this.host.dispatch(command)
      return true // stale/forged specimen is consumed, never falls into another live branch
    }
    if (guestChoice !== undefined) {
      if (action !== 'guest-book-choice') return false
      if (this.host.view.choose(this.host.farm(), guestChoice, value)) this.host.redraw({ part: guestChoice, value })
      return true
    }
    if (action !== 'guest-book-back') return false
    this.back(event)
    return true
  }

  change(event: Event): boolean {
    const control = this.control(event, 'select[data-guest-choice]') as HTMLSelectElement | undefined
    if (!control || control.dataset.action !== 'guest-book-choice') return false
    const part = control.dataset.guestChoice!
    if (part !== 'activity' && part !== 'memory') return true
    if (this.host.view.choose(this.host.farm(), part, control.value)) this.host.redraw({ part, value: control.value })
    return true
  }

  /** Call first for header Back, cancel/Escape and Alt+Left; false uses host history. */
  back(event: Event): boolean {
    if (event.defaultPrevented || !this.host.active()) return false
    const page = this.host.view.snapshot().page
    if (!this.host.view.back()) return false
    event.preventDefault()
    this.host.redraw({ part: 'page', value: page })
    return true
  }
}
