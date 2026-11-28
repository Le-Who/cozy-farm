import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes as strip} from 'node:module'
import {test} from 'node:test'
import {runInNewContext as vm} from 'node:vm'
import * as farmApi from '../src/farm.ts'
import * as economy from '../src/harbour-economy.ts'
import * as expeditions from '../src/ferry-expeditions.ts'
import * as freight from '../src/bay-freight-model.ts'
import * as smaller from '../src/ferry-smaller-cargo.ts'
import * as discovery from '../src/ferry-discovery.ts'
import * as reopening from '../src/ferry-panel-view.ts'
import * as restock from '../src/ferry-restock.ts'
import * as progress from '../src/ferry-project-progress.ts'
import {FerryPeachPlanting} from '../src/ferry-peach-planting.ts'
import {ferryCommissionUse} from '../src/ferry-commission-use.ts'
import {ruCount} from '../src/ru.ts'
import {commissionPlayer} from './fixtures/commission-player.ts'

const read=(name:string)=>readFileSync(new URL(name,import.meta.url),'utf8')
const main=read('../src/main.ts'), panel=read('../src/bay-freight-ui.ts')
function extract(text:string,start:string,end:string){
  const a=text.indexOf(start),b=text.indexOf(end,a+1)
  assert.ok(a>=0&&b>a,start)
  return text.slice(a,b)
}
const render=vm(strip(extract(panel,'const labels:','/** DOM entry used').replaceAll('export function','function')
  .replaceAll('import.meta.env.BASE_URL','"/"')+';renderFreightPanel'),
  {...freight,...expeditions,...smaller,...discovery,...restock,...progress,ruCount})
const declaration=main.includes('const ferrySupplyOrigins =') ? extract(main,'const ferrySupplyOrigins =','function stopHarbour(') : ''
const actions=strip(declaration+extract(main,'function returnFromPanel(', "dialog.addEventListener('cancel'")
  +" ;({paint:typeof renderFreightPanelInto==='function'?renderFreightPanelInto:undefined,act:async()=>{const nativePerform=globalThis.perform; const perform=typeof ferrySupplyPerform==='function'?ferrySupplyPerform(action,value,control):nativePerform; if (!perform) return;switch(action){"+extract(main,"    case 'expedition-restock':","    case 'expedition-source':")
  +extract(main,"    case 'expedition-port':","    case 'expedition-order-recipe':")
  +extract(main,"    case 'expedition-claim':","    case 'music-warehouse-visit':")
  +extract(main,"    case 'back':","    case 'journal-stay':")+"}},escape:()=>returnFromPanel(event)})")
