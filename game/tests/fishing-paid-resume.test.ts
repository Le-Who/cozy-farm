import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { runInNewContext } from 'node:vm'
import * as F from '../src/farm.ts'
import * as M from '../src/fishing-model.ts'
import { createFishingPractice } from '../src/fishing-practice.ts'
import type { FishingGameOptions } from '../src/fishing.ts'
import { farmSaveKeys as keys } from '../src/farm-save-keys.ts'
import { VersionedSave } from '../src/versioned-save.ts'
import { covePresets } from '../src/shoreline.ts'
import { fishingReturnFixture } from './fixtures/fishing-return.ts'

const section = (file: string, start: string, end: string) => {
  const source = readFileSync(new URL('../src/'+file, import.meta.url), 'utf8')
  const a = source.indexOf(start), b = source.indexOf(end, a + start.length)
  assert.ok(a >= 0 && b > a, start)
  return source.slice(a, b)
}
const sceneBinding = stripTypeScriptTypes([
  'let fishingLanding, fishingGame, fishingToken, fishingPractice, pendingSaves=0, saveAvailable=true, saveRecovery;',
  section('main.ts','function saveFarm()', "window.addEventListener('beforeunload'"),
  section('main.ts','function stopFishing()', 'function stopWorkshop()'),
  section('main.ts','function mountFishing(', 'function pastryChoices()'),
  'function perform(action){ const r=action(); if(r.ok)saveFarm(); return r.ok }',
  'function closeDialog(){stopFishing();closed()} ;({mountFishing,stopFishing})',
].join('\n'))
const castControl = stripTypeScriptTypes(section('fishing.ts','  function performAction()', "  action.addEventListener('click', performAction")+';performAction()')

// Only the display, synchronous feedback, storage medium and lock are stand-ins.
function lake(initial = fishingReturnFixture()) {
  const bytes = new Map([[keys.primary, JSON.stringify(initial)]])
  let writes = 0, tail = Promise.resolve()
  const storage = { getItem: (k:string) => bytes.get(k) ?? null, setItem(k:string,v:string) { writes++; bytes.set(k,v) } }
  function lock<T>(op:()=>T) { const done = tail.then(op); tail = done.then(()=>{},()=>{}); return done }
  return { bytes, get writes(){return writes}, flush:()=>tail,
    async page(){
      const store = new VersionedSave(()=>storage, keys, F.restoreCurrentFarm, F.createFarm, lock)
      const farm = await store.load(); assert.ok(farm && !store.blocked)
      let options: FishingGameOptions | undefined, calls = 0, closes = 0, fishing = false
      const control = runInNewContext(sceneBinding, {
        ...F, farm, createFishingPractice, status(){}, notify(){}, closed(){closes++}, panel:'fishing', dialog:{open:true},
        island:{setFishing(v:boolean){fishing=v}}, dialogContent:{querySelector:()=>({querySelector:()=>null})},
        createFishingGame: (_host:unknown, o:FishingGameOptions) => { options=o; return {destroy(){}} },
        saveStore:{save(value:F.FarmState){calls++;return store.save(value)}},
      })
      return {farm,store,open(practice=false){options=undefined;control.mountFishing(practice);return options as FishingGameOptions|undefined},
        get options(){return options!},get calls(){return calls},get closes(){return closes},get fishing(){return fishing}}
    },
  }
}
function cast(options: FishingGameOptions, frames: number) {
  const model = M.createFishingModel(options.capacity, options.resilience, options.seed, options.fish, options.habitat)
  for (let i=0;i<frames;i++) M.stepFishing(model, 1/30)
  let focused=false, updates=0
  const intro={hidden:false}
  runInNewContext(castControl,{...M, options, model, contextLost:false, destroyed:false, intro,
    stage:{focus(){focused=true}},updateInterface(){updates++}})
  assert.equal(model.phase,'descending'); assert.equal(model.depth,0)
  assert.ok(intro.hidden && focused); assert.equal(updates,1)
  return model
}
const empty = {count:0,depth:4,catches:[]}
const perch = {count:1,depth:4,catches:[{kind:'fish',species:'perch',variant:'regular'} as const]}

