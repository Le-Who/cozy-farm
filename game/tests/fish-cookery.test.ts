import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cancelFish, completeFish, createFishModel, finishFishSeason, fishSaltCoverage, heatFish, placeFishGarnish, placeFishInPan, plateFish, seasonFish, settleFish, turnFish } from '../src/fish-cookery-model.ts'

function seasoned() {
  const m=createFishModel()
  for(let repeat=0;repeat<7;repeat++)for(let j=0;j<2;j++)for(let i=0;i<6;i++)seasonFish(m,{x:(i-2.5)*.28,y:(j-.5)*.52},.05,.12)
  assert.equal(finishFishSeason(m),true)
  return m
}
function cooked() {
  const m=seasoned();placeFishInPan(m)
  for(let i=0;i<150;i++)heatFish(m,.05,1,{x:0,y:0})
  assert.equal(m.stage,'grill');assert.equal(turnFish(m),true)
  for(let i=0;i<150;i++)heatFish(m,.05,1,{x:0,y:0})
  assert.equal(m.stage,'plate');plateFish(m)
  return m
}
test('salt requires distributed physical rubbing, not one stationary press',()=>{
  const m=createFishModel()
  for(let i=0;i<500;i++)seasonFish(m,{x:0,y:0},.05,0)
  assert.equal(fishSaltCoverage(m),0)
  for(let i=0;i<500;i++)seasonFish(m,{x:-.8,y:-.3},.05,.2)
  assert.ok(fishSaltCoverage(m)<.83);assert.equal(finishFishSeason(m),false)
  assert.equal(seasoned().stage,'transfer')
})
test('off-surface and invalid inputs do not season fish',()=>{
  const m=createFishModel();seasonFish(m,{x:NaN,y:0},.05,1);seasonFish(m,{x:2,y:0},.05,1)
  assert.equal(fishSaltCoverage(m),0);assert.equal(placeFishInPan(m),false)
})
test('heat requires pan contact and both independent sides',()=>{
  const m=seasoned();placeFishInPan(m)
  for(let i=0;i<300;i++)heatFish(m,.05,0,{x:0,y:0})
  assert.equal(m.seconds,0);assert.ok([...m.heat[0]].every(v=>v===0))
  for(let i=0;i<600;i++)heatFish(m,.05,1,{x:0,y:0})
  assert.equal(m.stage,'grill');assert.ok([...m.heat[1]].every(v=>v===0));assert.equal(plateFish(m),false)
  assert.equal(turnFish(m),true)
  for(let i=0;i<150;i++)heatFish(m,.05,1,{x:0,y:0})
  assert.equal(m.stage,'plate');assert.ok(m.steps.includes('turn-fish'))
})
test('heat is spatial and saturates without a timer burn lock',()=>{
  const m=seasoned();placeFishInPan(m)
  for(let i=0;i<60;i++)heatFish(m,.05,1,{x:.8,y:0})
  assert.ok(m.heat[0][0]>m.heat[0][5]);for(let i=0;i<4000;i++)heatFish(m,.05,1,{x:.8,y:0})
  assert.ok([...m.heat[0]].every(v=>v>=0&&v<=1));assert.equal(m.stage,'grill')
})
test('carrot arrangement retains position and prevents overlapping or off-plate garnish',()=>{
  const m=cooked();assert.equal(placeFishGarnish(m,0,{x:0,y:-.2},0),false)
  assert.equal(placeFishGarnish(m,0,{x:-.4,y:.35},.3),true)
  assert.equal(placeFishGarnish(m,1,{x:-.4,y:.35},0),false)
  assert.equal(placeFishGarnish(m,1,{x:0,y:.4},-.2),true)
  assert.equal(placeFishGarnish(m,2,{x:.4,y:.35},.4),true)
  settleFish(m,.1,false);assert.equal(m.stage,'garnish')
  for(let i=0;i<5;i++)settleFish(m,.1,true)
  assert.equal(m.stage,'ready');assert.equal(m.garnish[0].x,-.4);assert.equal(m.garnish[0].y,.35);assert.ok(Math.abs(m.garnish[0].angle-.3)<1e-12)
})
test('completion commits one successful batch, allows false retry, and cancellation does not commit',()=>{
  const m=cooked();let commits=0;assert.equal(completeFish(m,()=>{commits++;return true}),false);assert.equal(commits,0)
  for(let i=0;i<3;i++)placeFishGarnish(m,i,{x:(i-1)*.4,y:.35},0)
  for(let i=0;i<5;i++)settleFish(m,.1,true)
  assert.equal(completeFish(m,()=>{commits++;return false}),false);assert.equal(m.stage,'ready')
  assert.equal(completeFish(m,()=>{commits++;return true}),true)
  assert.equal(completeFish(m,()=>{commits++;return true}),false);assert.equal(commits,2)
  assert.equal(cancelFish(m),false)
  const cancelled=seasoned();assert.equal(cancelFish(cancelled),true);assert.equal(completeFish(cancelled,()=>{commits++;return true}),false);assert.equal(commits,2)
})
