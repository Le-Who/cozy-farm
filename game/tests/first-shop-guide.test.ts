import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import test from 'node:test'
import { createContext, runInContext, runInNewContext } from 'node:vm'
import * as F from '../src/farm.ts'
import { getDiscoveryTask } from '../src/discovery-path.ts'
import { getDiscoveryJournal } from '../src/discovery-journal.ts'
import { getGuidanceTask } from '../src/discovery-guidance.ts'
import { renderDiscoveryGuidance } from '../src/discovery-preferences-ui.ts'
import { inviteNeighborVisit } from '../src/neighbor-visits.ts'
import { reserveShopGoods } from '../src/harbour-economy.ts'
import { advanceBayShop, setBayShopOpen, setBayShopPrice, stockBayShop } from '../src/bay-shop-model.ts'
import { describeFood } from '../src/intent-orders.ts'
import { renderShopRest } from '../src/shop-rest.ts'
import { commissionPlayer } from './fixtures/commission-player.ts'

const read = (p:string) => readFileSync(new URL(p,import.meta.url),'utf8')
const source = read('../src/main.ts')
const part = (a:string,b:string) => {
  const first=source.indexOf(a), end=source.indexOf(b,first+a.length)
  assert.ok(first>=0&&end>first,a);return source.slice(first,end)
}
const assembly = stripTypeScriptTypes(
  part('function openPanel(next:', '  hiveFlower = next') + ' showPanel(next) }'
  + 'async function press(control) { let {action,value}=control.dataset;'
  + part("  if (action === 'follow-task') {", "  switch (action) {")
  + 'switch(action){'
  + part("    case 'journal-stay': {","    case 'harbour-view':")
  + part("    case 'sail': {","    case 'store-tree': {")
  + '}}'
)
const renderActivities=stripTypeScriptTypes(
 part('${journal.activities.map(','}).join(\'\')}</nav>').slice(2)+"}).join('')"
)
const opening=JSON.parse(read('./fixtures/market-order-selection-commands.json')).slice(0,-1)
function earned(){
 const p=commissionPlayer(opening), f=p.state
 assert.deepEqual([p.actions,f.day,f.island,f.coins,f.dishes.orchardTart,f.bayShop.sold,f.neighbors.bea.completed], [118,14,'home',99,1,0,1])
 return p
}

type Start='hud'|'journal'
function mount(farm:F.FarmState,entry:Start){
 const panels:string[]=[],effects:string[]=[]
 const task=()=>getGuidanceTask(farm.discoveryPreferences,getDiscoveryTask(farm,farm.orientation))
 const journal=()=>getDiscoveryJournal(farm)
 assert.ok(source.includes("taskCard.dataset.action = 'follow-task'"),'HUD uses the same actual task activation')
 const summary={scrollIntoView(){},focus(){effects.push('focus:shop-choice')}}
 const details={open:false,querySelector:(s:string)=>s==='summary'?summary:null}
 const markup=()=>runInNewContext(renderActivities,{journal:journal(),icon:()=>''}) as string
 const ctx={
  ...F,farm,currentTask:task,panel:entry==='journal'?'journal':undefined as string|undefined,
  dialog:{open:entry==='journal'},salePresentation:{},panelTitles:{'bay-shop':'Своя лавка',rest:'Отдых'},
  closeDialog(){ ctx.dialog.open=false;ctx.panel=undefined },
  perform(fn:()=>F.ActionResult){const r=fn();if(r.ok)effects.push('sail-save');return r.ok},
  island:{isCrossing:()=>false,async crossIsland(work:()=>boolean){assert.ok(work())}},
  fieldViewButton:{getAttribute:()=> 'false'},fieldLayout:{matches:false},canvas:{focus(){effects.push('canvas-focus')}},
  dialogContent:{contains:(node:unknown)=>node===details||!!node,
   querySelector:(s:string)=>s.includes('details.journal-visit-crossing')&&s.includes('journal-shop')
    &&ctx.panel==='journal'&&markup().includes('data-action="journal-shop" data-value="bay-shop" data-visit=')?details:null},
  showPanel(id:string){ctx.panel=id; ctx.dialog.open=true; panels.push(id)},
  async visitPanelAt(destination:F.IslandId,id:string){
   if(farm.island!==destination)assert.ok(ctx.perform(()=>F.sail(farm,destination)))
   ctx.showPanel(id)
  },
 }
 const context=createContext(ctx);runInContext(assembly,context)
 const press=(action:string,value?:string,visit?:string)=>{
  context.control={dataset:{action,value,visit},closest:(s:string)=>s==='details.journal-visit-crossing[open]'&&details.open?details:null}
  return runInContext('press(control)',context)
 }
 const render=()=>renderDiscoveryGuidance(farm.discoveryPreferences,task(),task()).focus
 return {ctx,details,markup,task,render,panels,effects,
  async follow(){if(entry==='journal')assert.match(render(),/data-action="follow-task"/);await press('follow-task')},
  stay:()=>press('journal-stay'), sail:(serial:string)=>press('journal-shop','bay-shop',serial)}
}

