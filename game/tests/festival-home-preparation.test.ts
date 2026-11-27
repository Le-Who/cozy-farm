import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'
import * as F from '../src/farm.ts'
import { getDiscoveryTask } from '../src/discovery-path.ts'
import { ruCount } from '../src/ru.ts'
import { firstCommissionReturnPlayer } from './fixtures/harbour-craft-return.ts'

const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
const view=readFileSync(new URL('../src/bay-festival-ui.ts',import.meta.url),'utf8')
function part(source:string,first:string,last:string){
  const i=source.indexOf(first),j=source.indexOf(last,i+first.length)
  assert.ok(i>=0&&j>i,first);return source.slice(i,j)
}
const readOnly=part(view,'function nextPreparationPreview','export function renderFestivalPanel').replace(/^export /gm,'')
const render=(farm:F.FarmState):string=>runInNewContext(
  stripTypeScriptTypes(part(view,'const escape =','const artRoot')+readOnly+';renderHomeFestivalPreparation(farm)'),
  {farm,getFestivalStatus:F.getFestivalStatus,ruCount})
const seen={collections:true,islands:true}
function earned(){
  const {p}=firstCommissionReturnPlayer()
  assert.deepEqual([p.actions,p.state.day],[135,16])
  p.night();p.visit('village');p.act('beginFestival','harvest')
  const beforeFruit=structuredClone(p.state)
  p.fruit('apple',3);p.visit('village')
  p.act('contributeFestival','participation','harvest')
  for(let i=0;i<3;i++)p.act('contributeFestival','fruit','apple')
  const village=structuredClone(p.state)
  p.visit('home')
  assert.deepEqual([p.actions,p.state.day,p.state.coins],[149,18,131])
  return {farm:p.state,beforeFruit,village}
}
const getAction=(farm:F.FarmState)=>getDiscoveryTask(farm,seen)?.action
const success=(r:F.ActionResult)=>assert.ok(r.ok,r.message)
function click(farm:F.FarmState,value?:string) {
  const summary={},details={open:false,querySelector:(s:string)=>s==='summary'?summary:null}
  const trace:string[]=[]
  const s={
    farm,value,panel:'journal',dialog:{open:true},getDiscoveryTask,
    openPanel(next:string){assert.equal(next,'rest');s.panel=next;trace.push(next)},
    dialogContent:{querySelector(selector:string){
      assert.equal(selector,'[data-festival-home-preparation]')
      return render(farm).includes('data-festival-home-preparation')?details:null
    }},
    highlightControl(target:unknown){assert.equal(target,summary);trace.push('exact-summary')},
  }
  const source=stripTypeScriptTypes("switch('festival-home-preparation'){"
    +part(main,"    case 'festival-home-preparation':","    case 'festival-rest':")+'}')
  runInNewContext(source,s)
  return {trace,open:details.open}
}

test('D18 first Harvest home button reveals the already existing exact next programme without sleep or stock movement',()=>{
  const {farm}=earned(),before=JSON.stringify(farm)
  const action=getAction(farm)
  assert.deepEqual(action,{label:'Что подготовить к утру',target:'festival-home-preparation',value:'harvest:1:1:19'})
  assert.match(main,/class="home-morning-preview">\$\{renderHomeFestivalPreparation\(farm\)\}/)
  const html=render(farm)
  assert.match(html,/<details class="festival-next-preview" data-festival-home-preparation><summary>Праздник урожая · день 19<\/summary>/)
  assert.match(html,/Корнеплоды · 3 вклада/);assert.match(html,/Морковь <b>×3<\/b>/)
  assert.match(html,/Зелень или зерно · 2 вклада/);assert.match(html,/Пшеница <b>×2<\/b>/)
  assert.doesNotMatch(html,/<button|data-action=|href=/)
  assert.deepEqual(click(farm,action!.value),{trace:['rest','exact-summary'],open:true})
  assert.equal(JSON.stringify(farm),before)
  assert.equal(F.contributeFestival(farm,'roots','carrot').ok,false)
  assert.equal(JSON.stringify(farm),before,'nothing can be pledged from Home')
})

test('local prep, explicit night and manual D19 contribution cost the same as the detour, with two fewer crossings',()=>{
  const {farm}=earned(), old=structuredClone(farm), local=structuredClone(farm)
  success(F.sail(old,'village'));success(F.sail(old,'home'))
  const token=getAction(local)?.value
  assert.equal(click(local,token).open,true)
  for(const arm of [old,local]){
    for(const crop of ['carrot','leafyGreens','cabbage']){
      const bed=arm.beds.findIndex(b=>b.kind==='crop'&&b.crop===crop&&F.getBedStage(b)==='ripe')
      assert.ok(bed>=0,crop);success(F.workBed(arm,bed,0))
    }
    assert.deepEqual([arm.day,arm.coins,arm.produce.carrot,arm.produce.leafyGreens,arm.produce.wheat],[18,131,3,1,0])
    success(F.endDay(arm))
    assert.deepEqual(getAction(arm),{label:'К программе праздника',target:'open-panel',value:'festival'})
    assert.equal(render(arm),'')
    assert.deepEqual(click(arm,token),{trace:[],open:false})
    success(F.sail(arm,'village'))
    for(const crop of ['carrot','carrot','carrot','leafyGreens','cabbage'])
      success(F.contributeFestival(arm,crop==='carrot'?'roots':'greens',crop))
    assert.deepEqual([arm.day,arm.coins,arm.festivals.active!.stage,arm.festivals.active!.materialValue],[19,131,2,31])
  }
  assert.deepEqual(F.restoreCurrentFarm(JSON.parse(JSON.stringify(local))),local)
  assert.deepEqual(local,old)
  assert.equal(farm.day,18)
})

test('earlier actionable Festival, local actual Harbour programme, stale token and explicit sail stay separate',()=>{
  const {farm,beforeFruit,village}=earned(), before=JSON.stringify(farm)
  assert.equal(F.getFestivalStatus(beforeFruit).active!.waitingNight,false)
  for(const state of [beforeFruit,village]){
    assert.deepEqual(getAction(state),{label:'К программе праздника',target:'open-panel',value:'festival'})
    assert.equal(render(state),'')
  }
  assert.deepEqual(click(farm,'harvest:1:1:20'),{trace:[],open:false})
  assert.equal(JSON.stringify(farm),before)
  success(F.sail(farm,'village'))
  assert.deepEqual(farm,village,'ordinary explicit Harbour travel is still possible')
  assert.equal(F.getFestivalStatus(farm).active!.waitingNight,true)
  assert.match(main,/!village && farm\.festivals\.active \? \[tile\('Праздники гавани','festivals\/lights','festival'\)\]/)
})
