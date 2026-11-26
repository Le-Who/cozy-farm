import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import * as Farm from '../src/farm.ts'
import * as Routes from '../src/harbour-fish-route.ts'
import { getRequirementHint, type Requirement } from '../src/requirement-guidance.ts'
import { getLocalWarehouseSupply, warehouseConfirmation, warehouseConfirmationValue, withdrawWarehouseSupply } from '../src/warehouse-guidance.ts'
import { commissionPlayer } from './fixtures/commission-player.ts'

const read = (p:string) => readFileSync(new URL(p,import.meta.url),'utf8')
const milestones = JSON.parse(read('./fixtures/home-progress-actions.json'))
const main = read('../src/main.ts')
function between(a:string,b:string) {
  const from=main.indexOf(a),to=main.indexOf(b,from)
  assert.ok(from>=0&&to>from)
  return main.slice(from,to)
}
const click=stripTypeScriptTypes(between('async function visitPanelAt(', 'function openGuidedMarket(')
  + "\n;(async()=>{switch(action){" + between("    case 'harbour-fish-catch':","    case 'expedition-discovery':") + "}})()")
const fish = {kind:'fish',item:'seaBass',quantity:2} as const
const need = {kind:'stock',item:fish} as const
const row = (farm:Farm.FarmState) => Farm.getVillageProject(farm).items.find(({item})=>item.kind==='fish')!
const wh = (f:Farm.FarmState,port:'home'|'grove'='grove')=>f.freight.warehouses[port].seaBass??0
type Player=ReturnType<typeof commissionPlayer>
function catchBass(p:Player) {
  const cast=p.act('beginFishingTrip')
  p.act('finishFishingTrip',cast.token,1)
}
function stocked() {
  const p=commissionPlayer(milestones.slice(0,58))
  assert.deepEqual([p.state.day,p.state.island,p.state.coins,p.state.fairGuestsServed],[6,'home',120,1])
  p.visit('grove')
  while(Farm.getFishAction(p.state).available)catchBass(p)
  p.act('gatherSeaSalt')
  p.act('transferBayGoods','deposit','grove','seaBass',2)
  p.visit('home');p.act('sellMarketItem','fish:seaBass',2)
  const f=p.state
  assert.deepEqual([f.day,f.coins,f.island,f.fishCaughtToday.grove,f.fish.seaBass,wh(f),f.seaSalt,f.honey,f.handmade.round],
    [6,140,'home',4,0,2,2,3,0])
  return p
}
const rendered=(f:Farm.FarmState)=>Routes.renderHarbourFishChoice(f)
function catchButton(f:Farm.FarmState) {
  const matches=[...rendered(f).matchAll(/<button[^>]*data-action="harbour-fish-catch"([^>]*)>([^<]*)<\/button>/g)]
  assert.equal(matches.length,1)
  const [,attrs,label]=matches[0]
  return {label,value:attrs.match(/data-value="([^"]*)"/)?.[1]}
}
async function activate(
  farm:Farm.FarmState, value?:string, action='harbour-fish-catch',
  {open=true,crossing=false,panel='village-project'}={}
) {
  const calls:string[]=[],writes:Farm.FarmState[]=[]
  const ctx={...Farm,...Routes,farm,action,value,panel,control:{},
    dialog:{open},selectedWarehouseRequest:undefined as Farm.StockItem|undefined,
    selectedExpeditionPort:undefined,selectedExpeditionOffer:undefined,
    panelHistory:[],fieldViewButton:{getAttribute:()=> 'false'},
    rememberPanel:()=>({panel:ctx.panel}),
    closeDialog:()=>{ctx.panel='';ctx.dialog.open=false;calls.push('close')},
    openPanel:(id:string)=>{ctx.panel=id;ctx.dialog.open=true;calls.push('open:'+id)},
    drawPanel:()=>calls.push('refresh'),
    island:{isCrossing:()=>crossing,crossIsland:async(commit:()=>boolean)=>{calls.push('cross');assert.ok(commit())}},
    perform:(apply:()=>Farm.ActionResult)=>{const ok=apply().ok;if(ok)writes.push(structuredClone(farm));return ok},
    showRequirement:(req:Requirement)=>{
      const {action,notice}=getRequirementHint(farm,req)
      calls.push([action.target,action.value,notice].filter(Boolean).join(':'))
    },
  }
  await runInNewContext(click,ctx)
  return {calls,writes,request:ctx.selectedWarehouseRequest,port:ctx.selectedExpeditionPort,offer:ctx.selectedExpeditionOffer,history:ctx.panelHistory}
}
function explicitlyWithdraw(f:Farm.FarmState,request:Farm.StockItem) {
  const supply=getLocalWarehouseSupply(f,request)
  assert.ok(supply)
  const token=warehouseConfirmation(warehouseConfirmationValue(supply))
  assert.ok(withdrawWarehouseSupply(f,request,token).ok)
  assert.equal(withdrawWarehouseSupply(f,request,token).ok,false)
  return supply
}

