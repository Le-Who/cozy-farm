import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { runInNewContext } from 'node:vm'
import { commissionPlayer } from './fixtures/commission-player.ts'
import * as F from '../src/farm.ts'
import { finishNeighborVisit, getActiveVisitMemory, inviteNeighborVisit, visitActivities } from '../src/neighbor-visits.ts'
import { renderNeighborVisits } from '../src/neighbor-visits-ui.ts'
import { isGuardedAction } from '../src/action-click-guard.ts'
import { finnPicnicRide } from '../src/finn-picnic-ride.ts'
import { guideHomeVisitor, stepHomeVisitor, syncHomeVisitor } from '../src/neighbor-visit-scene.ts'

const read = (file:string) => readFileSync(new URL(file, import.meta.url), 'utf8')
const opening = JSON.parse(read('./fixtures/market-order-selection-commands.json'))
const main = read('../src/main.ts'), islandSource = read('../src/island.ts'), layout = read('../src/lavender-layout.ts')
const buttons = (html: string, name: string) => [...html.matchAll(new RegExp('<button[^>]*data-action="' + name + '"[^>]*>[^<]*</button>', 'g'))].map(m=>m[0])
const token = (button: string) => button.match(/data-value="([^"]+)"/)?.[1]
const json = <T,>(data: T):T => JSON.parse(JSON.stringify(data))
const panel = (farm:F.FarmState) => renderNeighborVisits(farm, ()=>'')
const economy = ({ neighborVisits: _book, ...all }:F.FarmState) => all

function earnedOpening() {
  const p=commissionPlayer(opening)
  p.act('selectSeed','wheat'); p.act('workBed',0)
  for(let i=0;i<5&&F.getBedStage(p.state.beds[0])!=='ripe';i++) {
    if(F.getBedAction(p.state,0).kind==='water') {
      if(!p.state.water)p.act('refillWater')
      p.act('workBed',0)
    }
    p.night()
  }
  p.act('workBed',0); p.act('bakeWorkshop','round')
  assert.deepEqual([p.state.day,p.state.island,p.state.coins,p.state.trees.home[0]], [17,'home',99,{tree:'apple',age:2,fruitReady:2}])
  assert.deepEqual(p.state.village.residents, ['bea','finn'])
  return p
}

function sellAppleCrop(p:ReturnType<typeof earnedOpening>) {
  const before=p.state.coins, stock=p.state.fruit.apple
  p.act('pickFruit',0)
  assert.equal(p.state.fruit.apple, stock+2)
  const items=[{key:'fruit:apple',quantity:2}], quote=F.getMarketBasket(p.state,items)!
  assert.equal(quote.total,8)
  p.act('sellMarketBasket',items,quote.token)
  assert.equal(p.state.coins-before,8)
  assert.equal(p.state.fruit.apple,stock)
}

function completeFinnPicnic(p:ReturnType<typeof earnedOpening>) {
  p.visit('village')
  p.act('joinNeighborPlan','finn:1')
  p.act('serveNeighborPlan','finn:1','handmade:round')
  const before=p.state.coins
  assert.equal(F.getNeighborPlans(p.state).find(p=>p.id==='finn:1')?.reward,32)
  p.act('finishNeighborPlan','finn:1',{kind:'basket',settled:true,placements:[
    {slot:'food',x:0,y:0},{slot:'cup',x:.4,y:.2},{slot:'flowers',x:-.4,y:.2}]})
  assert.equal(p.state.coins-before,32)
  const ride=!!finnPicnicRide(p.state)
  p.visit('home')
  return ride
}

function invite(p: ReturnType<typeof earnedOpening>) {
  assert.ok(inviteNeighborVisit(p.state,'finnOrchard').ok)
  p.reload()
  assert.equal(p.state.neighborVisits.active?.observation,null)
}

