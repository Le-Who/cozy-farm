import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import test from 'node:test'
import {runInNewContext} from 'node:vm'
import * as F from '../src/farm.ts'
import * as H from '../src/harbor-return.ts'
import * as W from '../src/warehouse-guidance.ts'
import {getMarketOrderBoard} from '../src/market-orders-view.ts'
import {getRequirementHint, type Requirement} from '../src/requirement-guidance.ts'
import {inviteNeighborVisit} from '../src/neighbor-visits.ts'
import {commissionPlayer} from './fixtures/commission-player.ts'
import {earnedMarketOrderChoice} from './fixtures/earned-market-order-choice.ts'
import {earned416Mixed} from './fixtures/earned-416-market-orders.ts'

const read = (path:string) => readFileSync(new URL(path,import.meta.url),'utf8')
const main = read('../src/main.ts')
function section(start:string,end:string) {
  const a=main.indexOf(start),b=main.indexOf(end,a+start.length)
  assert.ok(a>=0&&b>a,start);return main.slice(a,b)
}
const render=stripTypeScriptTypes(section('function button(label:','function quantity(')+
  section('function deliveryItems(', 'function groveDockActions()')+';harborCard')
const chooseRoute=stripTypeScriptTypes(section('async function visitPanelAt(', 'function openGuidedMarket(')+
  'async function choose(){switch(action){'+section("    case 'sail':","    case 'store-tree':")+
  section("    case 'harbor-order-route':","    case 'harbor-next-rest':")+'}};choose')

