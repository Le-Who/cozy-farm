import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import * as F from '../src/farm.ts'
import * as C from '../src/culinary.ts'
import { getMarketOrderBoard, renderMarketOrderPicker } from '../src/market-orders-view.ts'
import { signatureBookCapacity } from '../src/signature-book.ts'
import { ActivationKeyGuard, isGuardedAction } from '../src/action-click-guard.ts'
import { commissionPlayer } from './fixtures/commission-player.ts'

const read = (file: string) => readFileSync(new URL(file, import.meta.url), 'utf8')
const main = read('../src/main.ts'), scene = read('../src/cookery.ts')
const opening = JSON.parse(read('./fixtures/home-progress-actions.json'))
const range = (source: string, start: string, end: string) => {
  const a = source.indexOf(start), b = source.indexOf(end, a + start.length)
  assert.ok(a >= 0 && b > a); return source.slice(a, b)
}
const cookery = stripTypeScriptTypes(`switch ('cookery') {${range(main,"    case 'cookery': {", "    case 'village-project': dialogContent.innerHTML")}}`)
const orchard: C.CookeryResult = { family: 'preserves', processing: 'bright', fruitTraitsVersion: 1,
  fruit: [{ingredientId:'apple',x:.08,y:.12,angle:0}, {ingredientId:'pear',x:.2,y:.3,angle:0}],
  steps: ['add-fruit','stir-bright','fill-jar'], baking: {method:'stovetop',finish:'set',seconds:18} }

function firstKitchen(branch: F.SpecializationId = 'preserves') {
  const p = commissionPlayer(opening.slice(0, 29))
  p.act('pickFruit', 0); p.visit('home'); p.act('workBed', 11); p.night()
  p.act('pickFruit', 0); p.act('workBed', 11); p.night(); p.act('pickFruit', 0)
  assert.deepEqual([p.actions,p.state.day,p.state.coins,p.state.fruit.apple,p.state.fruit.pear,p.state.produce.wheat,p.state.eggs], [37,5,78,3,2,5,3])
  p.act('specializeFarmhouse', branch)
  assert.equal(p.state.coins, 20)
  return p
}
const currentOrder = (farm: F.FarmState) => F.getMarketOrders(farm).find(order => order.lane === 'specialty')
type Receipt = {name: string; open(): void}
function mount(farm: F.FarmState, origin = 'kitchen', dish: F.DishId = 'orchardPreserves') {
  let options: { onComplete(result: C.CookeryResult): boolean; onCancel(): void; returnLabel: string; readyOrder?: () => Receipt | undefined } | undefined
  let commits = 0
  const opened: string[] = [], focus: string[] = []
  const entry = {panel: origin}
  const dialogContent = {innerHTML:'',querySelector: (selector: string) => selector === '.market-order-detail'
    ? {focus:()=>focus.push('detail'),scrollIntoView:()=>focus.push('scroll')} : {} }
  const ctx = {...F,...C, farm, panel:'cookery', cookingDish:dish, cookingFish:'seaBass', cookingMode:'dish', signatureBase:'preserves',
    signatureRepeatId:undefined, signatureSlots:[], signatureBookCapacity, communityRequest:undefined, panelHistory:[entry],
    dialogTitle:{setAttribute(){}}, dialogContent, dialog:{open:true}, island:{isCrossing:()=>false},
    stockLabel:(item:F.StockItem)=>({name:F.marketKey(item),image:''}), iconUrl:()=>'', cookeryGame:undefined,
    pickedMarketOrder:'garden', selectedMarketOrder:'garden', marketTab:'orders',
    createCookery(_host:unknown, registered:NonNullable<typeof options>) { options = registered },
    openPanel(panel:string,remember:boolean) { opened.push(`${panel}:${remember}`);ctx.panel=panel },
    leaveScene() { opened.push(`back:${entry.panel}`) },
    perform(fn:()=>F.ActionResult) { const r=fn();if(r.ok) commits++;return r.ok },
  }
  runInNewContext(cookery,ctx)
  assert.ok(options)
  return { ctx, options: options as NonNullable<typeof options>, entry, opened, focus, commits:()=>commits }
}

