import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { runInNewContext } from 'node:vm'
import test from 'node:test'
import { getFruitTreeSeed, plantFruitTreeSeed, buyAndPlantTree, sellMarketItem, endDay, sail, restoreCurrentFarm, type FarmState } from '../src/farm.ts'
import * as voyages from '../src/ferry-expeditions.ts'
import { expeditionWallet, receiveFerryExpedition, sendFerryExpedition } from '../src/harbour-economy.ts'
import { FerryPeachPlanting } from '../src/ferry-peach-planting.ts'
import type { renderFreightPanel } from '../src/bay-freight-ui.ts'
import { nextFerryExploration } from '../src/ferry-discovery.ts'
import { getFerryRestockPlan } from '../src/ferry-restock.ts'
import { ferryProjectProgress } from '../src/ferry-project-progress.ts'
import { smallerFerryCargo } from '../src/ferry-smaller-cargo.ts'
import { freightStock, freightPorts } from '../src/bay-freight-model.ts'
import { captureFerryPanelView, restoreFerryPanelView } from '../src/ferry-panel-view.ts'
import { ferryCommissionUse } from '../src/ferry-commission-use.ts'
import { ruCount } from '../src/ru.ts'
import { harbourTradePlayer } from './fixtures/harbour-trade-player.ts'
import { orchardCustomerReturn } from './fixtures/ferry-commission-return.ts'

const src = (name: string) => readFileSync(new URL('../src/'+name, import.meta.url), 'utf8')
const opening = JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json',import.meta.url),'utf8'))
const section = (s: string, a: string, b: string) => {
  const start = s.indexOf(a), stop = s.indexOf(b,start)
  assert.ok(start >= 0 && stop > start, a)
  return s.slice(start,stop)
}
const renderer = stripTypeScriptTypes(section(src('bay-freight-ui.ts'),'const labels:', 'export function renderFreightPanelInto'))
  .replaceAll('export function ', 'function ').replaceAll('import.meta.env.BASE_URL','"/"')
const render: typeof renderFreightPanel = runInNewContext(renderer+';renderFreightPanel',
  {...voyages,nextFerryExploration,getFerryRestockPlan,ferryProjectProgress,smallerFerryCargo,ruCount,freightStock,freightPorts})
function openingCargo(offer = 'orchard-peaches') {
  const p=harbourTradePlayer(opening)
  p.build('mill-buy');p.wheat(2);p.voyage('explore-orchard')
  assert.deepEqual([p.actions,p.state.day,p.state.coins,p.state.fruit.peach,p.state.handmade.round],[95,16,29,0,1])
  p.act('sendFerryExpedition',offer);p.night()
  assert.deepEqual([p.state.day,p.state.fruit.peach,p.state.freight.expeditions.active?.phase],[17,0,'ready'])
  return p.state
}
const main = src('main.ts')
const claimCommand = stripTypeScriptTypes(`switch('expedition-claim'){${section(main,"    case 'expedition-claim':","    case 'music-warehouse-visit':")}}`)
const enterCommand = stripTypeScriptTypes(
  section(main,'function activateTarget(','function useHotbar(')
  + `\n;((value)=>{switch('visit-tree'){${section(main,"    case 'visit-tree':","    case 'pet':")}}})`)
const display = (farm:FarmState, peachPlanting: ReturnType<FerryPeachPlanting['current']>) =>
  render(farm.freight,{day:farm.day,coins:farm.coins,boatOwned:farm.boatOwned,expeditionPort:'orchard',expeditionOffer:'orchard-peaches',
    playerPort:farm.island,openedPorts:['home','grove'],products:[{id:'peach',name:'Персик',icon:'peach'}],
    carried:expeditionWallet(farm).bag,commissionUse:ferryCommissionUse(farm),peachPlanting,icon:()=>''})