const milestones=JSON.parse(read('./fixtures/home-progress-actions.json'))
function earned(wheat=false, secondPlot=false){
  const p=commissionPlayer(milestones)
  assert.deepEqual([p.actions,p.state.day,p.state.coins,p.state.village.built,p.state.produce.wheat,p.state.eggs],[107,14,68,true,0,3])
  p.visit('home')
  for(let i=0;i<3;i++){
    const quote=expeditions.quoteExpedition(p.state.freight.expeditions,'mill-buy',economy.expeditionWallet(p.state))
    assert.deepEqual([quote?.payCoins,quote?.available,quote?.incoming[0].quantity],[15,true,1])
    p.act('sendFerryExpedition','mill-buy');p.night();p.act('receiveFerryExpedition')
  }
  assert.deepEqual([p.actions,p.state.day,p.state.coins,p.state.handmade.round,p.state.freight.expeditions.markets.mill.stock['handmade:round']],
    [117,17,23,3,0])
  if(secondPlot){
    if(p.state.seeds.wheat<2)p.act('buySeeds','wheat')
    if(p.state.selectedSeed!=='wheat')p.act('selectSeed','wheat')
    const beds=[0,2]
    for(const i of beds)p.act('workBed',i)
    for(let n=0;n<3;n++){
      for(const i of beds){
        const a=farmApi.getBedAction(p.state,i)
        if(a.kind==='water'){if(!a.available)p.act('refillWater');p.act('workBed',i)}
        else if(a.kind==='harvest')p.act('workBed',i)
      }
      if(beds.every(i=>p.state.beds[i].kind==='tilled'))break
      p.night()
    }
    assert.deepEqual([p.actions,p.state.day,p.state.coins,p.state.produce.wheat,p.state.eggs],[129,19,19,6,3])
  } else if(wheat){
    p.act('selectSeed','wheat');p.act('workBed',0);p.act('workBed',0);p.night()
    if(farmApi.getBedAction(p.state,0).kind==='water')p.act('workBed',0)
    p.night();p.act('workBed',0)
    assert.deepEqual([p.state.day,p.state.produce.wheat,p.state.eggs],[19,3,3])
  }
  return p.state
}
function mounted(farm:farmApi.FarmState, cold=false) {
  const quote=expeditions.initialExpeditionPreview(farm.freight.expeditions)
  if(!cold)assert.deepEqual(quote,{port:'mill',offer:'mill-buy'})
  let html='', focused:FakeButton|undefined, state:ReturnType<typeof root>
  let back=0, rest=0
  class FakeButton {
    readonly dataset:{action:string;value:string;ferrySupplyOrder?:string}
    constructor(action:string,value:string,attributes:string){
      this.dataset={action,value,...(attributes.includes('data-ferry-supply-order')?{ferrySupplyOrder:''}:{})}
    }
    matches(s:string) {return s==='button[data-action]'}
    closest(){return null}
    getBoundingClientRect(){return {top:30,bottom:50}}
    scrollIntoView(){}
    parentElement=null
    focus(){focused=this}
  }
  function root(){
    const scrollers=new Map(['.bay-freight-workspace','.expedition-card-scroll','.expedition-overview'].map(q=>[q,{scrollTop:0,getBoundingClientRect:()=>({top:0,bottom:100})}]))
    const buttons=[...html.matchAll(/<button[^>]+data-action="([^"]+)" data-value="([^"]*)"([^>]*)>/g)].map(([,a,v,attr])=>new FakeButton(a,v,attr))
    const details={open:false,querySelector:()=>null}
    return {scrollers,buttons,details,contains:(button:FakeButton)=>buttons.includes(button),
      querySelector:(s:string)=>scrollers.get(s)??(s==='.expedition-offers'?details:
        s==='.bay-freight-close'?buttons.find(b=>b.dataset.action==='close'):null),
      querySelectorAll:()=>buttons}
  }
  const dialogContent={ownerDocument:{get activeElement(){return focused}},
    contains:(c:FakeButton)=>state.contains(c),
    querySelector:(s:string)=>s==='.bay-freight'?state:s==='.bay-freight-close'?state.querySelector(s):null}
  let controller:{act:()=>Promise<void>;escape:()=>unknown;paint?:(host:unknown,state:freight.BayFreightState,context:unknown)=>void}|undefined
  const ctx={...farmApi,...economy,...expeditions,...restock,...reopening,
    farm,panel:'bay-freight',dialog:{open:true},dialogContent,document:dialogContent.ownerDocument,panelHistory:[] as unknown[],
    selectedExpeditionPort:quote.port,selectedExpeditionOffer:quote.offer,action:'',value:undefined as string|undefined,

    event:{type:'click',detail:0,defaultPrevented:false,preventDefault(){this.defaultPrevented=true}},control:{} as unknown,
    communityRequest:undefined,ferryCommissionUse,
    closeContextualSale:()=>false,returnToRecipeIndex:()=>false,
    // Model boundary for a preceding ordinary screen; the real no-history goBack returns immediately.
    goBack(){back++},rememberClosedMarketSell(){},
    bayAudio:{playEvent(){}},presentFerryDeparture(){},ferryPeachPlanting:new FerryPeachPlanting(),
    visitPanelAt(){rest++},
    perform(fn:()=>{ok:boolean}){const r=fn();if(r.ok)ctx.drawPanel();return r.ok},
    renderFerryPanelInto(_host:unknown,freight:freight.BayFreightState,view:Parameters<typeof render>[1]){
      html=render(freight,view)
      state=root()
    },
    drawPanel(){
      const view=reopening.captureFerryPanelView(dialogContent as unknown as HTMLElement)
      const paint=controller?.paint ?? ctx.renderFerryPanelInto
      paint(dialogContent,farm.freight,{day:farm.day,coins:farm.coins,boatOwned:true,playerPort:farm.island,
        expeditionPort:ctx.selectedExpeditionPort,expeditionOffer:ctx.selectedExpeditionOffer,openedPorts:['home','grove','village'],
        carried:economy.expeditionWallet(farm).bag,products:[],icon:()=>''})
      reopening.restoreFerryPanelView(dialogContent as unknown as HTMLElement,view)
    }}
  ctx.drawPanel()
  controller=vm(actions,ctx)
  const act=(action:string,value?:string,supplyLink=false)=>{
    ctx.action=action;ctx.value=value;ctx.control=state.buttons.find(b=>b.dataset.action===action&&b.dataset.value===(value??'')&&(b.dataset.ferrySupplyOrder!==undefined)===supplyLink)
    assert.ok(ctx.control,action+': '+value)
    ;(ctx.control as FakeButton).focus()
    return controller!.act()
  }
  return {ctx,act,get html(){return html},get focused(){return focused?.dataset},get dockBack(){return back},
    get view(){return state},get rests(){return rest},
    escape(){ctx.event.type='keydown';ctx.event.defaultPrevented=false;controller!.escape();return ctx.event.defaultPrevented}}
}

