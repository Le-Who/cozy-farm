import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import {test} from 'node:test'
import {runInNewContext as vm} from 'node:vm'
import * as farmApi from '../src/farm.ts'
import * as economy from '../src/harbour-economy.ts'
import * as model from '../src/bay-shop-model.ts'
import * as amounts from '../src/bay-shop-quantity.ts'
import * as intent from '../src/intent-orders.ts'
import * as price from '../src/bay-shop-price-copy.ts'
import * as viewer from '../src/bay-shop-customers.ts'
import {getNeighborFoodRecovery} from '../src/neighbor-food-recovery.ts'
import {bayShopDayGuidance} from '../src/bay-shop-day.ts'
import {ruCount} from '../src/ru.ts'
import {bayProductId} from '../src/bay-product-id.ts'
import {commissionPlayer} from './fixtures/commission-player.ts'

const read = (name:string) => readFileSync(new URL(name,import.meta.url),'utf8')
const opening = JSON.parse(read('./fixtures/home-progress-actions.json'))
const main = read('../src/main.ts'), shop = read('../src/bay-shop.ts')
function extract(src:string, from:string, to:string) {
  const start=src.indexOf(from), end=src.indexOf(to,start+from.length)
  assert.ok(start>=0 && end>start,from)
  return src.slice(start,end)
}
const renderer = stripTypeScriptTypes(shop.slice(shop.indexOf('const escape =')).replace('export function mountBayShop','function mountBayShop')+';mountBayShop')
const catalogProduction = stripTypeScriptTypes(extract(main,'function harbourGoods(', 'function openShopScene(')
  .replaceAll('import.meta.env.BASE_URL','"/"')+';harbourGoods()')
function catalogue(farm:farmApi.FarmState):model.BayShopStock[] {
  return vm(catalogProduction,{...farmApi,...intent,farm,bayProductId,iconUrl:(id:string)=>'/art/lavender/'+id+'.webp',
    stockLabel:(item:farmApi.StockItem)=>({name:item.kind==='dishes'?farmApi.dishDefinitions[item.item].name:bayProductId(item),
      image:item.kind==='dishes'&&item.item==='orchardTart'?'ui-tart':'ui-market'})})
}
const dispatch = stripTypeScriptTypes(extract(main,'function openShopScene(','function openMusicScene(')
  +extract(main,'async function visitPanelAt(','function openGuidedMarket(')
  +extract(main,'function leaveScene()','function rememberPanel()')
  +"\n;({ openShopScene, recall: async () => { switch('neighbor-shelf-food'){"
  +extract(main,"    case 'neighbor-shelf-food':","    case 'neighbor-repeat-food':")+'}}})')
