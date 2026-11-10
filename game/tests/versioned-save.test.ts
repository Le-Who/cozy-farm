import assert from 'node:assert/strict'
import test from 'node:test'
import { createFarm, endDay, restoreFarm, returnNurseryTree, storeTree } from '../src/farm.ts'
import { receiveFerryExpedition, sendFerryExpedition } from '../src/harbour-economy.ts'
import { farmSaveKeys as keys } from '../src/farm-save-keys.ts'
import { VersionedSave, type ExclusiveSave } from '../src/versioned-save.ts'

class Storage {
  items = new Map<string, string>()
  writes: [string, string][] = []
  failWrite?: (key: string, raw: string) => boolean
  failRead?: string
  getItem(key: string) { if (key === this.failRead) throw new Error('denied'); return this.items.get(key) ?? null }
  setItem(key: string, raw: string) {
    if (this.failWrite?.(key, raw)) throw new Error('full')
    this.items.set(key, raw)
    this.writes.push([key, raw])
  }
}
function locks(): ExclusiveSave {
  let tail: Promise<unknown> = Promise.resolve()
  return <R>(operation: () => R) => {
    const next = tail.then(operation)
    tail = next.catch(() => {})
    return next
  }
}
function fixture() {
  const storage = new Storage(), exclusive = locks()
  const open = () => new VersionedSave(() => storage, keys, restoreFarm, createFarm, exclusive)
  return { storage, exclusive, open }
}
function oldFarm() {
  const farm = JSON.parse(JSON.stringify(createFarm()))
  farm.coins = 234
  delete farm.treeNursery
  delete farm.treeNurserySerial
  delete farm.freight.expeditions
  return farm
}

test('migration preserves exact legacy bytes and initializes only the separate primary and journal', async () => {
  const { storage, open } = fixture(), original = '\n ' + JSON.stringify(oldFarm()) + '\n'
  storage.items.set(keys.legacy, original)
  const save = open(), farm = await save.load()
  assert.ok(farm)
  assert.equal(farm.coins, 234)
  assert.deepEqual(farm.treeNursery, [])
  assert.equal(farm.freight.expeditions.active, null)
  assert.equal(save.blocked, false)
  assert.equal(await save.load(), farm)
  assert.equal(storage.getItem(keys.legacy), original)
  assert.deepEqual(storage.writes.map(([key]) => key), [keys.journal, keys.primary, keys.journal])
  const journal = JSON.parse(storage.getItem(keys.journal)!)
  assert.equal(journal.phase, 'complete')
  assert.equal(journal.legacyRaw, original)
  assert.equal(journal.initialRaw, JSON.stringify(farm))
  const before = storage.writes.length
  assert.equal((await open().load())?.coins, 234)
  assert.equal(storage.writes.length, before, 'ordinary reload never reruns migration')
})

test('old tabs and rollback can update legacy without touching current nursery or paid voyages', async () => {
  const { storage, open } = fixture(), original = JSON.stringify(oldFarm())
  storage.items.set(keys.legacy, original)
  const save = open(), farm = (await save.load())!
  farm.boatOwned = true; farm.produce.wheat = 4
  assert.equal(storeTree(farm, 0).ok, true)
  assert.equal(sendFerryExpedition(farm, 'mill-baking').ok, true)
  assert.equal(await save.save(farm), true)
  const primary = storage.getItem(keys.primary), journal = storage.getItem(keys.journal)
  storage.items.set(keys.legacy, JSON.stringify({ ...oldFarm(), coins: 1, day: 99 }))
  const reloaded = (await open().load())!
  assert.equal(reloaded.coins, 224)
  assert.equal(reloaded.treeNursery.length, 1)
  assert.equal(reloaded.freight.expeditions.active?.id, 'mill-baking')
  assert.equal(storage.getItem(keys.primary), primary)
  assert.equal(storage.getItem(keys.journal), journal)
  assert.equal(JSON.parse(journal!).legacyRaw, original)
  assert.equal(storage.writes.some(([key]) => key === keys.legacy), false)
})

test('any existing primary is authoritative; corrupt or future primary never falls back to legacy', async () => {
  for (const primary of ['', '{broken', 'null', '{"version":999}']) {
    const { storage, open } = fixture()
    storage.items.set(keys.legacy, JSON.stringify(oldFarm()))
    storage.items.set(keys.primary, primary)
    const save = open()
    assert.equal(await save.load(), undefined)
    assert.equal(save.issue, 'invalid')
    assert.equal(save.raw, primary)
    assert.equal(await save.save(createFarm()), false)
    assert.deepEqual(storage.writes, [])
  }
  const { storage, open } = fixture()
  storage.items.set(keys.legacy, '{broken legacy')
  storage.items.set(keys.primary, JSON.stringify({ ...createFarm(), coins: 999 }))
  assert.equal((await open().load())?.coins, 999)
  assert.equal(storage.getItem(keys.legacy), '{broken legacy')
})

