import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import * as F from '../src/farm.ts'
import * as M from '../src/bay-shop-model.ts'
import * as Q from '../src/bay-shop-quantity.ts'
import * as H from '../src/harbour-economy.ts'
import * as I from '../src/intent-orders.ts'
import { bayProductId } from '../src/bay-product-id.ts'
import * as B from '../src/bay-shop-customers.ts'
import * as D from '../src/bay-shop-day.ts'
import * as R from '../src/bay-shop-speech.ts'
import * as C from '../src/bay-shop-price-copy.ts'
import { ruCount } from '../src/ru.ts'
import { commissionPlayer } from './fixtures/commission-player.ts'

const read=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8')
const app=read('../src/main.ts'),shop=read('../src/bay-shop.ts'),book=read('../src/culinary-ui.ts')
const cut=(s:string,a:string,b:string)=>{const i=s.indexOf(a),j=s.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,a);return s.slice(i,j)}
const opening=JSON.parse(read('./fixtures/home-progress-actions.json'))

function earned() {
 const p=commissionPlayer(opening)
 const id=p.cook();p.cook(id);p.fruit('apple',1);p.fruit('pear',1);p.visit('village')
 const farm=p.state,productId='signature:'+id,food=F.foodDescriptors(farm).find(f=>f.id===productId)!
 assert.deepEqual([farm.day,farm.coins,food.sellPrice,farm.culinary.stock[id]],[15,68,19,2])
 const product:M.BayShopProduct={id:productId,identity:productId,name:food.name,image:'/art/lavender/ui-signature-silky.webp',
  signature:true,basePrice:food.sellPrice,tags:[...food.ingredients,...I.describeFood(food),food.processing!]}
 assert.ok(Q.placeShopQuantity(farm.bayShop,2,{...product,quantity:2},1,(key,n)=>H.reserveShopGoods(farm,key,n)))
 assert.ok(M.setBayShopPrice(farm.bayShop,2,22))
 M.setBayShopOpen(farm.bayShop,true)
 const frame=M.createBayShopWorkClock(farm.bayShop,()=>true,()=>0,coins=>{farm.coins+=coins},()=>{})
 for(let ms=0;ms<=7400;ms+=100)frame(ms)
 assert.deepEqual([farm.bayShop.visitor?.id,farm.bayShop.visitor?.outcome?.kind,farm.bayShop.memories.bea.purchases[productId].liked],[ 'bea','bought',1])
 const recipe=farm.culinary.recipes.find(r=>r.id===id)!
 p.act('repeatSignature',id,recipe.result)
 assert.deepEqual([p.actions,p.state.day,p.state.coins,p.state.culinary.stock[id],p.state.bayShop.slots[0],p.state.bayShop.slots[2]?.quantity],[121,15,90,2,null,0])
 return {farm:p.state,id,productId}
}

// Exercise the real markup expression, production click handler and production shop's quote/submit
// in the existing inert DOM harness. No fabricated earned stock or native app is required.
function entry(farm:F.FarmState,id:string){
 const count=farm.culinary.stock[id]??0,refill=Q.shopRecipeRefill?.(farm,id)
 const expr=cut(book,"count>0&&farm.village.built&&!shopChoice?",'}</div></div>')
 const shopEntry=book.includes('  const shopEntry = ') ? cut(book,'  const shopEntry = ','  const action=') : ''
 const escapeRecipeText=runInNewContext(stripTypeScriptTypes(cut(book,'export const escapeRecipeText','export const ingredientArt').replace('export const','const'))+'\nescapeRecipeText',{})
 return runInNewContext(shopEntry+expr,{farm,count,shopChoice:undefined,refill,recipe:{id},escapeRecipeText,control:(name:string,action:string,value:string,enabled=true,attrs='')=>({name,action,value,enabled,attrs})})
}

async function start(farm:F.FarmState,id:string,stamp:string|undefined){
 const route=cut(app,"    case 'recipe-harbour-shop':","    case 'open-panel':")
 let opened=0,redraw=0
 const control={dataset:{shopRefill:stamp},focus(){}}
 const ctx={farm,panel:'recipes',dialog:{open:true},dialogContent:{contains:(value:unknown)=>value===control},
  island:{isCrossing:()=>false},selectedBookId:()=>id,recipeBook:{view:{}},control,panelHistory:[],
  shopRecipeRefill:Q.shopRecipeRefill,lastPortionShopStock:()=>undefined,
  visitPanelAt(){assert.fail('local or stale local entry never sails')},
  drawPanel:()=>{redraw++},rememberPanel:()=>({panel:'recipes',focus:'same native recipe button',recipeBook:{selectedId:id}}),
  openPanel(next:string,remember:boolean){assert.deepEqual([next,remember],['bay-shop',false]);opened++}}
 const select=runInNewContext(stripTypeScriptTypes('async (value)=>{switch("recipe-harbour-shop"){'+route+'}}'),ctx)
 await select(id)
 return {visit:ctx.panelHistory[0],opened,redraw}
}

