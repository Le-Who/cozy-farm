import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { runInNewContext } from 'node:vm'
import test from 'node:test'
import * as F from '../src/farm.ts'
import { bayProductId } from '../src/bay-product-id.ts'
import { getBerryNurserySource } from '../src/berry-nursery.ts'
import { getRequirementHint } from '../src/requirement-guidance.ts'
import { reconcileFreightPorts } from '../src/bay-freight-model.ts'
import { getLocalWarehouseSupply, warehouseRequest } from '../src/warehouse-guidance.ts'
import { combinedExpeditionId } from '../src/ferry-expeditions.ts'
import { openedFreightPorts, receiveFerryExpedition, sendFerryExpedition } from '../src/harbour-economy.ts'
import { delayedLastFerryReceiptFarm } from './fixtures/last-ferry-receipt.ts'

const okay = (result: F.ActionResult) => assert.ok(result.ok, result.message)
const cold = (farm: F.FarmState) => {
  const loaded = F.restoreCurrentFarm(JSON.parse(JSON.stringify(farm)))
  assert.ok(loaded)
  return loaded
}
function earnedKitchen() {
  // The existing ordinary opener, followed by finite harvests and actual paid trade.
  const farm = delayedLastFerryReceiptFarm()
  okay(receiveFerryExpedition(farm))
  for (let i=0; farm.fruit.apple<15; i++) {
    assert.ok(i<15)
    if (!farm.trees.home[0]?.fruitReady) okay(F.endDay(farm))
    okay(F.pickFruit(farm,0))
  }
  for (const id of ['mill-buy','orchard-buns','orchard-buns','orchard-apples','orchard-apples','orchard-apples']) {
    okay(sendFerryExpedition(farm,id)); okay(F.endDay(farm)); okay(receiveFerryExpedition(farm))
  }
  okay(F.sellMarketItem(farm,'fruit:peach',2))
  okay(F.upgradeBuilding(farm,'farmhouse')); okay(F.specializeFarmhouse(farm,'preserves'))
  assert.deepEqual([farm.day,farm.coins,farm.fruit.apple,farm.fruit.pear,farm.fruit.peach],[17,31,6,0,2])
  // Dispatch is reached via the ordinary freight board. Reconcile its old
  // circular route here just as drawPanel already does before any send.
  reconcileFreightPorts(farm.freight, openedFreightPorts(farm))
  return cold(farm)
}
const pair=combinedExpeditionId('orchard-apples','orchard-mixed')!
const pear={kind:'fruit',item:'pear',quantity:1} as const
const main = readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
function part(from:string,to:string){
  const a=main.indexOf(from), b=main.indexOf(to,a+from.length)
  assert.ok(a>=0 && b>a,from)
  return main.slice(a,b)
}
const code = stripTypeScriptTypes(
  part('function requirementLink(', 'const islandNames') + part('function stockLabel(', 'function kitchenReadyDishes(')
  + part('async function showRequirement(', '// Scene handlers own material sounds.'))
const command = stripTypeScriptTypes(`(async()=>{switch('show-requirement'){${part("    case 'show-requirement': {","    case 'picnic-field': {")}}})()`)
const choose = 'orchardPreserves'
function kitchen(farm:F.FarmState, ownIngredient = true) {
  const actions: string[]=[]
  const ctx = {
    ...F, farm, bayProductId, getBerryNurserySource, getRequirementHint, warehouseRequest,
    panel:'kitchen', cookingFish:'seaBass', dishIcons:{orchardPreserves:'ui-orchard-preserves'},
    requirementLinks:new Map<string,unknown>(), dialog:{open:true},
    dialogContent:{contains:()=>ownIngredient,querySelector:()=>null},
    icon:()=>'', unitPrice:()=>0, escapeHtml:(str:string)=>str, selectedWarehouseRequest:undefined,
    button(label:string,action:string,enabled:boolean,opts:{value:string}) {
      return `<button data-action="${action}" data-value="${opts.value}" ${enabled?'':'disabled'}>${label}</button>`
    },
    fieldViewButton:{getAttribute:()=>null}, highlightControl(){}, control:{}, value:'',
    closeDialog(){ ctx.dialog.open=false; actions.push('close') },
    openPanel(panel:string){
      // The ordinary board draw also reconciles the legacy route; it is inert here.
      if(panel==='bay-freight')reconcileFreightPorts(farm.freight,openedFreightPorts(farm))
      ctx.panel=panel; actions.push('open:'+panel)
    },
    island: {
      async crossIsland(cb:()=>void){ actions.push('cross'); cb() },
      focusTarget(value:{kind:string;index:number}){ actions.push('focus:'+value.kind+':'+value.index) },
    },
    perform(cb:()=>F.ActionResult){ actions.push('write'); okay(cb()); return true },
  }
  const run=(script:string)=>runInNewContext(script,ctx)
  run(code)
  const html=run(`recipeCards(['${choose}'])`) as string
  const source = html.match(/data-action="show-requirement" data-value="([^"]+)" aria-label="Где найти: Груша, 0 из 1"/)
  assert.match(html,/Садовый конфитюр/)
  assert.match(html,/data-action="cook" data-value="orchardPreserves" disabled/)
  assert.ok(source)
  assert.equal(JSON.stringify(ctx.requirementLinks.get(source[1])),JSON.stringify({kind:'stock',item:pear}))
  return {actions,html,sourceId:source[1],async choosePear(){
    ctx.value=source[1]
    ctx.control={closest:(selector:string)=>selector==='.recipe .ingredients'&&ownIngredient?{}:null}
    await run(command)
  }}
}

