import test from 'node:test'
import assert from 'node:assert/strict'
import { createFarm, restoreCurrentFarm } from '../src/farm.ts'
import { restoreLegacyFarm } from '../src/farm-save-migration.ts'
import { farmSaveKeys as keys, commissionFarmSaveKeys as v4, recoveredFarmSaveKeys as v3, publishedFarmSaveKeys as v2 } from '../src/farm-save-keys.ts'
import { VersionedSave, type ExclusiveSave } from '../src/versioned-save.ts'
class Storage {
  items = new Map<string, string>(); writes: string[] = []; fail?: string
  getItem(key: string) { return this.items.get(key) ?? null }
  setItem(key: string, raw: string) { if (key === this.fail) throw Error('full'); this.items.set(key, raw); this.writes.push(key) }
}
const lock: ExclusiveSave = async operation => operation()
const open = (s: Storage, exclusive: ExclusiveSave | undefined = lock) => new VersionedSave(() => s, keys, restoreCurrentFarm, createFarm, exclusive, restoreLegacyFarm)
function old(withLedger = false) {
  const f = structuredClone(createFarm()) as any; delete f.henFriendship
  if (!withLedger) delete f.shopCommissions
  f.coins = 432
  return '\n' + JSON.stringify(f) + '\n'
}

test('a v4 primary missing its escrow ledger blocks migration without replaying healthy v3 or writing anything', async () => {
  for (const exclusive of [lock, undefined]) {
    const s = new Storage(), raw = old(); s.items.set(v4.primary, raw); s.items.set(v3.primary, old())
    const save = new VersionedSave(() => s, keys, restoreCurrentFarm, createFarm, exclusive, restoreLegacyFarm), before = [...s.items]
    assert.equal(await save.load(), undefined); assert.equal(save.issue, 'invalid'); assert.equal(save.raw, raw)
    assert.equal(await save.save(createFarm()), false); assert.deepEqual([...s.items], before); assert.deepEqual(s.writes, [])
  }
})

test('v3, v2 and v1 alone may initialize the absent ledger, and freeze the precise source generation', async () => {
  for (const source of [v3.primary, v2.primary, v2.legacy]) {
    const s = new Storage(), raw = old(); s.items.set(source, raw); const save = open(s), f = (await save.load())!
    assert.equal(save.blocked, false); assert.equal(f.coins, 432); assert.ok(f.shopCommissions); assert.ok(f.henFriendship)
    assert.equal(s.getItem(source), raw); assert.equal(JSON.parse(s.getItem(keys.journal)!).legacyKey, source)
    assert.ok(await open(s).load()); assert.ok(s.writes.every(key => key === keys.primary || key === keys.journal))
  }
})

test('a valid v4 imports its exact ledger and a new friendship diary, without modifying v4 bytes', async () => {
  const s = new Storage(), raw = old(true); s.items.set(v4.primary, raw); const f = (await open(s).load())!
  assert.deepEqual(f.shopCommissions, JSON.parse(raw).shopCommissions); assert.ok(f.henFriendship)
  assert.equal(s.getItem(v4.primary), raw); assert.equal(JSON.parse(s.getItem(keys.journal)!).legacyKey, v4.primary)
})

test('pending migration resumes the frozen v3 source after source changes, never reclassifying it as v4', async () => {
  const s = new Storage(), raw = old(); s.items.set(v3.primary, raw); s.fail = keys.primary
  const first = open(s); assert.ok(await first.load()); assert.equal(first.issue, 'write-failed')
  const frozen = JSON.parse(s.getItem(keys.journal)!); assert.equal(frozen.legacyKey, v3.primary)
  s.items.set(v3.primary, '{changed}'); s.items.set(v4.primary, old()); s.fail = undefined
  const second = open(s); assert.equal((await second.load())?.coins, 432); assert.equal(second.blocked, false)
  assert.equal(s.getItem(keys.primary), frozen.initialRaw)
})

test('pending v4 or unclassified old journals cannot conceal a missing escrow ledger', async () => {
  for (const legacyKey of [v4.primary, undefined, 'unknown-generation', keys.primary, null]) {
    const s = new Storage(); s.items.set(keys.journal, JSON.stringify({ version: 1, phase: 'pending', legacyKey, legacyRaw: old(), initialRaw: JSON.stringify(createFarm()) }))
    const before = [...s.items], save = open(s); assert.equal(await save.load(), undefined); assert.equal(save.issue, 'migration-invalid')
    assert.equal(await save.save(createFarm()), false); assert.deepEqual([...s.items], before); assert.deepEqual(s.writes, [])
  }
})

test('a source-less v6 journal requires both ledgers of its immediate v5 source', async () => {
  const s = new Storage(); s.items.set(keys.journal, JSON.stringify({ version: 1, phase: 'pending', legacyRaw: JSON.stringify(createFarm()), initialRaw: JSON.stringify(createFarm()) }))
  const save = open(s); assert.ok(await save.load()); assert.equal(save.blocked, false)
})
