import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { stripTypeScriptTypes } from 'node:module'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import { createServer } from 'vite'
import * as F from '../src/farm.ts'
import * as harbour from '../src/harbour-economy.ts'
import * as shopModel from '../src/bay-shop-model.ts'
import * as shopQuantity from '../src/bay-shop-quantity.ts'
import { BayShopCustomerView, renderBayShopCustomers } from '../src/bay-shop-customers.ts'
import { bayShopDayGuidance } from '../src/bay-shop-day.ts'
import { bayShopPurchaseReaction } from '../src/bay-shop-speech.ts'
import { shopRemainderQuote, shopReturnLabel } from '../src/bay-shop-price-copy.ts'
import { RecipeBookNavigation, selectedBookId } from '../src/recipe-book-view.ts'
import { describeFood } from '../src/intent-orders.ts'
import { ruCount } from '../src/ru.ts'
import { isGuardedAction } from '../src/action-click-guard.ts'
import { commissionPlayer } from './fixtures/commission-player.ts'

const source=(name:string)=>readFileSync(new URL('../src/'+name+'.ts',import.meta.url),'utf8')
const main=source('main'),shop=source('bay-shop')
function part(source:string,from:string,to:string) {
  const start=source.indexOf(from),end=source.indexOf(to,start+from.length)
  assert.ok(start>=0&&end>start,from);return source.slice(start,end)
}
const executable=stripTypeScriptTypes([
  part(main,'function focusKey(', 'let harbourScene:'),
  part(main,'function stopHarbour()', 'function openMusicScene(').replaceAll('import.meta.env.BASE_URL','"/"'),
  part(main,'async function visitPanelAt(', 'function openRecipeBook('),
  part(main,'function closeDialog()', 'const bedTools'),
  'async function enter(control){const value=control.dataset.value;switch(control.dataset.action){',
  ...(main.includes("    case 'recipe-harbour-shop':") ? [part(main,"    case 'recipe-harbour-shop':","    case 'open-panel':")] : []),
  part(main,"    case 'open-panel':",'\n'),'}}',
  shop.slice(shop.indexOf('const escape =')).replace('export function mountBayShop','function mountBayShop'),
  '({enter,openPanel,openShopScene,harbourGoods,goBack,closeDialog})',
].join('\n'),{mode:'transform',sourceMap:false})
type Renderer=(farm:F.FarmState,art:{icon():string;stock():string},view:RecipeBookNavigation['view'])=>string
const plain=<T,>(value:T):T=>JSON.parse(JSON.stringify(value))
const opening=JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json',import.meta.url),'utf8'))

