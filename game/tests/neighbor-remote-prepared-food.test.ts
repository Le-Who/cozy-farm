import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import {runInNewContext} from 'node:vm'
import {test} from 'node:test'
import * as farmApi from '../src/farm.ts'
import {freightPortNames} from '../src/bay-freight-model.ts'
import * as intentApi from '../src/intent-orders.ts'
import * as recoveryApi from '../src/neighbor-food-recovery.ts'
import * as helpApi from '../src/neighbor-help.ts'
import {renderIntentDeadline} from '../src/intent-deadline.ts'
import {communityReturnRoute} from '../src/community-return.ts'
import * as storeApi from '../src/stored-signature.ts'
import {commissionPlayer} from './fixtures/commission-player.ts'

const read=(name:string)=>readFileSync(new URL(name,import.meta.url),'utf8')
const shell=read('../src/main.ts')
const render=read('../src/community-ui.ts')
const cut=(code:string,first:string,last:string) => {
  const i=code.indexOf(first),j=code.indexOf(last,i+first.length)
  assert.ok(i>=0&&j>i)
  return code.slice(i,j)
}
const view=runInNewContext(stripTypeScriptTypes(render.slice(render.indexOf('type Offer =')).replaceAll('export function','function')+';neighborDetail'),
  {...farmApi,...intentApi,...recoveryApi,...helpApi,...storeApi,renderIntentDeadline,freightPortNames})
