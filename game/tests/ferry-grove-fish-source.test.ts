import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import * as F from '../src/farm.ts'
import * as H from '../src/harbour-economy.ts'
import * as E from '../src/ferry-expeditions.ts'
import * as B from '../src/bay-freight-model.ts'
import * as W from '../src/warehouse-guidance.ts'
import { getRequirementHint } from '../src/requirement-guidance.ts'
import { getFerryRestockPlan } from '../src/ferry-restock.ts'
import { nextFerryExploration } from '../src/ferry-discovery.ts'
import { smallerFerryCargo } from '../src/ferry-smaller-cargo.ts'
import { ferryProjectProgress } from '../src/ferry-project-progress.ts'
import { isGuardedAction } from '../src/action-click-guard.ts'
import { ruCount } from '../src/ru.ts'
import { delayedLastFerryReceiptFarm } from './fixtures/last-ferry-receipt.ts'
import { commissionPlayer } from './fixtures/commission-player.ts'
import { inviteNeighborVisit } from '../src/neighbor-visits.ts'

const leaf = new URL('../src/ferry-grove-fish-source.ts', import.meta.url)
const getFerryGroveFishSource = existsSync(leaf) ? (await import(leaf.href)).getFerryGroveFishSource : () => undefined
const read = (file: string) => readFileSync(new URL(file, import.meta.url), 'utf8')
const main = read('../src/main.ts'), freight = read('../src/bay-freight-ui.ts')
const cut = (file: string, a: string, b: string) => {
  const i = file.indexOf(a), j = file.indexOf(b, i + a.length)
  assert.ok(i >= 0 && j > i, a)
  return file.slice(i,j)
}
const render: typeof import('../src/bay-freight-ui.ts').renderFreightPanel = runInNewContext(stripTypeScriptTypes(
  cut(freight, 'export type FreightProduct', '/** DOM entry used').replaceAll('export function ', 'function ')
    .replaceAll('import.meta.env.BASE_URL', '"/"') + ';renderFreightPanel'),
  { ...E, ...B, getFerryRestockPlan, nextFerryExploration, smallerFerryCargo, ferryProjectProgress, ruCount })
const dispatcher = stripTypeScriptTypes([
  cut(main, 'async function visitPanelAt(', 'function openGuidedMarket('),
  `async function follow(value){switch('expedition-source'){${cut(main, "    case 'expedition-source':", "    case 'expedition-bun-warehouse':")}}}`,
  `function back(){const previous=panelHistory.pop();if(!previous)return;${cut(main,'  selectedExpeditionPort=previous.expeditionPort; selectedExpeditionOffer=previous.expeditionOffer','  selectedWarehouse=previous.warehouse;')}
    openPanel(previous.panel,false);}`,
  '({follow,back})',
].join('\n'))
const trade = 'salt-catch', paid = 'salt-buy', bass = 'seaBass'
const ok = (r: F.ActionResult) => assert.ok(r.ok,r.message)
const quote = (f: F.FarmState, id = trade) => E.quoteExpedition(f.freight.expeditions,id,H.expeditionWallet(f))!
const state = (f: F.FarmState) => [f.day,f.island,f.coins,f.fish.seaBass,f.freight.warehouses.grove[bass] ?? 0,f.seaSalt,f.freight.expeditions.markets.salt.supplied[bass] ?? 0]
function earned() {
  const f = delayedLastFerryReceiptFarm()
  ok(H.receiveFerryExpedition(f)); ok(F.sail(f,'grove'))
  for (let i=0; F.getFishAction(f).available; i++) {
    assert.ok(i < 5)
    const cast = F.beginFishingTrip(f)
    ok(cast); ok(F.finishFishingTrip(f,cast.token!,1))
  }
  ok(H.transferBayGoods(f,'deposit','grove',bass,2)); ok(F.sail(f,'home'))
  ok(F.sellMarketItem(f,'fish:seaBass',1))
  assert.deepEqual(state(f),[10,'home',99,0,2,2,0])
  assert.equal(f.fishCaughtToday.grove,3)
  const restored = F.restoreCurrentFarm(JSON.parse(JSON.stringify(f)))
  assert.deepEqual(restored,f)
  return restored!
}
function view(f: F.FarmState, id = trade, port: E.ExpeditionPort = 'salt') {
  const before = structuredClone(f)
  const html = render(f.freight,{ day:f.day, coins:f.coins,boatOwned:f.boatOwned,
    expeditionPort:port,expeditionOffer:id,playerPort:f.island,openedPorts:H.openedFreightPorts(f),
    products:[],carried:H.expeditionWallet(f).bag,icon:()=>'',groveFish: offer=>getFerryGroveFishSource(f,offer) })
  assert.deepEqual(f,before)
  return html
}
const readySource = /data-action="expedition-source" data-value="(salt-catch\|seaBass\|grove-fish:[^"]+)"[^>]*>К складу: Солёная роща/
const ordinarySource = /data-action="expedition-source" data-value="salt-catch\|seaBass"[^>]*>Где взять улов/
function driver(f: F.FarmState) {
  const history:{panel:string;expeditionPort:string;expeditionOffer:string;warehouseRequest:undefined}[] = []
  const calls:string[]=[], writes:F.FarmState[]=[]
  const control={}
  const c = { ...F,...H, farm:f, control, panel:'bay-freight', dialog:{open:true},
    dialogContent:{contains:(node:unknown)=>node===control}, selectedExpeditionPort:'salt', selectedExpeditionOffer:trade,
    selectedWarehouseRequest:undefined as F.StockItem|undefined, panelHistory:history, getFerryGroveFishSource,
    fieldViewButton:{getAttribute:()=> 'false'}, island:{isCrossing:()=>false,async crossIsland(move:()=>boolean){calls.push('cross');assert.ok(move())}},
    rememberPanel:()=>({panel:c.panel,expeditionPort:c.selectedExpeditionPort,expeditionOffer:c.selectedExpeditionOffer,warehouseRequest:undefined}),
    perform(task:()=>F.ActionResult){const r=task();if(r.ok)writes.push(structuredClone(f));return r.ok},
    closeDialog(){c.dialog.open=false;c.panel='';history.length=0},
    openPanel(panel:string,remember:boolean){assert.equal(remember,false);c.panel=panel;c.dialog.open=true;calls.push('open:'+panel)},
    showRequirement: (r:Parameters<typeof getRequirementHint>[1])=>calls.push(getRequirementHint(f,r).action.target),
  }
  return {...runInNewContext(dispatcher,c) as {follow(value:string):Promise<void>;back():void},c,calls,writes,history}
}
function getRequest(f: F.FarmState) {
  const r = H.getFerrySupplyRequirement(f,trade,bass)
  assert.ok(r)
  return r
}

