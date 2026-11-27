import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import * as F from '../src/farm.ts'
import { communityReturnRoute } from '../src/community-return.ts'
import { qualityNames } from '../src/intent-orders.ts'
import { assortmentPlayer } from './fixtures/assortment-player.ts'

const read=(p:string)=>readFileSync(new URL(p,import.meta.url),'utf8')
const main=read('../src/main.ts')
const between=(source:string,a:string,b:string)=>{
  const i=source.indexOf(a),j=source.indexOf(b,i+a.length)
  assert.ok(i>=0&&j>i,a)
  return source.slice(i,j)
}
const section=(a:string,b:string)=>between(main,a,b)
const ui=read('../src/community-ui.ts')
const neighborDetail=runInNewContext(stripTypeScriptTypes(
  between(ui,'const escape =','export function neighborHelpCard')
  +between(ui,'function offerChoices','export function communityBoard')
  +between(ui,'export function neighborDetail','export function neighborPlanLinks').replace('export ','')
  +'\nneighborDetail'
),{qualityNames,getNeighborPlans:F.getNeighborPlans,getIntentOffers:F.getIntentOffers,neighborHelpCard:()=>''})
const actions=section("    case 'open-neighbor':","    case 'neighbor-help-house':")
  +section("    case 'join-neighbor':","    case 'choose-neighbor-food':")
  +section("    case 'cook-intent-offer':","    case 'request-start-cook':")
  +section("    case 'back':","    case 'journal-stay':")
  +section("    case 'open-panel':", "    case 'harbour-view':").split('\n')[0]+'\n'
  +section("    case 'village-slot':","    case 'invite-resident':")
  +section("    case 'resume-community': await resumeCommunityRequest","    case 'signature-base':").split('\n')[0]+'\n'
const pushVisit=section('  if(remember&&next!==panel)',"  if (remember && next === 'village-meal'")
const nav=section("    if (control.closest('.dialog-destinations'))","  if (control.dataset.tool")
const program=stripTypeScriptTypes(
  section('function currentCommunityRequest()','function updateCommunityReturn()')
  +section('async function resumeCommunityRequest(','function requestedRecipeCard()')
  +section('function focusKey(','let harbourScene:')
  +`
  function openPanel(next,remember=true){${pushVisit}panel=next;panelRenderVersion++;dialogContent.scrollTop=0}
  async function activate(action,value,control,event){switch(action){${actions}}}
  function openMap(next,control){if(control.dataset.panel){${nav}}
  `
)
const openings=JSON.parse(read('./fixtures/home-progress-actions.json'))
const art={icon:()=>'',offerIcon:()=>''}
function atBeaRecipe() {
  const {p,tart}=assortmentPlayer(openings)
  const farm=p.state
  assert.deepEqual([p.actions,farm.day,farm.island,farm.village.residents,farm.culinary.stock[tart]??0],
    [200,25,'village',['bea','finn'],0])
  const initial=F.getNeighborPlans(farm)
  assert.deepEqual(initial.map(plan=>[plan.id,plan.phase]),[['bea:1','preparing'],['finn:1','preparing']])
  let writes=0
  const state:Record<string,any>={...F,farm,communityReturnRoute,
    panel:'village',villageSlot:0,panelHistory:[],panelRenderVersion:0,communityResident:'bea',
    communityResume:{}, // The separate HUD shortcut is not the recipe card button.
    dialog:{open:true,querySelectorAll:()=>[]},dialogContent:{querySelector:()=>null,querySelectorAll:()=>[],scrollTop:0},
    document:{activeElement:null},HTMLButtonElement:class {},recipeBook:{snapshot:()=>({}),load:()=>{}},
    signatureSlots:[null,null],panelTitles:{village:'Соседи'},drawPanel:()=>{},
    requestAnimationFrame:(resolve:()=>void)=>resolve(),restoreFerryPanelView:()=>{},
    closeContextualSale:()=>false,returnToRecipeIndex:()=>false,
    island:{isCrossing:()=>false,crossIsland:()=>assert.fail('local navigation cannot sail')},
    saveFarm:()=>assert.fail('local navigation cannot write the v7 farm'),
    perform(job:()=>{ok:boolean;message:string}) { const result=job();assert.ok(result.ok,result.message);writes++;return true },
  }
  for (const name of 'selectedWarehouseRequest selectedExpeditionPort selectedExpeditionOffer selectedWarehouse inventoryGroup boatIsland marketSaleFamily marketSaleQuery marketTab marketCategory marketSellGroup bagTab archiveGroup treeSlot previewSeed specializationBuilding previewSpecialization irrigationMode pastryShape workshopRecipe cookingDish cookingFish signatureBase signatureSlot signatureRepeatId expandedRepeatId cookingMode communityOrderId communityRequest requestedFood kitchenTart kitchenPreserves kitchenGroup kitchenDish honeyKitchenDish signatureFamily seedPickerBed freightPlanOpen journeyDetailsOpen journalDetailsOpen selectedMarketOrder'.split(' ')) state[name]??=undefined
  runInNewContext(program,state)
  const act=(action:string,value?:string,dataset:Record<string,string>={})=>state.activate(action,value,{dataset},{detail:0})
  const recipe=async()=>{
    await act('open-neighbor','bea')
    assert.match(neighborDetail(farm,'bea',art),/data-action="join-neighbor" data-value="bea:1"/)
    await act('join-neighbor','bea:1')
    const offer='signature:'+tart
    assert.ok(neighborDetail(farm,'bea',art).includes('data-action="cook-intent-offer" data-value="'+offer+'" data-plan="bea:1"'))
    await act('cook-intent-offer',offer,{plan:'bea:1'})
    assert.ok(state.requestedRecipe().offer.eligible)
    state.dialogContent.scrollTop=61
    return offer
  }
  const map=()=>state.openMap('guide',{dataset:{panel:'guide'},closest:()=>true})
  const peekFinn=async()=>{
    map()
    await act('open-panel','village')
    await act('village-slot','1')
    assert.equal(state.villageSlot,1)
    await act('open-neighbor','finn')
    assert.match(neighborDetail(farm,'finn',art),/Обед у воды/)
    assert.equal(state.communityRequest.planId,'finn:1')
  }
  return {farm,tart,state,act,recipe,map,peekFinn,get writes(){return writes}}
}