const dish={kind:'dishes',item:'orchardPreserves',quantity:1} as const
const id='dish:orchardPreserves'
function replay(guestReady=false) {
  const steps = guestReady ? JSON.parse(read('./fixtures/market-order-selection-commands.json')).slice(0,-1)
    : JSON.parse(read('./fixtures/home-progress-actions.json'))
  const p=commissionPlayer(steps)
  p.visit('home');p.act('specializeFarmhouse','preserves')
  p.fruit('apple',1);p.fruit('pear',1);p.visit('home');p.act('cookDish','orchardPreserves')
  p.visit('grove');p.act('catchFish',true);p.act('deliverHarborOrder')
  assert.deepEqual(p.state.orders.harbor,{completed:1,deliveredOn:guestReady?15:14})
  while(p.state.day<17)p.night()
  p.fruit('apple',1);p.fruit('pear',1);p.visit('grove');p.act('gatherSeaSalt')
  p.visit('home');p.act('cookDish','orchardPreserves')
  if(!guestReady)assert.deepEqual([p.actions,p.state.day,p.state.coins,p.state.dishes.orchardPreserves,p.state.seaSalt],[127,17,52,1,2])
  return p
}
function store(p:ReturnType<typeof replay>,port:'grove'|'village'='grove',product=id) {
  p.visit(port);p.act('transferBayGoods','deposit',port,product,1);p.visit('home')
  return p
}
function card(farm:F.FarmState,fromMarket=true) {
  const requirements:Requirement[]=[]
  const fn=runInNewContext(render,{...F,...H,farm,icon:()=>'',escapeHtml:String,numberFormat:new Intl.NumberFormat('ru'),ruPlural:()=>'',stockTile:()=>'',
    stockLabel:(item:F.StockItem)=>({name:item.kind==='dishes'?'Садовый конфитюр':'Морская соль',image:''}),
    requirementLink:(html:string,r:Requirement)=>{requirements.push(r);return html}})
  const html=fn(fromMarket) as string
  const action=/<button[^>]*data-action="([^"]+)"[^>]*data-value="([^"]+)"/.exec(html)
  return {html,requirements,action:action?.[1],value:action?.[2]}
}
function guide(farm:F.FarmState,value:string|undefined,options:{selected?:string;detached?:boolean;action?:string}={}) {
  const calls:string[]=[], writes:F.FarmState[]=[], control={}
  const c={...F,...H,farm,value,control,action:options.action??'harbor-order-route',panel:'market',marketTab:'orders',
    selectedMarketOrder:options.selected??'harbor',dialog:{open:true},
    dialogContent:{contains:(node:unknown)=>!options.detached&&node===control},panelHistory:[] as {panel:string}[],
    fieldViewButton:{getAttribute:()=> 'false'},fieldLayout:{matches:false},
    rememberPanel:()=>({panel:c.panel}),
    closeDialog(){calls.push('close');c.panel='';c.dialog.open=false;c.panelHistory.length=0},
    island:{isCrossing:()=>false,async crossIsland(commit:()=>boolean){calls.push('cross');assert.ok(commit())}},
    openPanel(t:string){calls.push('open:'+t);c.panel=t;c.dialog.open=true},canvas:{focus(){calls.push('world')}},
    perform(work:()=>F.ActionResult){const r=work();if(r.ok)writes.push(structuredClone(farm));return r.ok},
  }
  return {go:runInNewContext(chooseRoute,c) as()=>Promise<void>,calls,writes,c}
}
const clone=(f:F.FarmState)=>F.restoreCurrentFarm(JSON.parse(JSON.stringify(f)))!
const safe=(f:F.FarmState)=>[f.day,f.island,f.coins,f.seaSalt,f.dishes.orchardPreserves,f.freight.warehouses.grove[id]??0,f.orders.harbor.completed]

test('earned Day17 exact finished Grove parcel stock reaches the order, requiring separate pickup and delivery',async t=>{
  const carrying=replay(), kept=carrying.state, stored=store(replay()), farm=stored.state
  assert.equal(stored.actions,130);assert.deepEqual(safe(farm),[17,'home',52,2,0,1,1])
  assert.deepEqual(safe(kept),[17,'home',52,2,1,0,1])
  assert.equal(H.readyHarborOrderRoute(kept),'17:1:preserves')
  assert.equal(card(kept).action,'harbor-order-route')
  const physical=F.getHarborOrder(farm)!
  assert.deepEqual(physical.items.map(q=>[q.available,q.delivered]),[[0,0],[2,0]])
  const oldHint=getRequirementHint(farm,{kind:'stock',item:dish})
  assert.equal(oldHint.action.value,'farmhouse');assert.match(oldHint.notice??'',/До плодов: 1 ночь/)
  const before=clone(farm), cardView=card(farm), board=getMarketOrderBoard(farm)
  t.diagnostic(JSON.stringify({day:17,actions:stored.actions,carryAction:card(kept).action,
    storedCardAction:cardView.action,selected:board.selected,oldGenericHint:oldHint.notice,reward:physical.reward}))
  if(cardView.action==='sail'){
    const former=guide(clone(farm),cardView.value,{action:'sail'})
    await former.go()
    t.diagnostic(JSON.stringify({stockArrival:former.calls,stockWrites:former.writes.length}))
    assert.deepEqual(former.calls,['close','cross','world'])
  }
  assert.equal(cardView.action,'harbor-order-route','the finished jar in the destination warehouse should reach the existing order')
  assert.match(cardView.html,/Со склада \+1/)
  assert.equal(cardView.requirements.some(r=>r.kind==='stock'&&r.item.kind==='dishes'),false,'do not keep the misleading fruit search on the verified stored row')
  assert.equal(board.selected,'harbor')
  assert.equal(board.choices.find(c=>c.id==='harbor')?.group,'harbor')
  assert.deepEqual(farm,before)
  const ui=guide(farm,cardView.value);await ui.go()
  const landed=clone(before);assert.ok(F.sail(landed,'grove').ok)
  assert.deepEqual(ui.calls,['close','cross','open:harbor'])
  assert.deepEqual(ui.writes,[landed]);assert.deepEqual(farm,landed)
  assert.equal(farm.freight.warehouses.grove[id],1);assert.equal(farm.dishes.orchardPreserves,0)
  const landedCard=card(farm,false)
  assert.ok(landedCard.requirements.some(r=>r.kind==='stock'&&r.item.kind==='dishes'))
  assert.equal(getRequirementHint(farm,{kind:'stock',item:dish}).action.target,'warehouse-supply')
  const local=W.getLocalWarehouseSupply(farm,dish)!;assert.deepEqual([local.port,local.stored,local.quantity],['grove',1,1])
  const confirmed=W.warehouseConfirmation(W.warehouseConfirmationValue(local))
  assert.ok(W.withdrawWarehouseSupply(farm,dish,confirmed).ok)
  assert.deepEqual(safe(farm),[17,'grove',52,2,1,0,1]);assert.deepEqual(farm.harborSupplies,{})
  assert.equal(W.withdrawWarehouseSupply(farm,dish,confirmed).ok,false)
  assert.ok(F.deliverHarborOrder(farm).ok)
  assert.deepEqual(safe(farm),[17,'grove',92,0,0,0,2]);assert.equal(F.deliverHarborOrder(farm).ok,false)
  assert.deepEqual(farm,clone(farm))
})

test('wrong shore, wrong product, vanished parcel and a live unrelated request keep the Harbor option honest',async()=>{
  const eligible=store(replay()),f=eligible.state,token=card(f).value
  assert.equal(card(f).action,'harbor-order-route')
  for(const opts of [{selected:'pantry'},{detached:true}]){
    const before=clone(f), ui=guide(f,token,opts);await ui.go()
    assert.deepEqual(ui.calls,[]);assert.deepEqual(ui.writes,[]);assert.deepEqual(f,before)
  }
  assert.equal(getMarketOrderBoard(f,'pantry').selected,'pantry')

  const elsewhere=store(replay(),'village')
  store(elsewhere,'grove','dish:orchardTart')
  assert.equal(elsewhere.state.freight.warehouses.village[id],1)
  assert.equal(elsewhere.state.freight.warehouses.grove['dish:orchardTart'],1)
  assert.equal(H.readyHarborOrderRoute(elsewhere.state),undefined)
  assert.equal(card(elsewhere.state).action,'sail')
  assert.ok(card(elsewhere.state).requirements.some(r=>r.kind==='stock'&&r.item.kind==='dishes'))
  assert.equal(getRequirementHint(elsewhere.state,{kind:'stock',item:dish}).action.value,'farmhouse')

  eligible.visit('grove');eligible.act('catchFish',true);eligible.visit('home')
  const stocked=eligible.state, board=getMarketOrderBoard(stocked)
  assert.equal(board.selected,'grove','truly ready local Home order stays ahead')
  assert.equal(board.choices.find(c=>c.id==='grove')?.group,'ready')
  assert.equal(card(stocked).action,'harbor-order-route')
  eligible.act('transferBayGoods','deposit','home','seaBass',1)
  const pickupBoard=getMarketOrderBoard(eligible.state)
  assert.equal(pickupBoard.selected,'grove','a real exact Home depot pickup still comes before the pier')
  assert.equal(pickupBoard.choices.find(c=>c.id==='grove')?.group,'warehouse')
  assert.equal(card(eligible.state).action,'harbor-order-route')
  eligible.act('sellMarketItem','seaSalt',1)
  assert.equal(H.readyHarborOrderRoute(eligible.state),undefined,'two distinct needs remain a real partial choice')
  assert.equal(card(eligible.state).action,'sail')
  eligible.visit('grove');eligible.act('transferBayGoods','withdraw','grove',id,1);eligible.visit('home')
  eligible.act('sellMarketItem','dishes:orchardPreserves',1)
  const gone=eligible.state,goneBefore=clone(gone),old=guide(gone,token)
  await old.go();assert.deepEqual(old.calls,[]);assert.deepEqual(old.writes,[]);assert.deepEqual(gone,goneBefore)

  const guest=store(replay(true)),arrivedGuestToken=card(guest.state).value
  assert.equal(guest.actions,138)
  assert.equal(card(guest.state).action,'harbor-order-route')
  assert.ok(inviteNeighborVisit(guest.state,'beaFlock').ok);guest.reload()
  const occupied=guest.state,beforeGuest=clone(occupied),ui=guide(occupied,arrivedGuestToken)
  assert.equal(H.readyHarborOrderRoute(occupied),undefined)
  assert.equal(card(occupied).action,'sail','normal separate manual travel remains available')
  await ui.go();assert.deepEqual(ui.calls,[]);assert.deepEqual(ui.writes,[]);assert.deepEqual(occupied,beforeGuest)

  const early=getMarketOrderBoard(earnedMarketOrderChoice()),mature=getMarketOrderBoard(earned416Mixed(true).state)
  assert.ok(early.choices.some(c=>c.group==='ready'))
  assert.ok(mature.choices.some(c=>c.group==='warehouse'))
  assert.equal(early.choices.some(c=>c.id==='harbor'),false)
  assert.equal(mature.choices.some(c=>c.id==='harbor'),false)
})
