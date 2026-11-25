import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
import {stripTypeScriptTypes} from 'node:module'
import * as F from '../src/farm.ts'
import {getMarketOrderBoard,renderMarketOrderPicker} from '../src/market-orders-view.ts'
import {getNextMarketOrders,renderNextMarketOrder} from '../src/market-return.ts'
import {earnedMarketOrderChoice} from './fixtures/earned-market-order-choice.ts'

const read=(file:string)=>readFileSync(new URL(file,import.meta.url),'utf8')
const main=read('../src/main.ts'),helperModule=read('../src/market-orders-view.ts')
function slice(src:string,from:string,to:string) {
  const start=src.indexOf(from),end=src.indexOf(to,start+from.length)
  assert.ok(start>=0&&end>start)
  return src.slice(start,end)
}
const marketCase=stripTypeScriptTypes(`switch(panel){${slice(main,"    case 'market':\n      dialogContent.innerHTML", "    case 'berry-renewal':")}}`)
const handlers=stripTypeScriptTypes(`switch(chosen){${slice(main,"    case 'market-order-select':","    case 'project-boat':")}}`)
const ordersView=stripTypeScriptTypes(slice(main,'function marketOrders()','\nfunction deliveryItems'))
const helper=helperModule.indexOf('export function placeReadyMarketOrder(')
const layout=helper>=0 ? stripTypeScriptTypes(helperModule.slice(helper+'export '.length)) : ''
const listen=main.includes("stackedMarketOrders.addEventListener('change'")
  ? stripTypeScriptTypes(slice(main,"stackedMarketOrders.addEventListener('change'",'\nwindow.matchMedia(')) : ''
const media=main.match(/const stackedMarketOrders = window\.matchMedia\('([^']+)'\)/)?.[1]