test('earned Day6 housing offers its real Grove reserve instead of waiting; sailing, exact take and partial pledge remain separate',async()=>{
  const f=stocked().state, before=structuredClone(f)
  const button=catchButton(f)
  assert.equal(button.label,'На склад в рощу')
  assert.ok(button.value,'stock review must retain its action identity')
  assert.match(rendered(f),/data-action="harbour-fish-trade"/)
  assert.deepEqual(f,before)
  const visit=await activate(f,button.value)
  const arrived=structuredClone(before); assert.ok(Farm.sail(arrived,'grove').ok)
  assert.deepEqual(visit.calls,['close','cross','open:warehouse-supply'])
  assert.deepEqual(visit.history,[],'no same-island Back invented for a crossed shore')
  assert.deepEqual(visit.request,fish)
  assert.deepEqual(visit.writes,[arrived]);assert.deepEqual(f,arrived)
  assert.equal(f.fish.seaBass,0);assert.equal(wh(f),2)
  assert.equal(f.village.built,false);assert.deepEqual(f.village.supplies,{})
  assert.equal(explicitlyWithdraw(f,visit.request!).quantity,2)
  assert.deepEqual([f.day,f.coins,f.fish.seaBass,wh(f),f.village.supplies],[6,140,2,0,{}])
  assert.ok(Farm.sail(f,'home').ok)
  assert.ok(Farm.contributeVillage(f).ok)
  assert.deepEqual([f.day,f.coins,f.fish.seaBass,f.honey,f.village.supplies,f.village.built],
    [6,140,0,1,{'fish:seaBass':2,honey:2},false])
})

test('same stocked start can instead earn 34 coins today and pledge two replacement fish tomorrow',()=>{
  const p=stocked()
  p.visit('grove');p.act('transferBayGoods','withdraw','grove','seaBass',2);p.visit('home')
  p.act('deliverMarketOrder','grove');p.act('sellMarketItem','fish:seaBass',1)
  assert.deepEqual([p.state.day,p.state.coins,p.state.fish.seaBass,wh(p.state),p.state.village.supplies],[6,174,0,0,{}])
  assert.match(getRequirementHint(p.state,need).notice??'',/Рыба вернётся в эти воды завтра/)
  p.night();p.visit('grove');catchBass(p);catchBass(p);p.visit('home');p.act('contributeVillage')
  assert.deepEqual([p.state.day,p.state.coins,p.state.village.supplies,p.state.village.built],
    [7,174,{'fish:seaBass':2,honey:2},false])
})

test('insufficient, empty, live shore, local reserve and separate paid preview keep ordinary controls',async()=>{
  const p=stocked()
  const paid=Routes.getHarbourFishRoute(p.state), paidBefore=structuredClone(p.state)
  const paidVisit=await activate(p.state,undefined,'harbour-fish-trade')
  assert.deepEqual([paidVisit.calls,paidVisit.port,paidVisit.offer,paidVisit.writes],[['open:bay-freight'],paid.port,paid.offer,[]])
  assert.deepEqual(p.state,paidBefore)
  p.visit('grove');p.act('transferBayGoods','withdraw','grove','seaBass',1);p.visit('home');p.act('sellMarketItem','fish:seaBass',1)
  assert.equal(wh(p.state),1)
  assert.deepEqual(catchButton(p.state),{label:'Поймать бесплатно',value:undefined})
  assert.deepEqual((await activate(p.state)).calls,['focus-place:farmhouse:Рыба вернётся в эти воды завтра.'])
  p.visit('grove');p.act('transferBayGoods','withdraw','grove','seaBass',1);p.visit('home');p.act('sellMarketItem','fish:seaBass',1)
  assert.equal(wh(p.state),0);assert.equal(catchButton(p.state).label,'Поймать бесплатно')
  const open=stocked()
  open.night();assert.equal(catchButton(open.state).label,'Поймать бесплатно')
  assert.deepEqual((await activate(open.state)).calls,['sail:grove'])
  open.visit('grove');open.act('transferBayGoods','withdraw','grove','seaBass',2);open.visit('home')
  open.act('transferBayGoods','deposit','home','seaBass',2)
  assert.equal(wh(open.state,'home'),2)
  assert.match((await activate(open.state)).calls[0],/^warehouse-supply:seaBass\|2/)
})

test('an exact remaining one fish works after a partial pledge; stale/foreign/closed clicks cannot cross',async()=>{
  const p=stocked(),button=catchButton(p.state)
  const first=p.state
  assert.deepEqual((await activate(first,button.value,'harbour-fish-catch',{open:false})).calls,[])
  assert.deepEqual((await activate(first,button.value,'harbour-fish-catch',{crossing:true})).calls,[])
  p.visit('grove');p.act('transferBayGoods','withdraw','grove','seaBass',1)
  assert.deepEqual((await activate(p.state,button.value)).calls,[],'stale Home element cannot navigate at Grove')
  p.visit('home');p.act('sellMarketItem','fish:seaBass',1)
  const stale=structuredClone(p.state)
  const refused=await activate(p.state,button.value)
  assert.deepEqual(refused.calls,['refresh']);assert.deepEqual(refused.writes,[]);assert.deepEqual(p.state,stale)
  p.night();p.visit('grove');catchBass(p);p.visit('home');p.act('contributeVillage')
  assert.equal(row(p.state).delivered,1)
  p.visit('grove')
  while(Farm.getFishAction(p.state).available)catchBass(p)
  p.visit('home');p.act('sellMarketItem','fish:seaBass',p.state.fish.seaBass)
  assert.equal(wh(p.state),1)
  const remaining=catchButton(p.state)
  assert.equal(remaining.label,'На склад в рощу')
  const result=await activate(p.state,remaining.value)
  assert.deepEqual(result.request,{...fish,quantity:1})
  assert.equal(explicitlyWithdraw(p.state,result.request!).quantity,1)
  assert.deepEqual([p.state.village.supplies['fish:seaBass'],p.state.fish.seaBass],[1,1])
})
