import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import test from 'node:test'
import {runInNewContext} from 'node:vm'
import * as F from '../src/farm.ts'
import {getDiscoveryTask} from '../src/discovery-path.ts'
import {getGuidanceTask} from '../src/discovery-guidance.ts'
import {renderDiscoveryGuidance} from '../src/discovery-preferences-ui.ts'
import {getRequirementHint} from '../src/requirement-guidance.ts'
import {FerryPeachPlanting} from '../src/ferry-peach-planting.ts'
import {expeditionOfferAfterClaim} from '../src/ferry-expeditions.ts'
import {commissionPlayer} from './fixtures/commission-player.ts'

const read=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8')
const stock=JSON.parse(read('./fixtures/home-progress-actions.json')) as {name:string;args:unknown[]}[]
const main=read('../src/main.ts')
const slice=(from:string,to:string)=>{
 const a=main.indexOf(from),b=main.indexOf(to,a+from.length)
 assert.ok(a>=0&&b>a,from);return main.slice(a,b)
}
const markMap=stripTypeScriptTypes(slice("  if (next === 'archive' || next === 'boat') {","  if (next !== panel && next !== 'festival')"))
const action=stripTypeScriptTypes(slice('function currentTask()','function status()')
 + `\nasync function activate(action,value,control){${slice("  if (action === 'follow-task') {","  switch (action) {")}
 switch(action){
 ${slice("    case 'open-panel': if(value&&value in panelTitles)","\n")}
 ${slice("    case 'expedition-claim':","    case 'music-warehouse-visit':")}
 ${slice("    case 'village-project': openPanel('village-project'); break","\n")}
 ${slice("    case 'build-village':","    case 'village-supply-pledge':")}
 default: calls.push(['route',action,value])
 }}; ({activate,currentTask})`)
const review='К вернувшемуся парому'
const requirement={kind:'journey',island:'village',id:'supply-handmade'} as const

function route(farm:F.FarmState, entry:'hud'|'journal'='hud'){
  const calls:unknown[]=[];const writes:string[]=[]
  const env={...F,farm,getDiscoveryTask,getGuidanceTask,expeditionOfferAfterClaim,calls,selectedExpeditionPort:undefined,selectedExpeditionOffer:undefined,
   panel:entry==='journal'?'journal':undefined,dialog:{open:entry==='journal'},island:{isCrossing:()=>false},
   panelTitles:{'bay-freight':'Грузовой паром','village-project':'Живая бухта'},
   document:{activeElement:null},event:{detail:1},ferryPeachPlanting:new FerryPeachPlanting(),
   playBaySound:()=>{},bayAudio:{playEvent:()=>{}},openPanel(next:string){env.panel=next;env.dialog.open=true;calls.push(['opened',next])},
   perform(commit:()=>F.ActionResult){const r=commit();if(r.ok)writes.push(r.message);return r.ok},
  }
  const sim=runInNewContext(action,env)
  return {calls,writes, get panel(){return env.panel},task:()=>sim.currentTask(),
   follow:()=>sim.activate('follow-task',undefined,{}),claim:()=>sim.activate('expedition-claim',undefined,{}),
   build:()=>sim.activate('build-village',undefined,{})}
}
function town(pledged=1){
 const opened=stock.slice(0,pledged?68:66).map(s=>s.name==='workBed'?{...s,args:[s.args[0],1000]}:s)
 const p=commissionPlayer(opened)
 p.visit('grove')
 for(let i=0;i<2;i++){const cast=p.act('beginFishingTrip');p.act('finishFishingTrip',cast.token,1)}
 p.visit('home');p.act('contributeVillage')
 assert.deepEqual([p.state.day,p.state.coins,p.state.village.built,p.state.village.supplies['handmade:round']??0],[8,120,false,pledged])
 assert.deepEqual(F.getVillageProject(p.state).items.map(x=>x.delivered),[pledged,2,2])
 // Ordinary map opening in this previously travelled profile. Execute its existing code, not an economy grant.
 runInNewContext(markMap,{next:'boat',farm:p.state,saveFarm:()=>{},status:()=>{}})
 p.reload()
 return p
}
function paid(){const p=town();p.act('deliverMarketOrder','pantry');return p}
const projection=(f:F.FarmState)=>getDiscoveryTask(f,f.orientation)?.action

