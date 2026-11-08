import assert from 'node:assert/strict'
import {test} from 'node:test'
import {createFarm,restoreFarm,getCoveActions,changeCove,getCoveHabitat,beginFishingTrip,endDay} from '../src/farm.ts'
import {covePresets,getCoveEcology} from '../src/shoreline.ts'
function cove(){const f=createFarm();f.boatOwned=true;f.shellDiscoveries=['regular'];f.island='grove';return f}
const roundTrip=(f:ReturnType<typeof createFarm>)=>restoreFarm(JSON.parse(JSON.stringify(f)))
test('living cove is visible but gated by boat and first shell, with failed choices leaving all state untouched',()=>{
 const f=createFarm(),before=structuredClone(f);assert.equal(getCoveActions(f).phase,'locked');assert.equal(changeCove(f,{flow:'open'}).ok,false);assert.deepEqual(f,before);f.boatOwned=true;f.island='grove';assert.equal(changeCove(f,{flow:'open'}).ok,false);f.shellDiscoveries=['regular'];assert.equal(getCoveActions(f).phase,'natural');assert.equal(getCoveHabitat(f),undefined);const unlocked=structuredClone(f);assert.equal(changeCove(f,{flow:'invalid'} as any).ok,false);assert.deepEqual(f,unlocked)
})
test('independent reversible edits remain pending until the overnight tide and preserve daily finds',()=>{
 const f=cove();f.shellsCollectedToday=[0];f.fishCaughtToday.grove=1;assert.ok(changeCove(f,{flow:'open'}).ok);assert.ok(changeCove(f,{cover:'kelp'}).ok);assert.ok(changeCove(f,{refuge:'stones'}).ok);assert.deepEqual(f.shoreline.pending,{flow:'open',cover:'kelp',refuge:'stones'});assert.equal(getCoveActions(f).phase,'pending');assert.equal(getCoveHabitat(f),undefined);assert.deepEqual(f.shellsCollectedToday,[0]);assert.equal(f.fishCaughtToday.grove,1);assert.ok(roundTrip(f));f.island='home';assert.ok(endDay(f).ok);f.island='grove';assert.equal(getCoveActions(f).phase,'settled');assert.equal(f.shoreline.revision,1);assert.equal(getCoveHabitat(f)?.profile,'channel');assert.ok(f.shoreline.observations.includes('crab-refuge'));assert.ok(roundTrip(f));assert.ok(changeCove(f,{flow:'sheltered'}).ok);assert.ok(changeCove(f,{flow:'open'}).ok);assert.equal(f.shoreline.pending,null);assert.equal(f.shoreline.revision,1)
})
test('both viable presets alter three real animal behaviors and distinct useful fishing configurations',()=>{
 const habitats=[];for(const preset of Object.values(covePresets)){const f=cove();changeCove(f,preset);f.island='home';endDay(f);f.island='grove';const ecology=getCoveEcology(f.shoreline,f.day);habitats.push(ecology);assert.equal(ecology.fishing.seaBassWeight+ecology.fishing.perchWeight,1);assert.ok(ecology.animals.minnows.count>=4);assert.ok(getCoveHabitat(f));const restored=roundTrip(f)!;assert.deepEqual(getCoveEcology(restored.shoreline,restored.day),ecology)}assert.notEqual(habitats[0].animals.crab.mode,habitats[1].animals.crab.mode);assert.notEqual(habitats[0].animals.egret.mode,habitats[1].animals.egret.mode);assert.notEqual(habitats[0].animals.minnows.mode,habitats[1].animals.minnows.mode);assert.notEqual(habitats[0].fishing.profile,habitats[1].fishing.profile)
})
test('queued changes cannot reroll an active fishing snapshot or refresh loot before the next day',()=>{
 const f=cove();changeCove(f,covePresets.nursery);f.island='home';endDay(f);f.island='grove';const trip=beginFishingTrip(f);assert.ok(trip.ok);const original=structuredClone(f.pendingFishingTrip);f.shellsCollectedToday=[1];for(let i=0;i<8;i++)changeCove(f,i%2?covePresets.channel:covePresets.nursery);assert.deepEqual(f.pendingFishingTrip,original);assert.deepEqual(f.shellsCollectedToday,[1]);assert.equal(f.shoreline.revision,1);const restored=roundTrip(f)!;assert.ok(restored);assert.deepEqual(restored.pendingFishingTrip,original);assert.deepEqual(restored.shoreline,f.shoreline)
})
test('preview and returned trip snapshots cannot mutate the saved effective habitat',()=>{
 const f=cove();changeCove(f,covePresets.channel);f.island='home';endDay(f);f.island='grove';const expected=structuredClone(f.shoreline),view=getCoveActions(f);view.choices.flow='sheltered';view.settled!.cover='kelp';view.ecology.choices.refuge='sand';assert.deepEqual(f.shoreline,expected)
 const trip=beginFishingTrip(f),snapshot=structuredClone(f.pendingFishingTrip);trip.config!.habitat!.flow='sheltered';assert.deepEqual(f.pendingFishingTrip,snapshot)
})
test('malformed or fabricated shoreline snapshots and fishing habitat values are rejected',()=>{
 const f=cove();changeCove(f,covePresets.channel);f.island='home';endDay(f);f.island='grove';beginFishingTrip(f);assert.ok(roundTrip(f));for(const mutate of [(x:any)=>x.shoreline.pending={flow:'x',cover:'kelp',refuge:'sand'},(x:any)=>x.shoreline.observations.push('invented'),(x:any)=>x.pendingFishingTrip.config.habitat.rareWeight=99,(x:any)=>x.pendingFishingTrip.config.habitat.revision=9]){const saved=structuredClone(f);mutate(saved);assert.equal(restoreFarm(saved),undefined)}
})
