import test from 'node:test'
import assert from 'node:assert/strict'
import { createFarm, endDay, petChicken, feedChickens, getCoopMorning, restoreFarm, restoreCurrentFarm, incubateEgg, sail } from '../src/farm.ts'
import { createHenFriendship, henFriends, henTreatIds, treatHen, renderHenFriendship, maxHenFriendship } from '../src/hen-friendship.ts'
import { mixChickenFeed } from '../src/chicken-feed.ts'
import { isGuardedAction } from '../src/action-click-guard.ts'
import { farmSaveKeys as keys, commissionFarmSaveKeys as v4, recoveredFarmSaveKeys as v3, publishedFarmSaveKeys as v2 } from '../src/farm-save-keys.ts'
import { VersionedSave, type ExclusiveSave } from '../src/versioned-save.ts'
const unchanged = (farm: ReturnType<typeof createFarm>, action: () => unknown) => { const before = structuredClone(farm); action(); assert.deepEqual(farm, before) }
const ready = () => { const f = createFarm(); f.produce.carrot = 5; f.produce.leafyGreens = 5; f.fruit.apple = 5; return f }

test('ordinary petting makes permanent individual friends; repeated petting cannot farm points', () => {
  const f = ready(); assert.ok(petChicken(f, 0).ok); assert.equal(f.henFriendship.hens[0].points, 1)
  unchanged(f, () => assert.equal(petChicken(f, 0).ok, false)); assert.equal(f.henFriendship.hens[1].points, 0)
  for (let day = 0; day < 12; day++) { endDay(f); petChicken(f, 0) }
  assert.equal(f.henFriendship.hens[0].points, maxHenFriendship)
  for (let day = 0; day < 10; day++) endDay(f)
  assert.equal(f.henFriendship.hens[0].points, maxHenFriendship); assert.equal(f.chickenHappiness, 0)
  assert.deepEqual(restoreCurrentFarm(JSON.parse(JSON.stringify(f))), f)
})

test('treats spend one named ordinary product atomically, reveal preferences and never feed or change egg yield', () => {
  for (let id = 0; id < 4; id++) for (const treat of henTreatIds) {
    const f = ready(), before = structuredClone(f), morning = getCoopMorning(f)
    f.variants = { carrot: { star: 3 }, leafyGreens: { dew: 2 }, apple: { rainbow: 4 } }; f.discoveries = { carrot: { star: true }, leafyGreens: { dew: true }, apple: { rainbow: true } }; const variants = structuredClone(f.variants)
    assert.ok(treatHen(f, id, treat).ok)
    assert.equal(f.henFriendship.hens[id].points, henFriends[id].favorite === treat ? 2 : 1)
    assert.deepEqual(f.henFriendship.hens[id].tasted, [treat]); assert.equal(f.henFriendship.hens[id].treatedOn, f.day)
    if (treat === 'apple') assert.equal(f.fruit.apple, before.fruit.apple - 1); else assert.equal(f.produce[treat], before.produce[treat] - 1)
    assert.deepEqual(f.variants, variants); assert.deepEqual(getCoopMorning(f), morning)
    assert.equal(f.feed, before.feed); assert.equal(f.coins, before.coins); assert.equal(f.chickenHappiness, before.chickenHappiness)
    for (const next of henTreatIds) unchanged(f, () => assert.equal(treatHen(f, id, next).ok, false))
    assert.deepEqual(restoreCurrentFarm(JSON.parse(JSON.stringify(f))), f)
  }
})

test('wrong island, nonexistent hens, invalid choices, missing ordinary stock never mutate', () => {
  const f = ready()
  for (const id of [-1, 4, 9, 0.5, NaN, '0', null]) unchanged(f, () => assert.equal(treatHen(f, id, 'carrot').ok, false))
  for (const treat of ['', '__proto__', 'wheat', {}, null]) unchanged(f, () => assert.equal(treatHen(f, 0, treat).ok, false))
  f.island = 'grove'; unchanged(f, () => assert.equal(treatHen(f, 0, 'carrot').ok, false)); f.island = 'home'
  f.produce.carrot = 0; f.variants.carrot = { star: 10 }; unchanged(f, () => assert.equal(treatHen(f, 0, 'carrot').ok, false))
})

test('three separate favorite-and-pet days complete the gentle cycle without production bonuses', () => {
  const f = ready(); f.buildingLevels.coop = 2; f.produce.wheat = 3
  const startingCoins = f.coins; assert.ok(mixChickenFeed(f, 'garden').ok)
  for (let day = 0; day < 3; day++) {
    assert.ok(petChicken(f, 0).ok); assert.ok(treatHen(f, 0, 'carrot').ok); assert.ok(feedChickens(f).ok)
    const morning = getCoopMorning(f); endDay(f); assert.equal(f.eggsReady, morning.total)
  }
  assert.equal(f.henFriendship.hens[0].points, 9); assert.equal(f.coins, startingCoins + 4, 'only existing first-feed goal reward is paid')
  unchanged(f, () => assert.equal(treatHen(f, 0, 'carrot').ok, false)); assert.ok(petChicken(f, 0).ok)
  assert.match(renderHenFriendship(f), /Близкие друзья/); assert.match(renderHenFriendship(f), /Плюша узнаёт ваши шаги/)
})

