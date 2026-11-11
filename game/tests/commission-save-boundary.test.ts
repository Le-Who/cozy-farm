import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createFarm, restoreFarm, restoreCurrentFarm } from '../src/farm.ts'
import { farmSaveKeys as keys, recoveredFarmSaveKeys as v3, publishedFarmSaveKeys as v2 } from '../src/farm-save-keys.ts'
import { VersionedSave, type ExclusiveSave } from '../src/versioned-save.ts'
import { commissionPlayer } from './fixtures/commission-player.ts'
import { getShopCommissionOffers } from '../src/shop-commissions.ts'
class Storage {
  items = new Map<string, string>(); writes: string[] = []; fail?: string
  getItem(key: string) { return this.items.get(key) ?? null }
  setItem(key: string, raw: string) { if (key === this.fail) throw Error('full'); this.writes.push(key); this.items.set(key, raw) }
}
const exclusive: ExclusiveSave = async action => action()
const open = (s: Storage, lock: ExclusiveSave | undefined = exclusive) => new VersionedSave(() => s, keys, restoreCurrentFarm, createFarm, lock, restoreFarm)
function old() { const f = structuredClone(createFarm()) as any; delete f.shopCommissions; f.coins = 432; return '\n'+JSON.stringify(f)+'\n' }

test('v4 imports absent-ledger v3, v2 and v1 exactly once, preserving original bytes', async () => {
  for (const key of [v3.primary, v2.primary, v2.legacy]) {
    const s = new Storage(), raw = old(); s.items.set(key, raw)
    const save = open(s), f = (await save.load())!
    assert.equal(f.coins, 432); assert.ok(f.shopCommissions); assert.equal(save.blocked, false)
    assert.equal(s.getItem(key), raw); assert.equal(JSON.parse(s.getItem(keys.journal)!).legacyRaw, raw)
    assert.ok(s.writes.every(k => k === keys.primary || k === keys.journal))
    assert.ok(restoreCurrentFarm(JSON.parse(s.getItem(keys.primary)!)))
  }
})

test('partial real portions persist in v4 while an old v3 tab overwrites its own generation', async () => {
  const s = new Storage(), opening = JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json', import.meta.url), 'utf8'))
  const p = commissionPlayer(opening), id = p.cook(); p.shelf(id); p.sale(); p.cook(id)
  const oldFarm = structuredClone(p.state) as any; delete oldFarm.shopCommissions
  s.items.set(v3.primary, JSON.stringify(oldFarm)); const save = open(s); await save.load()
  p.act('acceptShopCommission', getShopCommissionOffers(p.state)[0].key)
  p.act('deliverShopCommission', String(p.state.shopCommissions.serial)); assert.equal(await save.save(p.state), true)
  const exact = s.getItem(keys.primary)
  s.items.set(v3.primary, old())
  const loaded = (await open(s).load())!
  assert.equal(loaded.shopCommissions.active!.delivered, 1)
  assert.equal(loaded.culinary.stock[id], 0)
  assert.equal(s.getItem(keys.primary), exact)
})

test('a missing ledger or unknown version in current primary never replays a healthy legacy', async () => {
  for (const raw of [old(), JSON.stringify({ ...createFarm(), shopCommissions: { version: 99 } }), '{broken']) {
    const s = new Storage(); s.items.set(v3.primary, old()); s.items.set(keys.primary, raw)
    const before = [...s.items], save = open(s)
    assert.equal(await save.load(), undefined); assert.equal(save.issue, 'invalid'); assert.equal(save.raw, raw)
    assert.equal(await save.save(createFarm()), false); assert.deepEqual([...s.items], before); assert.deepEqual(s.writes, [])
  }
})

test('an incomplete ledger in a v3 input is not treated as a legacy missing field', async () => {
  const s = new Storage(); s.items.set(v3.primary, JSON.stringify({ ...createFarm(), shopCommissions: { version: 1 } }))
  const save = open(s); assert.equal(await save.load(), undefined); assert.equal(save.issue, 'invalid'); assert.deepEqual(s.writes, [])
})

test('missing any previously migrated primary blocks rollback through earlier generations', async () => {
  for (const key of [v3.journal, v2.journal]) {
    const s = new Storage(); s.items.set(key, '{previous-migration}'); s.items.set(v2.legacy, old())
    const save = open(s); assert.equal(await save.load(), undefined); assert.equal(save.issue, 'missing-primary')
    assert.equal(save.raw, '{previous-migration}'); assert.deepEqual(s.writes, [])
  }
})

test('interrupted migration resumes its frozen upgraded snapshot, not a changed legacy', async () => {
  const s = new Storage(), raw = old(); s.items.set(v3.primary, raw); s.fail = keys.primary
  const first = open(s); assert.equal((await first.load())!.coins, 432); assert.equal(first.issue, 'write-failed')
  const frozen = JSON.parse(s.getItem(keys.journal)!)
  assert.equal(frozen.phase, 'pending'); assert.equal(frozen.legacyRaw, raw)
  s.items.set(v3.primary, '{changed}'); s.fail = undefined
  const next = open(s); assert.equal((await next.load())!.coins, 432); assert.equal(next.blocked, false)
  assert.equal(s.getItem(keys.primary), frozen.initialRaw)
})

test('current pending snapshot must have a valid ledger and cannot silently import it as legacy', async () => {
  const s = new Storage(); s.items.set(keys.journal, JSON.stringify({ version: 1, phase: 'pending', legacyRaw: old(), initialRaw: old() }))
  const save = open(s); assert.equal(await save.load(), undefined); assert.equal(save.issue, 'migration-invalid'); assert.deepEqual(s.writes, [])
})

test('no-lock migration is read-only even with an eligible legacy save', async () => {
  const s = new Storage(); s.items.set(v3.primary, old())
  const save = new VersionedSave(() => s, keys, restoreCurrentFarm, createFarm, undefined, restoreFarm)
  assert.equal((await save.load())!.coins, 432); assert.equal(save.issue, 'locking-unavailable')
  assert.equal(await save.save(createFarm()), false); assert.deepEqual(s.writes, [])
})
