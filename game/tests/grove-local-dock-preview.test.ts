import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import * as F from '../src/farm.ts'
import { getIslandJourneys } from '../src/journey.ts'
import { getCapeJourneyStatus } from '../src/cape-journey-status.ts'
import { getRequirementHint } from '../src/requirement-guidance.ts'
import { expeditionWallet } from '../src/harbour-economy.ts'
import { initialExpeditionPreview } from '../src/ferry-expeditions.ts'
import { firstFerryCargoOffer } from '../src/ferry-smaller-cargo.ts'
import { ruPlural } from '../src/ru.ts'
import { commissionPlayer } from './fixtures/commission-player.ts'

const read = (name: string) => readFileSync(new URL(name, import.meta.url), 'utf8')
const opening: {name: string; args: unknown[]}[] = JSON.parse(read('./fixtures/home-progress-actions.json'))
const main = read('../src/main.ts')
function exact(from: string, to: string) {
  const i = main.indexOf(from), j = main.indexOf(to, i + from.length)
  assert.ok(i >= 0 && j > i, from)
  return main.slice(i, j)
}
const render = stripTypeScriptTypes(exact('function button(', 'function row(')
  + exact('const dishIcons:', 'const pastryIcons =')
  + exact('function stockLabel(', 'function stockTile(')
  + exact('function deliveryItems(', 'function harborCard(')
  + exact('function projectCard(', 'function freshIrrigationMode(')
  + "switch(panel) {" + exact("    case 'boat': {", "    case 'harbor':")
    .replaceAll('import.meta.env.BASE_URL', "'/'") + '}')
const controlsIn = (html: string) => [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].map(([, attrs, label])=>({
  action:attrs.match(/data-action="([^"]+)"/)?.[1],value:attrs.match(/data-value="([^"]+)"/)?.[1],
  secondary:/class="dialog-button secondary"/.test(attrs),enabled:!(/\sdisabled(?:\s|$)/.test(attrs)),label:label.trim()
}))
function shore(farm: F.FarmState, panel: 'boat'|'dock-project', region = farm.island) {
  const dialogContent = {innerHTML:''}
  const select = initialExpeditionPreview(farm.freight.expeditions)
  const items = new Map<string,unknown>()
  runInNewContext(render,{...F, farm, getIslandJourneys, getCapeJourneyStatus, firstFerryCargoOffer, expeditionWallet,
    selectedExpeditionPort:select.port,selectedExpeditionOffer:select.offer, panel, dialogContent, boatIsland:region,
    journeyDetailsOpen:false, pastryShape:'round', escapeHtml:String, ruPlural, icon:()=>'', numberFormat:new Intl.NumberFormat('ru-RU'),
    requirementLink:(html:string, context:unknown, label:string)=>{
      items.set(label,context)
      return html
    }, itemIcon:()=>''})
  const html=dialogContent.innerHTML
  const nav = html.match(/<nav class="island-places"[^>]*>([\s\S]*?)<\/nav>/)?.[1] ?? html
  return {html, buttons:controlsIn(nav), items}
}
const trip = ()=>commissionPlayer(opening.slice(0,opening.findIndex(x=>x.name==='sail')+1))
const clip = (f: F.FarmState)=>F.getProject(f,'dock').items.map(({available,delivered})=>[available,delivered])
const proposal = (farm: F.FarmState, destination = farm.island)=>shore(farm,'boat',destination).buttons.find(x=>x.action==='project-dock')
const readback = (farm: F.FarmState)=>F.restoreCurrentFarm(JSON.parse(JSON.stringify(farm)))!

