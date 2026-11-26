import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import * as F from '../src/farm.ts'
import { getMarketOrderBoard, renderMarketOrderPicker } from '../src/market-orders-view.ts'
import { getNextMarketOrders } from '../src/market-return.ts'
import { commissionPlayer } from './fixtures/commission-player.ts'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')
const opening = JSON.parse(read('./fixtures/home-progress-actions.json'))
const main = read('../src/main.ts')
function exact(from: string, to: string) {
  const first = main.indexOf(from), last = main.indexOf(to, first + from.length)
  assert.ok(first >= 0 && last > first, from)
  return main.slice(first, last)
}
const reviewCase = main.includes("case 'first-grove-catch-review':")
  ? exact("    case 'first-grove-catch-review':", "    case 'cove-shells':") : ''
const run = stripTypeScriptTypes(exact('function button(', 'function quantity(')
  + exact('function row(', 'function nav(')
  + exact('function panelTabs(', 'function goods(')
  + exact('function fishImage(', 'function specializationCards(')
  + exact('function marketOrders()', 'function deliveryItems(')
  + `async function act(action: string, value?: string, control = live){switch(action){${reviewCase}
     ${exact("    case 'deliver-order':", "    case 'project-boat':")}}}`)

function earn() {
  const p = commissionPlayer(opening.slice(0, 15))
  p.act('pickFruit', 0)
  p.act('deliverProject', 'dock')
  assert.deepEqual([p.state.day, p.state.island, p.state.coins, p.state.fruit.pear], [2, 'grove', 22, 0])
  p.act('catchFish', true)
  return p
}

function screen(farm: F.FarmState) {
  const live = {}, saved: F.FarmState[] = [], crossings: F.IslandId[] = [], focus: string[] = []
  const history: { panel: string; marketTab: string; inventoryGroup: string; scroll: number }[] = []
  const state: any = { ...F, getMarketOrderBoard, renderMarketOrderPicker, getNextMarketOrders, farm, live,
    icon:()=>'', itemIcon:()=>'', ruPlural:()=>'', escapeHtml:String, numberFormat:new Intl.NumberFormat('ru'),
    marketOrderStockTile:()=>'',
    goods:()=>F.getMarketStock(farm).map(x=>({...x,image:'shore',name:x.key,group:'shore'})),
    panel:'inventory', bagTab:'harvest', inventoryGroup:'shore', marketTab:'buy',
    selectedMarketOrder:'pantry', pickedMarketOrder:'pantry', panelHistory:history, dialog:{ open:true },
    dialogContent:{
      scrollTop:51, contains:(control:unknown)=>control===live,
      querySelector:(selector:string)=>{ assert.equal(selector,'.market-order-detail')
        return {focus:()=>focus.push('detail'),querySelector:()=>null} },
    },
    island:{isCrossing:()=>false,crossIsland:async(fn:()=>boolean)=>{crossings.push(farm.island);return fn()}},
    rememberPanel:()=>({panel:state.panel,marketTab:state.marketTab,inventoryGroup:state.inventoryGroup,scroll:state.dialogContent.scrollTop}),
    closeDialog:()=>{state.dialog.open=false;state.panel=undefined;history.length=0},
    openPanel:(next:string,remember:boolean)=>{assert.equal(remember,false);state.panel=next;state.dialog.open=true},
    goBack:()=>{const visit=history.pop();assert.ok(visit);state.openPanel(visit.panel,false)
      state.marketTab=visit.marketTab;state.inventoryGroup=visit.inventoryGroup;state.dialogContent.scrollTop=visit.scroll},
    perform:(action:()=>F.ActionResult)=>{const result=action();if(result.ok)saved.push(structuredClone(farm));return result.ok},
  }
  runInNewContext(run,state)
  const pantry = () => state.inventorySupplies() as string
  const token = () => pantry().match(/data-action="first-grove-catch-review"[^>]*?data-value="([^"]+)"/)?.[1]
  return { state, live, history, saved, crossings, focus, pantry, token }
}

