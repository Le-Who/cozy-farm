import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import {runInNewContext} from 'node:vm'
import {isGuardedAction,ActivationKeyGuard} from '../src/action-click-guard.ts'
import * as F from '../src/farm.ts'
import * as J from '../src/journey.ts'
import * as H from '../src/harbour-economy.ts'
import * as Q from '../src/ferry-expeditions.ts'
import * as S from '../src/ferry-smaller-cargo.ts'

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
const clue=(farm:F.FarmState)=>(S as Partial<typeof S & {hasFirstFerryCargo:(_world:F.FarmState['freight']['expeditions'],_day:number,_wallet:ReturnType<typeof H.expeditionWallet>,_port:Q.ExpeditionPort,_offer:string)=>boolean}>)
 .hasFirstFerryCargo?.(farm.freight.expeditions,farm.day,H.expeditionWallet(farm),'mill','mill-grain')

test('the actual bought Grove card keeps Sail primary and gives the zero-coin Day1 sale route a separate ready ferry choice',()=>{
 const p=saleBoat(),f=p.farm,before=structuredClone(f)
 assert.deepEqual([p.actions,f.day,f.coins,f.produce.wheat],[4,1,0,3])
 const defaultOffer=Q.initialExpeditionPreview(f.freight.expeditions).offer
 assert.equal(defaultOffer,'mill-grain')
 const smaller=S.smallerFerryCargo(f.freight.expeditions,defaultOffer,H.expeditionWallet(f))!
 assert.deepEqual([smaller.id,smaller.earnCoins,smaller.payCoins],[ 'mill-sale',10,0 ])
 assert.match(between("    case 'project-boat':","    case 'project-dock':"),/openPanel\('boat',true,'grove'\)/)
 assert.deepEqual(render(f,'grove').buttons,[{action:'sail',secondary:false,disabled:false,value:'grove'},
  {action:alt,secondary:true,disabled:false,value:'1'}])
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
 const short=saleBoat(false).farm;assert.ok(!picked(short));assert.equal(clue(short),false)
 const ordinary=saleBoat().farm,old=structuredClone(ordinary)
 assert.equal(clue(ordinary),true);assert.ok(picked(ordinary))
 for(const land of ['cape','village'] as const)assert.equal(render(ordinary,land).buttons.some(x=>x.action===alt),false)
 const elsewhere=player(ordinary);elsewhere.act('sail','grove')
 assert.equal(render(elsewhere.farm,'home').buttons.some(x=>x.action===alt),false)
 assert.ok(!render(ordinary,'grove',{port:'salt',offer:'salt-carrots'}).buttons.some(x=>x.action===alt),'do not override an explicit different port')
 assert.ok(!render(ordinary,'grove',{port:'mill',offer:'mill-buy'}).buttons.some(x=>x.action===alt),'do not promote a manual paid draft')
 assert.deepEqual(ordinary,old)
 const sent=player(ordinary);sent.act('sendFerryExpedition','mill-sale')
 assert.ok(!picked(sent.farm));assert.equal(clue(sent.farm),false)
 sent.act('endDay');assert.ok(!picked(sent.farm));sent.act('receiveFerryExpedition')
 assert.ok(!picked(sent.farm));assert.equal(clue(sent.farm),false)
 const budget=orderPaid();budget.act('buyBoat');budget.act('sellMarketItem','produce:wheat',3)
 assert.ok(Q.quoteExpedition(budget.farm.freight.expeditions,'mill-buy',H.expeditionWallet(budget.farm))?.available,'paid alternative is available')
 assert.ok(!picked(budget.farm),'never advertises a purchase instead of a first ready export')
 const draft=player(ordinary);draft.act('endDay')
 assert.equal(picked(draft.farm)?.value,'2','open current view may still show the legitimately ready trade')
})

