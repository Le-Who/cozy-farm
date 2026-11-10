import assert from 'node:assert/strict'
import test from 'node:test'
import { ProtectedSave } from '../src/protected-save.ts'
import { createFarm, restoreFarm } from '../src/farm.ts'

const key = 'test-farm'
class Storage {
  items = new Map<string, string>()
  writes: [string,string][] = []
  readFails = false
  writeFails = false
  getItem(key: string) { if (this.readFails) throw new Error('unavailable'); return this.items.get(key) ?? null }
  setItem(key: string, value: string) { if (this.writeFails) throw new Error('full'); this.writes.push([key,value]); this.items.set(key,value) }
}

test('invalid farm data is preserved byte-for-byte and cannot be overwritten by a fresh farm', () => {
  for (const raw of ['{broken', '', 'null', '{"version":999}', JSON.stringify({...createFarm(),coins:-1})]) {
    const storage = new Storage()
    storage.items.set(key,raw)
    const save = new ProtectedSave(() => storage,key,restoreFarm)
    assert.equal(save.load(),undefined)
    assert.equal(save.issue,'invalid')
    assert.equal(save.raw,raw)
    assert.equal(save.blocked,true)
    assert.equal(save.save(createFarm()),false)
    assert.equal(save.save(createFarm()),false)
    assert.equal(storage.items.get(key),raw)
    assert.deepEqual(storage.writes,[])
  }
})

test('a changed or unreadable stored value blocks later writes instead of clobbering it', () => {
  const storage = new Storage(), raw = JSON.stringify(createFarm())
  storage.items.set(key,raw)
  const save = new ProtectedSave(() => storage,key,restoreFarm)
  const farm = save.load()!
  const other = JSON.stringify({...farm,day:20,coins:700})
  storage.items.set(key,other)
  farm.coins = 17
  assert.equal(save.save(farm),false)
  assert.equal(save.issue,'changed')
  assert.equal(save.raw,other)
  assert.equal(save.blocked,true)
  assert.deepEqual(storage.writes,[])
  assert.equal(storage.items.get(key),other)
  assert.equal(save.save(farm),false,'the session remains locked even if the user keeps playing')

  const second = new ProtectedSave(() => storage,key,restoreFarm)
  const restored = second.load()!
  storage.readFails = true
  assert.equal(second.save(restored),false)
  assert.equal(second.issue,'read-failed')
  assert.equal(second.raw,other,'the last successfully read bytes remain available')
  storage.readFails = false
  assert.equal(second.save(restored),false,'a read failure requires a fresh load, not a blind retry')
})

test('new and valid farms save normally and retain their most recent serialized value', () => {
  const storage = new Storage()
  const save = new ProtectedSave(() => storage,key,restoreFarm)
  assert.equal(save.save(createFarm()),false,'saving before load cannot overwrite unknown data')
  assert.equal(save.load(),undefined)
  assert.equal(save.issue,undefined)
  assert.equal(save.blocked,false)
  const farm = createFarm()
  farm.coins = 123
  assert.equal(save.save(farm),true)
  farm.coins = 124
  assert.equal(save.save(farm),true)
  assert.equal(save.raw,storage.items.get(key))
  const reopened = new ProtectedSave(() => storage,key,restoreFarm)
  assert.equal(reopened.load()?.coins,124)
  assert.equal(reopened.load()?.coins,124,'loading is idempotent within a session')
  assert.equal(reopened.blocked,false)
})

test('unavailable storage and restore exceptions keep the session locked without writes', () => {
  const storage = new Storage(), raw = JSON.stringify(createFarm())
  storage.items.set(key,raw)
  storage.readFails = true
  const save = new ProtectedSave(() => storage,key,restoreFarm)
  assert.equal(save.load(),undefined)
  assert.equal(save.issue,'read-failed')
  assert.equal(save.raw,undefined,'unknown bytes are not presented as an empty save')
  storage.readFails = false
  assert.equal(save.save(createFarm()),false)
  assert.equal(storage.items.get(key),raw)
  const throwing = new ProtectedSave(() => storage,key,() => { throw new Error('migration failed') })
  assert.equal(throwing.load(),undefined)
  assert.equal(throwing.issue,'invalid')
  assert.equal(throwing.raw,raw)
  assert.equal(throwing.save(createFarm()),false)
  const denied = new ProtectedSave(() => { throw new Error('Storage access denied') },key,restoreFarm)
  assert.equal(denied.load(),undefined)
  assert.equal(denied.save(createFarm()),false)
  assert.deepEqual(storage.writes,[])
})

test('failed writes and serialization preserve the previous bytes and may retry safely', () => {
  const storage = new Storage(), raw = JSON.stringify(createFarm())
  storage.items.set(key,raw)
  const save = new ProtectedSave(() => storage,key,restoreFarm)
  const farm = save.load()!
  farm.coins = 999
  storage.writeFails = true
  assert.equal(save.save(farm),false)
  assert.equal(save.issue,'write-failed')
  assert.equal(save.raw,raw)
  assert.equal(storage.items.get(key),raw)
  storage.writeFails = false
  assert.equal(save.save(farm),true)
  assert.equal(save.issue,undefined)
  const previous = storage.items.get(key)
  const circular = {self:null as unknown}
  circular.self = circular
  const serialization = new ProtectedSave<unknown>(() => storage,key,restoreFarm)
  serialization.load()
  assert.equal(serialization.save(circular),false)
  assert.equal(storage.items.get(key),previous)
  assert.equal(serialization.save(undefined),false)
  assert.equal(storage.items.get(key),previous)
})

test('external deletion is not mistaken for a new farm and restored data can be retried on reload', () => {
  const storage = new Storage(), raw = JSON.stringify(createFarm())
  storage.items.set(key,raw)
  const save = new ProtectedSave(() => storage,key,restoreFarm)
  const farm = save.load()!
  storage.items.delete(key)
  assert.equal(save.save(farm),false)
  assert.equal(save.issue,'changed')
  assert.equal(storage.items.has(key),false)
  storage.items.set(key,raw)
  assert.equal(save.save(farm),false,'an old session never becomes writable just because the bytes changed again')
  const reloaded = new ProtectedSave(() => storage,key,restoreFarm)
  assert.ok(reloaded.load())
  assert.equal(reloaded.save(farm),true)
})
