import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'
import * as F from '../src/farm.ts'
import { getRequirementHint, type Requirement } from '../src/requirement-guidance.ts'
import { commissionPlayer } from './fixtures/commission-player.ts'

const opening = JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json', import.meta.url), 'utf8'))
const step = (name: string,...args:unknown[]) => ({ name,args })
const wrap = (f:F.FarmState) => {
  const restored=F.restoreCurrentFarm(JSON.parse(JSON.stringify(f)))
  assert.deepEqual(restored,f)
  return restored!
}
const askWind = {kind:'stock',item:{kind:'windHoney',quantity:1}} as const
const order = (farm:F.FarmState) => F.getMarketOrders(farm).find(order=>order.lane==='cape')!
const actualSource = readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
const a=actualSource.indexOf('async function showRequirement(')
const b=actualSource.indexOf('// Scene handlers own material sounds',a)
assert.ok(a>=0&&b>a,'run the common requirement controller, not a duplicate')
const controller = stripTypeScriptTypes(actualSource.slice(a,b)+'\nshowRequirement')

function firstCapeOrder() {
  // Sow and tend one ordinary plot using the same first-week progression; no state grants.
  const p = commissionPlayer([
    ...opening.slice(0,40),step('selectSeed','wheat'),step('workBed',0,0),step('workBed',0,0),
    ...opening.slice(40,51),step('workBed',0,0),...opening.slice(51,58),
    step('workBed',0,0),step('collectEggs'),
  ])
  assert.deepEqual([p.state.day,p.actions,p.state.island,p.state.coins,p.state.produce.wheat,p.state.honey],[6,64,'home',120,3,3])
  p.act('cookDish','honeyCake',{family:'honeyCake',fruit:[],steps:['mix','bake','glaze'],baking:{method:'oven',finish:'golden',seconds:180}})
  assert.equal(order(p.state).name,'Чай на Цветочном мысе')
  p.act('deliverMarketOrder','cape')
  assert.equal(p.state.coins,148)
  p.night()
  assert.equal(order(p.state).name,'Дегустация ветреного мёда')
  assert.equal(order(p.state).status,'waiting')
  return p
}

async function follow(farm:F.FarmState,request:Requirement) {
  const crossings:F.IslandId[]=[], focus:string[]=[]
  const feedback={hidden:true,textContent:'',dataset:{} as Record<string,string>,classList:{remove(){}}}
  let saves=0
  const ctx={
    farm,getRequirementHint,canSailTo:F.canSailTo,islandIds:F.islandIds,sail:F.sail,dialog:{open:true},
    panel:'market',fieldViewButton:{getAttribute:()=> 'false'},panelTitles:{hive:'Улей',rest:'Отдых'},
    closeDialog(){ctx.dialog.open=false},
    island:{async crossIsland(move:()=>boolean){assert.ok(move());crossings.push(farm.island)}},
    perform(step:()=>F.ActionResult){const result=step();if(result.ok)saves++;return result.ok},
    openPanel(panel:string){ctx.panel=panel;ctx.dialog.open=true},
    dialogContent:{querySelector(selector:string){return selector}},
    highlightControl(selector:string){focus.push(selector)},
    dialogFeedback:feedback,dialogFeedbackTimer:0,window:{clearTimeout(){}},notify(){},
  }
  const run=runInNewContext(controller,ctx) as (x:Requirement)=>Promise<void>
  await run(request)
  return {crossings,saves,feedback,focus,panel:ctx.panel}
}

test('the earned D7 wind-honey market order shows the same forecast at home, with no automatic sleep, collection or hand-in', async()=>{
  const p=firstCapeOrder(), farm=wrap(p.state), untouched=structuredClone(farm)
  const result=await follow(farm,askWind)
  assert.deepEqual([result.crossings,result.panel,result.saves],[[],'rest',0])
  assert.match(result.feedback.textContent,/игровой день 8, через 1 ночь/)
  assert.equal(result.feedback.hidden,false)
  assert.ok(!result.focus.some(x=>x.includes('sleep')),'do not focus or dispatch the irreversible sleep button')
  assert.deepEqual(farm,untouched)
  assert.deepEqual(wrap(farm),untouched)
  assert.equal(order(farm).status,'waiting')

  p.night()
  const tomorrow=wrap(p.state)
  const eligible=await follow(tomorrow,askWind)
  assert.deepEqual([eligible.crossings,eligible.panel,tomorrow.windHoney],[['cape'],'hive',0])
  assert.equal(F.collectCapeHoney(tomorrow).ok,true)
  assert.equal(tomorrow.windHoney,1)
  assert.equal(F.sail(tomorrow,'home').ok,true)
  assert.equal(order(tomorrow).status,'ready')
  const coins=tomorrow.coins
  assert.equal(F.deliverMarketOrder(tomorrow,'cape').ok,true)
  assert.equal(tomorrow.coins,coins+26)
  assert.equal(tomorrow.windHoney,0)
  assert.equal(F.deliverMarketOrder(tomorrow,'cape').ok,false)
  assert.equal(tomorrow.coins,coins+26)
})

test('after the genuine D8 harvest and sale, the still-waiting order never sends the player to an empty hive', async()=>{
  const p=firstCapeOrder()
  p.night();p.visit('cape');p.act('collectCapeHoney');p.visit('home')
  assert.equal(order(p.state).status,'ready')
  p.act('sellMarketItem','windHoney',1)
  const farm=wrap(p.state), untouched=structuredClone(farm)
  assert.equal(order(farm).status,'waiting')
  const result=await follow(farm,askWind)
  assert.deepEqual([result.crossings,result.panel,result.saves],[[],'rest',0])
  assert.match(result.feedback.textContent,/мёд уже собран\..*игровой день 13/)
  assert.deepEqual(farm,untouched)
  assert.deepEqual(wrap(farm),untouched)
})

test('a useful current source, ordinary honey, a different request and an optional manual visit still use their own routes',()=>{
  const p=firstCapeOrder(), home=p.state
  const moreWind={kind:'stock',item:{kind:'windHoney',quantity:2}} as const
  assert.equal(getRequirementHint(home,moreWind).action.value,'cape')
  assert.equal(getRequirementHint(home,{kind:'stock',item:{kind:'honey',quantity:home.honey+1}}).action.value,'cape')
  p.visit('cape')
  assert.equal(getRequirementHint(p.state,askWind).action.value,'hive')
  assert.deepEqual([F.getCapeHoney(p.state).honey,F.getCapeHoney(p.state).windHoney],[3,0])
  const before=p.state.honey
  p.act('collectCapeHoney')
  assert.equal(p.state.honey,before+3)

  const untouchedCape=commissionPlayer(opening.slice(0,29))
  untouchedCape.visit('home')
  assert.equal(F.canSailTo(untouchedCape.state,'cape'),true)
  assert.equal(getRequirementHint(untouchedCape.state,askWind).action.value,'cape')
  untouchedCape.visit('cape')
  assert.deepEqual(untouchedCape.state.capeFlowers,[null,null,null])
  assert.equal(getRequirementHint(untouchedCape.state,askWind).action.target,'focus-flower')

  const earned=firstCapeOrder()
  earned.night();earned.visit('cape');earned.act('collectCapeHoney');earned.visit('home')
  assert.equal(order(earned.state).status,'ready')
  assert.notEqual(getRequirementHint(earned.state,askWind).action.value,'rest')
  earned.act('deliverMarketOrder','cape')
  assert.equal(order(earned.state).status,'delivered')
  assert.notEqual(getRequirementHint(earned.state,askWind).action.value,'rest')
})
