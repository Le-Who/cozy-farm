import assert from 'node:assert/strict'
import { test } from 'node:test'
import { recipeWarehouseReturnFixture } from './fixtures/recipe-warehouse-return.ts'
import { getRecipeRepeatGuide } from '../src/recipe-repeat-guidance.ts'
import { getRequirementHint } from '../src/requirement-guidance.ts'
import { getLocalWarehouseSupply, withdrawWarehouseSupply } from '../src/warehouse-guidance.ts'
import { restoreFarm, getCookIngredients, ingredientCount } from '../src/farm.ts'
import { bayProductId } from '../src/bay-product-id.ts'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { runInNewContext } from 'node:vm'

test('exact repeat can return from its local warehouse without crafting or changing the recipe',()=>{
  const {farm,recipeId}=recipeWarehouseReturnFixture(), before=structuredClone(farm)
  const item={kind:'produce',item:'wheat',quantity:1} as const
  assert.equal(getRequirementHint(farm,{kind:'stock',item}).action.target,'warehouse-supply')
  const supply=getLocalWarehouseSupply(farm,item)!
  assert.deepEqual(farm,before)
  assert.ok(getRecipeRepeatGuide(farm,recipeId))
  assert.equal(withdrawWarehouseSupply(farm,item,supply).ok,true)
  const expected=structuredClone(before);expected.produce.wheat=1;expected.freight.warehouses.home.wheat=2
  assert.deepEqual(farm,expected)
  const loaded=restoreFarm(JSON.parse(JSON.stringify(farm)))!;assert.ok(loaded)
  assert.deepEqual(loaded.culinary,before.culinary)
  assert.equal(getRecipeRepeatGuide(loaded,recipeId)!.available,true)
  assert.equal(getRecipeRepeatGuide(loaded,recipeId)!.missing.length,0)
})

test('Back from local supplies restores the same kitchen ingredient or its selected recipe, never a renumbered source',()=>{
  const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
  const part=(from:string,to:string)=>main.slice(main.indexOf(from),main.indexOf(to,main.indexOf(from)))
  const code=stripTypeScriptTypes(part('function requirementLink(','const islandNames')+
    part('function focusKey(','let harbourScene:'))
  for(const take of [0,1,2]){
    const {farm}=recipeWarehouseReturnFixture()
    farm.fruit.apple=0;farm.eggs=0;farm.freight.warehouses.home.apple=take||2
    const recipe='orchardTart', ingredients=getCookIngredients(farm,recipe), apple=ingredients[0]
    assert.equal(getRequirementHint(farm,{kind:'stock',item:apple}).action.target,'warehouse-supply')
    let focused:Control|null=null, buttons:Control[]=[]
    class Control{
      dataset:Record<string,string>; label:string
      constructor(dataset:Record<string,string>,label:string){this.dataset=dataset;this.label=label}
      getClientRects(){return [{}]} focus(){focused=this}
    }
    const selected=new Control({action:'recipe-family',value:recipe},'Фруктовый пирог')
    const content={scrollTop:20,querySelector:(s:string)=>s.includes('recipe-family')&&s.includes('aria-pressed="true"')?selected:null,querySelectorAll:()=>[]}
    const fields='journeyDetailsOpen journalDetailsOpen selectedExpeditionPort selectedExpeditionOffer selectedWarehouseRequest selectedWarehouse freightPlanOpen inventoryGroup boatIsland marketSaleFamily marketSaleQuery marketTab marketCategory marketSellGroup bagTab archiveGroup treeSlot previewSeed specializationBuilding previewSpecialization irrigationMode villageSlot pastryShape workshopRecipe cookingDish cookingFish seedPickerBed signatureBase signatureSlot signatureRepeatId expandedRepeatId cookingMode communityOrderId communityResident requestedFood kitchenPreserves kitchenDish honeyKitchenDish signatureFamily'.split(' ')
    const ctx={...Object.fromEntries(fields.map(k=>[k,undefined])),farm,bayProductId,getBerryNurserySource:()=>undefined,requirementLinks:new Map(),
      document:{get activeElement(){return focused}},HTMLButtonElement:Control,dialog:{open:true,querySelectorAll:()=>buttons},dialogContent:content,
      panel:'kitchen',panelRenderVersion:1,panelHistory:[] as unknown[],signatureSlots:[],recipeBook:{snapshot(){},load(){}},restoreFerryPanelView(){},
      kitchenTart:recipe,kitchenGroup:'tart',requestAnimationFrame:(fn:()=>void)=>fn(),
      openPanel(next:string,remember:boolean){assert.equal(next,'kitchen');assert.equal(remember,false);ctx.panel=next;render()}}
    // One context per navigation; rememberPanel and goBack are the production functions.
    const run=(s:string)=>runInNewContext(s,ctx)
    run(code)
    function render(){
      ctx.requirementLinks.clear();buttons=[selected]
      for(const item of ingredients){
        const id=bayProductId(item), ready=ingredientCount(farm,item)>=item.quantity
        const markup=run(`requirementLink('',${JSON.stringify({kind:'stock',item})},'ingredient',${JSON.stringify(id)},${ready})`) as string
        const match=markup.match(/data-action="(show-requirement)" data-value="(\d+)"/)
        if(match)buttons.push(new Control({action:match[1],value:match[2]},id))
      }
    }
    render();const origin=buttons.find(b=>b.label==='apple')!;origin.focus()
    ctx.panelHistory.push(run('rememberPanel()'));ctx.panel='warehouse-supply';focused=null
    if(take)assert.ok(withdrawWarehouseSupply(farm,apple,getLocalWarehouseSupply(farm,apple)).ok)
    const beforeBack=structuredClone(farm);run('goBack()')
    assert.equal(ctx.panel,'kitchen');assert.equal(ctx.kitchenTart,recipe);assert.equal(ctx.kitchenGroup,'tart')
    assert.equal((focused as Control|null)?.label,take===2?selected.label:'apple')
    if(take===2)assert.ok(buttons.some(b=>b.label==='wheat'&&b.dataset.value===origin.dataset.value),'slot 0 is now wheat')
    assert.deepEqual(farm,beforeBack)
  }
})
