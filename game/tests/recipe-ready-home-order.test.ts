import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { runInNewContext } from 'node:vm'
import { commissionPlayer } from './fixtures/commission-player.ts'
import { canSailTo, getSignatureAction, getSignatureCookOutput, ingredientCount, repeatSignature, restoreCurrentFarm, sail, variantLabel, type FarmState, type StockItem } from '../src/farm.ts'
import { signatureFruitNames, signatureProcessingDefinitions } from '../src/culinary.ts'
import { getRecipeRepeatGuide, recipeIngredientsDisclosureLabel } from '../src/recipe-repeat-guidance.ts'
import { lastPortionShopStock, signatureTastingGuide } from '../src/signature-tasting-guidance.ts'
import { signatureBookCapacity } from '../src/signature-book.ts'
import { getStoredSignature, storedSignatureValue } from '../src/stored-signature.ts'
import { RecipeBookNavigation } from '../src/recipe-book-view.ts'
import { ruCount } from '../src/ru.ts'

const read=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8')
const source=read('../src/culinary-ui.ts'),main=read('../src/main.ts')
function between(text:string,first:string,last:string){
 const i=text.indexOf(first),j=text.indexOf(last,i+first.length);assert.ok(i>=0&&j>i);return text.slice(i,j)
}
// Actual recipe sheet markup and actions, without loading Vite, CSS imports or image rendering.
const sheet=stripTypeScriptTypes(between(source,'export const escapeRecipeText','export const ingredientArt').replace('export ','')+
 between(source,'const control=','export function finishedIcon')+
 between(source,'const capacityDescription','export function recipeBookSearchStatus')+'\n;bookRecipe')
const makeSheet=runInNewContext(sheet,{signatureTastingGuide,lastPortionShopStock,signatureBookCapacity,getSignatureAction,getSignatureCookOutput,ingredientCount,ruCount,
 getStoredSignature,storedSignatureValue,getRecipeRepeatGuide,recipeIngredientsDisclosureLabel,canSailTo,variantLabel,signatureFruitNames,signatureProcessingDefinitions,
 ingredientName:(i:{id:string})=>i.id,ingredientArt:(i:string)=>i,finishedIcon:(x:string)=>x,signatureResultPicture:()=>'',
 renderPicnicOffer:()=>'',harvestPicnicOffer:()=>'',renderHarvestPicnicRoute:()=>''})
const inv=between(main,'function inventorySupplies()','function specializationCards()')
const trip=stripTypeScriptTypes(between(main,'async function visitPanelAt(','function openGuidedMarket(')+
 'async function recipeHome(){switch("recipe-repeat-home"){'+between(main,"    case 'recipe-repeat-home':","    case 'recipe-warehouse-withdraw':")+'}};recipeHome')
