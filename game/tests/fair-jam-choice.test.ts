import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import * as fair from '../src/fair-return.ts'
import { cropDefinitions, deliverIntentOrder, endDay, getCommunityOrders, getFairGuest, getVillageProject, ingredientCount, restoreCurrentFarm, serveFairGuest, type FarmState, type StockItem } from '../src/farm.ts'
import { ruCount } from '../src/ru.ts'
import { isGuardedAction } from '../src/action-click-guard.ts'
import { commissionPlayer } from './fixtures/commission-player.ts'

const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
const part=(from:string,to:string)=>{const a=main.indexOf(from),b=main.indexOf(to,a+1);assert.ok(a>=0&&b>a);return main.slice(a,b)}
const liveGuest=stripTypeScriptTypes("switch('guest'){"+part("    case 'guest': {","    case 'neighbor-visits':")+'}')
function render(farm:FarmState){
  const dialogContent={innerHTML:''}
  runInNewContext(liveGuest,{...fair,farm,dialogContent,dialogTitle:{setAttribute(){}},getFairGuest,ingredientCount,cropDefinitions,
    stockTile:(item:StockItem)=>'<li>'+('item' in item?item.item:item.kind)+'</li>',
    quantity:(n:number)=>ruCount(n,'монета','монеты','монет'),
    nav:(...buttons:string[])=>buttons.join(''),row:()=>'',button:(label:string,action:string,enabled=true,options:{value?:string;secondary?:boolean}={})=>
      `<button data-action="${action}" data-value="${options.value??''}"${enabled?'':' disabled'}>${label}</button>`})
  return dialogContent.innerHTML
}

function earned(){
  const steps=JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json',import.meta.url),'utf8'))
  const p=commissionPlayer(steps.slice(0,steps.findIndex((a:{name:string})=>a.name==='serveFairGuest')))
  assert.equal(p.state.day,6);assert.equal(getFairGuest(p.state)?.name,'Поппи')
  assert.equal(p.state.dishes.appleJam,1)
  p.act('sellMarketItem','dishes:orchardTart')
  while(p.state.day<10)p.night()
  return p.state
}

test('one ordinary jar at Poppy’s day-10 return can open the harbour project or fulfill the real picnic, but not both',()=>{
  const farm=earned(),before=structuredClone(farm),orderId='intent:10:fruit',jam='dish:appleJam'
  const html=render(farm)
  assert.match(html,/data-action="serve-guest"[^>]*>Угостить · открыть стройку гавани/)
  assert.match(html,/data-action="fair-jam-picnic" data-value="intent:10:fruit">К пикнику · 26 монет/)
  assert.doesNotMatch(html,/data-action="deliver-intent"/)
  const opened:string[]=[],ctx={...fair,farm,action:'fair-jam-picnic',value:'intent:6:fruit',panel:'guest',dialog:{open:true},
    communityOrderId:undefined,communityRequest:undefined,requestedFood:undefined,getCommunityOrders,openPanel:(target:string)=>opened.push(target)}
  const route=stripTypeScriptTypes("switch(action){"+part("    case 'fair-jam-picnic':","    case 'open-neighbor':")+'}')
  assert.ok(isGuardedAction('fair-jam-picnic'))
  runInNewContext(route,ctx);assert.deepEqual(opened,[])
  ctx.value=orderId;runInNewContext(route,ctx);assert.deepEqual(opened,['intent'])
  assert.equal(ctx.communityOrderId,orderId);assert.deepEqual(farm,before)

  const guest=structuredClone(farm),picnic=structuredClone(farm)
  assert.ok(serveFairGuest(guest).ok);assert.equal(guest.dishes.appleJam,0)
  assert.equal(guest.coins-farm.coins,17);assert.equal(guest.seeds.wheat-farm.seeds.wheat,2);assert.ok(getVillageProject(guest).unlocked)
  assert.equal(deliverIntentOrder(guest,orderId,jam).ok,false)
  assert.ok(deliverIntentOrder(picnic,orderId,jam).ok);assert.equal(picnic.dishes.appleJam,0)
  assert.equal(picnic.coins-farm.coins,26);assert.equal(picnic.seeds.wheat,farm.seeds.wheat);assert.equal(getVillageProject(picnic).unlocked,false)
  assert.equal(serveFairGuest(picnic).ok,false)
  for(const accepted of [guest,picnic]){
    assert.deepEqual(restoreCurrentFarm(accepted),accepted)
    assert.doesNotMatch(render(accepted),/fair-jam-picnic|открыть стройку гавани/)
  }
  ctx.farm=picnic;runInNewContext(route,ctx);assert.deepEqual(opened,['intent'])
  ctx.farm=farm;ctx.panel='intents';runInNewContext(route,ctx);assert.deepEqual(opened,['intent'])
  ctx.action='open-intent';runInNewContext(route,ctx);assert.deepEqual(opened,['intent','intent'])
  assert.deepEqual(farm,before)
})

test('the alternate stays absent when the player can feed both, the project is already open, or picnic is closed',()=>{
  const farm=earned()
  for(const change of [
    (f:FarmState)=>{f.dishes.orchardTart=1},(f:FarmState)=>{f.dishes.appleJam=2},
    (f:FarmState)=>{f.fairGuestsServed=1},(f:FarmState)=>{f.intentOrders.fruit={completed:1,deliveredOn:f.day}},
    (f:FarmState)=>{f.island='grove'}, (f:FarmState)=>{assert.ok(endDay(f).ok)},
  ]){
    const other=structuredClone(farm);change(other);const before=structuredClone(other)
    assert.doesNotMatch(render(other),/fair-jam-picnic|открыть стройку гавани/)
    assert.deepEqual(other,before)
  }
})
