import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'
import { canSailTo, endDay, getBedAction, getBedStage, getNeighborPlans, sail, restoreCurrentFarm, type FarmState } from '../src/farm.ts'
import { canInviteNeighbor, inviteNeighborVisit } from '../src/neighbor-visits.ts'
import { renderNeighborVisits } from '../src/neighbor-visits-ui.ts'
import { commissionPlayer } from './fixtures/commission-player.ts'

const read=(p:string)=>readFileSync(new URL(p,import.meta.url),'utf8')
const main=read('../src/main.ts')
const scope=(a:string,b:string)=>{const i=main.indexOf(a),j=main.indexOf(b,i+a.length);assert.ok(i>=0&&j>i);return main.slice(i,j)}
const visit=scope('async function visitPanelAt(', 'function openGuidedMarket(')
const button=scope('function button(label:', 'function quantity(')
const neighborView=scope("    case 'neighbor': dialogContent.innerHTML", "    case 'request-food':")
const dispatch=stripTypeScriptTypes(visit+button+
  '\nfunction drawNeighbor(){switch("neighbor"){'+neighborView+
  '}};async function bookHome(){switch("visit-book-home"){'+scope("    case 'visit-book-home':","    case 'visit-invite':")+'}}')
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
  const dialogContent={innerHTML:'',scrollTop:0,querySelector(selector:string){
    const id=/^\[data-visit-resident="(bea|finn)"\]$/.exec(selector)?.[1]
    return id?headings.get(id)??null:null
  }}
  const ctx={farm,dialog:dlg,dialogContent,panel:'neighbor',panelHistory:history,communityResident:resident,communityArt:{},value:undefined as string|undefined,
    canSailTo,sail,canInviteNeighbor,fieldViewButton:{getAttribute:()=> 'false'},
    icon:()=>'',numberFormat:new Intl.NumberFormat('ru'),nav:(x:string)=>x,neighborDetail:()=>'',
    rememberPanel:()=>({panel:ctx.panel}),
    closeDialog(){calls.push('close');history.length=0;dlg.open=false;ctx.panel=''},
    island:{isCrossing:()=>false,async crossIsland(done:()=>boolean){
      calls.push('cross')
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
  return {state:ctx,browser:ctx as typeof ctx&{drawNeighbor():void;bookHome():Promise<void>},calls,history}
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
