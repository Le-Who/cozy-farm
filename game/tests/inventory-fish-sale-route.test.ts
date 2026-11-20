import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
import {runInNewContext} from 'node:vm'
import ts from 'typescript'
import * as F from '../src/farm.ts'
import {transferBayGoods,bayProductId} from '../src/harbour-economy.ts'
import {saleStock,exactSaleQuote} from '../src/exact-sale.ts'
import {SalePresentation} from '../src/sale-presentation.ts'
import {MarketInlineSales} from '../src/market-inline-sale.ts'
import {MarketSaleBrowseMemory} from '../src/market-sale-browse.ts'
import {searchMarketSales} from '../src/market-sale-search.ts'
import {marketSaleFamilies} from '../src/market-sale-family.ts'
import {recipeRepeatReturnFixture} from './fixtures/recipe-repeat-return.ts'
import {ruPlural} from '../src/ru.ts'

// Source-level route/content test; no DOM, crossing animation or native acceptance.
const root=fileURLToPath(new URL('../',import.meta.url)).replace(/\/$/,'')
// Rendering-boundary escaping, not a game or route state adapter.
const escapeHtml=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const source=readFileSync(`${root}/src/main.ts`,'utf8'),ast=ts.createSourceFile('main.ts',source,ts.ScriptTarget.Latest,true)
function find(predicate){let result;function visit(node){if(!result&&predicate(node))result=node;ts.forEachChild(node,visit)}visit(ast);assert.ok(result);return result.getText(ast)}
const declaration=name=>find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name)
const functions=['button','row','nav','quantity','stockLabel','goods','fishImage','fishSource','inventoryStockRow','marketInlineCard','marketSaleResults','marketSaleSearchStatus','marketCards','panelTabs','marketFamilyOptions','marketBulkSaleControls','wholeInventorySaleView','exactSaleCard','beginExactSale','openPanel','rememberClosedMarketSell','closeDialog','perform','refresh','rememberPanel','goBack','focusKey','stockSourceItem','updateSaleQuote','isSaleSurface']
const icons=find(n=>ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>d.name.getText(ast)==='dishIcons'))
const sellView=source.slice(source.indexOf('function marketSellView()'),source.indexOf('function rememberClosedMarketSell()'))
const actions=['fish-market','sell-item','fish-kitchen','open-panel'].map(id=>find(n=>ts.isCaseClause(n)&&n.expression.getText(ast)===`'${id}'`))
const code=ts.transpileModule(`${icons}\n${sellView}\n${functions.map(declaration).join('\n')}\nasync function act(action,value){switch(action){${actions.join('\n')}}}`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
const noop=()=>{}

function earned(destination='grove'){
 let farm=F.createFarm(),commands={...F,transferBayGoods},count=0
 const act=(name,...args)=>{const result=commands[name](farm,...args);assert.ok(result.ok,`${name}: ${result.message}`);const restored=F.restoreCurrentFarm(structuredClone(farm));assert.deepEqual(restored,farm);farm=restored;count++}
 const opening=JSON.parse(readFileSync(`${root}/tests/fixtures/home-progress-actions.json`,'utf8'))
 for(const command of opening){if(command.name==='bakeWorkshop')break;act(command.name,...command.args)}
 assert.equal(count,66)
 if(farm.island!=='home')act('sail','home')
 act('catchFish',true);act('sail','grove');act('catchFish',true)
 if(destination==='home')act('sail','home')
 assert.ok(farm.fish.perch>0&&farm.fish.seaBass>0)
 return farm
}

function screen(farm,query='морковь'){
 const saved=[],crossings=[],visits=[]
 const reset={reset:noop},icon=name=>`<img alt="" data-icon="${name}">`
 const state:any={...F,farm,saleStock,exactSaleQuote,searchMarketSales,marketSaleFamilies,ruPlural,escapeHtml,icon,itemIcon:icon,pastryIcons:{round:'round',long:'long',folded:'folded'},numberFormat:new Intl.NumberFormat('ru-RU'),
  panel:'inventory',panelHistory:[{panel:'guide'}],inventoryGroup:'shore',marketTab:'buy',marketCategory:'trees',marketSellGroup:'harvest',marketSaleQuery:query,marketSaleFamily:'fruit:apple',marketTreeSpaceVisit:undefined,
  salePresentation:new SalePresentation(),marketInlineSales:new MarketInlineSales(),marketSaleBrowse:new MarketSaleBrowseMemory(),selectedSale:undefined,saleQuantity:'',saleReceipt:undefined,
  selectedMarketOrder:undefined,pickedMarketOrder:undefined,hiveFlower:undefined,
  kitchenGroup:'preserves',kitchenDish:'honeyCake',cookingFish:'perch',
  transplantSelection:reset,berryNurserySelection:reset,berryRenewalSelection:reset,gardenEditor:reset,recipeSurplusSelection:reset,seedPickerBed:undefined,celebratedFestival:undefined,
  stopHarbour:noop,stopFishing:noop,stopWorkshop:noop,stopCookery:noop,stopArrangement:noop,playBaySound:noop,updateCommunityReturn:noop,status:noop,notify:noop,
  app:{dataset:{}},toast:{},dialogFeedback:{classList:{toggle:noop},dataset:{}},dialogFeedbackTimer:0,window:{clearTimeout:noop,setTimeout:()=>1},closeButton:{focus:noop},
  dialog:{open:true,showModal(){this.open=true},close(){this.open=false},querySelectorAll:()=>[]},dialogContent:{scrollTop:27,querySelector:()=>null,querySelectorAll:()=>[]},
  island:{isCrossing:()=>false,setViewMode:noop,setCoveFocus:noop,render:noop,crossIsland:async fn=>{crossings.push(farm.island);return fn()}},
  document:{activeElement:null},HTMLButtonElement:class{},recipeBook:{snapshot:()=>({}),load:noop},restoreFerryPanelView:noop,panelRenderVersion:0,requestAnimationFrame:fn=>fn(),
  selectedWarehouseRequest:undefined,selectedExpeditionPort:'mill',selectedExpeditionOffer:'mill-grain',selectedWarehouse:farm.island,freightPlanOpen:false,boatIsland:farm.island,bagTab:'harvest',archiveGroup:'shore',treeSlot:0,previewSeed:farm.selectedSeed,specializationBuilding:'farmhouse',previewSpecialization:undefined,irrigationMode:'row',villageSlot:0,pastryShape:'long',workshopRecipe:'bread',cookingDish:'grilledFish',signatureBase:'tart',signatureSlots:[null,null],signatureSlot:0,signatureRepeatId:undefined,expandedRepeatId:undefined,cookingMode:'dish',communityOrderId:'',communityResident:'bea',requestedFood:undefined,kitchenTart:'orchardTart',kitchenPreserves:'appleJam',honeyKitchenDish:'honeyPear',signatureFamily:'tart',journeyDetailsOpen:false,journalDetailsOpen:false,
  saveFarm:()=>{assert.deepEqual(F.restoreCurrentFarm(structuredClone(farm)),farm);saved.push(structuredClone(farm))},
  drawPanel:()=>{state.panelRenderVersion++;visits.push(state.panel);state.html=state.panel==='market'?state.marketSaleResults():state.panel==='sale'?state.exactSaleCard(false):''},
  // A route cannot execute any sale or meal, even accidentally, in this fixture.
  sellMarketItem(){throw new Error('route attempted sale')},sellSignature(){throw new Error('route attempted sale')},cookDish(){throw new Error('route attempted cooking')},
 }
 runInNewContext(code,state)
 return {state,saved,crossings,visits}
}

function assertRouteOnly(h,before){
 const expected=structuredClone(before)
 if(before.island!=='home')assert.ok(F.sail(expected,'home').ok)
 assert.deepEqual(h.state.farm,expected,'entire canonical farm must equal only the normal sail reducer')
 assert.deepEqual(F.restoreCurrentFarm(structuredClone(h.state.farm)),expected)
 assert.equal(h.saved.length,before.island==='home'?0:1)
 assert.equal(h.crossings.length,before.island==='home'?0:1)
 assert.deepEqual(h.state.farm.fish,before.fish);assert.equal(h.state.farm.coins,before.coins)
}

test('home Supplies fish CTA opens the exact chosen one-unit quote despite an unrelated market query',async t=>{
 for(const fish of ['perch','seaBass']){
  const farm=earned('home'),before=structuredClone(farm),h=screen(farm),key=`fish:${fish}`
  const row=h.state.inventoryStockRow(h.state.goods().find(item=>item.key===key))
  assert.match(row,new RegExp(`data-action="sell-item"[\\s\\S]*?data-value="${key}"`))
  await h.state.act('sell-item',key)
  assert.equal(h.state.panel,'sale');assert.equal(h.state.selectedSale.key,key);assert.equal(h.state.saleQuantity,'1');assert.equal(h.state.saleReceipt,undefined)
  assert.equal(h.state.marketSaleQuery,'морковь');assert.ok(h.state.salePresentation.accepts(h.state.salePresentation.token,h.state.selectedSale))
  const stock=saleStock(farm,h.state.selectedSale),quote=exactSaleQuote(h.state.saleQuantity,stock.count,stock.price)
  assert.equal(quote.valid,true);assert.equal(quote.quantity,1);assert.equal(quote.total,stock.price)
  assert.ok(h.state.html.includes(F.fishDefinitions[fish].name));assert.match(h.state.html,/data-sale-quantity/);assert.equal(h.state.panelHistory.at(-1).panel,'inventory')
  assertRouteOnly(h,before);t.diagnostic(JSON.stringify({route:'home',key,panel:h.state.panel,selected:h.state.selectedSale.key,query:h.state.marketSaleQuery,saves:h.saved.length}))
 }
})

test('away CTA names Home and opens the chosen one-unit quote without selling or resetting search',async()=>{
 for(const query of ['морковь',''])for(const fish of ['perch','seaBass']){
  const farm=earned(),before=structuredClone(farm),h=screen(farm,query),key=`fish:${fish}`
  const row=h.state.inventoryStockRow(h.state.goods().find(item=>item.key===key))
  assert.match(row,new RegExp(`data-action="fish-market"[\\s\\S]*?data-value="${key}"`));assert.match(row,/Продать 1 дома/)
  await h.state.act('fish-market',key)
  assert.equal(h.state.panel,'sale');assert.equal(h.state.selectedSale.key,key);assert.equal(h.state.saleQuantity,'1');assert.equal(h.state.saleReceipt,undefined)
  assert.equal(h.state.marketSaleQuery,query);assert.equal(h.state.marketSaleFamily,'fruit:apple');assert.equal(h.state.marketTab,'buy');assert.equal(h.state.marketSellGroup,'harvest')
  assert.ok(h.state.salePresentation.accepts(h.state.salePresentation.token,h.state.selectedSale));assert.equal(h.state.salePresentation.place,undefined)
  const stock=saleStock(farm,h.state.selectedSale),quote=exactSaleQuote(h.state.saleQuantity,stock.count,stock.price)
  assert.equal(quote.valid,true);assert.equal(quote.quantity,1);assert.equal(quote.total,stock.price)
  assert.ok(h.state.html.includes(F.fishDefinitions[fish].name));assert.match(h.state.html,/data-action="confirm-sale"/)
  assertRouteOnly(h,before)
 }
})

test('Cancel/Back from the arrived quote returns to Home Supplies/Shore, not an old-island page',async()=>{
 const farm=earned(),before=structuredClone(farm),h=screen(farm)
 await h.state.act('fish-market','fish:seaBass')
 assert.equal(h.state.panelHistory.length,1);assert.equal(h.state.panelHistory[0].panel,'inventory');assert.equal(h.state.panelHistory[0].inventoryGroup,'shore')
 h.state.goBack()
 assert.equal(h.state.panel,'inventory');assert.equal(h.state.inventoryGroup,'shore');assert.equal(h.state.panelHistory.length,0);assert.equal(farm.island,'home')
 assert.equal(h.state.marketSaleQuery,'морковь');assert.equal(h.state.marketSaleFamily,'fruit:apple');assert.equal(h.state.marketCategory,'trees');assertRouteOnly(h,before)
 h.state.marketTab='sell';h.state.openPanel('market')
 assert.equal(h.state.marketSaleQuery,'морковь');assertRouteOnly(h,before)
})

test('stale, invalid, no-longer-owned or non-fish entries cannot start the route',async()=>{
 for(const kind of ['closed','other-page','missing','unknown','empty-fish','not-fish']){
  const farm=earned(),before=structuredClone(farm),h=screen(farm)
  let key:any='fish:seaBass'
  if(kind==='closed')h.state.dialog.open=false
  if(kind==='other-page')h.state.panel='kitchen'
  if(kind==='missing')key=undefined
  if(kind==='unknown')key='fish:unknown'
  if(kind==='empty-fish')key='fish:moonfish'
  if(kind==='not-fish')key='fruit:apple'
  const panel=h.state.panel
  await h.state.act('fish-market',key)
  assert.equal(h.state.panel,panel,kind);assert.equal(h.state.selectedSale,undefined,kind);assert.equal(h.crossings.length,0,kind);assert.equal(h.saved.length,0,kind);assert.deepEqual(farm,before,kind)
 }
})

test('a failed crossing never opens a quote or changes the farm',async()=>{
 const farm=earned(),before=structuredClone(farm),h=screen(farm)
 h.state.island.crossIsland=async()=>{h.crossings.push('failed')}
 await h.state.act('fish-market','fish:seaBass')
 assert.equal(h.crossings.length,1);assert.equal(h.state.panel,undefined);assert.equal(h.state.dialog.open,false);assert.equal(h.state.selectedSale,undefined);assert.equal(h.saved.length,0);assert.deepEqual(farm,before)
})

test('live quote recheck after crossing uses the captured fish, not a stale row or another species',async()=>{
 const farm=earned(),h=screen(farm)
 h.state.island.crossIsland=async fn=>{
  h.crossings.push(farm.island);fn()
  // A permitted stock change during the await, not a sale: deposit this species.
  assert.ok(transferBayGoods(farm,'deposit','home',bayProductId({kind:'fish',item:'seaBass',quantity:1}),farm.fish.seaBass).ok)
  assert.deepEqual(F.restoreCurrentFarm(structuredClone(farm)),farm)
 }
 await h.state.act('fish-market','fish:seaBass')
 assert.equal(h.state.panel,'inventory');assert.equal(h.state.inventoryGroup,'shore');assert.equal(h.state.selectedSale,undefined);assert.equal(h.state.salePresentation.token,'');assert.ok(farm.fish.perch>0);assert.equal(farm.fish.seaBass,0)
})

test('duplicate handoff while crossing cannot mount a second quote or cross twice',async()=>{
 const farm=earned(),before=structuredClone(farm),h=screen(farm)
 let arrive:Function=()=>{}
 h.state.island.crossIsland=fn=>{h.crossings.push(farm.island);return new Promise(resolve=>{arrive=()=>{fn();resolve(undefined)}})}
 const first=h.state.act('fish-market','fish:seaBass')
 const duplicate=h.state.act('fish-market','fish:perch')
 assert.equal(h.crossings.length,1);assert.equal(h.state.selectedSale,undefined)
 arrive();await Promise.all([first,duplicate])
 assert.equal(h.state.selectedSale.key,'fish:seaBass');assert.equal(h.visits.filter(panel=>panel==='sale').length,1);assertRouteOnly(h,before)
})

test('the unrelated Grill route continues to carry the selected species without selling',async()=>{
 const farm=earned(),before=structuredClone(farm),h=screen(farm)
 await h.state.act('fish-kitchen','seaBass')
 assert.equal(h.state.panel,'kitchen');assert.equal(h.state.kitchenGroup,'dishes');assert.equal(h.state.cookingFish,'seaBass');assertRouteOnly(h,before)
})

test('Back from My Recipes restores a deep Sell result visit, but not a changed or fresh list', async () => {
 const {farm,recipeId}=recipeRepeatReturnFixture('ready')
 farm.fruit.apple=2
 // A large synthetic stock uses the real market listing and semantic keys.
 for(const item of F.marketStock) if(item.kind==='variants'){
  ;(farm.variants[item.item]??={})[item.trait]=1
  ;(farm.discoveries[item.item]??={})[item.trait]=true
 }
 assert.ok(F.restoreCurrentFarm(structuredClone(farm)))
 const h=screen(farm,''),state=h.state,focus:string[]=[]
 const footer=Object.assign(new state.HTMLButtonElement(),{
  dataset:{action:'open-panel',value:'recipes'},getClientRects:()=>[{}],focus:()=>focus.push('recipes footer'),
 })
 let grid:{scrollTop:number;querySelectorAll(selector:string):unknown[]}|null=null
 state.panel='market';state.marketTab='sell';state.marketSellGroup='harvest';state.marketSaleFamily=undefined
 state.panelTitles={recipes:'Мои рецепты'}
 state.recipeBook.view={mode:'index'}
 state.dialog.querySelectorAll=()=>state.panel==='market'?[footer]:[]
 state.dialogContent.querySelector=(s:string)=>s==='#market-sale-results'?grid:null
 state.drawPanel=()=>{
  state.panelRenderVersion++
  grid=null
  if(state.panel!=='market')return
  state.html=state.marketCards()
  const keys=[...state.html.matchAll(/data-inline-key="([^"]+)"/g)].map(match=>match[1])
  grid={scrollTop:0,querySelectorAll:selector=>selector==='[data-inline-key]'?keys.map(inlineKey=>({dataset:{inlineKey}})):[]}
 }
 state.drawPanel()
 assert.match(state.html,/data-action="open-panel"[^>]*data-value="recipes"/)
 const results=()=>{assert.ok(grid);return grid}
 assert.ok(results().querySelectorAll('[data-inline-key]').length>30)

 async function readRecipeAt(scroll:number) {
  results().scrollTop=scroll;state.dialogContent.scrollTop=34
  state.document.activeElement=footer;focus.length=0
  await state.act('open-panel','recipes')
  assert.equal(state.panel,'recipes')
  assert.equal(grid,null)
 }
 const before=structuredClone(farm)
 await readRecipeAt(1400);state.goBack(true)
 assert.equal(state.marketSellGroup,'harvest')
 assert.equal(results().scrollTop,1400,'Back should keep the nested listing position')
 assert.equal(state.dialogContent.scrollTop,34,'outer scroll is separately restored')
 assert.deepEqual(focus,['recipes footer'],'the existing Back focus does not change')
 assert.deepEqual(farm,before);assert.equal(h.saved.length,0)

 await readRecipeAt(1400)
 assert.ok(F.repeatSignature(farm,recipeId).ok) // explicit repeat uses the last two ordinary apples
 assert.equal(farm.fruit.apple,0)
 const afterRepeat=structuredClone(farm)
 state.goBack(true)
 assert.equal(results().scrollTop,0,'do not reuse an offset after the visible row identities changed')
 assert.doesNotMatch(state.html,/data-inline-key="fruit:apple"/)
 assert.equal(state.dialogContent.scrollTop,34)
 assert.deepEqual(focus,['recipes footer']);assert.deepEqual(farm,afterRepeat);assert.equal(h.saved.length,0)

 await readRecipeAt(900)
 state.marketSaleQuery='яблоко'
 state.openPanel('market')
 assert.equal(state.marketSaleQuery,'яблоко')
 assert.equal(results().scrollTop,0,'a new filtered visit is not a history return')
 assert.deepEqual(farm,afterRepeat);assert.equal(h.saved.length,0)
})
