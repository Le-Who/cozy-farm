import A from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes as strip} from 'node:module'
import {runInNewContext as vm} from 'node:vm'
import * as F from '../src/farm.ts'
import * as G from '../src/requirement-guidance.ts'
import * as H from '../src/harbour-economy.ts'
import * as W from '../src/warehouse-guidance.ts'
import * as V from '../src/neighbor-visits.ts'
import {ruCount} from '../src/ru.ts'
import {harbourCraftReturnPlayer} from './fixtures/harbour-craft-return.ts'

const read=(leaf:string)=>readFileSync(new URL('../src/'+leaf,import.meta.url),'utf8')
const main=process.env.COZY_D31_STOCK_MAIN ? readFileSync(process.env.COZY_D31_STOCK_MAIN,'utf8') : read('main.ts')
const ui=read('bay-festival-ui.ts')
const cut=(start:string,end:string)=>{const i=main.indexOf(start),j=main.indexOf(end,i+start.length);A.ok(i>=0&&j>i,start);return main.slice(i,j)}
const help=cut("    case 'festival-source': {","    case 'festival-activity': {")
const contribute=cut("    case 'festival-contribute': {","    case 'festival-finish': {")
const shop=cut("    case 'workshop': {","    case 'cookery': {")
const helper=main.includes('function activeFestivalWorkshop(') ? cut('function activeFestivalWorkshop(','type PanelVisit =') : ''
const wire=strip(helper+cut('function focusKey(','// The route key is rebuilt')
 +cut('function leaveScene()','function returnFromNeighborArrangement(')
 +cut('function goBack(','\nlet harbourScene:')
 +cut('function openPanel(', "  if (next === 'recipes') {")+' showPanel(next) }'
 +cut('function closeDialog()','function refresh()')
 +cut('async function showRequirement(', '// Scene handlers own material sounds.')
 +`async function tap(action,value,control){switch(action){${help}${contribute}}}
 function workshop(){switch(panel){${shop}}}
 ;({tap,workshop,leaveScene,focusKey})`)
const festival=vm(strip(ui.slice(ui.indexOf('const escape =')).replace(/^export (?=function )/gm,'')
 .replaceAll('import.meta.env.BASE_URL','"/"')+';renderFestivalPanel'),{...F,ruCount}) as (f:F.FarmState)=>string

function earn() {
 const {p}=harbourCraftReturnPlayer()
 A.deepEqual([p.actions,p.state.day,p.state.coins,p.state.festivals.completed.harvest],[204,25,218,1])
 const status=()=>F.getFestivalStatus(p.state).active!
 p.act('beginFestival','harvest');p.act('contributeFestival','fruit','apple');p.act('contributeFestival','fruit','pear')
 p.visit('home');A.equal(p.state.beds.findIndex(b=>b.kind==='tilled'),0)
 if(p.state.selectedSeed!=='carrot')p.act('selectSeed','carrot')
 p.act('workBed',0,0)
 for(let d=25;d<29;d++) {
  if(F.getBedAction(p.state,0).kind==='water'){
   if(!p.state.water)p.act('refillWater')
   p.act('workBed',0,0)
  }
  if(d===27){p.visit('grove');p.act('plantTree',1,'apple')}
  if(d===28){p.visit('cape');for(let i=0;i<3;i++)if(p.state.capeFlowers[i]===null)p.act('plantCapeFlower',i)}
  p.night()
 }
 p.act('workBed',0,0);p.act('pickFruit',0);p.act('sellMarketItem','fruit:apple',1)
 p.visit('village');p.act('contributeFestival','participation','harvest')
 while(status().stage===0){
  const crop=status().requirements.find(r=>r.id==='roots')!.alternatives.find(a=>a.available)
  A.ok(crop);p.act('contributeFestival','roots',crop.id)
 }
 p.night();p.visit('village')
 A.deepEqual([p.actions,p.state.day,status().stage],[232,30,1])
 p.visit('grove');p.act('pickFruit',1);p.visit('village')
 p.act('contributeFestival','honey','honey');p.act('contributeFestival','honey','apple')
 p.night();p.visit('village')
 A.deepEqual([p.actions,p.state.day,p.state.island,p.state.coins,p.state.produce.wheat,p.state.eggs,p.state.dishes.orchardTart,status().label],
   [240,31,'village',222,5,3,1,'Выпечка на пледе'])
 return p
}
type Options={initialShape:F.WorkshopShape;recipe:'pastry'|'bread';onBake(shape:F.WorkshopShape):boolean;onCancel:()=>void;
 readyOrder?:()=>{name:string;label:string;open:()=>void}|undefined}