/** Model insert/remove behavior that may blur; no artificial focus recovery from the harness. */
type DocumentLike = { activeElement: ElementLike | null }
class ElementLike {
  ownerDocument:DocumentLike
  name:string
  children:ElementLike[]=[]
  parent?:ElementLike
  targets=new Map<string,ElementLike>()
  moves=0
  focused=0
  scrollTop=0
  constructor(document:DocumentLike,name:string){ this.ownerDocument=document;this.name=name }
  get firstElementChild(){return this.children[0]}
  querySelector(selector:string){return this.targets.get(selector) ?? null}
  scrollIntoView(){}
  contains(node:ElementLike):boolean{return node===this||this.children.some(child=>child.contains(node))}
  focus(options:{preventScroll:boolean}){assert.deepEqual({...options},{preventScroll:true});this.focused++;this.ownerDocument.activeElement=this}
  insertBefore(node:ElementLike,before:ElementLike|null){
    const previous=node.parent
    if(previous){
      const active=this.ownerDocument.activeElement
      if(active&&node.contains(active))this.ownerDocument.activeElement=null
      previous.children.splice(previous.children.indexOf(node),1)
    }
    this.children.splice(before===null?this.children.length:this.children.indexOf(before),0,node)
    node.parent=this;this.moves++
  }
  append(node:ElementLike){this.insertBefore(node,null)}
}
function mount(farm:F.FarmState,stacked:boolean,selectedMarketOrder?:string){
  const document:DocumentLike={activeElement:null}
  const content=new ElementLike(document,'content')
  let html='',writes=0
  let mounted:{workspace:ElementLike;picker:ElementLike;detail:ElementLike;order:ElementLike;action:ElementLike}
  let resize:((e:{matches:boolean})=>void)|undefined
  const close=new ElementLike(document,'close')
  const scope={
    ...F, HTMLElement:ElementLike, farm, panel:'market',marketTab:'orders',dialog:{open:true},dialogContent:content,
    stackedMarketOrders:{matches:stacked,addEventListener(name:string,fn:typeof resize){assert.equal(name,'change');resize=fn}},
    value:undefined as string|undefined,chosen:undefined as string|undefined,selectedMarketOrder, pickedMarketOrder:undefined,
    getMarketOrderBoard,renderMarketOrderPicker,getNextMarketOrders,renderNextMarketOrder,
    icon:()=>'', numberFormat:new Intl.NumberFormat('ru'),ruPlural:()=>'',marketOrderStockTile:()=>'<li>stock</li>',
    button:(label:string,action:string,enabled:boolean,options:{value:string})=>`<button data-action="${action}" data-value="${options.value}"${enabled?'':' disabled'}>${label}</button>`,
    drawPanel:()=>{ run(marketCase) }, marketCards:()=>run('marketOrders()'),
    perform:(fn:()=>F.ActionResult)=>{const result=fn();if(result.ok){writes++;scope.drawPanel()}return result.ok},
  }
  function run(src:string){return runInNewContext(src,scope)}
  Object.defineProperty(content,'innerHTML',{set(value:string){
    html=value
    assert.match(value,/<div class="market-orders-workspace"><nav class="market-order-picker"/)
    const status=value.match(/<section class="market-order" data-status="([^"]+)"/)![1]
    const workspace=new ElementLike(document,'workspace'),picker=new ElementLike(document,'picker'),detail=new ElementLike(document,'detail'),order=new ElementLike(document,'order')
    const entries=[...slice(value,'<nav class="market-order-picker"','</nav>').matchAll(/data-action="market-order-select" data-value="([^"]+)"/g)]
    for(const [,lane] of entries)picker.append(new ElementLike(document,lane))
    const tags=[...value.matchAll(/<button data-action="deliver-order" data-value="([^"]+)"( disabled)?>/g)]
    assert.ok(tags.length<=1)
    const action=new ElementLike(document,`deliver:${tags[0]?.[1]??'none'}`)
    order.append(new ElementLike(document,'header'))
    const items=new ElementLike(document,'ingredients')
    if(status!=='delivered')order.append(items)
    if(tags.length)order.append(action)
    content.targets.set('.market-orders-workspace',workspace)
    content.targets.set('.market-order-picker',picker);content.targets.set('.market-order-detail',detail)
    workspace.targets.set(':scope > .market-order-picker',picker);workspace.targets.set(':scope > .market-order-detail',detail)
    if(status==='ready')detail.targets.set(':scope > .market-order[data-status="ready"]',order)
    if(status!=='delivered')order.targets.set(':scope > .order-items',items)
    if(tags.length&&!tags[0][2])order.targets.set(':scope > [data-action="deliver-order"]:not(:disabled)',action)
    workspace.append(picker);workspace.append(detail);detail.append(order);workspace.moves=0;order.moves=0
    mounted={workspace,picker,detail,order,action}
  }})
  run(ordersView)
  if(layout)run(layout)
  if(listen)run(listen)
  close.focus({preventScroll:true});scope.drawPanel()
  return { get view(){return mounted}, get html(){return html}, get writes(){return writes}, document,close,
    layout:(matches:boolean)=>{scope.stackedMarketOrders.matches=matches;resize?.({matches})},
    change:(action:string,value:string)=>{scope.chosen=action;scope.value=value;run(handlers)},
  }
}
const orderOf=(el:ElementLike)=>el.children.map(x=>x.name)

test('ordinary narrow Orders adds no action: selected ready content before alternate list and its existing explicit button before inert stock',()=>{
  const farm=earnedMarketOrderChoice(),before=structuredClone(farm)
  const x=mount(farm,true)
  assert.deepEqual(orderOf(x.view.workspace),['detail','picker'])
  assert.deepEqual(orderOf(x.view.order),['header','deliver:pantry','ingredients'])
  assert.deepEqual(orderOf(x.view.picker),['pantry','kitchen','garden','grove','coop','irrigation','cape'])
  assert.equal(media,'(max-width: 600px)')
  assert.match(read('../src/market-orders-view.css'),/@media\(max-width:600px\)[\s\S]*\.market-orders-workspace\{display:flex;flex-direction:column;gap:12px\}/)
  assert.equal(x.document.activeElement,x.close);assert.equal(x.view.action.focused,0)
  assert.equal(x.writes,0);assert.deepEqual(farm,before)
})