test('unpaid port supply preview returns to the exact paid choice once, keeping price, order details, focus and every resource',async()=>{
  const farm=earned(),before=structuredClone(farm),ui=mounted(farm)
  assert.match(ui.html,/<h3>Купить булочку<\/h3>/)
  assert.match(ui.html,/<strong>15 монет<\/strong><small>Останется 8/)
  assert.match(ui.html,/<strong>Булочка ×1<\/strong>/)
  assert.match(ui.html,/data-action="expedition-send" data-value="mill-buy"[^>]*disabled/)
  ui.view.details.open=true
  ui.view.scrollers.get('.expedition-card-scroll')!.scrollTop=57
  await ui.act('expedition-restock','mill-buy')
  assert.equal(ui.ctx.selectedExpeditionOffer,'mill-sale')
  assert.match(ui.html,/<h3>Продать немного зерна<\/h3>/)
  assert.match(ui.html,/Пшеница ×2/)
  assert.match(ui.html,/<strong>10 монет<\/strong>/)
  assert.deepEqual(farm,before)
  await ui.act('back')
  assert.equal(ui.ctx.selectedExpeditionOffer,'mill-buy','Back must leave the preview without leaving the ferry')
  assert.equal(ui.dockBack,0)
  assert.deepEqual(ui.focused,{action:'expedition-restock',value:'mill-buy'})
  assert.equal(ui.view.details.open,true)
  assert.equal(ui.view.scrollers.get('.expedition-card-scroll')!.scrollTop,57)
  assert.deepEqual(ui.ctx.panelHistory,[])
  await ui.act('back');assert.equal(ui.dockBack,1,'one return, then the ordinary Back')
  await ui.act('expedition-restock','mill-buy')
  assert.equal(ui.escape(),true);assert.equal(ui.ctx.selectedExpeditionOffer,'mill-buy')
  assert.equal(ui.rests,0);assert.deepEqual(farm,before)
})

test('real dispatch and claim keep the exact authoritative supply receipt, with no automatic paid purchase',async()=>{
  const farm=earned(true),ui=mounted(farm),before=structuredClone(farm)
  await ui.act('expedition-restock','mill-buy')
  assert.deepEqual(farm,before)
  await ui.act('expedition-send','mill-sale')
  assert.deepEqual([farm.day,farm.produce.wheat,farm.coins,farm.freight.expeditions.active?.id],[19,1,23,'mill-sale'])
  await ui.act('back');assert.equal(ui.dockBack,1);assert.equal(ui.ctx.selectedExpeditionOffer,'mill-sale')
  assert.ok(farmApi.endDay(farm).ok);ui.ctx.drawPanel()
  await ui.act('expedition-claim')
  assert.deepEqual([farm.day,farm.produce.wheat,farm.coins,farm.handmade.round,farm.freight.expeditions.active],[20,1,33,3,null])
  assert.equal(ui.ctx.selectedExpeditionOffer,'mill-sale')
  assert.equal(expeditions.initialExpeditionPreview(farm.freight.expeditions).offer,'mill-sale')
  assert.equal(expeditions.quoteExpedition(farm.freight.expeditions,'mill-buy',economy.expeditionWallet(farm))?.available,true)
  await ui.act('back'); assert.equal(ui.dockBack,2);assert.equal(ui.ctx.selectedExpeditionOffer,'mill-sale')
  const snapshot=structuredClone(farm)
  await ui.act('expedition-offer','mill-buy')
  assert.deepEqual(farm,snapshot)
})

test('a new view, independent trade or day change does not inherit the old supply return',async()=>{
  for(const boundary of ['revisit','chosen independently','next day'] as const){
    const farm=earned(),ui=mounted(farm)
    await ui.act('expedition-restock','mill-buy')
    if(boundary==='revisit')ui.ctx.drawPanel() // Same selected preview, newly mounted DOM on normal close/reopen.
    if(boundary==='chosen independently')await ui.act('expedition-offer','mill-grain')
    if(boundary==='next day')assert.ok(farmApi.endDay(farm).ok) // Defensive stale guard even before a new view paints.
    const before=structuredClone(farm),selection=ui.ctx.selectedExpeditionOffer
    await ui.act('back')
    assert.equal(ui.dockBack,1,boundary)
    assert.equal(ui.ctx.selectedExpeditionOffer,selection,boundary)
    assert.deepEqual(farm,before)
  }
})

