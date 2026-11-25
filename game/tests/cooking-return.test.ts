import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { runInNewContext } from 'node:vm'
import * as farmApi from '../src/farm.ts'
import { communityReturnRoute } from '../src/community-return.ts'
import { getNeighborSceneState, stepNeighborWalker } from '../src/neighbor-scene.ts'
import { SalePresentation } from '../src/sale-presentation.ts'
import { cookingReturnFixture } from './fixtures/cooking-return.ts'

const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8')
const islandSource = readFileSync(new URL('../src/island.ts', import.meta.url), 'utf8')
const js = (source: string) => stripTypeScriptTypes(source)
const cookery = main.slice(main.indexOf("    case 'cookery': {"), main.indexOf("    case 'village-project':"))
const workshop = main.slice(main.indexOf("    case 'workshop': {"), main.indexOf("    case 'cookery': {"))
const closeSale = main.slice(main.indexOf('function closeContextualSale('), main.indexOf('function beginExactSale('))
const close = main.slice(main.indexOf('function closeCurrentPanel()'), main.indexOf("closeButton.addEventListener('click'"))
const back = main.slice(main.indexOf('function returnFromPanel('), main.indexOf("dialog.addEventListener('cancel'"))
const resume = main.slice(main.indexOf('function currentCommunityRequest()'), main.indexOf('function updateCommunityReturn()'))
  + main.slice(main.indexOf('async function resumeCommunityRequest('), main.indexOf('function requestedRecipe()'))

function setup(at: farmApi.IslandId, signature = false, from = at === 'cape' ? 'honey-kitchen' : 'kitchen') {
  const { farm, selection } = cookingReturnFixture(at)
  assert.ok(farmApi.restoreFarm(farm), 'fixture remains a valid save')
  const calls: string[] = [], state: any = {
    ...farmApi, farm, salePresentation: new SalePresentation(), selectedSale: undefined, panel: 'cookery', panelHistory: [{ panel: from }], communityRequest: selection.request,
    cookingDish: at === 'cape' ? 'honeyBiscuits' : 'orchardTart', cookingFish: 'seaBass', cookingMode: signature ? 'signature' : 'dish',
    signatureBase: 'tart', signatureSlots: [{ id: 'apple', quantity: 2 }], signatureRepeatId: undefined, signatureFamily: undefined,
    signatureFruitIds: [], signatureFruitNames: {}, familyRecipeName: () => undefined, signatureBookCapacity: () => ({ canCreate: true }),
    getSignatureAction: () => ({ available: true, items: [] }), stockLabel: () => ({ name: '', image: '' }), iconUrl: () => '',
    dialog: { open: true }, dialogContent: { innerHTML: '', querySelector: () => ({}) },
    createCookery: (_host: unknown, options: unknown) => { state.options = options; return { destroy() {} } },
    createWorkshop: (_host: unknown, options: unknown) => { state.options = options; return { destroy() {} } },
    workshopRecipe: 'pastry', pastryShape: 'round',
    leaveScene: () => { calls.push('local-back'); state.panel = state.panelHistory.pop()?.panel },
    goBack: () => { calls.push('local-back'); state.panel = state.panelHistory.pop()?.panel },
    closeDialog: () => { calls.push('close'); state.panel = undefined; state.dialog.open = false },
    openRecipeBook: () => { calls.push('recipe-book'); state.panel = 'recipes' },
    returnToRecipeIndex: () => false,
    resumeCommunityRequest: async () => { calls.push('community-travel'); if (farm.island !== 'village') assert.ok(farmApi.sail(farm, 'village').ok) },
  }
  return { state, calls, farm }
}
function mount(state: any, scene = 'cookery') {
  state.panel = scene
  runInNewContext(js(`switch('${scene}'){${scene === 'cookery' ? cookery : workshop}}`), state)
  assert.ok(state.options, 'real main branch mounted a playable cooking scene')
}

