import { ProtectedSave, type SaveIssue, type SaveStorage } from './protected-save.ts'

type LegacyFallback = { key: string; journal: string; fallback?: LegacyFallback }

export type SaveKeys = {
  primary: string; legacy: string; journal: string
  /** Older-than-legacy data is eligible only if no legacy migration ever started. */
  legacyFallback?: LegacyFallback
}
export type ExclusiveSave = <R>(operation: () => R) => Promise<R>
export type RecoveryOrigin = 'primary' | 'legacy' | 'snapshot' | 'journal'
type MigrationJournal = { version: 1; phase: 'pending' | 'complete'; legacyRaw: string | null; legacyKey?: string; initialRaw: string }

/** Serialize every current-version writer, with no unsafe unlocked fallback. */
export function browserSaveLock(name: string): ExclusiveSave | undefined {
  try { return navigator.locks ? operation => navigator.locks.request(name, operation) : undefined }
  catch { return undefined }
}

/**
 * One-way save boundary. Legacy data is read, never written or deleted.
 * A frozen pending journal can resume interrupted initialization. Only after
 * primary and complete journal are durable may gameplay start saving.
 * Completed migration + missing primary is damage, never permission to replay.
 */
export class VersionedSave<T> {
  private loaded?: Promise<T | undefined>
  private guard?: ProtectedSave<T>
  private locked = true
  private problem?: SaveIssue
  private original: string | null | undefined
  private origin: RecoveryOrigin = 'primary'
  private expectedJournal?: string

  private storage: () => SaveStorage
  private keys: SaveKeys
  private restore: (value: unknown) => T | undefined
  private restoreLegacy: (value: unknown, sourceKey: string) => T | undefined
  private create: () => T
  private exclusive?: ExclusiveSave

  constructor(storage: () => SaveStorage, keys: SaveKeys, restore: (value: unknown) => T | undefined, create: () => T, exclusive?: ExclusiveSave, restoreLegacy: (value: unknown, sourceKey: string) => T | undefined = restore) {
    this.storage = storage; this.keys = keys; this.restore = restore; this.create = create; this.exclusive = exclusive; this.restoreLegacy = restoreLegacy
  }

  get blocked() { return this.locked || (this.guard?.blocked ?? true) }
  get issue() { return this.problem ?? this.guard?.issue }
  get raw() { return this.guard ? this.guard.raw : this.original }
  get recoveryOrigin(): RecoveryOrigin { return this.guard ? 'primary' : this.origin }

  load(): Promise<T | undefined> {
    return this.loaded ??= this.loadOnce()
  }

  private decode(raw: string): T | undefined {
    try { return this.restore(JSON.parse(raw)) }
    catch { return undefined }
  }

  /** Old journals without a source use the immediate legacy generation, never a weaker fallback. */
  private decodeLegacy(raw: string, sourceKey = this.keys.legacy): T | undefined {
    try { return this.restoreLegacy(JSON.parse(raw), sourceKey) }
    catch { return undefined }
  }

  private isLegacyKey(key: unknown): key is string {
    if (key === this.keys.legacy) return true
    let fallback = this.keys.legacyFallback
    while (fallback) {
      if (key === fallback.key) return true
      fallback = fallback.fallback
    }
    return false
  }

  private journal(raw: string): MigrationJournal | undefined {
    try {
      const value = JSON.parse(raw)
      if (!value || value.version !== 1 || !['pending', 'complete'].includes(value.phase)
        || !(value.legacyRaw === null || typeof value.legacyRaw === 'string')
        || value.legacyKey !== undefined && (value.legacyRaw === null || !this.isLegacyKey(value.legacyKey))
        || typeof value.initialRaw !== 'string' || this.decode(value.initialRaw) === undefined
        || value.legacyRaw !== null && this.decodeLegacy(value.legacyRaw, value.legacyKey) === undefined) return
      return value
    } catch { return undefined }
  }

  private readLegacy(storage: SaveStorage): { raw: string | null; key: string } | undefined {
    const raw = storage.getItem(this.keys.legacy)
    if (raw !== null || !this.keys.legacyFallback) return { raw, key: this.keys.legacy }
    let fallback: LegacyFallback | undefined = this.keys.legacyFallback
    while (fallback) {
      const journal = storage.getItem(fallback.journal)
      if (journal !== null) {
        // A migration record without its primary is damage, never permission
        // to skip a generation and silently resurrect an older farm.
        this.original = journal
        this.origin = 'journal'
        this.problem = 'missing-primary'
        return
      }
      const older = storage.getItem(fallback.key)
      if (older !== null) return { raw: older, key: fallback.key }
      fallback = fallback.fallback
    }
    return { raw: null, key: this.keys.legacy }
  }

  private async loadOnce(): Promise<T | undefined> {
    if (!this.exclusive) return this.readOnly()
    try { return await this.exclusive(() => this.initialize()) }
    catch { return this.readOnly() }
  }

