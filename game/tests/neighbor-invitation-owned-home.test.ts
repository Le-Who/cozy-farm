import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'
import { advanceNeighborPlan, pickFruit, canSailTo, endDay, getBedAction, getBedStage, getNeighborPlans, sail, restoreCurrentFarm, type FarmState } from '../src/farm.ts'
import { canInviteNeighbor, inviteNeighborVisit } from '../src/neighbor-visits.ts'
import { renderNeighborVisits } from '../src/neighbor-visits-ui.ts'
import { commissionPlayer } from './fixtures/commission-player.ts'
import { finnPicnicRide, sailHomeWithFinn } from '../src/finn-picnic-ride.ts'
import { farmSaveKeys } from '../src/farm-save-keys.ts'
import { VersionedSave } from '../src/versioned-save.ts'

const read=(p:string)=>readFileSync(new URL(p,import.meta.url),'utf8')
const main=read('../src/main.ts')
const scope=(a:string,b:string)=>{const i=main.indexOf(a),j=main.indexOf(b,i+a.length);assert.ok(i>=0&&j>i);return main.slice(i,j)}
const visit=scope('async function visitPanelAt(', 'function openGuidedMarket(')
const button=scope('function button(label:', 'function quantity(')
const neighborView=scope("    case 'neighbor':", "    case 'request-food':")
const ui=read('../src/community-ui.ts')
const uiScope=(a:string,b:string)=>{const i=ui.indexOf(a),j=ui.indexOf(b,i+a.length);assert.ok(i>=0&&j>i);return ui.slice(i,j)}
const neighborDetail=runInNewContext(stripTypeScriptTypes(
  uiScope('const escape =','export function neighborHelpCard')
  +uiScope('export function neighborDetail','export function neighborPlanLinks').replace('export ','')
  +'\nneighborDetail'
),{getNeighborPlans,neighborHelpCard:()=>''})
const dispatch=stripTypeScriptTypes(visit+button+
  '\nfunction drawNeighbor(){switch("neighbor"){'+neighborView+
  '}};async function bookHome(){switch("visit-book-home"){'+scope("    case 'visit-book-home':","    case 'visit-invite':")+'}}'
  +';async function rideHome(control,value){switch("finn-picnic-ride"){'+scope("    case 'finn-picnic-ride':","    case 'ack-neighbor':")+'}}')