test('real first peach claim offers the canonical local tree preview, with no planting or dispatch on open',()=>{
  const farm=openingCargo(), ferryPeachPlanting=new FerryPeachPlanting()
  const receiptFocus:string[]=[]
  const heading={focus(){},scrollIntoView(){}}
  const dialogContent={querySelector(selector:string){
    if(selector==='.expedition-receipt')return {focus:()=>receiptFocus.push(selector),scrollIntoView(){}}
    if(selector==='[data-action="buy-plant-tree"][data-value="peach"]')
      return {closest:(s:string)=>s==='.sapling-option'?{querySelector:(t:string)=>t==='h2'?heading:null}:null}
    return null
  }}
  assert.equal(ferryPeachPlanting.current(farm),undefined)
  assert.doesNotMatch(display(farm,undefined),/Посмотреть посадку/)
  const control={},events:string[]=[],focus:unknown[]=[]
  const ui={farm,ferryPeachPlanting,receiveFerryExpedition,expeditionOfferAfterClaim:voyages.expeditionOfferAfterClaim,
    selectedExpeditionPort:'mill',selectedExpeditionOffer:'mill-buy',event:{detail:0},control,document:{activeElement:control},
    dialog:{open:true},dialogContent,panel:'bay-freight',treeSlot:-1,
    perform(action:()=>{ok:boolean}){return action().ok},bayAudio:{playEvent(){},primeEvents(){}},
    island:{isCrossing:()=>false,visit:(target:{kind:string;index:number})=>events.push(target.kind+':'+target.index)},
    openPanel(next:string){events.push(next);ui.panel=next},highlightControl:(node:unknown)=>focus.push(node),revealTreeStorageReturn(){}}
  runInNewContext(claimCommand,ui)
  assert.deepEqual([farm.day,farm.island,farm.coins,farm.fruit.peach,farm.handmade.round],[17,'home',13,2,1])
  assert.deepEqual(receiptFocus,['.expedition-receipt'])
  const state=structuredClone(farm)
  const choice=ferryPeachPlanting.current(farm)
  const html=display(farm,choice)
  const link=html.match(/data-action="visit-tree" data-value="([^"]+)"[^>]*>Посмотреть посадку<\/button>/)
  assert.ok(link,'the existing receipt exposes a single read-only way to browse peach planting')
  assert.equal(html.match(/Посмотреть посадку/g)?.length,1)
  assert.equal(html.match(/class="expedition-receipt"/g)?.length,1)
  assert.match(html,/Садовая пристань · день 17 · 16 монет → Персик ×2/)
  assert.match(html,/data-action="expedition-offer" data-value="orchard-buns"/)
  assert.match(html,/data-action="expedition-send" data-value="orchard-peaches"[^>]*disabled/)
  const enter = runInNewContext(enterCommand,ui)
  enter(link[1]+'stale');assert.deepEqual(events,[])
  enter(link[1])
  assert.deepEqual(events,['tree:1','tree'])
  assert.deepEqual(focus,[heading])
  assert.equal(ui.treeSlot,1)
  assert.deepEqual(farm,state)
  assert.equal(getFruitTreeSeed(farm,ui.treeSlot,'peach')?.nights,4)
  const sown=structuredClone(farm), paid=structuredClone(farm)
  assert.ok(plantFruitTreeSeed(sown,1,getFruitTreeSeed(sown,1,'peach')?.token).ok)
  assert.ok(buyAndPlantTree(paid,1,'peach').ok)
  assert.deepEqual([sown.coins,sown.fruit.peach,paid.coins,paid.fruit.peach],[13,1,0,2])
  assert.deepEqual(farm,state)
})