test('friendship survives travel and reload, and fifth hen starts empty only after actual hatch', () => {
  const f = ready(); f.boatOwned = true; f.buildingLevels.coop = 3; f.coopSpecialization = 'hatchery'; f.eggs = 1
  petChicken(f, 1); treatHen(f, 1, 'leafyGreens'); const bond = structuredClone(f.henFriendship)
  assert.ok(sail(f, 'grove').ok); assert.deepEqual(restoreCurrentFarm(JSON.parse(JSON.stringify(f)))?.henFriendship, bond); assert.ok(sail(f, 'home').ok)
  assert.ok(incubateEgg(f).ok); endDay(f); assert.doesNotMatch(renderHenFriendship(f), /<h2>Пуговка/); endDay(f)
  assert.equal(f.flockSize, 5); assert.deepEqual(f.henFriendship.hens[4], { points: 0, treatedOn: 0, tasted: [] })
  assert.ok(treatHen(f, 4, 'apple').ok); assert.ok(restoreCurrentFarm(JSON.parse(JSON.stringify(f))))
})

test('preview is read-only, and keyboard or double-click entry and spend actions are guarded', () => {
  const f = ready(); unchanged(f, () => { const html = renderHenFriendship(f); assert.match(html, /Пропуски не отнимают/); assert.match(html, /Угощения необязательны/); assert.match(html, /В запасе 5/); assert.match(html, /Морковь ×1/); assert.doesNotMatch(html, /<h2>Пуговка/) })
  for (const action of ['hen-friendship-open', 'hen-treat', 'pet']) assert.equal(isGuardedAction(action), true)
})

class Storage { items = new Map<string, string>(); writes: string[] = []; fail?: string; getItem(key: string) { return this.items.get(key) ?? null }; setItem(key: string, value: string) { if (key === this.fail) throw Error('full'); this.items.set(key, value); this.writes.push(key) } }
const lock: ExclusiveSave = async operation => operation()
const open = (s: Storage) => new VersionedSave(() => s, keys, restoreCurrentFarm, createFarm, lock, restoreFarm)
function oldRaw() { const old = structuredClone(ready()) as any; delete old.henFriendship; old.coins = 432; return '\n' + JSON.stringify(old) + '\n' }

test('v5 migrates each prior generation without editing source bytes and keeps old v4 writers separate', async () => {
  for (const source of [v4.primary, v3.primary, v2.primary, v2.legacy]) {
    const s = new Storage(), raw = oldRaw(); s.items.set(source, raw); const save = open(s), f = (await save.load())!
    assert.equal(save.blocked, false); assert.equal(f.coins, 432); assert.deepEqual(f.henFriendship, createHenFriendship()); assert.equal(s.getItem(source), raw)
    petChicken(f, 0); treatHen(f, 0, 'carrot'); assert.equal(await save.save(f), true); const current = s.getItem(keys.primary)
    s.items.set(source, JSON.stringify({ ...JSON.parse(raw), coins: 1 })); assert.equal((await open(s).load())?.henFriendship.hens[0].points, 3)
    assert.equal(s.getItem(keys.primary), current); assert.ok(s.writes.every(key => key === keys.primary || key === keys.journal))
  }
})

test('corrupt or missing current friendship blocks saving instead of resetting or replaying legacy', async () => {
  const invalid = [undefined, null, {}, { hens: [] }, { hens: [null, ...createHenFriendship().hens.slice(1)] }]
  for (const value of [-1, 10, 1.5, Number.MAX_SAFE_INTEGER]) { const next = createHenFriendship(); next.hens[0].points = value; invalid.push(next) }
  for (const update of [(b: any) => b.treatedOn = 2, (b: any) => b.tasted = ['carrot'], (b: any) => { b.tasted = ['carrot','carrot']; b.treatedOn = 1; b.points = 2 }]) {
    const next = createHenFriendship(); update(next.hens[0]); invalid.push(next)
  }
  const unborn = createHenFriendship(); unborn.hens[4].points = 1; invalid.push(unborn)
  for (const value of invalid) {
    const s = new Storage(); s.items.set(v4.primary, oldRaw()); s.items.set(keys.primary, JSON.stringify({ ...ready(), henFriendship: value }))
    const before = [...s.items], save = open(s); assert.equal(await save.load(), undefined); assert.equal(await save.save(ready()), false); assert.deepEqual([...s.items], before)
  }
})

test('interrupted migration freezes source and missing migrated generations never resurrect an older farm', async () => {
  const s = new Storage(); s.items.set(v4.primary, oldRaw()); s.fail = keys.primary
  const first = open(s); assert.equal((await first.load())?.coins, 432); const frozen = s.getItem(keys.journal)
  s.items.set(v4.primary, '{broken'); s.fail = undefined; assert.equal((await open(s).load())?.coins, 432); assert.ok(frozen)
  for (const generation of [v4, v3, v2]) {
    const damaged = new Storage(); damaged.items.set(generation.journal, '{old-journal}'); damaged.items.set(v2.legacy, oldRaw())
    const save = open(damaged); assert.equal(await save.load(), undefined); assert.equal(save.issue, 'missing-primary'); assert.equal(damaged.writes.length, 0)
  }
})
