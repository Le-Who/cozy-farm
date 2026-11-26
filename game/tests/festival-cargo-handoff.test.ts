import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {stripTypeScriptTypes as strip} from 'node:module'
import {runInNewContext as vm} from 'node:vm'
import {test} from 'node:test'
import * as F from '../src/farm.ts'
import * as H from '../src/harbour-economy.ts'
import * as Q from '../src/ferry-expeditions.ts'
import * as P from '../src/harbor-return.ts'
import * as U from '../src/ru.ts'
import * as T from '../src/festival-fruit.ts'
import * as G from '../src/festival-harvest-route.ts'
import * as S from '../src/festival-shore-route.ts'
import * as I from '../src/festival-fishing-route.ts'
import * as W from '../src/bay-freight-model.ts'
import * as D from '../src/ferry-discovery.ts'
import * as E from '../src/ferry-restock.ts'
import * as L from '../src/ferry-smaller-cargo.ts'
import * as M from '../src/ferry-project-progress.ts'
import {getFestivalCargoRoute} from '../src/festival-cargo-route.ts'
import {ActivationKeyGuard,ActionClickGuard,isGuardedAction} from '../src/action-click-guard.ts'
import {commissionPlayer} from './fixtures/commission-player.ts'

const stockDonor=process.env.COZY_LIGHTS_STOCK_DONOR
const read=(file:string)=>readFileSync(stockDonor ? resolve(stockDonor,file) : new URL('../'+file,import.meta.url),'utf8')
const main=read('src/main.ts'), festivalSource=read('src/bay-festival-ui.ts'), ferrySource=read('src/bay-freight-ui.ts')
const between=(a:string,b:string)=>{const i=main.indexOf(a),j=main.indexOf(b,i+1);assert.ok(i>=0&&j>i,a);return main.slice(i,j)}
const context={...F,...H,...Q,...P,...U,...T,...G,...S,...I,...W,...D,...E,...L,...M,getFestivalCargoRoute}
const renderFestival=strip(festivalSource.slice(festivalSource.indexOf('const escape ='))
  .replace('export function renderFestivalPanel','function renderFestivalPanel').replaceAll('import.meta.env.BASE_URL','"/"')+';renderFestivalPanel(farm)')
const renderFreight=strip(ferrySource.slice(ferrySource.indexOf('const labels:'))
  .replaceAll('export function ','function ').replaceAll('import.meta.env.BASE_URL','"/"')+'; renderFreightPanel(farm.freight,ctx)')
const recipeBase=JSON.parse(read('tests/fixtures/home-progress-actions.json')) as {name:string;args:unknown[]}[]
function earned(offer?:string,wheat=false,arrive=true) {
 const p=commissionPlayer(recipeBase.slice(0,recipeBase.findIndex(x=>x.name==='serveVillageMeal')+1))
 p.act('beginFestival','lights');p.visit('home')
 for(let i=0;i<3;i++){
  if(!F.getFishAction(p.state).available)p.night()
  const trip=p.act('beginFishingTrip');p.act('finishFishingTrip',trip.token,1)
 }
 p.visit('village');p.act('contributeFestival','participation','fish')
 for(let i=0;i<3;i++){
  const option=F.getFestivalStatus(p.state).active!.requirements.find(r=>r.id==='fish')!.alternatives.find(x=>x.available)!
  p.act('contributeFestival','fish',option.id)
 }
 p.night();p.visit('grove')
 for(let i=0;i<3;i++)if(F.getShellAt(p.state,i))p.act('collectShell',i)
 p.act('gatherSeaSalt')
 p.visit('village');p.act('contributeFestival','shore','shells');p.act('contributeFestival','shore','shells')
 if(wheat) {
  p.visit('home')
  if(!p.state.seeds.wheat)p.act('buySeeds','wheat')
  if(p.state.selectedSeed!=='wheat')p.act('selectSeed','wheat')
  const index=p.state.beds.findIndex(b=>b.kind==='tilled')
  assert.ok(index>=0);p.act('workBed',index)
  for(let n=0;n<6&&F.getBedAction(p.state,index).kind!=='harvest';n++){
   if(F.getBedAction(p.state,index).kind==='water'){if(!p.state.water)p.act('refillWater');p.act('workBed',index)}
   p.night()
  }
  p.act('workBed',index);p.visit('village')
 }
 if(offer)p.act('sendFerryExpedition',offer)
 if(arrive){p.night();p.visit('village')}
 assert.equal(p.state.festivals.active!.stage,2)
 return p
}
const festival=(farm:F.FarmState):string=>vm(renderFestival,{...context,farm})
const parse=(html:string,action:string)=>html.match(new RegExp('data-action="'+action+'" data-value="([^"]*)"[^>]*>([^<]*)'))
const cargo=(farm:F.FarmState)=>parse(festival(farm),'festival-freight')
const effective=(farm:F.FarmState,port:string,offer:string):string=>vm(renderFreight,{...context,farm,ctx:{
 day:farm.day,coins:farm.coins,boatOwned:farm.boatOwned,playerPort:farm.island,expeditionPort:port,expeditionOffer:offer,
 openedPorts:H.openedFreightPorts(farm),products:[],carried:H.expeditionWallet(farm).bag,icon:()=>''}})