  private readOnly(): T | undefined {
    this.problem = 'locking-unavailable'
    try {
      const storage = this.storage(), primary = storage.getItem(this.keys.primary)
      this.original = primary
      if (primary !== null) {
        const value = this.decode(primary)
        if (value === undefined) this.problem = 'invalid'
        return value
      }
      const rawJournal = storage.getItem(this.keys.journal)
      if (rawJournal !== null) {
        const journal = this.journal(rawJournal)
        this.original = journal?.legacyRaw ?? journal?.initialRaw ?? rawJournal
        this.origin = journal ? 'snapshot' : 'journal'
        if (!journal) { this.problem = 'migration-invalid'; return }
        if (journal.phase === 'complete') { this.problem = 'missing-primary'; return }
        return this.decode(journal.initialRaw)
      }
      const legacy = this.readLegacy(storage)
      if (!legacy) return
      this.original = legacy.raw
      this.origin = 'legacy'
      if (this.original === null) return
      const value = this.decodeLegacy(this.original, legacy.key)
      if (value === undefined) this.problem = 'invalid'
      return value
    } catch { this.problem = 'read-failed'; return }
  }

  private initialize(): T | undefined {
    let storage: SaveStorage, primary: string | null = null, rawJournal: string | null
    try {
      storage = this.storage()
      primary = storage.getItem(this.keys.primary)
      this.original = primary
      rawJournal = storage.getItem(this.keys.journal)
    } catch { this.problem = 'read-failed'; return primary === null ? undefined : this.decode(primary) }

    // A present primary is authoritative, including empty or corrupt bytes.
    if (primary !== null && this.decode(primary) === undefined) { this.problem = 'invalid'; return }
    let journal: MigrationJournal | undefined
    if (rawJournal !== null) {
      journal = this.journal(rawJournal)
      if (!journal) {
        if (primary === null) { this.original = rawJournal; this.origin = 'journal' }
        this.problem = 'migration-invalid'
        return primary === null ? undefined : this.decode(primary)
      }
    }
    if (primary === null && journal?.phase === 'complete') {
      this.original = journal.legacyRaw ?? journal.initialRaw
      this.origin = 'snapshot'
      this.problem = 'missing-primary'
      return
    }
    if (primary === null && !journal) {
      let legacy: string | null, legacyKey: string
      try {
        const source = this.readLegacy(storage)
        if (!source) return
        legacy = source.raw
        legacyKey = source.key
      }
      catch { this.problem = 'read-failed'; return }
      this.original = legacy
      this.origin = 'legacy'
      const value = legacy === null ? this.create() : this.decodeLegacy(legacy, legacyKey)
      if (value === undefined) { this.problem = 'invalid'; return }
      try {
        const initialRaw = JSON.stringify(value)
        if (initialRaw === undefined) throw new Error('Missing initial farm')
        journal = { version: 1, phase: 'pending', legacyRaw: legacy, ...(legacy === null ? {} : { legacyKey }), initialRaw }
        // Preserve the exact legacy bytes before publishing a current save.
        rawJournal = JSON.stringify(journal)
        storage.setItem(this.keys.journal, rawJournal)
      } catch { this.problem = 'write-failed'; return value }
    }
    try {
      if (primary === null) {
        // On retry use only the frozen snapshot, never a changed legacy key.
        this.original = journal!.legacyRaw ?? journal!.initialRaw
        this.origin = 'snapshot'
        primary = journal!.initialRaw
        storage.setItem(this.keys.primary, primary)
      }
      if (!journal || journal.phase === 'pending') {
        journal = journal ? { ...journal, phase: 'complete' }
          : { version: 1, phase: 'complete', legacyRaw: null, initialRaw: primary }
        rawJournal = JSON.stringify(journal)
        storage.setItem(this.keys.journal, rawJournal)
      }
    } catch { this.problem = 'write-failed'; return this.decode(primary ?? journal!.initialRaw) }
    this.expectedJournal = rawJournal!
    this.guard = new ProtectedSave(this.storage, this.keys.primary, this.restore)
    const value = this.guard.load()
    this.locked = this.guard.blocked
    return value
  }

  async save(value: T): Promise<boolean> {
    if (this.blocked || !this.exclusive || !this.guard) return false
    let snapshot: T
    // Capture this action before waiting for another tab's lock.
    try { snapshot = JSON.parse(JSON.stringify(value)) }
    catch { this.problem = 'write-failed'; return false }
    try {
      return await this.exclusive(() => {
        if (this.blocked) return false
        try {
          if (this.storage().getItem(this.keys.journal) !== this.expectedJournal) {
            this.problem = 'changed'
            this.locked = true
            return false
          }
        } catch { this.problem = 'read-failed'; this.locked = true; return false }
        this.problem = undefined
        return this.guard!.save(snapshot)
      })
    } catch {
      this.problem = 'locking-unavailable'
      this.locked = true
      return false
    }
  }
}
