import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { runInNewContext } from 'node:vm'
import * as Farm from '../src/farm.ts'
import * as Supper from '../src/shared-supper.ts'
import { getRequirementHint } from '../src/requirement-guidance.ts'
import { freightStock } from '../src/bay-freight-model.ts'
import { getLocalWarehouseSupply, warehouseConfirmation, warehouseConfirmationValue, withdrawWarehouseSupply } from '../src/warehouse-guidance.ts'
import { renderHarbourFishChoice } from '../src/harbour-fish-route.ts'
import test from 'node:test'
import { getDiscoveryTask, getSupplyGuidance } from '../src/discovery-path.ts'
import { renderDiscoveryGuidance } from '../src/discovery-preferences-ui.ts'
import { chooseDiscoveryIdea } from '../src/discovery-preferences.ts'
import { getFishAction, getVillageHomeCount, getVillageMeal, type OrchardIslandId } from '../src/farm.ts'
import { commissionPlayer } from './fixtures/commission-player.ts'

const milestones=JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json',import.meta.url),'utf8')) as {name:string;args:unknown[]}[]
const meals=milestones.flatMap((step,index)=>step.name==='serveVillageMeal'?[index]:[])
const seen={collections:true,islands:true}
function beforeSupper(completed:0|1=0){
  const fishBeforeMeal=milestones.slice(0,meals[completed]).findLastIndex(step=>step.name==='catchFish')
  const p=commissionPlayer(milestones.slice(0,fishBeforeMeal))
  assert.deepEqual([p.state.island,p.state.village.meals,p.state.handmade.round,p.state.fish.perch,p.state.fish.seaBass],['home',completed,1,0,0])
  return p
}
type Player=ReturnType<typeof beforeSupper>
function fish(p:Player) {
  const cast=p.act('beginFishingTrip')
  p.act('finishFishingTrip',cast.token,1)
}
function spendDailyQuota(p:Player,island:OrchardIslandId) {
  p.visit(island)
  while(getFishAction(p.state).available)fish(p)
}
function hint(p:Player) {
  const before=structuredClone(p.state)
  const action=getDiscoveryTask(p.state,seen)
  assert.deepEqual(p.state,before,'getting a hint cannot sail, pay, or touch the table')
  return action
}

test('the first shared supper accepts Grove bass now; its live guide should not send a bread-carrying player home for perch',()=>{
  const p=beforeSupper();p.visit('grove')
  const startDay=p.state.day, startCoins=p.state.coins
  assert.equal(getVillageMeal(p.state).fish,'perch','Bea’s usual choice with no fish carried')
  const oldExact=getSupplyGuidance(p.state,{kind:'fish',item:'perch',quantity:1},'общий ужин')
  assert.deepEqual(oldExact.action,{label:'Домой',target:'sail',value:'home'},'specific fish requests still require their own source')
  assert.ok(chooseDiscoveryIdea(p.state.discoveryPreferences,oldExact,oldExact.id),'same saved suggestion ID as the earlier shore hint')
  p.reload()
  const today=hint(p)
  assert.equal(today?.action.target,'visit-pier','this pier already catches an ordinary fish the supper can use')
  assert.match(today?.detail??'',/окунь или сибас/i)
  const card=renderDiscoveryGuidance(p.state.discoveryPreferences,today,today).focus
  assert.match(card,/data-action="follow-task"[^>]*>К рыбацкому причалу/)
  assert.doesNotMatch(card,/Доступные дела|>Домой<\/button>/)
  assert.equal(p.state.fish.seaBass,0);fish(p);assert.equal(p.state.fish.seaBass,1)
  assert.deepEqual(hint(p)?.action,{label:'В Лавандовую гавань',target:'sail',value:'village'})
  p.visit('village')
  assert.equal(getVillageMeal(p.state,'round').fish,'seaBass')
  assert.equal(hint(p)?.action.target,'village-meal')
  p.act('serveVillageMeal','round')
  assert.deepEqual([p.state.day,p.state.coins,p.state.fish.seaBass,p.state.handmade.round,p.state.village.meals,getVillageHomeCount(p.state)],
    [startDay,startCoins,0,0,1,1])
})

