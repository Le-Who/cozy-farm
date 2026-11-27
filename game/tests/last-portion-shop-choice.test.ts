import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import * as model from '../src/bay-shop-model.ts'
import * as quantities from '../src/bay-shop-quantity.ts'
import * as tasting from '../src/signature-tasting-guidance.ts'
import { BayShopCustomerView } from '../src/bay-shop-customers.ts'
import { bayShopDayGuidance } from '../src/bay-shop-day.ts'
import { shopRemainderQuote, shopReturnLabel } from '../src/bay-shop-price-copy.ts'
import { bayShopPurchaseReaction } from '../src/bay-shop-speech.ts'
import { reserveShopGoods } from '../src/harbour-economy.ts'
import { getSignatureAction, getSignatureCookOutput, ingredientCount, restoreCurrentFarm, tasteSignature, type FarmState } from '../src/farm.ts'
import { ruCount } from '../src/ru.ts'
import { signatureProcessingDefinitions } from '../src/culinary.ts'
import { shopCommissionUsesRecipe } from '../src/shop-commissions.ts'
import { isGuardedAction } from '../src/action-click-guard.ts'
import { RecipeBookNavigation } from '../src/recipe-book-view.ts'
import { commissionPlayer } from './fixtures/commission-player.ts'

const source=(name:string)=>readFileSync(new URL('../src/'+name+'.ts',import.meta.url),'utf8')
const part=(text:string,from:string,to:string)=>{const a=text.indexOf(from),b=text.indexOf(to,a+1);assert.ok(a>=0&&b>a);return text.slice(a,b)}

function earned(){
  const actions=JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json',import.meta.url),'utf8'))
  const p=commissionPlayer(actions.slice(0,actions.findIndex((a:{name:string})=>a.name==='inviteResident')+1))
  const recipe=p.cook();p.cook(recipe);p.shelf(recipe);p.sale()
  const farm=p.state, id='signature:'+recipe, slot=farm.bayShop.slots[0]!
  assert.equal(farm.day,9);assert.equal(farm.culinary.stock[recipe],1)
  assert.equal(farm.bayShop.memories.bea.purchases[id]?.liked,1)
  return {farm,recipe,id,product:slot.product}
}

function scene(farm:FarmState,product:model.BayShopProduct,stockProduct?:string){
  const events:Record<string,Function>={},preview={textContent:''},confirm={disabled:false},stableProduct=product.id.slice('signature:'.length)
  let transfers=0, saves=0, leaves=0
  const exit={disabled:false,hasAttribute:(name:string)=>name==='data-close'}
  class Element { matches(selector:string){return selector==='[data-stock-form]'} }
  const host={innerHTML:'',contains:(node:unknown)=>node===exit,querySelector:(selector:string)=>{
    if(!host.innerHTML.includes('data-stock-form'))return null
    return selector==='[data-stock-preview]'?preview:selector==='[data-stock-confirm]'?confirm:null
  },querySelectorAll:()=>[],addEventListener:(type:string,fn:Function)=>{events[type]=fn},removeEventListener(){}}
  const module=source('bay-shop'),code=module.slice(module.indexOf('const escape =')).replace('export function mountBayShop','function mountBayShop')
  const ctx={...model,...quantities,BayShopCustomerView,bayShopDayGuidance,bayShopPurchaseReaction,shopRemainderQuote,shopReturnLabel,ruCount,Element,
    ResizeObserver:class{observe(){}disconnect(){}},HTMLElement:Element,HTMLInputElement:Element,matchMedia:()=>({matches:true}),requestAnimationFrame:()=>1,
    performance,document:{activeElement:null},window:{setTimeout:()=>1},clearTimeout(){},playBaySound(){},applyIngredientFinishes(){},host,
    options:{stockProduct,state:farm.bayShop,catalog:[product],products:()=>[{...product,quantity:farm.culinary.stock[stableProduct]}],
      takeStock:(id:string,n:number)=>{transfers++;return reserveShopGoods(farm,id,n)},onEarn:()=>assert.fail('preview is not a purchase'),onChange:()=>{saves++},onClose:()=>{leaves++}}}
  runInNewContext(stripTypeScriptTypes(code+'\nmountBayShop(host,options)'),ctx)
  return {host,preview,confirm,get transfers(){return transfers},get saves(){return saves},get leaves(){return leaves},
    leave(){events.click({target:{closest:(selector:string)=>selector==='button'?exit:null}})},
    submit(){events.submit({target:new Element(),preventDefault(){}})}}
}

