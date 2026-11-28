import A from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import {runInNewContext} from 'node:vm'
import test from 'node:test'
import * as F from '../src/farm.ts'
import {neighborHelpStatus} from '../src/neighbor-help.ts'
import {qualityNames} from '../src/intent-orders.ts'
import {transferBayGoods} from '../src/harbour-economy.ts'
import {getStoredSignature,storedSignatureValue} from '../src/stored-signature.ts'
import {freightPortNames} from '../src/bay-freight-model.ts'
import * as R from '../src/neighbor-food-recovery.ts'
import * as W from '../src/warehouse-guidance.ts'
import {commissionPlayer} from './fixtures/commission-player.ts'

const plan='finn:1',dish='grilledFish',food='dish:grilledFish'
const openings=JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json',import.meta.url),'utf8'))
function earned(){
  const p=commissionPlayer(openings)
  A.deepEqual([p.actions,p.state.day,p.state.coins,p.state.village.meals,p.state.village.residents[1]],[107,14,68,2,'finn'])
  p.visit('home');p.act('specializeFarmhouse','bakery')
  const plots=p.state.beds.flatMap((b,i)=>b.kind==='tilled'?[i]:[]).slice(0,2)
  A.equal(plots.length,2)
  if(p.state.seeds.wheat<2)p.act('buySeeds','wheat')
  if(p.state.selectedSeed!=='wheat')p.act('selectSeed','wheat')
  for(const i of plots)p.act('workBed',i,0)
  for(let nights=0;nights<5&&!plots.every(i=>F.getBedAction(p.state,i).kind==='harvest');nights++){
    for(const i of plots)if(F.getBedAction(p.state,i).kind==='water'){if(!p.state.water)p.act('refillWater');p.act('workBed',i,0)}
    p.night()
  }
  for(const i of plots)p.act('workBed',i,0)
  p.act('bakeWorkshop','round');p.act('cookDish','farmhouseBread')
  p.act('catchFish',true);p.visit('grove');p.act('catchFish',true);p.act('gatherSeaSalt');p.visit('village');p.act('joinNeighborPlan',plan)
  A.deepEqual([p.actions,p.state.day,p.state.island,p.state.coins,p.state.fish.perch,p.state.fish.seaBass,p.state.dishes.farmhouseBread,p.state.produce.carrot,p.state.seaSalt],
    [126,16,'village',6,1,1,1,1,2])
  return p
}

const read=(name:string)=>readFileSync(new URL(name,import.meta.url),'utf8')
const main=read('../src/main.ts'), community=read('../src/community-ui.ts')
function section(source:string,a:string,b:string) {
  const start=source.indexOf(a), end=source.indexOf(b,start+a.length)
  A.ok(start>=0&&end>start,a)
  return source.slice(start,end)
}
const clip=(a:string,b:string)=>section(main,a,b)
const art={icon:()=>'',offerIcon:()=>''}
const neighbor=runInNewContext(stripTypeScriptTypes(community.slice(community.indexOf('type Offer =')).replaceAll('export function ','function ')+';neighborDetail'),
  {...F,...R,...W,getStoredSignature,storedSignatureValue,freightPortNames,neighborHelpStatus,qualityNames})
const program=stripTypeScriptTypes(clip('function recipeDestination(','function kitchenReadyDishes(')
  +clip('function currentCommunityRequest()','function currentCommunityRoute(')
  +clip('function requestedRecipe()','async function guideRequestedFood(')
  +clip('function startRequestedFood(','function repeatRequestedFood()')
  +clip('function focusKey(','// The route key')
  +clip('function goBack(','let harbourScene:')
  +clip('function closeDialog()','function refresh()')
  +`async function act(action,value,control){switch(action){${clip("    case 'cook-intent-offer':","    case 'request-food-source':")}
  ${clip("    case 'grill-fish':","    case 'fish-kitchen':")}}}
  ;({act,card:requestedRecipeCard,recipe:requestedRecipe,goBack,closeDialog})`)

