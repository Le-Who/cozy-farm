import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
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
