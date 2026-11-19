import test from 'node:test'
import assert from 'node:assert/strict'
import { createFarm, workBed, getBedAction, endDay, refillWater, restoreCurrentFarm, type FarmState } from '../src/farm.ts'
import { saveGardenPlan, followGardenPlan } from '../src/garden-plans.ts'
import { GardenPlanEditor, renderGardenPlans } from '../src/garden-plans-ui.ts'

const reload=(f:FarmState)=>restoreCurrentFarm(JSON.parse(JSON.stringify(f)))!
function afterFirstPlannedSow(){
  let f=createFarm()
  const step=(r:{ok:boolean})=>{assert.ok(r.ok);f=reload(f)}
  const crops=Array(16).fill(null);crops[9]=crops[13]='carrot';crops[2]='pumpkin' // existing cabbage must not be mistaken for planned pumpkin
  step(workBed(f,9));step(saveGardenPlan(f,0,{name:'Морковные грядки',crops},f.gardenPlans.revision))
  step(followGardenPlan(f,0,f.gardenPlans.revision));step(workBed(f,9))
  return f
}
function cell(f:FarmState,index:number,editor=new GardenPlanEditor()){
  const html=renderGardenPlans(f,editor,()=>'')
  return html.match(new RegExp('<button type="button" class="garden-bed"[^>]*data-value="'+index+'"[^>]*>[\\s\\S]*?</button>'))?.[0]??''
}

test('a freshly planned crop, its watered backup, and their genuinely different mornings agree with the saved notebook',()=>{
  const planted=afterFirstPlannedSow(),dry=reload(planted),wet=reload(planted)
  const known=structuredClone(dry),first=cell(dry,9)
  assert.equal(getBedAction(dry,9).kind,'water')
  assert.match(first,/data-care="dry"/);assert.match(first,/aria-label="Грядка 10: Морковь. Посажено · нужен полив"/)
  assert.match(first,/>Посажено · нужен полив</);assert.match(first,/data-action="garden-bed"/)
  assert.doesNotMatch(cell(dry,13),/data-care=/);assert.match(cell(dry,13),/Можно сеять/)
  assert.match(cell(dry,2),/Занято: капуста/);assert.doesNotMatch(cell(dry,2),/data-care=/)
  assert.deepEqual(dry,known)
  assert.ok(workBed(wet,9).ok);assert.equal(getBedAction(wet,9).kind,'wait')
  assert.match(cell(reload(wet),9),/data-care="watered"/);assert.match(cell(wet,9),/>Полито · растёт за ночь</)
  assert.ok(endDay(dry).ok);assert.ok(endDay(wet).ok)
  assert.equal(dry.beds[9].kind==='crop'&&dry.beds[9].growth,0);assert.equal(wet.beds[9].kind==='crop'&&wet.beds[9].growth,1)
  assert.match(cell(reload(wet),9),/data-care="ripe"/);assert.match(cell(wet,9),/Совпало · Созрело/)
  assert.equal(getBedAction(wet,9).kind,'harvest');assert.deepEqual(wet.gardenPlans,planted.gardenPlans)
})

test('empty can and draft/occupied slots do not promise an executable water or painting action',()=>{
  const f=afterFirstPlannedSow()
  for(const [i] of f.beds.entries()){
    if(!f.water)break
    if(i!==9&&getBedAction(f,i).kind==='water')assert.ok(workBed(f,i).ok)
  }
  assert.equal(f.water,0);assert.equal(getBedAction(f,9).available,false)
  assert.match(cell(f,9),/лейка пуста/);assert.ok(refillWater(f).ok);assert.match(cell(f,9),/нужен полив/)
  const editor=new GardenPlanEditor();editor.begin(f)
  const draft=cell(f,9,editor);assert.match(draft,/data-action="garden-paint"/);assert.doesNotMatch(draft,/data-care=|нужен полив|лейка пуста/)
  const before=structuredClone(f);cell(f,9);assert.deepEqual(f,before)
})