for (const at of ['home', 'village', 'cape'] as const) test(`ordinary cooking return ignores old neighbor selection at ${at}`, async () => {
  const { state, calls, farm } = setup(at)
  assert.equal(farmApi.getCookAction(farm, state.cookingDish).available, true)
  const before = JSON.stringify(farm)
  mount(state)
  assert.equal(state.options.returnLabel, 'На кухню')
  await state.options.onCancel()
  assert.deepEqual(calls, ['local-back'])
  assert.equal(state.panel, at === 'cape' ? 'honey-kitchen' : 'kitchen')
  assert.equal(JSON.stringify(farm), before)
})

test('Grove is not a cooking entry point and retains the real domain guard', () => {
  const { farm } = setup('grove'), before = JSON.stringify(farm)
  for (const dish of farmApi.dishIds) assert.equal(farmApi.getCookAction(farm, dish).available, false)
  assert.equal(JSON.stringify(farm), before)
})

for (const scene of ['cookery', 'workshop']) for (const path of ['close', 'escape']) test(`${scene} ${path} never interprets a saved neighbor as a travel command`, async () => {
  const { state, calls, farm } = setup('home'), before = JSON.stringify(farm)
  state.panel = scene
  if (path === 'close') await runInNewContext(js(`${close}; closeCurrentPanel()`), state)
  else {
    state.event = { defaultPrevented: false, preventDefault() { this.defaultPrevented = true } }
    await runInNewContext(js(`${closeSale}; ${back}; returnFromPanel(event)`), state)
    assert.equal(state.event.defaultPrevented, true)
  }
  assert.ok(calls.includes('close') || calls.includes('local-back'))
  assert.ok(!calls.includes('community-travel'))
  assert.equal(JSON.stringify(farm), before)
})

test('workshop cancel stays local and standalone recipe completion returns to the recipe book', async () => {
  const bakery = setup('home'), before = JSON.stringify(bakery.farm)
  mount(bakery.state, 'workshop'); await bakery.state.options.onCancel()
  assert.deepEqual(bakery.calls, ['local-back']); assert.equal(JSON.stringify(bakery.farm), before)
  const signature = setup('home', true, 'signature')
  mount(signature.state); await signature.state.options.onCancel()
  assert.equal(signature.state.options.returnLabel, 'Мои рецепты')
  assert.deepEqual(signature.calls, ['recipe-book']); assert.equal(signature.farm.island, 'home')
})

test('cooking entered from a requested recipe returns to that local recipe; travel remains a separate action', async () => {
  const { state, calls, farm } = setup('home', false, 'request-food'), before = JSON.stringify(farm)
  mount(state)
  assert.equal(state.options.returnLabel, 'К рецепту')
  await state.options.onCancel()
  assert.deepEqual(calls, ['local-back']); assert.equal(state.panel, 'request-food'); assert.equal(JSON.stringify(farm), before)
})

test('completing a real dish does not travel or close the current cooking session', () => {
  const { state, calls, farm } = setup('home')
  state.perform = (action: () => {ok:boolean}) => action().ok
  const before = structuredClone(farm)
  mount(state)
  const result = {family:'decorate', processing:'chunky', fruit:[{ingredientId:'apple',x:.2,y:-.3,angle:.4}], steps:['arrange-fruit','dust-sugar']}
  assert.equal(state.options.onComplete(result), true)
  assert.equal(farm.dishes.orchardTart, before.dishes.orchardTart + 1)
  assert.equal(farm.island, 'home'); assert.equal(state.panel, 'cookery'); assert.deepEqual(calls, [])
  const made = JSON.stringify(farm)
  assert.equal(state.options.onComplete(result), true)
  assert.equal(JSON.stringify(farm), made, 'repeated completion is idempotent')
})

