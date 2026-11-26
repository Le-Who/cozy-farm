import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import * as F from '../src/farm.ts'
import { getMarketOrderBoard } from '../src/market-orders-view.ts'
import { getRequirementHint } from '../src/requirement-guidance.ts'
import { getLocalWarehouseSupply, warehouseRequest, withdrawWarehouseSupply } from '../src/warehouse-guidance.ts'
import { commissionPlayer } from './fixtures/commission-player.ts'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')
const opening = JSON.parse(read('./fixtures/home-progress-actions.json'))
const main = read('../src/main.ts')
const begin = main.indexOf('async function showRequirement(')
const end = main.indexOf('// Scene handlers own material sounds.',begin)
assert.ok(begin >= 0 && end > begin)
const show = stripTypeScriptTypes(main.slice(begin,end))
const item = {kind:'beeswax',quantity:3} as const, requirement = {kind:'stock',item} as const
const quote = (farm:F.FarmState) => F.getMarketOrders(farm).find(order=>order.lane==='apiary')

function earned() {
 const p=commissionPlayer(opening.slice(0,15))
 p.act('pickFruit',0);p.act('deliverProject','dock');p.act('gatherSeaSalt');p.act('catchFish',true);p.visit('home')
 p.act('deliverMarketOrder','grove');p.act('upgradeBuilding','farmhouse');p.night()
 p.act('pickFruit',0);p.act('cookDish','appleJam');p.visit('grove');p.act('gatherSeaSalt');p.act('deliverProject','dock')
 p.act('pickFruit',0);p.visit('cape');for(let i=0;i<3;i++)p.act('plantCapeFlower',i)
 p.night();p.visit('cape');p.act('collectCapeHoney');p.act('upgradeCape')
 p.night();p.visit('cape');p.act('collectCapeHoney')
 assert.equal(p.actions,42)
 assert.deepEqual([p.state.day,p.state.coins,p.state.beeswax,p.state.freight.warehouses.cape.beeswax],[5,29,1,2])
 return p
}

function source(farm:F.FarmState) {
 const steps:string[]=[], saves:F.FarmState[]=[], notices:string[]=[]
 const context:any={...F,farm,panel:'market', dialog:{open:true}, dialogContent:{querySelector:()=>null},
  fieldViewButton:{getAttribute:()=>'false'},warehouseRequest,getRequirementHint,highlightControl:()=>{},
  closeDialog:()=>{context.dialog.open=false;context.panel=undefined},
  openPanel:(id:string)=>{context.dialog.open=true;context.panel=id;steps.push(id)},
  island:{crossIsland:async(commit:()=>boolean)=>{steps.push('cross');assert.ok(commit())},
    focusTarget:(target:{kind:string})=>steps.push(target.kind)},
  perform:(action:()=>F.ActionResult)=>{const result=action();if(result.ok)saves.push(structuredClone(farm));return result.ok},
  notify:(message:string)=>notices.push(message),
 }
 runInNewContext(show,context)
 return {context,steps,saves,notices}
}

test('ordinary first Cape warehouse wax is reachable from the exact Home +42 order without sleeping or issuing the stock',async()=>{
 const p=earned();p.visit('home')
 const farm=p.state,before=structuredClone(farm), board=getMarketOrderBoard(farm,'apiary')
 assert.equal(board.selected,'apiary');assert.equal(board.order?.status,'waiting');assert.equal(quote(farm)?.reward,42)
 assert.equal(board.pickup,undefined,'other-island stock cannot activate local pickup')
 const hint=getRequirementHint(farm,requirement)
 assert.deepEqual([hint.action.target,hint.action.value],['sail','cape'],'available exact Cape store outranks waiting tomorrow')
 assert.deepEqual(farm,before,'reading an ingredient cannot travel')
 const run=source(farm)
 await run.context.showRequirement(requirement)
 const expected=structuredClone(before);assert.ok(F.sail(expected,'cape').ok)
 assert.deepEqual(farm,expected);assert.deepEqual(run.steps,['cross','warehouse-supply']);assert.deepEqual(run.saves,[expected])
 assert.equal(run.context.selectedWarehouseRequest.kind,'beeswax')
 assert.equal(run.context.selectedWarehouseRequest.quantity,3)
 assert.equal(farm.beeswax,1);assert.equal(farm.freight.warehouses.cape.beeswax,2)
 const supply=getLocalWarehouseSupply(farm,item)
 assert.deepEqual(supply,{id:'beeswax',port:'cape',carried:1,stored:2,quantity:2,needed:3})
 assert.equal(withdrawWarehouseSupply(farm,item,supply).ok,true,'separate explicit matching transfer')
 assert.equal(farm.freight.warehouses.cape.beeswax??0,0)
 assert.equal(farm.beeswax,3);assert.equal(farm.coins,29)
 assert.equal(F.deliverMarketOrder(farm,'apiary').ok,false,'the market accepts only deliberate delivery at Home')
 assert.equal(farm.orders.apiary.completed,0)
 assert.ok(F.sail(farm,'home').ok)
 assert.equal(quote(farm)?.status,'ready')
 assert.ok(F.deliverMarketOrder(farm,'apiary').ok)
 assert.deepEqual([farm.coins,farm.beeswax,farm.honey,farm.day],[71,0,2,5])
 assert.equal(F.deliverMarketOrder(farm,'apiary').ok,false)
})

test('the same ordinary source says wait when partial or actually empty, and never routes when already on hand',()=>{
 const p=earned()
 const local=getRequirementHint(p.state,requirement)
 assert.deepEqual([local.action.target,local.action.value],['warehouse-supply','beeswax|3'])
 p.act('transferBayGoods','withdraw','cape','beeswax',2)
 p.act('transferBayGoods','deposit','cape','beeswax',1)
 p.visit('home');p.act('sellMarketItem','beeswax',1)
 const partly=structuredClone(p.state)
 assert.deepEqual([partly.beeswax,partly.freight.warehouses.cape.beeswax],[1,1])
 const notEnough=getRequirementHint(partly,requirement)
 assert.equal(notEnough.action.value,'farmhouse')
 assert.match(notEnough.notice!,/снова наполнится завтра/)
 p.visit('cape');p.act('transferBayGoods','withdraw','cape','beeswax',1);p.visit('home')
 p.act('sellMarketItem','beeswax',2)
 const gone=getRequirementHint(p.state,requirement)
 assert.equal(gone.action.value,'farmhouse');assert.match(gone.notice!,/снова наполнится завтра/)
 const next=earned()
 next.act('transferBayGoods','withdraw','cape','beeswax',2);next.visit('home')
 assert.deepEqual(getRequirementHint(next.state,requirement).action,{label:'',target:'open-panel',value:'inventory'})
})