const controller=strip(
 between('function focusKey(','let harbourScene:')+
 between('function openPanel(','function openRecipeBook(')+between('function closeDialog()','function refresh()')+
 `function handle(action,value,control){switch(action){${between("    case 'festival-freight':","    case 'festival-source':")}${
   between("    case 'expedition-offer':","    case 'expedition-pair':")}${
   between("    case 'expedition-send':","    case 'expedition-order-recipe':")}}}`)
function mount(farm:F.FarmState,port:Q.ExpeditionPort='mill',offer='mill-grain') {
 const quiet=()=>undefined, notes:string[]=[]
 const ids='marketTab selectedMarketOrder marketSaleFamily marketSaleQuery marketCategory marketSellGroup bagTab archiveGroup treeSlot previewSeed specializationBuilding previewSpecialization cookingDish cookingFish seedPickerBed expandedRepeatId signatureBase signatureSlot signatureRepeatId cookingMode communityOrderId communityResident requestedFood boatIsland kitchenTart kitchenPreserves kitchenGroup kitchenDish honeyKitchenDish signatureFamily marketTreeSpaceVisit'.split(' ')
 const doc:{activeElement:Button|null}={activeElement:null}
 class Button {
  dataset:{action:string;value:string}
  constructor(dataset:{action:string;value:string}) {this.dataset=dataset}
  focus(){doc.activeElement=this}
  getClientRects(){return [1]}
 }
 const dialog={open:false,showModal(){this.open=true},close(){this.open=false},querySelectorAll:()=>ctx.controls}
 const ctx:any={...context,...Object.fromEntries(ids.map(x=>[x,undefined])),farm,panel:undefined,dialog,
  ctrl:undefined, controls:[], dialogContent:{scrollTop:0,innerHTML:'',contains:(x:unknown)=>ctx.controls.includes(x),querySelectorAll:()=>[],
   querySelector:(s:string)=>s==='.bay-freight [data-action="close"]'?{focus:()=>{doc.activeElement=null;notes.push('freight-close')}}:null},
  HTMLButtonElement:Button,document:doc, signatureSlots:[],panelHistory:[],panelRenderVersion:1,selectedWarehouseRequest:undefined,
  selectedExpeditionPort:port,selectedExpeditionOffer:offer,selectedWarehouse:'village',freightPlanOpen:false,journeyDetailsOpen:false,
  pickedMarketOrder:undefined,irrigationMode:'row',villageSlot:0,pastryShape:'round',inventoryGroup:'harvest',workshopRecipe:'bread',
  recipeBook:{snapshot:()=>({mode:'index'}),load:quiet},restoreFerryPanelView:quiet,requestAnimationFrame:(fn:()=>void)=>fn(),
  island:{isCrossing:()=>false,setViewMode:quiet,setCoveFocus:quiet},salePresentation:{place:undefined,reset:quiet},marketSaleBrowse:{reset:quiet},
  hiveFlower:undefined,celebratedFestival:undefined,journalDetailsOpen:false,
  ...Object.fromEntries(['transplantSelection','berryNurserySelection','berryRenewalSelection','gardenEditor','recipeSurplusSelection'].map(x=>[x,{reset:quiet}])),
  ...Object.fromEntries(['stopHarbour','stopFishing','stopWorkshop','stopCookery','stopArrangement','saveFarm','status','playBaySound','updateCommunityReturn','presentFerryDeparture','rememberClosedMarketSell'].map(x=>[x,quiet])),
  ferryArrival:{take:()=>false},ferryPeachPlanting:{reset:quiet},app:{dataset:{}},toast:{},dialogFeedback:{},closeButton:{focus:()=>{doc.activeElement=null}},bayAudio:{playEvent:quiet},
  perform:(action:()=>{ok:boolean})=>{const result=action();if(result.ok)ctx.drawPanel();return result.ok},
  drawPanel:()=>{
   ctx.panelRenderVersion++
   const h=ctx.panel==='festival'?festival(farm):effective(farm,ctx.selectedExpeditionPort,ctx.selectedExpeditionOffer)
   ctx.dialogContent.innerHTML=h
   ctx.controls=[...h.matchAll(/data-action="([^"]+)" data-value="([^"]*)"/g)].map(([,action,value])=>new Button({action,value}))
  },
 }
 vm(controller,ctx);ctx.openPanel('festival');ctx.dialogContent.scrollTop=73
 const button=(action:string)=>ctx.controls.find((b:Button)=>b.dataset.action===action)
 function click(b:Button,manual?:string){assert.ok(b);b.focus();ctx.handle(b.dataset.action,manual??b.dataset.value,b)}
 const current=()=>[ctx.selectedExpeditionPort,ctx.selectedExpeditionOffer]
 return {ctx,button,click,current,notes,doc}
}

