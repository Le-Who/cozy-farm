import test from 'node:test'
import assert from 'node:assert/strict'
import { beginFishingTrip, cancelFishingTrip, endDay, finishFishingTrip, getFishAction, getFishingTripConfig, restoreFarm, sail } from '../src/farm.ts'
import { getFinnFishingRoute } from '../src/finn-fishing-route.ts'
import { fishingReturnFixture } from './fixtures/fishing-return.ts'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { runInNewContext } from 'node:vm'
import * as F from '../src/farm.ts'
import { commissionPlayer } from './fixtures/commission-player.ts'
import { getHarbourFishRoute } from '../src/harbour-fish-route.ts'

const reload = (farm: ReturnType<typeof fishingReturnFixture>) => restoreFarm(JSON.parse(JSON.stringify(farm)))!

test('Finn promises hook space and visibly confirms preparation with a separate next pier at his cottage', () => {
  const opening=JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json',import.meta.url),'utf8')) as {name:string;args:unknown[]}[]
  const p=commissionPlayer(opening.slice(0,opening.findIndex(step=>step.name==='inviteResident'&&step.args[0]==='finn')))
  const code=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
  function section(start:string,end:string){const a=code.indexOf(start),b=code.indexOf(end,a+start.length);assert.ok(a>=0&&b>a);return code.slice(a,b)}
  const cottage=stripTypeScriptTypes(section('function neighboursCard()', 'let selectedWarehouseRequest')+';neighboursCard()')
  const read=()=>runInNewContext(cottage,{...F,getFinnFishingRoute,farm:p.state,villageSlot:1,pastryShape:'round',icon:()=>'',nav:(...parts:string[])=>parts.join(''),neighborHelpCard:()=>'',button:(label:string)=>label}) as string
  assert.match(read(),/\+1 место на крючке · крепче снасть/)
  p.act('inviteResident','finn',1);assert.match(read(),/Разведать · \+1 место на крючке/)
  const before=structuredClone(p.state.fish),quota=structuredClone(p.state.fishCaughtToday),coins=p.state.coins
  const dialog={open:true,close(){this.open=false}}
  let focused=false
  const dialogFeedback={dataset:{},textContent:'',hidden:true,classList:{toggle(){}}}
  const script=section('function perform(', '\n}')+'\n}'+
    "\nswitch ('resident-service'){"+section("case 'resident-service':","case 'finn-pier':")+'}'
  runInNewContext(stripTypeScriptTypes(script),{...F,farm:p.state,value:'finn',pastryShape:'round',panel:'village',villageSlot:1,
    dialog,dialogFeedback,dialogFeedbackTimer:0,dialogContent:{querySelector:(s:string)=>s==='[data-finn-hook]'?{focus(){focused=true}}:null},
    window:{setTimeout(){},clearTimeout(){}},saveFarm(){},refresh(){}})
  assert.equal(dialog.open,true);assert.equal(focused,true)
  assert.match(dialogFeedback.textContent,/Следующий крючок вместит ещё одну рыбу/)
  assert.match(read(),/Крючок готов<\/strong>/)
  assert.match(read(),/Родной причал · до 2 рыб/)
  assert.match(read(),/Причал рощи · до 3 рыб/)
  assert.ok(getFinnFishingRoute(p.state)?.alternate)
  assert.deepEqual(p.state.fish,before);assert.deepEqual(p.state.fishCaughtToday,quota);assert.equal(p.state.coins,coins)
  p.visit('grove');p.reload();assert.equal(p.state.village.scouting,true)
  const trip=beginFishingTrip(p.state);assert.equal(trip.config?.capacity,3);assert.equal(trip.config?.resilience,4)
  assert.equal(p.state.village.scouting,false);assert.ok(finishFishingTrip(p.state,trip.token!,[]).ok)
  assert.deepEqual(p.state.fish,before);assert.deepEqual(p.state.fishCaughtToday,quota)
})

