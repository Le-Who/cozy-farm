/** Local disclosure state only. Choice/command identity and domain state stay owned by the existing surface. */
export class GuestBookInvitationPicker {
  private readonly root: HTMLElement
  constructor(root: HTMLElement) { this.root = root }
  private compact(): boolean { return this.root.ownerDocument.defaultView?.matchMedia?.('(max-height: 460px) and (orientation: landscape)').matches ?? false }
  private set(part?: string): void {
    for (const field of this.root.querySelectorAll<HTMLElement>('[data-invitation-field]')) {
      const expanded = field.dataset.invitationField === part
      field.dataset.expanded = String(expanded)
      field.querySelector('button[data-guest-picker]')?.setAttribute('aria-expanded', String(expanded))
    }
  }
  click(event: MouseEvent): boolean {
    const button = (event.target as Element | null)?.closest?.<HTMLButtonElement>('button[data-guest-picker]')
    if (!button || !this.root.contains(button)) return false
    if (event.defaultPrevented || button.disabled || button.closest('[hidden],[inert]') || !this.compact()) return true
    this.set(button.getAttribute('aria-expanded') === 'true' ? undefined : button.dataset.guestPicker)
    return true
  }
  afterChoice(button: HTMLButtonElement, event: MouseEvent): void {
    const part = button.dataset.guestChoice
    if (event.defaultPrevented || !this.compact() || (part !== 'resident' && part !== 'activity')) return
    this.set()
    this.root.querySelector<HTMLButtonElement>(`[data-guest-picker="${part}"]`)?.focus({ preventScroll: true })
  }
  back(event: Event): boolean {
    if (!this.compact()) return false
    const open = this.root.querySelector<HTMLButtonElement>('[data-guest-picker][aria-expanded="true"]')
    if (!open) return false
    event.preventDefault(); this.set(); open.focus({ preventScroll: true }); return true
  }
  /** An explicit history restore can expose the selected retained option before focus. */
  reveal(destination?: HTMLElement | null): void {
    const part = destination?.dataset.guestChoice
    if (this.compact() && (part === 'resident' || part === 'activity')) this.set(part)
  }
}