test('the only missing festival credit previews an exact affordable actual shipment with no charge or changed normal draft',()=>{
 const p=earned(),f=p.state, before=structuredClone(f)
 assert.deepEqual([f.day,p.actions,f.coins,f.seaSalt,f.produce.wheat],[13,117,72,2,0])
 assert.equal(cargo(f)?.[2],'Посмотреть рейс · 15 монет')
 assert.match(festival(f),/data-value="cargo\|salt"/)
 assert.match(festival(f),/data-value="cargo\|wheat"/)
 assert.ok(festival(f).indexOf('data-value="cargo|salt"')<festival(f).indexOf('Посмотреть рейс'),'free ready contribution stays ahead of paid preview')
 const ui=mount(f),preview=ui.button('festival-freight')
 ui.click(preview,'lights:stale');assert.equal(ui.ctx.panel,'festival')
 ui.click(preview);assert.equal(ui.ctx.panel,'bay-freight')
 assert.deepEqual(ui.current(),['mill','mill-buy'])
 assert.ok(ui.notes.includes('freight-close'),'not focused on the paid send')
 assert.match(ui.ctx.dialogContent.innerHTML,/<h3>Купить булочку<\/h3>/)
 assert.match(ui.ctx.dialogContent.innerHTML,/data-action="expedition-send" data-value="mill-buy"/)
 assert.deepEqual(f,before)
 ui.ctx.goBack(true);assert.equal(ui.ctx.panel,'festival');assert.equal(ui.ctx.dialogContent.scrollTop,73)
 assert.deepEqual(ui.current(),['mill','mill-grain']);assert.equal(ui.doc.activeElement,ui.button('festival-freight'))
 ui.click(ui.button('festival-freight'));ui.ctx.closeDialog()
 assert.deepEqual(ui.current(),['mill','mill-grain']);assert.deepEqual(f,before)
 ui.ctx.openPanel('bay-freight')
 assert.match(ui.ctx.dialogContent.innerHTML,/data-value="mill-grain"[^>]*disabled/)
 ui.ctx.closeDialog();ui.ctx.openPanel('festival')
 ui.click(ui.button('festival-freight'))
 ui.click(ui.button('expedition-send'))
 assert.deepEqual([f.coins,f.freight.expeditions.serial,f.freight.expeditions.active?.id],[57,1,'mill-buy'])
 ui.ctx.closeDialog();assert.deepEqual(ui.current(),['mill','mill-buy'])
 assert.equal(f.festivals.active!.cargoDelivered,0)

 const manual=mount(earned().state)
 manual.click(manual.button('festival-freight'))
 manual.click(manual.ctx.controls.find((b:{dataset:{action:string;value:string}})=>b.dataset.action==='expedition-offer'&&b.dataset.value==='mill-eggs'))
 manual.ctx.closeDialog();assert.deepEqual(manual.current(),['mill','mill-eggs'],'keep an explicit choice in the ordinary ferry')
 manual.ctx.openPanel('festival');manual.click(manual.button('festival-freight'));manual.ctx.goBack()
 assert.deepEqual(manual.current(),['mill','mill-eggs'],'preview Back does not replace the prior manually selected quote')
})