const opening=JSON.parse(read('./fixtures/home-progress-actions.json'))
function earned(){
 const p=commissionPlayer(opening.slice(0,19))
 p.fruit('apple',4)
 while (p.state.eggs<2) { p.act('feedChickens');p.night();p.act('collectEggs') }
 const prior=p.state.fruit.apple
 assert.ok(p.state.produce.wheat>=2)
 const made=p.act('completeSignature',{base:'tart',ingredients:[{id:'apple',quantity:2}]},
   {family:'decorate',processing:'chunky',fruit:[{ingredientId:'apple',x:.2,y:-.3,angle:.4}],steps:['fruit','bake'],baking:{method:'oven',finish:'golden',seconds:90}})
 const id=String(made.recipeId);assert.equal(p.state.fruit.apple,prior-2)
 assert.ok(getRecipeRepeatGuide(p.state,id)?.available)
 p.visit('grove')
 return {p,id}
}
const actions=(html:string)=>{
 const pane=html.split('<section class="recipe-book-cooking"')[1]?.split('<section class="recipe-book-uses"')[0]
 assert.ok(pane)
 return [...pane.matchAll(/<button\b[^>]*data-action="([^"]+)"[^>]*>/g)].map(([markup,key])=>({key,disabled:/\sdisabled(?:\s|>)/.test(markup)}))
}
const parts=(html:string)=>{
 const back=html.indexOf('data-action="recipe-repeat-home"')
 const guide=/<details data-repeat-guide="[^"]+"( open)?>/.exec(html)
 assert.ok(guide);const end=html.indexOf('</details>',guide.index)
 return {back,open:!!guide[1],earlierBack:back>=0&&back<guide.index,itemRowsBeforeTravel:guide.index<back?
   ((html.slice(guide.index,Math.min(end,back)).match(/data-stock="/g)??[]).length):0}
}
function view(farm:FarmState,id:string,expanded=false){
 const recipe=farm.culinary.recipes.find(row=>row.id===id);assert.ok(recipe)
 const nav=new RecipeBookNavigation();assert.ok(nav.select(farm,id,expanded,true))
 const h=makeSheet(farm,recipe,{icon:()=>'',stock:(i:StockItem)=>`<li data-stock="${i.kind}">${ingredientCount(farm,i)}/${i.quantity}</li>`},nav.view) as string
 return {nav,h,a:actions(h),order:parts(h)}
}
function tripFrom(farm:FarmState,id:string,nav:RecipeBookNavigation){
 const calls:string[]=[]
 const ctx={farm,value:id,recipeBook:nav,expandedRepeatId:undefined,panel:'recipes',dialog:{open:true},panelHistory:[{panel:'inventory'}],canSailTo,sail,
  fieldViewButton:{getAttribute:()=> 'false'},rememberPanel:()=>({panel:ctx.panel}),
  closeDialog(){calls.push('close');ctx.panel='';ctx.panelHistory.length=0;ctx.dialog.open=false},
  island:{isCrossing:()=>false,async crossIsland(done:()=>boolean){calls.push('sail');assert.ok(done())}},
  openPanel(panel:string){ctx.panel=panel;ctx.dialog.open=true;calls.push(panel)},
  perform(work:()=>{ok:boolean}){return work().ok},drawPanel(){calls.push('draw')},focusRecipeAction(){calls.push('focus')}
 }
 return {calls,ctx,go:runInNewContext(trip,ctx) as()=>Promise<void>}
}
test('a fully supplied earned repeat puts its one live Home action before the optional ingredient scan',async t=>{
 const {p,id}=earned(),farm=p.state,before=structuredClone(farm),guide=getRecipeRepeatGuide(farm,id)!
 assert.equal(guide.away,true);assert.equal(guide.available,false);assert.equal(guide.missing.length,0)
 // Actual Inventory's Kitchen category takes this path to the book even on a visit away.
 assert.match(inv,/inventoryGroup==='kitchen'[^\n]*'Мои рецепты'[^\n]*'open-panel'[^\n]*value:'recipes'/)
 assert.match(main,/case 'open-panel': if\(value&&value in panelTitles\)openPanel\(value as Panel\)/)
 const {nav,a,order,h}=view(farm,id)
 t.diagnostic(JSON.stringify({day:farm.day,actions:p.actions,recipe:id,island:farm.island,ingredients:guide.items.length,earliestControl:a[0],order}))
 assert.deepEqual(a[0],{key:'recipe-repeat-home',disabled:false})
 assert.equal(a.filter(x=>x.key==='recipe-repeat-home').length,1)
 assert.equal(order.earlierBack,true);assert.equal(order.open,false);assert.equal(order.itemRowsBeforeTravel,0)
 assert.match(h,/Ингредиенты на 1 порцию/);for(const item of guide.items) assert.match(h,new RegExp(`data-stock="${item.kind}"`))
 assert.equal(view(farm,id,true).order.open,true,'explicitly inspected ingredients still stay open')
 assert.deepEqual(farm,before,'display and selection do not sail, spend or prepare')
 const user=tripFrom(farm,id,nav);await user.go()
 assert.deepEqual(user.calls,['close','sail','recipes','draw','focus'])
 assert.deepEqual(user.ctx.panelHistory,[{panel:'inventory'}])
 assert.equal(user.ctx.recipeBook.view.selectedId,id)
 assert.deepEqual(farm,{...before,island:'home'})
 assert.equal(getRecipeRepeatGuide(farm,id)?.available,true)
 const home=view(farm,id);assert.equal(home.order.back,-1);assert.equal(home.a[0]?.key,'make-signature');assert.equal(home.a[0]?.disabled,false)
 assert.equal(repeatSignature(farm,id).ok,true);assert.equal(farm.culinary.stock[id],(before.culinary.stock[id]??0)+1)
 assert.deepEqual(restoreCurrentFarm(JSON.parse(JSON.stringify(farm))),farm)
})
test('truly missing exact ingredients still lead with recovery, not with a misleading ready trip',()=>{
 const {p,id}=earned();p.visit('home');p.act('sellMarketItem','fruit:apple',p.state.fruit.apple);p.visit('grove')
 const f=p.state,before=structuredClone(f),guide=getRecipeRepeatGuide(f,id)!
 assert.deepEqual(guide.missing,[{kind:'fruit',item:'apple',quantity:2}])
 const {order,a,h}=view(f,id)
 assert.equal(a[0]?.key,'make-signature');assert.equal(a[0]?.disabled,true)
 assert.equal(order.earlierBack,false);assert.equal(order.open,true)
 assert.equal(order.itemRowsBeforeTravel,3)
 assert.match(h,/data-stock="fruit">0\/2/)
 assert.equal(a.filter(x=>x.key==='recipe-repeat-home').length,1,'the original explicit travel remains a choice')
 assert.deepEqual(f,before)
})
