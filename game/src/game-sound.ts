import { bayAudio } from './bay-audio.ts'

// Coalesced gestures and neighbouring footsteps share an acoustic cooldown.
const lastContact = new Map<string, number>()
export function playBaySound(id: string, strength = 1, cooldown = 110): void {
  const now = performance.now()
  if (now - (lastContact.get(id) ?? -Infinity) < cooldown) return
  lastContact.set(id, now)
  bayAudio.playEvent(id, strength)
}

export function setBaySoundContact(id: string, active: boolean, strength = 1): void {
  bayAudio.setContact(id, active && !document.hidden, strength)
}

/** Decode this scene's small bank while its artwork is opening; keep decoded takes for revisits. */
export function prepareBaySoundScene(ids: readonly string[], signal: AbortSignal): void {
  if (!bayAudio.settings.muted && bayAudio.settings.effects > 0 && bayAudio.settings.volume > 0) void bayAudio.unlock().then(ready => { if (ready && !signal.aborted) return bayAudio.primeEvents(ids) })
  signal.addEventListener('abort', () => { bayAudio.stopEffects(ids); for (const id of ids) lastContact.delete(id) }, { once: true })
}
