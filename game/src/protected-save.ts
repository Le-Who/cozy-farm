export type SaveStorage = Pick<Storage, 'getItem' | 'setItem'>
export type SaveIssue = 'invalid' | 'read-failed' | 'changed' | 'write-failed' | 'locking-unavailable' | 'migration-invalid' | 'missing-primary'

/** A failed load is a protected session, never permission to replace the save. */
export class ProtectedSave<T> {
  private storage: () => SaveStorage
  private key: string
  private restore: (value: unknown) => T | undefined
  private loaded = false
  private value: T | undefined
  private locked = true
  private observed: string | null | undefined
  private problem: SaveIssue | undefined

  constructor(storage: () => SaveStorage, key: string, restore: (value: unknown) => T | undefined) {
    this.storage = storage
    this.key = key
    this.restore = restore
  }

  get blocked() { return this.locked }
  get raw() { return this.observed }
  get issue() { return this.problem }

  load(): T | undefined {
    if (this.loaded) return this.value
    this.loaded = true
    try { this.observed = this.storage().getItem(this.key) }
    catch { this.problem = 'read-failed'; return }
    if (this.observed !== null) {
      try { this.value = this.restore(JSON.parse(this.observed)) }
      catch { /* Keep the exact stored string available for recovery. */ }
      if (this.value === undefined) { this.problem = 'invalid'; return }
    }
    this.locked = false
    return this.value
  }

  save(value: T): boolean {
    if (this.locked) return false
    let storage: SaveStorage
    try {
      storage = this.storage()
      const current = storage.getItem(this.key)
      if (current !== this.observed) {
        this.observed = current
        this.locked = true
        this.problem = 'changed'
        return false
      }
    } catch {
      this.locked = true
      this.problem = 'read-failed'
      return false
    }
    try {
      const raw = JSON.stringify(value)
      if (raw === undefined) throw new Error('Missing save value')
      storage.setItem(this.key, raw)
      this.observed = raw
      this.problem = undefined
      return true
    } catch { this.problem = 'write-failed'; return false }
  }
}
