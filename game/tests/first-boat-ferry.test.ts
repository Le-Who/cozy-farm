import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,readFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {createServer} from 'vite'
import type {renderFreightPanel} from '../src/bay-freight-ui.ts'
import {stripTypeScriptTypes} from 'node:module'
import {runInNewContext} from 'node:vm'
import {isGuardedAction,ActivationKeyGuard} from '../src/action-click-guard.ts'
import * as F from '../src/farm.ts'
import * as J from '../src/journey.ts'
import * as H from '../src/harbour-economy.ts'
import * as Q from '../src/ferry-expeditions.ts'
import * as S from '../src/ferry-smaller-cargo.ts'
import {earlyFerryFarm,tendEarlyFerryFarm} from './fixtures/early-ferry.ts'

function player(initial=F.createFarm()){
 let farm=F.restoreCurrentFarm(structuredClone(initial))!,actions=0
 const actionsByName={...F,...H} as Record<string,Function>
 return {get farm(){return farm},get actions(){return actions},
  act(name:string,...args:unknown[]){const result=actionsByName[name](farm,...args);assert.ok(result.ok,name+': '+result.message)
   actions++;farm=F.restoreCurrentFarm(JSON.parse(JSON.stringify(farm)))!;assert.ok(farm,name);return result},
 }
}
function orderPaid(){
 const p=player();p.act('workBed',2,0);p.act('workBed',3,0);p.act('workBed',4,0)
 assert.equal(F.getMarketOrders(p.farm).find(o=>o.lane==='garden')?.status,'ready')
 p.act('deliverMarketOrder','garden');return p
}
function saleBoat(keepWheat=true){
 const p=player();p.act('workBed',2,0);p.act('sellMarketItem','produce:cabbage',2);p.act('buyBoat');if(keepWheat)p.act('workBed',4,0);return p
}
const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
const between=(a:string,b:string)=>{const i=main.indexOf(a),j=main.indexOf(b,i+1);assert.ok(i>=0&&j>i,[a,b]);return main.slice(i,j)}
const goto=main.includes("case 'first-ferry-route':") ? between("    case 'first-ferry-route':","    case 'boat-island':") : ''
const boatBranch=between("    case 'boat': {","    case 'dock-project':").replaceAll('import.meta.env.BASE_URL', "'/'")
const button=between('function button(', 'function panelTabs(')
const renderCode=stripTypeScriptTypes(button+'\nswitch(panel){'+boatBranch+'}')
const alt='first-ferry-route'
function render(farm:F.FarmState,destination:F.IslandId,selection=Q.initialExpeditionPreview(farm.freight.expeditions)){
 const ctx={...F,...J,...H,...Q,...S,farm,boatIsland:destination,panel:'boat',dialogContent:{innerHTML:''},journeyDetailsOpen:false,selectedExpeditionPort:selection.port,selectedExpeditionOffer:selection.offer,
   getCapeJourneyStatus:()=>undefined,pastryShape:'round',escapeHtml:(s:string)=>s,icon:()=>'',requirementLink:()=>'',numberFormat:new Intl.NumberFormat('ru-RU')}
 runInNewContext(renderCode,ctx)
 const html=ctx.dialogContent.innerHTML,nav=html.match(/<nav class="island-places"[^>]*>([\s\S]*?)<\/nav>/)![1]
 const buttons=[...nav.matchAll(/<button\b[^>]*data-action="([^"]+)"[^>]*>/g)].map(([tag,action])=>({action,secondary:tag.includes('dialog-button secondary'),
  disabled:/\sdisabled(?:[\s>]|=)/.test(tag),value:tag.match(/data-value="([^"]+)"/)?.[1]}))
 return {html,nav,buttons}
}
const picked=(farm:F.FarmState)=>render(farm,'grove').buttons.find(x=>x.action===alt)
const clue=(farm:F.FarmState)=>S.firstFerryCargoOffer(farm.freight.expeditions,farm.day,H.expeditionWallet(farm),'mill','mill-grain')