function arrivedAfterPicnic(){
  const p=commissionPlayer(JSON.parse(read('./fixtures/market-order-selection-commands.json')))
  p.act('selectSeed','wheat');p.act('workBed',0)
  for(let i=0;i<5&&getBedStage(p.state.beds[0])!=='ripe';i++){
    if(getBedAction(p.state,0).kind==='water'){if(!p.state.water)p.act('refillWater');p.act('workBed',0)}
    p.night()
  }
  p.act('workBed',0);p.act('bakeWorkshop','round');p.visit('village')
  p.act('joinNeighborPlan','finn:1');p.act('serveNeighborPlan','finn:1','handmade:round')
  p.act('finishNeighborPlan','finn:1',{kind:'basket',settled:true,placements:[
    {slot:'food',x:0,y:0},{slot:'cup',x:.4,y:.2},{slot:'flowers',x:-.4,y:.2}]})
  assert.equal(p.state.day,17)
  assert.deepEqual([p.state.neighbors.bea.completed,p.state.neighbors.finn.completed],[1,1])
  assert.equal(getNeighborPlans(p.state).find(x=>x.resident==='finn')?.phase,'celebrating')
  return p
}
type Resident='bea'|'finn'
function room(farm:FarmState,resident:Resident,mode?:'canceled'|'changed-target'|'next-day'|'late-undertook-visit'){
  const calls:string[]=[], history=[{panel:'guide'}], dlg={open:true}, headings=new Map<string,unknown>()
  const localControl={}
  const communityResume={}
  const dialogContent={innerHTML:'',scrollTop:0,contains(control:unknown){return control===localControl},querySelector(selector:string){
    if (selector==='.community-neighbor[data-phase="celebrating"] [data-action="ack-neighbor"]'
      && this.innerHTML.includes('data-phase="celebrating"') && this.innerHTML.includes('data-action="ack-neighbor"')) {
      const owner=this
      return {insertAdjacentHTML(where:string,html:string){
        assert.equal(where,'beforebegin')
        owner.innerHTML=owner.innerHTML.replace(/<button\b(?=[^>]*data-action="ack-neighbor")[^>]*>/,tag=>html+tag)
      }}
    }
    const id=/^\[data-visit-resident="(bea|finn)"\]$/.exec(selector)?.[1]
    return id?headings.get(id)??null:null
  }}
  const ctx={farm,dialog:dlg,dialogContent,panel:'neighbor',panelHistory:history,communityResident:resident,communityArt:{icon:()=>'',offerIcon:()=>''},
    communityRequest:undefined,requestedFood:undefined,value:undefined as string|undefined,
    canSailTo,sail,canInviteNeighbor,finnPicnicRide,sailHomeWithFinn,freshFinnRide:undefined as string|undefined,communityResume,
    updateCommunityReturn(){},canvas:{focus(){}},fieldViewButton:{getAttribute:()=> 'false'},
    icon:()=>'',numberFormat:new Intl.NumberFormat('ru'),nav:(...items:string[])=>items.join(''),neighborDetail,
    rememberPanel:()=>({panel:ctx.panel}),
    closeDialog(){calls.push('close');history.length=0;dlg.open=false;ctx.panel=''},
    island:{isCrossing:()=>false,focusTarget(t:{kind:string}){calls.push(t.kind)},async crossIsland(done:()=>boolean,passenger?:'finn'){
      calls.push(passenger ? 'cross:'+passenger : 'cross')
      if(mode==='canceled')return
      assert.ok(done())
      if(mode==='changed-target')ctx.communityResident=resident==='finn'?'bea':'finn'
      if(mode==='late-undertook-visit')assert.ok(inviteNeighborVisit(farm,'beaFlock').ok)
      if(mode==='next-day')assert.ok(endDay(farm).ok)
    }},
    perform(work:()=>{ok:boolean}){return work().ok},
    openPanel(panel:string,remember=true){
      if(remember)history.push({panel:ctx.panel})
      ctx.panel=panel;dlg.open=true;dialogContent.scrollTop=0;calls.push(panel)
      const html=renderNeighborVisits(farm,()=> '')
      dialogContent.innerHTML=html
      for(const [,id] of html.matchAll(/<h2[^>]* data-visit-resident="(bea|finn)"/g))
        headings.set(id,{focus(options:{preventScroll:boolean}){assert.equal(options.preventScroll,true);calls.push(`focus:${id}`)},
          scrollIntoView(){calls.push(`scroll:${id}`)}})
    }
  }
  runInNewContext(dispatch,ctx)
  return {state:ctx,browser:ctx as typeof ctx&{drawNeighbor():void;bookHome():Promise<void>;rideHome(control:object,value:string):Promise<void>},calls,history,localControl}
}
const attendee=(card:string)=>card.match(/<button\b[^>]*data-action="visit-book-home"[^>]*>/)?.[0]
const ownedValue=(tag:string)=>tag.match(/data-value="([^"]*)"/)?.[1]
const liveInvitations=(book:string)=>[...book.matchAll(/<button[^>]*data-action="visit-invite"[^>]*>/g)].filter(([tag])=>!tag.includes(' disabled'))
const restored=(farm:FarmState)=>restoreCurrentFarm(JSON.parse(JSON.stringify(farm)))!

