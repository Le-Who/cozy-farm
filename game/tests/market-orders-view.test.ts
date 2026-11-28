import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import {runInNewContext} from 'node:vm'
import {createFarm,workBed,getMarketOrders,deliverMarketOrder,getHarborOrder,sail,endDay,restoreCurrentFarm,ingredientCount} from '../src/farm.ts'
import {getMarketOrderBoard,renderMarketOrderPicker} from '../src/market-orders-view.ts'
import {getNextMarketOrders,renderNextMarketOrder} from '../src/market-return.ts'
import {harborReturnFixture} from './fixtures/harbor-return.ts'
import {isGuardedAction,ActionClickGuard,ActivationKeyGuard} from '../src/action-click-guard.ts'

const source=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
const fn=source.slice(source.indexOf('function marketOrders()'),source.indexOf('\nfunction deliveryItems'))
function rendered(farm:ReturnType<typeof createFarm>,selectedMarketOrder?:string){
 const context={farm,selectedMarketOrder,getMarketOrderBoard,renderMarketOrderPicker,getMarketOrders,getNextMarketOrders,renderNextMarketOrder,
  icon:(name:string)=>`<img alt="" src="${name}.webp">`,numberFormat:new Intl.NumberFormat('ru-RU'),ruPlural:()=>'',
  marketOrderStockTile:(item:any)=>`<li>${item.kind}:${item.item??''} ${ingredientCount(farm,item)}/${item.quantity}</li>`,
  button:(name:string,action:string,enabled=true,options:any={})=>`<button data-action="${action}" data-value="${options.value??''}"${enabled?'':' disabled'}>${name}</button>`,
  harborCard:()=>'<section id="harbor-order">original unique harbor card</section>'}
 return runInNewContext(stripTypeScriptTypes(fn+'\nmarketOrders()'),context) as string
}
function ready(){const f=createFarm();assert.ok(workBed(f,2).ok);assert.ok(workBed(f,3).ok);return f}

test('an actually harvested ready order is selected first; all current lanes remain available once',()=>{
 const f=ready(),before=structuredClone(f),board=getMarketOrderBoard(f)
 assert.equal(board.selected,'garden');assert.equal(board.choices.find(x=>x.id==='garden')?.group,'ready')
 assert.equal(board.choices.find(x=>x.id==='pantry')?.group,'waiting')
 assert.deepEqual(board.choices.map(x=>x.id).sort(),getMarketOrders(f).map(x=>x.lane).sort())
 const html=rendered(f);assert.equal((html.match(/class="market-order"/g)||[]).length,1)
 assert.match(html,/data-action="deliver-order" data-value="garden">/)
 for(const item of getMarketOrders(f).find(x=>x.lane==='garden')!.items)assert.ok(html.includes(`${ingredientCount(f,item)}/${item.quantity}`))
 assert.match(html,/data-order-group="ready"/);assert.match(html,/data-order-group="waiting"/)
 assert.match(html,/<summary>Когда появится следующий заказ<\/summary>/)
 assert.deepEqual(f,before)
})

test('explicit waiting selection is retained; invalid/retired selections safely fall back, without writes',()=>{
 const f=ready(),before=structuredClone(f)
 assert.equal(getMarketOrderBoard(f,'pantry').selected,'pantry')
 assert.match(rendered(f,'pantry'),/data-action="deliver-order" data-value="pantry" disabled/)
 for(const id of ['','retired','harbor','__proto__'])assert.equal(getMarketOrderBoard(f,id).selected,'garden')
 assert.deepEqual(f,before)
})

test('delivered selection shows only its next-morning preview, never another delivery; sleep alone cannot complete it',()=>{
 const f=ready(),quote=getMarketOrders(f).find(x=>x.lane==='garden')!
 assert.ok(deliverMarketOrder(f,'garden').ok);const before=structuredClone(f)
 const board=getMarketOrderBoard(f,'garden'),html=rendered(f,'garden')
 assert.equal(board.selected,'garden');assert.equal(board.choices.find(x=>x.id==='garden')?.group,'delivered')
 assert.match(html,/Сегодня доставлено/);assert.match(html,/После отдыха · день 2/)
 assert.match(html,/data-action="market-next-rest" data-value="1"/)
 assert.doesNotMatch(html,/data-action="deliver-order"/);assert.deepEqual(f,before)
 assert.equal(board.choices.find(x=>x.id==='garden')?.reward,quote.reward)
 assert.equal(deliverMarketOrder(f,'garden').ok,false);assert.deepEqual(f,before)
 const next=getNextMarketOrders(f)[0];endDay(f)
 const today=getMarketOrders(f).find(x=>x.lane==='garden')!;assert.equal(today.name,next.name)
 assert.equal(getMarketOrderBoard(f,'garden').selected,'garden');assert.notEqual(getMarketOrderBoard(f,'garden').choices.find(x=>x.id==='garden')?.group,'delivered')
 assert.deepEqual(restoreCurrentFarm(JSON.parse(JSON.stringify(f))),f)
})