test('the actual supply claim offers one read-only path back to the funded intent without replacing its receipt or ordinary repeat',async()=>{
  const farm=earned(true),ui=mounted(farm)
  await ui.act('expedition-restock','mill-buy')
  assert.doesNotMatch(ui.html,/data-ferry-supply-order/)
  await ui.act('expedition-send','mill-sale')
  assert.doesNotMatch(ui.html,/data-ferry-supply-order/)
  assert.ok(farmApi.endDay(farm).ok);ui.ctx.drawPanel()
  assert.doesNotMatch(ui.html,/data-ferry-supply-order/,'ready arrival is not an explicit claim')
  await ui.act('expedition-claim')
  assert.deepEqual([farm.day,farm.coins,farm.produce.wheat,farm.handmade.round,ui.ctx.selectedExpeditionOffer],[20,33,1,3,'mill-sale'])
  assert.match(ui.html,/Прошлый груз получен · Мельничный посад · день 20/)
  assert.match(ui.html,/data-action="expedition-send" data-value="mill-sale"/)
  assert.match(ui.html,/data-action="expedition-offer" data-value="mill-buy" data-ferry-supply-order>Вернуться к заказу: Купить булочку/)
  const settled=structuredClone(farm)
  await ui.act('expedition-offer','mill-buy',true)
  assert.equal(ui.ctx.selectedExpeditionOffer,'mill-buy')
  assert.doesNotMatch(ui.html,/data-ferry-supply-order/)
  assert.deepEqual(farm,settled,'the next existing purchase stays explicitly separate')
  await ui.act('expedition-send','mill-buy')
  assert.deepEqual([farm.coins,farm.handmade.round,farm.freight.expeditions.active?.id],[18,3,'mill-buy'])
})

test('the ordinary grain plan survives only its own real paid provisioning claim and rechecks the latest wheat',async()=>{
  for(const variation of ['warm','short now','reopened'] as const){
    const farm=earned(true,true),ui=mounted(farm)
    await ui.act('expedition-offer','mill-grain')
    await ui.act('expedition-restock','mill-grain')
    await ui.act('expedition-send','mill-sale')
    assert.ok(farmApi.endDay(farm).ok);ui.ctx.drawPanel()
    await ui.act('expedition-claim')
    assert.deepEqual([farm.day,farm.coins,farm.produce.wheat,farm.handmade.round,ui.ctx.selectedExpeditionOffer],[20,29,4,3,'mill-sale'])
    assert.match(ui.html,/data-action="expedition-offer" data-value="mill-grain" data-ferry-supply-order>Вернуться к заказу: Зерно для пекаря/)
    assert.match(ui.html,/data-action="expedition-send" data-value="mill-sale"(?![^>]*disabled)/)
    if(variation==='reopened'){
      const before=structuredClone(farm)
      ui.ctx.dialog.open=false;ui.ctx.drawPanel()
      ui.ctx.dialog.open=true;ui.ctx.drawPanel()
      assert.doesNotMatch(ui.html,/data-ferry-supply-order/)
      assert.deepEqual(farm,before)
      continue
    }
    const stale=variation==='short now'
    if(stale)assert.ok(farmApi.sellMarketItem(farm,'produce:wheat',2).ok)
    const before=structuredClone(farm)
    await ui.act('expedition-offer','mill-grain',true)
    assert.deepEqual(farm,before)
    assert.equal(ui.ctx.selectedExpeditionOffer,stale?'mill-sale':'mill-grain')
    assert.doesNotMatch(ui.html,/data-ferry-supply-order/)
    if(stale)continue
    await ui.act('expedition-send','mill-grain')
    assert.equal(farm.handmade.round,3)
    assert.ok(farmApi.endDay(farm).ok);ui.ctx.drawPanel()
    await ui.act('expedition-claim')
    assert.deepEqual([farm.day,farm.coins,farm.produce.wheat,farm.eggs,farm.handmade.round],[21,34,0,3,4])
    assert.doesNotMatch(ui.html,/data-ferry-supply-order/)
  }
})

test('a cold paid voyage, an independent sale, or a replaced unpaid owner never infer a target',async()=>{
  for(const why of ['cold','generic','replaced owner'] as const){
    let farm=earned(true,true),ui=mounted(farm)
    if(why==='generic')await ui.act('expedition-offer','mill-sale')
    else {
      await ui.act('expedition-offer','mill-grain')
      await ui.act('expedition-restock','mill-grain')
      if(why==='replaced owner')ui.ctx.drawPanel()
    }
    await ui.act('expedition-send','mill-sale')
    assert.ok(farmApi.endDay(farm).ok)
    if(why==='cold'){
      const restored=farmApi.restoreCurrentFarm(JSON.parse(JSON.stringify(farm)))
      assert.ok(restored);farm=restored;ui=mounted(farm,true)
    }else ui.ctx.drawPanel()
    await ui.act('expedition-claim')
    assert.deepEqual([farm.day,farm.coins,farm.produce.wheat,ui.ctx.selectedExpeditionOffer],[20,29,4,'mill-sale'],why)
    assert.match(ui.html,/data-action="expedition-offer" data-value="mill-grain"/,why)
    assert.doesNotMatch(ui.html,/data-ferry-supply-order/,why)
  }
})