const none=()=>undefined
const local={kind:'handmade',item:'round',quantity:1} as const
const stable=(farm:F.FarmState)=>JSON.stringify(farm)
function scene(farm:F.FarmState, origin='festival') {
 const log:string[]=[],focus:string[]=[],writes:string[]=[], plans=[]
 const neutral={tabIndex:0,focus:()=>focus.push('neutral:festival-requirement'),scrollIntoView:()=>focus.push('reveal')}
 const entry={action:'festival-source',value:'treat|round'}
 const source={dataset:entry,closest:()=>null,focus:()=>focus.push('source:'+entry.value),getClientRects:()=>[1]}
 const row=()=>[...festival(farm).matchAll(/<button[^>]+data-action="(festival-(?:source|contribute))" data-value="(treat\|[^"]+)"([^>]*)>/g)]
  .filter(([,_,__,tail])=>!/\bdisabled\b/.test(tail))
  .map(([,action,value])=>({dataset:{action,value},getClientRects:()=>[1],
   closest:(s:string)=>s==='.festival-requirement'?neutral:null,focus:()=>focus.push('button:'+value)}))
 const dialog={open:true,close(){this.open=false},querySelectorAll:()=>ctx.panel==='festival'?row():[]}
 const content={contains:(x:unknown)=>ctx.attached&&source===x,innerHTML:'',scrollTop:73,
   querySelector:()=>null,querySelectorAll:(s:string)=>s.includes('festival-source')?row().filter(x=>x.dataset.action==='festival-source')
    : s.includes('festival-contribute')?row().filter(x=>x.dataset.action==='festival-contribute'):[]}
 const ctx:any={...F,...G,...W,farm,dialog,panel:origin,dialogContent:content,
  panelHistory:plans, attached:true, workshopGame:undefined, workshopRecipe:'bread',pastryShape:'folded',
  gardenEditor:{reset:none},salePresentation:{reset:none},transplantSelection:{reset:none},berryNurserySelection:{reset:none},
  berryRenewalSelection:{reset:none},recipeSurplusSelection:{reset:none},marketSaleBrowse:{reset:none},
  recipeBook:{load:none},restoreFerryPanelView:none,requestAnimationFrame:(fn:()=>void)=>fn(),
  signatureSlots:[],panelRenderVersion:1,marketTab:'buy',fieldViewButton:{getAttribute:()=> 'false'},app:{dataset:{}},
  drawPanel:()=>log.push('redraw'),notify:none,playBaySound:none,highlightControl:none,openGuidedSeeds:(crop:string)=>log.push('seeds:'+crop),
  island:{isCrossing:()=>false,crossIsland:async(fn:()=>unknown)=>fn(),setViewMode:none,setCoveFocus:none,focusTarget:(target:{kind:string;index?:number})=>log.push('world:'+target.kind)},
  ...Object.fromEntries('rememberClosedMarketSell stopHarbour stopFishing stopWorkshop stopCookery stopArrangement updateCommunityReturn'.split(' ').map(k=>[k,none])),
  rememberPanel(){return {panel:ctx.panel, workshopRecipe:ctx.workshopRecipe,pastryShape:ctx.pastryShape, signatureSlots:[],recipeBook:{},marketNextOpen:[],scroll:content.scrollTop,focus:api.focusKey(source)}},
  createWorkshop(_h:unknown,o:Options){return o},
  showPanel(next:string){ctx.panel=next;ctx.dialog.open=true;content.scrollTop=0;log.push('open:'+next);if(next==='workshop')api.workshop()},
  perform(fn:()=>F.ActionResult){const r=fn();if(r.ok)writes.push(r.message);return r.ok},
 }
 for(const n of `hiveFlower selectedMarketOrder pickedMarketOrder journeyDetailsOpen journalDetailsOpen selectedExpeditionPort selectedExpeditionOffer selectedWarehouseRequest selectedWarehouse freightPlanOpen inventoryGroup boatIsland marketSaleFamily marketSaleQuery marketCategory marketSellGroup bagTab archiveGroup treeSlot previewSeed specializationBuilding previewSpecialization irrigationMode villageSlot cookingDish cookingFish signatureBase signatureSlot signatureRepeatId expandedRepeatId cookingMode communityOrderId communityResident requestedFood kitchenGroup kitchenTart kitchenPreserves kitchenDish honeyKitchenDish signatureFamily seedPickerBed celebratedFestival`.split(' '))ctx[n]=undefined
 const api=vm(wire,ctx) as {tap:(action:string,value:string,control:unknown)=>Promise<void>;workshop:()=>void;leaveScene:()=>void;focusKey:(b:unknown)=>string}
 const open=(shape:F.WorkshopShape)=>{entry.value='treat|'+shape;return api.tap('festival-source',entry.value,source)}
 const pledge=(shape:F.WorkshopShape|'orchardTart')=>api.tap('festival-contribute','treat|'+shape,source)
 const options=()=>ctx.workshopGame as Options
 return {ctx,log,focus,writes,open,pledge,options,oldClose:api.leaveScene}
}
const assertOk=(r:F.ActionResult)=>A.ok(r.ok,r.message)
const valid=(f:F.FarmState)=>A.deepEqual(F.restoreCurrentFarm(JSON.parse(stable(f))),f)

