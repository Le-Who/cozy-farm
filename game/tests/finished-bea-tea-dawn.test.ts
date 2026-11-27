import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import * as F from '../src/farm.ts'
import {neighborHelpStatus} from '../src/neighbor-help.ts'
import {getNeighborSceneState} from '../src/neighbor-scene.ts'
import {commissionPlayer} from './fixtures/commission-player.ts'

const history = JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json',import.meta.url),'utf8'))
const secondSupper = history.flatMap((action:{name:string},i:number)=>action.name==='serveVillageMeal'?[i]:[])[1]
const beforeCatch = secondSupper-2
assert.equal(history[beforeCatch].name,'catchFish')
const table = {kind:'table',settled:true,placements:[{slot:'food',x:0,y:0},{slot:'cup',x:.4,y:.2},{slot:'flowers',x:-.4,y:.2}]} as const
const basket = {...table,kind:'basket'} as const
const cold=(farm:F.FarmState)=>{
 const result=F.restoreCurrentFarm(JSON.parse(JSON.stringify(farm)));assert.ok(result);return result
}
const bea=(farm:F.FarmState)=>F.getNeighborPlans(farm).find(plan=>plan.resident==='bea')!
function overnightReturn(start:F.FarmState) {
 const farm=cold(start)
 assert.ok(F.sail(farm,'home').ok)
 assert.ok(F.endDay(farm).ok)
 const morning=cold(farm)
 assert.ok(F.sail(morning,'village').ok)
 return cold(morning)
}
function earnTea(){
 const p=commissionPlayer(history.slice(0,beforeCatch))
 assert.deepEqual([p.state.day,p.state.island,p.state.coins,p.state.handmade.round,p.state.village.meals],[14,'home',68,1,1])
 const recipe=p.cook(), preparing=cold(p.state)
 p.act('joinNeighborPlan','bea:1')
 const joined=cold(p.state)
 p.act('serveNeighborPlan','bea:1','signature:'+recipe)
 const arranging=cold(p.state)
 p.act('finishNeighborPlan','bea:1',table)
 const complete=cold(p.state)
 assert.equal(p.actions,111)
 assert.deepEqual([complete.day,complete.island,complete.coins,complete.handmade.round,
  complete.culinary.stock[recipe],complete.village.meals,F.getVillageHomeCount(complete),bea(complete).phase],
  [14,'village',99,1,0,2,2,'celebrating'])
 return {recipe,preparing,joined,arranging,complete}
}

test('one genuine dawn makes Bea’s paid tea lead to her next picnic even without the voluntary farewell',()=>{
 const {complete}=earnTea(), before=cold(complete)
 const old=bea(complete), keepsake=getNeighborSceneState(old).keepsake
 assert.ok(keepsake);assert.equal(old.memory?.day,14)
 assert.equal(F.endDay(complete).ok,false,'not sleeping at the table')
 assert.equal(F.joinNeighborPlan(complete,'bea:2').ok,false,'not ready before dawn')
 assert.deepEqual(complete,before)
 const withBye=cold(complete)
 assert.ok(F.advanceNeighborPlan(withBye,'bea:1').ok)
 assert.equal(bea(withBye).phase,'remembered')
 assert.deepEqual([withBye.coins,withBye.handmade,withBye.village,withBye.neighbors.bea.memories,neighborHelpStatus(withBye,'bea')],
   [before.coins,before.handmade,before.village,before.neighbors.bea.memories,neighborHelpStatus(before,'bea')])
 assert.equal(F.advanceNeighborPlan(withBye,'bea:1').ok,false,'same-day farewell still cannot advance twice')
 const expected=overnightReturn(withBye)
 const noBye=overnightReturn(complete)
 assert.deepEqual([bea(noBye).id,bea(noBye).phase,bea(noBye).title],['bea:2','preparing','Корзинка для прогулки'])
 assert.deepEqual(noBye,expected,'sleep and return have the same complete state with or without a farewell')
 assert.deepEqual(getNeighborSceneState(bea(noBye)).keepsake,keepsake)
 assert.deepEqual(noBye.neighbors.bea.memories,before.neighbors.bea.memories)
 assert.deepEqual(neighborHelpStatus(noBye,'bea'),neighborHelpStatus(expected,'bea'))
 assert.equal(noBye.coins,99);assert.equal(noBye.handmade.round,1)
 const historical=cold({...noBye,neighbors:{...noBye.neighbors,bea:{...noBye.neighbors.bea,current:before.neighbors.bea.current}}})
 // Earlier writers left this sole plan on its earned D14 celebration through any dawn.
 // Reading one of those honest old saves does not overwrite gifts, memory or the optional exit.
 assert.equal(bea(historical).phase,'celebrating')
 assert.ok(F.advanceNeighborPlan(historical,'bea:1').ok)
 assert.deepEqual(cold(historical),noBye,'the old late farewell and new dawn reach the exactly same saved plan')
 const fresh=cold(noBye)
 assert.equal(F.advanceNeighborPlan(fresh,'bea:1').ok,false,'an old late click cannot target the automatically new plan')
 assert.deepEqual(fresh,noBye)
 assert.ok(F.joinNeighborPlan(fresh,'bea:2').ok)
 assert.ok(F.serveNeighborPlan(fresh,'bea:2','handmade:round').ok)
 assert.deepEqual([fresh.coins,fresh.handmade.round,fresh.village.meals],[99,1,2], 'join and choose are not a gift or payout')
 assert.ok(F.finishNeighborPlan(fresh,'bea:2',basket).ok)
 assert.deepEqual([fresh.coins,fresh.handmade.round,fresh.village.meals],[131,0,3])
 assert.deepEqual(cold(fresh).neighbors.bea.memories.map(x=>x.episode),['beaTea','beaBasket'])
 const next=overnightReturn(fresh)
 assert.deepEqual([bea(next).id,bea(next).phase,next.coins],['bea:2','celebrating',131], 'other ceremonies retain their existing paid farewell')
})

test('a real unfinished D14 tea still survives sleep with its exact activity and unspent portion',()=>{
 const {recipe,preparing,joined,arranging}=earnTea()
 for(const state of [preparing,joined,arranging]){
  const old=bea(state),next=overnightReturn(state)
  assert.equal(next.day,15)
  assert.deepEqual(bea(next),old)
  assert.deepEqual(next.neighbors.bea,state.neighbors.bea)
  assert.equal(next.culinary.stock[recipe],1)
  assert.equal(next.coins,state.coins)
 }
})