const shopHarness=read('./shop-catalog-scroll-owner.test.ts')
const renderer=stripTypeScriptTypes(shop.slice(shop.indexOf('const escape =')).replace('export function mountBayShop','function mountBayShop')+'\nmountBayShop(host,options)')
const nativeMount=cut(shopHarness,'class Element {',"test('the existing layout")
const engine=stripTypeScriptTypes(nativeMount
 .replace('function scene(farm:F.FarmState, recipeProduct?:string)', 'function scene(farm:F.FarmState, recipeProduct?:string, recipeRefill?:Q.ShopRecipeRefill, onClose = () => {})')
 .replace('onClose(){},recipeProduct,returnToRecipe:!!recipeProduct','onClose,recipeProduct,recipeRefill,returnToRecipe:!!(recipeProduct||recipeRefill)')+'\nscene')
assert.match(engine,/function scene\(farm\s*, recipeProduct\s*, recipeRefill\s*, onClose/);assert.match(engine,/onClose,recipeProduct,recipeRefill/)
const appCatalog=stripTypeScriptTypes(cut(app,'function harbourGoods(','function openShopScene(').replaceAll('import.meta.env.BASE_URL','"/"')+'\nharbourGoods()')
const readCatalog=(farm:F.FarmState)=>runInNewContext(appCatalog,{...F,farm,bayProductId,describeFood:I.describeFood,
 stockLabel:(item:F.StockItem)=>({name:bayProductId(item),image:'ui-market'}),iconUrl:(id:string)=>'/art/lavender/'+id+'.webp'})
const appAvailable=stripTypeScriptTypes(cut(app,'  const products = ():','  const source = panelHistory.at(-1)')+'\nproducts()')
const available=(farm:F.FarmState)=>runInNewContext(appAvailable,{farm,harbourGoods:()=>readCatalog(farm)})
const mounted=runInNewContext(engine,
 {model:M,quantities:Q,...B,...D,...R,...C,ruCount,render:renderer,runInNewContext,assert,readCatalog,available,reserveShopGoods:H.reserveShopGoods,returnShopGoods:H.returnShopGoods})
function launch(farm:F.FarmState,id:string,visit:unknown,closed:()=>void){
 let options:any
 const ctx={farm,harbourScene:undefined,nextShopStock:undefined,panelHistory:[visit],getShopCommissionOffers:()=>[],
  mountBayShop(_host:unknown,o:unknown){options=o},harbourGoods:()=>readCatalog(farm),applyIngredientFinishes(){},
  status(){},reserveShopGoods:H.reserveShopGoods,returnShopGoods:H.returnShopGoods,saveHarbour(){},leaveScene:closed,
  shopCommissionView:{},earnHarbourSale(){},textAt(){},bayAudio:{},numberFormat:new Intl.NumberFormat('ru')}
 const open=runInNewContext(stripTypeScriptTypes(cut(app,'function openShopScene(','function earnHarbourSale('))+'\nopenShopScene',ctx)
 open({})
 assert.equal(options.state,farm.bayShop)
 assert.equal(options.recipeRefill?.id,'signature:'+id)
 return mounted(farm,options.recipeProduct,options.recipeRefill,options.onClose)
}

test('earned D15 after the liked cooking-time sale, book previews the same #3/22 and can post exactly one separately',async()=>{
 const {farm,id,productId}=earned()
 const before=structuredClone(farm), control=entry(farm,id)
 assert.equal(control.name,'Своя лавка')
 assert.equal(control.action,'recipe-harbour-shop','the local recipe lost its own shelf and stock-confirm quote')
 const key=/data-shop-refill="([^"]+)"/.exec(control.attrs)?.[1]
 assert.ok(key)
 const path=await start(farm,id,key)
 assert.equal(path.opened,1)
 const visit=path.visit as any
 assert.equal(visit.recipeBook.selectedId,id);assert.equal(visit.harbourRecipe.refill.shelf,2)
 let close=0
 const cancel=launch(farm,id,visit,()=>{close++})
 assert.match(cancel.host.innerHTML,/Место 3 · /)
 assert.match(cancel.get('[data-stock-preview]').textContent,/За 1: 22 монеты/)
 assert.equal(cancel.get('[data-close]').getAttribute('aria-label'),'К рецепту')
 assert.deepEqual(farm,before)
 cancel.click('[data-close]');cancel.destroy();assert.equal(close,1);assert.deepEqual(farm,before)
 assert.equal(visit.harbourRecipe.preview,false)
 const resumed=(await start(farm,id,key)).visit as any
 const ui=launch(farm,id,resumed,()=>{})
 ui.submit();assert.equal(ui.transfers,1)
 assert.deepEqual([farm.bayShop.slots[0],farm.bayShop.slots[2]?.quantity,farm.bayShop.slots[2]?.price,farm.coins,farm.culinary.stock[id],farm.bayShop.sold],[null,1,22,90,1,1])
 assert.equal(farm.bayShop.slots[2]?.product.id,productId)
 assert.ok(F.restoreCurrentFarm(farm))
 assert.equal(resumed.harbourRecipe.preview,false)
 ui.destroy()
 const alternative=structuredClone(before)
 const free=launch(alternative,id,(await start(alternative,id,key)).visit,()=>{})
 free.click('[data-slot="0"]')
 free.click(`[data-stock="${productId}"]`)
 assert.match(free.host.innerHTML,/Место 1 · /)
 assert.match(free.get('[data-stock-preview]').textContent,/За 1: 19 монет/)
 assert.deepEqual(alternative,before);assert.equal(free.transfers,0)
 free.destroy()
})

