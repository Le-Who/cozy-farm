import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import {runInNewContext} from 'node:vm'
import test from 'node:test'
import * as F from '../src/farm.ts'
import {transferBayGoods} from '../src/harbour-economy.ts'
import {getMarketOrderBoard,renderMarketOrderPicker} from '../src/market-orders-view.ts'
import {pickUpMarketOrderStock} from '../src/market-order-pickup.ts'
import {earned416Mixed} from './fixtures/earned-416-market-orders.ts'

const read=(relative:string)=>readFileSync(new URL(relative,import.meta.url),'utf8')
const main=read('../src/main.ts')
function part(source:string,start:string,end?:string){
  const a=source.indexOf(start),b=end?source.indexOf(end,a+start.length):source.length
  assert.ok(a>=0&&b>a,start)
  return source.slice(a,b)
}
const render=stripTypeScriptTypes(
  part(main,'function marketOrderStockTile(','let selectedMarketOrder')
  +part(main,'function marketOrders()','function deliveryItems(')+';marketOrders()')
const helper=stripTypeScriptTypes(part(read('../src/market-orders-view.ts'),'function placeReadyMarketOrder('))
const installReady=part(main,"    case 'market':\n      dialogContent.innerHTML", "    case 'berry-renewal':")
const base=earned416Mixed()
base.act('deliverMarketOrder','garden')
const original=base.state
const cold=()=>F.restoreCurrentFarm(JSON.parse(JSON.stringify(original)))!

function emitted(farm:F.FarmState,selectedMarketOrder?:string){
  return runInNewContext(render,{...F,farm,selectedMarketOrder,getMarketOrderBoard,renderMarketOrderPicker,
    icon:()=>'',ruPlural:()=>'',getNextMarketOrders:()=>[],renderNextMarketOrder:()=>'',numberFormat:new Intl.NumberFormat('ru'),
    stockLabel:(item:F.StockItem)=>({name:F.marketKey(item),image:'stock'}),
    requirementLink:(html:string,_req:unknown,className:string,label:string,ready:boolean)=>
      `<button class="${className}" data-action="show-requirement" aria-label="${label}"${ready?' disabled':''}>${html}</button>`,
    button:(label:string,action:string,enabled:boolean,value:{value?:string}={})=>
      `<button data-action="${action}" data-value="${value.value??''}"${enabled?'':' disabled'}>${label}</button>`,
  }) as string
}

type TestDocument={activeElement:ElementNode|null}
class ElementNode{
  children:ElementNode[]=[]
  parent?:ElementNode
  focused=0
  moves=0
  scrollTop=0
  selectors=new Map<string,ElementNode>()
  ownerDocument:TestDocument
  name:string
  constructor(doc:TestDocument,name:string){this.ownerDocument=doc;this.name=name}
  get firstElementChild(){return this.children[0]}
  querySelector(selector:string){return this.selectors.get(selector)??null}
  contains(node:ElementNode):boolean{return this===node||this.children.some(child=>child.contains(node))}
  focus(options:{preventScroll:boolean}){
    assert.deepEqual({...options},{preventScroll:true})
    this.ownerDocument.activeElement=this;this.focused++
  }
  insertBefore(node:ElementNode,before:ElementNode|null){
    if(node.parent){
      const active=this.ownerDocument.activeElement
      if(active&&node.contains(active))this.ownerDocument.activeElement=null
      node.parent.children.splice(node.parent.children.indexOf(node),1)
    }
    const index=before===null?this.children.length:this.children.indexOf(before)
    assert.ok(index>=0)
    this.children.splice(index,0,node);node.parent=this;this.moves++
  }
  append(node:ElementNode){this.insertBefore(node,null)}
}
const names=(node:ElementNode)=>node.children.map(child=>child.name)
function mount(farm:F.FarmState,selected?:string){
  const html=emitted(farm,selected)
  const status=html.match(/<section class="market-order" data-status="([^"]+)"/)?.[1]
  assert.ok(status)
  const doc:TestDocument={activeElement:null}
  const element=(name:string)=>new ElementNode(doc,name)
  const content=element('content'),workspace=element('workspace'),picker=element('picker')
  const detail=element('detail'),order=element('order'),head=element('order heading'),items=element('requirements')
  const control=element('pickup'),deliver=element('deliver'),close=element('close')
  const pickerPart=part(html,'<nav class="market-order-picker"','</nav>')
  for(const [,id] of pickerPart.matchAll(/data-action="market-order-select" data-value="([^"]+)"/g))picker.append(element(id))
  const attribute=(action:string)=>html.match(new RegExp(`<button data-action="${action}" data-value="[^"]*"[^>]*>`))?.[0]
  const pickup=attribute('market-order-pickup'),delivery=attribute('deliver-order')
  const usable=(tag:string|undefined)=>tag&&!tag.includes(' disabled')
  content.selectors.set('.market-orders-workspace',workspace)
  workspace.selectors.set(':scope > .market-order-picker',picker)
  workspace.selectors.set(':scope > .market-order-detail',detail)
  order.selectors.set(':scope > .order-items',items)
  if(status==='ready')detail.selectors.set(':scope > .market-order[data-status="ready"]',order)
  if(status==='waiting'&&usable(pickup))detail.selectors.set(':scope > .market-order[data-status="waiting"] > button[data-action="market-order-pickup"]:not(:disabled)',control)
  if(usable(delivery))order.selectors.set(':scope > [data-action="deliver-order"]:not(:disabled)',deliver)
  workspace.append(picker);workspace.append(detail);detail.append(order);order.append(head)
  if(status!=='delivered')order.append(items)
  if(usable(pickup))order.append(control)
  if(usable(delivery))order.append(deliver)
  const scope={HTMLElement:ElementNode,content,stacked:false}
  runInNewContext(helper,scope)
  const layout=(stacked:boolean)=>{scope.stacked=stacked;runInNewContext('placeReadyMarketOrder(content,stacked)',scope)}
  close.focus({preventScroll:true})
  return {html,doc,workspace,picker,detail,order,items,control,deliver,close,layout}
}

