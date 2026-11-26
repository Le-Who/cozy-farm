import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import {runInNewContext} from 'node:vm'
import test from 'node:test'
import * as F from '../src/farm.ts'
import {getRequirementHint} from '../src/requirement-guidance.ts'
import {getMarketOrderBoard} from '../src/market-orders-view.ts'
import {chooseHoneyKitchenRecipe} from '../src/honey-kitchen-menu.ts'
import {commissionPlayer} from './fixtures/commission-player.ts'

const read=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8')
const opening=JSON.parse(read('./fixtures/home-progress-actions.json'))
const main=read('../src/main.ts'), begin=main.indexOf('async function showRequirement(')
const end=main.indexOf('// Scene handlers own material sounds.',begin)
assert.ok(begin>=0&&end>begin)
const show=stripTypeScriptTypes(main.slice(begin,end))

function earned(water=true) {
  const p=commissionPlayer(opening.slice(0,15))
  p.act('pickFruit',0);p.act('deliverProject','dock');p.act('gatherSeaSalt');p.act('catchFish',true);p.visit('home')
  p.act('deliverMarketOrder','grove');p.act('upgradeBuilding','farmhouse');p.night()
  p.act('pickFruit',0);p.act('cookDish','appleJam');p.visit('grove');p.act('gatherSeaSalt');p.act('deliverProject','dock')
  p.visit('cape');for(let i=0;i<3;i++)p.act('plantCapeFlower',i)
  p.night();p.visit('cape');p.act('collectCapeHoney');p.act('upgradeCape')
  p.visit('home')
  const bed=p.state.beds[11];assert.ok(bed.kind==='crop')
  assert.deepEqual([p.state.day,bed.crop,bed.growth],[4,'wheat',1])
  if(water)p.act('workBed',11,2000)
  p.night();p.visit('cape');p.act('collectCapeHoney');p.visit('home')
  p.act('deliverMarketOrder','garden');p.act('sellMarketItem','honey',2)
  p.visit('grove');p.act('gatherSeaSalt');p.visit('cape');p.act('transferBayGoods','withdraw','cape','beeswax',2)
  p.act('upgradeCape');p.visit('home')
  assert.deepEqual([p.state.day,p.state.island,p.state.coins,p.state.produce.wheat,p.state.honey,p.state.eggs],[5,'home',0,2,2,3])
  return p
}
const row=(f:F.FarmState)=>F.getMarketOrders(f).find(order=>order.lane==='honeyKitchen')!
const request=(f:F.FarmState)=>({kind:'stock',item:row(f).items[0]} as const)

function screen(farm:F.FarmState) {
  const steps:unknown[]=[], saves:F.FarmState[]=[]
  const context:any={...F,farm,panel:'market',dialog:{open:true},dialogContent:{querySelector:()=>null},
    fieldViewButton:{getAttribute:()=>'false'},getRequirementHint,chooseHoneyKitchenRecipe,highlightControl:()=>{},
    closeDialog:()=>{context.dialog.open=false;context.panel=undefined},
    openPanel:(id:string,...args:any[])=>{context.dialog.open=true;context.panel=id;context.honeyKitchenDish=args.at(-1)?.honeyRecipe;steps.push([id,context.honeyKitchenDish])},
    island:{crossIsland:async(commit:()=>boolean)=>{steps.push('cross');assert.ok(commit())},
      focusTarget:(target:unknown)=>steps.push(target)},
    perform:(fn:()=>F.ActionResult)=>{const result=fn();if(result.ok)saves.push(structuredClone(farm));return result.ok},
  }
  runInNewContext(show,context)
  return {context,steps,saves}
}

test('the first box of two biscuit portions routes to enough ripe local wheat before sailing',async()=>{
  const p=earned(), farm=p.state, before=structuredClone(farm), terrain=F.getBedHarvestPreview(farm,11)
  assert.deepEqual([terrain?.ordinary,terrain?.special],[2,1])
  assert.equal(getMarketOrderBoard(farm,'honeyKitchen').selected,'honeyKitchen')
  assert.equal(row(farm).name,'Коробка медового печенья');assert.equal(row(farm).reward,70)
  assert.deepEqual(row(farm).items,[{kind:'dishes',item:'honeyBiscuits',quantity:2}])
  assert.deepEqual([getRequirementHint(farm,request(farm)).action.target,getRequirementHint(farm,request(farm)).action.value],['focus-bed','11'])
  const render=screen(farm);await render.context.showRequirement(request(farm))
  assert.deepEqual(JSON.parse(JSON.stringify(render.steps)),[{kind:'bed',index:11}])
  assert.deepEqual(farm,before);assert.equal(render.saves.length,0)
  p.act('workBed',11)
  assert.deepEqual([p.state.produce.wheat,p.state.dishes.honeyBiscuits,p.state.variants.wheat?.rainbow],[4,0,1])
  assert.equal(getRequirementHint(p.state,request(p.state)).action.value,'cape')
  p.visit('cape');p.act('cookDish','honeyBiscuits');p.act('cookDish','honeyBiscuits');p.visit('home')
  assert.equal(row(p.state).status,'ready');p.act('deliverMarketOrder','honeyKitchen')
  assert.deepEqual([p.state.day,p.state.coins,p.state.dishes.honeyBiscuits,p.state.variants.wheat?.rainbow],[5,70,0,1])
})

test('immature wheat and a genuine single biscuit request preserve the optional first serving',async()=>{
  const cold=earned(false), f=cold.state
  assert.equal(F.getBedHarvestPreview(f,11),undefined)
  assert.deepEqual(getRequirementHint(f,request(f)).action,{label:'',target:'sail',value:'cape'})
  const h=screen(f);await h.context.showRequirement(request(f))
  assert.deepEqual(h.steps,['cross',['honey-kitchen','honeyBiscuits']]);assert.equal(h.saves.length,1)
  assert.equal(f.dishes.honeyBiscuits,0)
  cold.act('cookDish','honeyBiscuits');assert.equal(cold.state.dishes.honeyBiscuits,1)
  const ready=earned()
  const single={kind:'stock',item:{kind:'dishes',item:'honeyBiscuits',quantity:1}} as const
  assert.deepEqual(getRequirementHint(ready.state,single).action,{label:'',target:'sail',value:'cape'})
  ready.visit('cape');ready.act('cookDish','honeyBiscuits');ready.visit('home');ready.act('workBed',11)
  assert.equal(ready.state.dishes.honeyBiscuits,1)
  assert.deepEqual(getRequirementHint(ready.state,request(ready.state)).action,{label:'',target:'sail',value:'cape'})
})