const plan = 'bea:1', food = 'signature:s1'
function earned() {
  const p=commissionPlayer(opening)
  assert.deepEqual([p.actions,p.state.day,p.state.village.residents,p.state.dishes.orchardTart],[107,14,['bea','finn'],1])
  p.fruit('apple',3);p.fruit('pear',3);p.visit('village')
  assert.equal(p.act('completeSignature',{base:'preserves',ingredients:[{id:'apple',quantity:1},{id:'pear',quantity:1}]},
    {family:'preserves',processing:'silky',fruit:[],steps:['mix','pour']}).recipeId,'s1')
  p.act('repeatSignature','s1')
  p.act('joinNeighborPlan',plan);p.act('serveNeighborPlan',plan,food)
  const farm=p.state, goods=catalogue(farm)
  for (const [i,id,n] of [[0,'dish:orchardTart',1],[2,food,2]] as const) {
    assert.ok(amounts.placeShopQuantity(farm.bayShop,i,goods.find(row=>row.id===id)!,n,(key,count)=>economy.reserveShopGoods(farm,key,count)))
  }
  assert.ok(model.setBayShopPrice(farm.bayShop,2,16))
  p.reload()
  assert.deepEqual([p.actions,p.state.day,p.state.coins,p.state.culinary.stock.s1,p.state.bayShop.slots.map(slot=>slot?.product.id??null)],
    [122,16,68,0,['dish:orchardTart',null,food,null]])
  assert.equal(getNeighborFoodRecovery(p.state,plan)?.shelved,2)
  return p.state
}
class Element {
  disabled=false
  private readonly attrs:Record<string,string>
  private readonly onFocus?:()=>void
  constructor(attrs:Record<string,string>={},onFocus?:()=>void) { this.attrs=attrs;this.onFocus=onFocus }
  get dataset(){return Object.fromEntries(Object.entries(this.attrs).filter(([key])=>key.startsWith('data-')).map(([key,value])=>[key.slice(5),value]))}
  hasAttribute(k:string){return Object.hasOwn(this.attrs,k)}
  getAttribute(k:string){return this.attrs[k]??null}
  closest(s:string){return s==='button'?this:null}
  matches(s:string){return s===':disabled'&&this.disabled}
  focus(){this.onFocus?.()}
}
function scene(farm:farmApi.FarmState, beforeMount?:()=>void) {
  let html='', active:Element|null=null
  let nodes:Element[]=[]
  const listeners=new Map<string,(event:unknown)=>void>(), focused:string[]=[], events:string[]=[], writes:farmApi.FarmState[]=[]
  const host={
    get innerHTML(){return html},
    set innerHTML(raw:string){
      html=raw
      nodes=[...raw.matchAll(/<button\b([^>]*)>/g)].map(([,attrs])=>{
        const values=Object.fromEntries([...attrs.matchAll(/([a-zA-Z][a-zA-Z0-9-]*)(?:="([^"]*)")?/g)].map(([,k,v])=>[k,v??'']))
        const node=new Element(values,()=>{active=node;focused.push(values['data-slot']??'other')})
        node.disabled=Object.hasOwn(values,'disabled')
        return node
      })
    },
    contains(node:Element){return nodes.includes(node)},
    querySelector(s:string){
      const selector=/^\[([^=\]]+)(?:="([^"]*)")?\]$/.exec(s)
      return selector ? nodes.find(node=>node.hasAttribute(selector[1])&&(selector[2]===undefined||node.getAttribute(selector[1])===selector[2]))??null : null
    },
    querySelectorAll(){return []},
    addEventListener(key:string, callback:(event:unknown)=>void){listeners.set(key,callback)},
    removeEventListener(key:string){listeners.delete(key)}
  }
  const ctx={...farmApi,...economy,getNeighborFoodRecovery,farm,value:plan,
    panel:'neighbor',communityResident:'bea',control:{dataset:{food}},communityRequest:undefined as unknown,
    requestedFood:food,dialog:{open:true},panelHistory:[] as {panel:string}[],
    fieldViewButton:{getAttribute:()=> 'false'},island:{isCrossing:()=>false,crossIsland:()=>assert.fail('no crossing')},
    harbourGoods:()=>catalogue(farm),nextShopStock:undefined,harbourScene:undefined,
    drawPanel:()=>events.push('redraw'),applyIngredientFinishes(){},icon:()=>'',itemIcon:()=>'',signatureResultPicture:()=>'',cookeryResultPicture:()=>'',status(){},
    saveHarbour(){writes.push(structuredClone(farm))},bayAudio:{playEvent(){}},
    // openPanel/goBack here stand for the dialog lifecycle boundary; dispatch, visitPanelAt
    // and actual shop render/click/close behavior run from source.
    openPanel(next:string){ctx.panelHistory.push({panel:ctx.panel});ctx.panel=next;events.push(next);beforeMount?.();api.openShopScene(host)},
    goBack(){ctx.panel=ctx.panelHistory.pop()?.panel??'field';events.push('Back')},
    closeDialog(){ctx.panel='field';ctx.dialog.open=false},
    mountBayShop(element:typeof host,options:unknown){
      return vm(renderer,{...model,...amounts,...viewer,...price,bayShopDayGuidance,ruCount,Element,HTMLElement:Element,HTMLInputElement:Element,
        document:{get activeElement(){return active},hidden:false},CSS:{escape:(str:string)=>str},
        performance:{now:()=>0},ResizeObserver:class{observe(){} disconnect(){}},matchMedia:()=>({matches:true}),
        window:{setTimeout:()=>1},clearTimeout(){},playBaySound(){},applyIngredientFinishes(){},
        requestAnimationFrame:()=>1,cancelAnimationFrame(){}})(element,options)
    }}
  const api=vm(dispatch,ctx)
  function press(s:string){const target=host.querySelector(s);assert.ok(target,s);target.focus();listeners.get('click')!({target,detail:0})}
  const selected=()=>Number(nodes.find(n=>n.hasAttribute('data-slot')&&n.getAttribute('aria-pressed')==='true')?.getAttribute('data-slot'))
  return {ctx,host,focused,events,writes,selected,enter:()=>api.recall() as Promise<void>,press}
}

test('Bea’s earned missing treat opens the occupied exact shelf, focuses it, and changes nothing before an explicit action',async()=>{
  const farm=earned(), before=structuredClone(farm), shop=scene(farm)
  await shop.enter()
  assert.deepEqual(shop.events,['bay-shop'])
  assert.equal(shop.selected(),2,'correct human slot 3, rather than the empty/default slot 2')
  assert.deepEqual(shop.focused,['2'])
  assert.match(shop.host.innerHTML,/aria-label="Вернуть непроданное в припасы: 2"/)
  assert.match(shop.host.innerHTML,/value="16" aria-label="Цена за одну штуку в монетах"/)
  assert.doesNotMatch(shop.host.innerHTML,/data-stock-form/)
  assert.deepEqual(farm,before)
  assert.equal(shop.writes.length,0)
  shop.press('[data-close]')
  assert.deepEqual(shop.events,['bay-shop','Back'])
  assert.equal(shop.ctx.panel,'neighbor');assert.equal(JSON.stringify(shop.ctx.communityRequest),JSON.stringify({kind:'neighbor',resident:'bea',planId:plan}))
  assert.deepEqual(farm,before);assert.equal(shop.writes.length,0)

  const manual=scene(farm)
  await manual.enter();manual.press('[data-return]')
  assert.equal(manual.writes.length,1);assert.equal(farm.bayShop.slots[2],null);assert.equal(farm.culinary.stock.s1,2)
  assert.deepEqual(farm.bayShop.slots[0],before.bayShop.slots[0]);assert.equal(farm.coins,before.coins)
  manual.press('[data-close]');assert.equal(manual.ctx.panel,'neighbor')
  const assembly={kind:'table',settled:true,placements:[{slot:'food',x:0,y:0},{slot:'cup',x:-.5,y:.2},{slot:'flowers',x:.5,y:.2}]} as const
  assert.ok(farmApi.finishNeighborPlan(farm,plan,assembly).ok)
  assert.deepEqual([farm.culinary.stock.s1,farm.coins-before.coins,farm.neighbors.bea.completed],[1,31,1])
})

test('direct shop and a stale or replaced listing never select the neighbor’s old shelf',async()=>{
  const stock=earned()
  const ordinary=scene(structuredClone(stock))
  ordinary.ctx.openPanel('bay-shop')
  assert.equal(ordinary.selected(),1);assert.deepEqual(ordinary.focused,[]);assert.equal(ordinary.writes.length,0)
  const stale=scene(structuredClone(stock));stale.ctx.control.dataset.food='dish:orchardTart'
  await stale.enter()
  assert.deepEqual(stale.events,['redraw']);assert.equal(stale.writes.length,0)
  const gone=structuredClone(stock)
  const race=scene(gone,()=>{
    // Same stock mutation as the ordinary separate return between source click and mount.
    const returned=model.removeBayShopStock(gone.bayShop,2)!
    economy.returnShopGoods(gone,returned.id,returned.quantity)
  })
  await race.enter()
  assert.equal(race.selected(),1);assert.deepEqual(race.focused,[]);assert.equal(race.writes.length,0)
  assert.doesNotMatch(race.host.innerHTML,/value="16" aria-label="Цена за одну штуку в монетах"/)
})