function previewTree(farm:F.FarmState,treeSlot:number,delegates:object) {
  const pos=main.indexOf("    case 'tree': {"), end=main.indexOf("    case 'upgrades':",pos)
  assert.ok(pos>=0&&end>pos)
  const content={innerHTML:''}, title={textContent:'',setAttribute:()=>{}}
  const ribbon=stripTypeScriptTypes("switch('tree'){"+main.slice(pos,end)+"}")
  runInNewContext(ribbon,{farm,treeSlot,dialogContent:content,dialogTitle:title,dialogEmblem:{src:''},
    getTreeAction:F.getTreeAction,treeDefinitions:F.treeDefinitions,treeNightsToFruit:F.treeNightsToFruit,
    treeSelector:()=>'',icon:()=>'',iconUrl:()=>'',treeVariantCopy:()=>'',panelHistory:[],
    quantity:(n:number)=>String(n),nav:(html:string)=>html,
    button:(label:string,action:string,enabled:boolean,props?:{value?:string})=>`<button data-action="${action}" data-value="${props?.value??''}"${enabled?'':' disabled'}>${label}</button>`,
    ...delegates})
  return {html:content.innerHTML,title:title.textContent}
}

function dispatch(action:string,value:string|undefined,farm:F.FarmState,opts: {panel:string,treeSlot?:number,dialogOpen?:boolean},delegates:object) {
  const start=main.indexOf("    case '"+action+"': {")
  const end=main.indexOf("\n    case '",start+10)
  assert.ok(start>=0&&end>start)
  const calls:unknown[][]=[],control={}, dialog={open:opts.dialogOpen??true}
  runInNewContext(stripTypeScriptTypes("switch(action){"+main.slice(start,end)+"}"),{
    action,value,farm,control,panel:opts.panel,treeSlot:opts.treeSlot,dialog,visitActivities,getBedStage:F.getBedStage,
    closeDialog:()=>{dialog.open=false;calls.push(['close'])},drawPanel:()=>calls.push(['redraw']),
    notify:(msg:string)=>calls.push(['notice',msg]),fieldViewButton:{getAttribute:()=> 'false'},
    dialogContent:{contains:(el:object)=>el===control},
    perform:(work:()=>F.ActionResult)=>{const receipt=work(); if(receipt.ok)calls.push(['save']);return receipt.ok},
    island:{isCrossing:()=>false,focusTarget:(target:unknown)=>calls.push(['focus',json(target)]),
      guideHomeVisitorToTree:(index:number)=>calls.push(['guide',index])}, ...delegates,
  })
  return {calls,dialogOpen:dialog.open}
}