test('a real paid Orchard basket still waiting on D21 opens its own cargo from the missing Home recipe ingredient, without claiming',async()=>{
  let farm=earnedKitchen()
  okay(sendFerryExpedition(farm,pair))
  const contract=structuredClone(farm.freight.expeditions.active!)
  assert.deepEqual([farm.day,farm.coins,contract.payCoins,contract.returnsOn],[17,13,18,18])
  for(let i=0;i<4;i++){ okay(F.endDay(farm)); farm=cold(farm) }
  assert.deepEqual(farm.freight.expeditions.active,{...contract,phase:'ready'})
  assert.deepEqual([farm.day,farm.fruit.apple,farm.fruit.pear,farm.fruit.peach,farm.dishes.appleJam],[21,3,0,2,3])
  const before=JSON.stringify(farm), ui=kitchen(farm)
  await ui.choosePear()
  assert.deepEqual(ui.actions,['open:bay-freight'],'find the paid already-returned pear rather than crossing to the orchard')
  assert.match(ui.html,new RegExp(`aria-describedby="requirement-source-${ui.sourceId}"`))
  assert.match(ui.html,new RegExp(`<small id="requirement-source-${ui.sourceId}">К грузу</small>`))
  assert.equal(JSON.stringify(farm),before)
  assert.equal(F.getCookAction(farm,choose).available,false)
  // The one normal, separate claim, not navigation, makes the recipe available.
  okay(receiveFerryExpedition(farm))
  assert.deepEqual([farm.coins,farm.fruit.apple,farm.fruit.pear,farm.fruit.peach,farm.dishes.appleJam],[13,4,1,3,4])
  assert.equal(F.getCookAction(cold(farm),choose).available,true)
  const after=JSON.stringify(farm)
  assert.equal(receiveFerryExpedition(farm).ok,false)
  assert.equal(JSON.stringify(farm),after)
})

test('before the return day, another returned cargo, and a non-kitchen ingredient keep the true Grove source',async()=>{
  for(const mode of ['before dispatch','not ready','other cargo','outside ingredient'] as const) {
    let farm=earnedKitchen()
    if(mode!=='before dispatch')okay(sendFerryExpedition(farm,mode==='other cargo'?'orchard-peaches':pair))
    if(mode==='other cargo'||mode==='outside ingredient'){okay(F.endDay(farm));farm=cold(farm)}
    const ui=kitchen(farm,mode!=='outside ingredient')
    if(mode!=='outside ingredient')assert.doesNotMatch(ui.html,/К грузу/,mode)
    await ui.choosePear()
    assert.deepEqual(ui.actions,['close','cross','write','close','focus:tree:0'],mode)
    assert.equal(farm.island,'grove')
    assert.equal(farm.fruit.pear,0)
    // The grow-and-harvest alternative remains useful, by another explicit action.
    okay(F.pickFruit(farm,0))
    assert.ok(farm.fruit.pear>0)
  }
})

test('local warehouse priority remains a separate withdrawal (legacy stock compatibility control)',async()=>{
  const farm=earnedKitchen()
  okay(sendFerryExpedition(farm,pair));okay(F.endDay(farm))
  // A retained old-save warehouse lot, not claimed to be produced by modern UI.
  farm.freight.warehouses.home.pear=1
  const loaded=cold(farm), before=JSON.stringify(loaded), ui=kitchen(loaded)
  assert.equal(getLocalWarehouseSupply(loaded,pear)?.quantity,1)
  assert.doesNotMatch(ui.html,/К грузу/)
  await ui.choosePear()
  assert.deepEqual(ui.actions,['open:warehouse-supply'])
  assert.equal(JSON.stringify(loaded),before)
})