test('the actual explicit meeting action still sails once without joining or consuming the food', async () => {
  const { state, calls, farm } = setup('home'), before = structuredClone(farm)
  Object.assign(state, { communityReturnRoute, requestedFood: undefined, canSailTo: farmApi.canSailTo,
    island: { isCrossing: () => false, crossIsland: async (commit: () => boolean) => { calls.push('cross'); commit() } },
    fieldViewButton: { getAttribute: () => 'false' },
    perform: (action: () => {ok:boolean}) => { const result = action(); if (result.ok) calls.push('save'); return result.ok },
    openPanel: (panel: string) => { state.panel = panel; calls.push(panel) },
  })
  await runInNewContext(js(`${resume}; resumeCommunityRequest('request')`), state)
  assert.equal(farm.island, 'village'); assert.deepEqual(farm, { ...before, island: 'village' })
  assert.deepEqual(calls, ['close','cross','save','neighbor'])
})

test('real autonomous basket-preparation branch changes only the visual actor, not cooking or farm location', () => {
  const { state, farm } = setup('home'), before = JSON.stringify(farm)
  const basket = farmApi.getNeighborPlans(farm).find(plan => plan.arrangement === 'basket' && plan.phase === 'preparing')!
  assert.ok(basket, 'a real next-day basket plan exists')
  const place = getNeighborSceneState(basket)
  const actor = { id: basket.resident, slot: 1, point: {...place.stand}, route: [], facingRight: true, stride: 0,
    gathering: false, serviceRequested: false, fetching: false, waitUntil: 0, atStationSince: 0, plan: basket }
  const source = islandSource.slice(islandSource.indexOf('    const actors = [...villageActors.values()];'), islandSource.indexOf('    for (const plan of getNeighborPlans(farm)) {', islandSource.indexOf('    const actors = [...villageActors.values()];')))
  Object.assign(state, { villageActors: new Map([[basket.resident, actor]]), gatheringPlan: undefined, motion: {matches:false},
    moment: 20_000, elapsed: .05, scenePoint: (x:number,y:number) => ({x,y}), getNeighborSceneState, stepNeighborWalker,
    distance: (a:any,b:any) => Math.hypot(a.x-b.x,a.y-b.y), routeResident: (who:any, target:any) => {who.route=[target]},
  })
  runInNewContext(js(`{${source}}`), state)
  assert.equal(actor.fetching, true, 'actual preparation timer starts fetching the basket supplies')
  assert.deepEqual(actor.route, [place.source])
  for (let frame=0; frame<400; frame++) { state.moment+=50; runInNewContext(js(`{${source}}`), state) }
  assert.equal(state.panel, 'cookery'); assert.equal(JSON.stringify(farm), before)
  assert.doesNotMatch(source, /activate\(|crossIsland|sail\(|openPanel|resumeCommunityRequest/)
})

test('only the live unfinished recipe from Bea returns to its saved ingredient slots, then to that meeting',async()=>{
  const {commissionPlayer}=await import('./fixtures/commission-player.ts')
  const {recipePlanningIngredient}=await import('../src/recipe-planning.ts')
  const {rememberRecipeDraft}=await import('../src/recipe-draft.ts')
  const opening=JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json',import.meta.url),'utf8'))
  const p=commissionPlayer(opening.slice(0,opening.findIndex((x:{name:string})=>x.name==='serveVillageMeal')))
  p.fruit('apple',2);p.visit('village')
  const id=farmApi.getNeighborPlans(p.state).find(plan=>plan.resident==='bea')!.id;p.act('joinNeighborPlan',id)
  assert.equal(p.actions,95);assert.equal(p.state.day,11);assert.equal(p.state.fruit.apple,3)
  const sec=(a:string,b:string)=>main.slice(main.indexOf(a),main.indexOf(b,main.indexOf(a)+a.length))
  const actions=js('(cmd)=>{switch(cmd){'+sec("    case 'intent-own-recipe':","    case 'honey-kitchen-recipe':")
    +sec("    case 'signature-base':","    case 'signature-home':")+'}}')
  for(const mode of ['cancel','finished','retired'] as const){
    const {state:x,calls}=setup('village',true),f=structuredClone(p.state)
    Object.assign(x,Object.fromEntries('selectedWarehouseRequest selectedExpeditionPort selectedExpeditionOffer selectedWarehouse inventoryGroup boatIsland marketSaleFamily marketSaleQuery marketTab marketCategory marketSellGroup bagTab archiveGroup treeSlot previewSeed specializationBuilding previewSpecialization irrigationMode villageSlot seedPickerBed expandedRepeatId communityOrderId requestedFood kitchenTart kitchenPreserves kitchenGroup kitchenDish honeyKitchenDish'.split(' ').map(key=>[key,undefined])))
    Object.assign(x,{farm:f,panel:'neighbor',panelHistory:[],communityResident:'bea',communityRequest:{kind:'neighbor',resident:'bea',planId:id},
      control:{dataset:{}},recipePlanningIngredient,rememberRecipeDraft,saveFarm(){},drawPanel(){},getSignatureAction:farmApi.getSignatureAction,
      document:{activeElement:null},HTMLButtonElement:class {},recipeBook:{snapshot(){return{}},load(){}},dialogContent:{querySelector(){return null},querySelectorAll(){return[]},scrollTop:0},
      dialog:{open:true,querySelectorAll(){return[]}},restoreFerryPanelView(){},panelRenderVersion:0,requestAnimationFrame:(cb:()=>void)=>cb(),
      openPanel(next:string,remember=true){if(remember)x.panelHistory.push(x.rememberPanel());x.panel=next},
      openRecipeBook(recipe?:string){calls.push('recipe-book');x.openedRecipe=recipe;x.openPanel('recipes',false)},
      perform(action:()=>{ok:boolean}){return action().ok}})
    runInNewContext(js(sec('function leaveScene()', 'let harbourScene:')+sec('function rememberCurrentRecipeDraft()', 'const recipeBook =')),x)
    const click=runInNewContext(actions,x)
    click('intent-own-recipe');x.value='preserves';click('signature-base');x.value='apple';click('signature-fruit');click('signature-fruit')
    assert.deepEqual(JSON.parse(JSON.stringify(x.signatureSlots)),[{id:'apple',quantity:1},{id:'apple',quantity:1}])
    click('start-signature');mount(x);const start=structuredClone(f),draft=structuredClone(f.recipeDraft)
    assert.deepEqual(x.panelHistory.map((entry:{panel:string})=>entry.panel),['neighbor','signature'])
    assert.equal(x.options.returnLabel,'К выбору ингредиентов')
    if(mode==='finished'){
      assert.ok(x.options.onComplete({family:'preserves',processing:'silky',fruit:[],steps:['mix','pour']}))
      assert.equal(x.options.returnLabel,'Мои рецепты');const paid=structuredClone(f)
      x.options.onCancel();assert.equal(x.panel,'recipes');assert.deepEqual(x.panelHistory,[]);assert.equal(x.openedRecipe,f.culinary.recipes.at(-1)?.id)
      assert.equal(f.fruit.apple,start.fruit.apple-2);assert.deepEqual(f,paid)
    }else if(mode==='retired'){
      x.communityRequest=undefined
      assert.equal(x.options.returnLabel,'Мои рецепты');x.options.onCancel();assert.equal(x.panel,'recipes');assert.deepEqual(f,start)
    }else{
      x.options.onCancel();assert.equal(x.panel,'signature');assert.equal(x.signatureBase,'preserves')
      assert.deepEqual(JSON.parse(JSON.stringify(x.signatureSlots)),draft!.slots);assert.equal(x.signatureSlot,draft!.activeSlot)
      x.goBack(true);assert.equal(x.panel,'neighbor');assert.equal(x.communityResident,'bea');assert.equal(x.communityRequest.planId,id)
      assert.deepEqual(f,start);assert.equal(f.island,'village')
    }
  }
})

test('Escape on a focused receipt button follows the finished home recipe, not old composer history',async()=>{
  const {commissionPlayer}=await import('./fixtures/commission-player.ts')
  const opening=JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json',import.meta.url),'utf8'))
  const farm=commissionPlayer(opening.slice(0,12)).state
  const {state,calls}=setup('home',true,'signature')
  Object.assign(state,{farm,communityRequest:undefined,panelHistory:[{panel:'kitchen'},{panel:'signature'}],
    getSignatureAction:farmApi.getSignatureAction,perform:(fn:()=>{ok:boolean})=>fn().ok,
    openRecipeBook:(id:string)=>{calls.push('book:'+id);state.panel='recipes'}})
  mount(state)
  assert.ok(state.options.onComplete({family:'decorate',fruit:[{ingredientId:'apple',x:0,y:0,angle:0}],steps:['fruit','dust','bake']}))
  const id=farm.culinary.recipes.at(-1)!.id, paid=structuredClone(farm)
  assert.equal(state.options.returnLabel,'Мои рецепты')
  const scene=readFileSync(new URL('../src/cookery.ts',import.meta.url),'utf8')
  const listen=(source:string,start:string,end:string)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)))
  const viewKey=listen(scene,"  view.addEventListener('keydown'","  function updateSugar()")
  const dialogKey=listen(main,"dialog.addEventListener('keydown', event => {\n  if (event.key !== 'Escape'","dialog.addEventListener('keydown',event=>{if(event.altKey")
  const runKey=(key:string,repeat=false)=>{
    const event={key,repeat,defaultPrevented:false,type:'keydown',target:{closest:(s:string)=>s==='button'},preventDefault(){this.defaultPrevented=true}}
    state.event=event;state.view={addEventListener:(_:string,fn:Function)=>fn(event)}
    state.dialog.addEventListener=(_:string,fn:Function)=>fn(event)
    Object.assign(state,{signal:new AbortController().signal,cancel:()=>state.options.onCancel()})
    runInNewContext(js(viewKey+'\n'+closeSale+back+dialogKey),state)
    return event.defaultPrevented
  }
  assert.equal(runKey('Enter'),false,'native button activation stays native')
  assert.equal(runKey('Escape',true),true);assert.deepEqual(calls,[])
  assert.equal(runKey('Escape'),true)
  assert.deepEqual(calls,['book:'+id]);assert.equal(state.panel,'recipes');assert.deepEqual(state.panelHistory,[])
  assert.deepEqual(farm,paid);assert.deepEqual(farmApi.restoreCurrentFarm(JSON.parse(JSON.stringify(farm))),paid)
})