test('earned two homes: local Back restores the exact Bea preview only when it reaches that view',async()=>{
  const t=atBeaRecipe(), selected=await t.recipe(),before=JSON.stringify(t.farm)
  assert.equal(t.writes,1,'only the ordinary invitation join happens before the read-only tour')
  await t.peekFinn()
  for(const panel of ['village','guide']){
    await t.act('back')
    assert.deepEqual([t.state.panel,t.state.communityRequest.planId],[panel,'finn:1'])
  }
  await t.act('back')
  assert.deepEqual([t.state.panel,t.state.requestedFood,t.state.dialogContent.scrollTop],['request-food',selected,61])
  assert.equal(t.state.communityRequest.planId,'bea:1')
  assert.ok(t.state.requestedRecipe().offer.eligible)
  await t.act('resume-community')
  assert.deepEqual([t.state.panel,t.state.communityResident,t.state.communityRequest.planId],['neighbor','bea','bea:1'])
  assert.equal(t.writes,1);assert.equal(JSON.stringify(t.farm),before)
})

test('ordinary local map Back without another request retains the exact recipe and scroll',async()=>{
  const t=atBeaRecipe(),selected=await t.recipe(), before=JSON.stringify(t.farm)
  t.map();await t.act('back')
  assert.deepEqual([t.state.panel,t.state.communityRequest.planId,t.state.requestedFood,t.state.dialogContent.scrollTop],
    ['request-food','bea:1',selected,61])
  assert.equal(t.writes,1);assert.equal(JSON.stringify(t.farm),before)
})

test('old preview will not revive an obsolete episode, missing recipe or another-shore visit',async()=>{
  // These deliberately stale metadata cases protect the boundary; no invented progression.
  for (const stale of ['plan','recipe','shore']) {
    const t=atBeaRecipe();await t.recipe();await t.peekFinn()
    const preview=t.state.panelHistory.find((v:{panel:string})=>v.panel==='request-food')
    assert.ok(preview.neighborRecipeOrigin)
    if(stale==='plan') preview.neighborRecipeOrigin={...preview.neighborRecipeOrigin,request:{kind:'neighbor',resident:'bea',planId:'bea:999'}}
    if(stale==='recipe') preview.requestedFood='signature:retired'
    if(stale==='shore') preview.neighborRecipeOrigin={...preview.neighborRecipeOrigin,island:'home'}
    const untouched=JSON.stringify(t.farm)
    for(let i=0;i<3;i++)await t.act('back')
    assert.deepEqual([t.state.panel,t.state.requestedFood,t.state.communityRequest.planId,t.farm.island],
      [stale==='shore'?'guide':'neighbor',undefined,'finn:1','village'])
    assert.equal(t.writes,1);assert.equal(JSON.stringify(t.farm),untouched)
    if(stale!=='shore')assert.equal(t.state.communityResident,'bea')
  }
})
