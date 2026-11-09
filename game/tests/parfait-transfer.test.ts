import assert from 'node:assert/strict'
import test from 'node:test'
import {createParfaitTransfer} from '../src/parfait-transfer.ts'
import {beginHoneyStroke,createHoneyModel,depositParfaitCustard,depositParfaitHoney,endHoneyStroke,honeyProgress,moveHoneyStroke,placeHoneyFruit,settleHoney} from '../src/honey-cookery-model.ts'

test('an empty spoon cannot fill the glass, and carried cream survives a long trip or release',()=>{
 const cream=createParfaitTransfer()
 for(let i=0;i<120;i++)assert.equal(cream.step(1/60,false,true),0)
 assert.equal(cream.delivered,0)
 for(let i=0;i<20;i++)cream.step(1/60,true,false)
 assert.equal(cream.load,cream.capacity)
 for(let i=0;i<300;i++)cream.step(1/60,false,false)
 assert.equal(cream.load,cream.capacity)
 let delivered=0;for(let i=0;i<60;i++)delivered+=cream.step(1/60,false,true)
 assert.ok(Math.abs(delivered-cream.capacity)<1e-12)
 assert.ok(cream.load<1e-12)
})

test('three continuous real spoonfuls fill one layer and cannot duplicate cream',()=>{
 const cream=createParfaitTransfer(),model=createHoneyModel('windParfait')
 for(let pass=0;pass<3;pass++){
  beginHoneyStroke(model,'spoon',{x:0,y:0})
  for(let i=0;i<8;i++)cream.step(.05,true,false)
  for(let i=0;i<12;i++)depositParfaitCustard(model,cream.step(.05,false,true))
  assert.equal(model.stage,'custard','stage change waits for the spoon release')
  if(pass<2){assert.equal(model.pending,null);assert.ok(honeyProgress(model)<1)}
  endHoneyStroke(model)
 }
 assert.equal(model.stage,'fruit');assert.equal(cream.delivered,1);assert.equal(model.parfaitCustard,1)
 for(let i=0;i<100;i++)assert.equal(cream.step(.05,false,true),0)
 assert.equal(model.steps.filter(s=>s==='layer-custard').length,1)
})

test('a quick source contact takes a sensible scoop and releasing over glass can finish the pour',()=>{
 const cream=createParfaitTransfer();cream.scoop();assert.equal(cream.load,.34)
 // Carrying or releasing elsewhere retains the same portion.
 cream.step(.016,false,false);assert.equal(cream.load,.34)
 const first=cream.step(.016,false,true),remaining=cream.finishDeposit()
 assert.ok(first>0&&remaining>0)
 assert.ok(Math.abs(first+remaining-.34)<1e-12)
 assert.ok(Math.abs(cream.delivered-.34)<1e-12)
 assert.equal(cream.load,0)
})

test('empty coverage gestures never substitute for scooping cream or a contained honey pour',()=>{
 const model=createHoneyModel('windParfait');beginHoneyStroke(model,'spoon',{x:-.8,y:0})
 for(let i=0;i<100;i++)moveHoneyStroke(model,{x:Math.sin(i)*.7,y:Math.cos(i)*.7})
 endHoneyStroke(model);assert.equal(model.stage,'custard');assert.equal(honeyProgress(model),0)
 model.stage='glaze';beginHoneyStroke(model,'honey',{x:0,y:0})
 for(let i=0;i<200;i++){moveHoneyStroke(model,{x:0,y:0});depositParfaitHoney(model,{x:2,y:0},.05)}
 assert.equal(model.parfaitHoney,0);assert.equal(model.pending,null)
})

test('honey flows and spreads in the single vessel while stationary, then settles after release',()=>{
 const model=createHoneyModel('windParfait');model.stage='fruit'
 for(let i=0;i<3;i++)placeHoneyFruit(model,i,{x:(i-1)*.35,y:0})
 assert.equal(model.stage,'glaze');beginHoneyStroke(model,'honey',{x:0,y:0})
 for(let i=0;i<50;i++)depositParfaitHoney(model,{x:0,y:0},.05)
 assert.equal(model.stage,'glaze');assert.equal(model.parfaitHoney,1)
 endHoneyStroke(model);assert.equal(model.stage,'settling')
 settleHoney(model,.1,true);settleHoney(model,.05,true);assert.equal(model.stage,'ready')
 assert.deepEqual(model.steps,['layer-fruit','pour-honey'])
})