test('viewing prepared fishing repeatedly and reloading never consumes its picnic or Finn help', () => {
  const farm = fishingReturnFixture(), before = structuredClone(farm)
  for (let i = 0; i < 4; i++) {
    assert.ok(getFishAction(farm).available)
    assert.deepEqual(getFishingTripConfig(farm), { capacity: 4, depth: 120, resilience: 5, scouted: true, picnic: 'bright', tasting: true })
  }
  assert.deepEqual(farm, before)
  assert.deepEqual(reload(farm), before)
  assert.equal(cancelFishingTrip(farm).ok, false)
  assert.deepEqual(farm, before)
})

test('a real cast consumes each prepared effect exactly once; cancellation grants nothing and reload preserves that boundary', () => {
  const farm = fishingReturnFixture(), before = structuredClone(farm), started = beginFishingTrip(farm)
  assert.ok(started.ok)
  assert.equal(farm.culinary.picnic, null)
  assert.equal(farm.village.scouting, false)
  assert.equal(farm.culinary.tastings.finn.bonus, false)
  assert.equal(started.config?.capacity, 4)
  assert.equal(started.config?.resilience, 5)
  const pending = reload(farm)
  assert.deepEqual(pending, farm)
  assert.ok(cancelFishingTrip(pending, started.token).ok)
  assert.deepEqual(pending.fish, before.fish)
  assert.deepEqual(pending.fishCaughtToday, before.fishCaughtToday)
  assert.equal(pending.coins, before.coins)
  assert.equal(pending.workToday, before.workToday)
  assert.equal(pending.pendingFishingTrip, null)
  assert.deepEqual(getFishingTripConfig(pending), { capacity: 2, depth: 120, resilience: 2, scouted: false })
  assert.deepEqual(reload(pending), pending)
  const cancelled = structuredClone(pending)
  assert.equal(finishFishingTrip(pending, started.token!, 3).ok, false)
  assert.deepEqual(pending, cancelled)
})

test('quota and wrong-shore refusals preserve every unused effect, with no token issued', () => {
  for (const failure of ['quota', 'shore'] as const) {
    const farm = fishingReturnFixture()
    if (failure === 'quota') farm.fishCaughtToday.home = 3
    else assert.ok(sail(farm, 'village').ok)
    const before = structuredClone(farm)
    assert.equal(beginFishingTrip(farm).ok, false)
    assert.deepEqual(farm, before)
    assert.deepEqual(reload(farm), before)
  }
})

test('rest expires only the same-day picnic, leaving the existing prepared route and Finn help for later', () => {
  const farm = fishingReturnFixture()
  assert.ok(endDay(farm).ok)
  const loaded = reload(farm)
  assert.equal(loaded.culinary.picnic, null)
  assert.equal(loaded.village.scouting, true)
  assert.equal(loaded.culinary.tastings.finn.bonus, true)
  assert.deepEqual(getFishingTripConfig(loaded), { capacity: 3, depth: 120, resilience: 5, scouted: true, tasting: true })
})


const earnedOpening = () => JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json',import.meta.url),'utf8'))
const liveSource = readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
function exactCode(start:string,end:string) {
  const a=liveSource.indexOf(start),b=liveSource.indexOf(end,a+start.length)
  assert.ok(a>=0&&b>a,[start,end].join(' / '))
  return liveSource.slice(a,b)
}