test('a second ordinary catch in Grove can open the second cottage the same day, without an automatic invitation',()=>{
  const p=beforeSupper(1);p.visit('grove')
  const day=p.state.day
  assert.equal(hint(p)?.action.target,'visit-pier')
  fish(p);p.visit('village')
  assert.equal(hint(p)?.action.target,'village-meal')
  p.act('serveVillageMeal','round')
  assert.equal(p.state.day,day)
  assert.equal(getVillageHomeCount(p.state),2)
  assert.deepEqual(p.state.village.residents,['bea',null])
  assert.equal(hint(p)?.action.value,'1')
})

test('a carried-fish shortage checks local stored bass before asking the player to cast again',()=>{
  const p=beforeSupper();p.visit('grove');fish(p)
  p.act('transferBayGoods','deposit','grove','seaBass',1)
  assert.equal(p.state.fish.seaBass,0)
  const next=hint(p)
  assert.equal(next?.action.target,'warehouse-supply')
  assert.equal(next?.action.value,'seaBass|1')
  p.act('transferBayGoods','withdraw','grove','seaBass',1)
  assert.equal(hint(p)?.action.value,'village')
})

test('when a local pier is spent, the guide prefers another open ordinary-fish shore; with both spent it recommends rest',()=>{
  const p=beforeSupper()
  spendDailyQuota(p,'home')
  p.act('sellMarketItem','fish:perch',p.state.fish.perch)
  assert.deepEqual(hint(p)?.action,{label:'В рощу',target:'sail',value:'grove'})
  spendDailyQuota(p,'grove')
  p.visit('home');p.act('sellMarketItem','fish:seaBass',p.state.fish.seaBass)
  assert.equal(hint(p)?.action.target,'visit-rest')
  const was=p.state.day;p.night()
  assert.equal(p.state.day,was+1)
  assert.equal(hint(p)?.action.target,'visit-pier')
})

const source=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
const start=source.indexOf("    case 'harbour-fish-catch':"),end=source.indexOf("    case 'harbour-fish-trade':",start)
assert.ok(start>0&&end>start)
const clickCatch=stripTypeScriptTypes(`(async()=>{switch('harbour-fish-catch'){${source.slice(start,end)}}})()`)

async function followTable(farm:Farm.FarmState,panel='village-meal',open=true,crossing=false) {
 const shown:unknown[]=[], calls:string[]=[], clone=Farm.restoreCurrentFarm(JSON.parse(JSON.stringify(farm)))!
 const terminal=()=>({day:clone.day,coins:clone.coins,fish:clone.fish,work:clone.workToday,mealOn:clone.village.mealOn,meals:clone.village.meals,freight:clone.freight})
 const before=structuredClone(terminal())
 const ctx={...Farm,...Supper,farm:clone,panel,dialog:{open},control:{},island:{isCrossing:()=>crossing},
  value:undefined, // This suite activates the ordinary catch/rest/table button, not a construction warehouse quote.
  selectedWarehouseRequest:undefined as Farm.StockItem | undefined,
  async visitPanelAt(island:Farm.IslandId,target:string) {
    calls.push(`open:${island}:${target}`)
    if(clone.island!==island)assert.ok(Farm.sail(clone,island).ok)
  },
  async showRequirement(req:Parameters<typeof getRequirementHint>[1]) {
    shown.push(structuredClone(req))
    for(let dep=0;dep<3;dep++) {
      const {action}=getRequirementHint(clone,req)
      calls.push([action.target,action.value].filter(Boolean).join(':'))
      if(action.target!=='sail')return
      assert.ok(Farm.sail(clone,action.value as Farm.IslandId).ok)
    }
    assert.fail('route never settled')
  }}
 await runInNewContext(clickCatch,ctx)
 assert.deepEqual(terminal(),before,'routing alone cannot cast, spend, sleep, complete supper or dispatch ferry')
 return {calls,shown,...(ctx.selectedWarehouseRequest ? {request:structuredClone(ctx.selectedWarehouseRequest)} : {})}
}