test('first earned preserves batch reveals the exact existing ready order, separately from the one-time delivery', t => {
  const p=firstKitchen(), farm=p.state, before=structuredClone(farm), session=mount(farm)
  assert.equal(currentOrder(farm)?.status, 'waiting')
  assert.equal(session.options.readyOrder?.(), undefined)
  assert.ok(session.options.onComplete(orchard))
  assert.equal(farm.culinary.lastDishes.orchardPreserves?.family,'preserves')
  assert.deepEqual([farm.fruit.apple,farm.fruit.pear,farm.dishes.orchardPreserves,farm.coins], [2,1,1,20])
  assert.deepEqual(farm.orders, before.orders)
  const receipt=session.options.readyOrder?.()
  assert.equal(receipt?.name, 'Ящик садового конфитюра')
  const completed=structuredClone(farm)
  assert.ok(session.options.onComplete(orchard));assert.equal(session.commits(),1)
  assert.equal(getMarketOrderBoard(farm).selected,'pantry','generic market goes to the other ready task')
  assert.match(renderMarketOrderPicker(getMarketOrderBoard(farm,'garden'),()=>''),/data-value="specialty" aria-pressed="false"/)
  receipt!.open();receipt!.open()
  assert.deepEqual(session.opened,['market:false']);assert.deepEqual(session.focus,['detail','scroll'])
  assert.deepEqual(session.ctx.panelHistory,[session.entry]);assert.equal(session.ctx.marketTab,'orders')
  assert.equal(session.ctx.selectedMarketOrder,'specialty');assert.equal(session.ctx.pickedMarketOrder,'garden')
  assert.deepEqual(farm,completed)
  p.reload();p.act('deliverMarketOrder','specialty')
  assert.deepEqual([p.state.coins,p.state.orders.specialty.completed,p.state.dishes.orchardPreserves,p.state.fruit.apple],[60,1,0,0])
  assert.equal(F.deliverMarketOrder(p.state,'specialty').ok,false)
  t.diagnostic(JSON.stringify({day:p.state.day,openingActions:37,balanceBeforeDelivery:20,finalBalance:60,activated:session.opened}))
})

test('the ordinary kitchen exit and an explicit 22-coin jar sale remain available', () => {
  const p=firstKitchen(),session=mount(p.state)
  assert.ok(session.options.onComplete(orchard));assert.equal(session.options.returnLabel,'На кухню')
  const before=structuredClone(p.state);session.options.onCancel();assert.deepEqual(session.opened,['back:kitchen']);assert.deepEqual(p.state,before)
  p.reload();p.act('sellMarketItem','dishes:orchardPreserves',1)
  assert.deepEqual([p.state.coins,p.state.fruit.apple,p.state.fruit.pear],[42,2,1])
  assert.equal(currentOrder(p.state)?.status,'waiting')
})

test('insufficient remaining apples, an invalid settlement and the wrong origin never arm a shortcut', () => {
  const short=firstKitchen();short.act('sellMarketItem','fruit:apple',1)
  const a=mount(short.state);assert.ok(a.options.onComplete(orchard));assert.equal(a.options.readyOrder?.(),undefined)
  assert.equal(currentOrder(short.state)?.status,'waiting');assert.deepEqual(a.opened,[])
  const failed=firstKitchen(), b=mount(failed.state)
  assert.equal(b.options.onComplete({...orchard,family:'decorate'}),false);assert.equal(b.options.readyOrder?.(),undefined)
  const foreign=firstKitchen(), c=mount(foreign.state,'request-food')
  assert.ok(c.options.onComplete(orchard));assert.equal(currentOrder(foreign.state)?.status,'ready');assert.equal(c.options.readyOrder?.(),undefined)
  const generic=firstKitchen(), d=mount(generic.state,'kitchen','appleJam')
  assert.equal(d.options.readyOrder,undefined,'ordinary jam never mounts the extra action')
})