const actions=JSON.parse(read('./fixtures/home-progress-actions.json'))
const last=actions.findLastIndex((a:{name:string})=>a.name==='serveVillageMeal')
const plan='bea:1', food='signature:s1', quote='grove|s1|1'
const meeting={kind:'neighbor',resident:'bea',planId:plan}
const table={kind:'table',settled:true,placements:[{slot:'food',x:0,y:0},{slot:'cup',x:-.5,y:.2},{slot:'flowers',x:.5,y:-.2}]} as const
function replay() {
  const p=commissionPlayer(actions.slice(0,last+1))
  p.fruit('apple',3);p.fruit('pear',3);p.visit('village')
  assert.equal(p.act('completeSignature',{base:'preserves',ingredients:[{id:'apple',quantity:1},{id:'pear',quantity:1}]},
    {family:'preserves',processing:'silky',fruit:[],steps:['mix','pour']}).recipeId,'s1')
  p.act('repeatSignature','s1')
  p.act('joinNeighborPlan',plan);p.act('serveNeighborPlan',plan,food)
  p.visit('grove');p.act('transferBayGoods','deposit','grove',food,1)
  p.visit('home');p.act('sellSignature','s1',1);p.visit('village')
  assert.deepEqual([p.actions,p.state.day,p.state.coins,p.state.fruit.apple,p.state.fruit.pear,p.state.culinary.stock.s1,p.state.freight.warehouses.grove[food]],[126,16,87,1,1,0,1])
  return p
}
const renderBea=(f:farmApi.FarmState)=>view(f,'bea',{icon:()=>'<img alt="">',offerIcon:()=>'<img alt="">'})
test('earned tea offers the actual ready Grove serving before an explicit repeat, keeping the other foods',()=>{
  const p=replay(), before=structuredClone(p.state),html=renderBea(p.state)
  const primary=html.match(/<button[^>]*data-action="neighbor-stored-food"[^>]*>К складу: Солёная роща<\/button>/)?.[0]
  assert.ok(primary&&primary.includes('data-food="signature:s1"')&&primary.includes('data-storage="grove|s1|1"'),'owned serving before repeat')
  assert.match(html,/class="dialog-button community-button secondary" data-action="neighbor-repeat-food"[^>]*>Повторить точно ×1/)
  assert.ok(html.indexOf(primary)<html.indexOf('data-action="neighbor-repeat-food"'))
  assert.doesNotMatch(html,/угощение закончилось|data-action="arrange-neighbor"/i)
  assert.match(html,/<details class="community-alternatives" ><summary>Выбрать другое угощение/)
  assert.deepEqual(p.state,before)
})
const program=stripTypeScriptTypes(
  cut(shell,'function currentCommunityRequest()','function updateCommunityReturn()')+
  cut(shell,'async function resumeCommunityRequest(','function requestedRecipe()')+
  cut(shell,'async function visitPanelAt(','function openGuidedMarket(')+
  cut(shell,'function openRecipeBook(','function updateRecipeBookSearch(')+
  '({step:async(action:string)=>{switch(action){'+cut(shell,"    case 'neighbor-stored-food':","    case 'neighbor-shelf-food':")+
  cut(shell,"    case 'recipe-warehouse-withdraw':","    case 'make-signature':")+
  cut(shell,"    case 'resume-community':","    case 'intent-own-recipe':")+'}},resumeCommunityRequest,currentCommunityRoute})'
)
function mount(farm:farmApi.FarmState) {
  const events:unknown[]=[]
  const ctx = {
    ...farmApi,...recoveryApi,...storeApi,communityReturnRoute,farm,
    communityRequest:undefined as undefined|typeof meeting,communityResident:'bea',requestedFood:undefined as undefined|string,
    panel:'neighbor',dialog:{open:true},value:plan,
    control:{dataset:{food,storage:quote}},dialogContent:{contains:(control:unknown)=>control===ctx.control},
    communityResume:{},panelHistory:[] as unknown[],
    fieldViewButton:{getAttribute:()=> 'false'},island:{isCrossing:()=>false,crossIsland:async(f:()=>unknown)=>f()},
    drawPanel:()=>events.push('redraw'),rememberPanel:()=>({panel:ctx.panel}),closeDialog(){ctx.dialog.open=false;ctx.panel=''},
    openPanel:(panel:string,_remember?:boolean,_port?:string,_cue?:string,recipe?:string)=>{
      ctx.panel=panel;ctx.dialog.open=true;events.push(['open',panel,recipe??null])
    },
    perform:(fn:()=>{ok:boolean})=>fn().ok,focusRecipeAction:(withdraw:boolean)=>events.push(['focus',withdraw]),
    bayAudio:{playEvent:()=>events.push('withdraw-confirmation')}
  }
  return {ctx,events,api:runInNewContext(program,ctx)}
}
test('owned serving route uses the real crossing, recipe book, withdrawal and existing exact meeting return',async()=>{
  const p=replay(), farm=structuredClone(p.state),{api,ctx,events}=mount(farm)
  const before=structuredClone(farm)
  await api.step('neighbor-stored-food')
  assert.deepEqual(events,[['open','recipes','s1'],['focus',true]])
  assert.deepEqual(farm,{...before,island:'grove'},'route open does not withdraw, cook, pay, or arrange')
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.communityRequest)),meeting)
  // Close without collecting; the ordinary HUD gives an explicit crossing to the same unfinished plan.
  ctx.closeDialog()
  assert.equal(api.currentCommunityRoute('recipe').label,'К встрече в гавани')
  await api.resumeCommunityRequest('recipe')
  assert.deepEqual(farm,before)
  assert.deepEqual(events.at(-1),['open','neighbor',null])
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.communityRequest)),meeting)
  await api.step('neighbor-stored-food')
  ctx.value=quote
  await api.step('recipe-warehouse-withdraw')
  assert.equal(farm.culinary.stock.s1,1)
  assert.equal(farm.freight.warehouses.grove[food],undefined)
  assert.equal(farm.coins,87)
  assert.deepEqual(farm.neighbors,before.neighbors)
  const once=structuredClone(farm)
  await api.step('recipe-warehouse-withdraw')
  assert.deepEqual(farm,once)
  ctx.closeDialog(); await api.resumeCommunityRequest('recipe')
  assert.equal(farm.island,'village')
  assert.match(renderBea(farm),/data-action="arrange-neighbor"/)
  assert.ok(farmApi.finishNeighborPlan(farm,plan,table).ok)
  assert.deepEqual([farm.day,farm.coins,farm.fruit.apple,farm.fruit.pear,farm.culinary.stock.s1,farm.neighbors.bea.completed],[16,118,1,1,0,1])
  const paid=structuredClone(farm)
  assert.equal(farmApi.finishNeighborPlan(farm,plan,table).ok,false)
  assert.deepEqual(farm,paid)
})
test('stock races and stale controls refuse travel; actual local stock and intentional repeat still work',async()=>{
  const stock=replay().state
  {
    const p=replay()
    p.visit('grove');p.act('transferBayGoods','withdraw','grove',food,1)
    p.visit('village');p.act('transferBayGoods','deposit','village',food,1)
    const html=renderBea(p.state)
    assert.match(html,/К готовой порции на складе/)
    assert.doesNotMatch(html,/data-storage|neighbor-repeat-food/)
  }
  for(const mutation of ['count','food','origin','panel','resident','stale','empty'] as const){
    const farm=structuredClone(stock),{api,ctx}=mount(farm)
    if(mutation==='count')ctx.control.dataset.storage='grove|s1|2'
    if(mutation==='food')ctx.control.dataset.food='signature:s2'
    if(mutation==='origin')ctx.dialogContent.contains=()=>false
    if(mutation==='panel')ctx.panel='intent'
    if(mutation==='resident')ctx.communityResident='finn'
    if(mutation==='stale')ctx.value='bea:2'
    if(mutation==='empty'){
      assert.ok(farmApi.sail(farm,'grove').ok)
      assert.ok(storeApi.withdrawStoredSignature(farm,quote).ok)
      assert.ok(farmApi.useSignature(farm,'s1').ok)
      assert.ok(farmApi.sail(farm,'village').ok)
      assert.doesNotMatch(renderBea(farm),/data-storage/)
    }
    const before=structuredClone(farm)
    await api.step('neighbor-stored-food')
    assert.deepEqual(farm,before,mutation)
    assert.equal(ctx.communityRequest,undefined)
  }
  const p=replay()
  assert.ok(recoveryApi.repeatNeighborFood(p.state,plan).ok)
  p.reload()
  p.act('finishNeighborPlan',plan,table)
  assert.deepEqual([p.state.coins,p.state.fruit.apple,p.state.fruit.pear,p.state.freight.warehouses.grove[food]],[118,0,0,1])
})