const returnCode=stripTypeScriptTypes(`${between('function focusKey(', 'function goBack(')}
${between('function goBack(', 'let harbourScene:')}
function handle(action,value,control) {switch(action){${goto}}}
function openPanel(next, remember=true) {
${main.split('\n').find(line=>line.startsWith('  if(remember&&next!==panel){'))}
 panel=next;
 observations.push([next,remember]);
}`)
function visit(farm:F.FarmState,boatIsland:F.IslandId='grove'){
 const fields='marketTab selectedMarketOrder marketSaleFamily marketSaleQuery marketCategory marketSellGroup bagTab archiveGroup treeSlot previewSeed specializationBuilding previewSpecialization cookingDish cookingFish seedPickerBed expandedRepeatId signatureBase signatureSlot signatureRepeatId cookingMode communityOrderId communityResident requestedFood kitchenTart kitchenPreserves kitchenGroup kitchenDish honeyKitchenDish signatureFamily'.split(' ')
 const others=Object.fromEntries(fields.map(x=>[x,undefined]))
 class Button {
  dataset={action:alt,value:String(farm.day)}
  focusCalls:unknown[]=[]
  focus(o:unknown){this.focusCalls.push(o)}
  inJourney=true
  closest(q:string){return this.inJourney&&q==='.journey-card[data-island="grove"]'?{}:null}
  getClientRects(){return [1]}
 }
 const live=new Button()
 const ctx:any={...F,...H,...S,...others,farm,boatIsland,panel:'boat',dialog:{open:true,querySelectorAll:()=>[live]},dialogContent:{
   scrollTop:13,contains:(x:unknown)=>x===live,querySelector:()=>null,querySelectorAll:()=>[]}, HTMLButtonElement:Button,document:{activeElement:live},
   signatureSlots:[],panelHistory:[],observations:[],panelRenderVersion:1,requestedFood:undefined,selectedWarehouseRequest:undefined,
   selectedExpeditionPort:'mill',selectedExpeditionOffer:'mill-grain',selectedWarehouse:'home',freightPlanOpen:false,journeyDetailsOpen:false,
   irrigationMode:'row',villageSlot:0,pastryShape:'round',inventoryGroup:'harvest',workshopRecipe:'bread',
   recipeBook:{snapshot:()=>({mode:'index'}),load:()=>{}},restoreFerryPanelView:()=>{},requestAnimationFrame:(fn:()=>void)=>fn()}
 runInNewContext(returnCode,ctx)
 return {ctx,live}
}
test('existing freight opens without departure or an override; Back restores the exact Boat tab, scroll and return focus',()=>{
 const f=saleBoat().farm,before=structuredClone(f),today=picked(f)?.value
 assert.equal(today,'1')
 const {ctx,live}=visit(f)
 for(const wrong of ['0','2','bogus',undefined])ctx.handle(alt,wrong,live)
 ctx.handle(alt,today,new Object())
 live.inJourney=false;ctx.handle(alt,today,live);live.inJourney=true
 ctx.selectedExpeditionOffer='mill-buy';ctx.handle(alt,today,live);ctx.selectedExpeditionOffer='mill-grain'
 ctx.dialog.open=false;ctx.handle(alt,today,live);ctx.dialog.open=true
 ctx.boatIsland='cape';ctx.handle(alt,today,live);ctx.boatIsland='grove'
 ctx.panel='guide';ctx.handle(alt,today,live);ctx.panel='boat'
 assert.equal(ctx.observations.length,0);assert.deepEqual(f,before)
 ctx.handle(alt,today,live)
 assert.equal(ctx.panel,'bay-freight');assert.equal(ctx.observations.length,1);assert.deepEqual(f,before)
 assert.deepEqual([ctx.selectedExpeditionPort,ctx.selectedExpeditionOffer],['mill','mill-grain'])
 assert.equal(ctx.panelHistory.length,1);assert.equal(ctx.panelHistory[0].boatIsland,'grove')
 ctx.boatIsland='home';ctx.dialogContent.scrollTop=1;ctx.selectedExpeditionPort='salt';ctx.selectedExpeditionOffer='salt-carrots'
 ctx.goBack(true)
 assert.equal(ctx.panel,'boat');assert.equal(ctx.boatIsland,'grove');assert.equal(ctx.dialogContent.scrollTop,13)
 assert.deepEqual([ctx.selectedExpeditionPort,ctx.selectedExpeditionOffer],['mill','mill-grain'])
 assert.deepEqual(JSON.parse(JSON.stringify(live.focusCalls)),[{preventScroll:true}]);assert.deepEqual(f,before)
 const tomorrow=player(f);tomorrow.act('endDay');const future=visit(tomorrow.farm);future.ctx.handle(alt,today,future.live)
 assert.equal(future.ctx.observations.length,0)
 const noCargo=player(f);noCargo.act('sellMarketItem','produce:wheat',2);const staleStock=visit(noCargo.farm);staleStock.ctx.handle(alt,today,staleStock.live)
 assert.equal(staleStock.ctx.observations.length,0)
 const already=player(f);already.act('sendFerryExpedition','mill-sale');const shipped=visit(already.farm);shipped.ctx.handle(alt,today,shipped.live)
 assert.equal(shipped.ctx.observations.length,0)
 const overseas=player(f);overseas.act('sail','grove');const elsewhere=visit(overseas.farm);elsewhere.ctx.handle(alt,today,elsewhere.live)
 assert.equal(elsewhere.ctx.observations.length,0)
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