test('existing ready orders, later rotations, and a secondary preserves skill do not trigger this first-order action', () => {
  const first=firstKitchen();first.act('cookDish','orchardPreserves');assert.equal(currentOrder(first.state)?.status,'ready')
  const repeat=mount(first.state);assert.ok(repeat.options.onComplete(orchard));assert.equal(repeat.options.readyOrder?.(),undefined)
  const finished=firstKitchen();finished.act('cookDish','orchardPreserves');finished.act('deliverMarketOrder','specialty')
  finished.night();finished.act('pickFruit',0);finished.night();finished.act('pickFruit',0)
  const later=mount(finished.state);assert.ok(later.options.onComplete(orchard));assert.equal(later.options.readyOrder?.(),undefined)
  const second=firstKitchen('bakery')
  while (second.state.coins < 58) {if(F.getTreeAction(second.state,0).kind !== 'pick')second.night();second.act('pickFruit',0);if(second.state.fruit.apple>2)second.act('sellMarketItem','fruit:apple',second.state.fruit.apple-2)}
  second.act('specializeFarmhouse','preserves');assert.equal(currentOrder(second.state)?.name,'Хлебная корзина')
  const actual=mount(second.state);assert.ok(actual.options.onComplete(orchard));assert.equal(actual.options.readyOrder?.(),undefined)
})

test('a rendered receipt rechecks stock, session, island, day, and dialog before opening', () => {
  for (const invalidate of ['sale','day','other-island','other-panel','same-looking-origin','closed','crossing'] as const) {
    const p=firstKitchen(),session=mount(p.state);assert.ok(session.options.onComplete(orchard))
    const rendered=session.options.readyOrder?.();assert.ok(rendered)
    if(invalidate==='sale')assert.ok(F.sellMarketItem(p.state,'dishes:orchardPreserves',1).ok)
    if(invalidate==='day')assert.ok(F.endDay(p.state).ok)
    if(invalidate==='other-island')assert.ok(F.sail(p.state,'grove').ok)
    if(invalidate==='other-panel')session.ctx.panel='kitchen'
    if(invalidate==='same-looking-origin')session.ctx.panelHistory[0]={panel:'kitchen'}
    if(invalidate==='closed')session.ctx.dialog.open=false
    if(invalidate==='crossing')session.ctx.island.isCrossing=()=>true
    const next=structuredClone(p.state);rendered.open();assert.deepEqual(session.opened,[],invalidate)
    assert.deepEqual(p.state,next,invalidate)
  }
})

test('the real scene keeps the order button hidden before finish and does not give it focus or spend via held keys', () => {
  assert.match(scene,/options\.readyOrder \? '<button type="button" class="cookery-order" data-action="cookery-order-review" hidden>К заказу<\/button>'/)
  const sync = range(scene, '    if (options.readyOrder && orderButton) {', '    sourceCue.hidden')
  const click = range(scene, "  orderButton?.addEventListener('click'", "  processingControls.addEventListener('click'")
  const handled = new Map<string, ()=>void>()
  const eventLog: string[] = []
  let quote: Receipt | undefined = {name:'Ящик садового конфитюра',open:()=>eventLog.push('open')}
  const button = {hidden:true,setAttribute:(key:string,v:string)=>eventLog.push(`${key}:${v}`),addEventListener:(n:string,fn:()=>void)=>handled.set(n,fn)}
  const ctx={orderButton:button,model:{stage:'ready'},loaded:true,contextLost:false,destroyed:false,signal:undefined,
    options:{readyOrder:()=>quote},finish:{focus:()=>eventLog.push('focus:kitchen-exit')}}
  runInNewContext(click,ctx);const handler=handled.get('click')!
  runInNewContext(sync,ctx);handler();assert.equal(button.hidden,true);assert.deepEqual(eventLog,[])
  ctx.model.stage='finished';runInNewContext(sync,ctx);assert.equal(button.hidden,false)
  assert.deepEqual(eventLog,['aria-label:К заказу «Ящик садового конфитюра»']);handler();assert.equal(eventLog.at(-1),'open')
  quote=undefined;handler();assert.equal(button.hidden,true);assert.equal(eventLog.at(-1),'focus:kitchen-exit')
  quote={name:'Order',open:()=>eventLog.push('do not open')};ctx.contextLost=true;runInNewContext(sync,ctx);handler()
  assert.equal(button.hidden,true);assert.doesNotMatch(eventLog.join(':'),/do not open/)
  for(const key of ['Enter',' ']){const guard=new ActivationKeyGuard();assert.ok(isGuardedAction('cookery-order-review'));assert.equal(guard.blocks({key,repeat:true},true),true)}
  const css=read('../src/cookery.css');assert.match(css,/\.cookery-order\{[^}]*min-height:44px/)
  assert.match(css,/data-portrait="true"[^\n]*\.cookery-order\{[^}]*max-width:calc\(100% - 178px\)/)
})
