import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { runInNewContext } from 'node:vm'
import * as F from '../src/farm.ts'
import * as H from '../src/harbour-economy.ts'
import * as E from '../src/ferry-expeditions.ts'
import * as B from '../src/bay-freight-model.ts'
import * as W from '../src/warehouse-guidance.ts'
import { getFerryRestockPlan } from '../src/ferry-restock.ts'
import { nextFerryExploration } from '../src/ferry-discovery.ts'
import { smallerFerryCargo } from '../src/ferry-smaller-cargo.ts'
import { ferryProjectProgress } from '../src/ferry-project-progress.ts'
import { isGuardedAction } from '../src/action-click-guard.ts'
import { ruCount } from '../src/ru.ts'
import { delayedLastFerryReceiptFarm } from './fixtures/last-ferry-receipt.ts'

const read = (file:string) => readFileSync(new URL(file,import.meta.url),'utf8')
const main=read('../src/main.ts'), freight=read('../src/bay-freight-ui.ts')
const moduleUrl=new URL('../src/ferry-grove-bun-source.ts',import.meta.url)
// Stock runs the same test against its real markup, with no newly added module.
const groveSource:typeof import('../src/ferry-grove-bun-source.ts').getFerryGroveBunSource=
  existsSync(moduleUrl) ? (await import(moduleUrl.href)).getFerryGroveBunSource : ()=>undefined
const cut=(file:string,a:string,b:string)=>{
  const first=file.indexOf(a),end=file.indexOf(b,first+a.length)
  assert.ok(first>=0&&end>first,a)
  return file.slice(first,end)
}
const render:typeof import('../src/bay-freight-ui.ts').renderFreightPanel=runInNewContext(stripTypeScriptTypes(
  cut(freight,'export type FreightProduct','/** DOM entry used').replaceAll('export function ','function ').replaceAll('import.meta.env.BASE_URL','"/"')+';renderFreightPanel'),
  {...E,...B,getFerryRestockPlan,nextFerryExploration,smallerFerryCargo,ferryProjectProgress,ruCount})
const sourceCode=main.includes("case 'expedition-bun-warehouse':") ? cut(main,"    case 'expedition-bun-warehouse':","    case 'expedition-port':") : ''
const voyage='orchard-buns',bun='handmade:round'
const buy='orchard-peaches'
const next=(f:F.FarmState, id:string)=>E.quoteExpedition(f.freight.expeditions,id,H.expeditionWallet(f))
const ok=(r:F.ActionResult)=>assert.ok(r.ok,r.message)
const refresh=(f:F.FarmState)=>F.restoreCurrentFarm(JSON.parse(JSON.stringify(f)))!
const outline=(f:F.FarmState)=>[f.island,f.day,f.coins,f.handmade.round,f.fruit.peach,f.freight.warehouses.grove[bun]??0,f.freight.expeditions.active?.id??null]
const step=(f:F.FarmState,id:string)=>{
  ok(H.sendFerryExpedition(f,id))
  if(f.island!=='home')ok(F.sail(f,'home'))
  ok(F.endDay(f));ok(H.receiveFerryExpedition(f))
  return refresh(f)
}
function earned() {
  const f=delayedLastFerryReceiptFarm()
  ok(H.receiveFerryExpedition(f));ok(F.sail(f,'grove'));ok(H.transferBayGoods(f,'deposit','grove',bun,1));ok(F.sail(f,'home'))
  assert.deepEqual(outline(f),['home',10,89,0,0,1,null])
  assert.equal(F.getWorkshopAction(f).available,false)
  return refresh(f)
}
function view(f:F.FarmState,id=voyage){
 const before=structuredClone(f)
 const html=render(f.freight,{day:f.day,coins:f.coins,boatOwned:f.boatOwned,expeditionPort:'orchard',expeditionOffer:id,
   playerPort:f.island,openedPorts:H.openedFreightPorts(f),products:[],carried:H.expeditionWallet(f).bag,groveBun:offer=>groveSource(f,offer),icon:()=>''})
 assert.deepEqual(f,before)
 return html
}
const remoteControl=/data-action="expedition-bun-warehouse" data-value="([^"]+)"[^>]*>К складу: Солёная роща/
function mount(f:F.FarmState) {
 const history:{panel:string;expeditionPort:string;expeditionOffer:string}[]=[],visited:string[]=[],stage:string[]=[]
 const control={}, no=()=>{}
 const ctx={
  ...F,...H, farm:f, panel:'bay-freight',dialog:{open:true},dialogContent:{contains:(a:object)=>a===control},control,
  selectedExpeditionPort:'orchard',selectedExpeditionOffer:voyage,selectedWarehouseRequest:undefined as F.StockItem|undefined,
  panelHistory:history, island:{isCrossing:()=>false,async crossIsland(move:()=>boolean){assert.ok(move());visited.push(f.island)}}, getFerryGroveBunSource:groveSource,
  fieldViewButton:{getAttribute:()=> 'false'}, toggleFieldView:no, nextShopMarketVisit:undefined, marketTab:'orders',
  perform(task:()=>F.ActionResult){return task().ok}, closeDialog(){ctx.dialog.open=false;ctx.panel='';history.length=0},
  rememberPanel(){return {panel:ctx.panel,expeditionPort:ctx.selectedExpeditionPort,expeditionOffer:ctx.selectedExpeditionOffer}},
  openPanel(panel:string,remember:boolean){assert.equal(remember,false);ctx.panel=panel;ctx.dialog.open=true;stage.push(panel)},
 }
 const mounted=runInNewContext(stripTypeScriptTypes([
  cut(main,'async function visitPanelAt(', 'function openGuidedMarket('),
  "function backToOrigin(previous){"+cut(main,'  selectedExpeditionPort=previous.expeditionPort; selectedExpeditionOffer=previous.expeditionOffer','  selectedWarehouseRequest=previous.warehouseRequest')+";openPanel(previous.panel,false)}",
  "async function pick(value) {switch('expedition-bun-warehouse'){"+sourceCode+"}}",
  '({pick,backToOrigin})'
 ].join('\n')),ctx) as {pick(value:string):Promise<void>; backToOrigin(previous:{panel:string;expeditionPort:string;expeditionOffer:string}):void}
 return { ...mounted, ctx, history, visited, stage, control }
}

