import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { runInNewContext } from 'node:vm'
import { commissionPlayer } from './fixtures/commission-player.ts'
import * as F from '../src/farm.ts'
import { hasLanternfishDepth } from '../src/fishing-model.ts'
import { getFishSource } from '../src/fish-guidance.ts'

const read=(k:string)=>readFileSync(new URL(k, import.meta.url),'utf8')
const main=read('../src/main.ts'), culinary=read('../src/culinary-ui.ts')
const opening=JSON.parse(read('./fixtures/home-progress-actions.json'))
const between=(source:string,a:string,b:string)=>{
  const x=source.indexOf(a),y=source.indexOf(b,x+a.length)
  assert.ok(x>=0&&y>x);return source.slice(x,y)
}
const render=runInNewContext(stripTypeScriptTypes(culinary.slice(culinary.indexOf('const coveChoiceSummary='))
  .replace('export function coveControls','function coveControls').replaceAll('import.meta.env.BASE_URL','"/"')+'\n(coveControls)'),{
  getCoveActions:F.getCoveActions,hasLanternfishDepth,
  control:(label:string,action:string)=>'<button data-action="'+action+'">'+label+'</button>',
}) as (farm:F.FarmState)=>string
const coveClick=stripTypeScriptTypes(between(main,'function perform(', 'const bedTools =')
  +'\n;switch(action){'+between(main,"    case 'cove-choice':","    case 'cove-watch':")+'}')
function firstNatural() {
  const p=commissionPlayer(opening.slice(0,15))
  assert.deepEqual([p.state.day,p.state.island,p.actions],[2,'grove',15])
  p.act('collectShell',0)
  assert.equal(F.getCoveActions(p.state).phase,'natural')
  return p.state
}
function click(farm:F.FarmState,action:string,value:string) {
  const writes:F.FarmState[]=[]
  runInNewContext(coveClick,{
    action,value,farm,panel:'cove',dialog:{open:true},changeCove:F.changeCove,cancelCovePlan:F.cancelCovePlan,
    playBaySound:()=>{},refresh:()=>{},saveFarm:()=>writes.push(structuredClone(farm)),
    window:{clearTimeout:()=>{},setTimeout:()=>0},dialogFeedbackTimer:0,dialogFeedback:{classList:{toggle:()=>{}},dataset:{}},
  })
  return writes
}
function slept(farm:F.FarmState) {
  assert.ok(F.sail(farm,'home').ok);assert.ok(F.endDay(farm).ok);assert.ok(F.sail(farm,'grove').ok)
  assert.deepEqual(F.restoreCurrentFarm(JSON.parse(JSON.stringify(farm))),farm)
}

test('already selected first Cove settings do not write or silently change tomorrow’s fish habitat',()=>{
  const farm=firstNatural(), before=structuredClone(farm)
  const initial=render(farm)
  assert.match(initial,/Тихое течение.*Естественный берег/)
  for(const value of ['flow:sheltered','cover:meadow','refuge:sand']){
    assert.ok(initial.includes('data-value="'+value+'" aria-pressed="true"'))
    assert.deepEqual(click(farm,'cove-choice',value),[], 'a click on an already selected natural value must not schedule or save')
    assert.deepEqual(farm,before)
    assert.equal(F.getCoveActions(farm).forecast,null)
    assert.doesNotMatch(render(farm),/После прилива|cove-cancel/)
  }
  slept(farm)
  assert.equal(farm.day,3)
  assert.deepEqual(farm.shoreline,before.shoreline)
  assert.equal(F.getCoveHabitat(farm),undefined)
  assert.equal(hasLanternfishDepth(F.getCoveHabitat(farm)),true)
  assert.equal(getFishSource(farm,'lanternfish'),'grove')
})

test('intentional first Cove plan, cancel, and reverting to the same settled choices still work',()=>{
  const farm=firstNatural(), bank=farm.coins, fish=structuredClone(farm.fish)
  assert.equal(click(farm,'cove-choice','cover:kelp').length,1)
  assert.match(render(farm),/После прилива, день 3.*для рыбы-фонаря мелко/)
  assert.deepEqual(click(farm,'cove-choice','flow:sheltered'),[], 'a pending toggle already ignored the same selected value')
  assert.equal(click(farm,'cove-cancel',F.getCoveActions(farm).planKey!).length,1)
  assert.equal(F.getCoveActions(farm).phase,'natural')
  assert.equal(click(farm,'cove-choice','flow:open').length,1)
  assert.match(render(farm),/После прилива, день 3.*может встретиться рыба-фонарь/)
  // The identical natural set can still be intentionally staged by reselecting
  // the old flow while it differs from the pending Open choice.
  assert.equal(click(farm,'cove-choice','flow:sheltered').length,1)
  assert.deepEqual(farm.shoreline.pending,{flow:'sheltered',cover:'meadow',refuge:'sand'})
  assert.equal(click(farm,'cove-cancel',F.getCoveActions(farm).planKey!).length,1)
  assert.equal(click(farm,'cove-choice','cover:kelp').length,1)
  slept(farm)
  const settled=F.getCoveHabitat(farm)!
  assert.equal(settled.profile,'nursery')
  assert.equal(getFishSource(farm,'lanternfish'),'home')
  assert.equal(click(farm,'cove-choice','flow:open').length,1)
  assert.equal(click(farm,'cove-choice','flow:sheltered').length,1)
  assert.equal(farm.shoreline.pending,null)
  assert.deepEqual(F.getCoveHabitat(farm),settled)
  assert.equal(click(farm,'cove-choice','flow:open').length,1)
  slept(farm)
  assert.equal(F.getCoveHabitat(farm)?.profile,'channel')
  assert.equal(getFishSource(farm,'lanternfish'),'grove')
  assert.deepEqual([farm.coins,farm.fish],[bank,fish])
})
