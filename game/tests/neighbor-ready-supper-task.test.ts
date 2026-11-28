import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import * as F from '../src/farm.ts'
import { getDiscoveryTask } from '../src/discovery-path.ts'
import { getSupperFishRecovery, renderSupperResult } from '../src/shared-supper.ts'
import { commissionPlayer } from './fixtures/commission-player.ts'
import { harbourTradePlayer } from './fixtures/harbour-trade-player.ts'

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

test('funded and spent choices use the matching local or ordinary supper path', () => {
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
  assert.equal(F.getNeighborPlans(notChosen)[0].food,null)
  assert.ok(F.getIntentOffers(notChosen,'delicate').some(offer=>offer.available),'the prior unselected fixture genuinely has food')
  assert.deepEqual(discover(notChosen)?.action,{label:'К встрече',target:'open-neighbor',value:'bea'},'review a funded invitation without choosing a dish')
  assert.deepEqual(notChosen,snapshot)
  const spent=cold(fixed)
  assert.ok(F.tasteSignature(spent,recipe,'bea').ok)
  assert.equal(spent.culinary.stock[recipe],0)
  assert.equal(F.getNeighborPlans(cold(spent))[0].phase,'arranging','the old choice still exists')
  assert.deepEqual(discover(spent)?.action,{label:'Домой',target:'sail',value:'home'},'one gone serving does not intercept sourcing; retrieval and manual cooking still work')
})