test('actual selected orchard barter opens only a valid Grove visit, then Back restores original trade after separate withdrawal',async()=>{
 let f=earned(),html=view(f),match=html.match(remoteControl)
 assert.ok(match,'owned remote stock is an explicit alternative to paying the mill')
 assert.equal((html.match(/data-action="expedition-bun-warehouse"/g)??[]).length,1)
 assert.match(html,/data-value="mill" class="expedition-source">К пекарю в посад/)
 assert.match(html,/data-action="expedition-offer" data-value="orchard-peaches"/)
 assert.match(html,/data-action="expedition-send" data-value="orchard-buns"[^>]* disabled/)
 assert.equal(isGuardedAction('expedition-bun-warehouse'),true)
 const before=structuredClone(f), flow=mount(f)
 await flow.pick('stale');assert.deepEqual(flow.visited,[]);assert.deepEqual(f,before)
 await flow.pick(match[1])
 assert.deepEqual(flow.visited,['grove']);assert.deepEqual(flow.stage,['warehouse-supply'])
 assert.deepEqual(outline(f),['grove',10,89,0,0,1,null])
 assert.deepEqual(flow.history,[{panel:'bay-freight',expeditionPort:'orchard',expeditionOffer:voyage}])
 const req=flow.ctx.selectedWarehouseRequest!
 const expected=W.getLocalWarehouseSupply(f,req)!
 assert.equal(expected.port,'grove');assert.equal(expected.quantity,1)
 assert.equal(W.withdrawWarehouseSupply(f,req,{...expected,port:'home'}).ok,false)
 ok(W.withdrawWarehouseSupply(f,req,expected))
 assert.equal(W.withdrawWarehouseSupply(f,req,expected).ok,false)
 flow.backToOrigin(flow.history.pop()!)
 assert.deepEqual([flow.ctx.panel,flow.ctx.selectedExpeditionPort,flow.ctx.selectedExpeditionOffer],['bay-freight','orchard',voyage])
 assert.deepEqual(outline(f),['grove',10,89,1,0,0,null])
 assert.equal(next(f,voyage)?.available,true)
 assert.doesNotMatch(view(f),remoteControl)
 f=step(f,voyage)
 assert.deepEqual(outline(f),['home',11,97,0,2,0,null])
 assert.equal(H.receiveFerryExpedition(f).ok,false)
})

test('all cash and rest choices remain actual, while local, absent, stale or different cargo offers cannot take the trip',async()=>{
 const home=earned(), before=structuredClone(home), source=groveSource(home,voyage)
 assert.ok(source)
 const newBun=step(earned(),'mill-buy')
 ok(H.transferBayGoods(newBun,'deposit','home',bun,1))
 assert.equal(newBun.freight.warehouses.grove[bun],1)
 assert.doesNotMatch(view(newBun),remoteControl)
 assert.match(view(newBun),/data-value="orchard-buns\|handmade:round"[^>]*>Посмотреть запас/)
 const payDirect=step(earned(),buy), bakeFirst=step(step(earned(),'mill-buy'),voyage)
 assert.deepEqual(outline(payDirect),['home',11,73,0,2,1,null])
 assert.deepEqual(outline(bakeFirst),['home',12,82,0,2,1,null])
 assert.deepEqual(home,before)
 assert.doesNotMatch(view(home,'orchard-pears'),remoteControl)
 assert.doesNotMatch(view(home,E.combinedExpeditionId(voyage,'orchard-pears')!),remoteControl)
 for(const skip of [
   (f:F.FarmState)=>{ok(F.sail(f,'grove'));ok(H.transferBayGoods(f,'withdraw','grove',bun,1));ok(F.sail(f,'home'));ok(H.transferBayGoods(f,'deposit','home',bun,1))},
   (f:F.FarmState)=>{ok(F.sail(f,'grove'));ok(H.transferBayGoods(f,'withdraw','grove',bun,1));ok(F.sail(f,'home'))},
   (f:F.FarmState)=>{delete f.freight.warehouses.grove[bun]},
   (f:F.FarmState)=>{f.boatOwned=false},
   (f:F.FarmState)=>{f.freight.expeditions.markets.orchard.stock.peach=1},
   (f:F.FarmState)=>{ok(H.sendFerryExpedition(f,'mill-buy'))},
 ]) {
  const changed=earned();skip(changed)
  const trip=mount(changed), frozen=structuredClone(changed)
  assert.equal(groveSource(changed,voyage),undefined)
  assert.doesNotMatch(view(changed),remoteControl)
  await trip.pick(source.key);assert.deepEqual(trip.visited,[])
  assert.deepEqual(changed,frozen)
 }
 const stale=earned(), flow=mount(stale)
 await flow.pick(source.key.replace(':10:',':9:'));assert.deepEqual(flow.visited,[])
 flow.ctx.selectedExpeditionOffer='orchard-pears'
 await flow.pick(source.key);assert.deepEqual(flow.visited,[])
 flow.ctx.selectedExpeditionOffer=voyage
 flow.ctx.dialogContent.contains=()=>false
 await flow.pick(source.key);assert.deepEqual(flow.visited,[])
 assert.deepEqual(earned(),home)
})
