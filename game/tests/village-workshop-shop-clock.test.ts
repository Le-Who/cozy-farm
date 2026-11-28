import A from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes as strip } from 'node:module'
import test from 'node:test'
import { runInNewContext as vm } from 'node:vm'
import * as F from '../src/farm.ts'
import * as S from '../src/bay-shop-model.ts'
import { reserveShopGoods } from '../src/harbour-economy.ts'
import { describeFood } from '../src/intent-orders.ts'
import { commissionPlayer } from './fixtures/commission-player.ts'

const read = (path:string) => readFileSync(new URL(path,import.meta.url),'utf8')
const main=read('../src/main.ts'),workshop=read('../src/workshop.ts'),shop=read('../src/bay-shop.ts')
const opening=JSON.parse(read('./fixtures/home-progress-actions.json'))
const part=(src:string,from:string,to:string)=>{
 const a=src.indexOf(from)
 if(a<0)return ''
 const b=src.indexOf(to,a+from.length);A.ok(b>a,from);return src.slice(a,b)
}
function earned() {
 const p=commissionPlayer(opening)
 p.visit('home')
 if(p.state.selectedSeed!=='wheat')p.act('selectSeed','wheat')
 p.act('workBed',0)
 for(let i=0;i<4;i++){
  const a=F.getBedAction(p.state,0)
  if(a.kind==='harvest'){p.act('workBed',0);break}
  if(a.kind==='water'){if(!a.available)p.act('refillWater');p.act('workBed',0)}
  p.night()
 }
 p.visit('village')
 const f=p.state,id='dish:orchardTart',item=F.foodDescriptors(f).find(x=>x.id===id)!
 A.deepEqual([p.actions,f.day,f.island,f.coins,f.produce.wheat,f.eggs,item.count,item.sellPrice],[114,16,'village',68,2,3,1,25])
 A.ok(F.getWorkshopAction(f).available)
 A.ok(reserveShopGoods(f,id,1))
 A.ok(S.stockBayShop(f.bayShop,0,{id,identity:id,name:item.name,image:'/art/lavender/ui-tart.webp',basePrice:item.sellPrice,tags:[...item.ingredients,...describeFood(item)]},1))
 S.setBayShopOpen(f.bayShop,true);p.reload()
 return p.state
}
function stall(farm:F.FarmState){
 const sales:number[]=[],state=farm.bayShop,noop=()=>{}
 let now=0
 const ctx={state,advanceBayShop:S.advanceBayShop,destroyed:false,document:{hidden:false},lastTime:0,lastPhase:'',lastRefusal:undefined,savedAt:0,
  earnedOrder:undefined,frame:0,tab:'stock',hasShelfStock:()=>state.slots.some(x=>x&&x.quantity>0),
  options:{onEarn(price:number){farm.coins+=price;sales.push(now)},performanceBonus:()=>0},
  render:noop,paintDayGuidance:noop,paintVisitor:noop,saveChanges:noop,requestAnimationFrame:()=>1}
 const tick=vm(strip(part(shop,'  function tick(now:','  const resizeObserver'))+';tick',ctx)
 return {sales,leave(){ctx.destroyed=true},until(t:number){while(now<t){now+=Math.min(100,t-now);tick(now)}}}
}
function board(farm:F.FarmState,recipe='pastry'){
 let workFrame:((now?:number)=>void)|undefined,crossing=false,now=0
 const sales:number[]=[],saved:F.FarmState[]=[],host={isConnected:true}
 const document=Object.assign(new EventTarget(),{hidden:false})
 const abort=new AbortController()
 const ctx={farm,createBayShopWorkClock:S.createBayShopWorkClock,panel:'workshop',dialog:{open:true},
  island:{isCrossing:()=>crossing},dialogContent:{contains:(el:unknown)=>el===host},harbourScene:undefined as unknown,
  document,signal:abort.signal,assetsReady:true,destroyed:false,contextLost:false,layoutChanging:false,cutPending:false,stage:'working',
  get options(){return {shopWorkFrame:workFrame}}, numberFormat:new Intl.NumberFormat('ru'),textAt:()=>{},bayAudio:{playEvent(){}},
  saveHarbour(){saved.push(structuredClone(farm))}}
 const adapter=part(main,'function mountFarmWorkshop(','function harvestSaleCard(')
 const credit=part(main,'function earnHarbourSale(','function openMusicScene(')
 const mount=(_h:unknown,o:{recipe:string;shopWorkFrame?:typeof workFrame})=>{workFrame=o.shopWorkFrame}
 if(adapter)vm(strip(credit+adapter)+';mountFarmWorkshop',ctx)(host,{recipe},mount)
 else mount(host,{recipe})
 const source=part(workshop,'  function tickWorkshopShop(','  function tick(now:')
 const actual=source?vm(strip(source)+';tickWorkshopShop',ctx):()=>{}
 const visibility=workshop.split('\n').find(line=>line.includes("addEventListener('visibilitychange'")&&line.includes('shopWorkFrame'))
 if(visibility)vm(visibility,ctx)
 return {sales,saved,ctx,host,crossing(b:boolean){crossing=b},hide(){document.hidden=true;document.dispatchEvent(new Event('visibilitychange'))},
  frame(t:number){now=t;const sold=farm.bayShop.sold;actual(t);if(farm.bayShop.sold!==sold)sales.push(t)},
  until(t:number){while(now<t)this.frame(now+Math.min(100,t-now))}}
}