const fishReq=(item:'perch'|'seaBass',quantity=1)=>({kind:'stock',item:{kind:'fish',item,quantity}})
function fromUsedHome() {
 const p=beforeSupper(1)
 spendDailyQuota(p,'home');p.act('sellMarketItem','fish:perch',p.state.fish.perch);p.visit('village')
 assert.deepEqual([p.actions,p.state.day,p.state.village.meals,p.state.fishCaughtToday.home,p.state.fishCaughtToday.grove,p.state.handmade.round],[111,14,1,3,0,1])
 return p
}
const html=(f:Farm.FarmState)=>renderHarbourFishChoice(f,'supper')

test('the table sends an earned empty-plate hiker to the still-open Grove and the second cottage can open today',async()=>{
 const ordinary=beforeSupper(1);ordinary.visit('village')
 assert.deepEqual(await followTable(ordinary.state),{calls:['sail:home','visit-pier'],shown:[fishReq('perch')]},'the usual Home tie preference stays in place')
 const p=fromUsedHome(),f=p.state, before=structuredClone(f)
 assert.match(html(f),/data-action="harbour-fish-catch">Поймать бесплатно/)
 assert.match(html(f),/data-action="harbour-fish-trade"/)
 assert.deepEqual(hint(p)?.action,{label:'В рощу',target:'sail',value:'grove'})
 assert.deepEqual(await followTable(f),{calls:['sail:grove','visit-pier'],shown:[fishReq('seaBass')]})
 assert.deepEqual(f,before)
 p.visit('grove');fish(p);p.visit('village');p.act('serveVillageMeal','round')
 assert.deepEqual([p.state.day,p.state.village.meals,p.state.coins, getVillageHomeCount(p.state)],[14,2,before.coins,2])
 assert.equal(p.state.village.residents[1],null)
 assert.deepEqual(await followTable(p.state),{calls:[],shown:[]},'stale table control never routes on a served day')
})

test('both piers exhausted offers real rest instead of a false catch, and charter building keeps its exact species',async()=>{
 const p=fromUsedHome()
 spendDailyQuota(p,'grove');p.visit('home');p.act('sellMarketItem','fish:seaBass',p.state.fish.seaBass);p.visit('village')
 const f=p.state,before=structuredClone(f)
 assert.deepEqual(hint(p)?.action,{label:'Домой',target:'sail',value:'home'})
 assert.doesNotMatch(html(f),/Поймать бесплатно/)
 assert.match(html(f),/data-action="harbour-fish-catch">К отдыху дома/)
 assert.match(html(f),/data-action="harbour-fish-trade"/)
 assert.deepEqual(await followTable(f),{calls:['open:home:rest'],shown:[]})
 const charter=commissionPlayer(milestones.slice(0,70))
 assert.equal(charter.state.village.built,false)
 assert.match(renderHarbourFishChoice(charter.state),/data-action="harbour-fish-catch">Поймать бесплатно/)
 assert.deepEqual((await followTable(charter.state,'village-project')).shown,[fishReq('seaBass',2)],'project uses the existing exact two bass need')
 assert.deepEqual(await followTable(f,'village-meal',false),{calls:[],shown:[]})
 assert.deepEqual(f,before)
})

test('a locally stored earned bass keeps the player by the table rather than sending them to fish or buying fish',async()=>{
 const p=fromUsedHome()
 p.visit('grove');fish(p);p.visit('village');p.act('transferBayGoods','deposit','village','seaBass',1)
 const f=p.state,before=structuredClone(f)
 assert.equal(hint(p)?.action.target,'warehouse-supply')
 assert.match(html(f),/data-action="harbour-fish-catch">К рыбе на складе/)
 assert.doesNotMatch(html(f),/Поймать бесплатно/)
 assert.match(html(f),/data-action="harbour-fish-trade"/)
 assert.deepEqual(await followTable(f),{calls:['warehouse-supply:seaBass|1'],shown:[fishReq('seaBass')]})
 assert.deepEqual(f,before)
 p.act('transferBayGoods','withdraw','village','seaBass',1)
 assert.deepEqual(await followTable(p.state),{calls:[],shown:[]},'stale table choice cannot route when fish has just arrived')
})


