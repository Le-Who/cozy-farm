import A from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes as strip} from 'node:module'
import {runInNewContext as vm} from 'node:vm'
import test from 'node:test'
import * as F from '../src/farm.ts'
import * as R from '../src/neighbor-food-recovery.ts'
import * as W from '../src/warehouse-guidance.ts'
import {getStoredSignature,storedSignatureValue} from '../src/stored-signature.ts'
import {freightPortNames} from '../src/bay-freight-model.ts'
import {neighborHelpStatus} from '../src/neighbor-help.ts'
import {qualityNames} from '../src/intent-orders.ts'
import {isGuardedAction} from '../src/action-click-guard.ts'
import {communityReturnRoute} from '../src/community-return.ts'
import {commissionPlayer} from './fixtures/commission-player.ts'

const id='finn:2',food='dish:orchardTart',storage='village|dish:orchardTart|1|1'
const item={kind:'dishes',item:'orchardTart',quantity:1} as const
const read=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8')
const view=read('../src/community-ui.ts'),main=read('../src/main.ts')
const extract=(src:string,a:string,b:string)=>{const i=src.indexOf(a),j=src.indexOf(b,i+a.length);A.ok(i>=0&&j>i,a);return src.slice(i,j)}
const slice=(a:string,b:string)=>extract(main,a,b)
const html=vm(strip(view.slice(view.indexOf('type Offer =')).replaceAll('export function','function')+';neighborDetail'),
 {...F,...R,...W,getStoredSignature,storedSignatureValue,freightPortNames,neighborHelpStatus,qualityNames}) as Function
