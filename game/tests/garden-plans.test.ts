import test from 'node:test'
import assert from 'node:assert/strict'
import { createFarm, restoreCurrentFarm, workBed, selectSeed, getBedAction, needsSeedChoice, buySeeds, endDay, sail, type CropId } from '../src/farm.ts'
import { createGardenPlans, saveGardenPlan, followGardenPlan, removeGardenPlan, gardenPlanPreview, snapshotGarden, seedForBed } from '../src/garden-plans.ts'
import { farmSaveKeys, visitFarmSaveKeys } from '../src/farm-save-keys.ts'
import { restoreLegacyFarm } from '../src/farm-save-migration.ts'
import { VersionedSave } from '../src/versioned-save.ts'
const page = (crop: CropId = 'wheat') => ({ name: 'Кухонный огород', crops: Array<CropId | null>(16).fill(crop) })
const copy = <T>(v: T): T => structuredClone(v)
const ordinary = (f: ReturnType<typeof createFarm>) => { const c = copy(f) as any; delete c.gardenPlans; return c }
const roundtrip = (f: ReturnType<typeof createFarm>) => assert.deepEqual(restoreCurrentFarm(JSON.parse(JSON.stringify(f))), f)

test('save, activate, pause, edit and remove change only plans, require current revision and keep detached drafts', () => {
  const f = createFarm(), before = ordinary(f), draft = page()
  assert.ok(saveGardenPlan(f, 0, draft, 0).ok); draft.crops[0] = 'carrot'; assert.equal(f.gardenPlans.pages[0]!.crops[0], 'wheat')
  assert.ok(followGardenPlan(f, 0, 1).ok); roundtrip(f)
  const active = copy(f); assert.equal(removeGardenPlan(f, 0, 1).ok, false); assert.deepEqual(f, active)
  assert.ok(saveGardenPlan(f, 0, page('carrot'), 2).ok); assert.equal(f.gardenPlans.active, null)
  assert.ok(followGardenPlan(f, 0, 3).ok); assert.ok(followGardenPlan(f, null, 4).ok)
  assert.ok(removeGardenPlan(f, 0, 5).ok); assert.deepEqual(ordinary(f), before); roundtrip(f)
  const empty = copy(f); assert.equal(followGardenPlan(f, 0, 6).ok, false); assert.deepEqual(f, empty)
})

test('plan sowing uses the exact ordinary seed and weather path, once, and never overwrites a living crop', () => {
  const f = createFarm(); f.beds[0] = { kind: 'tilled' }
  saveGardenPlan(f, 0, page(), 0); followGardenPlan(f, 0, 1)
  const normal = createFarm(); normal.beds[0] = { kind: 'tilled' }; normal.selectedSeed = 'wheat'
  assert.equal(getBedAction(f, 0).kind, 'plant'); assert.match(getBedAction(f, 0).label, /пшеница/)
  assert.ok(workBed(f, 0, 0).ok); assert.ok(workBed(normal, 0, 0).ok)
  normal.selectedSeed = f.selectedSeed; assert.deepEqual(ordinary(f), ordinary(normal)); roundtrip(f)
  const seedStock = f.seeds.wheat
  assert.ok(workBed(f, 0, 1).ok); assert.equal(f.seeds.wheat, seedStock); assert.equal(f.beds[0].kind, 'crop')
  const carrot = copy(f.beds[1]); workBed(f, 1, 2); assert.equal((f.beds[1] as any).crop, (carrot as any).crop)
  const book = copy(f.gardenPlans); endDay(f); assert.deepEqual(f.gardenPlans, book); f.boatOwned = true
  assert.ok(sail(f, 'grove').ok); assert.equal(workBed(f, 0).ok, false); assert.deepEqual(f.gardenPlans, book); roundtrip(f)
})