test('the actual bought Grove card keeps Sail primary and gives the zero-coin Day1 sale route a separate ready ferry choice',()=>{
 const p=saleBoat(),f=p.farm,before=structuredClone(f)
 assert.deepEqual([p.actions,f.day,f.coins,f.produce.wheat],[4,1,0,3])
 const defaultOffer=Q.initialExpeditionPreview(f.freight.expeditions).offer
 assert.equal(defaultOffer,'mill-grain')
 const smaller=S.smallerFerryCargo(f.freight.expeditions,defaultOffer,H.expeditionWallet(f))!
 assert.deepEqual([smaller.id,smaller.earnCoins,smaller.payCoins],[ 'mill-sale',10,0 ])
 assert.match(between("    case 'project-boat':","    case 'project-dock':"),/openPanel\('boat',true,'grove'\)/)
 assert.deepEqual(render(f,'grove').buttons,[{action:'sail',secondary:false,disabled:false,value:'grove'},
  {action:alt,secondary:true,disabled:false,value:'1:mill-sale'}])
 assert.match(render(f,'grove').nav,/Грузовой паром/)
 assert.equal(render(f,'home').buttons.filter(x=>x.action==='open-panel'&&x.value==='bay-freight').length,1)
 assert.doesNotMatch(render(f,'home').nav,/first-ferry-route/)
 assert.deepEqual(f,before)
})

test('same first Garden payout earns independent Grove, overnight freight and Kitchen consequences without free items',()=>{
 const p=orderPaid(),funds=structuredClone(p.farm)
 assert.deepEqual([p.actions,p.farm.day,p.farm.coins,p.farm.produce.wheat],[4,1,59,3])
 assert.equal(render(p.farm,'grove').buttons[0].action,'buy-boat')
 assert.ok(!picked(p.farm))
 p.act('buyBoat')
 assert.equal(p.farm.coins,23)
 assert.ok(picked(p.farm))
 const grove=player(p.farm);grove.act('sail','grove');grove.act('pickFruit',0);grove.act('gatherSeaSalt')
 assert.deepEqual([grove.farm.day,grove.farm.fruit.pear,grove.farm.seaSalt,grove.farm.freight.expeditions.active],[1,2,2,null])
 assert.ok(!picked(grove.farm))
 const freight=player(p.farm);freight.act('sendFerryExpedition','mill-sale')
 assert.deepEqual([freight.farm.day,freight.farm.coins,freight.farm.produce.wheat],[1,23,1])
 freight.act('endDay');freight.act('receiveFerryExpedition')
 assert.deepEqual([freight.farm.day,freight.farm.coins,freight.farm.produce.wheat,freight.farm.freight.expeditions.markets.mill.visits],[2,33,1,1])
 const kitchen=player(funds);kitchen.act('upgradeBuilding','farmhouse');kitchen.act('pickFruit',0);kitchen.act('cookDish','appleJam')
 assert.deepEqual([kitchen.farm.day,kitchen.farm.coins,kitchen.farm.dishes.appleJam,kitchen.farm.boatOwned],[1,35,1,false])
 console.log(JSON.stringify({day:1,regularSale:{actions:4,coins:0,wheat:3},orderBeforeInvestment:59,
   groveSameDay:{pear:2,salt:2},ferryTomorrow:{coinsGained:10,wheatLeft:1},kitchen:{jam:1,noBoat:true},realBrowser:false}))
})