const art={icon:()=>'',offerIcon:()=>''}
const card=(f:F.FarmState)=>html(f,'finn',art) as string
function tile(f:F.FarmState) {
 const node=[...card(f).matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].find(([,a])=>a.includes('class="community-food"')&&a.includes('data-value="'+food+'"'))!
 A.ok(node);const caps=Object.fromEntries([...node[1].matchAll(/data-([\w-]+)="([^"]*)"/g)].map(([,k,v])=>[k,v]))
 return {control:{dataset:caps},markup:node[0]}
}
const program=strip(slice('function focusKey(','// The route key')+slice('function currentCommunityRequest()', 'function updateCommunityReturn()')+
 slice('function requestedRecipe()','function startRequestedFood()')+
 '({act:async()=>{switch(action){'+slice("    case 'cook-intent-offer': {","    case 'request-start-cook':")+
 slice("    case 'warehouse-supply-withdraw':","    case 'show-requirement':")+'}},requestedRecipeCard,focusKey})')
const assembly=(kind:'table'|'basket')=>({kind,settled:true,placements:[
 {slot:'food',x:0,y:0},{slot:'cup',x:.42,y:.25},{slot:'flowers',x:-.4,y:.24}]} as const)
function earned(place: 'village'|'grove'|null) {
 const p=commissionPlayer(JSON.parse(read('./fixtures/home-progress-actions.json')))
 p.visit('home');p.act('specializeFarmhouse','preserves')
 p.fruit('apple',1);p.fruit('pear',1);p.visit('home');p.act('cookDish','orchardPreserves')
 p.visit('grove');p.act('catchFish',true);p.act('deliverHarborOrder')
 while(p.state.day<17)p.night()
 p.fruit('apple',1);p.fruit('pear',1);p.visit('grove');p.act('gatherSeaSalt')
 p.visit('home');p.act('cookDish','orchardPreserves');p.act('catchFish',true)
 A.equal(p.actions,128);A.equal(p.state.dishes.orchardTart,1)
 p.act('cookDish','grilledFish',{family:'grilledFish',fishSpecies:'perch',fruit:[],
   garnish:[{ingredientId:'carrot',x:.2,y:.1,angle:0}],baking:{method:'grill',finish:'golden',seconds:5},
   steps:['season-fish','grill-first-side','turn-fish','grill-second-side','plate-fish','arrange-carrot']})
 p.visit('village');p.act('joinNeighborPlan','finn:1');p.act('serveNeighborPlan','finn:1','dish:grilledFish')
 p.act('finishNeighborPlan','finn:1',assembly('basket'))
 if(place){p.visit(place);p.act('transferBayGoods','deposit',place,food,1)}
 p.night();p.visit('village');p.act('advanceNeighborPlan','finn:1');p.act('joinNeighborPlan',id)
 A.deepEqual([p.actions,p.state.day,p.state.island,p.state.coins,p.state.dishes.orchardTart,p.state.produce.wheat,p.state.fruit.apple,p.state.eggs],
  [place==='village'?139:place==='grove'?140:138,18,'village',102,place?0:1,0,1,3])
 return p
}
function mount(farm:F.FarmState,entry=tile(farm).control) {
 const opened:string[]=[],writes:F.FarmState[]=[]
 const selected={kind:'neighbor',resident:'finn',planId:id}
 const ui={...F,...R,...W,communityReturnRoute,farm,panel:'neighbor',communityResident:'finn',communityRequest:selected,
  action:entry.dataset.action,value:food,control:entry,valid:true,crossing:false,
  dialog:{open:true},dialogContent:{contains:(c:unknown)=>ui.valid&&c===entry},
  island:{isCrossing:()=>ui.crossing},selectedWarehouseRequest:undefined as F.StockItem|undefined,requestedFood:undefined,
  openPanel:(panel:string)=>{opened.push(panel);ui.panel=panel},
  perform(fn:()=>F.ActionResult){const r=fn();if(r.ok)writes.push(structuredClone(farm));return r.ok},
  drawPanel(){},bayAudio:{playEvent(){}},recipeDestination:()=> 'village',
  selectedDailyIntent:()=>undefined,renderIntentDeadline:()=>'',communityArt:art,escapeHtml:String,
  stockTile:(input:F.StockItem)=>`<li>${F.marketKey(input)}</li>`,getRequestedBeaBatch:()=>undefined,
  nav:(x:string)=>x,button:(name:string,action:string)=>`<button data-action="${action}">${name}</button>`,
 }
 return {ui,opened,writes,...vm(program,ui)}
}

test('earned second Finn invitation points to the exact finished pie already stored on this same island',async t=>{
 const p=earned('village'),f=p.state,before=structuredClone(f),display=tile(f)
 const plan=F.getNeighborPlans(f).find(x=>x.id===id)!
 A.deepEqual([plan.phase,plan.food,plan.episode],['joined',null,'finnLantern'])
 A.equal(R.getNeighborFoodRecovery(f,id),undefined,'the already-selected path is not this joined invitation')
 A.equal(F.getCookAction(f,'orchardTart').available,false)
 A.equal(W.getLocalWarehouseSupply(f,item)?.quantity,1)
 const x=mount(f,display.control)
 if(display.control.dataset.action==='cook-intent-offer'){
  await x.act()
  A.deepEqual(x.opened,['request-food'], 'stock follows a second-cook preview')
  A.match(x.requestedRecipeCard(),/Найти ингредиенты/)
  A.match(x.requestedRecipeCard(),/fruit:apple.*produce:wheat/)
  t.diagnostic('stock second-cook preview asks for apple and wheat while the exact pie sits here, in Village')
 }
 A.deepEqual(f,before);A.deepEqual(x.writes,[])
 A.equal(display.control.dataset.action,'neighbor-joined-warehouse')
 A.equal(display.control.dataset.storage,storage);A.match(display.markup,/На складе: 1\. К складу/)
 A.equal(isGuardedAction('neighbor-joined-warehouse'),true)
 await x.act()
 A.deepEqual(x.opened,['warehouse-supply']);A.deepEqual(x.ui.selectedWarehouseRequest,item)
 A.equal(x.ui.requestedFood,undefined);A.deepEqual(f,before);A.deepEqual(x.writes,[])
 const live=tile(f).control
 A.equal(x.focusKey(live),x.focusKey(display.control))
 x.ui.action='warehouse-supply-withdraw';x.ui.value=storage
 await x.act();await x.act()
 const reopened=tile(f).control
 A.equal(reopened.dataset.action,'choose-neighbor-food')
 A.equal(x.focusKey(reopened),x.focusKey(display.control),'Back can focus the exact newly carried choice')
 A.deepEqual([f.day,f.island,f.coins,f.dishes.orchardTart,f.freight.warehouses.village[food]??0,f.neighbors.finn.current?.phase],
  [18,'village',102,1,0,'joined'])
 A.equal(x.writes.length,1);A.deepEqual(f.neighbors,before.neighbors)
 A.ok(F.serveNeighborPlan(f,id,food).ok)
 A.equal(f.coins,102)
 A.ok(F.finishNeighborPlan(f,id,assembly('table')).ok)
 A.deepEqual([f.day,f.island,f.coins,f.dishes.orchardTart,f.neighbors.finn.completed],[18,'village',139,0,2])
})

test('ordinary carried and other-shore stock stay distinct; stale / wrong controls never take an item or change plan',async()=>{
 const carried=earned(null),remote=earned('grove')
 A.equal(tile(carried.state).control.dataset.action,'choose-neighbor-food')
 A.equal(tile(remote.state).control.dataset.action,'cook-intent-offer')
 A.equal(W.getLocalWarehouseSupply(remote.state,item),undefined)
 const p=earned('village'),f=p.state,real=tile(f).control
 for(const bad of ['wrong-neighbor','offshore','detached','crossing','wrong-stock','no-longer-joined'] as const){
  const next=structuredClone(f),control=structuredClone(real),x=mount(next,control)
  if(bad==='wrong-neighbor')x.ui.communityResident='bea'
  if(bad==='offshore')A.ok(F.sail(next,'grove').ok)
  if(bad==='detached')x.ui.valid=false
  if(bad==='crossing')x.ui.crossing=true
  if(bad==='wrong-stock')control.dataset.storage='village|dish:blueberryTart|1|1'
  if(bad==='no-longer-joined'){
   A.ok(W.withdrawWarehouseSupply(next,item,W.warehouseConfirmation(storage)).ok)
   A.ok(F.serveNeighborPlan(next,id,food).ok)
  }
  const before=structuredClone(next)
  await x.act()
  A.deepEqual(x.opened,[],bad);A.deepEqual(x.writes,[],bad);A.deepEqual(next,before,bad)
 }
})

test('a stored pie does not replace the ordinary cooking choice once ordinary farm ingredients are genuinely ready',async()=>{
 const p=earned('village')
 p.visit('home')
 if(!p.state.seeds.wheat)p.act('buySeeds','wheat')
 if(p.state.selectedSeed!=='wheat')p.act('selectSeed','wheat')
 const bed=p.state.beds.findIndex((_,i)=>F.getBedAction(p.state,i).kind==='plant')
 A.ok(bed>=0)
 p.act('workBed',bed)
 for(let days=0;days<5&&F.getBedAction(p.state,bed).kind!=='harvest';days++){
  if(F.getBedAction(p.state,bed).kind==='water'){
   if(!p.state.water)p.act('refillWater')
   p.act('workBed',bed)
  }
  p.night()
 }
 A.equal(F.getBedAction(p.state,bed).kind,'harvest')
 p.act('workBed',bed);p.fruit('apple',2);p.visit('village')
 const farm=p.state
 A.equal(farm.neighbors.finn.current?.phase,'joined')
 A.ok(F.getCookAction(farm,'orchardTart').available)
 A.equal(W.getLocalWarehouseSupply(farm,item)?.quantity,1)
 const choice=tile(farm)
 A.equal(choice.control.dataset.action,'cook-intent-offer')
 A.match(choice.markup,/\. В запасе: 0\. Приготовить/)
 const before=structuredClone(farm),x=mount(farm,choice.control)
 await x.act()
 A.deepEqual(x.opened,['request-food'])
 A.match(x.requestedRecipeCard(),/data-action="request-start-cook"/)
 A.deepEqual(farm,before);A.deepEqual(x.writes,[])
})