test('an earned prepared hook offers both shores only when Home clips the one usable extra slot',async()=>{
  const routeClick=stripTypeScriptTypes(`(async()=>{
    ${exactCode('async function visitPanelAt(', 'function openGuidedMarket(')}
    switch ('finn-pier') { ${exactCode("    case 'finn-pier':","    case 'buy-boat':")} }
  })()`)
  const place=stripTypeScriptTypes(exactCode('function mountFishing(', 'function pastryChoices(')+';mountFishing()')
  type Controls = {capacity:number;resumed:boolean;onCast():boolean;onCancel():void}
  for(const coast of ['home','grove'] as const){
    const p=commissionPlayer(earnedOpening())
    assert.deepEqual([p.state.day,p.actions,p.state.island,p.state.coins],[14,107,'village',68])
    assert.deepEqual(p.state.fishCaughtToday,{home:1,grove:0})
    p.act('runResidentService','finn');p.reload()
    const farm=p.state, before=structuredClone(farm)
    const ready=getFinnFishingRoute(farm)!
    assert.ok(ready.alternate,'the prepared card must offer the other shore that can really add a fish slot')
    assert.deepEqual([ready.island,ready.alternate.island],['home','grove'])
    assert.equal(ready.addsSlot,false)
    assert.deepEqual(farm,before)
    const token=coast==='home'?ready.value:ready.alternate.value
    let options:Controls|undefined, crossings=0, writes=0, refreshed=0
    const env={...F,getFinnFishingRoute,farm,value:'grove:fishing',panel:'village' as string|null,villageSlot:1,
      dialog:{open:true},panelHistory:[] as {panel:string}[],
      island:{isCrossing:()=>false,crossIsland:async(commit:()=>boolean)=>{crossings++;assert.ok(commit())},setFishing(){}},
      rememberPanel:()=>({panel:env.panel}),fieldViewButton:{getAttribute:()=> 'false'},
      closeDialog(){env.dialog.open=false;env.panel=null;env.panelHistory.length=0},
      openPanel(next:string){env.panel=next;env.dialog.open=true},
      drawPanel(){refreshed++},
      perform:(f:()=>{ok:boolean})=>f().ok,saveFarm(){writes++}, stopFishing(){},fishingPractice:undefined,
      fishingGame:undefined as unknown,fishingToken:undefined as number|undefined,
      dialogContent:{innerHTML:'',querySelector:()=>({querySelector:()=>null})},
      createFishingGame:(_host:unknown,input:Controls)=>{options=input;return{destroy(){}}},
    }
    const move=(value:string)=>{env.value=value;return runInNewContext(routeClick,env)}
    await move('grove:fishing')
    await move(token.replace(':14:',':13:'))
    assert.equal(refreshed,2);assert.equal(crossings,0);assert.deepEqual(farm,before)
    env.villageSlot=0;await move(token)
    assert.equal(crossings,0,'a token cannot travel from the other cottage')
    env.villageSlot=1;await move(token)
    assert.equal(crossings,1);assert.equal(env.panel,'fishing');assert.equal(farm.island,coast)
    assert.deepEqual(env.panelHistory,[],'crossing never adds the inaccessible former local house to Back')
    assert.deepEqual(farm,{...before,island:coast})
    const travelled=structuredClone(farm)
    runInNewContext(place,env)
    assert.ok(options);assert.equal(options.capacity,coast==='home'?2:3);assert.equal(options.resumed,false)
    assert.equal(writes,0);assert.deepEqual(farm,travelled)
    options.onCancel()
    assert.equal(env.dialog.open,false);assert.deepEqual(farm,travelled,'leaving the ordinary shore preview does not consume or move again')
    env.openPanel('fishing');runInNewContext(place,env)
    assert.ok(options);assert.equal(options.onCast(),true)
    assert.equal(options.onCast(),false);assert.equal(writes,1);assert.equal(farm.fishingTripSerial,1)
    assert.equal(farm.village.scouting,false);assert.equal(farm.pendingFishingTrip?.island,coast)
    const fish=coast==='home'?'perch':'seaBass',count=options.capacity
    const catches=Array.from({length:count},()=>({kind:'fish',species:fish,variant:'regular'} as const))
    assert.ok(F.finishFishingTrip(farm,env.fishingToken!,catches).ok)
    assert.equal(farm.fish[fish],count);assert.equal(farm.coins,before.coins)
    assert.equal(F.finishFishingTrip(farm,env.fishingToken!,catches).ok,false)
    assert.deepEqual(reload(farm),farm)
  }
})

