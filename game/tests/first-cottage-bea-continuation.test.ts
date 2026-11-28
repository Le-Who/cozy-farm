import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import * as F from '../src/farm.ts'
import { getDiscoveryTask } from '../src/discovery-path.ts'
import { renderDiscoveryGuidance } from '../src/discovery-preferences-ui.ts'
import { getSupperFishRecovery } from '../src/shared-supper.ts'
import { commissionPlayer } from './fixtures/commission-player.ts'

const read=(p:string)=>readFileSync(new URL(p,import.meta.url),'utf8')
const opening: {name:string;args:unknown[]}[] = JSON.parse(read('./fixtures/market-order-selection-commands.json'))
const settleBea=opening.findIndex(step=>step.name==='inviteResident' && step.args[0]==='bea')
assert.equal(settleBea,79)
const firstCottage=()=>commissionPlayer([{name:'pickFruit',args:[0]},...opening.slice(0,settleBea+1)])
type Player=ReturnType<typeof firstCottage>
const local={label:'К встрече',target:'open-neighbor',value:'bea'}
const mainland={label:'Домой',target:'sail',value:'home'}
const plates=[{slot:'food',x:0,y:0},{slot:'cup',x:.4,y:.2},{slot:'flowers',x:-.4,y:.2}] as const
const ready=(farm:F.FarmState,intent:'delicate'|'portable')=>F.getIntentOffers(farm,intent).filter(o=>o.available).map(o=>o.id)
const readGuide=(farm:F.FarmState)=>{
  const before=structuredClone(farm), goal=getDiscoveryTask(farm,farm.orientation)
  assert.ok(goal);assert.deepEqual(farm,before)
  return goal
}
const signature=(p:Player)=>p.act('completeSignature',{base:'preserves',ingredients:[{id:'apple',quantity:2}]},{family:'preserves',processing:'silky',fruit:[],steps:['mix','pour']}).recipeId as string
const serve=(p:Player,id:string,food:string,kind:'table'|'basket')=>{
  p.act('joinNeighborPlan',id)
  p.act('serveNeighborPlan',id,food)
  p.act('finishNeighborPlan',id,{kind,settled:true,placements:plates})
}
function basket(){
  const p=firstCottage(), recipe=signature(p)
  serve(p,'bea:1',`signature:${recipe}`,'table')
  p.visit('home')
  for(const bed of [0,2,3]){p.act('workBed',bed);p.act('workBed',bed)}
  p.act('buyFeed');p.act('feedChickens');p.night()
  for(const bed of [0,2,3])if(F.getBedAction(p.state,bed).kind==='water')p.act('workBed',bed)
  p.night()
  for(const bed of [0,2,3])p.act('workBed',bed)
  p.act('collectEggs');p.visit('village')
  const before=[p.state.day,p.state.coins,p.state.village.meals,p.state.handmade.round,p.state.produce.wheat,p.state.eggs]
  assert.deepEqual(before,[10,94,1,0,6,5])
  p.act('runResidentService','bea','round')
  assert.deepEqual([p.actions,p.state.coins,p.state.handmade.round,p.state.produce.wheat,p.state.eggs],[102,94,4,2,3])
  return p
}
function perch(p:Player){
  const cast=p.act('beginFishingTrip')
  p.act('finishFishingTrip',cast.token,[{kind:'fish',species:'perch',variant:'regular'}])
}

test('earned D8 ready tea replaces only the departure hint; opening the existing meeting commits nothing',()=>{
  const p=firstCottage(), f=()=>p.state
  assert.deepEqual([p.actions,f().day,f().island,f().coins,f().fruit.apple,f().village.meals],[81,8,'village',72,2,0])
  assert.deepEqual(readGuide(f()).action,mainland,'an unfunded ordinary start keeps its sourcing hint')
  const recipe=signature(p);assert.deepEqual(ready(f(),'delicate'),[`signature:${recipe}`])
  assert.deepEqual([F.getNeighborPlans(f())[0].phase,F.getNeighborPlans(f())[0].food],['preparing',null])
  const goal=readGuide(f())
  assert.deepEqual(goal.action,local)
  assert.deepEqual([goal.label,goal.detail,goal.progress,goal.target],['Чай у Беа','Конфитюр: яблоко',0,2])
  const focus=renderDiscoveryGuidance(f().discoveryPreferences,goal,goal).focus
  assert.equal((focus.match(/data-action="follow-task"/g)??[]).length,1)
  assert.match(focus,/data-action="follow-task"[^>]*>К встрече<\/button>/)
  assert.doesNotMatch(focus,/>Домой<\/button>/)
  const main=read('../src/main.ts')
  const start=main.indexOf("    case 'open-neighbor':"),end=main.indexOf("    case 'neighbor-help-house':",start)
  assert.ok(start>0&&end>start)
  const before=structuredClone(f()), opened:string[]=[]
  const ctx={farm:f(),...F,action:goal.action.target,value:goal.action.value,communityRequest:undefined,communityResident:'finn',requestedFood:undefined,openPanel:(next:string)=>opened.push(next)}
  runInNewContext(`switch (action) {${main.slice(start,end)}}`,ctx)
  assert.deepEqual(opened,['neighbor'])
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.communityRequest)),{kind:'neighbor',resident:'bea',planId:'bea:1'})
  assert.deepEqual(f(),before)
  p.act('joinNeighborPlan','bea:1')
  assert.equal(F.getNeighborPlans(f())[0].food,null,'Join still does not choose or spend a dish')
  assert.deepEqual(readGuide(f()).action,local)
  p.act('serveNeighborPlan','bea:1',`signature:${recipe}`)
  assert.deepEqual(readGuide(f()).action,local)
  assert.deepEqual([f().coins,f().culinary.stock[recipe],f().village.meals],[72,1,0])
  p.act('finishNeighborPlan','bea:1',{kind:'table',settled:true,placements:plates})
  assert.deepEqual([f().coins,f().culinary.stock[recipe],f().village.meals],[98,0,1])
  assert.deepEqual(readGuide(f()).action,mainland,'today’s completed meal still waits for a different day')
})