test('invalid or unreadable legacy never creates a primary or migration journal', async () => {
  for (const legacy of ['', '{broken', 'null', '{"version":999}']) {
    const { storage, open } = fixture()
    storage.items.set(keys.legacy, legacy)
    const save = open()
    assert.equal(await save.load(), undefined)
    assert.equal(save.issue, 'invalid')
    assert.equal(save.raw, legacy)
    assert.equal(await save.save(createFarm()), false)
    assert.deepEqual(storage.writes, [])
  }
  const { storage, open } = fixture()
  storage.failRead = keys.legacy
  const save = open()
  assert.equal(await save.load(), undefined)
  assert.equal(save.issue, 'read-failed')
  assert.deepEqual(storage.writes, [])
})

test('snapshot write failure preserves legacy and can be retried by a new load', async () => {
  const { storage, open } = fixture(), original = JSON.stringify(oldFarm())
  storage.items.set(keys.legacy, original)
  storage.failWrite = key => key === keys.journal
  const save = open()
  assert.equal((await save.load())?.coins, 234)
  assert.equal(save.blocked, true)
  assert.equal(save.issue, 'write-failed')
  assert.equal(save.raw, original)
  assert.equal(await save.save(createFarm()), false)
  assert.deepEqual(storage.writes, [])
  storage.failWrite = undefined
  assert.equal((await open().load())?.coins, 234)
  assert.equal(storage.getItem(keys.legacy), original)
})

test('interrupted primary write resumes from frozen snapshot, not a subsequently changed legacy', async () => {
  const { storage, open } = fixture(), original = '\n' + JSON.stringify(oldFarm())
  storage.items.set(keys.legacy, original)
  storage.failWrite = key => key === keys.primary
  const save = open()
  assert.equal((await save.load())?.coins, 234)
  assert.equal(save.blocked, true)
  assert.equal(save.issue, 'write-failed')
  assert.equal(save.raw, original)
  assert.equal(JSON.parse(storage.getItem(keys.journal)!).phase, 'pending')
  assert.equal(storage.getItem(keys.primary), null)
  storage.items.set(keys.legacy, JSON.stringify({ ...oldFarm(), coins: 1 }))
  storage.failWrite = undefined
  const retry = open()
  assert.equal((await retry.load())?.coins, 234)
  assert.equal(retry.blocked, false)
  assert.equal(JSON.parse(storage.getItem(keys.journal)!).legacyRaw, original)
  assert.equal(JSON.parse(storage.getItem(keys.journal)!).phase, 'complete')
  assert.equal(JSON.parse(storage.getItem(keys.legacy)!).coins, 1)
})

test('interrupted completion keeps gameplay locked until a reload completes the journal', async () => {
  const { storage, open } = fixture()
  storage.items.set(keys.legacy, JSON.stringify(oldFarm()))
  storage.failWrite = (key, raw) => key === keys.journal && JSON.parse(raw).phase === 'complete'
  const save = open(), farm = (await save.load())!
  assert.equal(save.blocked, true)
  assert.equal(save.issue, 'write-failed')
  const primary = storage.getItem(keys.primary)
  farm.coins = 1
  assert.equal(await save.save(farm), false)
  assert.equal(storage.getItem(keys.primary), primary)
  storage.failWrite = undefined
  const reopened = open()
  assert.equal((await reopened.load())?.coins, 234)
  assert.equal(reopened.blocked, false)
  assert.equal(storage.getItem(keys.primary), primary)
})

test('completed migration with deleted primary never replays a stale legacy or snapshot', async () => {
  const { storage, open } = fixture()
  storage.items.set(keys.legacy, JSON.stringify(oldFarm()))
  const first = open(), farm = (await first.load())!
  farm.coins = 999
  assert.equal(await first.save(farm), true)
  storage.items.delete(keys.primary)
  const count = storage.writes.length, save = open()
  assert.equal(await save.load(), undefined)
  assert.equal(save.issue, 'missing-primary')
  assert.equal(save.recoveryOrigin, 'snapshot')
  assert.equal(save.raw, JSON.stringify(oldFarm()))
  assert.equal(await save.save(createFarm()), false)
  assert.equal(storage.writes.length, count)
  assert.equal(storage.getItem(keys.primary), null)
})

test('fresh farms get a completed journal and cannot later import an old tab save', async () => {
  const { storage, open } = fixture()
  const farm = await open().load()
  assert.ok(farm)
  assert.equal(storage.getItem(keys.legacy), null)
  assert.equal(JSON.parse(storage.getItem(keys.journal)!).legacyRaw, null)
  storage.items.set(keys.legacy, JSON.stringify(oldFarm()))
  assert.equal((await open().load())?.coins, farm.coins)
  storage.items.delete(keys.primary)
  const save = open()
  assert.equal(await save.load(), undefined)
  assert.equal(save.issue, 'missing-primary')
})