test('missing planned seeds cannot spend another crop; explicit manual seed choice pauses but preserves the plan', () => {
  const f = createFarm(); saveGardenPlan(f, 0, page('raspberry'), 0); followGardenPlan(f, 0, 1)
  assert.equal(seedForBed(f, 13), 'raspberry'); assert.ok(needsSeedChoice(f, 13))
  const before = copy(f); assert.equal(workBed(f, 13).ok, false); assert.deepEqual(f, before)
  assert.ok(buySeeds(f, 'raspberry').ok); assert.equal(f.gardenPlans.active, 0); assert.ok(workBed(f, 13).ok)
  assert.ok(selectSeed(f, 'carrot').ok); assert.equal(f.gardenPlans.active, null); assert.ok(f.gardenPlans.pages[0]); roundtrip(f)
})

test('preview separates matching, occupied and empty beds; repeated intended crops share one stock forecast', () => {
  const f = createFarm(), p = page('wheat'); const before = copy(f)
  const v = gardenPlanPreview(f, p), s = v.supplies[0]
  assert.equal(v.matching, 2); assert.equal(v.empty, 3); assert.equal(v.waiting, 11)
  assert.equal(s.stock, 2); assert.equal(s.missing, 1); assert.equal(s.packs, 1)
  assert.equal(v.missingCoins, s.price); assert.equal(snapshotGarden(f)[0], null); assert.equal(snapshotGarden(f)[1], 'carrot')
  assert.deepEqual(f, before)
})

test('invalid drafts and corrupt current journals fail closed without mutating farm', () => {
  const f = createFarm(), before = copy(f)
  for (const p of [null, {}, { ...page(), name: '<bad>' }, { ...page(), crops: [] }, { ...page(), crops: Array(16).fill(null) }, { ...page(), crops: Array(16).fill('__proto__') }]) {
    assert.equal(saveGardenPlan(f, 0, p, 0).ok, false); assert.deepEqual(f, before)
  }
  saveGardenPlan(f, 0, page(), 0); followGardenPlan(f, 0, 1)
  for (const mutate of [(x:any) => delete x.gardenPlans, (x:any) => x.gardenPlans.active = 3, (x:any) => x.gardenPlans.revision = 0,
    (x:any) => x.gardenPlans.pages.push(null), (x:any) => x.gardenPlans.pages[0].crops[0] = 'tomato<script>', (x:any) => x.gardenPlans.pages[0].name = ' ']) {
    const raw = copy(f); mutate(raw); assert.equal(restoreCurrentFarm(raw), undefined)
  }
})
class Storage { items = new Map<string, string>(); writes = 0; getItem(k:string) { return this.items.get(k) ?? null } setItem(k:string,v:string) { this.items.set(k,v); this.writes++ } }
const open = (s:Storage) => new VersionedSave(() => s, farmSaveKeys, restoreCurrentFarm, createFarm, async op => op(), restoreLegacyFarm)
test('v6 imports all existing state unchanged and protects plans from old and stale writers', async () => {
  const s = new Storage(), old = copy(createFarm()) as any; delete old.gardenPlans; old.coins = 111
  const raw = JSON.stringify(old); s.items.set(visitFarmSaveKeys.primary, raw)
  const writer = open(s), f = (await writer.load())!; assert.deepEqual(f.gardenPlans, createGardenPlans()); assert.deepEqual(ordinary(f), old)
  const stale = open(s); const outdated = (await stale.load())!; saveGardenPlan(f, 0, page(), 0); assert.ok(await writer.save(f))
  s.items.set(visitFarmSaveKeys.primary, JSON.stringify(createFarm())); const writes = s.writes
  assert.equal(await stale.save(outdated), false); assert.equal(stale.issue, 'changed'); assert.equal(s.writes, writes)
  assert.deepEqual((await open(s).load())!.gardenPlans, f.gardenPlans)
  for (const ledger of ['shopCommissions', 'henFriendship', 'neighborVisits']) {
    const broken = copy(old); delete broken[ledger]
    for (const pending of [false, true]) {
      const storage = new Storage(); storage.items.set(pending ? farmSaveKeys.journal : visitFarmSaveKeys.primary, pending ? JSON.stringify({ version: 1, phase: 'pending', legacyRaw: JSON.stringify(broken), initialRaw: JSON.stringify(createFarm()) }) : JSON.stringify(broken))
      const save = open(storage); assert.equal(await save.load(), undefined); assert.ok(save.blocked); assert.equal(storage.writes, 0)
    }
  }
})