test('earned exhausted D10 Salt Kitchen shipment offers its own exact dock, then Back and send are separate',async () => {
  const f=earned(),before=structuredClone(f),html=view(f)
  const match=html.match(readySource)
  assert.ok(match, 'the earned exact dock should replace the unhelpful tomorrow cue; stock renders the generic fish search')
  assert.doesNotMatch(html,ordinarySource)
  assert.match(html,/data-action="expedition-offer" data-value="salt-buy"/)
  assert.match(html,/data-action="expedition-send" data-value="salt-catch"[^>]* disabled/)
  assert.equal(isGuardedAction('expedition-source'),true)
  const ui=driver(f)
  await ui.follow(match[1].replace('grove-fish:10:','grove-fish:9:'))
  assert.deepEqual(ui.calls,[]);assert.deepEqual(f,before)
  await ui.follow(match[1])
  const crossed=structuredClone(before);ok(F.sail(crossed,'grove'))
  assert.deepEqual(ui.calls,['cross','open:warehouse-supply'])
  assert.deepEqual(ui.writes,[crossed]);assert.deepEqual(f,crossed)
  assert.deepEqual(ui.history,[{panel:'bay-freight',expeditionPort:'salt',expeditionOffer:trade,warehouseRequest:undefined}])
  const req=ui.c.selectedWarehouseRequest
  assert.deepEqual(req,{kind:'fish',item:'seaBass',quantity:2})
  const stock=W.getLocalWarehouseSupply(f,req!)!, token=W.warehouseConfirmation(W.warehouseConfirmationValue(stock))
  assert.equal(stock.quantity,2)
  assert.ok(!quote(f).available)
  ok(W.withdrawWarehouseSupply(f,req,token))
  assert.equal(W.withdrawWarehouseSupply(f,req,token).ok,false)
  assert.deepEqual(state(f),[10,'grove',99,2,0,2,0])
  assert.deepEqual(f.freight.expeditions,before.freight.expeditions)
  const picked=structuredClone(f)
  ui.back()
  assert.deepEqual([ui.c.panel,ui.c.selectedExpeditionPort,ui.c.selectedExpeditionOffer],['bay-freight','salt',trade])
  assert.deepEqual(f,picked); assert.deepEqual(ui.writes,[crossed]);assert.deepEqual(ui.history,[])
  assert.match(view(f),/data-action="expedition-send" data-value="salt-catch" class="bay-freight-primary"\s*>/)
  assert.deepEqual([quote(f).available,quote(f).payCoins,quote(f).earnCoins],[true,0,12])
  ok(H.sendFerryExpedition(f,trade));assert.deepEqual(state(f),[10,'grove',99,0,0,2,0])
  ok(F.sail(f,'home'));ok(F.endDay(f));assert.deepEqual(state(f),[11,'home',99,0,0,2,2])
  ok(H.receiveFerryExpedition(f));assert.deepEqual(state(f),[11,'home',111,0,0,4,2])
  assert.equal(H.receiveFerryExpedition(f).ok,false)
})