test('malformed journals are not silently repaired or overwritten', async () => {
  for (const journal of ['', 'null', '{broken', '{"version":999}', '{"version":1,"phase":"pending","legacyRaw":null,"initialRaw":"{}"}']) {
    const { storage, open } = fixture()
    storage.items.set(keys.journal, journal)
    storage.items.set(keys.legacy, JSON.stringify(oldFarm()))
    const save = open()
    assert.equal(await save.load(), undefined)
    assert.equal(save.issue, 'migration-invalid')
    assert.equal(save.raw, journal)
    assert.equal(save.recoveryOrigin, 'journal')
    assert.equal(await save.save(createFarm()), false)
    assert.deepEqual(storage.writes, [])
  }
})

test('concurrent initializers share one frozen snapshot; stale new tabs cannot overwrite the winner', async () => {
  const { storage, open } = fixture(), original = JSON.stringify(oldFarm())
  storage.items.set(keys.legacy, original)
  const a = open(), b = open()
  const [fa, fb] = await Promise.all([a.load(), b.load()])
  assert.ok(fa); assert.ok(fb)
  assert.equal(storage.writes.length, 3)
  fa.coins = 500; fb.coins = 600
  assert.deepEqual(await Promise.all([a.save(fa), b.save(fb)]), [true, false])
  assert.equal(b.issue, 'changed')
  assert.equal(b.blocked, true)
  assert.equal(JSON.parse(storage.getItem(keys.primary)!).coins, 500)
  assert.equal(JSON.parse(storage.getItem(keys.journal)!).legacyRaw, original)
})

test('queued snapshots preserve action order, and marker tampering stops the active writer', async () => {
  const { storage, open } = fixture(), save = open(), farm = (await save.load())!
  farm.coins = 200
  const a = save.save(farm)
  farm.coins = 300
  const b = save.save(farm)
  assert.deepEqual(await Promise.all([a, b]), [true, true])
  assert.deepEqual(storage.writes.filter(([key]) => key === keys.primary).slice(-2).map(([,raw]) => JSON.parse(raw).coins), [200,300])
  storage.items.delete(keys.journal)
  const before = storage.getItem(keys.primary)
  assert.equal(await save.save(farm), false)
  assert.equal(save.issue, 'changed')
  assert.equal(storage.getItem(keys.primary), before)
})

test('missing or denied serialization locks permit reading but never an unsafe write', async () => {
  for (const exclusive of [undefined, (<R>(_operation: () => R) => Promise.reject(new Error('denied'))) as ExclusiveSave]) {
    const storage = new Storage()
    storage.items.set(keys.legacy, JSON.stringify(oldFarm()))
    const save = new VersionedSave(() => storage, keys, restoreFarm, createFarm, exclusive)
    assert.equal((await save.load())?.coins, 234)
    assert.equal(save.issue, 'locking-unavailable')
    assert.equal(save.blocked, true)
    assert.equal(await save.save(createFarm()), false)
    assert.deepEqual(storage.writes, [])
  }
})

test('migrated rare tree and paid voyage survive reload, night, claim and return', async () => {
  const { storage, open } = fixture()
  storage.items.set(keys.legacy, JSON.stringify(oldFarm()))
  let save = open(), farm = (await save.load())!
  farm.boatOwned = true; farm.produce.wheat = 4; farm.trees.home[0]!.trait = 'star'
  const tree = structuredClone(farm.trees.home[0])
  assert.ok(storeTree(farm, 0).ok)
  const id = farm.treeNursery[0].id
  assert.ok(sendFerryExpedition(farm, 'mill-baking').ok)
  assert.ok(await save.save(farm))
  save = open(); farm = (await save.load())!
  assert.ok(endDay(farm).ok)
  assert.ok(await save.save(farm))
  save = open(); farm = (await save.load())!
  assert.ok(receiveFerryExpedition(farm).ok)
  assert.ok(returnNurseryTree(farm, 0, id).ok)
  assert.ok(await save.save(farm))
  save = open(); farm = (await save.load())!
  assert.deepEqual(farm.trees.home[0], tree)
  assert.equal(farm.handmade.round, 2)
  assert.equal(farm.coins, 224)
  assert.equal(farm.freight.expeditions.completed, 1)
  assert.equal(receiveFerryExpedition(farm).ok, false)
  assert.equal(storage.getItem(keys.legacy), JSON.stringify(oldFarm()))
})


test('valid current farm remains playable read-only when its migration journal is broken or unreadable', async () => {
  for (const unreadable of [false, true]) {
    const { storage, open } = fixture(), primary = JSON.stringify({ ...createFarm(), coins: 999 })
    storage.items.set(keys.primary, primary)
    storage.items.set(keys.journal, '{broken journal')
    if (unreadable) storage.failRead = keys.journal
    const save = open(), farm = await save.load()
    assert.equal(farm?.coins, 999)
    assert.equal(save.blocked, true)
    assert.equal(save.issue, unreadable ? 'read-failed' : 'migration-invalid')
    assert.equal(save.raw, primary)
    assert.equal(save.recoveryOrigin, 'primary')
    assert.equal(await save.save(farm!), false)
    assert.deepEqual(storage.writes, [])
    assert.equal(storage.getItem(keys.primary), primary)
  }
})