test('earned Day 31 local pastry opens its funded scene and unpaid Close goes back to the same source without writes',async()=>{
 const f=earn().state,before=stable(f), x=scene(f)
 A.match(festival(f),/data-action="festival-source" data-value="treat\|round"/)
 A.match(festival(f),/data-action="festival-contribute" data-value="treat\|orchardTart"/)
 await x.open('round')
 A.deepEqual(x.log,['open:workshop'],'one local click goes directly to the workshop, no exit to island focus')
 A.equal(x.options().initialShape,'round'); A.equal(x.options().recipe,'pastry')
 A.equal(x.ctx.pastryShape,'folded','same manual choice remains')
 A.equal(x.options().readyOrder?.(),undefined)
 A.equal(stable(f),before);A.deepEqual(x.writes,[])
 x.options().onCancel()
 A.equal(x.ctx.panel,'festival');A.equal(x.ctx.dialogContent.scrollTop,73)
 A.deepEqual(x.focus,['button:treat|round'])
 A.equal(x.ctx.workshopRecipe,'bread');A.equal(x.ctx.pastryShape,'folded')
 A.equal(stable(f),before);A.deepEqual(x.writes,[])
 const outside=scene(f,'guide')
 outside.ctx.panel='workshop';outside.ctx.workshopRecipe='pastry'
 // Separate existing direct ordinary Workshop uses the remembered folded choice.
 outside.ctx.showPanel('workshop')
 A.equal(outside.options().initialShape,'folded');A.equal(outside.options().readyOrder?.(),undefined)
})

test('two real local batches may deliberately change form; explicit result return neither spends nor contributes, and the Day 32 payout is unchanged',async()=>{
 const f=earn().state,x=scene(f),helper=structuredClone(f)
 A.equal(F.getResidentService(helper,'bea','round').available,true)
 A.equal(helper.culinary.tastings.bea.bonus,true)
 await x.pledge('orchardTart')
 for(const [from,baked] of [['round','folded'],['long','long']] as const){
  const safety=stable(f)
  await x.open(from);A.equal(stable(f),safety);A.equal(x.options().initialShape,from)
  const bake=x.options().onBake;A.ok(bake(baked));const done=stable(f);A.ok(bake(baked));A.equal(stable(f),done)
  A.equal(f.handmade[baked],1);A.equal(f.coins,222)
  A.equal(f.festivals.active?.delivered.treat,baked==='folded'?1:2)
  const review=x.options().readyOrder?.()
  A.equal(review?.label,'К празднику');review!.open();A.equal(x.ctx.panel,'festival')
  A.equal(stable(f),done);A.deepEqual(x.focus.slice(-2),['neutral:festival-requirement','reveal'])
  review!.open();A.equal(stable(f),done)
  A.match(festival(f),new RegExp('data-action="festival-contribute" data-value="treat\\|'+baked+'"'))
  await x.pledge(baked)
  A.equal(f.handmade[baked],0);valid(f)
 }
 A.deepEqual(x.log,['open:workshop','open:festival','open:workshop','open:festival'])
 A.deepEqual([f.day,f.coins,f.produce.wheat,f.eggs,f.dishes.orchardTart,x.writes.length],[31,222,1,1,0,5])
 A.equal(F.finishFestival(f).ok,false);assertOk(F.sail(f,'home'));assertOk(F.endDay(f));assertOk(F.sail(f,'village'))
 A.equal(F.getFestivalStatus(f).active?.reward,123)
 assertOk(F.finishFestival(f));A.equal(f.coins,345)
 A.equal(F.finishFestival(f).ok,false);A.equal(f.coins,345)
 A.equal(f.culinary.tastings.bea.bonus,true,'manual player keeps the one-use baking favor')
 // Same-day optional ordinary Bea service remains a different choice, not a replacement for baking oneself.
 assertOk(F.runResidentService(helper,'bea','round'))
 A.deepEqual([helper.produce.wheat,helper.eggs,helper.handmade.round,helper.culinary.tastings.bea.bonus],[1,1,4,false])
 for(const shape of ['orchardTart','round','round'])assertOk(F.contributeFestival(helper,'treat',shape))
 assertOk(F.sail(helper,'home'));assertOk(F.endDay(helper));assertOk(F.sail(helper,'village'))
 assertOk(F.finishFestival(helper));A.deepEqual([helper.day,helper.coins,helper.handmade.round],[32,345,2]);valid(helper)
})

