import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'
import * as F from '../src/farm.ts'
import { chooseHoneyKitchenRecipe, renderHoneyKitchenMenu } from '../src/honey-kitchen-menu.ts'
import { getRequirementHint, type Requirement } from '../src/requirement-guidance.ts'
import { getWindHoneySource } from '../src/wind-honey-guidance.ts'
import { commissionPlayer } from './fixtures/commission-player.ts'
import { harbourTradePlayer } from './fixtures/harbour-trade-player.ts'

const read = (file: string) => readFileSync(new URL(file, import.meta.url), 'utf8')
const main = read('../src/main.ts')
/** Ordinary action receipts, restored after each command; no level, ingredient, money or day grants. */
export function earnedCapeTasting() {
  const grower = harbourTradePlayer(JSON.parse(read('./fixtures/home-progress-actions.json')))
  grower.build(); grower.wheat(2); grower.voyage('explore-orchard')
  const tail: [string, ...unknown[]][] = [
    ["sendFerryExpedition", "mill-buy"], ["endDay"], ["receiveFerryExpedition"],
    ["sendFerryExpedition", "orchard-buns"], ["endDay"], ["receiveFerryExpedition"],
    ["plantFruitTreeSeed", 1, "fruit-tree:20:home:1:peach"], ["sendFerryExpedition", "mill-buy"], ["endDay"],
    ["receiveFerryExpedition"], ["sendFerryExpedition", "orchard-buns"], ["endDay"],
    ["receiveFerryExpedition"], ["pickFruit", 0], ["endDay"],
    ["pickFruit", 0], ["sendFerryExpedition", "orchard-apples"], ["endDay"],
    ["receiveFerryExpedition"], ["pickFruit", 0], ["endDay"],
    ["pickFruit", 0], ["sendFerryExpedition", "orchard-apples"], ["endDay"],
    ["receiveFerryExpedition"], ["pickFruit", 0], ["sail", "grove"],
    ["pickFruit", 0], ["sail", "home"], ["sellMarketItem", "fruit:peach", 2],
    ["specializeFarmhouse", "preserves"], ["cookDish", "orchardPreserves"], ["sail", "grove"],
    ["catchFish", true], ["deliverHarborOrder"], ["sail", "home"],
    ["sellMarketItem", "dishes:appleJam", 1], ["sail", "cape"], ["collectCapeHoney"],
    ["sail", "home"], ["endDay"], ["sail", "cape"],
    ["upgradeCape"], ["collectCapeHoney"], ["sail", "home"],
    ["endDay"], ["sail", "cape"], ["collectCapeHoney"],
    ["sail", "home"], ["endDay"], ["sail", "cape"],
    ["collectCapeHoney"], ["sail", "home"], ["sellMarketItem", "dishes:orchardTart", 1],
    ["sellMarketItem", "honey", 5], ["sail", "grove"], ["gatherSeaSalt"],
    ["sail", "cape"], ["upgradeCape"], ["sail", "home"],
    ["sellMarketItem", "honey", 1], ["buySeeds", "wheat"], ["selectSeed", "wheat"],
    ["workBed", 0], ["workBed", 0], ["endDay"],
    ["endDay"], ["workBed", 0], ["buyFeed"],
    ["feedChickens"], ["endDay"], ["collectEggs"],
    ["sail", "cape"], ["cookDish", "honeyBiscuits"], ["cookDish", "honeyBiscuits"],
    ["sail", "home"], ["deliverMarketOrder", "honeyKitchen"], ["endDay"],
    ["sail", "grove"], ["gatherSeaSalt"], ["pickFruit", 0],
    ["sail", "home"], ["endDay"],
  ]
  return commissionPlayer([...grower.log, ...tail.map(([name,...args])=>({name,args}))])
}