test('the earned Finn basket gives a direct home arrival to Finn without starting a second visit',async t=>{
  const p=arrivedAfterPicnic(),farm=p.state,saved=structuredClone(farm),a=room(farm,'finn')
  a.browser.drawNeighbor()
  const visible=attendee(a.state.dialogContent.innerHTML);assert.ok(visible)
  a.state.value=ownedValue(visible)
  await a.browser.bookHome()
  const home=a.state.dialogContent.innerHTML
  const beforeFinn=home.split('>Финн</h2>')[0]
  const otherButtons=liveInvitations(beforeFinn).filter(([tag])=>tag.includes('data-value="bea')).length
  t.diagnostic(JSON.stringify({day:farm.day,actions:p.actions,originalResident:'finn',taggedResident:a.state.value??null,otherInviteButtonsAbove:otherButtons,arrival:a.calls}))
  assert.equal(a.state.value,'finn')
  assert.deepEqual(a.calls,['close','cross','neighbor-visits','scroll:finn','focus:finn'])
  assert.ok(canInviteNeighbor(farm,'bea')&&canInviteNeighbor(farm,'finn'))
  assert.equal(liveInvitations(home).length,6)
  assert.deepEqual(a.history,[{panel:'guide'}],'never stack an implicit sail back to the resident')
  assert.deepEqual(farm,{...saved,island:'home'})
  assert.equal(farm.neighborVisits.active,null)
  assert.ok(inviteNeighborVisit(farm,'finnOrchard').ok)
  assert.equal(farm.neighborVisits.active?.activity,'finnOrchard')
  assert.deepEqual(restored(farm),farm)
})
test('unqualified/retired entries never gain a resident-specific arrival, generic book still works',async()=>{
  const p=arrivedAfterPicnic()
  for(const mode of ['generic','wrong-source','canceled','changed-target','next-day','late-undertook-visit'] as const){
    const farm=restored(p.state),a=room(farm,'finn',mode==='generic'||mode==='wrong-source'?undefined:mode)
    a.state.value=mode==='generic'?'':mode==='wrong-source'?'bea':'finn'
    await a.browser.bookHome()
    assert.ok(!a.calls.some(x=>x.startsWith('focus:')||x.startsWith('scroll:')))
    if(mode==='generic')assert.deepEqual(a.calls,['close','cross','neighbor-visits'])
    if(mode==='wrong-source')assert.deepEqual(a.calls,[])
    if(mode==='canceled')assert.deepEqual(a.calls,['close','cross'])
    if(mode==='next-day')assert.equal(farm.day,p.state.day+1)
    if(mode==='late-undertook-visit')assert.equal(farm.neighborVisits.active?.activity,'beaFlock')
    else assert.equal(farm.neighborVisits.active,null)
  }
})

test('an already local valid resident card lands at the same choice without sailing',async()=>{
  const p=arrivedAfterPicnic(),farm=restored(p.state)
  assert.ok(sail(farm,'home').ok)
  const home=structuredClone(farm),a=room(farm,'finn')
  a.browser.drawNeighbor()
  const action=attendee(a.state.dialogContent.innerHTML);assert.ok(action)
  a.state.value=ownedValue(action)
  await a.browser.bookHome()
  assert.deepEqual(a.calls,['neighbor-visits','scroll:finn','focus:finn'])
  assert.deepEqual(farm,home)
})

