import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'
import * as F from '../src/farm.ts'
import * as model from '../src/bay-shop-model.ts'
import * as quantities from '../src/bay-shop-quantity.ts'
import { reserveShopGoods, returnShopGoods } from '../src/harbour-economy.ts'
import { BayShopCustomerView } from '../src/bay-shop-customers.ts'
import { bayShopDayGuidance } from '../src/bay-shop-day.ts'
import { bayShopPurchaseReaction } from '../src/bay-shop-speech.ts'
import { shopRemainderQuote, shopReturnLabel } from '../src/bay-shop-price-copy.ts'
import { bayProductId } from '../src/bay-product-id.ts'
import { describeFood } from '../src/intent-orders.ts'
import { ruCount } from '../src/ru.ts'
import { commissionPlayer } from './fixtures/commission-player.ts'

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
function available(farm:F.FarmState){
  return readCatalog(farm).map(row=>({...row,quantity:row.quantity+(farm.freight.warehouses.village[row.id]??0)})).filter(row=>row.quantity>0)
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
  get dataset(){return Object.fromEntries(Object.entries(this.attrs).filter(([k])=>k.startsWith('data-')).map(([k,v])=>[k.slice(5),v]))}
  closest(s:string){return s==='button'?this:null}
  focus(){this.onFocus?.(this)}
}
class Input extends Element {}
function scene(farm:F.FarmState){
  const events=new Map<string,(event:any)=>void>(), document:{activeElement:Element|null;hidden:boolean}={activeElement:null,hidden:false}
  const focus=(item:Element)=>{document.activeElement=item}
  let html='', nodes:Element[]=[], catalog:Element|null=null, desk=new Element(), last=0, nextFrame:((n:number)=>void)|undefined, transfers=0
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
    ...model,...quantities,BayShopCustomerView,bayShopDayGuidance,bayShopPurchaseReaction,shopRemainderQuote,shopReturnLabel,ruCount,
    Element,HTMLElement:Element,HTMLInputElement:Input,document,performance:{now:()=>0},CSS:{escape:(v:string)=>v},
    ResizeObserver:class{observe(){}disconnect(){}},matchMedia:()=>({matches:true}),window:{setTimeout:()=>1},clearTimeout(){},playBaySound(){},applyIngredientFinishes(){},
    requestAnimationFrame(fn:(n:number)=>void){nextFrame=fn;return 1},cancelAnimationFrame(){nextFrame=undefined},host,
    options:{state:farm.bayShop,catalog:readCatalog(farm),products:()=>available(farm),
      takeStock:(id:string,n:number)=>{transfers++;return reserveShopGoods(farm,id,n)},
      returnStock:(id:string,n:number)=>returnShopGoods(farm,id,n),
      onEarn:(value:number)=>{farm.coins+=value},onChange(){},onClose(){}}
  })
  return {host, get, get focused(){return document.activeElement}, get transfers(){return transfers},
    click(selector:string,detail=0){const e=get(selector);focus(e);events.get('click')!({target:e,detail})},
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
    ui.click('[data-slot="0"]')
    const inventoryScroll=318
    ui.get('.bay-shop-products').scrollTop=inventoryScroll
    ui.click(`[data-stock="${id}"]`)
    assert.equal(ui.get('[data-stock-quantity]').value,'1')
    assert.deepEqual(farm,before)
    ui.click('[data-stock-cancel]',detail)
    t.diagnostic(JSON.stringify({day:farm.day,actions,catalogItems:items.length,position:items.findIndex(item=>item.id===id)+1,input:detail?'pointer':'keyboard',before:inventoryScroll,after:ui.get('.bay-shop-products').scrollTop}))
    assert.equal(ui.get('.bay-shop-products').scrollTop,inventoryScroll)
    assert.equal(ui.focused,ui.get(detail?'[data-slot="0"]':`[data-stock="${id}"]`))
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