const take = (start: string, end: string) => {
  const a=main.indexOf(start), b=main.indexOf(end,a+start.length)
  assert.ok(a>=0&&b>a,start)
  return main.slice(a,b)
}
const controller=stripTypeScriptTypes([
  take('let honeyKitchenDish: HoneyKitchenRecipe =', 'type KitchenTart'),
  take('function openPanel(', 'function openRecipeBook('),
  take('async function showRequirement(', '// Scene handlers own material sounds'),
  "function pick(value){switch('honey-kitchen-recipe'){"+take("    case 'honey-kitchen-recipe':", "    case 'kitchen-group':")+'}}',
  '({openPanel,showRequirement,pick,get dish(){return honeyKitchenDish},restoreDish: dish=>{honeyKitchenDish=dish}})',
].join('\n'))

function mounted(farm:F.FarmState, initialPanel='market') {
  const no=()=>{}, reset={reset:no}, focus:string[]=[], arrivals:string[]=[], motion:string[]=[]
  let markup=''
  const closeButton={focus(){focus.push('close')}}
  const dialog={open:true,showModal(){dialog.open=true}}
  const dialogContent={
    scrollTop:0,
    contains(){return true},
    querySelector(selector:string){return {focus(){focus.push(selector)}}},
  }
  const panelHistory:unknown[]=[]
  const ctx={
    ...F, ...{chooseHoneyKitchenRecipe,getRequirementHint}, farm, panel:initialPanel, dialog,dialogContent,
    panelTitles:{'honey-kitchen':'Медовая кухня'}, closeButton,
    island:{isCrossing:()=>false, setViewMode:no,setCoveFocus:no,
      async crossIsland(move:()=>boolean){assert.ok(move());arrivals.push(farm.island)},focusTarget(place:{kind:string}){motion.push(place.kind)}},
    fieldViewButton:{getAttribute:()=> 'false'}, salePresentation:{place:undefined},
    marketSaleBrowse:reset, marketTab:'orders',selectedMarketOrder:'honeyKitchen',pickedMarketOrder:'honeyKitchen', panelHistory,
    rememberPanel:()=>({panel:ctx.panel,honeyKitchenDish:ui.dish}),
    hiveFlower:undefined,seedPickerBed:undefined,boatIsland:undefined,journeyDetailsOpen:false,saveFarm:no,status:no, celebratedFestival:undefined, kitchenGroup:undefined,
    transplantSelection:reset,berryNurserySelection:reset,berryRenewalSelection:reset,gardenEditor:reset,recipeSurplusSelection:reset,
    stopHarbour:no,stopFishing:no,stopWorkshop:no,stopCookery:no,stopArrangement:no,playBaySound:no,
    app:{dataset:{}}, toast:{hidden:true},dialogFeedback:{hidden:true,textContent:''},updateCommunityReturn:no,notify:no,
    closeDialog(){dialog.open=false;ctx.panel='field';panelHistory.length=0},
    perform(run:()=>F.ActionResult){const result=run();return result.ok},
    highlightControl(control:{focus():void}){control.focus()},
    drawPanel(){if(ctx.panel==='honey-kitchen')markup=renderHoneyKitchenMenu(ui.dish,()=>'',ids=>ids.map(id=>
      '<button data-action="cook" data-value="'+id+'"'+(F.getCookAction(farm,id).available?'':' disabled')+'>Готовить</button>').join(''))},
  }
  const ui=runInNewContext(controller,ctx) as {
    openPanel(panel:string,remember?:boolean):void; showRequirement(requirement:Requirement):Promise<void>;
    pick(value:string):void;dish:typeof F.capeDishIds[number];restoreDish(dish:typeof F.capeDishIds[number]):void
  }
  return {ui,ctx,arrivals,motion,focus,panelHistory,get markup(){return markup}}
}

const order=(farm:F.FarmState)=>F.getMarketOrders(farm).find(row=>row.lane==='honeyKitchen')!
const held=(farm:F.FarmState)=>({
  day:farm.day,coins:farm.coins,honey:farm.honey,wind:farm.windHoney,salt:farm.seaSalt,eggs:farm.eggs,fruit:{...farm.fruit},
  dishes:{...farm.dishes},orders:farm.orders.honeyKitchen
})