test('leaving an open shop names the actual destination without closing the business',()=>{
  const {farm,id,product}=earned()
  model.setBayShopOpen(farm.bayShop,true)
  assert.deepEqual(restoreCurrentFarm(farm),farm)
  for (const [stockProduct,label] of [[undefined,'Вернуться в бухту'],[id,'К рецепту']] as const) {
    const before=structuredClone(farm),view=scene(farm,product,stockProduct)
    const buttons=view.host.innerHTML.match(/<button\b[^>]*\bdata-close(?=\s|>)[^>]*>/g)??[]
    assert.equal(buttons.length,1)
    assert.ok(buttons[0].includes(`aria-label="${label}"`))
    assert.doesNotMatch(buttons[0],/Закрыть лавку/i)
    assert.match(view.host.innerHTML,/<button[^>]+data-open[^>]+aria-pressed="true">Закрыть лавку<\/button>/)
    if (stockProduct) assert.match(view.host.innerHTML,/data-stock-form/)
    view.leave()
    assert.equal(view.leaves,1); assert.equal(view.transfers,0); assert.equal(view.saves,0)
    assert.deepEqual(farm,before)
  }
})

test('the last jar after an actual sale enters the exact quantity preview without committing a shelf or a gift',()=>{
  const {farm,recipe,id,product}=earned(),before=structuredClone(farm)
  assert.equal(tasting.lastPortionShopStock(farm,recipe),id)
  const generic=scene(farm,product);assert.doesNotMatch(generic.host.innerHTML,/data-stock-form/)
  const entry=scene(farm,product,id)
  assert.match(entry.host.innerHTML,/data-close aria-label="К рецепту"/);assert.match(entry.host.innerHTML,/Место 1/);assert.match(entry.host.innerHTML,/data-stock-quantity[^>]*max="1"[^>]*value="1"/)
  assert.match(entry.preview.textContent,/На полке будет: 1 · в запасе останется: 0/);assert.equal(entry.confirm.disabled,false)
  assert.equal(entry.transfers,0);assert.equal(entry.saves,0);assert.deepEqual(farm,before)

  const gift=structuredClone(farm)
  assert.ok(tasteSignature(gift,recipe,'bea').ok);assert.ok(gift.culinary.tastings.bea.bonus);assert.equal(gift.coins,before.coins)
  assert.equal(gift.culinary.stock[recipe],0)
  entry.submit()
  assert.equal(entry.transfers,1);assert.equal(entry.saves,1)
  assert.equal(farm.culinary.stock[recipe],0);assert.equal(farm.bayShop.slots[0]?.quantity,1);assert.equal(farm.coins,before.coins)
  assert.equal(tasteSignature(farm,recipe,'bea').ok,false)
  model.setBayShopOpen(farm.bayShop,true)
  let sale:model.BayShopSale|undefined
  for(let i=0;i<40&&!sale;i++)sale=model.advanceBayShop(farm.bayShop,1000).at(0)
  assert.equal(sale?.visitor,'finn');assert.equal(sale?.price,19);farm.coins+=sale!.price
  assert.deepEqual(restoreCurrentFarm(farm),farm)
})