test('Grove harbor remains distinct from atomic Home deliveries, with partial/done state and unique original card',()=>{
 const f=harborReturnFixture();assert.ok(sail(f,'home').ok);const before=structuredClone(f),board=getMarketOrderBoard(f,'harbor')
 assert.equal(board.selected,'harbor');assert.equal(board.choices.find(x=>x.id==='harbor')?.group,'harbor')
 assert.equal(board.choices.find(x=>x.id==='harbor')?.note,'Доставлено')
 assert.match(rendered(f,'harbor'),/original unique harbor card/);assert.doesNotMatch(rendered(f,'harbor'),/data-action="deliver-order"/)
 assert.equal(board.choices.length,getMarketOrders(f).length+1);assert.deepEqual(f,before)
 endDay(f);assert.equal(getMarketOrderBoard(f,'harbor').choices.find(x=>x.id==='harbor')?.note,'Сдача в роще')
 assert.equal(getHarborOrder(f)?.status,'locked')
 assert.ok(sail(f,'grove').ok);f.dishes.farmhouseBread=1
 assert.equal(getMarketOrderBoard(f,'harbor').choices.find(x=>x.id==='harbor')?.note,'Можно внести припасы')
})

test('all unlocked lanes, actual adjusted rewards and current requirement/source paths remain in the view',()=>{
 const f=harborReturnFixture();f.buildingLevels.coop=2;f.buildingLevels.well=2;assert.ok(sail(f,'home').ok)
 const board=getMarketOrderBoard(f),before=structuredClone(f)
 assert.equal(new Set(board.choices.map(x=>x.id)).size,board.choices.length)
 for(const order of getMarketOrders(f)){
  assert.equal(board.choices.find(x=>x.id===order.lane)?.reward,order.reward)
  const html=rendered(f,order.lane)
  assert.ok(html.includes(order.name));if(order.status!=='delivered')for(const item of order.items)assert.ok(html.includes(`${ingredientCount(f,item)}/${item.quantity}`))
 }
 assert.deepEqual(f,before)
 const realStock=source.slice(source.indexOf('function stockTile('),source.indexOf('function recipeDestination'))
 assert.match(realStock,/ingredientCount\(farm, item\)/);assert.match(fn,/order\.items\.map\(\(item, index\) => marketOrderStockTile\(item, localWithdrawals\[index\]\)\)/);assert.match(fn,/renderNextMarketOrder\(next,marketOrderStockTile\)/)
 const harbor=source.slice(source.indexOf('function harborCard('),source.indexOf('function groveDockActions'))
 for(const original of ['deliveryItems(order.items)','getHarborWithdrawal(farm)',"'withdraw-harbor'","'sail'","'deliver-harbor'",'renderNextHarborOrder'])assert.ok(harbor.includes(original))
})