test('reloading previews a quota-capped paid hook; only an active Back retires it', async()=>{
  const l=lake(), first=await l.page(), fresh=first.open()!
  const original=cast(fresh,22)
  assert.ok(original.time>0, 'ordinary cast keeps its running preview clock')
  await l.flush()
  const paidBytes = Array.from(l.bytes), count = l.writes
  const p = await l.page(), preview = p.open()!
  assert.equal(p.farm.pendingFishingTrip?.config.capacity,4)
  assert.deepEqual([preview.capacity,preview.maxDepth,preview.resilience,preview.seed],[3,120,5,14238])
  assert.equal(p.fishing,false); preview.onCancel!()
  assert.deepEqual(Array.from(l.bytes),paidBytes); assert.equal(p.calls,0)
  const live = p.open()!
  preview.onCancel!(); assert.equal(p.closes,1,'detached cancel cannot close its replacement')
  assert.equal(preview.onCast!(),false)
  const restart = cast(live,100)
  assert.deepEqual(restart.fish,original.fish);assert.equal(restart.time,0)
  assert.equal(p.fishing,true); assert.equal(live.onCast!(),false); assert.equal(p.calls,0)
  await l.flush(); assert.equal(l.writes,count); assert.deepEqual(Array.from(l.bytes),paidBytes)
  const reload=await l.page(), other=cast(reload.open()!,3)
  assert.deepEqual(other,restart,'two restart wait times give the same initial simulation')
  const before=structuredClone(p.farm); live.onCancel!();live.onCancel!()
  await l.flush()
  assert.equal(p.calls,1);assert.equal(l.writes,count+1)
  assert.deepEqual((await l.page()).farm,{...before,pendingFishingTrip:null})
})

test('settling once preserves next-cast effects; stale finish, result close and release spare the replacement', async()=>{
  const seed=fishingReturnFixture();F.beginFishingTrip(seed)
  seed.culinary.picnic={processing:'bright',day:seed.day}
  const l=lake(seed), p=await l.page(), old=p.open()!
  assert.ok(old.onCast!());assert.ok(p.farm.culinary.picnic)
  const held=old.onFinish(perch);assert.ok(held && typeof held==='object')
  assert.equal(old.onFinish(perch),false);await l.flush()
  const restored=(await l.page()).farm
  assert.equal(restored.pendingFishingTrip,null); assert.equal(restored.fish.perch,1)
  assert.equal(restored.workToday,seed.workToday+1);assert.equal(restored.fishCaughtToday.home,1)
  assert.ok(restored.bayDiscoveries.includes('perch'));assert.equal(p.farm.fish.perch,0)
  old.onAgain!(); const fresh=p.options
  assert.equal(p.farm.fish.perch,1);assert.equal(p.farm.pendingFishingTrip,null);assert.ok(p.farm.culinary.picnic)
  assert.ok(fresh.onCast!());assert.equal(p.farm.fishingTripSerial,2);assert.equal(p.farm.culinary.picnic,null)
  assert.equal(p.farm.pendingFishingTrip?.config.resilience,2)
  old.onCancel!();old.onAgain!();assert.equal(held.release(),false);assert.equal(old.onFinish(perch),false)
  assert.ok(p.fishing);assert.equal(p.closes,0)
  assert.ok(fresh.onFinish(empty));await l.flush()
  const settled=(await l.page()).farm;assert.equal(settled.pendingFishingTrip,null);assert.equal(settled.workToday,restored.workToday)
  fresh.onCancel!();assert.equal(p.closes,1,'current result still closes');assert.equal(p.calls,3)
})