test('cold-earned compact Orders put the exact paired pickup and its quantities before the seven alternate rows without a write',()=>{
  const farm=cold(),before=structuredClone(farm),board=getMarketOrderBoard(farm)
  assert.deepEqual([base.actions,farm.day,F.getSale(farm).items,board.selected,board.choices.length],[553,196,411,'pantry',7])
  const scene=mount(farm)
  assert.match(installReady,/placeReadyMarketOrder\(dialogContent, stackedMarketOrders.matches\)/)
  assert.match(scene.html,/data-value="pantry" aria-pressed="true"/)
  assert.match(scene.html,/>В запасе: 0 · со склада \+1</)
  assert.match(scene.html,/>В запасе: 0 · со склада \+2</)
  assert.match(scene.html,/data-action="market-order-pickup"/)
  assert.doesNotMatch(scene.html,/data-action="deliver-order"/)
  const choices=names(scene.picker)
  scene.layout(true)
  assert.deepEqual(names(scene.workspace),['detail','picker'])
  assert.deepEqual(names(scene.order),['order heading','requirements','pickup'],'quote remains before the action')
  assert.equal(scene.doc.activeElement,scene.close);assert.equal(scene.control.focused,0)
  assert.deepEqual(names(scene.picker),choices)
  assert.deepEqual(farm,before)
  const token=board.pickup!.token
  assert.ok(pickUpMarketOrderStock(farm,'pantry',token).ok)
  assert.deepEqual([farm.day,farm.coins,farm.eggs,farm.produce.wheat,farm.orders.pantry.completed],[196,before.coins,1,2,0])
  const afterPickup=structuredClone(farm)
  assert.equal(pickUpMarketOrderStock(farm,'pantry',token).ok,false);assert.deepEqual(farm,afterPickup)
  const now=mount(farm,'pantry');now.layout(true)
  assert.deepEqual(names(now.workspace),['detail','picker'])
  assert.deepEqual(names(now.order),['order heading','deliver','requirements'])
  assert.equal(now.doc.activeElement,now.close)
  assert.ok(F.deliverMarketOrder(farm,'pantry').ok);assert.equal(farm.coins-before.coins,21)
})

test('existing keyboard focus, same order and desktop placement survive resizing without selecting or activating',()=>{
  const farm=cold(),before=structuredClone(farm),scene=mount(farm)
  const initial=names(scene.order);scene.picker.scrollTop=97
  scene.layout(false);assert.deepEqual(names(scene.workspace),['picker','detail'])
  scene.control.focus({preventScroll:true})
  scene.layout(true);assert.equal(scene.doc.activeElement,scene.control);assert.equal(scene.control.focused,2)
  scene.layout(false);assert.equal(scene.doc.activeElement,scene.control);assert.equal(scene.control.focused,3)
  scene.layout(false);assert.equal(scene.control.focused,3,'same width does not move or refocus')
  assert.equal(scene.picker.scrollTop,97)
  assert.deepEqual(names(scene.workspace),['picker','detail'])
  assert.deepEqual(names(scene.order),initial)
  assert.deepEqual(farm,before)
})

test('only a fully actionable single-source pickup is promoted beside ordinary waiting and delivered controls',()=>{
  const noStock=cold()
  assert.ok(transferBayGoods(noStock,'withdraw','home','wheat',1).ok)
  assert.ok(F.sellMarketItem(noStock,'produce:wheat',1).ok)
  const missing=mount(noStock,'pantry')
  assert.match(missing.html,/data-action="deliver-order"[^>]*disabled/)
  missing.layout(true);assert.deepEqual(names(missing.workspace),['picker','detail'])
  const one=cold();assert.ok(transferBayGoods(one,'withdraw','home','eggs',1).ok)
  const single=mount(one,'pantry')
  assert.match(single.html,/data-action="market-order-pickup"/)
  assert.match(single.html,/>В запасе: 0 · со склада \+2</)
  assert.doesNotMatch(single.html,/data-action="warehouse-supply"|data-action="deliver-order"/)
  single.layout(true);assert.deepEqual(names(single.workspace),['detail','picker'])
  assert.deepEqual(names(single.order),['order heading','requirements','pickup'])
  assert.equal(single.doc.activeElement,single.close);assert.equal(single.control.focused,0)
  const delivered=mount(cold(),'garden')
  assert.match(delivered.html,/Сегодня доставлено/)
  delivered.layout(true);assert.deepEqual(names(delivered.workspace),['picker','detail'])
})