test('only an exact last carried jar with a live tasting replaces its generic shop link',()=>{
  const {farm,recipe,id}=earned(), ui=source('culinary-ui')
  const code=stripTypeScriptTypes(part(ui,'const control=','\n')+';'+part(ui,'const capacityDescription','export function recipeBookSearchStatus')+
    "\nbookRecipe(farm,farm.culinary.recipes.find(r=>r.id===id),{icon:()=>'',stock:()=>''},{})")
  const render=(f:FarmState)=>runInNewContext(code,{...tasting,shopRecipeRefill:quantities.shopRecipeRefill,farm:f,id:recipe,getSignatureAction,getSignatureCookOutput,ingredientCount,ruCount,signatureProcessingDefinitions,
    signatureBookCapacity:()=>({canCreate:true}),getStoredSignature:()=>undefined,getRecipeRepeatGuide:()=>({available:true,items:[],missing:[]}),
    signatureResultPicture:()=>'',finishedIcon:()=>'',ingredientName:()=>'',ingredientArt:()=>'',escapeRecipeText:String,
    recipeIngredientsDisclosureLabel:'Ингредиенты',renderPicnicOffer:()=>'',recipeBookSupper:()=>'',shopCommissionUsesRecipe}) as string
  const html=render(farm)
  assert.match(html,/<h2 tabindex="-1" data-recipe-focus="uses">Применить<\/h2>/)
  assert.match(html,/data-action="taste-signature"[\s\S]*data-action="recipe-shop-stock" data-value="s1"/)
  assert.doesNotMatch(html,/data-action="open-panel" data-value="bay-shop"/)
  for(const block of [
    (f:FarmState)=>{f.island='home'}, (f:FarmState)=>{delete f.bayShop.reputation[id]},
    (f:FarmState)=>{f.culinary.stock[recipe]=2}, (f:FarmState)=>{f.freight.warehouses.village[id]=1},
    (f:FarmState)=>{f.bayShop.slots=f.bayShop.slots.map((_,i)=>({product:{...f.bayShop.slots[0]!.product,id:'other:'+i,identity:'other:'+i},quantity:1,price:10}))},
  ]){
    const blocked=structuredClone(farm);block(blocked)
    assert.equal(tasting.lastPortionShopStock(blocked,recipe),undefined)
    const old=render(blocked);assert.doesNotMatch(old,/data-action="recipe-shop-stock"/)
    if (blocked.island === 'village') assert.match(old,/data-action="open-panel" data-value="bay-shop"/)
    else assert.match(old,/data-action="recipe-harbour-shop" data-value="s1"/)
  }
  const afterGift=structuredClone(farm);assert.ok(tasteSignature(afterGift,recipe,'bea').ok)
  assert.doesNotMatch(render(afterGift),/data-action="recipe-shop-stock"/)
})

test('the live recipe dispatcher only opens its validated stock form and keeps the original book visit',()=>{
  const {farm,recipe,id}=earned(),before=structuredClone(farm), main=source('main')
  const fields='journeyDetailsOpen journalDetailsOpen selectedExpeditionPort selectedExpeditionOffer selectedWarehouseRequest selectedWarehouse freightPlanOpen inventoryGroup boatIsland marketSaleFamily marketSaleQuery marketTab marketCategory marketSellGroup bagTab archiveGroup treeSlot previewSeed specializationBuilding previewSpecialization irrigationMode villageSlot pastryShape workshopRecipe cookingDish cookingFish seedPickerBed signatureBase signatureSlot signatureRepeatId expandedRepeatId cookingMode communityOrderId communityResident requestedFood kitchenTart kitchenPreserves kitchenGroup kitchenDish honeyKitchenDish signatureFamily'.split(' ')
  const recipeBook={view:{mode:'detail',selectedId:recipe},snapshot(){return structuredClone(this.view)},
    load(view:typeof this.view){this.view=structuredClone(view)},restore(){}}
  const ctx={...Object.fromEntries(fields.map(field=>[field,undefined])),farm,recipeBook,value:recipe,lastPortionShopStock:tasting.lastPortionShopStock,
    selectedBookId:(_f:FarmState,v:typeof recipeBook.view)=>v.selectedId,nextShopStock:undefined as string|undefined,signatureSlots:[],
    document:{activeElement:null},HTMLButtonElement:class {},panel:'recipes',panelHistory:[] as unknown[],panelRenderVersion:1,
    dialog:{open:true,querySelectorAll:()=>[]},dialogContent:{scrollTop:63,querySelector:()=>null,querySelectorAll:()=>[]},island:{isCrossing:()=>false},
    restoreFerryPanelView(){},requestAnimationFrame:(frame:()=>void)=>frame(),
    openPanel(next:string,remember=true){
      if(remember){
        assert.equal(next,'bay-shop');assert.equal(ctx.nextShopStock,id);ctx.panelHistory.push(runInNewContext('rememberPanel()',ctx))
      }
      ctx.panel=next;ctx.dialogContent.scrollTop=0
    }}
  const handlers=part(main,"    case 'recipe-shop-stock':","    case 'tasting-bakery':")
  const code=stripTypeScriptTypes(part(main,'function focusKey(','let harbourScene:')+";({open:()=>{switch('recipe-shop-stock'){"+handlers+'}},goBack})')
  const route=runInNewContext(code,ctx)
  assert.ok(isGuardedAction('recipe-shop-stock'))
  ctx.value='s99';route.open();assert.equal(ctx.panel,'recipes')
  ctx.value=recipe;route.open();assert.equal(ctx.panel,'bay-shop');assert.equal(ctx.nextShopStock,undefined)
  route.goBack();assert.equal(ctx.panel,'recipes');assert.equal(ctx.recipeBook.view.selectedId,recipe);assert.equal(ctx.dialogContent.scrollTop,63)
  assert.equal(ctx.panelHistory.length,0);assert.deepEqual(farm,before)
})