test('after a first ordinary Grove landing only currently usable local stock exposes the dock review', t=>{
  const landed=trip()
  assert.deepEqual([landed.actions,landed.state.day,landed.state.island,landed.state.coins,
    landed.state.buildingLevels.farmhouse,landed.state.fruit.pear,landed.state.seaSalt],[15,2,'grove',22,1,0,0])
  assert.equal(landed.state.trees.grove[0]?.fruitReady,2,'ripe stock is not already in the bag')
  assert.equal(landed.state.freight.warehouses.grove.seaSalt,undefined,'no free salt stock granted')
  assert.equal(F.getProject(landed.state,'dock').status,'waiting')
  assert.equal(proposal(landed.state),undefined)
  const lockedCape=shore(landed.state,'boat','cape')
  assert.equal(lockedCape.buttons.some(b=>b.action==='sail'&&b.value==='home'),true)
  assert.match(lockedCape.html,/Причал Солёной рощи/)
  assert.equal(getRequirementHint(landed.state,{kind:'journey',island:'cape',id:'pier'}).action.target,'project-dock')
  const observed = []
  for(const [name,args,goods,preview] of [
    ['pickFruit',[0],'fruit:pear',[[0,0],[2,0],[0,0]]],
    ['gatherSeaSalt',[],'seaSalt',[[0,0],[0,0],[2,0]]],
  ] as const){
    const earned=trip(); earned.act(name,...args)
    const farm=earned.state, before=structuredClone(farm)
    assert.equal(earned.actions,16)
    assert.equal(F.getProject(farm,'dock').status,'ready')
    assert.deepEqual(clip(farm),preview)
    assert.equal(F.getHarborOrder(farm),undefined,'not the later specialty order')
    const actions=shore(farm,'boat').buttons
    t.diagnostic(JSON.stringify({from:name,day:farm.day,island:farm.island,coins:farm.coins,currentActions:actions.map(x=>x.action),takeAndKeep:preview}))
    assert.deepEqual(actions.filter(x=>x.action==='open-panel').map(x=>x.value),['cove','bay-freight'])
    observed.push([actions.map(x=>x.action), proposal(farm)])
    for(const selected of ['home','cape','village'] as const) assert.equal(proposal(farm,selected),undefined,'no cross-region shortcut')
    assert.deepEqual(farm,before)
    const carry=readback(farm); assert.ok(F.sail(carry,'home').ok); assert.ok(F.sellMarketItem(carry,goods,1).ok)
    assert.equal(carry.coins,name==='pickFruit'?28:26,'sale stays an independent alternative')
    assert.deepEqual(carry.projects.dock,{})
    assert.equal(proposal(carry,'grove'),undefined,'away island retains normal Sail')
  }
  const expected = [['open-panel','project-dock','open-panel'],
    {action:'project-dock',value:undefined,secondary:true,enabled:true,label:'Причал рощи'}]
  assert.deepEqual(observed,[expected,expected])
  const complete=commissionPlayer(opening.slice(0,29))
  assert.equal(complete.state.island,'grove')
  assert.equal(F.getProject(complete.state,'dock').status,'completed')
  assert.equal(proposal(complete.state),undefined)
  assert.equal(getIslandJourneys(complete.state).find(x=>x.id==='cape')?.nextAction?.target,'sail')
  complete.visit('home'); complete.act('specializeFarmhouse','bakery'); complete.visit('grove')
  assert.ok(F.getHarborOrder(complete.state),'the ordinary later order has its own unlocked path')
  assert.deepEqual(shore(complete.state,'boat').buttons.map(x=>[x.action,x.value]),
    [['open-panel','cove'],['visit-harbor',undefined],['open-panel','bay-freight']])
})

const activation = stripTypeScriptTypes(exact('function focusKey(', 'let harbourScene:')
  + exact('function openPanel(', 'function openRecipeBook(')
  + 'function choose(action) { switch(action) {'
  + exact("    case 'project-dock':", "    case 'visit-harbor':") + '}};({openPanel,goBack,choose})')