test('closed, depleted, replaced, wrong-day and ambiguous slots do not claim the old quote; generic browsing stays ordinary',async()=>{
 const {farm,id,productId}=earned()
 const quoted=Q.shopRecipeRefill(farm,id)!
 for(const change of [
   (f:F.FarmState)=>M.setBayShopOpen(f.bayShop,false),
   (f:F.FarmState)=>{f.culinary.stock[id]=0},
   (f:F.FarmState)=>{f.bayShop.slots[2]=null},
   (f:F.FarmState)=>{f.bayShop.slots[1]=structuredClone(f.bayShop.slots[2])},
   (f:F.FarmState)=>{f.day++},
   (f:F.FarmState)=>{f.bayShop.slots[2]!.quantity=1},
 ]){
   const changed=structuredClone(farm);change(changed)
   assert.equal(Q.shopRecipeRefill(changed,id),undefined)
   assert.notEqual(entry(changed,id)?.action,'recipe-harbour-shop')
   const before=structuredClone(changed)
   assert.deepEqual(await start(changed,id,quoted.key),{visit:undefined,opened:0,redraw:1})
   assert.deepEqual(changed,before)
 }
 const moved=structuredClone(farm);moved.bayShop.slots[1]=moved.bayShop.slots[2];moved.bayShop.slots[2]=null
 assert.notEqual(Q.shopRecipeRefill(moved,id)?.key,quoted.key)
 assert.deepEqual(await start(moved,id,quoted.key),{visit:undefined,opened:0,redraw:1})
 const away=structuredClone(farm); assert.ok(F.sail(away,'home').ok)
 assert.equal(entry(away,id).action,'recipe-harbour-shop')
 assert.equal(entry(away,id).attrs,'')
 assert.deepEqual(await start(away,id,quoted.key),{visit:undefined,opened:0,redraw:0})
 const browse=mounted(farm)
 browse.click(`[data-stock="${productId}"]`)
 assert.match(browse.host.innerHTML,/Место 1 · /)
 assert.match(browse.get('[data-stock-preview]').textContent,/За 1: 19 монет/)
 browse.click('[data-stock-cancel]');assert.equal(browse.transfers,0)
 browse.destroy()
})

test('a moved/changed price, closing, or stock depletion after opening cannot silently confirm at a different shelf or price',async()=>{
 for(const change of [
   (f:F.FarmState)=>{assert.ok(M.setBayShopPrice(f.bayShop,2,24))},
   (f:F.FarmState)=>{f.bayShop.slots[0]=f.bayShop.slots[2];f.bayShop.slots[2]=null},
   (f:F.FarmState)=>M.setBayShopOpen(f.bayShop,false),
   (f:F.FarmState,id:string)=>{f.culinary.stock[id]=0},
 ]){
   const {farm,id}=earned(),quote=Q.shopRecipeRefill(farm,id)!
   const ui=launch(farm,id,(await start(farm,id,quote.key)).visit,()=>{})
   assert.match(ui.host.innerHTML,/Место 3 · /)
   change(farm,id)
   const before=structuredClone(farm)
   // The prior mounted form is still the dispatch target: stale input must not debit inventory.
   ui.submit()
   assert.deepEqual(farm,before);assert.equal(ui.transfers,0)
   ui.destroy()
 }
})
