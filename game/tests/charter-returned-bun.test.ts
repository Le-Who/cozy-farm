import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import test from 'node:test'
import {runInNewContext} from 'node:vm'
import * as F from '../src/farm.ts'
import {receiveFerryExpedition} from '../src/harbour-economy.ts'
import {getRequirementHint,type Requirement} from '../src/requirement-guidance.ts'
import {getIslandJourneys} from '../src/journey.ts'
import {renderHarbourFishChoice} from '../src/harbour-fish-route.ts'
import {renderVillageBudget} from '../src/village-budget.ts'
import {commissionPlayer} from './fixtures/commission-player.ts'

const read=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8')
const opening=JSON.parse(read('./fixtures/home-progress-actions.json'))
const source=read('../src/main.ts')
const sea=(s:string,e:string)=>{const a=source.indexOf(s),b=source.indexOf(e,a+1);assert.ok(a>=0&&b>a,[s,e]);return source.slice(a,b)}
const boat=sea("    case 'boat': {","    case 'dock-project':")
const checklist=boat.split('\n').find(l=>l.includes('const checklist ='))!
const markup=stripTypeScriptTypes(sea('function requirementLink(', 'const islandNames =')
 +sea('function deliveryItems(', 'function harborCard(')+sea('function villageProjectCard()', 'function finishSharedSupper(')
 +sea('async function showRequirement(', '// Scene handlers own material sounds.')
 +`\nfunction voyageRequirements(){const destination=getIslandJourneys(farm).find(p=>p.id==='village'), requirements=destination.requirements;${checklist};return checklist}
 async function click(action,value,control){switch(action){
 ${sea("    case 'show-requirement':","    case 'picnic-field':")}
 ${sea("    case 'expedition-claim':","    case 'music-warehouse-visit':")}
 ${sea("    case 'build-village':","    case 'village-slot':")}
 }}; ({villageProjectCard,voyageRequirements,click})`)
const row={kind:'journey',island:'village',id:'supply-handmade'} as const
const round={kind:'stock',item:{kind:'handmade',item:'round',quantity:1}} as const

function town(delivered=1) {
 const p=commissionPlayer(opening.slice(0,delivered?68:66))
 p.visit('grove')
 for(let i=0;i<2;i++){const cast=p.act('beginFishingTrip');p.act('finishFishingTrip',cast.token,1)}
 p.visit('home');p.act('contributeVillage')
 assert.deepEqual([p.state.day,p.state.coins,p.state.village.built,p.state.village.supplies['handmade:round']??0],[8,120,false,delivered])
 assert.deepEqual(F.getVillageProject(p.state).items.map(x=>x.delivered),[delivered,2,2])
 return p
}
function cargo(delivered=1, id='mill-buy', returnToday=true) {
 const p=town(delivered)
 if(id==='mill-buy')p.act('deliverMarketOrder','pantry')
 p.act('sendFerryExpedition',id); if(returnToday)p.night()
 return p
}