test('selection handler validates context and only redraws/focuses the chosen detail',()=>{
 const branch=source.slice(source.indexOf("    case 'market-order-select':"),source.indexOf("    case 'deliver-order':"))
 const farm=ready(),before=structuredClone(farm)
 for(const options of [{},{value:'retired'},{panel:'rest'},{marketTab:'sell'},{dialog:{open:false}}]){
  let draw=0,focus=0,scroll=0
  const ctx={farm,panel:'market',marketTab:'orders',dialog:{open:true},value:'pantry',selectedMarketOrder:undefined,getMarketOrderBoard,drawPanel:()=>draw++,dialogContent:{querySelector:()=>({focus:()=>focus++,scrollIntoView:()=>scroll++})},...options}
  runInNewContext(stripTypeScriptTypes(`switch('market-order-select'){${branch}}`),ctx)
  assert.equal(draw,Object.keys(options).length?0:1);assert.equal(focus,draw);assert.equal(scroll,draw);assert.deepEqual(farm,before)
 }
 assert.doesNotMatch(branch,/saveFarm|perform\(|localStorage|endDay|deliverMarketOrder/)
 assert.ok(isGuardedAction('market-order-select'))
 const unsafe={choices:[{id:'garden',name:'<img src=x>',reward:25,group:'ready' as const,note:''}],selected:'garden'}
 assert.match(renderMarketOrderPicker(unsafe,()=>''),/&lt;img/);assert.doesNotMatch(renderMarketOrderPicker(unsafe,()=>''),/<img/)
})


test('one delivery gesture cannot activate the newly revealed rest or partial-supply control',()=>{
 for(const action of ['deliver-order','deliver-harbor','withdraw-harbor','market-order-select'])assert.ok(isGuardedAction(action))
 const clicks=new ActionClickGuard(),first={detail:1,timeStamp:100,clientX:180,clientY:220}
 clicks.remember(first)
 assert.equal(clicks.blocks({...first,detail:2,timeStamp:160}),true)
 assert.equal(clicks.blocks({...first,timeStamp:700}),false)
 const keys=new ActivationKeyGuard()
 assert.equal(keys.blocks({key:'Enter',repeat:false},isGuardedAction('deliver-order')),false)
 assert.equal(keys.blocks({key:'Enter',repeat:true},false),true)
 keys.release('Enter');assert.equal(keys.blocks({key:'Enter',repeat:false},true),false)
})

test('fresh visits prefer current ready work unless the player picked a lane; an explicit ready shortcut wins for that visit only',()=>{
 const farm=ready()
 farm.produce.wheat=2;farm.eggs=1
 const entryBranch=source.slice(source.indexOf("  if(next==='cove'"),source.indexOf('  const reopenScroll ='))
 const pickBranch=source.slice(source.indexOf("    case 'market-order-select':"),source.indexOf("    case 'deliver-order':"))
 const c={farm,next:'market',remember:true,selectedMarketOrder:undefined as string|undefined,pickedMarketOrder:undefined as string|undefined,entry:undefined as {readyOrder?:boolean}|undefined,dialog:{open:false},panel:'market',marketTab:'orders',value:'garden',getMarketOrderBoard,drawPanel:()=>{},dialogContent:{querySelector:()=>null}}
 const visible=()=>c.selectedMarketOrder=getMarketOrderBoard(farm,c.selectedMarketOrder).selected
 const enter=(open:boolean,readyOrder=false)=>{c.dialog.open=open;c.entry={readyOrder};runInNewContext(stripTypeScriptTypes(`(function(){${entryBranch}})()`),c);return visible()}
 assert.equal(enter(false),'garden')
 assert.ok(deliverMarketOrder(farm,'garden').ok)
 const before=structuredClone(farm)
 assert.equal(enter(true),'garden','current receipt and redraw stay put')
 c.remember=false;assert.equal(enter(false),'garden','Back does not begin a fresh visit');c.remember=true
 assert.equal(enter(false),'pantry','the remaining ready order is immediately actionable')
 c.dialog.open=true
 runInNewContext(stripTypeScriptTypes(`switch('market-order-select'){${pickBranch}}`),c)
 assert.equal(enter(false),'garden','an explicit pick survives normal reopen')
 assert.equal(enter(true,true),'pantry','a ready-order task points at its order, not the old pick')
 assert.equal(enter(false),'garden','following a shortcut did not overwrite the explicit pick')
 assert.deepEqual(farm,before)
})

test('a guided Orders visit cannot travel or open another panel during an island crossing',()=>{
 const branch=source.slice(source.indexOf("    case 'visit-market':"),source.indexOf("    case 'fishing-practice':"))
 for(const crossing of [true,false]){
  const events:string[]=[]
  const context={value:'orders',island:{isCrossing:()=>crossing,visit:(target:{kind:string})=>events.push(target.kind)},openGuidedMarket:(value:string)=>events.push(value)}
  runInNewContext(stripTypeScriptTypes(`switch('visit-market'){${branch}}`),context)
  assert.deepEqual(events,crossing?[]:['market','orders'])
 }
})

test('default DOM places the chooser first without a CSS-only visual or tab order',()=>{
 const html=rendered(ready()),picker=html.indexOf('<nav class="market-order-picker"'),detail=html.indexOf('<div class="market-order-detail"')
 assert.ok(picker>=0&&picker<detail&&detail<html.indexOf('<summary>Когда появится следующий заказ'))
 assert.doesNotMatch(html,/tabindex="[1-9]/,'do not force tab order independently of reading order')
 const css=readFileSync(new URL('../src/market-orders-view.css',import.meta.url),'utf8')
 assert.doesNotMatch(css,/\.market-order-(?:picker|detail)\s*\{[^}]*\border\s*:/,'preserve the DOM order at every breakpoint')
})