test('paid alternative and normal local/live/short routes retain their authored choices',() => {
  const f=earned()
  assert.deepEqual([quote(f,paid).available,quote(f,paid).payCoins],[true,10])
  assert.doesNotMatch(view(f,paid),readySource)
  ok(H.sendFerryExpedition(f,paid));ok(F.endDay(f));ok(H.receiveFerryExpedition(f))
  assert.deepEqual(state(f),[11,'home',89,0,2,4,0])
  assert.doesNotMatch(view(f),readySource)
  assert.match(view(f),ordinarySource)
  assert.equal(getRequirementHint(f,getRequest(f)).action.value,'grove')
  const local=earned();ok(F.sail(local,'grove'))
  assert.doesNotMatch(view(local),readySource);assert.match(view(local),ordinarySource)
  assert.equal(getRequirementHint(local,getRequest(local)).action.target,'warehouse-supply')
  ok(H.transferBayGoods(local,'withdraw','grove',bass,1));ok(F.sail(local,'home'))
  ok(F.sellMarketItem(local,'fish:seaBass',1))
  assert.doesNotMatch(view(local),readySource);assert.match(view(local),ordinarySource)
  assert.equal(getRequirementHint(local,getRequest(local)).action.value,'farmhouse')
})

test('a gone, replaced or in-flight quote cannot reuse the foreign-warehouse gesture',async () => {
  const f=earned(), match=view(f).match(readySource)
  assert.ok(match)
  const id=match[1]
  const ui=driver(f)
  ui.c.selectedExpeditionOffer=paid
  await ui.follow(id)
  assert.deepEqual(ui.calls,[])
  ui.c.selectedExpeditionOffer=trade
  ui.c.dialogContent.contains=()=>false
  await ui.follow(id)
  assert.deepEqual(ui.writes,[])
  ui.c.dialogContent.contains=()=>true
  ui.c.dialog.open=false
  await ui.follow(id)
  assert.deepEqual(ui.calls,[])
  ui.c.dialog.open=true
  ok(H.sendFerryExpedition(f,paid))
  assert.doesNotMatch(view(f),readySource)
  await ui.follow(id)
  assert.deepEqual(ui.calls,[])

  const oneEach=earned()
  ok(F.sail(oneEach,'grove'));ok(H.transferBayGoods(oneEach,'withdraw','grove',bass,1));ok(F.sail(oneEach,'home'))
  assert.deepEqual(state(oneEach),[10,'home',99,1,1,2,0])
  const changed=driver(oneEach), replacement=view(oneEach).match(readySource)
  assert.ok(replacement);assert.match(replacement[1],/:1:1$/)
  await changed.follow(id)
  assert.deepEqual(changed.calls,[],'the old two-fish token may not select a changed one-fish quote')
  await changed.follow(replacement[1])
  assert.deepEqual(changed.calls,['cross','open:warehouse-supply'])
  assert.equal(W.getLocalWarehouseSupply(oneEach,changed.c.selectedWarehouseRequest!)?.quantity,1)
  assert.deepEqual(state(oneEach),[10,'grove',99,1,1,2,0])
})


test('an ordinary active Home guest hides only this shortcut and invalidates a stale warehouse gesture',async () => {
  const opening=JSON.parse(read('./fixtures/market-order-selection-commands.json')).slice(0,-1)
  const p=commissionPlayer(opening)
  assert.deepEqual([p.actions,p.state.day,p.state.coins,p.state.neighbors.bea.completed],[118,14,99,1])
  const water=()=>{if(F.getBedAction(p.state,0).kind==='water')p.act('workBed',0)}
  p.act('selectSeed','wheat');p.act('workBed',0);water()
  p.act('sendFerryExpedition','mill-buy');p.night();p.act('receiveFerryExpedition');water()
  p.night();p.act('workBed',0)
  p.act('sendFerryExpedition','explore-salt');p.night();p.act('receiveFerryExpedition')
  p.visit('grove')
  while(F.getFishAction(p.state).available){
    const cast=p.act('beginFishingTrip');p.act('finishFishingTrip',cast.token,1)
  }
  p.act('transferBayGoods','deposit','grove',bass,2);p.visit('home')
  p.act('sellMarketItem','fish:seaBass',p.state.fish.seaBass)
  assert.deepEqual([p.actions,...state(p.state).slice(0,5)],[141,17,'home',104,0,2])
  const source=view(p.state).match(readySource)
  assert.ok(source,'the same farm could otherwise visit its exact dock today')
  ok(inviteNeighborVisit(p.state,'beaFlock'));p.reload()
  const f=p.state, before=structuredClone(f), ui=driver(f)
  assert.deepEqual(f.neighborVisits.active,{serial:1,activity:'beaFlock',startedOn:17,observation:null})
  assert.doesNotMatch(view(f),readySource)
  assert.match(view(f),ordinarySource)
  assert.deepEqual([quote(f,paid).available,quote(f,paid).payCoins],[true,10])
  await ui.follow(source[1])
  assert.deepEqual(ui.calls,[]);assert.deepEqual(ui.writes,[]);assert.deepEqual(f,before)
  assert.equal(ui.c.panel,'bay-freight')
  const manual=structuredClone(f);ok(F.sail(manual,'grove'))
  assert.deepEqual([manual.island,manual.day,manual.coins,manual.neighborVisits.active],['grove',17,104,null])
  assert.deepEqual(f,before)
})