test('the earned first-shop HUD and Journal activity both review existing Stay/Sail before ending a Home visit',async()=>{
 for(const origin of ['hud','journal'] as const){
  const p=earned(), f=p.state
  assert.ok(inviteNeighborVisit(f,'beaFlock').ok);p.reload()
  const live=p.state, before=JSON.stringify(live), view=mount(live,origin)
  assert.match(view.markup(),/Беа вернётся в гавань, если отплыть/)
  assert.equal(view.task()?.id,'first-shop')
  await view.follow()
  assert.ok(JSON.stringify(live)===before,'following the task may not sail, dismiss Bea, or save')
  assert.deepEqual(view.panels,origin==='hud'?['journal']:[])
  assert.equal(view.details.open,true)
  assert.deepEqual(view.effects,['focus:shop-choice'])
  await view.stay()
  assert.equal(view.details.open,false);assert.equal(JSON.stringify(live),before)
  await view.follow()
  await view.sail('2')
  assert.equal(JSON.stringify(live),before,'another visit cannot authorize sailing')
  await view.sail('1')
  assert.equal(view.panels.at(-1),'bay-shop')
  assert.deepEqual([live.island,live.day,live.neighborVisits.active,live.coins,live.dishes.orchardTart,live.bayShop.sold],['village',14,null,99,1,0])
  assert.equal(view.effects.filter(e=>e==='sail-save').length,1)
 }
})

test('without a guest the current first shop cue lands in the real shop and a local cue does not cross',async()=>{
 const p=earned(), f=p.state, view=mount(f,'hud')
 await view.follow()
 assert.deepEqual(view.panels,['bay-shop'])
 assert.deepEqual([f.island,f.day,f.coins,f.dishes.orchardTart,f.bayShop.open,f.bayShop.sold],['village',14,99,1,false,0])
 assert.deepEqual(view.effects,['sail-save'])
 const local=mount(f,'journal');await local.follow()
 assert.deepEqual(local.panels,['bay-shop']);assert.deepEqual(local.effects,[]);assert.equal(f.island,'village')
})

function stockedAtHome(open:boolean,price=25){
 const p=earned();p.visit('village');const f=p.state
 const food=F.foodDescriptors(f).find(x=>x.id==='dish:orchardTart'&&x.count===1)!
 assert.ok(reserveShopGoods(f,food.id,1))
 assert.ok(stockBayShop(f.bayShop,0,{id:food.id,identity:food.id,name:food.name,image:'/art/lavender/ui-tart.webp',
  basePrice:food.sellPrice,tags:[...food.ingredients,...describeFood(food)]},1))
 assert.ok(setBayShopPrice(f.bayShop,0,price))
 if(open){
  setBayShopOpen(f.bayShop,true)
  for(let ticks=0;!f.bayShop.visitor&&ticks<15;ticks++)assert.deepEqual(advanceBayShop(f.bayShop,100),[])
  assert.deepEqual([f.bayShop.visitor?.id,f.bayShop.visitor?.outcome],['bea',null])
 }
 p.visit('home');return p
}
test('only an already opened shelf with actual overnight sale routes Home to the existing Rest preview',async()=>{
 const p=stockedAtHome(true), f=p.state
 assert.ok(inviteNeighborVisit(f,'beaFlock').ok)
 const before=JSON.stringify(f), view=mount(f,'journal')
 assert.equal(F.getShopRestForecast(f).revenue,25)
 assert.match(renderShopRest(f),/Выручка: 25 монет/)
 await view.follow()
 assert.deepEqual(view.panels,['rest'])
 assert.equal(JSON.stringify(f),before)
 assert.deepEqual(view.effects,[])
 p.act('endDay')
 assert.deepEqual([p.state.day,p.state.island,p.state.coins,p.state.bayShop.sold,p.state.bayShop.slots[0]?.quantity],[15,'home',124,1,0])
 p.act('endDay');assert.equal(p.state.coins,124)
 for(const state of [stockedAtHome(false).state,stockedAtHome(true,999).state]){
  assert.equal(F.getShopRestForecast(state).revenue,0)
  const control=mount(state,'hud');await control.follow()
  assert.deepEqual(control.panels,['bay-shop'])
  assert.deepEqual([state.island,state.coins,state.bayShop.sold,state.bayShop.slots[0]?.quantity],['village',99,0,1])
 }
})
