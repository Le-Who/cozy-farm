import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import {runInNewContext} from 'node:vm'
import test from 'node:test'
import * as F from '../src/farm.ts'
import * as S from '../src/bay-shop-model.ts'
import * as H from '../src/harbour-economy.ts'
import * as I from '../src/intent-orders.ts'
import * as G from '../src/requirement-guidance.ts'
import * as Fruit from '../src/festival-fruit.ts'
import * as R1 from '../src/festival-harvest-route.ts'
import * as R2 from '../src/festival-shore-route.ts'
import * as R3 from '../src/festival-fishing-route.ts'
import * as R4 from '../src/festival-cargo-route.ts'
import {ruCount} from '../src/ru.ts'
import {commissionPlayer} from './fixtures/commission-player.ts'

const read=(p:string)=>readFileSync(new URL(p,import.meta.url),'utf8')
const story=JSON.parse(read('./fixtures/home-progress-actions.json'))
function earnedTreat(loadApples=true) {
 const p=commissionPlayer(story)
 assert.deepEqual([p.actions,p.state.day,p.state.island,p.state.coins,p.state.dishes.orchardTart,p.state.bayShop.sold],[107,14,'village',68,1,0])
 const act=(name:string,...args:unknown[])=>p.act(name,...args)
 const visit=(island:string)=>{if(p.state.island!==island)act('sail',island)}
 const night=()=>{visit('home');act('endDay')}
 function apple(need:number){
  for(let i=0;p.state.fruit.apple<need;i++){
   assert.ok(i<10);visit('home')
   if(F.getTreeAction(p.state,0).kind==='pick')act('pickFruit',0);else night()
  }
 }
 const food=F.foodDescriptors(p.state).find(x=>x.id==='dish:orchardTart'&&x.count===1)
 assert.ok(food&&H.reserveShopGoods(p.state,food.id,1))
 assert.ok(S.stockBayShop(p.state.bayShop,0,{id:food.id,identity:food.id,name:food.name,image:'/art/lavender/ui-tart.webp',basePrice:food.sellPrice,tags:[...food.ingredients,...I.describeFood(food)]},1))
 S.setBayShopOpen(p.state.bayShop,true)
 let first
 for(let i=0;i<100&&!first;i++)for(const sale of S.advanceBayShop(p.state.bayShop,100)){p.state.coins+=sale.price;first=sale}
 assert.deepEqual([first.visitor,first.price,p.state.coins,p.state.bayShop.sold],['bea',25,93,1])
 S.setBayShopOpen(p.state.bayShop,false);p.reload()
 act('beginFestival','harvest');apple(3);visit('village')
 act('contributeFestival','participation','harvest')
 for(let i=0;i<3;i++)act('contributeFestival','fruit','apple')
 assert.equal(F.getFestivalStatus(p.state).active.stage,1)
 assert.equal(F.getFestivalStatus(p.state).active.waitingNight,true)
 night()
 const chosenRoot=['carrot','beetroot','pumpkin'], chosenGreens=['cabbage','leafyGreens']
 for(let n=0;n<3;n++){
  for(const index of [1,5,6,7,10,12,15]){
   const kind=F.getBedAction(p.state,index).kind
   if(kind==='water'){if(!p.state.water)act('refillWater');act('workBed',index)}
   else if(kind==='harvest')act('workBed',index)
  }
  if([...chosenRoot,...chosenGreens].every(id=>p.state.produce[id]>0))break
  night()
 }
 visit('village')
 for(const id of chosenRoot)act('contributeFestival','roots',id)
 for(const id of chosenGreens)act('contributeFestival','greens',id)
 assert.equal(F.getFestivalStatus(p.state).active.waitingNight,true)
 night()
 if(loadApples) apple(4)
 visit('village')
 return p
}
const main=read('../src/main.ts'), ui=read('../src/bay-festival-ui.ts')
const cut=(a:string,b:string)=>{const x=main.indexOf(a),y=main.indexOf(b,x+a.length);assert.ok(x>=0&&y>x,a);return main.slice(x,y)}
const festivalRender=runInNewContext(stripTypeScriptTypes(ui.slice(ui.indexOf('export type FestivalViewOptions'))
 .replace(/^export (?=function )/gm,'').replaceAll('import.meta.env.BASE_URL','"/"')+';renderFestivalPanel'),
 {...F,...Fruit,...R1,...R2,...R3,...R4,ruCount})
const wire=stripTypeScriptTypes(cut('async function showRequirement(', '// Scene handlers own material sounds.')
 +cut('function openPanel(', "  if (next === 'recipes') {")+' showPanel(next) }'
 +cut('function button(','function quantity(')
 +cut('function recipeDestination(', '\nfunction familyRecipeName(')
 +cut('function goBack(', '\nlet harbourScene:')
 +`async function tap(action,value,control){switch(action){${cut("    case 'festival-source': {","    case 'festival-activity': {")}}}`)
const sourceBtn=(f:F.FarmState) => (festivalRender(f) as string).match(/<button[^>]*data-action="festival-source" data-value="treat\|appleJam"[^>]*>[^]*?<\/button>/)?.[0]