test('missing local inputs, exact bun in the local warehouse, guest-side stale controls, and stale output remain independently lawful',async()=>{
 const start=earn().state
 const unmounted=scene(structuredClone(start));unmounted.ctx.attached=false
 await unmounted.open('round');A.deepEqual(unmounted.log,[]);A.deepEqual(unmounted.writes,[])
 const carried=structuredClone(start);assertOk(F.bakeWorkshop(carried,'round'))
 const carryView=scene(carried);await carryView.open('round');A.deepEqual(carryView.log,[])
 A.match(festival(carried),/data-action="festival-contribute" data-value="treat\|round"/)
 assertOk(H.transferBayGoods(carried,'deposit','village','handmade:round',1));valid(carried)
 const stored=scene(carried);const s=stable(carried);await stored.open('round')
 A.deepEqual(stored.log,['open:warehouse-supply']);A.equal(stable(carried),s);A.deepEqual(stored.writes,[])
 A.equal(W.getLocalWarehouseSupply(carried,local)?.quantity,1)
 const short=structuredClone(start);assertOk(F.bakeWorkshop(short,'long'));assertOk(F.bakeWorkshop(short,'long'))
 A.equal(F.getWorkshopAction(short).available,false)
 const route=scene(short);await route.open('round')
 A.ok(!route.log.includes('open:workshop'));A.equal(short.island,'home');A.equal(short.produce.wheat,1)
 const away=structuredClone(start);assertOk(F.sail(away,'home'))
 // A genuine Home invite is never reached via the stale detached Village button.
 if(!V.canInviteNeighbor(away,'bea')){
  // Existing replay has a resident, but no separately completed neighbor plan.
  assertOk(F.sail(away,'cape'));assertOk(F.collectCapeHoney(away));assertOk(F.sail(away,'village'))
  assertOk(F.cookDish(away,'honeyCake'))
  const offer=F.getNeighborPlans(away).find(p=>p.resident==='bea' && p.phase==='preparing')
  A.ok(offer);assertOk(F.joinNeighborPlan(away,offer.id))
  assertOk(F.serveNeighborPlan(away,offer.id,'dish:honeyCake'))
  assertOk(F.finishNeighborPlan(away,offer.id,{kind:offer.arrangement,settled:true,
    placements:[{slot:'food',x:0,y:0},{slot:'cup',x:.4,y:0},{slot:'flowers',x:0,y:.4}]}))
  assertOk(F.sail(away,'home'))
 }
 assertOk(V.inviteNeighborVisit(away,'beaHands'))
 valid(away);const noSail=stable(away), remote=scene(away)
 remote.ctx.attached=false;await remote.open('round');A.deepEqual(remote.log,[]);A.equal(stable(away),noSail)
 const stale=structuredClone(start), preview=scene(stale)
 await preview.open('round');A.ok(preview.options().onBake('round'));const claimed=preview.options().readyOrder?.()
 A.ok(claimed);assertOk(H.transferBayGoods(stale,'deposit','village','handmade:round',1))
 A.equal(preview.options().readyOrder?.(),undefined)
 const changed=stable(stale);claimed.open();A.equal(preview.ctx.panel,'workshop');A.equal(stable(stale),changed)
 preview.options().onCancel();A.equal(preview.ctx.panel,'festival');A.equal(stable(stale),changed)
})
