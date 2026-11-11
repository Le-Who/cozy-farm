import assert from 'node:assert/strict';
import test from 'node:test';
import { createFarm, restoreFarm, specializeFarmhouse, upgradeBuilding } from '../src/farm.ts';
import { farmSaveKeys as keys, publishedFarmSaveKeys as published } from '../src/farm-save-keys.ts';
import { VersionedSave, type ExclusiveSave } from '../src/versioned-save.ts';

class Memory {
  items = new Map<string, string>(); writes: string[] = [];
  getItem(key: string) { return this.items.get(key) ?? null }
  setItem(key: string, raw: string) { this.writes.push(key); this.items.set(key, raw) }
}
const exclusive: ExclusiveSave = async operation => operation();
const open = (storage: Memory) => new VersionedSave(() => storage, keys, restoreFarm, createFarm, exclusive);
function kitchen() {
  const farm = createFarm(); farm.coins = 500;
  upgradeBuilding(farm, 'farmhouse'); specializeFarmhouse(farm, 'bakery');
  return farm;
}

test('the recovery format uses independent storage and imports published progress without writing to it', async () => {
  const storage = new Memory(), original = '\n ' + JSON.stringify(kitchen()) + '\n';
  storage.items.set(published.primary, original);
  const save = open(storage), farm = (await save.load())!;
  assert.ok(farm); assert.equal(specializeFarmhouse(farm, 'preserves').ok, true);
  assert.equal(await save.save(farm), true);
  const newRaw = storage.getItem(keys.primary);
  // An older tab may still write the published generation, but cannot touch this one.
  storage.items.set(published.primary, JSON.stringify({ ...kitchen(), coins: 1, day: 9 }));
  assert.equal((await open(storage).load())?.farmhouseSecondarySpecialization, 'preserves');
  assert.equal(storage.getItem(keys.primary), newRaw);
  assert.equal(JSON.parse(storage.getItem(keys.journal)!).legacyRaw, original);
  assert.ok(storage.writes.every(key => key === keys.primary || key === keys.journal));
  assert.notEqual(keys.lock, published.lock);
});

test('a v1-only player is imported rather than silently started over', async () => {
  const storage = new Memory(), original = '\n' + JSON.stringify({ ...createFarm(), coins: 777 }) + '\n';
  storage.items.set(published.legacy, original);
  assert.equal((await open(storage).load())?.coins, 777);
  assert.equal(storage.getItem(published.legacy), original);
  assert.equal(storage.getItem(published.primary), null);
  assert.equal(storage.getItem(published.journal), null);
  assert.equal(JSON.parse(storage.getItem(keys.journal)!).legacyRaw, original);
});

test('missing v2 progress with a migration record blocks v1 replay and preserves every original byte', async () => {
  for (const journal of ['{broken', JSON.stringify({ version: 1, phase: 'pending' }), JSON.stringify({ version: 1, phase: 'complete' })]) {
    const storage = new Memory();
    storage.items.set(published.legacy, JSON.stringify({ ...createFarm(), coins: 777 }));
    storage.items.set(published.journal, journal);
    const before = [...storage.items], save = open(storage);
    assert.equal(await save.load(), undefined);
    assert.equal(save.issue, 'missing-primary');
    assert.equal(save.raw, journal);
    assert.equal(await save.save(createFarm()), false);
    assert.deepEqual([...storage.items], before);
    assert.deepEqual(storage.writes, []);
  }
});

test('present corrupt published or current data never fall back to an older healthy farm', async () => {
  for (const key of [published.primary, keys.primary]) {
    const storage = new Memory(); storage.items.set(published.legacy, JSON.stringify(kitchen()));
    storage.items.set(key, '{broken');
    const save = open(storage); assert.equal(await save.load(), undefined);
    assert.equal(save.issue, 'invalid'); assert.equal(save.raw, '{broken');
    assert.equal(await save.save(createFarm()), false); assert.deepEqual(storage.writes, []);
  }
});

test('missing browser locks keep the old-generation fallback read-only', async () => {
  const storage = new Memory(), original = JSON.stringify({ ...createFarm(), coins: 777 });
  storage.items.set(published.legacy, original);
  const save = new VersionedSave(() => storage, keys, restoreFarm, createFarm);
  assert.equal((await save.load())?.coins, 777);
  assert.equal(save.issue, 'locking-unavailable'); assert.equal(save.blocked, true);
  assert.equal(await save.save(createFarm()), false); assert.deepEqual(storage.writes, []);
});