test('unclaimed, closed/reloaded, occupied, sold-out and foreign orchard actions never resolve',()=>{
  const farm=openingCargo('orchard-buns'), bridge=new FerryPeachPlanting()
  const forged='peach:1:fruit-tree:17:home:1:peach'
  assert.equal(bridge.resolve(farm,forged),undefined)
  assert.ok(bridge.receive(farm).ok)
  assert.deepEqual([farm.day,farm.coins,farm.fruit.peach,farm.handmade.round],[17,37,2,0])
  const choice=bridge.current(farm)!
  assert.equal(bridge.resolve(farm,choice.key)?.slot,1)
  assert.match(display(farm,choice),/Посмотреть посадку/)
  assert.equal(new FerryPeachPlanting().current(restoreCurrentFarm(structuredClone(farm))!),undefined)
  assert.ok(sail(farm,'grove').ok)
  assert.equal(bridge.resolve(farm,choice.key),undefined)
  assert.ok(sail(farm,'home').ok)
  assert.ok(buyAndPlantTree(farm,1,'pear').ok)
  assert.equal(farm.trees.home[2],null)
  assert.equal(bridge.current(farm),undefined,'do not retarget a receipt to another plot')
  assert.ok(buyAndPlantTree(farm,2,'apple').ok)
  assert.doesNotMatch(display(farm,bridge.current(farm)),/Посмотреть посадку/)
  const sold=openingCargo(),another=new FerryPeachPlanting()
  assert.ok(another.receive(sold).ok)
  assert.ok(sellMarketItem(sold,'fruit:peach',2).ok)
  assert.equal(another.current(sold),undefined)
  bridge.reset();assert.equal(bridge.current(farm),undefined)
})

test('a different paid voyage or a later day cannot resurrect the first cargo cue',()=>{
  const later=openingCargo(), first=new FerryPeachPlanting()
  assert.ok(first.receive(later).ok)
  assert.ok(first.current(later));assert.equal(first.receive(later).ok,false);assert.ok(first.current(later))
  assert.ok(sendFerryExpedition(later,'orchard-buns').ok)
  assert.equal(first.current(later),undefined)
  assert.ok(endDay(later).ok);assert.ok(first.receive(later).ok)
  assert.deepEqual([later.day,later.fruit.peach],[18,4])
  assert.equal(first.current(later),undefined)
  const tomorrow=openingCargo(),firstTomorrow=new FerryPeachPlanting()
  assert.ok(firstTomorrow.receive(tomorrow).ok);assert.ok(firstTomorrow.current(tomorrow))
  assert.ok(endDay(tomorrow).ok);assert.equal(firstTomorrow.current(tomorrow),undefined)
  const away=openingCargo();assert.ok(sail(away,'village').ok);assert.ok(firstTomorrow.receive(away).ok)
  assert.equal(firstTomorrow.current(away),undefined)
})

test('the existing commission continuation keeps the one receipt action slot',()=>{
  const {p}=orchardCustomerReturn()
  assert.ok(receiveFerryExpedition(p.state).ok)
  assert.ok(ferryCommissionUse(p.state))
  const html=display(p.state,{slot:1,key:'unused-when-commission-is-ready'})
  assert.equal(html.match(/data-action="expedition-order-recipe"/g)?.length,1)
  assert.doesNotMatch(html,/Посмотреть посадку/)
})