test('only actually ready first cargo adds one secondary control, never a shortage, stale day, away island, active or completed run',()=>{
 const short=saleBoat(false).farm;assert.ok(!picked(short));assert.equal(clue(short),undefined)
 const ordinary=saleBoat().farm,old=structuredClone(ordinary)
 assert.equal(clue(ordinary),'mill-sale');assert.ok(picked(ordinary))
 for(const land of ['cape','village'] as const)assert.equal(render(ordinary,land).buttons.some(x=>x.action===alt),false)
 const elsewhere=player(ordinary);elsewhere.act('sail','grove')
 assert.equal(render(elsewhere.farm,'home').buttons.some(x=>x.action===alt),false)
 assert.ok(!render(ordinary,'grove',{port:'salt',offer:'salt-carrots'}).buttons.some(x=>x.action===alt),'do not override an explicit different port')
 assert.ok(!render(ordinary,'grove',{port:'mill',offer:'mill-buy'}).buttons.some(x=>x.action===alt),'do not promote a manual paid draft')
 assert.deepEqual(ordinary,old)
 const sent=player(ordinary);sent.act('sendFerryExpedition','mill-sale')
 assert.ok(!picked(sent.farm));assert.equal(clue(sent.farm),undefined)
 sent.act('endDay');assert.ok(!picked(sent.farm));sent.act('receiveFerryExpedition')
 assert.ok(!picked(sent.farm));assert.equal(clue(sent.farm),undefined)
 const budget=orderPaid();budget.act('buyBoat');budget.act('sellMarketItem','produce:wheat',3)
 assert.ok(Q.quoteExpedition(budget.farm.freight.expeditions,'mill-buy',H.expeditionWallet(budget.farm))?.available,'paid alternative is available')
 assert.ok(!picked(budget.farm),'never advertises a purchase instead of a first ready export')
 const draft=player(ordinary);draft.act('endDay')
 assert.equal(picked(draft.farm)?.value,'2:mill-sale','open current view may still show the legitimately ready trade')
})