function panel(farm:F.FarmState,entry:'village-project'|'boat') {
 const noop=()=>{}, given:Requirement[] = [], writes:F.FarmState[]=[], actions:string[]=[], route:string[]=[]
 const ctx:any={...F,farm,panel:entry,dialog:{open:true},requirementLinks:new Map<string,Requirement>(),
  getIslandJourneys,getRequirementHint,renderHarbourFishChoice,renderVillageBudget,
  panelTitles:{'bay-freight':'Грузовой паром',workshop:'Кондитерская',seeds:'Семена'},
  icon:()=>'',iconUrl:()=>'',stockLabel:(item:F.StockItem)=>({name:({handmade:'Круглая булочка',honey:'Цветочный мёд',fish:'Морской окунь'} as Record<string,string>)[item.kind],image:''}),
  button:(label:string,action:string,enabled=true)=>`<button data-action="${action}"${enabled?'':' disabled'}>${label}</button>`,
  nav:(...html:string[])=>html.join(''),playBaySound:noop,bayAudio:{playEvent:noop},
  bayProductId:()=>'',getBerryNurserySource:()=>undefined,
  fieldViewButton:{getAttribute:()=> 'false'}, closeDialog(){ctx.dialog.open=false;actions.push('close')}, island:{focusTarget:(v:any)=>route.push('focus:'+v.kind+':'+v.index)},
  dialogContent:{contains:()=>true,querySelector:(s:string)=>{route.push(s);return null}},highlightControl:noop,
  selectedExpeditionPort:undefined,selectedExpeditionOffer:undefined,
  expeditionOfferAfterClaim:(_exp:unknown,active:{id:string})=>active.id,
  ferryPeachPlanting:{receive:receiveFerryExpedition}, event:{detail:1},document:{activeElement:null},
  openPanel(panel:string){actions.push('open:'+panel);ctx.panel=panel;ctx.dialog.open=true},
  notify:noop,
  perform(action:()=>F.ActionResult){const v=action();if(v.ok)writes.push(structuredClone(farm));return v.ok},
 }
 const menu=runInNewContext(markup,ctx)
 function draw(){
  ctx.requirementLinks.clear()
  const html:string=entry==='boat'?menu.voyageRequirements():menu.villageProjectCard()
  const ids=[...html.matchAll(/data-action="show-requirement" data-value="(\d+)"[^>]*aria-label="Где найти: Круглая булочка[^"]*"/gu)]
  assert.equal(ids.length,1,html);const key=ids[0][1]
  given.push(ctx.requirementLinks.get(key)!)
  return {html,key}
 }
 return {draw,given,writes,actions,route,click:(action:string,key?:string)=>menu.click(action,key,{})}
}

test('both real construction ingredient controls open the exact ready cargo without claiming it or pledging anything',async()=>{
 const confirmed=[]
 for(const entry of ['village-project','boat'] as const){
  const p=cargo(), f=p.state, view=panel(f,entry), before=structuredClone(f)
  assert.deepEqual([f.day,f.coins,f.handmade.round,f.produce.wheat,F.getVillageProject(f).status],[9,126,0,0,'waiting'])
  assert.deepEqual(f.freight.expeditions.active?.incoming,[{id:'handmade:round',quantity:1}])
  const {html,key}=view.draw()
  if(entry==='village-project')assert.match(html,/data-action="workshop"[^>]*>Кондитерская/)
  await view.click('show-requirement',key)
  assert.deepEqual(f,before);assert.equal(view.writes.length,0)
  confirmed.push({entry,f,before,view})
 }
 const actual = confirmed.map(({entry,view})=>({entry,actions:view.actions,route:view.route}))
 assert.deepEqual(actual,['village-project','boat'].map(entry=>({entry,actions:['open:bay-freight'],route:['[data-action="expedition-claim"]']})))
 for(const {f,before,view} of confirmed){
  assert.deepEqual(JSON.parse(JSON.stringify(view.given[0])),row)
  await view.click('expedition-claim')
  assert.deepEqual([f.day,f.coins,f.handmade.round,f.freight.expeditions.active,f.village.built],[9,126,1,null,false])
  assert.deepEqual(f.village.supplies,before.village.supplies)
  assert.equal(view.writes.length,1)
  await view.click('expedition-claim');assert.equal(view.writes.length,1)
  const actualBuild=panel(f,'village-project')
  await actualBuild.click('build-village')
  assert.deepEqual([f.coins,f.handmade.round,f.village.built,actualBuild.writes.length],[78,0,true,1])
  assert.equal(F.contributeVillage(f).ok,false)
  assert.deepEqual(F.restoreCurrentFarm(JSON.parse(JSON.stringify(f))),f)
 }
})

test('genuinely available manual baking, underway cargo, one short of two and returned proceeds all keep existing paths',()=>{
 const local=town(), ripe=()=>getRequirementHint(local.state,row)
 assert.equal(ripe().action.target,'workshop')
 local.act('bakeWorkshop','round');assert.equal(ripe().action.target,'village-project')
 local.act('contributeVillage');assert.deepEqual([local.state.day,local.state.coins,local.state.village.built],[8,72,true])

 const underway=cargo(1,'mill-buy',false).state
 const underBefore=structuredClone(underway)
 assert.equal(underway.freight.expeditions.active?.phase,'sailing')
 assert.deepEqual(getRequirementHint(underway,row),getRequirementHint(underway,round))
 assert.notEqual(getRequirementHint(underway,row).action.value,'bay-freight')
 assert.equal(receiveFerryExpedition(underway).ok,false);assert.deepEqual(underway,underBefore)

 const tooLittle=cargo(0).state
 assert.deepEqual([F.getVillageProject(tooLittle).items[0].delivered,tooLittle.freight.expeditions.active?.incoming[0]?.quantity],[0,1])
 assert.notEqual(getRequirementHint(tooLittle,row).action.value,'bay-freight')

 const wrong=cargo(1,'mill-sale').state
 assert.deepEqual(wrong.freight.expeditions.active?.incoming,[])
 assert.ok(wrong.freight.expeditions.active?.earnCoins)
 assert.equal(getRequirementHint(wrong,row).action.target,'focus-bed')
 assert.equal(getRequirementHint(wrong,row).action.value,'0')

 const salt=cargo(1,'mill-sale')
 salt.act('receiveFerryExpedition')
 for(let safety=0;salt.state.produce.wheat<2;safety++) {
  assert.ok(safety<6)
  const bed=salt.state.beds[0]
  if(F.getBedStage(bed)==='ripe'){salt.act('workBed',0,0);continue}
  if(bed.kind==='tilled')salt.act('workBed',0,0)
  if(F.getBedAction(salt.state,0).kind==='water'){
   if(!salt.state.water)salt.act('refillWater')
   salt.act('workBed',0,0)
  }
  salt.night()
 }
 salt.act('sendFerryExpedition','explore-salt');salt.night();salt.act('receiveFerryExpedition')
 salt.act('sendFerryExpedition','salt-buy');salt.night()
 assert.deepEqual(salt.state.freight.expeditions.active?.incoming,[{id:'seaSalt',quantity:2}])
 assert.notEqual(getRequirementHint(salt.state,row).action.value,'bay-freight','a different live item is not a round roll')
})

test('regular recipe lookup still points to the field and leaving Home does not turn into a free ferry claim',()=>{
 const p=cargo(), before=structuredClone(p.state)
 assert.deepEqual([getRequirementHint(p.state,round).action.target,getRequirementHint(p.state,round).action.value],['focus-bed','0'])
 assert.deepEqual(p.state,before)
 p.visit('grove')
 const away=structuredClone(p.state), hint=getRequirementHint(p.state,row)
 assert.notEqual(hint.action.value,'bay-freight')
 assert.deepEqual(p.state,away)
})