test('Back restores the same receipt button, then the same receipt heading if the plot was used',()=>{
  const farm=openingCargo(),bridge=new FerryPeachPlanting()
  assert.ok(bridge.receive(farm).ok)
  const {key,slot}=bridge.current(farm)!
  const calls:string[]=[]
  const common={matches:()=>false,closest:()=>null,parentElement:null,
    scrollIntoView(){calls.push('revealed')},getBoundingClientRect:()=>({top:220,bottom:244})}
  const link={...common,dataset:{action:'visit-tree',value:key},matches:(s:string)=>s==='button[data-action]',focus:()=>calls.push('planting preview')}
  const close={...common,focus:()=>calls.push('close')}, receipt={...common,focus:()=>calls.push('same receipt')}
  const desk={scrollTop:78,getBoundingClientRect:()=>({top:40,bottom:250})}
  const workspace={scrollTop:11,getBoundingClientRect:()=>({top:10,bottom:200})}
  const panel={dataset:{receiptVoyage:String(farm.freight.expeditions.serial)},contains:(element:unknown)=>element===link,
    querySelector:(q:string)=>q==='.bay-freight-close'?close:q==='.expedition-receipt'?receipt:q==='.expedition-card-scroll'?desk:q==='.bay-freight-workspace'?workspace:null,
    querySelectorAll:()=>bridge.current(farm)?[link]:[]}
  const host={ownerDocument:{activeElement:link},querySelector:()=>panel} as unknown as HTMLElement
  const visit=captureFerryPanelView(host)!
  assert.deepEqual(visit.focus,{action:'visit-tree',area:'panel',value:key})
  desk.scrollTop=0;workspace.scrollTop=0
  restoreFerryPanelView(host,visit)
  assert.deepEqual(calls,['planting preview'])
  assert.deepEqual([desk.scrollTop,workspace.scrollTop],[78,11])
  assert.ok(plantFruitTreeSeed(farm,slot,getFruitTreeSeed(farm,slot,'peach')?.token).ok)
  calls.length=0;restoreFerryPanelView(host,visit)
  assert.deepEqual(calls,['same receipt','revealed'])
  calls.length=0;panel.dataset.receiptVoyage='999';restoreFerryPanelView(host,visit)
  assert.deepEqual(calls,['close'])
})

test('the living ferry receipt survives the existing Back entry but not an ordinary reopen',()=>{
  const noop=()=>{}
  const model=()=>{const farm=openingCargo(),bridge=new FerryPeachPlanting();assert.ok(bridge.receive(farm).ok);assert.ok(bridge.current(farm));return {farm,bridge}}
  function visit(farm:FarmState,bridge:FerryPeachPlanting,panel:string,opened:boolean){
    const resets={reset:noop},seen:boolean[]=[]
    const ctx={farm,ferryPeachPlanting:bridge,panel,dialog:{open:opened,showModal(){this.open=true}},panelHistory:[],
      island:{isCrossing:()=>false,setViewMode:noop,setCoveFocus:noop},salePresentation:{place:undefined},marketSaleBrowse:resets,
      selectedMarketOrder:undefined,pickedMarketOrder:undefined,hiveFlower:undefined,seedPickerBed:undefined,
      transplantSelection:resets,berryNurserySelection:resets,berryRenewalSelection:resets,gardenEditor:resets,recipeSurplusSelection:resets,
      selectedExpeditionOffer:undefined,freightPlanOpen:false,selectedWarehouse:undefined,celebratedFestival:undefined,
      stopHarbour:noop,stopFishing:noop,stopWorkshop:noop,stopCookery:noop,stopArrangement:noop,playBaySound:noop,
      rememberPanel:()=>({panel}),dialogContent:{scrollTop:0,querySelector:()=>null},app:{dataset:{}},toast:{},dialogFeedback:{},
      closeButton:{focus:noop},ferryArrival:{take:()=>false},updateCommunityReturn:noop,drawPanel:()=>seen.push(!!bridge.current(farm))}
    const openPanel=runInNewContext(stripTypeScriptTypes(section(main,'function openPanel(','function openRecipeBook('))+';openPanel',ctx)
    return {openPanel,seen}
  }
  const nested=model(),back=visit(nested.farm,nested.bridge,'tree',true)
  back.openPanel('bay-freight',false)
  assert.deepEqual(back.seen,[true],'Back from the orchard keeps the receipt owned by the same open dialog')
  const home=model(),reopened=visit(home.farm,home.bridge,'',false)
  reopened.openPanel('bay-freight')
  assert.deepEqual(reopened.seen,[false],'reopening the closed dialog never presents the old first receipt action again')
  const boat=model(),separate=visit(boat.farm,boat.bridge,'boat',true)
  separate.openPanel('bay-freight')
  assert.deepEqual(separate.seen,[false],'a newly remembered visit from Boat is distinct even if using the same modal')
})