test('real D16 Village pastry and open stall share a single conserved buyer clock, before a separately baked bun',()=>{
 const live=earned(),reference=structuredClone(live),control=stall(reference),first=stall(live)
 control.until(7400);A.deepEqual(control.sales,[7400])
 first.until(4000);A.equal(live.bayShop.sold,0);first.leave()
 const work=board(live);work.frame(4000);work.until(7399)
 A.equal(live.bayShop.sold,0)
 first.until(7400) // old storefront instance must not double advance once released.
 A.equal(live.bayShop.sold,0)
 work.until(7400)
 A.deepEqual(work.sales,[7400])
 A.deepEqual(live,reference)
 A.deepEqual([work.saved.at(-1)?.coins,work.saved.at(-1)?.bayShop.sold,live.produce.wheat,live.eggs,live.handmade.round],[93,1,2,3,0])
 A.ok(F.bakeWorkshop(live,'round').ok)
 work.ctx.stage='baking';work.until(11500);work.ctx.stage='finished';work.until(28000)
 A.deepEqual([live.day,live.coins,live.produce.wheat,live.eggs,live.handmade.round,live.bayShop.sold],[16,93,0,2,1,1])
 for(const f of [live,reference]){A.ok(F.sail(f,'home').ok);A.ok(F.endDay(f).ok);A.ok(F.restoreCurrentFarm(f))}
 A.deepEqual([live.coins,reference.coins,live.bayShop],[93,93,reference.bayShop])
})

test('only loaded foreground pastry work clocks: no Home, bread, loading, receipt, paid oven, hidden or double owner',()=>{
 const ineligible=[
  ['bread',()=>{},'bread'],
  ['Home',(w:ReturnType<typeof board>)=>{A.ok(F.sail(w.ctx.farm,'home').ok)}],
  ['ingredients',(w:ReturnType<typeof board>)=>{w.ctx.stage='ingredients'}],
  ['transferring',(w:ReturnType<typeof board>)=>{w.ctx.stage='transferring'}],
  ['paid oven',(w:ReturnType<typeof board>)=>{w.ctx.stage='baking'}],
  ['receipt',(w:ReturnType<typeof board>)=>{w.ctx.stage='finished'}],
  ['blocked renderer',(w:ReturnType<typeof board>)=>{w.ctx.contextLost=true}],
  ['cut pending',(w:ReturnType<typeof board>)=>{w.ctx.cutPending=true}],
  ['layout incomplete',(w:ReturnType<typeof board>)=>{w.ctx.layoutChanging=true}],
  ['art loading',(w:ReturnType<typeof board>)=>{w.ctx.assetsReady=false}],
  ['destroyed',(w:ReturnType<typeof board>)=>{w.ctx.destroyed=true}],
  ['hidden',(w:ReturnType<typeof board>)=>w.hide()],
  ['detached',(w:ReturnType<typeof board>)=>{w.host.isConnected=false}],
  ['different panel',(w:ReturnType<typeof board>)=>{w.ctx.panel='recipes'}],
  ['another shop owner',(w:ReturnType<typeof board>)=>{w.ctx.harbourScene={}}],
  ['modal CLOSED',(w:ReturnType<typeof board>)=>{w.ctx.dialog.open=false}],
  ['merchant CLOSED',(w:ReturnType<typeof board>)=>{S.setBayShopOpen(w.ctx.farm.bayShop,false)}],
  ['crossing',(w:ReturnType<typeof board>)=>w.crossing(true)],
 ] as const
 for(const [name,block,recipe] of ineligible){
  const f=earned(),w=board(f,recipe);block(w)
  const before=structuredClone(f);w.frame(0);w.until(8000)
  A.deepEqual(f,before,name);A.deepEqual(w.saved,[],name)
 }
})

test('visibility and payment seams reset the prior slice; stock rest and receipt cannot earn any missing time',()=>{
 const f=earned(),w=board(f);w.frame(0);w.until(7000)
 const before=structuredClone(f)
 w.hide();w.ctx.document.hidden=false
 w.frame(7450)
 A.deepEqual(f,before,'brief hidden interval without a RAF cannot complete a customer')
 w.ctx.stage='baking';w.until(18000);w.ctx.stage='finished';w.until(21000)
 A.deepEqual(f,before)
 w.ctx.stage='working';w.frame(21100);w.until(21499)
 A.equal(f.bayShop.sold,0);w.until(21500)
 A.deepEqual(w.sales,[21500])
 A.match(workshop,/webglcontextlost'[\s\S]*?contextLost=true;options\.shopWorkFrame\?\.\(\)/)
 A.match(workshop,/destroyed = true;options\.shopWorkFrame\?\.\(\)/)
 A.match(workshop,/stage = 'baking'; options\.shopWorkFrame\?\.\(\); bakeButton.disabled/)
})