test('an earned Cape tasting keeps the exact requested dish after the ordinary source crossing',async()=>{
  for(const id of ['honeyPear','windParfait'] as const) {
    const {state:farm,actions}=earnedCapeTasting(),before=held(farm),live=order(farm),v=mounted(farm)
    assert.deepEqual([farm.day,actions,farm.coins,farm.capeLevel,farm.fruit.pear,farm.fruit.peach,farm.windHoney,farm.produce.wheat],[34,185,71,3,2,1,1,0])
    assert.equal(live.reward,88);assert.equal(live.status,'waiting')
    const item=live.items.find(item=>item.kind==='dishes'&&item.item===id)!
    assert.ok(item)
    await v.ui.showRequirement({kind:'stock',item})
    assert.deepEqual(v.arrivals,['cape']);assert.equal(v.ctx.panel,'honey-kitchen')
    assert.equal(F.getCookAction(farm,'honeyBiscuits').available,false)
    assert.equal(v.ui.dish,id)
    assert.match(v.markup,new RegExp('data-action="cook" data-value="'+id+'">'))
    assert.equal((v.markup.match(/data-action="honey-kitchen-recipe"/g)??[]).length,3)
    assert.equal(v.focus.at(-1),'[data-action="honey-kitchen-recipe"][data-value="'+id+'"]')
    assert.deepEqual(held(farm),before,'guidance never cooks, gives away food, or spends')
    v.ctx.closeDialog();v.ui.openPanel('honey-kitchen')
    assert.equal(v.ui.dish,'honeyBiscuits','ordinary entry has no guided selection')
  }
})

test('a guided local visit retains actual manual selection, and a depleted rare ingredient remains a source problem',async()=>{
  const p=earnedCapeTasting();p.visit('cape')
  const v=mounted(p.state,'hive')
  v.ui.openPanel('honey-kitchen');v.ui.pick('honeyPear')
  const item=order(p.state).items.find(item=>item.kind==='dishes'&&item.item==='windParfait')!
  const earlier=held(p.state)
  await v.ui.showRequirement({kind:'stock',item})
  assert.equal(v.ui.dish,'windParfait');assert.deepEqual(v.arrivals,[])
  assert.equal(v.focus.at(-1),'[data-action="honey-kitchen-recipe"][data-value="windParfait"]')
  // Existing goBack restores its PanelVisit's dish before opening with remember=false.
  v.ui.restoreDish('windParfait');v.ui.openPanel('honey-kitchen',false)
  assert.equal(v.ui.dish,'windParfait')
  v.ctx.closeDialog();v.ui.openPanel('honey-kitchen')
  assert.equal(v.ui.dish,'honeyPear')
  assert.deepEqual(held(p.state),earlier)
  const short=earnedCapeTasting();short.act('sellMarketItem','windHoney',1);short.visit('cape')
  const gate=mounted(short.state,'hive'),stock=held(short.state)
  assert.equal(getWindHoneySource(short.state).day,38)
  await gate.ui.showRequirement({kind:'stock',item})
  assert.notEqual(gate.ctx.panel,'honey-kitchen')
  assert.deepEqual(held(short.state),stock)
})

test('selling the only wind honey today or completing a pair changes actual income, not automatic access',()=>{
  const raw=earnedCapeTasting()
  raw.act('sellMarketItem','windHoney',1);assert.equal(raw.state.coins,89)
  raw.visit('cape');assert.equal(F.getCookAction(raw.state,'windParfait').available,false)
  const pair=earnedCapeTasting()
  pair.visit('cape');pair.act('cookDish','honeyPear');pair.act('cookDish','windParfait')
  assert.deepEqual([pair.state.fruit.pear,pair.state.fruit.peach,pair.state.windHoney,pair.state.coins],[0,0,0,71])
  pair.visit('home');pair.act('deliverMarketOrder','honeyKitchen')
  assert.equal(pair.state.coins,159)
  assert.equal(F.deliverMarketOrder(pair.state,'honeyKitchen').ok,false)
  assert.equal(pair.state.coins,159)
})