test('a genuine ready bun opens exact claim without taking a new trip, giving one credit only after claim',()=>{
 const p=earned('mill-buy'),f=p.state,before=structuredClone(f)
 assert.deepEqual([f.day,p.actions,f.coins,f.handmade.round,f.freight.expeditions.active?.phase],[13,118,57,0,'ready'])
 assert.equal(cargo(f)?.[2],'К готовому грузу')
 const ui=mount(f)
 assert.ok(ui.button('festival-freight'))
 ui.click(ui.button('festival-freight'))
 assert.match(ui.ctx.dialogContent.innerHTML,/data-action="expedition-claim"[^>]*>Получить груз/)
 assert.deepEqual(f,before);assert.equal(F.contributeFestival(f,'cargo','delivery').ok,false);assert.deepEqual(f,before)
 assert.ok(H.receiveFerryExpedition(f).ok);ui.ctx.goBack(true)
 assert.equal(ui.ctx.panel,'festival');assert.match(ui.ctx.dialogContent.innerHTML,/data-value="cargo\|delivery"/)
 assert.ok(F.contributeFestival(f,'cargo','delivery').ok)
 assert.equal(F.contributeFestival(f,'cargo','delivery').ok,false)
 assert.equal(H.receiveFerryExpedition(f).ok,false)
 for(let i=0;i<2;i++)assert.ok(F.contributeFestival(f,'cargo','salt').ok)
 assert.ok(F.sail(f,'home').ok);assert.ok(F.endDay(f).ok);assert.ok(F.sail(f,'village').ok)
 assert.ok(F.finishFestival(f).ok)
 assert.deepEqual([f.day,f.coins,f.handmade.round,f.bayShop.festivalVisitors],[14,110,1,1])
})

test('manual Grove salt, headed-out or stale freight and an unrelated paid sale stay ordinary and explicit',()=>{
 const p=earned(),f=p.state
 const oldKey=cargo(f)![1]
 const future=mount(f)
 assert.ok(F.sail(f,'home').ok);assert.ok(F.endDay(f).ok);assert.ok(F.sail(f,'village').ok)
 future.click(future.button('festival-freight'),oldKey);assert.equal(future.ctx.panel,'festival')
 const free=earned()
 assert.equal(cargo(free.state)?.[2],'Посмотреть рейс · 15 монет')
 free.visit('grove');free.act('gatherSeaSalt');free.visit('village')
 const manually=free.state
 assert.equal(cargo(manually)?.[2],'К парому','enough hand-carried supplies: no price advertised')
 for(let i=0;i<3;i++)free.act('contributeFestival','cargo','salt')
 free.night();free.visit('village');free.act('finishFestival')
 assert.deepEqual([free.state.day,free.state.coins,free.state.seaSalt,free.state.bayShop.festivalVisitors],[14,129,1,1])
 const short=earned()
 short.visit('home')
 while(short.state.coins>=15)short.act('buySeeds','carrot')
 short.visit('village');assert.equal(cargo(short.state)?.[2],'К парому','no unpayable preview')
 const sailing=earned(undefined,true,false)
 assert.ok(sailing.state.festivals.active!.readyOn<=sailing.state.day,'earlier earned nights have unlocked the last requirements')
 sailing.act('sendFerryExpedition','mill-buy');assert.equal(cargo(sailing.state)?.[2],'К рейсу с грузом')
 const sale=earned('mill-sale',true)
 assert.equal(cargo(sale.state)?.[2],'К парому')
 const ui=mount(sale.state)
 ui.click(ui.button('festival-freight'));assert.match(ui.ctx.dialogContent.innerHTML,/data-action="expedition-claim"[^>]*>Получить выручку/)
 sale.act('receiveFerryExpedition');assert.equal(sale.state.coins,82)
 assert.equal(sale.state.festivals.active!.cargoDelivered,0)
 assert.equal(F.contributeFestival(sale.state,'cargo','delivery').ok,false)
 const scout=earned('mill-buy',true)
 scout.act('receiveFerryExpedition');scout.act('contributeFestival','cargo','delivery')
 scout.act('sendFerryExpedition','explore-salt');scout.night();scout.visit('village')
 assert.equal(cargo(scout.state)?.[2],'К парому')
 const scouting=mount(scout.state)
 scouting.click(scouting.button('festival-freight'))
 assert.match(scouting.ctx.dialogContent.innerHTML,/data-action="expedition-claim"[^>]*>Открыть новый порт/)
 scout.act('receiveFerryExpedition')
 assert.equal(scout.state.freight.expeditions.discovered.includes('salt'),true)
 assert.equal(F.contributeFestival(scout.state,'cargo','delivery').ok,false)
 assert.equal(isGuardedAction('festival-freight'),true)
 const click=new ActionClickGuard();click.remember({detail:1,timeStamp:100,clientX:10,clientY:10})
 assert.ok(click.blocks({detail:1,timeStamp:230,clientX:10,clientY:10}))
 const keys=new ActivationKeyGuard();assert.equal(keys.blocks({key:'Enter',repeat:false},true),false)
 assert.ok(keys.blocks({key:'Enter',repeat:true},false))
})
