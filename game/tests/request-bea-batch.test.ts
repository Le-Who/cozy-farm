import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { runInNewContext } from 'node:vm'
import { finishNeighborPlan, getNeighborPlans, inviteResident, restoreFarm, serveNeighborPlan } from '../src/farm.ts'
import { getRequestedBeaBatch, bakeRequestedBeaBatch } from '../src/request-bea-batch.ts'
import { isGuardedAction } from '../src/action-click-guard.ts'
import { harbourCraftReturnPlayer } from './fixtures/harbour-craft-return.ts'

test('the earned Bea batch is an optional second price for the exact missing pastry, not the meeting itself', () => {
  const {p}=harbourCraftReturnPlayer(), id='finn:1', food='handmade:round'
  p.act('joinNeighborPlan',id)
  const farm=p.state,before=structuredClone(farm), quote=getRequestedBeaBatch(farm,id,food)!
  assert.deepEqual({shape:quote.shape,count:quote.count},{shape:'round',count:4})
  const normal=structuredClone(farm);normal.culinary.tastings.bea.bonus=false
  assert.equal(getRequestedBeaBatch(normal,id,food)?.count,3)
  assert.equal(bakeRequestedBeaBatch(normal,id,food,quote.key).ok,false,'a stale x4 button cannot spend the daily service for x3 instead')
  assert.ok(inviteResident(normal,null,0).ok);assert.equal(getRequestedBeaBatch(normal,id,food),undefined)
  assert.equal(getRequestedBeaBatch(farm,id,'handmade:folded'),undefined,'unknown shapes are not offered')
  assert.equal(getRequestedBeaBatch(farm,'bea:1',food),undefined,'not this request')
  assert.equal(getRequestedBeaBatch({...farm,island:'home'},id,food),undefined)
  assert.equal(getRequestedBeaBatch({...farm,eggs:1},id,food),undefined)
  assert.deepEqual(farm,before,'reading choices does not spend or reserve')
  const src=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
  const a=src.indexOf("    case 'request-bea-batch':"),b=src.indexOf("    case 'request-repeat-exact':",a);assert.ok(a>=0&&b>a)
  const cmd=stripTypeScriptTypes(`switch('request-bea-batch'){${src.slice(a,b)}}`)
  let focused=false
  const env={panel:'request-food',dialog:{open:true},farm,communityRequest:{kind:'neighbor',planId:id},requestedFood:food,value:quote.key,
    perform:(action:()=>{ok:boolean})=>action().ok,bakeRequestedBeaBatch,dialogContent:{querySelector:(s:string)=>s==='[data-request-ready]'?{focus:()=>{focused=true}}:null}}
  runInNewContext(cmd,{...env,panel:'neighbor'});assert.deepEqual(farm,before)
  runInNewContext(cmd,env);assert.equal(focused,true);assert.equal(farm.handmade.round,4);assert.equal(farm.produce.wheat,before.produce.wheat-4);assert.equal(farm.eggs,before.eggs-2)
  assert.equal(farm.village.serviceOn.bea,farm.day);assert.equal(farm.culinary.tastings.bea.bonus,false);assert.equal(farm.coins,before.coins)
  assert.equal(getNeighborPlans(farm).find(plan=>plan.id===id)!.phase,'joined','no gift, selection or reward')
  const paid=structuredClone(farm);runInNewContext(cmd,env);assert.deepEqual(farm,paid)
  const loaded=restoreFarm(paid)!;assert.ok(loaded);assert.ok(isGuardedAction('request-bea-batch'))
  assert.ok(serveNeighborPlan(loaded,id,food).ok);assert.equal(loaded.handmade.round,4)
  assert.ok(finishNeighborPlan(loaded,id,{kind:'basket',settled:true,placements:[
    {slot:'food',x:0,y:0},{slot:'cup',x:-.6,y:.3},{slot:'flowers',x:.6,y:.3}]}).ok)
  assert.equal(loaded.handmade.round,3,'only the subsequent completed meeting takes one pastry')
})
