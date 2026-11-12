import test from 'node:test'
import assert from 'node:assert/strict'
import { createFarm, restoreCurrentFarm, endDay, sail, workBed, petChicken, introduceHenToVisitor, bakeWorkshop, pickFruit, getNeighborPlans, joinNeighborPlan, serveNeighborPlan, finishNeighborPlan } from '../src/farm.ts'
import { inviteNeighborVisit, finishNeighborVisit, visitActivities, visitActivityIds } from '../src/neighbor-visits.ts'
import { restoreLegacyFarm } from '../src/farm-save-migration.ts'
import { farmSaveKeys as keys, friendshipFarmSaveKeys as v5 } from '../src/farm-save-keys.ts'
import { VersionedSave } from '../src/versioned-save.ts'
function ready(){
  const f=createFarm();f.day=5;f.boatOwned=true;f.buildingLevels.farmhouse=2
  f.projects.fair={'dishes:appleJam':1,eggBaskets:1,'produce:carrot':4,'produce:wheat':3}
  f.fairGuestsServed=1;f.guestServedOn=1
  f.village={built:true,supplies:{'handmade:round':2,'fish:seaBass':2,honey:2},residents:['bea','finn'],meals:2,mealOn:2,serviceOn:{bea:0,finn:0},scouting:false}
  f.dishes.windParfait=1;f.dishes.grilledFish=1;f.island='village'
  for(const p of getNeighborPlans(f)){
    assert.ok(joinNeighborPlan(f,p.id).ok)
    assert.ok(serveNeighborPlan(f,p.id,p.resident==='bea'?'dish:windParfait':'dish:grilledFish').ok)
    assert.ok(finishNeighborPlan(f,p.id,{kind:p.arrangement,settled:true,placements:[{slot:'food',x:0,y:0},{slot:'cup',x:-.6,y:.3},{slot:'flowers',x:.6,y:.3}]}).ok)
  }
  assert.ok(sail(f,'home').ok);assert.ok(restoreCurrentFarm(JSON.parse(JSON.stringify(f))));return f
}
const load=(f:ReturnType<typeof createFarm>)=>restoreCurrentFarm(JSON.parse(JSON.stringify(f)))!
const economy=(f:ReturnType<typeof createFarm>)=>{const copy=structuredClone(f) as any;delete copy.neighborVisits;return copy}
test('earned invitation is free, one guest only, invalid and repeated starts are atomic',()=>{
  assert.equal(inviteNeighborVisit(createFarm(),'beaFlock').ok,false)
  const f=ready(),before=economy(f)
  for(const id of [undefined,'__proto__','finn',''])assert.equal(inviteNeighborVisit(f,id).ok,false)
  assert.ok(inviteNeighborVisit(f,'beaFlock').ok);assert.deepEqual(economy(f),before)
  const active=structuredClone(f);assert.equal(inviteNeighborVisit(f,'finnFlock').ok,false);assert.deepEqual(f,active);assert.deepEqual(load(f),f)
})
test('each of six visits records actual ordinary work, without taking its reward or changing orders',()=>{
  for(const id of visitActivityIds){
    const f=ready();f.produce.wheat=8;f.eggs=4;f.beds[0]={kind:'crop',crop:'carrot',growth:1,watered:false};f.trees.home[0]={tree:'apple',age:2,fruitReady:2}
    const normal=structuredClone(f);assert.ok(inviteNeighborVisit(f,id).ok)
    const action=(farm:typeof f)=>{switch(visitActivities[id].kind){case 'crop':return workBed(farm,0);case 'pastry':return bakeWorkshop(farm,'folded');case 'hen':return petChicken(farm,0);case 'fruit':return pickFruit(farm,0)}}
    assert.ok(action(f).ok);assert.ok(action(normal).ok);assert.deepEqual(economy(f),economy(normal),id)
    assert.equal(f.neighborVisits.memories.length,1);assert.ok(f.neighborVisits.active?.observation);assert.deepEqual(load(f),f)
    assert.ok(finishNeighborVisit(f,f.neighborVisits.serial,'curious').ok);assert.equal(f.neighborVisits.memories[0].reply,'curious');assert.deepEqual(load(f),f)
  }
})
test('already-petted hens may be introduced without farming friendship or repeating rewards',()=>{
  const f=ready();petChicken(f,0);assert.ok(inviteNeighborVisit(f,'finnFlock').ok);const before=economy(f)
  assert.ok(introduceHenToVisitor(f,0).ok);assert.deepEqual(economy(f),before)
  const observed=structuredClone(f);assert.equal(introduceHenToVisitor(f,0).ok,false);assert.deepEqual(f,observed)
  finishNeighborVisit(f,f.neighborVisits.serial);inviteNeighborVisit(f,'finnFlock');introduceHenToVisitor(f,1)
  assert.equal(f.neighborVisits.memories.length,1);assert.equal(f.neighborVisits.memories[0].subject,'Плюша');assert.deepEqual(load(f),f)
})
test('cancel, failed work, wrong kind, rest and travel do not invent memories or lose earned ones',()=>{
  const f=ready();inviteNeighborVisit(f,'beaHands');petChicken(f,1);assert.equal(f.neighborVisits.active?.observation,null)
  assert.equal(bakeWorkshop(f,'round').ok,false);assert.equal(f.neighborVisits.memories.length,0)
  const before=structuredClone(f);assert.equal(finishNeighborVisit(f,0).ok,false);assert.equal(finishNeighborVisit(f,f.neighborVisits.serial,'quiet').ok,false);assert.deepEqual(f,before)
  endDay(f);assert.equal(f.neighborVisits.active,null);inviteNeighborVisit(f,'beaFlock');introduceHenToVisitor(f,2)
  const memories=structuredClone(f.neighborVisits.memories);assert.ok(sail(f,'grove').ok);assert.equal(f.neighborVisits.active,null);assert.deepEqual(f.neighborVisits.memories,memories);assert.ok(load(f))
})
test('malformed active visits, forged duplicate memories and missing v6 ledger fail closed',()=>{
  const f=ready();inviteNeighborVisit(f,'beaFlock');introduceHenToVisitor(f,0)
  const mutations=[(x:any)=>delete x.neighborVisits,(x:any)=>x.neighborVisits.active.startedOn--,(x:any)=>x.neighborVisits.serial=0,(x:any)=>x.island='grove',(x:any)=>x.neighborVisits.memories.push(x.neighborVisits.memories[0]),(x:any)=>x.neighborVisits.active.observation.subject='<img>',(x:any)=>x.neighborVisits.memories[0].activity='bad',(x:any)=>x.neighborVisits.memories[0].serial=999]
  for(const mutate of mutations){const raw=structuredClone(f);mutate(raw);assert.equal(restoreCurrentFarm(raw),undefined)}
})
class Storage{items=new Map<string,string>();getItem(k:string){return this.items.get(k)??null}setItem(k:string,v:string){this.items.set(k,v)}}
const open=(s:Storage)=>new VersionedSave(()=>s,keys,restoreCurrentFarm,createFarm,async operation=>operation(),restoreLegacyFarm)
test('v5 imports friendships and held orders intact; corrupt v5 never resets protected ledgers',async()=>{
  for(const absent of ['neighborVisits','henFriendship','shopCommissions'] as const){
    const s=new Storage(),raw=structuredClone(ready()) as any;delete raw.neighborVisits;if(absent!=='neighborVisits')delete raw[absent]
    const bytes=JSON.stringify(raw);s.items.set(v5.primary,bytes);const save=open(s),f=await save.load()
    if(absent==='neighborVisits'){assert.ok(f);assert.deepEqual(f.henFriendship,raw.henFriendship);assert.deepEqual(f.shopCommissions,raw.shopCommissions);assert.deepEqual(f.neighborVisits,{serial:0,active:null,memories:[]})
      inviteNeighborVisit(f,'beaFlock');introduceHenToVisitor(f,0);assert.ok(await save.save(f));s.items.set(v5.primary,JSON.stringify(createFarm()));assert.deepEqual((await open(s).load())?.neighborVisits,f.neighborVisits)
    }else{assert.equal(f,undefined);assert.equal(save.blocked,true);assert.equal(s.items.size,1)}
    if(absent!=='neighborVisits')assert.equal(s.getItem(v5.primary),bytes)
  }
})
