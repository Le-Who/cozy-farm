import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'
import * as F from '../src/farm.ts'
import * as model from '../src/bay-shop-model.ts'
import * as quantities from '../src/bay-shop-quantity.ts'
import { reserveShopGoods, returnShopGoods } from '../src/harbour-economy.ts'
import { BayShopCustomerView, renderBayShopCustomers } from '../src/bay-shop-customers.ts'
import { bayShopDayGuidance } from '../src/bay-shop-day.ts'
import { bayShopPurchaseReaction } from '../src/bay-shop-speech.ts'
import { shopRemainderQuote, shopReturnLabel } from '../src/bay-shop-price-copy.ts'
import { bayProductId } from '../src/bay-product-id.ts'
import { describeFood } from '../src/intent-orders.ts'
import { ruCount } from '../src/ru.ts'
import { commissionPlayer } from './fixtures/commission-player.ts'
import { earned416Mixed } from './fixtures/earned-416-market-orders.ts'

const src=(name:string)=>readFileSync(new URL('../src/'+name,import.meta.url),'utf8')
const opening=JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json',import.meta.url),'utf8'))
const main=src('main.ts'),shop=src('bay-shop.ts')
const slice=(text:string,first:string,last:string)=>{const a=text.indexOf(first),b=text.indexOf(last,a+1);assert.ok(a>=0&&b>a);return text.slice(a,b)}
const render=stripTypeScriptTypes(shop.slice(shop.indexOf('const escape =')).replace('export function mountBayShop','function mountBayShop')+'\nmountBayShop(host,options)')
const list=stripTypeScriptTypes(slice(main,'function harbourGoods(', 'function openShopScene(').replaceAll('import.meta.env.BASE_URL','"/"')+'\nharbourGoods()')
const readCatalog=(farm:F.FarmState):model.BayShopStock[]=>runInNewContext(list,{
  ...F,farm,iconUrl:(id:string)=>'/art/lavender/'+id+'.webp',
  // Names/art are not under test. Product identities, order, availability and price are production code.
  stockLabel:(item:F.StockItem)=>({name:bayProductId(item),image:'ui-market'}),bayProductId,describeFood
})
const ownedProducts=stripTypeScriptTypes(slice(main,'  const products = ():','  const source = panelHistory.at(-1)')+'\nproducts()')
function available(farm:F.FarmState):model.BayShopStock[]{
  return runInNewContext(ownedProducts,{farm,harbourGoods:()=>readCatalog(farm)})
}
function earned(){
  const p=commissionPlayer(opening.slice(0,opening.findIndex((a:{name:string})=>a.name==='inviteResident')+1))
  const recipe=p.cook();p.cook(recipe);p.shelf(recipe);p.sale()
  p.visit('home')
  for(let n=0;n<6;n++){
    for(const [i,bed] of p.state.beds.entries()){
      if(bed.kind!=='crop')continue
      const a=F.getBedAction(p.state,i)
      if(a.kind==='harvest')p.act('workBed',i,0)
      if(a.kind==='water'){if(!p.state.water)p.act('refillWater');p.act('workBed',i,0)}
    }
    if(p.state.eggsReady) p.act('collectEggs')
    if(p.state.trees.home[0]?.fruitReady) p.act('pickFruit',0)
    if(n<5)p.night()
  }
  p.visit('grove')
  for(let i=0;i<3;i++)if(F.getShellAt(p.state,i))p.act('collectShell',i)
  p.visit('village')
  const id='signature:'+recipe,slot=p.state.bayShop.slots[0]!
  assert.equal(slot.product.id,id)
  assert.equal(slot.quantity,0)
  assert.equal(p.state.culinary.stock[recipe],1)
  const items=available(p.state)
  assert.equal(items.at(-1)?.id,id,'existing catalog puts the actual signature farther down than other available products')
  return {farm:p.state,recipe, id, items, actions:p.actions}
}