test('desktop order, picker position, and the same focused node survive both resize directions without arming another button',()=>{
  const farm=earnedMarketOrderChoice(),before=structuredClone(farm)
  const x=mount(farm,false)
  const {workspace,picker,detail,order,action}=x.view
  assert.deepEqual(orderOf(workspace),['picker','detail'])
  assert.deepEqual(orderOf(order),['header','ingredients','deliver:pantry'])
  const alternate=picker.children[1]; alternate.focus({preventScroll:true});picker.scrollTop=72
  x.layout(true)
  assert.equal(x.view.detail,detail);assert.equal(x.view.action,action)
  assert.deepEqual(orderOf(workspace),['detail','picker'])
  assert.equal(x.document.activeElement,alternate);assert.equal(alternate.focused,1);assert.equal(picker.scrollTop,72)
  action.focus({preventScroll:true})
  x.layout(false)
  assert.deepEqual(orderOf(workspace),['picker','detail'])
  assert.deepEqual(orderOf(order),['header','ingredients','deliver:pantry'])
  assert.equal(x.document.activeElement,action);assert.equal(action.focused,2)
  x.layout(false)
  assert.equal(workspace.moves,2);assert.equal(order.moves,2);assert.equal(action.focused,2)
  assert.equal(x.writes,0);assert.deepEqual(farm,before)
})

test('waiting selections and delivered receipts retain useful original order; first selection still performs no hand-in',()=>{
  const farm=earnedMarketOrderChoice(),before=structuredClone(farm),x=mount(farm,true,'garden')
  assert.deepEqual(orderOf(x.view.workspace),['picker','detail'])
  assert.match(x.html,/data-value="garden" aria-pressed="true"/)
  assert.match(x.html,/data-action="deliver-order" data-value="garden" disabled/)
  x.layout(false);x.layout(true)
  assert.equal(x.view.workspace.moves,0);assert.equal(x.view.order.moves,0)
  x.change('market-order-select','kitchen')
  assert.deepEqual(orderOf(x.view.workspace),['detail','picker'])
  assert.deepEqual(orderOf(x.view.order),['header','deliver:kitchen','ingredients'])
  assert.equal(x.writes,0);assert.deepEqual(farm,before)
  x.change('deliver-order','kitchen')
  assert.deepEqual([farm.coins-before.coins,farm.eggs,farm.produce.wheat,farm.dishes.appleJam],[32,3,0,0])
  assert.deepEqual(orderOf(x.view.workspace),['picker','detail'])
  assert.doesNotMatch(x.html,/data-action="deliver-order"/)
  assert.match(x.html,/Сегодня доставлено/)
  const delivered=structuredClone(farm)
  x.change('deliver-order','kitchen')
  assert.equal(x.writes,1);assert.deepEqual(farm,delivered)
  assert.equal(F.getMarketOrders(farm).find(o=>o.lane==='pantry')?.status,'waiting')
})

test('when a previously missing source returns ready, only a relocated card is revealed, never the newly enabled spend button',()=>{
  const branch=slice(main,"    else if (previous.marketOrder?.source || previous.marketOrder?.warehouse)",'    else if (supperCottage)')
  const run=stripTypeScriptTypes(`if(false){} ${branch}`)
  for(const stacked of [true,false]){
    const calls:string[]=[]
    const detail={focus:(options:{preventScroll:boolean})=>{assert.deepEqual({...options},{preventScroll:true});calls.push('detail-focus')},
      scrollIntoView:(options:{block:string})=>{assert.deepEqual({...options},{block:'nearest'});calls.push('detail-reveal')}}
    const scope={previous:{marketOrder:{source:'wheat'}},dialogContent:{querySelector:(selector:string)=>{
      if(selector==='.market-order-detail')return detail
      assert.equal(selector,'.market-orders-workspace > .market-order-detail:first-child')
      return stacked ? detail : null
    }}}
    runInNewContext(run,scope)
    assert.deepEqual(calls,stacked?['detail-focus','detail-reveal']:['detail-focus'])
  }
  assert.doesNotMatch(branch,/\.click|perform|deliverMarketOrder\(/)
})
