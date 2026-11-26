import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import test from 'node:test'
import {runInNewContext} from 'node:vm'
import * as F from '../src/farm.ts'
import * as C from '../src/shop-commissions.ts'
import * as culinary from '../src/culinary.ts'
import {signatureBookCapacity} from '../src/signature-book.ts'
import {RecipeBookNavigation} from '../src/recipe-book-view.ts'
import {firstCommissionReturnPlayer} from './fixtures/harbour-craft-return.ts'

const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8'),book=readFileSync(new URL('../src/culinary-ui.ts',import.meta.url),'utf8')
function part(a:string,b:string){
 const i=main.indexOf(a),j=main.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,a);return main.slice(i,j)
}
const code=stripTypeScriptTypes(part('function openRecipeBook(','function updateRecipeBookSearch(')
 +part('function focusKey(','function leaveScene(')+part('function leaveScene()','function rememberPanel()')
 +part('function goBack(','let harbourScene:')
 + "function choose(action,value){switch(action){"+part("    case 'commission-recipe':","    case 'commission-rest':")
 +part("    case 'manual-signature':","    case 'batch-signature':")+"}}"
 +"function mount(){switch ('cookery') {"+part("    case 'cookery': {","    case 'village-project': dialogContent.innerHTML")+"}}")
assert.match(book,/control\('Готовить вручную','manual-signature',recipe\.id/)
const {p,recipeId}=firstCommissionReturnPlayer(false)
p.cook(recipeId)
p.act('acceptShopCommission',C.getShopCommissionOffers(p.state)[0].key)
p.act('deliverShopCommission',String(p.state.shopCommissions.serial))
p.fruit('apple',1);p.fruit('pear',1);p.visit('village')
const state=structuredClone(p.state)
const recipe=state.culinary.recipes.find(r=>r.id===recipeId)!
const token=C.getShopCommission(state)!.lines[0].actionValue
assert.equal(C.getShopCommissionLine(state,token)?.remaining,1)
assert.equal(C.getShopCommissionLine(state,token)!.inBag+C.getShopCommissionLine(state,token)!.warehouse,0)
assert.ok(F.getSignatureAction(state,recipe).available)
type Result=typeof recipe.result

function harness(origin:'shop-commissions'|'journal'='shop-commissions'){
 const farm=structuredClone(state),recipeBook=new RecipeBookNavigation(),writes:F.FarmState[]=[],focus:string[]=[]
 const clicked=(action:string,value:string,tag=action)=>({dataset:{action,value},getClientRects:()=>[{}],focus:()=>focus.push(tag),scrollIntoView:()=>focus.push('reveal:'+tag)})
 const orderRecipe=clicked('commission-recipe',token),deliver=clicked('commission-deliver',token),wrong=clicked('commission-deliver','999')
 Object.assign(recipeBook,{restore(){focus.push('recipe restored')}})
 const ctx:any={...F,...C,...culinary,farm,recipeBook,signatureBookCapacity,panel:origin,panelHistory:[{panel:'guide'}],panelRenderVersion:0,
  cookingDish:'appleJam',cookingFish:'seaBass',cookingMode:'dish',signatureBase:'preserves',signatureSlots:[],signatureFamily:undefined,signatureRepeatId:undefined,
  communityRequest:undefined,dialog:{open:true,querySelectorAll:()=>[orderRecipe,wrong,deliver]},island:{isCrossing:()=>false},
  dialogContent:{innerHTML:'',scrollTop:0,querySelector:()=>null,querySelectorAll:(selector:string)=>
    selector==='[data-action="commission-deliver"]:not(:disabled)'&&C.getShopCommissionLine(farm,token)?.canDeliver?[wrong,deliver]:[]},
  expandedRepeatId:undefined,stockLabel:(item:F.StockItem)=>({name:F.marketKey(item),image:''}),iconUrl:()=>'',familyRecipeName:()=>undefined,
  cookeryGame:undefined,focusRecipeAction(){},restoreFerryPanelView(){},requestAnimationFrame:(f:()=>void)=>f(),closeDialog(){throw Error('unexpected close')},
  createCookery(_host:unknown,options:unknown){ctx.options=options;return{destroy(){}}},
  perform(fn:()=>F.ActionResult){const r=fn();if(r.ok){assert.ok(F.restoreCurrentFarm(farm));writes.push(structuredClone(farm))}return r.ok},
  openPanel(next:string,remember=true,_island?:F.IslandId,_sound?:string,id?:string){
   if(remember)ctx.panelHistory.push({panel:ctx.panel,focus:JSON.stringify(Object.entries(orderRecipe.dataset)),scroll:0,marketNextOpen:[],
     signatureSlots:ctx.signatureSlots.map((p:any)=>p&&({...p})),recipeBook:recipeBook.snapshot(ctx.dialogContent)})
   ctx.panel=next;ctx.panelRenderVersion++
   if(next==='recipes'&&id)recipeBook.select(farm,id)
  },
 }
 runInNewContext(code,ctx)
 if(origin==='shop-commissions')ctx.choose('commission-recipe',token);else ctx.openRecipeBook(recipeId)
 assert.equal(ctx.panel,'recipes');assert.equal(recipeBook.view.selectedId,recipeId)
 const originating=ctx.panelHistory.at(-1),before=structuredClone(farm)
 ctx.choose('manual-signature',recipeId);assert.equal(ctx.panel,'cookery');ctx.mount()
 assert.ok(ctx.options);assert.equal(ctx.options.returnLabel,'Мои рецепты');assert.deepEqual(farm,before)
 return {ctx,farm,writes,focus,originating,before,recipeBook,complete(result:Result=recipe.result){return ctx.options.onComplete(structuredClone(result))}}
}

test('earned shop recipe manual Cancel preserves the actual recipe-to-order Back path and cannot spend',t=>{
 const s=harness()
 t.diagnostic(JSON.stringify({earnedDay:s.farm.day,ordinaryActions:p.actions,recipe:recipeId,order:token,oneMissing:1,originalStack:s.ctx.panelHistory.map((v:any)=>v.panel)}))
 s.ctx.options.onCancel()
 assert.equal(s.ctx.panel,'recipes');assert.equal(s.recipeBook.view.selectedId,recipeId)
 assert.equal(s.ctx.panelHistory.at(-1),s.originating,'manual Cancel discarded the exact order origin')
 assert.deepEqual(s.writes,[]);assert.deepEqual(s.farm,s.before)
 s.focus.length=0;s.ctx.goBack(true)
 assert.equal(s.ctx.panel,'shop-commissions');assert.ok(s.focus.includes('commission-recipe'))
 assert.ok(!s.focus.includes('commission-deliver'));assert.deepEqual(s.farm,s.before)
})

test('the very same hand-cooked recipe completes the last missing portion but does not reserve or pay it',()=>{
 const s=harness();assert.equal(s.complete(),true)
 assert.equal(s.complete(),true);assert.equal(s.writes.length,1)
 assert.equal(s.farm.culinary.stock[recipeId],(s.before.culinary.stock[recipeId]??0)+1)
 assert.equal(s.farm.coins,s.before.coins);assert.deepEqual(s.farm.shopCommissions,s.before.shopCommissions)
 const cooked=structuredClone(s.farm)
 s.ctx.options.onCancel();assert.equal(s.ctx.panel,'recipes')
 assert.equal(s.ctx.panelHistory.at(-1),s.originating,'completed batch discarded the exact order origin')
 assert.equal(s.recipeBook.view.selectedId,recipeId)
 s.focus.length=0;s.ctx.goBack(true)
 assert.equal(s.ctx.panel,'shop-commissions')
 assert.ok(s.focus.includes('commission-deliver'));assert.ok(s.focus.includes('reveal:commission-deliver'))
 assert.deepEqual(s.farm,cooked);assert.equal(s.writes.length,1)
})

test('a newly invented preparation, retired line or ordinary library entry never pretends to fill this order',()=>{
 for(const variant of ['new-style','retired','ordinary'] as const){
   const s=harness(variant==='ordinary'?'journal':'shop-commissions')
   if(variant==='retired')assert.ok(C.cancelShopCommission(s.farm,token).ok)
   const result=variant==='new-style'?{...recipe.result,processing:'bright' as const}:recipe.result
   assert.ok(s.complete(result));const cooked=structuredClone(s.farm)
   s.ctx.options.onCancel();assert.equal(s.ctx.panel,'recipes');assert.equal(s.ctx.panelHistory.length,0)
   assert.ok(!s.focus.includes('commission-deliver'));assert.deepEqual(s.farm,cooked)
   if(variant==='new-style'){
    assert.notEqual(s.recipeBook.view.selectedId,recipeId);assert.equal(C.getShopCommissionLine(s.farm,token)?.inBag,0)
    assert.equal(s.farm.culinary.stock[s.recipeBook.view.selectedId!],1)
   }
 }
})
