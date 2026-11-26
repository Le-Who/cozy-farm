import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import * as F from '../src/farm.ts'
import { getDiscoveryTask } from '../src/discovery-path.ts'
import { getSupperFishRecovery, renderSupperResult } from '../src/shared-supper.ts'
import { commissionPlayer } from './fixtures/commission-player.ts'

const read = (file:string) => readFileSync(new URL(file,import.meta.url),'utf8')
const opening: {name:string;args:unknown[]}[] = JSON.parse(read('./fixtures/home-progress-actions.json'))
const suppers = opening.flatMap((command,index) => command.name==='serveVillageMeal' ? [index] : [])
const intentId = 'bea:1'
const table: F.NeighborAssembly = { kind:'table',settled:true,placements:[
  {slot:'food',x:0,y:0},{slot:'cup',x:.4,y:.2},{slot:'flowers',x:-.4,y:.2}] }
const discover = (farm:F.FarmState) => getDiscoveryTask(farm,farm.orientation)
const cold = (f:F.FarmState) => {
  const result=F.restoreCurrentFarm(JSON.parse(JSON.stringify(f)))
  assert.ok(result);return result
}

function readyTea(select = true) {
  const beforeCatch = suppers[1]-2
  assert.equal(opening[beforeCatch].name,'catchFish')
  const p=commissionPlayer(opening.slice(0,beforeCatch))
  assert.deepEqual([p.state.day,p.state.island,p.state.coins,p.state.handmade.round,p.state.fish.perch,p.state.fish.seaBass,p.state.village.meals],
    [14,'home',68,1,0,0,1])
  const recipe=p.cook(), offer=`signature:${recipe}` as const
  p.act('joinNeighborPlan',intentId)
  if(select)p.act('serveNeighborPlan',intentId,offer)
  return {p,recipe}
}

test('D14 chosen local tea can open the existing gathering without an unnecessary fish trip, then unlock the same cottage', () => {
  const {p,recipe}=readyTea(), f=cold(p.state), before=structuredClone(f)
  assert.equal(F.getVillageMeal(f,'round').available,false)
  assert.equal(F.getVillageHomeCount(f),1)
  assert.deepEqual(getSupperFishRecovery(f),{kind:'shore',shore:'home',item:{kind:'fish',item:'perch',quantity:1}})
  const goal=discover(f)
  assert.deepEqual(goal?.action,{label:'К встрече',target:'open-neighbor',value:'bea'})
  assert.equal(goal?.label,'Чай у Беа');assert.equal(goal?.detail,'Конфитюр: яблоко + груша')
  assert.deepEqual([goal?.progress,goal?.target],[1,2])
  const main=read('../src/main.ts'), start=main.indexOf("    case 'open-neighbor':"), end=main.indexOf("    case 'neighbor-help-house':",start)
  assert.ok(start>=0&&end>start)
  const opened:string[]=[]
  const context={farm:f,action:goal!.action.target,value:goal!.action.value, residentIds:F.residentIds,getNeighborPlans:F.getNeighborPlans,
    communityResident:'finn',requestedFood:'handmade:round',communityRequest:undefined as {planId:string}|undefined,
    openPanel:(panel:string)=>opened.push(panel)}
  runInNewContext(`switch (action) {${main.slice(start,end)}}`,context)
  assert.deepEqual(opened,['neighbor']);assert.equal(context.communityResident,'bea')
  assert.equal(context.communityRequest?.planId,intentId)
  assert.deepEqual(f,before,'opening the exact gathering does not serve, depart, transfer or spend')
  assert.equal(F.getNeighborPlans(f)[0].reward,31)
  assert.ok(F.finishNeighborPlan(f,intentId,table).ok)
  assert.deepEqual([f.island,f.coins,f.handmade.round,f.fish.perch,f.culinary.stock[recipe],F.getVillageHomeCount(f)],['village',99,1,0,0,2])
  assert.equal(f.neighbors.bea.helpReady,true)
  assert.deepEqual(f.village.residents,['bea',null],'invitation remains separate')
  assert.equal(discover(f)?.id,'second-neighbour')
  assert.match(renderSupperResult(f,'',''),/data-action="supper-cottage"/)
  const paid=structuredClone(f)
  assert.equal(F.finishNeighborPlan(f,intentId,table).ok,false)
  assert.deepEqual(f,paid)
})

test('ready dinner, different shore, unselected food, and spent serving keep the old route', () => {
  const {p,recipe}=readyTea(), fixed=cold(p.state), fish=cold(fixed)
  assert.ok(F.sail(fish,'home').ok)
  assert.equal(discover(fish)?.action.target,'visit-pier','no implicit trip or remote tea from Home')
  assert.ok(F.catchFish(fish,true).ok);assert.ok(F.sail(fish,'village').ok)
  const before=structuredClone(fish)
  assert.equal(discover(fish)?.action.target,'village-meal','a ready ordinary dinner is still the direct option')
  assert.deepEqual(fish,before)
  assert.ok(F.serveVillageMeal(fish,'round').ok)
  assert.equal(fish.culinary.stock[recipe],1,'serving dinner does not submit a prepared tea')
  assert.equal(fish.coins,68);assert.equal(F.getVillageHomeCount(fish),2)
  assert.equal(discover(fish)?.id,'second-neighbour','a completed milestone does not redirect to tea')

  const notChosen=readyTea(false).p.state, snapshot=structuredClone(notChosen)
  assert.equal(discover(notChosen)?.action.target,'sail','a joined visit with no chosen serving is not ready')
  assert.deepEqual(notChosen,snapshot)
  const spent=cold(fixed)
  assert.ok(F.tasteSignature(spent,recipe,'bea').ok)
  assert.equal(spent.culinary.stock[recipe],0)
  assert.equal(F.getNeighborPlans(cold(spent))[0].phase,'arranging','the old choice still exists')
  assert.deepEqual(discover(spent)?.action,{label:'Домой',target:'sail',value:'home'},'one gone serving does not intercept sourcing; retrieval and manual cooking still work')
})

test('a prepared on-site tea after the first regular dinner on that same day does not count again', () => {
  const p=commissionPlayer(opening.slice(0,suppers[0]+1)), day=p.state.day
  const recipe=p.cook(), offer=`signature:${recipe}` as const
  assert.equal(p.state.day,day,'ordinary fruit was already available today')
  p.act('joinNeighborPlan',intentId);p.act('serveNeighborPlan',intentId,offer)
  const f=cold(p.state)
  assert.equal(f.village.meals,1);assert.equal(f.village.mealOn,f.day)
  assert.notEqual(discover(f)?.action.target,'open-neighbor')
  assert.ok(F.finishNeighborPlan(f,intentId,table).ok,'the gathering itself can still earn its normal independent payoff')
  assert.equal(f.village.meals,1);assert.equal(F.getVillageHomeCount(f),1)
})