test('both spent piers do not hide earned bass stored in Grove; crossing, taking one, and serving are separate choices',async()=>{
  const player=beforeSupper(1)
  spendDailyQuota(player,'home');player.act('sellMarketItem','fish:perch',player.state.fish.perch)
  spendDailyQuota(player,'grove');player.act('transferBayGoods','deposit','grove','seaBass',player.state.fish.seaBass)
  player.visit('village');player.reload()
  const farm=player.state,before=structuredClone(farm), request={kind:'fish',item:'seaBass',quantity:1} as const
  assert.deepEqual([player.actions,farm.day,farm.coins,farm.fishCaughtToday.home,farm.fishCaughtToday.grove,freightStock(farm.freight,'grove','seaBass')],[121,14,83,3,4,4])
  assert.deepEqual([getFishAction({...farm,island:'home'}).available,getFishAction({...farm,island:'grove'}).available],[false,false])
  assert.deepEqual([farm.fish.perch,farm.fish.seaBass, getVillageMeal(farm).served],[0,0,false])
  assert.deepEqual(hint(player)?.action,{label:'В рощу',target:'sail',value:'grove'})
  assert.match(html(farm),/data-action="harbour-fish-catch">На склад в рощу/)
  assert.match(html(farm),/data-action="harbour-fish-trade"/)
  assert.doesNotMatch(html(farm),/Поймать бесплатно|К отдыху дома/)
  assert.deepEqual(await followTable(farm),{calls:['open:grove:warehouse-supply'],shown:[],request})
  assert.deepEqual(await followTable(farm,'village-meal',true,true),{calls:[],shown:[]},'stale click cannot navigate while already crossing')
  assert.equal(getLocalWarehouseSupply(farm,request),undefined,'no local transfer before explicitly crossing')
  assert.deepEqual(farm,before)
  player.visit('grove')
  assert.deepEqual([player.state.fish.seaBass,freightStock(player.state.freight,'grove','seaBass'),player.state.village.meals],[0,4,1])
  assert.equal(hint(player)?.action.target,'warehouse-supply')
  const supply=getLocalWarehouseSupply(player.state, request)
  assert.ok(supply);assert.deepEqual([supply.port,supply.stored,supply.quantity],['grove',4,1])
  const expected=warehouseConfirmation(warehouseConfirmationValue(supply))
  const remote=structuredClone(before)
  assert.equal(withdrawWarehouseSupply(remote, request, expected).ok,false,'no cross-island take, even with a valid Grove token')
  assert.deepEqual(remote,before)
  assert.equal(withdrawWarehouseSupply(player.state,request,expected).ok,true)
  assert.equal(withdrawWarehouseSupply(player.state,request,expected).ok,false,'a second press cannot take another fish')
  player.reload()
  assert.deepEqual([player.state.fish.seaBass,freightStock(player.state.freight,'grove','seaBass'),player.state.village.meals],[1,3,1])
  player.visit('village')
  assert.equal(hint(player)?.action.target,'village-meal')
  player.act('serveVillageMeal','round')
  assert.deepEqual([player.state.day,player.state.coins,player.state.fish.seaBass,player.state.village.meals,getVillageHomeCount(player.state),player.state.village.residents[1]],[14,83,0,2,2,null])
  assert.deepEqual(await followTable(player.state),{calls:[],shown:[]},'next day never suggested because of a stale button')
})

test('a remote stock does not replace an open ordinary shore or a usable local warehouse',async()=>{
  const player=beforeSupper(1)
  spendDailyQuota(player,'home')
  player.act('transferBayGoods','deposit','home','perch',1)
  player.act('sellMarketItem','fish:perch',player.state.fish.perch)
  player.visit('village')
  assert.deepEqual(await followTable(player.state),{calls:['sail:grove','visit-pier'],shown:[fishReq('seaBass')]})
  spendDailyQuota(player,'grove');player.act('transferBayGoods','deposit','grove','seaBass',1)
  player.visit('village');player.act('transferBayGoods','deposit','village','seaBass',player.state.fish.seaBass)
  assert.equal(Supper.getSupperFishRecovery(player.state).kind,'warehouse')
  assert.deepEqual(await followTable(player.state),{calls:['warehouse-supply:seaBass|1'],shown:[fishReq('seaBass')]},'existing local fish wins over both remote choices without replacing the paid one')
  assert.match(html(player.state),/data-action="harbour-fish-trade"/)
})