test('earned D10 Bea bakery output can go to her ready basket rather than an unnecessary fish crossing',()=>{
  const p=basket(), f=()=>p.state
  const exact=F.getNeighborPlans(f())[0]
  assert.deepEqual([exact.id,exact.episode,exact.phase,F.getVillageMeal(f()).available],['bea:2','beaBasket','preparing',false])
  assert.deepEqual(getSupperFishRecovery(f()),{ kind:'shore',shore:'home',item:{kind:'fish',item:'perch',quantity:1} })
  assert.deepEqual(ready(f(),'portable'),['dish:orchardTart','handmade:round'])
  const goal=readGuide(f())
  assert.deepEqual(goal.action,local)
  assert.deepEqual([goal.label,goal.detail,goal.progress,goal.target],['Корзинка для прогулки','Угощение готово',1,2])
  const before=structuredClone(f())
  p.act('joinNeighborPlan','bea:2')
  assert.deepEqual(readGuide(f()).action,local)
  p.act('serveNeighborPlan','bea:2','handmade:round')
  assert.deepEqual(readGuide(f()).action,local)
  assert.deepEqual([f().coins,f().handmade.round,f().fish.perch,f().village.meals],[before.coins,4,0,1])
  p.act('finishNeighborPlan','bea:2',{kind:'basket',settled:true,placements:plates})
  assert.deepEqual([f().coins,f().handmade.round,f().fish.perch,F.getVillageHomeCount(f()),f().village.residents[1]],[126,3,0,2,null])
  assert.deepEqual(readGuide(f()).action,{label:'К свободному домику',target:'visit-cottage',value:'1'})
})

test('earned ready ordinary supper, ready warehouse fish, and remote pier keep their existing actions',()=>{
  const p=basket(), f=()=>p.state
  p.visit('home')
  assert.deepEqual(readGuide(f()).action,{label:'К рыбацкому причалу',target:'visit-pier'})
  perch(p)
  p.visit('village')
  assert.equal(F.getVillageMeal(f()).available,true)
  assert.equal(readGuide(f()).action.target,'village-meal')
  p.act('transferBayGoods','deposit','village','perch',1)
  assert.equal(F.getVillageMeal(f()).available,false)
  assert.deepEqual(getSupperFishRecovery(f()),{kind:'warehouse',port:'village',item:{kind:'fish',item:'perch',quantity:1}})
  assert.equal(readGuide(f()).action.target,'warehouse-supply')
  assert.deepEqual(ready(f(),'portable'),['dish:orchardTart','handmade:round'],'the exact basket remains available through its normal separate entry')
})

test('earned exhausted fishing for the day still offers a known stored fish, then actual rest after spending it',()=>{
  const p=basket(), f=()=>p.state
  for (const [shore,fish] of [['home','perch'],['grove','seaBass']] as const) {
    p.visit(shore)
    for (let castCount=0;castCount<4 && F.getFishAction(f()).available;castCount++){
      const cast=p.act('beginFishingTrip')
      p.act('finishFishingTrip',cast.token,[{kind:'fish',species:fish,variant:'regular'}])
    }
  }
  p.visit('home')
  assert.deepEqual([f().fish.perch,f().fish.seaBass],[3,4])
  p.act('transferBayGoods','deposit','home','perch',1)
  p.act('sellMarketItem','fish:perch',2)
  p.act('sellMarketItem','fish:seaBass',4)
  p.visit('village')
  assert.deepEqual(getSupperFishRecovery(f()),{kind:'warehouse',port:'home',item:{kind:'fish',item:'perch',quantity:1}})
  assert.equal(readGuide(f()).label,'Рыба на складе')
  assert.deepEqual(readGuide(f()).action,mainland)
  p.visit('home')
  p.act('transferBayGoods','withdraw','home','perch',1)
  p.act('sellMarketItem','fish:perch',1)
  p.visit('village')
  assert.deepEqual(getSupperFishRecovery(f()),{kind:'rest'})
  assert.equal(readGuide(f()).label,'Дождитесь нового утра')
  assert.deepEqual(readGuide(f()).action,mainland)
  assert.deepEqual(ready(f(),'portable'),['dish:orchardTart','handmade:round'])
})