test('a lone shore, equal usable bonus, exhausted shores, or a saved paid preview never creates a redundant second action',()=>{
  for(const paid of [undefined,'home','grove'] as const){
    const p=commissionPlayer(earnedOpening())
    if(paid){p.visit(paid);p.act('beginFishingTrip');p.visit('village')}
    const pending=structuredClone(p.state.pendingFishingTrip), paidTrade=getHarbourFishRoute(p.state)
    p.act('runResidentService','finn'); p.reload()
    assert.deepEqual(p.state.pendingFishingTrip,pending)
    const before=structuredClone(p.state)
    assert.equal(getFinnFishingRoute(p.state)?.alternate?.island,paid?undefined:'grove')
    assert.deepEqual(getHarbourFishRoute(p.state),paidTrade)
    assert.deepEqual(p.state,before)
    if(paid){p.visit(paid);assert.equal(F.getResumableFishingTrip(p.state)?.token,pending?.token);assert.equal(p.state.village.scouting,true)}
  }
  for(const exhausted of [['home'],['grove'],['home','grove']] as const){
    const p=commissionPlayer(earnedOpening())
    for(const shore of exhausted){
      p.visit(shore)
      while(F.getFishAction(p.state).available){
        const cast=p.act('beginFishingTrip')
        p.act('finishFishingTrip',cast.token,cast.config!.capacity)
      }
    }
    p.visit('village');p.act('runResidentService','finn')
    const before=structuredClone(p.state),route=getFinnFishingRoute(p.state)!
    assert.equal(route.alternate,undefined)
    assert.equal(route.value,exhausted.length===2?'home:rest':exhausted[0]==='home'?'grove:fishing':'home:fishing')
    assert.deepEqual(p.state,before)
    p.visit(route.island)
    assert.equal(p.state.village.scouting,true)
    if(route.panel==='rest'){
      assert.equal(F.beginFishingTrip(p.state).ok,false)
      p.night();assert.equal(p.state.village.scouting,true)
    }
  }
  const next=commissionPlayer(earnedOpening());next.night();next.visit('village');next.act('runResidentService','finn')
  assert.equal(getFinnFishingRoute(next.state)?.value,'home:fishing')
  assert.equal(getFinnFishingRoute(next.state)?.addsSlot,true)
  assert.equal(getFinnFishingRoute(next.state)?.alternate,undefined,'same bonus on both shores preserves the ordinary single Home target')
})