test('the earned first Grove bass shows one exact 24-coin Home order beside grill and ordinary 10-coin sale',()=>{
  const p=earn(), before=screen(p.state)
  assert.doesNotMatch(before.pantry(),/first-grove-catch-review/, 'a fish alone is not a ready order')
  p.act('gatherSeaSalt')
  const h=screen(p.state), html=h.pantry()
  assert.match(html,/data-action="fish-kitchen"[^>]*>На гриль/)
  assert.match(html,/data-action="fish-market"[^>]*>Продать 1 дома · 10/)
  assert.equal((html.match(/data-action="first-grove-catch-review"/g)??[]).length,1)
  assert.match(html,/На рынок домой · 24/)
  assert.ok(h.token())
  assert.equal(F.getMarketOrders(p.state).find(o=>o.lane==='grove')?.reward,24)
  const home=structuredClone(p.state);assert.ok(F.sail(home,'home').ok)
  assert.equal(getMarketOrderBoard(home).selected,'garden','ordinary Market still has its own choices')
  assert.equal(getMarketOrderBoard(home,'grove').order?.reward,24)
})

test('only the explicit named Grove travel crosses and saves once; exact draft leaves stock alone and Back stays Home',async()=>{
  const p=earn();p.act('gatherSeaSalt')
  const h=screen(p.state), expected=structuredClone(p.state), token=h.token()
  assert.ok(token)
  assert.equal(F.deliverMarketOrder(structuredClone(p.state),'grove').ok,false)
  await h.state.act('first-grove-catch-review',token)
  assert.ok(F.sail(expected,'home').ok)
  assert.deepEqual(p.state,expected)
  assert.deepEqual(h.saved,[expected]);assert.deepEqual(h.crossings,['grove'])
  assert.deepEqual(h.focus,['detail'])
  assert.equal(h.state.selectedMarketOrder,'grove')
  assert.equal(h.state.pickedMarketOrder,'pantry')
  assert.equal(h.state.marketTab,'orders')
  const detail=h.state.marketOrders() as string
  assert.match(detail,/id="order-grove"/)
  assert.match(detail,/data-action="deliver-order"[^>]*data-value="grove"/)
  assert.match(detail,/data-action="market-order-select"[^>]*data-value="garden"/)
  h.state.goBack()
  assert.deepEqual([h.state.panel,h.state.inventoryGroup,h.state.marketTab,h.state.dialogContent.scrollTop],['inventory','shore','buy',51])
  assert.match(h.pantry(),/К заказу · 24/)
  assert.equal(h.token(),token,'same source control identity can recover Back focus after travel')
  assert.deepEqual(p.state,expected);assert.equal(h.saved.length,1);assert.equal(h.crossings.length,1)
  await h.state.act('first-grove-catch-review',token)
  assert.equal(h.crossings.length,1);assert.equal(h.saved.length,1,'opening the exact order locally does not save')
  await h.state.act('deliver-order','grove')
  assert.deepEqual([p.state.coins,p.state.fish.seaBass,p.state.seaSalt,p.state.orders.grove.completed],[46,0,1,1])
  assert.equal(h.saved.length,2)
  h.state.goBack()
  assert.equal(h.token(),undefined,'completed first order has no retained pantry offer')
})

test('detached, stale and unsupplied requests do not select, withdraw, sail or spend',async()=>{
  const p=earn();p.act('gatherSeaSalt')
  const h=screen(p.state), token=h.token()
  assert.ok(token)
  await h.state.act('first-grove-catch-review',token,{})
  assert.equal(h.state.panel,'inventory')
  await h.state.act('first-grove-catch-review','wrong')
  assert.equal(h.state.panel,'inventory');assert.equal(h.saved.length,0)
  p.act('sail','home');p.act('endDay')
  const later=screen(p.state), before=structuredClone(p.state)
  assert.ok(later.token());assert.notEqual(later.token(),token)
  await later.state.act('first-grove-catch-review',token)
  assert.deepEqual(p.state,before);assert.equal(later.saved.length,0)
  p.act('sellMarketItem','fish:seaBass',1)
  const without=screen(p.state);assert.equal(without.token(),undefined)
  await without.state.act('first-grove-catch-review',later.token())
  assert.equal(without.state.panel,'inventory');assert.equal(without.saved.length,0)
})