function dockVisit(farm: F.FarmState) {
  const saves: string[]=[], focused: string[]=[], route: string[]=[]
  class Button {
    dataset: {action:string}
    constructor(action:string) { this.dataset={action} }
    focus(){ ctx.document.activeElement=this;focused.push(this.dataset.action) }
    getClientRects(){ return [1] }
  }
  const dock=new Button('project-dock'), close=new Button('close')
  const dialog={open:true, querySelectorAll:()=>ctx.panel==='boat'?[dock]:[close]}
  const content={scrollTop:17, innerHTML:'',querySelector:()=>null,querySelectorAll:()=>[]}
  const ship = initialExpeditionPreview(farm.freight.expeditions)
  const ctx: any={...F, farm,panel:'boat',boatIsland:'grove',dialog,dialogContent:content,
    HTMLButtonElement:Button,document:{activeElement:dock},closeButton:close,panelHistory:[],signatureSlots:[],panelRenderVersion:0,
    selectedExpeditionPort:ship.port,selectedExpeditionOffer:ship.offer,selectedWarehouse:'grove',
    recipeBook:{view:{},snapshot:()=>({mode:'index'}),load(){}},salePresentation:{place:undefined},marketSaleBrowse:{reset(){}},
    ferryArrival:{take:()=>false},restoreFerryPanelView(){},requestAnimationFrame:(fn:()=>void)=>fn(),app:{dataset:{}},toast:{},dialogFeedback:{},
    island:{isCrossing:()=>false,setViewMode(){},setCoveFocus(){},crossIsland(){assert.fail('local preview and Back cannot travel')}},
    ...Object.fromEntries(['transplantSelection','berryNurserySelection','berryRenewalSelection','gardenEditor','recipeSurplusSelection'].map(k=>[k,{reset(){}}])),
    ...Object.fromEntries(['stopHarbour','stopFishing','stopWorkshop','stopCookery','stopArrangement','status','playBaySound','updateCommunityReturn'].map(k=>[k,()=>{}])),
    perform(){assert.fail('opening or leaving a preview cannot contribute')},
    saveFarm(){saves.push(JSON.stringify(farm))},
    drawPanel(){route.push(ctx.panel);ctx.panelRenderVersion++;content.innerHTML=shore(farm,ctx.panel,ctx.boatIsland).html}
  }
  for(const field of `marketTab selectedMarketOrder pickedMarketOrder selectedWarehouseRequest freightPlanOpen inventoryGroup journeyDetailsOpen
    journalDetailsOpen marketSaleFamily marketSaleQuery marketCategory marketSellGroup bagTab archiveGroup treeSlot previewSeed
    specializationBuilding previewSpecialization irrigationMode villageSlot pastryShape workshopRecipe cookingDish cookingFish seedPickerBed
    signatureBase signatureSlot signatureRepeatId expandedRepeatId cookingMode communityOrderId communityResident requestedFood kitchenTart
    kitchenPreserves kitchenGroup kitchenDish honeyKitchenDish signatureFamily hiveFlower celebratedFestival`.split(/\s+/))
    ctx[field]=undefined
  return {ctx,saves,focused,route,dock,ui:runInNewContext(activation,ctx)}
}

test('one local review takes no goods or trip; Back restores the originating Grove card and explicit delivery is separate',()=>{
  const player=trip(); player.act('pickFruit',0); player.act('gatherSeaSalt')
  const farm=player.state
  assert.deepEqual(clip(farm),[[0,0],[2,0],[2,0]])
  const offer=proposal(farm); assert.ok(offer)
  const view=dockVisit(farm)
  view.ui.openPanel('boat',false) // actual existing orientation entry before the measured branch
  assert.deepEqual(view.saves,[JSON.stringify(farm)])
  const initial=structuredClone(farm)
  view.ctx.dialogContent.scrollTop=17; view.dock.focus()
  view.saves.length=0; view.route.length=0; view.focused.length=0
  view.ui.choose(offer.action)
  assert.deepEqual(view.route,['dock-project'])
  assert.deepEqual(view.saves,[])
  assert.deepEqual(view.focused,['close'],'review must not arm the contribution')
  assert.deepEqual(view.ctx.panelHistory.map((s:{boatIsland:string})=>s.boatIsland),['grove'])
  assert.deepEqual(farm,initial)
  const ready=controlsIn(view.ctx.dialogContent.innerHTML).find(x=>x.action==='deliver-project')
  assert.ok(ready?.enabled && ready.value==='dock')
  const html=shore(farm,'dock-project').html
  assert.match(html,/Доставлено <\/span>0\/2<\/strong>[\s\S]*?\+2<span class="sr-only"> в наличии<\/span>/)
  view.ui.goBack(true)
  assert.deepEqual(view.route,['dock-project','boat'])
  assert.equal(view.ctx.boatIsland,'grove')
  assert.equal(view.ctx.dialogContent.scrollTop,17)
  assert.deepEqual(view.focused,['close','close','project-dock'])
  // The existing Islands entry records its orientation bit; our return is idempotent.
  assert.deepEqual(view.saves,[JSON.stringify(farm)])
  assert.deepEqual(farm,initial)
  assert.deepEqual(farm.projects.dock,{})
  assert.deepEqual([farm.island,farm.coins,farm.fruit.pear,farm.seaSalt],['grove',22,2,2])
  player.act('deliverProject','dock')
  assert.deepEqual([player.state.coins,player.state.fruit.pear,player.state.seaSalt],[22,0,0],'no payout for a partial contribution')
  assert.deepEqual(player.state.projects.dock,{'fruit:pear':2,seaSalt:2})
  assert.equal(F.getProject(player.state,'dock').status,'waiting')
  assert.equal(proposal(player.state),undefined,'no irrelevant call to contribute after current stock is committed')
})