test('Finn can see the same real Home tree when the Day17 sale happens before his visit, without another harvest',async()=>{
  const a=earnedOpening(), b=earnedOpening()
  assert.deepEqual(a.state,b.state)
  sellAppleCrop(a)
  assert.equal(completeFinnPicnic(a),false)  // optional ride is still unavailable once today's fruit is picked
  const invitation=panel(a.state)
  invite(a)
  const beforeA=structuredClone(a.state)
  const route=buttons(panel(a.state),'visit-find-tree')
  assert.equal(route.length,1,'the mature Home tree should remain an intentional destination after selling its fruit')
  assert.match(invitation,/Можно показать: яблоня\./)
  assert.match(route[0],/>К дереву<\/button>$/); assert.doesNotMatch(route[0],/disabled/)
  assert.equal(buttons(panel(a.state),'visit-do').length,0)
  assert.equal(getActiveVisitMemory(a.state),undefined)
  assert.deepEqual(a.state,beforeA)

  assert.ok(isGuardedAction('visit-find-tree')); assert.ok(isGuardedAction('visit-show-tree'))
  const delegates=await import('../src/standing-tree-visit.ts')
  assert.deepEqual(dispatch('visit-find-tree',token(route[0]),a.state,{panel:'neighbor-visits'},delegates),
    {calls:[['close'],['focus',{kind:'tree',index:0}]],dialogOpen:false})
  assert.deepEqual(a.state,beforeA)
  const local=previewTree(a.state,0,delegates)
  assert.equal(local.title,'Яблоня'); assert.equal(buttons(local.html,'pick-fruit').length,0)
  const choice=buttons(local.html,'visit-show-tree')
  assert.equal(choice.length,1); assert.match(choice[0],/>Показать Финну<\/button>$/)
  assert.deepEqual(a.state,beforeA,'focusing or opening the actual tree only reads the save')
  assert.deepEqual(dispatch('visit-show-tree',token(choice[0]),a.state,{panel:'neighbor-visits',treeSlot:0},delegates).calls,[])
  assert.deepEqual(dispatch('visit-show-tree',token(choice[0]),a.state,{panel:'tree',treeSlot:2},delegates).calls,[])
  assert.deepEqual(dispatch('visit-show-tree',token(choice[0]),a.state,{panel:'tree',treeSlot:0,dialogOpen:false},delegates).calls,[])
  assert.deepEqual(a.state,beforeA)
  assert.deepEqual(dispatch('visit-show-tree',token(choice[0]),a.state,{panel:'tree',treeSlot:0},delegates),
    {calls:[['close'],['save'],['guide',0],['focus',{kind:'tree',index:0}]],dialogOpen:false})
  const aResult=structuredClone(a.state), memory=getActiveVisitMemory(aResult)!
  assert.equal(memory.subject,'Яблоня'); assert.match(memory.detail,/Плоды не собирали/)
  assert.deepEqual(economy(aResult),economy(beforeA))
  assert.equal(buttons(previewTree(a.state,0,delegates).html,'visit-show-tree').length,0)
  assert.equal(buttons(panel(a.state),'visit-reply').length,2)
  dispatch('visit-show-tree',token(choice[0]),a.state,{panel:'tree',treeSlot:0},delegates)
  assert.deepEqual(a.state,aResult); a.reload(); assert.deepEqual(a.state,aResult)

  assert.equal(completeFinnPicnic(b),true)
  invite(b)
  const beforeB=structuredClone(b.state), ripe=buttons(panel(b.state),'visit-do')
  assert.equal(ripe.length,1); assert.match(ripe[0],/>К дереву<\/button>$/)
  assert.equal(buttons(panel(b.state),'visit-find-tree').length,0)
  assert.equal(buttons(previewTree(b.state,0,delegates).html,'visit-show-tree').length,0)
  assert.equal(buttons(previewTree(b.state,0,delegates).html,'pick-fruit').length,1)
  assert.deepEqual(dispatch('visit-do',token(ripe[0]),b.state,{panel:'neighbor-visits'},delegates),
    {calls:[['close'],['focus',{kind:'tree',index:0}]],dialogOpen:false})
  assert.deepEqual(b.state,beforeB)
  sellAppleCrop(b)
  assert.equal(getActiveVisitMemory(b.state)?.detail,'Спелые плоды домашнего дерева.')
  assert.equal(a.state.neighborVisits.memories.length,1); assert.equal(b.state.neighborVisits.memories.length,1)
  assert.equal(a.state.coins,139); assert.equal(b.state.coins,139)
  assert.deepEqual(economy(a.state),economy(b.state))
})