test('Finn sends an earned cold Grove cast straight to its owner without spending the new hook', async () => {
  const p=commissionPlayer(earnedOpening())
  p.visit('home');p.act('sendFerryExpedition','mill-buy');p.night()
  assert.equal(p.state.handmade.round,0)
  p.act('receiveFerryExpedition');p.visit('village')
  p.act('joinNeighborPlan','finn:1');p.act('serveNeighborPlan','finn:1','handmade:round')
  p.act('finishNeighborPlan','finn:1',{kind:'basket',settled:true,placements:[
    {slot:'food',x:0,y:0},{slot:'cup',x:.4,y:.2},{slot:'flowers',x:-.4,y:.2},
  ]})
  assert.equal(p.state.neighbors.finn.helpReady,true)
  const solo=structuredClone(p.state)
  assert.equal(getFinnFishingRoute(solo),undefined)
  assert.ok(F.runResidentService(solo,'finn').ok)
  assert.equal(getFinnFishingRoute(solo)?.value,'home:fishing')
  assert.equal(getFinnFishingRoute(solo)?.addsSlot,true)
  const home=structuredClone(p.state)
  assert.ok(F.sail(home,'home').ok);assert.ok(F.beginFishingTrip(home).ok)
  assert.ok(F.sail(home,'village').ok);assert.ok(F.runResidentService(home,'finn').ok)
  assert.equal(getFinnFishingRoute(reload(home))?.value,'home:fishing')
  assert.equal(getFinnFishingRoute(reload(home))?.addsSlot,false)

  p.visit('grove')
  const original=p.act('beginFishingTrip')
  assert.deepEqual([original.config.capacity,original.config.resilience],[2,2])
  p.reload() // Cold open from the committed cast, not closing its active scene.
  p.visit('village')
  assert.equal(getFinnFishingRoute(p.state),undefined,'no route before explicitly asking Finn')
  p.act('runResidentService','finn');p.reload()

  const farm=p.state, before=structuredClone(farm), route=getFinnFishingRoute(farm)!
  assert.deepEqual([route.island,route.panel,route.label,route.addsSlot,route.alternate],
    ['grove','fishing','В рощу · продолжить',false,undefined])
  assert.deepEqual(farm,before)
  const click=stripTypeScriptTypes(`(async()=>{
    ${exactCode('async function visitPanelAt(', 'function openGuidedMarket(')}
    switch ('finn-pier') { ${exactCode("    case 'finn-pier':","    case 'buy-boat':")} }
  })()`)
  const mount=stripTypeScriptTypes(exactCode('function mountFishing(', 'function pastryChoices(')+';mountFishing()')
  type Controls={capacity:number;resilience:number;resumed:boolean;onCast():boolean;onCancel():void}
  let controls:Controls|undefined
  const crossed:F.IslandId[]=[], opened:string[]=[], mutations:string[]=[]
  const ctx={...F,getFinnFishingRoute,farm,value:route.value,panel:'village' as string|null,villageSlot:1,
    dialog:{open:true},panelHistory:[{panel:'guide'}] as {panel:string}[],
    island:{isCrossing:()=>false,crossIsland:async(commit:()=>boolean)=>{assert.ok(commit());crossed.push(farm.island)},setFishing(){}},
    fieldViewButton:{getAttribute:()=> 'false'},rememberPanel:()=>({panel:ctx.panel}),
    closeDialog(){ctx.dialog.open=false;ctx.panel=null;ctx.panelHistory.length=0},
    openPanel(panel:string){ctx.panel=panel;ctx.dialog.open=true;opened.push(panel)},drawPanel(){},
    perform(fn:()=>{ok:boolean}){const done=fn();if(done.ok)mutations.push('sail');return done.ok},
    saveFarm(){mutations.push('cast')},stopFishing(){},fishingPractice:undefined,fishingGame:undefined as unknown,
    fishingToken:undefined as number|undefined,dialogContent:{innerHTML:'',querySelector:()=>({querySelector:()=>null})},
    createFishingGame(_host:unknown,options:Controls){controls=options;return{destroy(){}}},
  }
  ctx.villageSlot=0;await runInNewContext(click,ctx);assert.deepEqual(crossed,[])
  ctx.villageSlot=1;ctx.value='grove:fishing';await runInNewContext(click,ctx)
  ctx.value='grove:fishing:resume:0';await runInNewContext(click,ctx)
  assert.deepEqual(crossed,[],'a generic or stale old-token button cannot travel')
  ctx.value=route.value;await runInNewContext(click,ctx)
  assert.deepEqual([crossed,opened,mutations],[['grove'],['fishing'],['sail']])
  assert.deepEqual(ctx.panelHistory,[{panel:'guide'}],'global Back stays; no remote former cottage is pushed')
  assert.deepEqual(farm,{...before,island:'grove'})
  runInNewContext(mount,ctx)
  assert.ok(controls)
  assert.deepEqual([controls.resumed,controls.capacity,controls.resilience],[true,2,2])
  controls.onCancel();assert.deepEqual(farm,{...before,island:'grove'},'leaving untouched review does not cancel')
  ctx.openPanel('fishing');runInNewContext(mount,ctx)
  assert.ok(controls.onCast())
  assert.equal(ctx.fishingToken,original.token)
  assert.deepEqual(mutations,['sail'],'resuming cannot buy or replace the paid lease')
  assert.ok(F.finishFishingTrip(farm,original.token,1).ok)
  assert.equal(farm.village.scouting,true);assert.equal(farm.neighbors.finn.helpReady,true)
  assert.equal(farm.pendingFishingTrip,null);assert.equal(farm.coins,before.coins)
  assert.ok(F.sail(farm,'home').ok);assert.ok(F.endDay(farm).ok);assert.ok(F.sail(farm,'grove').ok)
  const next=F.beginFishingTrip(reload(farm))
  assert.deepEqual([next.config?.capacity,next.config?.resilience],[3,5])
})