test('Escape belongs to the honey station even on its tilt slider; native slider and button keys still pass through',()=>{
  const source=readFileSync(new URL('../src/honey-cookery.ts',import.meta.url),'utf8')
  const listener=source.slice(source.indexOf("  view.addEventListener('keydown'"),source.indexOf('  async function load()',source.indexOf("  view.addEventListener('keydown'")))
  let returns=0
  const key=(key:string,repeat=false,altKey=false)=>{
    const event={key,repeat,altKey,defaultPrevented:false,target:{closest:()=>true},preventDefault(){this.defaultPrevented=true}}
    runInNewContext(js(listener),{view:{addEventListener:(_:string,fn:Function)=>fn(event)},signal:new AbortController().signal,cancel:()=>returns++})
    return event.defaultPrevented
  }
  for(const native of ['ArrowLeft','ArrowRight','Enter',' '])assert.equal(key(native),false)
  assert.equal(key('Escape',false,true),false)
  assert.equal(key('Escape',true),true);assert.equal(returns,0)
  assert.equal(key('Escape'),true);assert.equal(returns,1)
})

for(const exit of ['back','cancel','escape','finished'] as const) test(`earned Home Kitchen fruit mix retains its correct return while Finn prepares his basket: ${exit}`, async()=>{
  const {commissionPlayer}=await import('./fixtures/commission-player.ts')
  const {recipePlanningIngredient}=await import('../src/recipe-planning.ts')
  const {rememberRecipeDraft}=await import('../src/recipe-draft.ts')
  const opening=JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json',import.meta.url),'utf8'))
  const p=commissionPlayer(opening);p.fruit('apple',2);p.visit('village')
  const plan=farmApi.getNeighborPlans(p.state).find(plan=>plan.resident==='finn')!
  assert.deepEqual([p.actions,p.state.day,plan.id,plan.phase,plan.arrangement],[112,15,'finn:1','preparing','basket'])
  p.visit('home')
  assert.deepEqual([p.actions,p.state.day,p.state.island],[113,15,'home'])
  const part=(text:string,a:string,b:string)=>{
    const start=text.indexOf(a),end=text.indexOf(b,start+a.length)
    assert.ok(start>=0&&end>start)
    return text.slice(start,end)
  }
  const formActions=js('(cmd)=>{switch(cmd){'
    +part(main,"    case 'kitchen-group':","    case 'market-category':")
    +part(main,"    case 'signature-base':","    case 'signature-home':")
    +part(main,"    case 'back':","    case 'journal-stay':")
    +'}}')
  const recipe=part(main,'function kitchenFamilies()', 'function familyRecipeName')
  assert.match(recipe, /button\('Выбрать фрукты', 'family-signature', true, \{ value: 'preserves' \}\)/)
  const scene=readFileSync(new URL('../src/cookery.ts',import.meta.url),'utf8')
  const handleEsc=js(part(scene,"  view.addEventListener('keydown'","  function updateSugar()"))
  const actor=js('{'+part(islandSource,'    const actors = [...villageActors.values()];','    for (const plan of getNeighborPlans(farm)) {')+'}')
    const {state:x,calls}=setup('home',true),farm=structuredClone(p.state)
    const missing='selectedWarehouseRequest selectedExpeditionPort selectedExpeditionOffer selectedWarehouse inventoryGroup boatIsland marketSaleFamily marketSaleQuery marketTab marketCategory marketSellGroup bagTab archiveGroup treeSlot previewSeed specializationBuilding previewSpecialization irrigationMode villageSlot seedPickerBed expandedRepeatId communityOrderId requestedFood kitchenTart kitchenPreserves kitchenGroup kitchenDish honeyKitchenDish freightPlanOpen journeyDetailsOpen journalDetailsOpen selectedMarketOrder'.split(' ')
    const fakes=Object.fromEntries(missing.map(k=>[k,undefined]))
    let draftSaves=0, recipeSaves=0
    const savedMeeting={kind:'neighbor',resident:'finn', planId:plan.id}
    Object.assign(x,fakes,{
      farm,panel:'kitchen',panelHistory:[],communityResident:'finn',communityRequest:savedMeeting,kitchenGroups:['tart','preserves','dishes'],kitchenGroup:'tart',signatureSlots:[null,null],
      control:{dataset:{}},event:{detail:0},recipePlanningIngredient,rememberRecipeDraft,saveFarm(){draftSaves++},drawPanel(){},getSignatureAction:farmApi.getSignatureAction,
      document:{activeElement:null},HTMLButtonElement:class {},recipeBook:{snapshot(){return{}},load(){}},
      dialogContent:{querySelector(){return null},querySelectorAll(){return[]},scrollTop:0},
      dialog:{open:true,querySelectorAll(){return[]}},restoreFerryPanelView(){},panelRenderVersion:0,requestAnimationFrame:(cb:()=>void)=>cb(),
      openPanel(next:string,remember=true){
        if(remember)x.panelHistory.push(x.rememberPanel())
        x.panel=next;x.dialogContent.scrollTop=0
      },
      openRecipeBook(id?:string){
        calls.push('recipe-book');x.bookRecipe=id;x.openPanel('recipes',false)
      },
      resumeCommunityRequest(){throw Error('unsolicited neighbor travel')},
      perform(action:()=>{ok:boolean}){const result=action();if(result.ok)recipeSaves++;return result.ok},
    })
    runInNewContext(js(part(main,'function focusKey(', 'let harbourScene:')+part(main,'function rememberCurrentRecipeDraft()', 'const recipeBook =')+closeSale),x)
    const action=runInNewContext(formActions,x)
    x.value='preserves';action('kitchen-group')
    x.control.dataset.family='preserves';x.value='custom';action('recipe-family')
    x.value='preserves';action('family-signature')
    assert.equal(x.panel,'signature')
    x.value='apple';action('signature-fruit');action('signature-fruit')
    const draft=structuredClone(farm.recipeDraft);assert.ok(draft)
    assert.deepEqual(draft.slots,[{id:'apple',quantity:1},{id:'apple',quantity:1}])
    x.dialogContent.scrollTop=41
    action('start-signature');mount(x)
    assert.deepEqual(x.panelHistory.map((v:{panel:string})=>v.panel),['kitchen','signature'])
    const start=structuredClone(farm),writes=draftSaves
    const here=getNeighborSceneState(plan),collecting={id:plan.resident,slot:1,point:{...here.stand},route:[],facingRight:true,stride:0,
      gathering:false,serviceRequested:false,fetching:false,waitUntil:0,atStationSince:0,plan}
    Object.assign(x,{villageActors:new Map([['finn',collecting]]),gatheringPlan:undefined,motion:{matches:false},
      moment:20_000,elapsed:.05,scenePoint:(u:number,v:number)=>({x:u,y:v}),getNeighborSceneState,stepNeighborWalker,
      distance:(a:{x:number;y:number},b:{x:number;y:number})=>Math.hypot(a.x-b.x,a.y-b.y),routeResident:(who:any,target:any)=>{who.route=[target]}})
    runInNewContext(actor,x);assert.equal(collecting.fetching,true);assert.deepEqual(farm,start)
    if(exit==='finished'){
      const process={family:'preserves',processing:'silky',fruit:[],steps:['mix','pour']}
      assert.ok(x.options.onComplete(process));assert.ok(x.options.onComplete(process));assert.equal(recipeSaves,1)
      const receipt=farm.culinary.recipes.at(-1)!.id,paid=structuredClone(farm)
      assert.equal(farm.fruit.apple,start.fruit.apple-2)
      assert.equal(x.options.returnLabel,'Мои рецепты')
      x.options.onCancel();assert.equal(x.panel,'recipes');assert.equal(x.bookRecipe,receipt)
      assert.equal(x.panelHistory.length,0);assert.deepEqual(farm,paid)
      return
    }
    const label=x.options.returnLabel
    if(exit==='back')action('back')
    if(exit==='cancel')x.options.onCancel()
    if(exit==='escape'){
      const event={defaultPrevented:false,key:'Escape',repeat:false,preventDefault(){this.defaultPrevented=true}}
      Object.assign(x,{event,view:{addEventListener:(_:string,listener:Function)=>listener(event)},signal:new AbortController().signal,cancel:()=>x.options.onCancel()})
      runInNewContext(handleEsc,x);assert.ok(event.defaultPrevented)
    }
    assert.equal(x.panel,'signature',`unpaid ${exit} must resume the draft, not clear kitchen history`)
    if(exit!=='back')assert.equal(label,'К выбору ингредиентов')
    assert.deepEqual(JSON.parse(JSON.stringify(x.signatureSlots)),draft.slots)
    assert.equal(x.signatureSlot,draft.activeSlot);assert.equal(x.dialogContent.scrollTop,41)
    assert.deepEqual(x.panelHistory.map((v:{panel:string})=>v.panel),['kitchen'])
    assert.equal(recipeSaves,0);assert.equal(draftSaves,writes);assert.deepEqual(farm,start)
    assert.deepEqual(x.communityRequest,savedMeeting)
    action('back')
    assert.equal(x.panel,'kitchen');assert.equal(x.kitchenGroup,'preserves');assert.equal(x.kitchenPreserves,'custom')
    console.log(JSON.stringify({day:15,earned:113,from:'home kitchen custom preserves',finn:'finn:1 basket fetching',exit,returnedTo:'same composer then own kitchen',recipeSaves,travel:false}))
})
