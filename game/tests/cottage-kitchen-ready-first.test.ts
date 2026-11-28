import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { test } from 'node:test'
import ts from 'typescript'
import * as F from '../src/farm.ts'
import { bayProductId } from '../src/bay-product-id.ts'
import { MarketSaleBrowseMemory } from '../src/market-sale-browse.ts'
import { getBerryNurserySource } from '../src/berry-nursery.ts'
import { getRequirementHint } from '../src/requirement-guidance.ts'
import { commissionPlayer } from './fixtures/commission-player.ts'

const source = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8')
const ast = ts.createSourceFile('main.ts', source, ts.ScriptTarget.Latest, true)
const names = ['button','nav','stockLabel','stockTile','stockTileWithSource','requirementLink','recipeDestination','renderGrillFishChoices','recipeCards','kitchenReadyDishes','kitchenFamilies','openPanel','goBack','leaveScene','focusKey','neighboursCard','renderNeighboursCard','pastryChoices','pastryChoicesFor']
const definitions = names.map(name => {
  const node = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name)
  assert.ok(node, name); return node.getText(ast)
})
const icons = ast.statements.find(node => ts.isVariableStatement(node) && node.declarationList.declarations.some(d => d.name.getText(ast) === 'dishIcons'))!
let clause: ts.CaseClause | undefined
const kitchenCases = new Set(["'kitchen-group'","'recipe-family'","'cook'"]), actions: string[] = []
const visit = (node: ts.Node) => {
  if (ts.isCaseClause(node) && node.expression.getText(ast) === "'fish-kitchen'") clause = node
  if (ts.isCaseClause(node) && (kitchenCases.has(node.expression.getText(ast)) || node.expression.getText(ast) === "'kitchen'" && node.getText(ast).includes('island.visit('))) actions.push(node.getText(ast))
  ts.forEachChild(node, visit)
}
visit(ast); assert.ok(clause)
const sourceHarness = `${icons.getText(ast)}\n${definitions.join('\n')}\nasync function chooseFish(value) { switch('fish-kitchen') { ${clause.getText(ast)} } }
function choose(action, value, family) { const control={dataset:{family}}; switch(action) {${actions.join('\n')} } }`
const noop = () => {}
function buttons(html:string,focus:(id:string)=>void){
 return [...html.matchAll(/<button\b[^>]*data-action="([^"]+)"[^>]*>/g)].map(([tag,action])=>{
  const value=tag.match(/data-value="([^"]+)"/)?.[1]
  const dataset=value===undefined?{action}:{action,value}
  return {dataset,disabled:/\sdisabled(?:[\s>]|=)/.test(tag),getClientRects:()=>[{}],focus(options:{preventScroll:boolean}){assert.ok(options.preventScroll);focus(action+(value?':'+value:''))}}
 })
}
function screen(farm: F.FarmState) {
  const state: Record<string, any> = {
    ...F, farm, getBerryNurserySource, getRequirementHint, escapeHtml: (text: string) => text, icon: (name: string) => `<img data-icon="${name}" alt="">`, fishImage: (id: string) => id,
    numberFormat: new Intl.NumberFormat('ru-RU'), requirementLinks: new Map(), pastryIcons: {},
    kitchenGroups: ['tart','preserves','dishes'], kitchenGroup: undefined, kitchenTart: 'orchardTart', kitchenPreserves: 'appleJam', kitchenDish: 'honeyCake', cookingFish: 'seaBass',
    panel: 'village', panelHistory: [], villageSlot:0,pastryShape:'round', neighborHelpCard:noop,villageHomeProgress:noop,getFinnFishingRoute:noop, marketSaleBrowse: new MarketSaleBrowseMemory(), inventoryGroup: 'shore', marketTab: 'sell', marketCategory: 'trees', selectedWarehouseRequest: undefined, pickedMarketOrder: undefined,
    salePresentation: { place: undefined }, island: { visit(target:object){state.walkTargets.push(target)},isCrossing: () => false, setViewMode: noop, setCoveFocus: noop, crossIsland: async (fn: () => unknown) => fn() },
    dialog: { open: true, showModal: noop, querySelectorAll: () => buttons(state.html,markFocus).filter(node=>!node.disabled) }, dialogContent: { scrollTop: 19, querySelectorAll: () => [], querySelector(selector:string) {
      if (selector === '[data-kitchen-return-dish]') {
        const heading = state.html.match(/<h2 data-kitchen-return-dish tabindex="-1">([^<]+)<\/h2>/)?.[1]
        return heading ? { focus: ({preventScroll}:{preventScroll:boolean}) => { assert.ok(preventScroll);markFocus('heading:'+heading) }, scrollIntoView: noop } : null
      }
      if (selector === '[data-action="recipe-family"][aria-pressed="true"]') {
        const selected=state.html.match(/<button[^>]+data-action="recipe-family"[^>]+data-value="([^"]+)" aria-pressed="true"/)?.[1]
        return selected ? buttons(state.html,markFocus).find(node=>node.dataset.action==='recipe-family'&&node.dataset.value===selected) : null
      }
      return null
    } },
    transplantSelection: { reset: noop }, berryNurserySelection: { reset: noop }, berryRenewalSelection: { reset: noop }, gardenEditor: { reset: noop }, recipeSurplusSelection: { reset: noop },
    seedPickerBed: undefined, previewSeed: farm.selectedSeed, celebratedFestival: undefined, stopHarbour: noop, stopFishing: noop, stopWorkshop: noop, stopCookery: noop, stopArrangement: noop,
    playBaySound: noop, bayAudio: {primeEvents: async () => {}}, app: { dataset: {} }, toast: {}, dialogFeedback: {}, closeButton: { focus: () => markFocus('close') }, updateCommunityReturn: noop,
    recipeBook: { load: noop }, restoreFerryPanelView: noop, panelRenderVersion: 0, requestAnimationFrame: (fn: () => void) => fn(),
    draws: 0, html: '', saves: 0, focusTrace:[] as string[], clickFocus:undefined, visits: [] as string[], walkTargets:[] as object[],
    perform: (fn: () => {ok: boolean}) => { const result = fn(); if (result.ok) state.saves++; return result.ok },
    closeDialog: () => { state.panel = undefined; state.panelHistory.length = 0; state.dialog.open = false },
    rememberPanel: () => ({ panel: state.panel, villageSlot:state.villageSlot,pastryShape:state.pastryShape,kitchenGroup: state.kitchenGroup, cookingDish:state.cookingDish,focus:state.clickFocus&&state.focusKey(state.clickFocus), kitchenDish: state.kitchenDish, kitchenTart: state.kitchenTart,
      kitchenPreserves: state.kitchenPreserves, cookingFish: state.cookingFish, inventoryGroup: state.inventoryGroup, warehouseRequest: state.selectedWarehouseRequest,
      marketTab: state.marketTab, marketCategory: state.marketCategory, marketNextOpen: [], signatureSlots: [null,null], previewSeed: state.previewSeed, scroll: state.dialogContent.scrollTop }),
    drawPanel: () => { state.draws++; state.visits.push(state.panel); state.html = state.panel === 'kitchen' ? state.kitchenFamilies() : state.panel==='village'?state.neighboursCard():''; state.panelRenderVersion++ },
  }
  const markFocus=(id:string)=>state.focusTrace.push(id)
  const code=ts.transpileModule(sourceHarness,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
  runInNewContext(code,state)
  state.click=(action:string,value?:string,family?:string)=>{
    const candidate=buttons(state.html,markFocus).find(node=>!node.disabled&&node.dataset.action===action&&node.dataset.value===value)
    assert.ok(candidate,`Control ${action} ${value??''} not available`)
    state.clickFocus=candidate
    state.choose(action,value,family)
  }
  return state
}
const opening=JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json',import.meta.url),'utf8'))
function earned(n:number){
 const p=commissionPlayer(opening.slice(0,n));p.fruit('apple',2);p.visit('village')
 assert.ok(p.state.village.built);assert.equal(p.state.village.residents[0],'bea')
 assert.deepEqual(F.dishIds.filter(id=>F.getCookAction(p.state,id).available),['appleJam'])
 return p
}
const active=(s:ReturnType<typeof screen>)=>[...s.html.matchAll(/<button\b[^>]*data-action="cook"[^>]*>/g)].map(([a])=>({id:a.match(/data-value="([^"]+)"/)?.[1],disabled:/\sdisabled(?:[\s>]|=)/.test(a)}))

test('sole cookable jam is first from the ordinary cold Harbour cottage, and Back returns exact card and cottage control',()=>{
 for(const [n,actions,day] of [[80,85,9],[90,95,11]]){
  const p=earned(n);assert.deepEqual([p.actions,p.state.day],[actions,day])
  const before=structuredClone(p.state),s=screen(p.state)
  s.drawPanel();assert.match(s.html,/<h2>Беа<\/h2>/)
  s.dialogContent.scrollTop=41;s.click('kitchen')
  assert.equal(s.panel,'kitchen');assert.equal(s.kitchenGroup,undefined,'not a lasting group choice')
  assert.equal(s.panelHistory[0].cottageKitchenDish,'appleJam')
  assert.deepEqual(active(s),[{id:'appleJam',disabled:false}])
  assert.deepEqual([...s.html.matchAll(/data-action="kitchen-group" data-value="([^"]+)"/g)].map(m=>m[1]),['tart','preserves','dishes'])
  assert.match(s.html,/data-action="open-panel"[^>]*data-value="recipes"/)
  s.dialogContent.scrollTop=27
  s.click('cook','appleJam');assert.equal(s.panel,'cookery');assert.equal(s.cookingDish,'appleJam')
  assert.equal(s.saves,0);assert.deepEqual(p.state,before)
  s.goBack(true);assert.equal(s.panel,'kitchen');assert.deepEqual(active(s),[{id:'appleJam',disabled:false}])
  assert.equal(s.focusTrace.at(-1),'cook:appleJam');assert.equal(s.dialogContent.scrollTop,27)
  s.goBack(true);assert.equal(s.panel,'village');assert.equal(s.villageSlot,0)
  assert.equal(s.focusTrace.at(-1),'kitchen');assert.equal(s.dialogContent.scrollTop,41)
  assert.equal(s.saves,0);assert.deepEqual(p.state,before)
  console.log(JSON.stringify({day,actualPath:['kitchen','cook:appleJam'],focus:s.focusTrace,unchanged:true}))
 }
})

test('finishing with the last two apples still returns to that exact jam card, now disabled, not a different recipe',()=>{
 const p=earned(80),f=p.state,s=screen(f),before=structuredClone(f)
 assert.equal(f.fruit.apple,2)
 s.drawPanel();s.click('kitchen');s.click('cook','appleJam')
 assert.ok(F.cookDish(f,'appleJam',{family:'preserves',processing:'silky',fruit:[],steps:['mix','pour']}).ok)
 assert.equal(f.fruit.apple,before.fruit.apple-2);assert.equal(f.dishes.appleJam,before.dishes.appleJam+1)
 assert.deepEqual(F.restoreCurrentFarm(JSON.parse(JSON.stringify(f))),f)
 const done=structuredClone(f)
 s.goBack(true)
 assert.equal(s.panel,'kitchen');assert.deepEqual(active(s),[{id:'appleJam',disabled:true}])
 assert.equal(s.focusTrace.at(-1),'close','does not arm a different action when Cook is now disabled')
 s.goBack(true);assert.equal(s.panel,'village');assert.equal(s.focusTrace.at(-1),'kitchen')
 assert.deepEqual(f,done)
})

test('manual categories and explicit recipe navigation, missing or ambiguous food, and a later unrelated visit do not inherit it',async()=>{
 const p=earned(80),before=structuredClone(p.state)
 const explicit=screen(p.state);explicit.kitchenGroup='tart';explicit.kitchenTart='blueberryTart';explicit.drawPanel();explicit.click('kitchen')
 assert.deepEqual(active(explicit),[{id:'blueberryTart',disabled:true}]);assert.equal(explicit.panelHistory[0].cottageKitchenDish,undefined)
 const context=screen(p.state);context.panel='inventory';context.openPanel('kitchen')
 assert.deepEqual(active(context),[{id:'orchardTart',disabled:true}]);assert.equal(context.panelHistory[0].cottageKitchenDish,undefined)
 const separate=screen(p.state);separate.drawPanel();separate.click('kitchen');separate.closeDialog()
 separate.panel='inventory';separate.dialog.open=true;separate.openPanel('kitchen')
 assert.deepEqual(active(separate),[{id:'orchardTart',disabled:true}]);assert.equal(separate.panelHistory.length,1)
 const direct=screen(p.state);direct.openPanel('kitchen',true,'village','page.unfold',undefined,{grillFish:'perch'})
 assert.deepEqual(active(direct),[{id:'grilledFish',disabled:true}]);assert.equal(direct.panelHistory[0].cottageKitchenDish,undefined)
 const p2=commissionPlayer(opening.slice(0,80)),empty=screen(p2.state)
 empty.drawPanel();empty.click('kitchen');assert.deepEqual(active(empty),[{id:'orchardTart',disabled:true}])
 assert.equal(empty.panelHistory[0].cottageKitchenDish,undefined)
 // Ordinary real simultaneous cookability: harvest and grow wheat rather than inserting stock.
 const two=commissionPlayer(opening.slice(0,80));two.fruit('apple',2);two.visit('home')
 if(two.state.eggs<1){if(!two.state.feed)two.act('buyFeed');two.act('feedChickens');two.night();two.act('collectEggs')}
 for(let day=0;two.state.produce.wheat===0;day++){
  assert.ok(day<8)
  const bed=two.state.beds[0]
  if(F.getBedStage(bed)==='ripe'){two.act('workBed',0);if(two.state.produce.wheat>0)break}
  if(two.state.beds[0].kind==='tilled'){
   if(!two.state.seeds.wheat)two.act('buySeeds','wheat')
   if(two.state.selectedSeed!=='wheat')two.act('selectSeed','wheat')
   two.act('workBed',0)
  }
  if(F.getBedAction(two.state,0).kind==='water'){if(!two.state.water)two.act('refillWater');two.act('workBed',0)}
  two.night()
 }
 two.visit('village')
 assert.ok(F.getCookAction(two.state,'orchardTart').available);assert.ok(F.getCookAction(two.state,'appleJam').available)
 const unranked=screen(two.state);unranked.drawPanel();unranked.click('kitchen')
 assert.deepEqual(active(unranked),[{id:'orchardTart',disabled:false}]);assert.equal(unranked.panelHistory[0].cottageKitchenDish,undefined)
 assert.deepEqual(p.state,before)
})
function earnedCottageAlternatives() {
 const p=commissionPlayer(opening.slice(0,80))
 p.fruit('apple',2);p.visit('grove')
 if(!p.state.saltGatheredToday)p.act('gatherSeaSalt')
 if(!p.state.fish.perch&&!p.state.fish.seaBass){
  const trip=p.act('beginFishingTrip');p.act('finishFishingTrip',trip.token,1)
 }
 p.visit('home')
 if(p.state.produce.wheat)p.act('sellMarketItem','produce:wheat',p.state.produce.wheat)
 p.visit('village')
 const fish=F.getGrillFish(p.state)
 assert.deepEqual([p.actions,p.state.day,p.state.village.residents[0],fish],[90,9,'bea','seaBass'])
 assert.deepEqual(F.dishIds.filter(dish=>F.getCookAction(p.state,dish,fish).available),['grilledFish','appleJam'])
 return {p,fish}
}

test('earned Bea cottage with a blocked default presents both cookable dishes before the other categories, without taking either',()=>{
 const {p,fish}=earnedCottageAlternatives(), before=structuredClone(p.state)
 for(const dish of ['grilledFish','appleJam'] as const) {
  const s=screen(p.state);s.kitchenDish='grilledFish';s.cookingFish=fish;s.drawPanel()
  s.dialogContent.scrollTop=41;s.click('kitchen')
  assert.match(s.html,/class="kitchen-workbench kitchen-ready-workbench"/)
  const ready=s.html.indexOf('aria-label="Можно приготовить"'), browse=s.html.indexOf('aria-label="Разделы кухни"')
  assert.ok(ready>=0&&browse>ready)
  assert.deepEqual([...s.html.matchAll(/data-family="ready" data-value="([^"]+)"/g)].map(x=>x[1]),['grilledFish','appleJam'])
  assert.deepEqual(active(s),[{id:'grilledFish',disabled:false}])
  assert.match(s.html,/data-action="open-panel"[^>]*data-value="recipes"/)
  assert.deepEqual([...s.html.matchAll(/data-action="kitchen-group" data-value="([^"]+)"/g)].map(x=>x[1]),['tart','preserves','dishes'])
  s.click('recipe-family',dish,'ready')
  assert.deepEqual(active(s),[{id:dish,disabled:false}])
  s.dialogContent.scrollTop=27;s.click('cook',dish)
  assert.equal(s.panel,'cookery');assert.equal(s.cookingDish,dish)
  assert.equal(s.saves,0);assert.deepEqual(p.state,before)
  s.goBack(true);assert.equal(s.panel,'kitchen');assert.equal(s.dialogContent.scrollTop,27)
  assert.deepEqual(active(s),[{id:dish,disabled:false}]);assert.equal(s.focusTrace.at(-1),'cook:'+dish)
  s.goBack(true);assert.equal(s.panel,'village');assert.equal(s.villageSlot,0);assert.equal(s.dialogContent.scrollTop,41)
  assert.equal(s.focusTrace.at(-1),'kitchen');assert.equal(s.saves,0);assert.deepEqual(p.state,before)
 }
})

test('after actually cooking the last two apples, Back shows the same unavailable jam instead of arming the other valid dish',()=>{
 const {p,fish}=earnedCottageAlternatives(),f=p.state
 const initial=structuredClone(f),s=screen(f);s.kitchenDish='grilledFish';s.cookingFish=fish;s.drawPanel();s.click('kitchen')
 s.click('recipe-family','appleJam','ready');s.click('cook','appleJam')
 assert.deepEqual(f,initial)
 assert.equal(f.fruit.apple,2)
 assert.ok(F.cookDish(f,'appleJam',{family:'preserves',processing:'silky',fruit:[],steps:['mix','pour']}).ok)
 const made=structuredClone(f)
 s.goBack(true);assert.equal(s.panel,'kitchen')
 assert.deepEqual(active(s),[{id:'appleJam',disabled:true}]);assert.equal(s.focusTrace.at(-1),'close')
 assert.ok(F.getCookAction(f,'grilledFish',fish).available)
 s.goBack(true);assert.equal(s.panel,'village');assert.equal(s.focusTrace.at(-1),'kitchen');assert.deepEqual(f,made)
})

const cookeryProduction = source.slice(source.indexOf("    case 'cookery': {"),source.indexOf("    case 'village-project':"))
const cookeryMount = ts.transpileModule(`switch('cookery'){ ${cookeryProduction} }`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
const jamResult={family:'preserves',processing:'silky',fruit:[],steps:['mix','pour']} as const

function homeKitchenPrep(sharedLastApples=false) {
 const p=sharedLastApples ? commissionPlayer(opening.slice(0,80)) : earnedCottageAlternatives().p
 p.fruit('apple',2);p.visit('home')
 if(sharedLastApples){
  for(let days=0;!p.state.produce.wheat;days++){
   assert.ok(days<8)
   if(F.getBedStage(p.state.beds[0])==='ripe')p.act('workBed',0)
   if(p.state.produce.wheat)break
   if(p.state.beds[0].kind==='tilled'){
    if(!p.state.seeds.wheat)p.act('buySeeds','wheat')
    if(p.state.selectedSeed!=='wheat')p.act('selectSeed','wheat')
    p.act('workBed',0)
   }
   if(F.getBedAction(p.state,0).kind==='water'){if(!p.state.water)p.act('refillWater');p.act('workBed',0)}
   p.night()
  }
  if(p.state.honey)p.act('sellMarketItem','honey',p.state.honey)
 }
 const f=p.state,s=screen(f),fish=F.getGrillFish(f);s.panel='rest';s.cookingFish=fish
 assert.match(source,/button\('Открыть кухню', 'kitchen'\)/)
 s.choose('kitchen',undefined,undefined)
 assert.deepEqual(JSON.parse(JSON.stringify(s.walkTargets)),[{kind:'kitchen'}])
 assert.equal(s.panelHistory[0].panel,'rest')
 assert.equal(f.fruit.apple,2)
 assert.deepEqual(F.dishIds.filter(dish=>F.getCookAction(f,dish,fish).available),[sharedLastApples?'orchardTart':'grilledFish','appleJam'])
 s.click('recipe-family','appleJam','ready')
 s.click('cook','appleJam')
 assert.equal(s.panel,'cookery')
 Object.assign(s,{signatureBase:'tart',signatureSlots:[null,null],signatureRepeatId:undefined,signatureFamily:undefined,cookeryGame:undefined,
  iconUrl:(picture:string)=>picture,signatureFruitIds:['apple'],signatureFruitNames:{apple:'Яблоко'},signatureBookCapacity:()=>({canCreate:true}),
  createCookery(_host:unknown,options:Record<string,any>){s.cookeryOptions=options;return {destroy(){}}}})
 runInNewContext(cookeryMount,s)
 assert.equal(s.cookeryOptions.recipe.id,'appleJam');assert.equal(s.cookeryOptions.returnLabel,'На кухню')
 return {p,s,f,fish}
}

test('Home cottage retains the chosen recipe after spending its last apples and shows the next actual dish without picking it',t=>{
 const {p,s,f,fish}=homeKitchenPrep(),before=structuredClone(f)
 assert.deepEqual([p.actions,f.day],[91,9])
 assert.equal(s.cookeryOptions.onComplete(jamResult),true)
 assert.equal(s.cookeryOptions.onComplete(jamResult),true,'same completion callback cannot spend twice')
 const done=structuredClone(f);assert.equal(s.saves,1)
 assert.equal(f.fruit.apple,0);assert.equal(f.dishes.appleJam,before.dishes.appleJam+1);assert.equal(f.coins,before.coins)
 s.cookeryOptions.onCancel()
 assert.equal(s.panel,'kitchen');assert.equal(f.island,'home')
 assert.deepEqual(f,done);assert.ok(F.getCookAction(f,'grilledFish',fish).available)
 const rendered=s.html;const ready=rendered.indexOf('aria-label="Можно приготовить"'),books=rendered.indexOf('aria-label="Разделы кухни"')
 t.diagnostic(JSON.stringify({day:f.day,ordinaryActions:p.actions,sameIsland:f.island,visibleRecipe:active(s),focus:s.focusTrace.at(-1),fishStillReady:true,jamGained:f.dishes.appleJam-before.dishes.appleJam,saves:s.saves}))
 assert.deepEqual(active(s),[{id:'appleJam',disabled:true}],'return to the original recipe, not a different cooking action')
 assert.equal(s.focusTrace.at(-1),'heading:Яблочное варенье')
 assert.ok(ready>=0&&books>ready)
 assert.match(rendered,/<button[^>]+data-family="ready" data-value="grilledFish" aria-pressed="false"/)
 assert.match(rendered,/data-action="open-panel"[^>]*data-value="recipes"/)
 assert.deepEqual([...rendered.matchAll(/data-action="kitchen-group" data-value="([^"]+)"/g)].map(m=>m[1]),['tart','preserves','dishes'])
 s.choose('recipe-family','appleJam','ready')
 assert.equal(s.html,rendered,'a stale ready choice cannot select the spent recipe')
 s.click('recipe-family','grilledFish','ready')
 assert.deepEqual(active(s),[{id:'grilledFish',disabled:false}])
 assert.equal(s.focusTrace.at(-1),'recipe-family:grilledFish','focus stays on browsing, not on cooking')
 assert.deepEqual(f,done);assert.equal(s.saves,1)
 s.goBack(true)
 assert.equal(s.panel,'rest');assert.equal(f.island,'home');assert.deepEqual(f,done)
})

test('an unfinished Home Cancel preserves the exact live recipe and focus without spending or travelling',()=>{
 const {s,f}=homeKitchenPrep(),before=structuredClone(f)
 s.cookeryOptions.onCancel()
 assert.equal(f.island,'home');assert.equal(s.panel,'kitchen');assert.equal(s.saves,0)
 assert.deepEqual(active(s),[{id:'appleJam',disabled:false}]);assert.deepEqual(f,before)
 assert.equal(s.focusTrace.at(-1),'cook:appleJam')
 assert.doesNotMatch(s.html,/data-kitchen-return-dish/)
})

test('two real dishes sharing the last apples do not leave a false ready choice after completion',()=>{
 const {s,f,fish}=homeKitchenPrep(true)
 assert.equal(s.cookeryOptions.onComplete(jamResult),true);const done=structuredClone(f)
 s.cookeryOptions.onCancel()
 assert.deepEqual(F.dishIds.filter(dish=>F.getCookAction(f,dish,fish).available),[])
 assert.equal(s.panel,'kitchen');assert.equal(f.island,'home')
 assert.deepEqual(active(s),[{id:'appleJam',disabled:true}]);assert.equal(s.focusTrace.at(-1),'heading:Яблочное варенье')
 assert.doesNotMatch(s.html,/aria-label="Можно приготовить"/)
 assert.deepEqual(f,done);assert.equal(s.saves,1)
})


test('a fresh kitchen visit picks the live recipe rather than carrying a previous spent-return marker',()=>{
 const {s,f}=homeKitchenPrep()
 assert.equal(s.cookeryOptions.onComplete(jamResult),true);s.cookeryOptions.onCancel()
 assert.deepEqual(active(s),[{id:'appleJam',disabled:true}])
 const done=structuredClone(f)
 s.goBack(true)
 assert.equal(s.panel,'rest');s.openPanel('kitchen')
 assert.deepEqual(active(s),[{id:'grilledFish',disabled:false}]);assert.doesNotMatch(s.html,/data-kitchen-return-dish/)
 assert.deepEqual(f,done);assert.equal(s.saves,1);assert.equal(f.island,'home')
})