function mount(farm:F.FarmState,attached=true){
 const events:string[]=[],control={closest:()=>null,dataset:{action:'festival-source',value:'treat|appleJam'}}
 const context:any={...F,...G,farm,panel:'festival',dialog:{open:true,querySelectorAll:()=>[]},
  salePresentation:{}, marketSaleBrowse:{reset(){}},panelHistory:[],
  fieldViewButton:{getAttribute:()=> 'false'},dialogContent:{contains:()=>attached&&context.dialog.open,querySelector:()=>null,querySelectorAll:()=>[],scrollTop:0},
  closeDialog(){context.dialog.open=false;events.push('close')}, showPanel(panel:string){context.panel=panel;events.push('open:'+panel)},
  notify(){},island:{isCrossing:()=>false,async crossIsland(fn:()=>boolean){assert.ok(fn())},focusTarget(t:{kind:string}){events.push('focus:'+t.kind)}},
  perform(fn:()=>F.ActionResult){const r=fn();if(r.ok)events.push('save:'+farm.island);return r.ok},
  kitchenGroup:'tart',kitchenGroups:['tart','preserves','dishes'],kitchenTart:'orchardTart',
  kitchenPreserves:'orchardPreserves',kitchenDish:'grilledFish',cookingFish:'perch',
  icon:()=>'',dishIcons:{},stockTile:()=>'',stockTileWithSource:()=>'',
  rememberPanel:()=>({panel:context.panel,kitchenGroup:context.kitchenGroup,kitchenTart:context.kitchenTart,
   kitchenPreserves:context.kitchenPreserves,kitchenDish:context.kitchenDish,signatureSlots:[],recipeBook:{},marketNextOpen:[],scroll:0}),
  recipeBook:{load(){}},restoreFerryPanelView(){},requestAnimationFrame(){},hiveFlower:undefined,panelRenderVersion:0,
 }
 for(const name of `journeyDetailsOpen journalDetailsOpen selectedExpeditionPort selectedExpeditionOffer
  selectedWarehouseRequest selectedWarehouse freightPlanOpen inventoryGroup boatIsland marketSaleFamily marketSaleQuery marketCategory marketTab
  marketSellGroup bagTab archiveGroup treeSlot previewSeed specializationBuilding previewSpecialization irrigationMode villageSlot
  pastryShape workshopRecipe cookingDish signatureBase signatureSlots signatureSlot signatureRepeatId expandedRepeatId cookingMode
  communityOrderId communityResident requestedFood honeyKitchenDish signatureFamily marketTreeSpaceVisit seedPickerBed`.split(/\s+/))
  context[name]=undefined
 const engine=runInNewContext(wire+';({tap,kitchenFamilies,goBack})',context)
 return {events,context,click:()=>engine.tap('festival-source','treat|appleJam',control),view:()=>engine.kitchenFamilies(),back:()=>engine.goBack()}
}
function same(f:F.FarmState,before:string,description:string){assert.ok(JSON.stringify(f)===before,description)}

test('earned first Harvest jam help opens the actual local ready recipe without consuming food or leaving the festival',async()=>{
 const p=earnedTreat(),f=p.state
 assert.deepEqual([p.actions,f.day,f.island,f.coins,f.fruit.apple,f.dishes.appleJam,f.bayShop.sold],[138,18,'village',93,4,0,1])
 assert.ok(F.getCookAction(f,'appleJam').available)
 const source=sourceBtn(f)!
 assert.ok(source);assert.match(source,/Яблочное варенье.*Где найти/)
 const before=JSON.stringify(f), tapped=mount(f)
 await tapped.click()
 assert.deepEqual(tapped.events,['open:kitchen'],'one named local Kitchen, no crossing or save')
 assert.equal(tapped.context.panelHistory.at(-1)?.panel,'festival')
 assert.match(tapped.view(),/<h2>Яблочное варенье<\/h2>/)
 assert.match(tapped.view(),/<button[^>]*data-action="cook"[^>]*data-value="appleJam"(?![^>]*disabled)[^>]*>/)
 same(f,before,'only the separate Cook can use apples')
 tapped.back()
 assert.equal(tapped.context.panel,'festival')
 assert.equal(tapped.context.kitchenGroup,'tart','restore ordinary independent manual selection')
 assert.equal(tapped.context.kitchenPreserves,'orchardPreserves','preserve the last manually browsed preserve')
 same(f,before,'merely reviewing then returning changes no farm value')
 p.act('cookDish','appleJam')
 assert.deepEqual([p.state.island,p.state.coins,p.state.fruit.apple,p.state.dishes.appleJam],[ 'village',93,2,1])
 const ready=F.getFestivalStatus(p.state).active!.requirements.find(r=>r.id==='treat')!
 assert.equal(ready.delivered,0)
 assert.match(festivalRender(p.state),/data-action="festival-contribute" data-value="treat\|appleJam"/)
 const readyBefore=JSON.stringify(p.state), stale=mount(p.state)
 await stale.click()
 assert.deepEqual(stale.events,[])
 same(p.state,readyBefore,'an available ready jam must not be rerouted by an old source action')
 p.act('contributeFestival','treat','appleJam')
 assert.equal(F.getFestivalStatus(p.state).active!.requirements.find(r=>r.id==='treat')!.delivered,1)
 assert.equal(p.state.coins,93)
})

test('earned first Harvest with no carried apples still uses the same normal Home source actions',async()=>{
 const p=earnedTreat(false),f=p.state
 assert.equal(f.fruit.apple,0)
 assert.equal(F.getCookAction(f,'appleJam').available,false)
 const phase=F.getFestivalStatus(f).active!
 const hint=G.getRequirementHint(f,{kind:'stock',item:{kind:'dishes',item:'appleJam',quantity:1}})
 assert.equal(hint.action.target,'sail')
 assert.equal(hint.action.value,'home')
 assert.ok(sourceBtn(f))
 const tapped=mount(f);await tapped.click()
 assert.equal(f.island,'home')
 assert.equal(tapped.events.some(x=>x==='open:kitchen'),false)
 assert.equal(tapped.events.includes('save:home'),true)
 assert.equal(f.dishes.appleJam,0)
 assert.deepEqual(F.getFestivalStatus(f).active!.requirements,phase.requirements)
})
