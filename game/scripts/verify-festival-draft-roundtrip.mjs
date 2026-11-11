import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
const root=process.argv[2]
if(!root)throw Error('Pass the frozen checkout root')
const mod=p=>import(pathToFileURL(`${root}/game/${p}`).href)
const farmApi=await mod('src/farm.ts')
const {VersionedSave}=await mod('src/versioned-save.ts')
const {farmSaveKeys:keys}=await mod('src/farm-save-keys.ts')
const {getFestivalShoreRoute:shore}=await mod('src/festival-shore-route.ts')
const {getFestivalFishingRoute:fish}=await mod('src/festival-fishing-route.ts')
const {getFestivalHarvestRoute:harvest}=await mod('src/festival-harvest-route.ts')
const {getFestivalConcertState:concert}=await mod('src/festival-concert-guidance.ts')
const {rememberRecipeDraft}=await mod('src/recipe-draft.ts')
const {festivalShoreFixture}=await mod('tests/fixtures/festival-shore.ts')
const {festivalHarvestFixture}=await mod('tests/fixtures/festival-harvest.ts')
const {festivalFishingFixture}=await mod('tests/fixtures/festival-fishing.ts')
const {festivalConcertFixture}=await mod('tests/fixtures/festival-concert.ts')
const {createFishingPractice}=await mod('src/fishing-practice.ts')
const routes=f=>({shore:shore(f),fish:fish(f),harvest:harvest(f),concert:concert(f)})
const result=[]
for(const scenario of ['shore','harvest','fish','concert']){
 const original=(scenario==='shore'?festivalShoreFixture:scenario==='harvest'?festivalHarvestFixture:scenario==='fish'?festivalFishingFixture:festivalConcertFixture)()
 const legacy=JSON.stringify(original),items=new Map([[keys.legacy,legacy]])
 const storage={getItem:k=>items.get(k)??null,setItem:(k,v)=>items.set(k,v)}
 let queue=Promise.resolve();const exclusive=fn=>{const task=queue.then(fn);queue=task.catch(()=>{});return task}
 const open=()=>new VersionedSave(()=>storage,keys,farmApi.restoreFarm,farmApi.createFarm,exclusive)
 let save=open(),farm=await save.load();assert.ok(farm);assert.equal(save.blocked,false)
 assert.ok(rememberRecipeDraft(farm,{base:'preserves',slots:[{id:'apple',quantity:1,trait:'rainbow'},null],activeSlot:1}))
 assert.ok(await save.save(farm));const draft=structuredClone(farm.recipeDraft)
 const stale=open(),old=await stale.load();assert.ok(old)
 const before=structuredClone(farm),initialRoutes=routes(farm)
 for(let i=0;i<4;i++)assert.deepEqual(routes(farm),initialRoutes)
 assert.deepEqual(farm,before,'route preview must be read-only')
 const persist=async()=>{assert.ok(await save.save(farm));save=open();farm=await save.load();assert.ok(farm);assert.deepEqual(farm.recipeDraft,draft);assert.equal(storage.getItem(keys.legacy),legacy);return farm}
 await persist();assert.deepEqual(routes(farm),initialRoutes)
 if(scenario==='shore'){
  assert.equal(fish(farm)?.panel,'rest');assert.equal(harvest(farm),undefined);assert.equal(shore(farm)?.target.id,'glass')
  assert.ok(farmApi.sail(farm,'grove').ok);await persist();assert.equal(farm.festivals.active.activity.shore,false)
  assert.ok(farmApi.collectShoalFind(farm,'glass').ok);await persist();assert.equal(shore(farm),undefined)
 }else if(scenario==='harvest'){
  assert.equal(shore(farm),undefined);assert.equal(fish(farm),undefined)
  const route=harvest(farm);assert.equal(route.island,'grove');assert.ok(farmApi.sail(farm,route.island).ok);await persist()
  assert.equal(farm.festivals.active.activity.harvest,false);assert.ok(farmApi.pickFruit(farm,route.target.index).ok);await persist();assert.equal(harvest(farm),undefined)
 }else if(scenario==='fish'){
  assert.equal(harvest(farm),undefined)
  assert.ok(farmApi.sail(farm,'grove').ok);const beforePractice=structuredClone(farm),practice=createFishingPractice(farm);assert.ok(practice)
  assert.ok(practice.cast());assert.ok(practice.finish([{kind:'fish',species:'seaBass',variant:'regular'}]));assert.deepEqual(farm,beforePractice)
  const route=fish(farm);assert.equal(route.panel,'fishing');assert.ok(farmApi.sail(farm,route.island).ok);await persist()
  const cast=farmApi.beginFishingTrip(farm);assert.ok(cast.ok);assert.ok(farmApi.finishFishingTrip(farm,cast.token,1).ok);await persist();assert.equal(fish(farm),undefined)
 }else{
  assert.equal(concert(farm),'needed');assert.equal(shore(farm),undefined);assert.equal(harvest(farm),undefined);assert.equal(fish(farm),undefined)
  farm.musicGarden.performances++;await persist();assert.equal(concert(farm),'ready')
 }
 if(farm.island!=='village')assert.ok(farmApi.sail(farm,'village').ok)
 assert.equal(farmApi.cancelFestival(farm,farm.festivals.active.tradition).ok,false)
 const resources=structuredClone({fruit:farm.fruit,produce:farm.produce,fish:farm.fish,shells:farm.shells,shoal:farm.shoalFinds,coins:farm.coins})
 const requirement=scenario==='concert'?'concert':'participation'
 assert.ok(farmApi.contributeFestival(farm,requirement,scenario).ok)
 assert.equal(farmApi.contributeFestival(farm,requirement,scenario).ok,false)
 assert.deepEqual({fruit:farm.fruit,produce:farm.produce,fish:farm.fish,shells:farm.shells,shoal:farm.shoalFinds,coins:farm.coins},resources)
 await persist();assert.deepEqual(routes(farm),{shore:undefined,fish:undefined,harvest:undefined,concert:undefined})
 assert.ok(farmApi.sail(farm,'home').ok);assert.ok(farmApi.endDay(farm).ok);await persist()
 assert.deepEqual(routes(farm),{shore:undefined,fish:undefined,harvest:undefined,concert:undefined})
 const raw=storage.getItem(keys.primary);old.coins++;assert.equal(await stale.save(old),false);assert.equal(stale.issue,'changed');assert.equal(storage.getItem(keys.primary),raw)
 result.push({scenario,day:farm.day,stage:farm.festivals.active.stage,delivered:farm.festivals.active.delivered,draft:farm.recipeDraft,legacyUnchanged:true,staleWriterBlocked:true})
}
console.log(JSON.stringify({status:'PASS',scenarios:result},null,2))