/** DOM/animation/audio adapters only. The book, shop, farm, and the route/click handlers are production code. */
function browse(start:F.FarmState,id:string,render:Renderer) {
  const farm=plain(start), crossings:F.IslandId[]=[], saves:F.FarmState[]=[], frames:(()=>void)[]=[]
  const recipeBook=new RecipeBookNavigation()
  const document={activeElement:null as Node|null,hidden:false}
  class Node {
    dataset:Record<string,string>;value='';textContent='';disabled=false;readonly tag:string;readonly markup:string
    constructor(tag:string,markup:string) {
      this.tag=tag;this.markup=markup
      this.dataset=Object.fromEntries([...markup.matchAll(/\sdata-([\w-]+)="([^"]*)"/g)].map(([,name,value])=>[name.replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase()),value]))
      this.disabled=this.hasAttribute('disabled')
    }
    getAttribute(key:string) {
      const match=this.markup.match(new RegExp('\\s'+key+'(?:="([^"]*)")?(?=[\\s>])'))
      return match ? match[1]??'' : null
    }
    hasAttribute(key:string) { return this.getAttribute(key)!==null }
    get className(){return this.getAttribute('class')??''}
    matches(selector:string) {
      if(selector===':disabled')return this.disabled
      if(selector.startsWith('.'))return this.className.split(' ').includes(selector.slice(1))
      const query=selector.match(/^\[([\w-]+)(?:="([^"]*)")?\]$/)
      return !!query&&(query[2]===undefined?this.hasAttribute(query[1]):this.getAttribute(query[1])===query[2])
    }
    closest(sel:string){return sel==='button'&&this.tag==='button'?this:null}
    getClientRects(){return [{}]}
    focus(){document.activeElement=this}
    scrollIntoView(){}
  }
  class View {
    nodes:Node[]=[]; content='';scrollTop=0
    listeners=new Map<string,(event:{target:Node;preventDefault():void})=>void>()
    set innerHTML(value:string) {
      this.content=value
      this.nodes=[...value.matchAll(/<(button|input|form|p|h3|strong)\b[^>]*>/g)].map(([tag,name])=>new Node(name,tag))
    }
    get innerHTML(){return this.content}
    querySelector(selector:string){return this.nodes.find(node=>node.matches(selector))??null}
    querySelectorAll(){return []}
    contains(node:Node){return this.nodes.includes(node)}
    addEventListener(event:string,fn:(event:{target:Node;preventDefault():void})=>void){this.listeners.set(event,fn)}
    removeEventListener(event:string){this.listeners.delete(event)}
    fire(which:string,node:Node){this.listeners.get(which)?.({target:node,preventDefault(){}})}
    click(selector:string){const node=this.querySelector(selector);assert.ok(node,selector);node.focus();this.fire('click',node);return node}
  }
  const noop=()=>{}
  const modal=new View()
  const dialog={open:false,close(){this.open=false},showModal(){this.open=true},
    querySelectorAll(){return modal.nodes.filter(n=>n.tag==='button'&&!n.disabled)}}
  const closeButton=new Node('button','<button>'),reset={reset:noop}
  const fields='journeyDetailsOpen journalDetailsOpen selectedExpeditionPort selectedExpeditionOffer selectedWarehouseRequest selectedWarehouse freightPlanOpen inventoryGroup boatIsland marketSaleFamily marketSaleQuery marketTab marketCategory marketSellGroup bagTab archiveGroup treeSlot previewSeed specializationBuilding previewSpecialization irrigationMode villageSlot pastryShape workshopRecipe cookingDish cookingFish seedPickerBed signatureBase signatureSlot signatureRepeatId expandedRepeatId cookingMode communityOrderId communityResident requestedFood kitchenTart kitchenPreserves kitchenGroup kitchenDish honeyKitchenDish signatureFamily hiveFlower celebratedFestival nextShopStock harbourScene musicView selectedMarketOrder pickedMarketOrder marketTreeSpaceVisit'.split(' ')
  let shopHost:View|undefined,finishSail:(()=>void)|undefined,routing=false,ui:any
  const island={isCrossing:()=>routing,setViewMode:noop,setCoveFocus:noop,render:noop,
    async crossIsland(travel:()=>boolean){assert.equal(routing,false);routing=true;await new Promise<void>(resolve=>{finishSail=resolve})
      assert.equal(travel(),true);crossings.push(farm.island);routing=false}}
  const ctx:any={...F,...harbour,...shopModel,...shopQuantity,...Object.fromEntries(fields.map(name=>[name,undefined])),
    farm,recipeBook,selectedBookId,document,HTMLButtonElement:Node,HTMLInputElement:Node,HTMLElement:Node,Element:Node,dialog,island,closeButton,
    panel:undefined,panelHistory:[],panelRenderVersion:0,panelTitles:{recipes:'Мои рецепты','bay-shop':'Своя лавка','shop-commissions':'Заказы'},
    dialogContent:{...modal,contains:(node:Node)=>modal.contains(node),querySelector:(q:string)=>shopHost?.querySelector(q)??modal.querySelector(q),querySelectorAll:()=>[]},
    bayAudio:{cancelMapPage:noop,playEvent:noop},playBaySound:noop,notify:noop,textAt:noop,status:noop,updateCommunityReturn:noop,
    clearTimeout:noop,cancelAnimationFrame:noop,requestAnimationFrame:(f:()=>void)=>frames.push(f),window:{setTimeout:()=>0,clearTimeout:noop},
    matchMedia:()=>({matches:false}),ResizeObserver:class{observe(){}disconnect(){}},CSS:{escape:(x:string)=>x},performance:{now:()=>0},
    fieldViewButton:{getAttribute:()=>null},app:{dataset:{}},toast:{},dialogFeedback:{},signatureSlots:[],
    gardenEditor:reset,berryRenewalSelection:reset,berryNurserySelection:reset,transplantSelection:reset,recipeSurplusSelection:reset,
    rememberClosedMarketSell:noop,salePresentation:{place:undefined,reset:noop},marketSaleBrowse:{reset:noop},ferryArrival:{take:()=>false},ferryRestockHandoff:{cancelPreview:noop},
    stopFishing:noop,stopCookery:noop,stopWorkshop:noop,stopArrangement:noop,restoreFerryPanelView:noop,
    stockLabel:(item:F.StockItem)=>({name:harbour.bayProductId(item),image:'placeholder'}),
    applyIngredientFinishes:noop,icon:()=>'',iconUrl:()=>'/art/example.webp',signatureResultPicture:()=>'',cookeryResultPicture:()=>'',itemIcon:()=>'',dishIcons:{},
    describeFood,numberFormat:new Intl.NumberFormat('ru-RU'),BayShopCustomerView,renderBayShopCustomers,bayShopDayGuidance,bayShopPurchaseReaction,shopRemainderQuote,shopReturnLabel,ruCount,
    saveFarm(){const snapshot=plain(farm);assert.deepEqual(F.restoreCurrentFarm(snapshot),snapshot);saves.push(snapshot)},
    drawPanel(){
      ctx.panelRenderVersion++
      document.activeElement=null
      modal.innerHTML=''
      shopHost=undefined
      if(ctx.panel==='recipes') modal.innerHTML=render(farm,{icon:()=>'',stock:()=>''},recipeBook.view)
      if(ctx.panel==='bay-shop'){shopHost=new View();ui.openShopScene(shopHost)}
    },
  }
  ui=runInNewContext(executable,ctx)
  ui.openPanel('recipes',true,farm.island,'page.unfold',id)
  const source=()=>{const button=modal.nodes.find(n=>n.dataset.action==='recipe-harbour-shop'||n.dataset.action==='open-panel'&&n.dataset.value==='bay-shop');assert.ok(button);return button}
  const settle=async()=>{if(finishSail){const done=finishSail;finishSail=undefined;done()}
    for(let i=0;i<8;i++)await Promise.resolve()
    for(const f of frames.splice(0))f()}
  return {farm,ui,modal,document,recipeBook,saves,crossings,island,source,settle,open(button=source()){button.focus();void ui.enter(button)},
    scene(){assert.ok(shopHost);return shopHost}, redraw:ctx.drawPanel}
}
function olderRecipe() {
  const p=commissionPlayer(opening.slice(0,opening.findIndex((step:{name:string})=>step.name==='inviteResident')+1))
  const id=p.cook();p.cook(id)
  p.fruit('apple',1);p.fruit('pear',1);p.visit('village')
  const newer=p.act('completeSignature',{base:'preserves',ingredients:[{id:'apple',quantity:1},{id:'pear',quantity:1}]},
    {family:'preserves',processing:'bright',fruit:[],steps:['mix','pour']}).recipeId as string
  assert.notEqual(id,newer)
  p.night() // Real ordinary overnight, with save/reopen after each of these actions.
  assert.equal(selectedBookId(p.state,{}),newer)
  assert.deepEqual([p.state.island,p.state.culinary.stock[id],p.state.culinary.stock[newer]],['home',2,1])
  return {state:p.state,id,newer}
}

test('an earned older recipe opens its own quantity preview and returns without a second sail',async()=>{
  const server=await createServer({root:fileURLToPath(new URL('..',import.meta.url)),configFile:false,
    server:{middlewareMode:true,ws:false,hmr:false},appType:'custom'})
  try {
    const {signatureBook}=await server.ssrLoadModule('/src/culinary-ui.ts')
    const {state,id,newer}=olderRecipe()
    const start=browse(state,id,signatureBook)
    assert.match(start.modal.innerHTML,/В лавку в гавань/)
    start.open();assert.ok(start.island.isCrossing());await start.settle()
    const host=start.scene(),form=host.querySelector('[data-stock-form]')
    assert.ok(form,'the advertised crossing must open the older selected recipe, not the general list')
    assert.match(host.innerHTML,/data-stock-quantity[^>]*max="2"[^>]*value="1"/)
    assert.ok(start.document.activeElement?.hasAttribute('data-stock-quantity'))
    assert.equal(host.querySelector('[data-close]')?.getAttribute('aria-label'),'К рецепту')
    assert.match(host.innerHTML,/>К рецепту<\/button>/)
    const atHarbour={...state,island:'village'}
    assert.deepEqual(start.crossings,['village'])
    assert.deepEqual(start.farm,atHarbour)
    assert.equal(start.saves.length,1)
    host.click('[data-close]');await start.settle();host.fire('submit',form)
    assert.deepEqual(start.crossings,['village'])
    assert.match(start.modal.innerHTML,new RegExp('data-selected-recipe="'+id+'"'))
    assert.deepEqual(start.farm,atHarbour)

    const place=browse(state,id,signatureBook)
    place.open();await place.settle()
    const shelf=place.scene(), stock=shelf.querySelector('[data-stock-form]')!;assert.ok(stock)
    shelf.fire('submit',stock);shelf.fire('submit',stock)
    assert.equal(place.saves.length,2)
    assert.equal(place.farm.bayShop.slots[0]?.product.id,'signature:'+id)
    assert.equal(place.farm.bayShop.slots[0]?.quantity,1)
    assert.deepEqual(place.farm.culinary.stock,{[id]:1,[newer]:1})
    assert.equal(place.farm.coins,state.coins)
    shelf.click('[data-close]');await place.settle()
    assert.match(place.modal.innerHTML,new RegExp('data-selected-recipe="'+id+'"'))
    assert.ok(isGuardedAction('recipe-harbour-shop'))

    const detached=browse(state,id,signatureBook),obsolete=detached.source()
    assert.ok(detached.recipeBook.select(detached.farm,newer))
    detached.redraw();detached.open(obsolete);await detached.settle()
    assert.deepEqual(detached.farm,state)
    assert.deepEqual(detached.crossings,[])
    assert.match(detached.modal.innerHTML,new RegExp('data-selected-recipe="'+newer+'"'))

    const full=plain(state)
    assert.ok(F.sail(full,'village').ok)
    const fillers=plain(browse(full,id,signatureBook).ui.harbourGoods()).filter((product:shopModel.BayShopStock)=>product.quantity>0&&product.id!=='signature:'+id).slice(0,4)
    assert.equal(fillers.length,4)
    for(const [slot,product] of fillers.entries())
      assert.ok(shopQuantity.placeShopQuantity(full.bayShop,slot,product,1,(key,n)=>harbour.reserveShopGoods(full,key,n)))
    assert.ok(F.sail(full,'grove').ok)
    const blocked=browse(full,id,signatureBook)
    blocked.open();await blocked.settle()
    const fullShop=blocked.scene()
    assert.deepEqual(blocked.farm,{...full,island:'village'})
    assert.equal(fullShop.querySelector('[data-stock-form]'),null)
    assert.match(fullShop.innerHTML,/Все места заняты/)
    fullShop.click('[data-close]');await blocked.settle()
    assert.match(blocked.modal.innerHTML,new RegExp('data-selected-recipe="'+id+'"'))
    assert.deepEqual(blocked.crossings,['village'])
    blocked.ui.closeDialog()
    blocked.ui.openPanel('bay-shop')
    assert.equal(blocked.scene().querySelector('[data-stock-form]'),null,'a later ordinary visit does not re-arm the quote')
    assert.equal(blocked.scene().querySelector('[data-close]')?.getAttribute('aria-label'),'Вернуться в бухту')
  } finally {await server.close()}
})