test('D14 joined tea with no actual eligible portion keeps the ordinary fish route', () => {
  const {p,recipe}=readyTea(false)
  p.act('tasteSignature',recipe,'bea') // Ordinary tasting spends the only fitting portion.
  const f=cold(p.state), before=structuredClone(f)
  assert.deepEqual([F.getNeighborPlans(f)[0].phase,F.getNeighborPlans(f)[0].food],['joined',null])
  assert.equal(F.getIntentOffers(f,'delicate').some(offer=>offer.available),false)
  assert.deepEqual(discover(f)?.action,{label:'Домой',target:'sail',value:'home'})
  assert.deepEqual(f,before)
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

function firstHarbour(resident: F.ResidentId) {
  const p=harbourTradePlayer(opening)
  p.build('mill-buy');p.visit('village')
  assert.deepEqual([p.actions,p.state.day,p.state.coins,p.state.handmade.round,p.state.dishes.orchardTart,
    p.state.fish.perch,p.state.fish.seaBass,p.state.village.meals,F.getVillageHomeCount(p.state)],
    [88,13,29,1,1,0,0,0,1])
  p.act('inviteResident',resident,0)
  return cold(p.state)
}

test('D13 Finn’s first local lunch is ready from the carried bun before the player joins or chooses food', () => {
  const f=firstHarbour('finn'), id='finn:1', before=structuredClone(f)
  const expectLocal=() => {
    const next=discover(f)
    assert.deepEqual(next?.action,{label:'К встрече',target:'open-neighbor',value:'finn'})
    assert.equal(next?.label,'Обед у воды')
    assert.equal(next?.detail,F.workshopDefinitions.round.name)
    assert.deepEqual([next?.progress,next?.target],[0,2])
    return next!
  }
  const initial=expectLocal()
  const main=read('../src/main.ts'), start=main.indexOf("    case 'open-neighbor':"), end=main.indexOf("    case 'neighbor-help-house':",start)
  assert.ok(start>=0&&end>start)
  const opened:string[]=[]
  const context={farm:f,action:initial.action.target,value:initial.action.value,residentIds:F.residentIds,getNeighborPlans:F.getNeighborPlans,
    communityResident:'bea',requestedFood:'dish:orchardTart',communityRequest:undefined as {planId:string}|undefined,
    openPanel:(panel:string)=>opened.push(panel)}
  runInNewContext(`switch (action) {${main.slice(start,end)}}`,context)
  assert.deepEqual(opened,['neighbor']);assert.equal(context.communityRequest?.planId,id)
  assert.equal(context.requestedFood,undefined)
  assert.equal(F.getNeighborPlans(f)[0].phase,'preparing')
  assert.deepEqual(f,before,'the existing invitation does not join, spend, sail or select a dish')
  assert.ok(F.joinNeighborPlan(f,id).ok)
  assert.equal(F.getNeighborPlans(f)[0].food,null)
  const joined=structuredClone(f)
  expectLocal()
  assert.deepEqual(f,joined)
  assert.ok(F.serveNeighborPlan(f,id,'handmade:round').ok)
  assert.deepEqual([f.coins,f.handmade.round,f.village.meals],[29,1,0])
  expectLocal() // Existing selected ready route takes over.
  assert.ok(F.finishNeighborPlan(f,id,{...table,kind:'basket'}).ok)
  assert.deepEqual([f.island,f.coins,f.handmade.round,f.dishes.orchardTart,f.fish.seaBass,f.village.meals,F.getVillageHomeCount(f)],
    ['village',61,0,1,0,1,1])
  assert.notEqual(discover(f)?.action.target,'open-neighbor','a second meal is not available that day')
})

test('early invitation without a carried match, remote Finn, and a funded ordinary dinner keep normal guidance', () => {
  const bea=firstHarbour('bea'), plain=firstHarbour('finn'), before=structuredClone(bea)
  assert.deepEqual(discover(bea)?.action,{label:'Домой',target:'sail',value:'home'})
  assert.deepEqual(bea,before)
  assert.ok(F.sail(plain,'grove').ok)
  assert.equal(discover(plain)?.action.target,'visit-pier','away from the village the normal fish source remains')
  const cast=F.beginFishingTrip(plain)
  assert.ok(cast.ok&&cast.token)
  assert.ok(F.finishFishingTrip(plain,cast.token,[{kind:'fish',species:'seaBass',variant:'regular'}]).ok)
  assert.ok(F.sail(plain,'village').ok)
  assert.equal(discover(plain)?.action.target,'village-meal','funded ordinary dinner stays primary')
  assert.equal(F.getNeighborPlans(plain)[0].phase,'preparing')
  const absent=firstHarbour('finn')
  assert.ok(F.sail(absent,'home').ok)
  assert.ok(F.sellMarketItem(absent,'handmade:round',1).ok)
  assert.ok(F.sail(absent,'village').ok)
  assert.equal(F.getIntentOffers(absent,'hearty').some(offer=>offer.available),false)
  assert.notEqual(discover(absent)?.action.target,'open-neighbor')
})

test('D13 Finn lunch remains local with two genuinely earned carried pastry choices and picks neither for the player', () => {
  const p=harbourTradePlayer(opening)
  assert.deepEqual([p.actions,p.state.day,p.state.selectedSeed,p.state.seeds.wheat,p.state.eggs],[72,8,'wheat',3,1])
  // One extra seed uses the same two already-required farming mornings.
  for(const i of [0,2]){p.act('workBed',i);p.act('workBed',i)}
  p.night()
  for(const i of [0,2])if(F.getBedAction(p.state,i).kind==='water')p.act('workBed',i)
  p.night()
  for(const i of [0,2])p.act('workBed',i)
  assert.deepEqual([p.state.day,p.state.produce.wheat],[10,4])
  p.build('mill-buy')
  assert.deepEqual([p.state.day,p.state.produce.wheat,p.state.eggs],[13,2,1])
  p.act('bakeWorkshop','folded');p.visit('village');p.act('inviteResident','finn',0)
  assert.deepEqual([p.actions,p.state.coins,p.state.fish.perch,p.state.fish.seaBass],[93,29,0,0])
  const f=cold(p.state), before=structuredClone(f)
  const ready=()=>F.getIntentOffers(f,'hearty').filter(offer=>offer.available).map(offer=>offer.id)
  assert.deepEqual(ready(),['handmade:round','handmade:folded'])
  assert.equal(F.getVillageMeal(f).available,false)
  const expectLocal=()=>{
    const goal=discover(f)
    assert.deepEqual(goal?.action,{label:'К встрече',target:'open-neighbor',value:'finn'})
    assert.equal(goal?.detail,'Угощение готово')
    assert.equal(F.getNeighborPlans(f)[0].food,null)
  }
  expectLocal()
  assert.deepEqual(f,before)
  assert.ok(F.joinNeighborPlan(f,'finn:1').ok)
  expectLocal()
  assert.deepEqual(ready(),['handmade:round','handmade:folded'])
  assert.ok(F.serveNeighborPlan(f,'finn:1','handmade:folded').ok)
  assert.equal(discover(f)?.detail,F.workshopDefinitions.folded.name)
  assert.deepEqual([f.handmade.round,f.handmade.folded,f.coins],[1,1,29])
  assert.ok(F.finishNeighborPlan(f,'finn:1',{...table,kind:'basket'}).ok)
  assert.deepEqual([f.handmade.round,f.handmade.folded,f.coins,f.village.meals],[1,0,61,1])
})