test('a stale saved-cast preview never falls back to paying for another cast', async()=>{
  for(const change of ['supersede','abandon','move','quota','day']){
    const f=fishingReturnFixture();F.beginFishingTrip(f)
    const l=lake(f),p=await l.page(),o=p.open()!
    if(change==='supersede') assert.ok(F.beginFishingTrip(p.farm).ok)
    if(change==='abandon') assert.ok(F.cancelFishingTrip(p.farm).ok)
    if(change==='move') assert.ok(F.sail(p.farm,'grove').ok)
    if(change==='quota') p.farm.fishCaughtToday.home=F.getFishLimit(p.farm)
    if(change==='day') assert.ok(F.endDay(p.farm).ok)
    const before=structuredClone(p.farm)
    assert.equal(o.onCast!(),false,change);assert.equal(p.fishing,false);assert.equal(p.calls,0);assert.deepEqual(p.farm,before)
    if(change==='quota'){assert.equal(p.open(),undefined);assert.equal(p.open(true),undefined)}
  }
})

test('another shore borrows neither ticket nor gear; a fresh cast requires explicit abandonment',async()=>{
  const f=fishingReturnFixture();F.beginFishingTrip(f)
  const p=await lake(f).page(), original=structuredClone(p.farm.pendingFishingTrip)
  assert.ok(F.sail(p.farm,'grove').ok);const away=p.open()!
  assert.equal(away.fish,'seaBass');assert.equal(away.resilience,2)
  away.onCancel!();assert.deepEqual(p.farm.pendingFishingTrip,original);assert.equal(p.calls,0)
  assert.ok(F.sail(p.farm,'home').ok);const home=p.open()!;assert.equal(home.resilience,5);home.onCancel!()
  assert.ok(F.sail(p.farm,'grove').ok);assert.equal(p.open()!.onCast!(),false)
  assert.deepEqual(p.farm.pendingFishingTrip,original);assert.equal(p.calls,0)
  assert.ok(F.cancelFishingTrip(p.farm,original!.token).ok)
  assert.ok(p.open()!.onCast!())
  assert.equal(p.farm.pendingFishingTrip?.island,'grove');assert.equal(p.farm.pendingFishingTrip?.token,2)
})

test('Cove reopens the captured habitat (including absent), never a queued or live replacement',async()=>{
  const f=fishingReturnFixture();f.shellDiscoveries=['regular'];assert.ok(F.sail(f,'grove').ok)
  assert.ok(F.changeCove(f,covePresets.nursery).ok);assert.ok(F.sail(f,'home').ok)
  assert.ok(F.endDay(f).ok);assert.ok(F.sail(f,'grove').ok);assert.ok(F.beginFishingTrip(f).ok)
  assert.ok(F.changeCove(f,covePresets.channel).ok)
  for(const absent of [false,true]){
    if(absent) delete f.pendingFishingTrip!.config.habitat
    const p=await lake(f).page(), o=p.open()!
    assert.equal(o.habitat?.profile,absent?undefined:'nursery')
    if(o.habitat) {assert.notEqual(o.habitat,p.farm.pendingFishingTrip!.config.habitat)}
    assert.equal(o.fish,'seaBass');assert.ok(o.onCast!());assert.equal(p.calls,0)
  }
})

test('another page’s newer durable outcome defeats a stale settlement using the normal guarded writer',async()=>{
  const f=fishingReturnFixture();F.beginFishingTrip(f)
  const l=lake(f), stale=await l.page(), winner=await l.page(), old=stale.open()!, live=winner.open()!
  assert.ok(old.onCast!());assert.ok(live.onCast!())
  const held=live.onFinish(perch);assert.ok(held && typeof held==='object' && held.release())
  live.onCancel!();await l.flush()
  const bytes=Array.from(l.bytes), count=l.writes
  old.onFinish(perch);await l.flush()
  assert.ok(stale.store.blocked);assert.equal(l.writes,count);assert.deepEqual(Array.from(l.bytes),bytes)
  const restored=(await l.page()).farm;assert.equal(restored.fish.perch,0);assert.equal(restored.fishCaughtToday.home,1)
  assert.equal(restored.pendingFishingTrip,null)
})