test('old tokens cannot promise another site, a stored tree, a sapling, a later visit or a harvest elsewhere',async()=>{
  const delegates=await import('../src/standing-tree-visit.ts')
  const p=earnedOpening(); sellAppleCrop(p); completeFinnPicnic(p); invite(p)
  const f=p.state, original=delegates.standingVisitTree(f)!, baseline=structuredClone(f)
  assert.equal(original.index,0); assert.equal(original.tree,'apple')
  const missing=structuredClone(baseline)
  assert.ok(F.storeTree(missing,0).ok)
  const orchardQuote=F.getFruitTreeSeed(missing,1,'apple')
  if(orchardQuote) assert.ok(F.plantFruitTreeSeed(missing,1,orchardQuote.token).ok)
  else assert.ok(F.buyAndPlantTree(missing,1,'apple').ok)
  assert.ok(missing.trees.grove.some(t=>t&&t.fruitReady>0))
  assert.equal(delegates.standingVisitTree(missing),undefined)
  assert.match(buttons(panel(missing),'visit-do')[0],/disabled>Нет спелых плодов/)
  assert.deepEqual(dispatch('visit-find-tree', original.token,missing,{panel:'neighbor-visits'},delegates).calls,[['redraw']])
  assert.ok(F.returnNurseryTree(missing,2,missing.treeNursery[0].id).ok)
  assert.equal(delegates.standingVisitTree(missing)?.index,2)
  assert.doesNotMatch(buttons(panel(missing),'visit-find-tree')[0],/disabled/)

  const foreign=structuredClone(baseline)
  assert.ok(F.sail(foreign,'grove').ok); assert.equal(foreign.neighborVisits.active,null)
  const tomorrow=structuredClone(baseline)
  assert.ok(F.endDay(tomorrow).ok)
  assert.ok(inviteNeighborVisit(tomorrow,'finnOrchard').ok)
  assert.ok(tomorrow.trees.home[0]!.fruitReady>0)
  const nextVisit=structuredClone(baseline)
  assert.ok(finishNeighborVisit(nextVisit,nextVisit.neighborVisits.serial).ok)
  assert.ok(inviteNeighborVisit(nextVisit,'finnOrchard').ok)
  assert.notEqual(delegates.standingVisitTree(nextVisit)?.token,original.token)

  const legacyDormant=structuredClone(baseline)
  // Negative only: compatibility witness with an empty mature tree and no completed fruit discovery.
  delete legacyDormant.discoveries.apple
  assert.ok(F.restoreCurrentFarm(json(legacyDormant)))
  assert.equal(delegates.standingVisitTree(legacyDormant),undefined)
  const noBook=structuredClone(baseline)
  assert.ok(finishNeighborVisit(noBook,noBook.neighborVisits.serial).ok)
  for(const state of [missing,foreign,tomorrow,nextVisit,legacyDormant,noBook]){
    const unchanged=structuredClone(state)
    assert.equal(delegates.showStandingVisitTree(state,original.token).ok,false)
    assert.deepEqual(state,unchanged)
  }
})

test('the chosen orchard action uses the existing tree stop and walkable aisle for the live same-day visitor',async()=>{
  const delegates=await import('../src/standing-tree-visit.ts')
  const p=earnedOpening(); sellAppleCrop(p); completeFinnPicnic(p); invite(p)
  const f=p.state, spot=delegates.standingVisitTree(f)!
  const coords=layout.slice(layout.indexOf('const origin ='),layout.indexOf('function sceneBox')).replaceAll('export ','')
  const orchard=layout.slice(layout.indexOf('export const orchard ='),layout.indexOf('export const docks =')).replace('export ','')
  const native=islandSource.slice(islandSource.indexOf('const sceneOrigin='),islandSource.indexOf('const WORK_MS'))
  const method=islandSource.slice(islandSource.indexOf('    guideHomeVisitorToTree('),islandSource.indexOf('    henWalkAvailable()'))
  const actor=syncHomeVisitor(undefined,f)!
  const sameTarget=islandSource.slice(islandSource.indexOf('function sameTarget('),islandSource.indexOf('function random('))
  const areas=islandSource.slice(islandSource.indexOf('function orchardAreas('),islandSource.indexOf('const homeSites ='))
  const world=runInNewContext(stripTypeScriptTypes(coords+orchard+native+sameTarget+areas+`
    const currentSites=()=>orchardAreas('home');
    const contact=currentSites().find(site=>sameTarget(site.target,{kind:'tree',index:0})).stop;
    ({${method} contact,nativeHenPoint})`),{
    grove:{treeSpots:[]},mapped:()=>null,state:f,homeVisitor:actor,guideHomeVisitor,
    docks:{home:{entry:{x:0,y:0},end:{x:0,y:0},boat:{x:0,y:0}}},
  })
  const initialRoute=json(actor.route)
  assert.equal(delegates.showStandingVisitTree(f,spot.token).ok,true)
  world.guideHomeVisitorToTree(spot.index)
  assert.notDeepEqual(json(actor.route),initialRoute)
  for(let i=0;i<1000&&actor.route.length;i++)stepHomeVisitor(actor,.05,false)
  assert.equal(actor.route.length,0)
  assert.deepEqual(actor.point,json(world.nativeHenPoint({x:world.contact.x-15,y:world.contact.y})))
  const before=structuredClone(actor)
  assert.ok(finishNeighborVisit(f,f.neighborVisits.serial).ok)
  world.guideHomeVisitorToTree(0)
  assert.deepEqual(actor,before)
})