const returnCode=stripTypeScriptTypes(`${between('function focusKey(', 'function goBack(')}
${between('function goBack(', 'let harbourScene:')}
function handle(action,value,control) {switch(action){${goto}${between("    case 'expedition-offer':","    case 'expedition-pair':")}${between("    case 'expedition-send':","    case 'expedition-order-recipe':")}}}
${between('function openPanel(', 'function openRecipeBook(')}`)
function visit(farm:F.FarmState, renderFreight: typeof renderFreightPanel, selection = Q.initialExpeditionPreview(farm.freight.expeditions),boatIsland:F.IslandId='grove'){
 const fields='marketTab selectedMarketOrder marketSaleFamily marketSaleQuery marketCategory marketSellGroup bagTab archiveGroup treeSlot previewSeed specializationBuilding previewSpecialization cookingDish cookingFish seedPickerBed expandedRepeatId signatureBase signatureSlot signatureRepeatId cookingMode communityOrderId communityResident requestedFood kitchenTart kitchenPreserves kitchenGroup kitchenDish honeyKitchenDish signatureFamily'.split(' ')
 const others=Object.fromEntries(fields.map(x=>[x,undefined]))
 class Button {
  dataset={action:alt,value:''}
  focusCalls:unknown[]=[]
  focus(o:unknown){this.focusCalls.push(o)}
  inJourney=true
  closest(q:string){return this.inJourney&&q==='.journey-card[data-island="grove"]'?{}:null}
  getClientRects(){return [1]}
 }
 const live=new Button(),record=[] as string[], focus=[] as string[]
 const details={open:true}
 const dialog={open:false,showModal(){this.open=true},querySelectorAll:()=>[live]}
 const document={activeElement:null as Button|null}
 const neutral=(id:string)=>({focus:()=>{document.activeElement=null;focus.push(id)}})
 const ctx:any={...F,...H,...Q,...S,...others,farm,boatIsland,panel:undefined,dialog,dialogContent:{
   scrollTop:0,innerHTML:'',contains:(x:unknown)=>x===live,querySelector:(q:string)=>q==='.journey-details'?details:q==='.bay-freight [data-action="close"]'?neutral('freight-close'):null,querySelectorAll:()=>[]}, HTMLButtonElement:Button,document,
   signatureSlots:[],panelHistory:[],panelRenderVersion:1,requestedFood:undefined,selectedWarehouseRequest:undefined,
   selectedExpeditionPort:selection.port,selectedExpeditionOffer:selection.offer,selectedWarehouse:'home',freightPlanOpen:false,journeyDetailsOpen:false,pickedMarketOrder:undefined,
   irrigationMode:'row',villageSlot:0,pastryShape:'round',inventoryGroup:'harvest',workshopRecipe:'bread',
   recipeBook:{snapshot:()=>({mode:'index'}),load:()=>{}},restoreFerryPanelView:()=>{},requestAnimationFrame:(fn:()=>void)=>fn(),
   island:{isCrossing:()=>false,setViewMode:()=>{},setCoveFocus:()=>{}},salePresentation:{place:undefined},marketSaleBrowse:{reset:()=>{}},
   hiveFlower:undefined, celebratedFestival:undefined,journalDetailsOpen:false,
   ...Object.fromEntries(['transplantSelection','berryNurserySelection','berryRenewalSelection','gardenEditor','recipeSurplusSelection'].map(key=>[key,{reset:()=>{}}])),
   ...Object.fromEntries(['stopHarbour','stopFishing','stopWorkshop','stopCookery','stopArrangement','saveFarm','status','playBaySound','updateCommunityReturn','presentFerryDeparture'].map(key=>[key,()=>{}])),
   ferryArrival:{take:()=>false},app:{dataset:{}},toast:{},dialogFeedback:{},closeButton:neutral('page-close'),bayAudio:{playEvent:()=>{}},
   perform:(action:()=>{ok:boolean})=>{const result=action();if(result.ok)ctx.drawPanel();return result.ok},
   drawPanel:()=>{record.push(ctx.panel);ctx.panelRenderVersion++
     if(ctx.panel==='boat'){
      const card=render(farm,ctx.boatIsland,{port:ctx.selectedExpeditionPort,offer:ctx.selectedExpeditionOffer})
      live.dataset.value=card.buttons.find(x=>x.action===alt)?.value??''
      details.open=ctx.journeyDetailsOpen;ctx.dialogContent.innerHTML=card.html
     } else if(ctx.panel==='bay-freight'){
      ctx.dialogContent.innerHTML=renderFreight(farm.freight,{day:farm.day,coins:farm.coins,boatOwned:farm.boatOwned,
        playerPort:farm.island,expeditionPort:ctx.selectedExpeditionPort,expeditionOffer:ctx.selectedExpeditionOffer,openedPorts:['home','grove'],
        products:[],carried:H.expeditionWallet(farm).bag,icon:()=>''})
     }},
 }
 runInNewContext(returnCode,ctx)
 ctx.openPanel('boat',true,boatIsland)
 ctx.dialogContent.scrollTop=13;ctx.document.activeElement=live;details.open=true
 record.length=0;focus.length=0
 return {ctx,live,record,focus,details}
}
let server: Awaited<ReturnType<typeof createServer>>, freight: typeof renderFreightPanel
test.before(async()=>{
 server=await createServer({root:fileURLToPath(new URL('..',import.meta.url)),cacheDir:mkdtempSync(join(tmpdir(),'cozy-ferry-exact-')),
   configFile:false,server:{middlewareMode:true,hmr:false,watch:null},appType:'custom'})
 freight=(await server.ssrLoadModule('/src/bay-freight-ui.ts')).renderFreightPanel
})
test.after(async()=>{await server?.close()})
const departure=(html:string)=>html.match(/<footer class="expedition-departure">([\s\S]*?)<\/footer>/)?.[1]??''
test('the earned zero-coin shortcut previews the exact ready freight offer, and Back restores original draft, port card, details and focus',()=>{
 const f=saleBoat().farm
 const {ctx,live,record,focus,details}=visit(f,freight),before=structuredClone(f),today=live.dataset.value
 ctx.selectedWarehouse='grove'
 assert.deepEqual([f.day,f.coins,f.produce.wheat],[1,0,3]);assert.equal(typeof today,'string');assert.ok(today)
 for(const wrong of [undefined,'0','2','bogus','1:mill-buy','1:mill-grain'])ctx.handle(alt,wrong,live)
 ctx.handle(alt,today,new Object())
 live.inJourney=false;ctx.handle(alt,today,live);live.inJourney=true
 ctx.selectedExpeditionOffer='mill-buy';ctx.handle(alt,today,live);ctx.selectedExpeditionOffer='mill-grain'
 ctx.dialog.open=false;ctx.handle(alt,today,live);ctx.dialog.open=true
 ctx.boatIsland='cape';ctx.handle(alt,today,live);ctx.boatIsland='grove'
 ctx.panel='guide';ctx.handle(alt,today,live);ctx.panel='boat'
 ctx.island.isCrossing=()=>true;ctx.handle(alt,today,live);ctx.island.isCrossing=()=>false
 assert.deepEqual(record,[]);assert.deepEqual(f,before)
 assert.equal(ctx.selectedExpeditionOffer,'mill-grain')
 ctx.handle(alt,today,live)
 assert.equal(ctx.panel,'bay-freight');assert.deepEqual(record,['bay-freight']);assert.deepEqual(f,before)
 const html=ctx.dialogContent.innerHTML
 console.log(JSON.stringify({phase:'freight-preview',day:f.day,coins:f.coins,wheat:f.produce.wheat,offer:ctx.selectedExpeditionOffer,
  departure:departure(html).match(/data-action="expedition-send" data-value="([^"]+)"([^>]*)/)?.slice(1).map(x=>x.trim()),
  automaticDeparture:f.freight.expeditions.active!==null,boarded:f.island!=='home'}))
 assert.deepEqual([ctx.selectedExpeditionPort,ctx.selectedExpeditionOffer,ctx.selectedWarehouse],['mill','mill-sale','home'])
 assert.match(html,/<h3>Продать немного зерна<\/h3>/)
 assert.match(html,/Пшеница ×2/);assert.match(html,/10 монет/)
 assert.match(departure(html),/data-action="expedition-send" data-value="mill-sale"/)
 assert.doesNotMatch(departure(html),/disabled/)
 assert.match(html,/data-action="expedition-offer" data-value="mill-grain"/)
 assert.deepEqual(focus,['freight-close'],'the next key must not land on Send')
 assert.equal(ctx.panelHistory.length,1);assert.equal(ctx.panelHistory[0].boatIsland,'grove')
 assert.equal(ctx.panelHistory[0].expeditionOffer,'mill-grain')
 ctx.handle('expedition-offer','mill-grain',live)
 assert.equal(ctx.selectedExpeditionOffer,'mill-grain')
 assert.match(departure(ctx.dialogContent.innerHTML),/data-value="mill-grain"[^>]*disabled/)
 assert.deepEqual(f,before)
 ctx.handle('expedition-offer','mill-sale',live)
 assert.equal(ctx.selectedExpeditionOffer,'mill-sale')
 assert.deepEqual(f,before)
 ctx.goBack(true)
 assert.equal(ctx.panel,'boat');assert.equal(ctx.boatIsland,'grove');assert.equal(ctx.dialogContent.scrollTop,13)
 assert.deepEqual([ctx.selectedExpeditionPort,ctx.selectedExpeditionOffer,ctx.selectedWarehouse],['mill','mill-grain','grove'])
 assert.equal(details.open,true);assert.equal(live.dataset.value,today)
 assert.deepEqual(JSON.parse(JSON.stringify(live.focusCalls)),[{preventScroll:true}]);assert.deepEqual(f,before)
 ctx.handle(alt,today,live)
 ctx.handle('expedition-send','mill-sale',live)
 assert.deepEqual([f.day,f.coins,f.produce.wheat,f.freight.expeditions.active?.id],[1,0,1,'mill-sale'])
 ctx.handle('expedition-send','mill-sale',live)
 assert.deepEqual([f.coins,f.produce.wheat,f.freight.expeditions.serial],[0,1,1],'not a second departure')
 assert.ok(F.endDay(f).ok);assert.ok(H.receiveFerryExpedition(f).ok)
 assert.deepEqual([f.day,f.coins,f.produce.wheat],[2,10,1])
})
test('already chosen ready draft stays ready; stale day, inventory, active trip or location never open another quote',()=>{
 const farming=earlyFerryFarm()
 for(let i=0;i<3 && farming.produce.wheat<4;i++){assert.ok(F.endDay(farming).ok);tendEarlyFerryFarm(farming)}
 // An already chosen ready larger trade retains precedence, not just the suggested sale.
 const readyQuote=Q.quoteExpedition(farming.freight.expeditions,'mill-grain',H.expeditionWallet(farming))
 assert.equal(readyQuote?.available,true)
 const {ctx:ready,live:sendReady}=visit(farming,freight,{port:'mill',offer:'mill-grain'})
 const current=sendReady.dataset.value
 assert.equal(current,farming.day+':mill-grain')
 ready.handle(alt,farming.day+':mill-sale',sendReady)
 assert.equal(ready.panel,'boat','a same-day token for a different offer may not substitute')
 ready.handle(alt,current,sendReady)
 assert.equal(ready.selectedExpeditionOffer,'mill-grain')
 assert.match(departure(ready.dialogContent.innerHTML),/data-value="mill-grain"/)
 assert.doesNotMatch(departure(ready.dialogContent.innerHTML),/disabled/)
 assert.equal(farming.freight.expeditions.active,null)
 ready.goBack();assert.equal(ready.selectedExpeditionOffer,'mill-grain')
 const f=saleBoat().farm
 const {live:day1}=visit(f,freight)
 const tomorrow=player(f);tomorrow.act('endDay');const future=visit(tomorrow.farm,freight)
 future.ctx.handle(alt,day1.dataset.value,future.live);assert.deepEqual(future.record,[])
 const noCargo=player(f);noCargo.act('sellMarketItem','produce:wheat',2);const staleStock=visit(noCargo.farm,freight)
 staleStock.ctx.handle(alt,day1.dataset.value,staleStock.live);assert.deepEqual(staleStock.record,[])
 const already=player(f);already.act('sendFerryExpedition','mill-sale');const shipped=visit(already.farm,freight)
 shipped.ctx.handle(alt,day1.dataset.value,shipped.live);assert.deepEqual(shipped.record,[])
 const overseas=player(f);overseas.act('sail','grove');const elsewhere=visit(overseas.farm,freight)
 elsewhere.ctx.handle(alt,day1.dataset.value,elsewhere.live);assert.deepEqual(elsewhere.record,[])
})

test('existing source layout preserves one compact/wide reachable alternate after Sail with no key-repeat fallthrough',()=>{
 const f=saleBoat().farm,markup=render(f,'grove')
 const selectors=[...markup.html.matchAll(/<button\b[^>]*data-action="boat-island" data-value="([^"]+)"[^>]*>/g)].map(([,id])=>id)
 assert.deepEqual(selectors,['home','grove','cape','village'])
 assert.deepEqual(markup.buttons.map(x=>x.action),['sail',alt]);assert.match(markup.nav,/aria-label="Отправиться, Солёная роща"/)
 const style=readFileSync(new URL('../src/navigation.css',import.meta.url),'utf8')
 assert.match(style,/\.island-places \{[^}]*display: flex;[^}]*flex-wrap: wrap;/)
 assert.match(style,/\.island-places \.dialog-button \{[^}]*white-space:normal;[^}]*min-height:44px;/)
 assert.ok(isGuardedAction(alt))
 for(const key of ['Enter',' ']){const guard=new ActivationKeyGuard()
  assert.equal(guard.blocks({key,repeat:false},true),false)
  assert.equal(guard.blocks({key,repeat:true},true),true);guard.release(key)
  assert.equal(guard.blocks({key,repeat:false},true),false)}
})