test('earned Day 9 Journal and HUD review the paid exact bun; explicit claim and construction remain separate',async()=>{
 for(const entry of ['hud','journal'] as const){
  const p=paid()
  p.act('sendFerryExpedition','mill-buy');p.night()
  const f=p.state,before=structuredClone(f)
  assert.deepEqual([f.day,f.coins,f.produce.wheat,f.eggs,f.handmade.round],[9,126,0,1,0])
  const known=getRequirementHint(f,requirement)
  assert.deepEqual([known.action.target,known.action.value,known.selector],['open-panel','bay-freight','[data-action="expedition-claim"]'])
  const ui=route(f,entry),next=ui.task()
  assert.deepEqual(JSON.parse(JSON.stringify(next.action)),{label:review,target:'open-panel',value:'bay-freight'},
   'the shared main progress action must not send an already-paid charter back to plant wheat')
  assert.match(renderDiscoveryGuidance(f.discoveryPreferences,getDiscoveryTask(f,f.orientation),next).focus,
   /data-action="follow-task"[^>]*>К вернувшемуся парому<\/button>/)
  assert.ok(main.includes("taskCard.dataset.action = 'follow-task'"))
  await ui.follow()
  assert.deepEqual(ui.calls,[['opened','bay-freight']]);assert.equal(ui.panel,'bay-freight')
  assert.deepEqual(f,before);assert.equal(ui.writes.length,0)
  await ui.claim()
  assert.equal(ui.writes.length,1)
  assert.deepEqual([f.coins,f.handmade.round,f.village.built,f.freight.expeditions.active],[126,1,false,null])
  assert.deepEqual(f.village.supplies,before.village.supplies)
  await ui.claim();assert.equal(ui.writes.length,1)
  assert.deepEqual([projection(f)?.target,projection(f)?.value],['village-project',undefined])
  await ui.follow();assert.equal(ui.panel,'village-project');assert.equal(ui.writes.length,1)
  await ui.build()
  assert.deepEqual([f.day,f.coins,f.handmade.round,f.village.built,ui.writes.length],[9,78,0,true,2])
  assert.deepEqual(F.restoreCurrentFarm(JSON.parse(JSON.stringify(f))),f)
 }
})

test('manual D8, underway, absent, insufficient arrival, sales-only, wrong port and off-island retain their actual source',()=>{
 const manual=town(),m=manual.state
 assert.deepEqual([projection(m)?.target,projection(m)?.value],['workshop','round'])
 manual.act('bakeWorkshop','round');manual.act('contributeVillage')
 assert.deepEqual([manual.state.day,manual.state.coins,manual.state.village.built],[8,72,true])
 const none=paid();assert.equal(projection(none.state)?.target,'focus-bed')
 const transit=paid();transit.act('sendFerryExpedition','mill-buy')
 assert.equal(transit.state.freight.expeditions.active?.phase,'sailing')
 assert.equal(projection(transit.state)?.target,'focus-bed')
 transit.night();transit.visit('grove')
 assert.notEqual(projection(transit.state)?.value,'bay-freight')
 const insufficient=town(0);insufficient.act('deliverMarketOrder','pantry');insufficient.act('sendFerryExpedition','mill-buy');insufficient.night()
 assert.deepEqual([insufficient.state.village.supplies['handmade:round']??0,insufficient.state.freight.expeditions.active?.incoming[0]?.quantity],[0,1])
 assert.deepEqual([projection(insufficient.state)?.target,projection(insufficient.state)?.value],['workshop','round'])
 const sale=town();sale.act('sendFerryExpedition','mill-sale');sale.night()
 assert.deepEqual(sale.state.freight.expeditions.active?.incoming,[])
 assert.ok(sale.state.freight.expeditions.active?.earnCoins)
 assert.notEqual(projection(sale.state)?.value,'bay-freight')
 sale.act('receiveFerryExpedition')
 for(let i=0;sale.state.produce.wheat<2&&i<8;i++){
  const bed=F.getBedAction(sale.state,0)
  if(bed.kind==='water'&&!sale.state.water)sale.act('refillWater')
  if(bed.kind==='plant'||bed.kind==='harvest'||bed.kind==='water')sale.act('workBed',0,2000)
  else sale.night()
 }
 sale.act('sendFerryExpedition','explore-salt');sale.night();sale.act('receiveFerryExpedition')
 sale.act('sendFerryExpedition','salt-buy');sale.night()
 assert.deepEqual(sale.state.freight.expeditions.active?.incoming,[{id:'seaSalt',quantity:2}])
 assert.notEqual(projection(sale.state)?.value,'bay-freight')
})