class Element {
  disabled=false
  value=''
  scrollTop=0
  textContent=''
  private attrs:Record<string,string>
  private onFocus?: (item:Element)=>void
  constructor(a:Record<string,string>={},onFocus?:(item:Element)=>void){this.attrs=a;this.onFocus=onFocus}
  matches(s:string){
    if(s===':disabled')return this.disabled
    if(s==='button')return true
    return this.hasAttribute(s.slice(1,-1))
  }
  hasAttribute(k:string){return Object.hasOwn(this.attrs,k)}
  getAttribute(k:string){return this.attrs[k]??null}
  get dataset(){return Object.fromEntries(Object.entries(this.attrs).filter(([k])=>k.startsWith('data-')).map(([k,v])=>[k.slice(5).replace(/-([a-z])/g,(_,letter:string)=>letter.toUpperCase()),v]))}
  closest(s:string){return s==='button'?this:null}
  focus(){this.onFocus?.(this)}
}
class Input extends Element {
  nativeInvalid=false
  reports=0
  matches(s:string){return s===':invalid'?this.nativeInvalid:super.matches(s)}
  reportValidity(){this.reports++;return !this.nativeInvalid}
}
function scene(farm:F.FarmState, recipeProduct?:string){
  const events=new Map<string,(event:any)=>void>(), document:{activeElement:Element|null;hidden:boolean}={activeElement:null,hidden:false}
  const focus=(item:Element)=>{document.activeElement=item}
  let html='', nodes:Element[]=[], catalog:Element|null=null, desk=new Element(), last=0, nextFrame:((n:number)=>void)|undefined, transfers=0, writes=0
  const parse=(raw:string)=>Object.fromEntries([...raw.matchAll(/([a-zA-Z][a-zA-Z0-9-]*)(?:="([^"]*)")?/g)].map(([,k,v])=>[k,v??'']))
  const host={
    set innerHTML(v:string){
      html=v
      nodes=[...v.matchAll(/<(button|input|form|p)\b([^>]*)>/g)].map(([,tag,attributes])=>{
        const a=parse(attributes), item=tag==='input'?new Input(a,focus):new Element(a,focus)
        item.disabled=Object.hasOwn(a,'disabled');item.value=a.value??''
        return item
      })
      catalog=v.includes('class="bay-shop-products"')?new Element():null
      // Same ownership as the production CSS: when a catalog is present the desk cannot scroll it.
      desk=new Element()
      if(catalog)Object.defineProperty(desk,'scrollTop',{get:()=>0,set:()=>{}})
    },
    get innerHTML(){return html},
    addEventListener(type:string,fn:(event:any)=>void){events.set(type,fn)},
    removeEventListener(){},
    contains(e:Element){return nodes.includes(e)},
    querySelector(selector:string){
      if(selector==='.bay-shop-desk-content')return desk
      if(selector==='.bay-shop-products')return catalog
      const m=/^\[([^=\]]+)(?:="([^"]*)")?\]$/.exec(selector)
      if(m)return nodes.find(n=>n.hasAttribute(m[1])&&(m[2]===undefined||n.getAttribute(m[1])===m[2]))??null
      return null
    },
    querySelectorAll(){return []}
  }
  const get=(s:string)=>{const e=host.querySelector(s);assert.ok(e,s);return e}
  const mounted=runInNewContext(render,{
    ...model,...quantities,BayShopCustomerView,renderBayShopCustomers,bayShopDayGuidance,bayShopPurchaseReaction,shopRemainderQuote,shopReturnLabel,ruCount,
    Element,HTMLElement:Element,HTMLInputElement:Input,document,performance:{now:()=>0},CSS:{escape:(v:string)=>v},
    ResizeObserver:class{observe(){}disconnect(){}},matchMedia:()=>({matches:true}),window:{setTimeout:()=>1},clearTimeout(){},playBaySound(){},applyIngredientFinishes(){},
    requestAnimationFrame(fn:(n:number)=>void){nextFrame=fn;return 1},cancelAnimationFrame(){nextFrame=undefined},host,
    options:{state:farm.bayShop,catalog:readCatalog(farm),products:()=>available(farm),
      takeStock:(id:string,n:number)=>{transfers++;return reserveShopGoods(farm,id,n)},
      returnStock:(id:string,n:number)=>returnShopGoods(farm,id,n),
      onEarn:(value:number)=>{farm.coins+=value},onChange(){writes++},onClose(){},recipeProduct,returnToRecipe:!!recipeProduct}
  })
  return {host, get, get writes(){return writes}, get focused(){return document.activeElement}, get transfers(){return transfers},
    click(selector:string,detail=0){const e=get(selector);focus(e);events.get('click')!({target:e,detail})},
    amount(value:string){const input=get('[data-stock-quantity]');input.value=value;events.get('input')!({target:input})},
    clickDetached(item:Element){events.get('click')!({target:item,detail:1})},
    submit(){events.get('submit')!({target:get('[data-stock-form]'),preventDefault(){}})},
    advance(){last+=1000;assert.ok(nextFrame);nextFrame(last)},destroy:mounted.destroy}
}

test('the existing layout makes the product grid the scroll owner rather than its desk',()=>{
  const css=src('bay-shop.css')
  assert.match(css,/\.bay-shop-desk-content:has\(\.bay-shop-products\)\{[^}]*overflow:hidden/)
  assert.match(css,/\.bay-shop-products\{[^}]*overflow-y:auto/)
})
test('the same earned deep product stays in place when an unconfirmed quantity is cancelled',t=>{
  for(const detail of [0,1]){
    const {farm,id,items,actions}=earned(), ui=scene(farm), before=structuredClone(farm)
    ui.click('[data-slot="1"]')
    const inventoryScroll=318
    ui.get('.bay-shop-products').scrollTop=inventoryScroll
    ui.click(`[data-stock="${id}"]`)
    assert.equal(ui.get('[data-stock-quantity]').value,'1')
    assert.deepEqual(farm,before)
    ui.click('[data-stock-cancel]',detail)
    t.diagnostic(JSON.stringify({day:farm.day,actions,catalogItems:items.length,position:items.findIndex(item=>item.id===id)+1,input:detail?'pointer':'keyboard',before:inventoryScroll,after:ui.get('.bay-shop-products').scrollTop}))
    assert.equal(ui.get('.bay-shop-products').scrollTop,inventoryScroll)
    assert.equal(ui.focused,ui.get(detail?'[data-slot="1"]':`[data-stock="${id}"]`))
    assert.equal(ui.transfers,0)
    assert.deepEqual(farm,before)
    ui.destroy()
  }
})
test('one ordinary visitor purchase does not reset a player browsing lower in the catalog',t=>{
  const {farm,items,actions}=earned()
  const product=items.find(item=>!item.signature);assert.ok(product)
  assert.ok(reserveShopGoods(farm,product.id,1))
  assert.ok(model.stockBayShop(farm.bayShop,1,product,1))
  model.setBayShopOpen(farm.bayShop,true)
  const ui=scene(farm), sold=farm.bayShop.sold, coins=farm.coins,
    price=farm.bayShop.slots[1]!.price
  ui.get('.bay-shop-products').scrollTop=284
  for(let advance=0;advance<22&&farm.bayShop.sold===sold;advance++)ui.advance()
  assert.equal(farm.bayShop.sold,sold+1)
  assert.equal(farm.coins,coins+price)
  assert.equal(ui.transfers,0)
  t.diagnostic(JSON.stringify({day:farm.day,actions,catalogItems:items.length,paid:price,before:284,after:ui.get('.bay-shop-products').scrollTop}))
  assert.equal(ui.get('.bay-shop-products').scrollTop,284)
  ui.destroy()
})
test('keeping catalog position after an explicit placement does not change its spend or shelf focus',t=>{
  const {farm,id,recipe,actions}=earned(),ui=scene(farm),before=structuredClone(farm)
  ui.click('[data-slot="0"]')
  ui.get('.bay-shop-products').scrollTop=304
  ui.click(`[data-stock="${id}"]`)
  assert.equal(ui.transfers,0)
  ui.submit()
  assert.equal(ui.transfers,1)
  assert.equal(farm.culinary.stock[recipe],0)
  assert.equal(farm.bayShop.slots[0]?.quantity,1)
  assert.equal(farm.bayShop.slots[0]?.price,before.bayShop.slots[0]?.price)
  assert.equal(farm.coins,before.coins)
  assert.equal(ui.focused,ui.get('[data-slot="0"]'))
  t.diagnostic(JSON.stringify({day:farm.day,actions,placed:1,before:304,after:ui.get('.bay-shop-products').scrollTop}))
  assert.equal(ui.get('.bay-shop-products').scrollTop,304)
  ui.destroy()
})

function earnedCategoryChoices(){
  const p=commissionPlayer(opening),recipe=p.cook();p.visit('home')
  while(p.state.day<20){
    for(const [index,bed] of p.state.beds.entries()){
      if(bed.kind!=='crop')continue
      const action=F.getBedAction(p.state,index)
      if(action.kind==='harvest')p.act('workBed',index,0)
      if(action.kind==='water'){if(!p.state.water)p.act('refillWater');p.act('workBed',index,0)}
    }
    if(p.state.eggsReady)p.act('collectEggs')
    if(F.getTreeAction(p.state,0).kind==='pick')p.act('pickFruit',0)
    p.night()
  }
  for(const [index,bed] of p.state.beds.entries())if(bed.kind==='crop'&&F.getBedAction(p.state,index).kind==='harvest')p.act('workBed',index)
  if(p.state.eggsReady)p.act('collectEggs')
  if(F.getTreeAction(p.state,0).kind==='pick')p.act('pickFruit',0)
  p.act('catchFish',true)
  if(F.getCookAction(p.state,'appleJam').available)p.act('cookDish','appleJam')
  p.visit('grove');p.act('catchFish',true);p.act('gatherSeaSalt')
  for(let i=0;i<3;i++)if(F.getShellAt(p.state,i))p.act('collectShell',i)
  if(F.getTreeAction(p.state,0).kind==='pick')p.act('pickFruit',0)
  p.visit('village')
  assert.deepEqual([p.actions,p.state.day,p.state.island,p.state.coins,p.state.culinary.stock[recipe]],[144,20,'village',68,1])
  return {farm:p.state,recipe,id:'signature:'+recipe}
}
const listing=(html:string)=>[...html.matchAll(/data-stock="([^"]*)"/g)].map(match=>match[1])
const groups=(html:string)=>[...html.matchAll(/data-stock-group="([^"]+)" aria-pressed="(true|false)"[^>]*>([^<]+)<\/button>/g)].map(match=>[match[1],match[2],match[3]])

test('earned Day20 gallery brings the last authored recipe into the first three kitchen cards without hiding any of 32 products or changing stock',()=>{
  const {farm,id,recipe}=earnedCategoryChoices(),before=structuredClone(farm),ui=scene(farm)
  const all=Array.from(available(farm),row=>row.id)
  assert.equal(all.length,32);assert.equal(all.at(-1),id);assert.deepEqual(listing(ui.host.innerHTML),all)
  assert.deepEqual(groups(ui.host.innerHTML),[['all','true','Всё'],['harvest','false','Урожай'],['kitchen','false','Кухня'],['shore','false','Берег']])
  assert.ok(ui.host.innerHTML.indexOf('data-stock-group="kitchen"')<ui.host.innerHTML.indexOf('class="bay-shop-products"'))
  assert.doesNotMatch(ui.host.innerHTML,/<strong>Припасы<\/strong>/,'no duplicate heading in the long-list view')
  ui.get('.bay-shop-products').scrollTop=250
  ui.click('[data-stock-group="kitchen"]')
  assert.deepEqual(listing(ui.host.innerHTML),['dish:orchardTart','dish:appleJam',id]);assert.equal(ui.get('.bay-shop-products').scrollTop,0)
  assert.equal(ui.focused,ui.get('[data-stock-group="kitchen"]'))
  ui.click(`[data-stock="${id}"]`);assert.equal(ui.get('[data-stock-quantity]').value,'1');assert.deepEqual(farm,before)
  ui.click('[data-stock-cancel]');assert.equal(ui.focused,ui.get(`[data-stock="${id}"]`));assert.deepEqual(listing(ui.host.innerHTML),['dish:orchardTart','dish:appleJam',id]);assert.equal(ui.transfers,0)
  ui.click('[data-tab="journal"]');ui.click('[data-tab="stock"]')
  assert.deepEqual(listing(ui.host.innerHTML),['dish:orchardTart','dish:appleJam',id]);assert.deepEqual(farm,before)
  ui.click('[data-stock-group="shore"]');assert.deepEqual(listing(ui.host.innerHTML),['perch','seaBass','seaSalt','shells'])
  ui.click('[data-stock-group="harvest"]');assert.equal(listing(ui.host.innerHTML).length,25)
  ui.click('[data-stock-group="all"]');assert.deepEqual(listing(ui.host.innerHTML),all)
  ui.click('[data-stock-group="kitchen"]');ui.click(`[data-stock="${id}"]`);ui.submit()
  assert.equal(ui.transfers,1);assert.equal(farm.culinary.stock[recipe],0);assert.equal(farm.bayShop.slots[0]?.product.id,id);assert.equal(farm.bayShop.slots[0]?.quantity,1)
  assert.equal(farm.coins,before.coins,'the explicit shelf placement itself is not a sale');assert.equal(ui.focused,ui.get('[data-slot="0"]'))
  assert.deepEqual(listing(ui.host.innerHTML),['dish:orchardTart','dish:appleJam'])
  assert.equal(Object.hasOwn(farm.bayShop.slots[0]!.product,'group'),false,'lookup category is never saved with shelf stock')
  for(const item of ['dish:orchardTart','dish:appleJam']) { ui.click(`[data-stock="${item}"]`);ui.submit() }
  assert.equal(ui.transfers,3);assert.equal(farm.coins,before.coins)
  assert.deepEqual(groups(ui.host.innerHTML),[['all','true','Всё'],['harvest','false','Урожай'],['shore','false','Берег']])
  assert.equal(listing(ui.host.innerHTML).length,29,'an exhausted category falls back to the remaining real stock')
  ui.destroy()
})

test('first ordinary harbor arrival has at most four product rows and keeps the original unfiltered compact layout',()=>{
  const p=commissionPlayer(opening.slice(0,opening.findIndex((a:{name:string})=>a.name==='inviteResident')+1))
  assert.equal(p.state.island,'village');assert.ok(p.state.village.built)
  const products=available(p.state);assert.ok(products.length>0&&products.length<=12)
  const before=structuredClone(p.state),ui=scene(p.state)
  assert.deepEqual(groups(ui.host.innerHTML),[]);assert.match(ui.host.innerHTML,/<strong>Припасы<\/strong>/)
  assert.deepEqual(listing(ui.host.innerHTML),Array.from(products,row=>row.id));assert.deepEqual(p.state,before)
  ui.destroy()
})

test('earned Day14 selected sold shelf has one direct exact refill without changing the chosen category or saved price',t=>{
  const {farm,id,recipe,items,actions}=earned(),ui=scene(farm), before=structuredClone(farm)
  assert.deepEqual([farm.day,actions,items.length,farm.bayShop.slots[0]?.price,farm.culinary.stock[recipe]],[14,118,23,19,1])
  ui.click('[data-stock-group="harvest"]')
  ui.click('[data-slot="0"]')
  const pin=()=>ui.get('[data-stock-sold-shelf="0"]')
  assert.equal(pin().getAttribute('data-stock'),id)
  assert.equal(listing(ui.host.innerHTML).filter(v=>v===id).length,1)
  assert.ok(groups(ui.host.innerHTML).some(([group,active])=>group==='harvest'&&active==='true'))
  assert.deepEqual(farm,before)
  ui.get('.bay-shop-products').scrollTop=108
  ui.click('[data-stock-sold-shelf="0"]')
  assert.equal(ui.get('[data-stock-quantity]').value,'1')
  assert.equal(ui.transfers,0)
  assert.deepEqual(farm,before)
  ui.click('[data-stock-cancel]')
  assert.equal(ui.focused,pin());assert.equal(ui.get('.bay-shop-products').scrollTop,108)
  assert.ok(groups(ui.host.innerHTML).some(([group,active])=>group==='harvest'&&active==='true'))
  ui.click('[data-stock-group="kitchen"]')
  const kitchen=listing(ui.host.innerHTML)
  assert.ok(kitchen.includes('dish:orchardTart'))
  assert.equal(kitchen.filter(v=>v===id).length,1,'same product appears only once, not also in its original category')
  ui.click('[data-slot="1"]')
  assert.doesNotMatch(ui.host.innerHTML,/data-stock-sold-shelf=/)
  assert.ok(listing(ui.host.innerHTML).includes(id),'normal catalogue entry while a different shelf is selected')
  ui.click('[data-slot="0"]');ui.click('[data-stock-sold-shelf="0"]')
  ui.submit()
  assert.deepEqual([ui.transfers,farm.culinary.stock[recipe],farm.bayShop.slots[0]?.quantity,farm.bayShop.slots[0]?.price,farm.coins],
    [1,0,1,19,before.coins])
  assert.equal(ui.focused,ui.get('[data-slot="0"]'))
  assert.doesNotMatch(ui.host.innerHTML,/data-stock-sold-shelf=/)
  const soldBefore=farm.bayShop.sold, coinsBefore=farm.coins
  if(!farm.bayShop.open)ui.click('[data-open]')
  for(let elapsed=0;elapsed<60&&farm.bayShop.sold===soldBefore;elapsed++)ui.advance()
  assert.deepEqual([farm.bayShop.sold-soldBefore,farm.coins-coinsBefore,farm.bayShop.slots[0]?.quantity,ui.transfers],[1,19,0,1],
    'a real subsequent visitor pays the saved price exactly once')
  assert.doesNotMatch(ui.host.innerHTML,/data-stock-sold-shelf=/,'no refill after the genuinely last unit is sold')
  t.diagnostic(JSON.stringify({day:farm.day,actions,all:items.length,originalSavedPrice:19,previewTransfers:0,
    exactStockPlacement:ui.transfers,visitorPayment:farm.coins-coinsBefore,soldOnce:true,otherKitchen:true}))
  ui.destroy()
})

test('sold shelf quote cannot refill, reserve, or reroute a stale shelf or depleted product',()=>{
  for(const mode of ['shelf-before-click','stock-before-click','replacement-before-click','shelf-after-preview'] as const) {
    const {farm,id,items}=earned(),ui=scene(farm)
    ui.click('[data-slot="0"]')
    assert.ok(ui.get('[data-stock-sold-shelf="0"]'))
    if(mode==='shelf-after-preview')ui.click('[data-stock-sold-shelf="0"]')
    if(mode==='stock-before-click')assert.ok(reserveShopGoods(farm,id,1))
    else {
      assert.equal(model.removeBayShopStock(farm.bayShop,0)?.quantity,0)
      if(mode==='replacement-before-click'){
        const other=items.find(item=>item.id==='dish:orchardTart')!
        assert.ok(reserveShopGoods(farm,other.id,1))
        assert.ok(model.stockBayShop(farm.bayShop,0,other,1))
      }
    }
    const afterChange=structuredClone(farm)
    if(mode==='shelf-after-preview')ui.submit()
    else ui.click('[data-stock-sold-shelf="0"]')
    assert.equal(ui.transfers,0,mode);assert.deepEqual(farm,afterChange,mode)
    assert.doesNotMatch(ui.host.innerHTML,/data-stock-(?:quantity|sold-shelf)\b/i,mode)
    ui.destroy()
  }
})

test('earned D194 exact recipe previews a truly sold-out shelf without erasing it before confirmation',()=>{
  const p=earned416Mixed(false);
  assert.deepEqual([p.actions,p.state.day,F.getSale(p.state).items],[543,193,416]);
  const recipe=p.cook();p.cook(recipe);
  const id='signature:'+recipe, four=scene(p.state)
  for(const [slot,product] of ['carrot','tomato','apple','pumpkin'].entries()){
    four.click(`[data-slot="${slot}"]`);four.click(`[data-stock="${product}"]`);four.submit()
  }
  four.click('[data-open]');four.destroy()
  const cold=(f:F.FarmState)=>F.restoreCurrentFarm(JSON.parse(JSON.stringify(f)))!
  const full=cold(p.state), blocked=scene(full,id)
  assert.deepEqual(full.bayShop.slots.map(s=>s?.quantity),[1,1,1,1])
  assert.match(blocked.host.innerHTML,/Все места заняты/);assert.doesNotMatch(blocked.host.innerHTML,/data-stock-quantity/)
  assert.equal(blocked.transfers,0);assert.equal(blocked.writes,0);blocked.destroy()
  p.reload();p.night();p.visit('village')
  const base=p.state
  assert.deepEqual([base.day,base.coins,base.bayShop.sold,base.culinary.stock[recipe],base.bayShop.slots.map(s=>s?.quantity)],[194,79,4,2,[0,0,0,0]])

  const keep=cold(base), expected=structuredClone(keep), decision=scene(keep,id)
  assert.match(decision.host.innerHTML,/Место 1[^<]*carrot/,'named old listing must stay visible before replacement')
  assert.equal(decision.get('[data-stock-quantity]').value,'1')
  assert.match(decision.host.innerHTML,/К рецепту/)
  assert.deepEqual(keep,expected);assert.equal(decision.transfers,0);assert.equal(decision.writes,0)
  decision.click('[data-stock-cancel]')
  assert.deepEqual(keep,expected);assert.equal(decision.transfers,0);assert.equal(decision.writes,0)
  decision.destroy()

  const exact=cold(base), ui=scene(exact,id), original=structuredClone(exact)
  ui.submit()
  assert.deepEqual([exact.bayShop.slots[0]?.product.id,exact.bayShop.slots[0]?.price,exact.bayShop.slots[0]?.quantity,
    exact.culinary.stock[recipe],exact.coins,ui.transfers,ui.writes],[id,19,1,1,79,1,1])
  assert.deepEqual(exact.bayShop.slots.slice(1),original.bayShop.slots.slice(1))
  assert.equal(ui.focused,ui.get('[data-slot="0"]'));ui.destroy()

  const stale=cold(base), held=scene(stale,id), oldListing=stale.bayShop.slots[0]!.product
  // Another explicit restock of the quoted shelf from independently owned carrots, not manufactured stock.
  assert.ok(reserveShopGoods(stale,oldListing.id,1));assert.ok(model.stockBayShop(stale.bayShop,0,oldListing,1))
  const staleState=structuredClone(stale)
  held.submit()
  assert.deepEqual(stale,staleState);assert.equal(held.transfers,0);assert.equal(held.writes,0);held.destroy()

  const onlyEmpty=cold(base)
  assert.equal(model.removeBayShopStock(onlyEmpty.bayShop,2)?.quantity,0)
  const free=scene(onlyEmpty,id)
  assert.match(free.host.innerHTML,/Место 3 · в припасах/);assert.doesNotMatch(free.host.innerHTML,/вместо «/)
  free.destroy()
  const existing=cold(exact)
  const direct=scene(existing,id)
  assert.match(direct.host.innerHTML,/Место 1 · в припасах/);assert.doesNotMatch(direct.host.innerHTML,/вместо «/)
  direct.destroy()
  const generic=scene(cold(base))
  assert.doesNotMatch(generic.host.innerHTML,/data-stock-quantity/,'an ordinary shop visit does not seed a replacement')
  generic.destroy()
})

// Actual same D193 farm demonstrates a selected SKU too deep even within the existing Harvest group.
const rainbowApple='variants:apple:rainbow'
function earnedLiveShelf(){
  const p=earned416Mixed(false)
  assert.deepEqual([p.actions,p.state.day,F.getSale(p.state).items,p.state.coins],[543,193,416,56])
  p.visit('village')
  assert.deepEqual([p.actions,p.state.island],[544,'village'])
  const f=p.state, product=available(f).find(row=>row.id===rainbowApple)!
  assert.deepEqual([product.quantity,product.basePrice],[11,8])
  assert.ok(quantities.placeShopQuantity(f.bayShop,2,product,4,(id,count)=>reserveShopGoods(f,id,count)))
  assert.ok(model.setBayShopPrice(f.bayShop,2,7))
  p.reload()
  const opened=scene(p.state)
  opened.click('[data-open]')
  for(let tick=0;tick<30&&!p.state.bayShop.sold;tick++)opened.advance()
  assert.deepEqual([p.state.bayShop.sold,p.state.bayShop.slots[2]?.quantity,p.state.coins,p.state.bayShop.visitor?.id],[1,3,63,'bea'])
  assert.equal(p.state.bayShop.visitor?.outcome?.kind,'bought')
  opened.destroy()
  p.reload()
  return p.state
}
const livePin='[data-stock-live-shelf="2"]'
function pickedLiveShelf(farm=earnedLiveShelf()){
  const ui=scene(farm)
  ui.click('[data-stock-group="kitchen"]')
  assert.ok(!listing(ui.host.innerHTML).includes(rainbowApple))
  ui.click('[data-slot="2"]')
  return {ui,farm}
}

test('earned D193 after one paid buyer: selected positive shelf surfaces its one exact card, keeps quote and active category',()=>{
  const {ui,farm}=pickedLiveShelf(),before=structuredClone(farm)
  assert.equal(ui.get(livePin).getAttribute('data-stock'),rainbowApple)
  assert.equal(listing(ui.host.innerHTML).filter(id=>id===rainbowApple).length,1)
  assert.match(ui.host.innerHTML,/На полке ×3/)
  assert.equal(ui.get('[data-price]').value,'7')
  assert.equal(ui.writes,0)
  ui.get('.bay-shop-products').scrollTop=103
  ui.click(livePin)
  assert.equal(ui.get('[data-stock-quantity]').value,'1')
  ui.amount('2')
  assert.match(ui.get('[data-stock-preview]').textContent,/На полке будет: 5 · в запасе останется: 5\. За 1: 7 монет/)
  assert.equal(ui.transfers,0);assert.equal(ui.writes,0);assert.deepEqual(farm,before)
  ui.click('[data-stock-cancel]')
  assert.equal(ui.focused,ui.get(livePin));assert.equal(ui.get('.bay-shop-products').scrollTop,103)
  assert.ok(groups(ui.host.innerHTML).some(([group,on])=>group==='kitchen'&&on==='true'))
  assert.equal(ui.transfers,0);assert.equal(ui.writes,0);assert.deepEqual(farm,before)
  ui.click(livePin);ui.amount('2');ui.submit()
  const expect=structuredClone(before)
  expect.variants.apple!.rainbow!-=2;expect.bayShop.slots[2]!.quantity+=2
  assert.deepEqual(farm,expect);assert.equal(ui.transfers,1);assert.equal(ui.writes,1)
  assert.equal(ui.focused,ui.get('[data-slot="2"]'))
  assert.equal(ui.get(livePin).getAttribute('data-stock'),rainbowApple)
  assert.equal(ui.get('[data-price]').value,'7')
  ui.click('[data-price-factor="1"]')
  assert.equal(farm.bayShop.slots[2]!.price,8,'price changes only by the deliberate existing edit')
  assert.equal(farm.coins,63);assert.equal(farm.bayShop.sold,1);assert.equal(ui.transfers,1)
  ui.destroy()
})

test('an ordinary buyer can finish a live listing during preview; Confirm uses the same latest shelf count',()=>{
  const {ui,farm}=pickedLiveShelf()
  ui.click(livePin);ui.amount('2')
  for(let tick=0;tick<87&&farm.bayShop.slots[2]!.quantity>0;tick++)ui.advance()
  assert.deepEqual([farm.bayShop.slots[2]!.quantity,farm.bayShop.slots[2]!.price,farm.bayShop.sold,farm.coins],[0,7,4,84])
  assert.match(ui.get('[data-stock-preview]').textContent,/На полке будет: 2 · в запасе останется: 5\. За 1: 7 монет/)
  const before=structuredClone(farm);ui.submit();before.variants.apple!.rainbow!-=2;before.bayShop.slots[2]!.quantity+=2
  assert.deepEqual(farm,before);assert.equal(ui.transfers,1)
  assert.ok(ui.get(livePin));ui.destroy()
})

test('no stale positive preview is transferred after stock moves, price/listing changes or another shelf is selected',()=>{
  for(const mode of ['remaining-stock','changed-price','replacement','recreated-same-sku','reselected','price-before-click'] as const) {
    const {ui,farm}=pickedLiveShelf(), stale=ui.get(livePin)
    if(mode!=='price-before-click'){ui.click(livePin);ui.amount('2')}
    if(mode==='remaining-stock'){
      const product=available(farm).find(x=>x.id===rainbowApple)!
      assert.equal(product.quantity,7)
      assert.ok(quantities.placeShopQuantity(farm.bayShop,1,product,7,(id,n)=>reserveShopGoods(farm,id,n)))
    } else if(mode==='changed-price'||mode==='price-before-click')assert.ok(model.setBayShopPrice(farm.bayShop,2,11))
    else if(mode==='replacement'||mode==='recreated-same-sku'){
      const old=model.removeBayShopStock(farm.bayShop,2)!
      returnShopGoods(farm,old.id,old.quantity)
      const other=available(farm).find(x=>x.id===(mode==='replacement'?'dish:orchardTart':rainbowApple))!
      assert.ok(quantities.placeShopQuantity(farm.bayShop,2,other,1,(id,n)=>reserveShopGoods(farm,id,n)))
      if(mode==='recreated-same-sku')assert.ok(model.setBayShopPrice(farm.bayShop,2,7))
    } else {
      ui.click('[data-slot="1"]');ui.clickDetached(stale)
    }
    const before=structuredClone(farm)
    if(mode==='price-before-click')ui.click(livePin)
    else if(mode!=='reselected')ui.submit()
    assert.deepEqual(farm,before,mode);assert.equal(ui.transfers,0,mode);assert.equal(ui.writes,0,mode)
    assert.doesNotMatch(ui.host.innerHTML,/data-stock-quantity/,mode)
    if(mode==='remaining-stock'||mode==='reselected')assert.doesNotMatch(ui.host.innerHTML,/data-stock-live-shelf=/)
    if(mode==='reselected'){
      ui.click('[data-stock-group="harvest"]')
      assert.ok(listing(ui.host.innerHTML).includes(rainbowApple))
      ui.click(`[data-stock="${rainbowApple}"]`);assert.match(ui.host.innerHTML,/Место 2 · в припасах/)
      ui.click('[data-stock-cancel]');assert.equal(ui.transfers,0);assert.deepEqual(farm,before)
    }
    ui.destroy()
  }
})

test('earned D193 stock quantity is not a submitter; native validation and the separate action still guard one transfer',()=>{
  const {ui,farm}=pickedLiveShelf(),before=structuredClone(farm)
  ui.click(livePin)
  const amount=ui.get('[data-stock-quantity]') as Input
  const confirm=ui.get('[data-stock-confirm]')
  assert.equal(ui.focused,amount)
  const authored=ui.host.innerHTML.match(/<div class="bay-shop-quantity">[\s\S]*?<\/form>/)?.[0]
  assert.ok(authored)
  const form=authored.indexOf('<form data-stock-form>')
  assert.ok(authored.indexOf('data-stock-quantity')<form && authored.indexOf('data-stock-preview')<form,
    'focused amount and quote are not associated with the native confirmation form')
  assert.match(authored.slice(form),/<button type="submit" data-stock-confirm[^>]*>Выставить<\/button>/)
  assert.equal(amount.hasAttribute('form'),false)
  assert.deepEqual(['min','max','step'].map(k=>amount.getAttribute(k)),['1','7','1'])
  for(const invalid of ['','0','1.5','8']){
    ui.amount(invalid)
    assert.equal(confirm.disabled,true,invalid)
    assert.equal(ui.focused,amount)
    assert.deepEqual(farm,before)
  }
  ui.amount('2')
  assert.equal(confirm.disabled,false)
  assert.equal(ui.focused,amount)
  assert.equal(ui.writes,0)

  // The host does not supply a browser. Exercise the real submit handler with the
  // numeric validity veto, including when model quantity alone would allow 2.
  amount.nativeInvalid=true
  ui.click('[data-stock-confirm]')
  ui.submit()
  assert.equal(amount.reports,1)
  assert.equal(ui.transfers,0);assert.equal(ui.writes,0);assert.deepEqual(farm,before)
  amount.nativeInvalid=false
  ui.click('[data-stock-confirm]')
  ui.submit()
  const expected=structuredClone(before)
  expected.variants.apple!.rainbow!-=2;expected.bayShop.slots[2]!.quantity+=2
  assert.deepEqual(farm,expected)
  assert.equal(ui.transfers,1);assert.equal(ui.writes,1)
  assert.equal(ui.focused,ui.get('[data-slot="2"]'))
  assert.equal(ui.get(livePin).getAttribute('data-stock'),rainbowApple)
  ui.destroy()
})