test('Back after explicit last-jar placement lands on the visible Uses heading, not the clipped Cooking focus fallback',t=>{
  const {farm,recipe,id,product}=earned(),calls:string[]=[]
  class Control {
    dataset:Record<string,string>;name:string
    constructor(name:string,dataset:Record<string,string>){this.name=name;this.dataset=dataset}
    closest(){return null}
    matches(){return false}
    getClientRects(){return [{}]}
    focus(options:{preventScroll:boolean}){assert.ok(options.preventScroll);calls.push(this.name)}
    scrollIntoView(options:{block:string}){assert.equal(options.block,'nearest');calls.push('reveal '+this.name)}
  }
  const shelf=new Control('shelf choice',{action:'recipe-shop-stock',value:recipe})
  const cooking=new Control('clipped cooking heading',{recipeFocus:'cooking'}),uses=new Control('uses heading',{recipeFocus:'uses'})
  const globals={HTMLElement:Control,document:{activeElement:shelf}}
  for(const [key,value] of Object.entries(globals)){
    const descriptor=Object.getOwnPropertyDescriptor(globalThis,key)
    Object.defineProperty(globalThis,key,{configurable:true,value})
    t.after(()=>{if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key)})
  }
  const detail={scrollTop:420,getClientRects:()=>[{}],
    querySelector:(s:string)=>s==='[data-recipe-focus="uses"]'?uses:null}
  const root={contains:()=>true,querySelector:(s:string)=>s==='.recipe-book-detail'?detail:
    s==='.signature-book'?{dataset:{selectedRecipe:recipe,mode:'detail'}}:null,
    querySelectorAll:(s:string)=>s.startsWith('[data-recipe-focus="cooking"]')?[cooking]:
      s.startsWith('button')?[...(tasting.lastPortionShopStock(farm,recipe)?[shelf]:[]),cooking,uses]:[]} as unknown as HTMLElement
  const nav=new RecipeBookNavigation();assert.ok(nav.select(farm,recipe));const previous=nav.snapshot(root)
  nav.load(previous);nav.restore(root,true)
  assert.deepEqual(calls,['shelf choice'],'Cancel restores the unchanged exact choice and does not scroll again')
  assert.equal(detail.scrollTop,420)
  scene(farm,product,id).submit();assert.equal(farm.culinary.stock[recipe],0)
  const before=structuredClone(farm)
  calls.length=0;nav.load(previous);nav.restore(root,true)
  assert.deepEqual(calls,['uses heading','reveal uses heading'])
  assert.deepEqual(farm,before)
  calls.length=0;nav.view.focus='detail:some-other-control';nav.restore(root,true)
  assert.deepEqual(calls,['clipped cooking heading'],'unrelated visits keep their behavior')
})