test('same-day cold Finn celebration preserves one explicit shared ride without taking over the ordinary guest book',async()=>{
  const p=arrivedAfterPicnic(), paid=p.state
  const entries=new Map([[farmSaveKeys.primary,JSON.stringify(paid)]])
  const storage={getItem:(key:string)=>entries.get(key)??null,setItem:(key:string,value:string)=>{entries.set(key,value)}}
  const reopen=()=>new VersionedSave(()=>storage,farmSaveKeys,restoreCurrentFarm,()=>assert.fail('expected earned paid farm'),async run=>run()).load()
  const farm=(await reopen())!
  assert.ok(JSON.stringify(farm)===JSON.stringify(paid),'cold open must keep the settled farm')
  const still=structuredClone(farm),a=room(farm,'finn')
  const ride=(html:string)=>html.match(/<button\b[^>]*data-action="finn-picnic-ride"[^>]*>/)?.[0]
  a.browser.drawNeighbor()
  const button=ride(a.state.dialogContent.innerHTML)
  assert.ok(button,'still eligible after exact cold reload')
  const token=ownedValue(button)
  assert.equal(token,'finn:1:17')
  assert.match(a.state.dialogContent.innerHTML,/Домой с Финном/)
  assert.ok(a.state.dialogContent.innerHTML.indexOf('finn-picnic-ride')<a.state.dialogContent.innerHTML.indexOf('ack-neighbor'))
  assert.ok(attendee(a.state.dialogContent.innerHTML),'solo guest-book choices remain available')
  assert.equal(a.state.freshFinnRide,undefined)
  assert.deepEqual(farm,still)
  assert.deepEqual(a.calls,[])

  // A foreign control cannot use the real token; a real local control can.
  await a.browser.rideHome({},token!)
  assert.deepEqual(a.calls,[]);assert.deepEqual(farm,still)
  await a.browser.rideHome(a.localControl,token!)
  assert.deepEqual(a.calls,['close','boat','cross:finn'])
  assert.deepEqual([farm.island,farm.day,farm.coins,farm.fruit.apple,farm.neighborVisits.active?.activity,farm.neighborVisits.memories.length],
    ['home',17,131,still.fruit.apple,'finnOrchard',0])
  const arrived=structuredClone(farm)
  await a.browser.rideHome(a.localControl,token!);assert.deepEqual(farm,arrived)
  const back=structuredClone(farm)
  assert.ok(sail(back,'village').ok)
  assert.equal(back.neighborVisits.active,null)
  assert.equal(back.trees.home[0]?.fruitReady,2,'verify forfeited fresh ride, not depleted fruit')
  assert.equal(getNeighborPlans(back).find(plan=>plan.id==='finn:1')?.phase,'remembered')
  assert.equal(finnPicnicRide(back),undefined,'taking the special boat ride already acknowledged this same celebration')
  const sameDay=room(back,'finn')
  sameDay.browser.drawNeighbor()
  assert.equal(ride(sameDay.state.dialogContent.innerHTML),undefined)
  await sameDay.browser.rideHome(sameDay.localControl,token!)
  assert.deepEqual(sameDay.calls,[])
  assert.equal(pickFruit(farm,0).ok,true)
  assert.equal(farm.neighborVisits.memories[0]?.activity,'finnOrchard')

  const solo=(await reopen())!,manual=room(solo,'finn')
  manual.browser.drawNeighbor()
  manual.state.value='finn'
  await manual.browser.bookHome()
  assert.deepEqual(manual.calls,['close','cross','neighbor-visits','scroll:finn','focus:finn'])
  assert.equal(solo.neighborVisits.active,null)
  assert.ok(inviteNeighborVisit(solo,'finnOrchard').ok)
  assert.ok(pickFruit(solo,0).ok)
  assert.deepEqual([solo.fruit.apple,solo.coins,solo.neighborVisits.memories[0].activity],
    [farm.fruit.apple,farm.coins,'finnOrchard'])

  for(const situation of ['farewell','next-plan','offshore','other-resident'] as const) {
    const old=(await reopen())!
    if(situation==='farewell')assert.ok(advanceNeighborPlan(old,'finn:1').ok)
    if(situation==='offshore')assert.ok(sail(old,'home').ok)
    if(situation==='next-plan'){
      assert.ok(sail(old,'home').ok);assert.ok(endDay(old).ok);assert.ok(sail(old,'village').ok)
      assert.equal(finnPicnicRide(old),undefined,'expired overnight, even before saying farewell')
      assert.ok(advanceNeighborPlan(old,'finn:1').ok)
      assert.ok(getNeighborPlans(old).some(plan=>plan.id==='finn:2'))
    }
    const view=room(old,situation==='other-resident'?'bea':'finn')
    view.browser.drawNeighbor();assert.equal(ride(view.state.dialogContent.innerHTML),undefined)
    const frozen=structuredClone(old)
    await view.browser.rideHome(view.localControl,token!)
    assert.deepEqual(old,frozen);assert.deepEqual(view.calls,[])
  }
})