type Choice = {dataset: Record<string,string>; disabled: boolean; markup: string}
function controls(html:string) {
  return [...html.matchAll(/<button\b([^>]*)>[\s\S]*?<\/button>/g)].map(([markup,attributes])=>({
    dataset:Object.fromEntries([...attributes.matchAll(/data-([\w-]+)="([^"]*)"/g)].map(([,k,v])=>[k,v])),
    disabled:/\bdisabled\b/.test(attributes),markup,
  }))
}
const nav=(...parts:string[])=>parts.join('')
function screen(farm:F.FarmState){
  const opens:string[]=[], guidance:string[]=[], scenes:F.FishId[]=[], redraws:string[]=[]
  let buttons: Choice[]=[]
  const noop=()=>{}
  const reset={reset:noop}
  const history: Record<string,any>[]=[]
  const state: Record<string,any>={...F,farm, panel:'neighbor', requestedFood:undefined, requestedGrillChoice:undefined, communityRequest:undefined,
    cookingFish:'seaBass', cookingDish:'orchardTart', cookingMode:'dish', signatureSlots:[], panelHistory:history, panelRenderVersion:0,
    dialog:{open:true,close(){state.dialog.open=false},querySelectorAll:()=>[]}, app:{dataset:{}},
    dialogContent:{contains:(control:Choice)=>buttons.includes(control),querySelector:()=>null,querySelectorAll:()=>[],scrollTop:0},
    island:{isCrossing:()=>false,setViewMode:noop,setCoveFocus:noop,crossIsland:()=>A.fail('no travel from a local fish choice')},
    selectedDailyIntent:()=>undefined,communityArt:art,getRequestedBeaBatch:()=>undefined,escapeHtml:String,icon:()=>'',fishImage:(id:string)=>id,nav,
    stockTile:(item:F.StockItem)=>`<li data-stock-id="${F.marketKey(item)}"></li>`,
    button:(label:string,action:string,enabled=true,options:{value?:string}={})=>
      `<button data-action="${action}"${options.value?` data-value="${options.value}"`:''}${enabled?'':' disabled'}>${label}</button>`,
    renderIntentDeadline:()=>'',guideRequestedFood:()=>guidance.push('guide'),repeatRequestedFood:()=>A.fail('not a signature'),
    rememberClosedMarketSell:noop,salePresentation:reset,gardenEditor:reset,transplantSelection:reset,berryNurserySelection:reset,berryRenewalSelection:reset,recipeSurplusSelection:reset,
    stopHarbour:noop,stopFishing:noop,stopArrangement:noop,stopWorkshop:noop,stopCookery:noop,updateCommunityReturn:noop,
    recipeBook:{load:noop},restoreFerryPanelView:noop,requestAnimationFrame:(fn:()=>void)=>fn(),
  }
  state.openPanel=(name:string,remember=true)=>{
    if(remember)history.push({panel:state.panel,requestedFood:state.requestedFood,neighborRecipeOrigin:state.panel==='request-food'
      ?{island:farm.island,request:state.communityRequest}:undefined,cookingFish:state.cookingFish,signatureSlots:[],marketNextOpen:[],scroll:0})
    state.panel=name;state.dialog.open=true;state.panelRenderVersion++;opens.push(name)
    if(name==='cookery')scenes.push(state.cookingFish)
    buttons=[]
  }
  state.drawPanel=()=>{redraws.push(state.panel);buttons=[]}
  const ui=runInNewContext(program,state)
  function view(){const html=ui.card() as string;buttons=controls(html);return html}
  function click(c:Choice|undefined){
    A.ok(c);A.equal(c.disabled,false)
    return ui.act(c.dataset.action,c.dataset.value,c)
  }
  return {state,ui,opens,scenes,guidance,redraws,view,click,
    choice(action:string,value?:string){return buttons.find(c=>c.dataset.action===action&&(value===undefined||c.dataset.value===value))},
    async enter(){
      const entry=controls(neighbor(farm,'finn',art)).find(c=>c.dataset.action==='cook-intent-offer'&&c.dataset.plan===plan&&c.dataset.value===food)
      await click(entry);A.equal(state.panel,'request-food')
    }}
}
const basket={kind:'basket',settled:true,placements:[{slot:'food',x:0,y:0},{slot:'cup',x:.4,y:.2},{slot:'flowers',x:-.4,y:.2}]} as const
const grilled=(fish:F.FishId)=>({family:'grilledFish',fishSpecies:fish,fruit:[],garnish:[{ingredientId:'carrot',x:.2,y:.1,angle:0}],
  baking:{method:'grill',finish:'golden',seconds:5},steps:['season-fish','grill-first-side','turn-fish','grill-second-side','plate-fish','arrange-carrot']} as const)
const ok=(result:F.ActionResult)=>A.ok(result.ok,result.message)

test('D16: both real fish in Finn’s current recipe; one species choice previews, only separate cooking and serving consume/pay',async()=>{
  const {state:farm}=earned(), snapshot=structuredClone(farm), s=screen(farm)
  const offer=F.getIntentOffers(farm,'hearty').find(x=>x.id===food)
  A.ok(offer?.eligible&&!offer.available)
  A.ok(F.getCookAction(farm,dish,'perch').available&&F.getCookAction(farm,dish,'seaBass').available)
  await s.enter()
  const original=s.view()
  A.match(original,/role="group" aria-label="Рыба для гриля"/)
  A.equal((original.match(/aria-pressed=/g)??[]).length,2)
  A.match(original,/data-value="seaBass" aria-pressed="true"/)
  A.match(original,/data-stock-id="fish:seaBass"/)
  A.doesNotMatch(original,/data-stock-id="fish:perch"/)
  A.deepEqual(farm,snapshot)
  await s.click(s.choice('request-grill-fish','perch'))
  const perch=s.view()
  A.match(perch,/data-value="perch" aria-pressed="true"/)
  A.match(perch,/data-stock-id="fish:perch"/)
  A.doesNotMatch(perch,/data-stock-id="fish:seaBass"/)
  A.deepEqual([s.state.cookingFish,s.scenes.length,s.redraws.length],['seaBass',0,1])
  A.deepEqual(farm,snapshot)
  await s.click(s.choice('request-start-cook','perch'))
  A.deepEqual(s.scenes,['perch'])
  A.deepEqual(farm,snapshot,'opening the real minigame is not the cook receipt')
  s.ui.goBack()
  A.equal(s.state.panel,'request-food')
  A.equal(s.state.communityRequest.planId,plan)
  A.match(s.view(),/data-value="perch" aria-pressed="true"/)
  A.deepEqual(farm,snapshot)
  s.ui.closeDialog()
  A.equal(s.state.dialog.open,false)
  A.deepEqual(farm,snapshot)
  await s.enter()
  A.match(s.view(),/data-value="seaBass" aria-pressed="true"/,'a new normal request visit keeps its old default')
  A.deepEqual(farm,snapshot)
  for(const fish of ['perch','seaBass'] as const){
    const next=structuredClone(snapshot)
    ok(F.cookDish(next,dish,grilled(fish)))
    A.deepEqual([next.coins,next.fish[fish],next.seaSalt,next.produce.carrot,next.dishes.grilledFish],[6,0,1,0,1])
    ok(F.serveNeighborPlan(next,plan,food))
    A.deepEqual([next.coins,next.dishes.grilledFish],[6,1],'arranging keeps the portion until Finish')
    ok(F.finishNeighborPlan(next,plan,basket))
    A.equal(F.finishNeighborPlan(next,plan,basket).ok,false)
    A.deepEqual([next.coins,next.neighbors.finn.completed,next.dishes.grilledFish],[56,1,0])
    ok(F.sail(next,'grove'))
    const quote=F.getHarborOrder(next)!
    A.equal(quote.items.every(({item,available,delivered})=>item.quantity===available+delivered),fish==='perch')
    if(fish==='perch'){ok(F.deliverHarborOrder(next));A.equal(next.coins,98)}
  }
})

test('single real fish remains one ordinary Cook and a carried completed portion keeps the earlier ready return',async()=>{
  for(const [stored,kept] of [['perch','seaBass'],['seaBass','perch']] as const){
    const p=earned()
    p.act('transferBayGoods','deposit','village',stored,1)
    const f=p.state, before=structuredClone(f), s=screen(f)
    await s.enter()
    A.doesNotMatch(s.view(),/Рыба для гриля/)
    await s.click(s.choice('request-start-cook'))
    A.deepEqual(s.scenes,[kept]);A.deepEqual(f,before)
    ok(F.cookDish(f,dish,grilled(kept)))
    s.ui.goBack()
    const html=s.view()
    A.match(html,/data-request-ready/);A.match(html,/К встрече/)
    A.doesNotMatch(html,/Рыба для гриля|request-start-cook/)
  }
  const p=earned()
  p.visit('grove');p.act('deliverHarborOrder');p.act('catchFish',true);p.visit('village')
  A.deepEqual([p.state.day,p.state.coins,p.state.orders.harbor.completed,p.state.fish.perch,p.state.fish.seaBass],[16,48,1,1,1])
  const before=structuredClone(p.state), again=screen(p.state)
  await again.enter();A.match(again.view(),/Рыба для гриля/,'the same local choice exists after a different order is already paid')
  A.deepEqual(p.state,before)
  p.act('transferBayGoods','deposit','village','seaSalt',p.state.seaSalt)
  const shortage=screen(p.state)
  await shortage.enter()
  A.doesNotMatch(shortage.view(),/Рыба для гриля|request-start-cook/)
  A.ok(shortage.choice('request-food-source'),'a genuinely unfunded recipe retains the normal ingredient path')
})

test('a stale live choice will not silently replace the fish, reroute, or open an extra cooked portion',async()=>{
  for(const picked of [false,true]){
    const {state:f}=earned(), s=screen(f)
    await s.enter();s.view()
    if(picked){await s.click(s.choice('request-grill-fish','perch'));s.view()}
    const species=picked?'perch':'seaBass', remaining=picked?'seaBass':'perch'
    const old=s.choice('request-start-cook',species)
    A.ok(old)
    ok(transferBayGoods(f,'deposit','village',species,1))
    const afterMove=structuredClone(f)
    await s.click(old)
    A.deepEqual([s.state.panel,s.scenes.length,s.guidance.length,s.redraws.at(-1)],['request-food',0,0,'request-food'])
    A.deepEqual(f,afterMove)
    const later=s.view()
    if(picked){
      A.equal(s.choice('request-grill-fish',species)?.disabled,true)
      A.doesNotMatch(later,/data-action="request-start-cook"/)
      await s.click(s.choice('request-grill-fish',remaining));s.view()
    }else A.doesNotMatch(later,/Рыба для гриля/)
    await s.click(s.choice('request-start-cook',remaining))
    A.deepEqual(s.scenes,[remaining]);A.deepEqual(f,afterMove)
  }
  const {state:f}=earned(), s=screen(f)
  await s.enter();s.view()
  const old=s.choice('request-start-cook','seaBass')
  ok(F.cookDish(f,dish,grilled('seaBass')))
  const ready=structuredClone(f)
  await s.click(old)
  A.deepEqual(s.scenes,[]);A.deepEqual(s.guidance,[]);A.deepEqual(f,ready)
  A.match(s.view(),/data-request-ready/)
})
