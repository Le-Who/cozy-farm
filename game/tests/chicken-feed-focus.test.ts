import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { runInNewContext } from 'node:vm'
import { createFarm } from '../src/farm.ts'
import { mixChickenFeed, renderChickenFeedMixes, getChickenFeedMix } from '../src/chicken-feed.ts'
const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
const code=stripTypeScriptTypes("switch('mix-chicken-feed'){"+main.slice(main.indexOf("    case 'mix-chicken-feed':"),main.indexOf("    case 'feed':",main.indexOf("    case 'mix-chicken-feed':")))+"}")
function activate(value:'garden'|'orchard',wheat:number,detail:number,focused=true,open=true) {
  const farm=createFarm();farm.buildingLevels.coop=2;farm.coopSpecialization='hatchery';farm.eggs=2;farm.hatchDay=farm.day+2
  farm.produce.wheat=wheat;farm.produce.carrot=2;farm.fruit.apple=2
  const initial=structuredClone(farm),control={},closeButton={},replacement={},document={activeElement:focused?control:{}}
  const stock={focus(){document.activeElement=stock}}
  const perform=(action:()=>{ok:boolean})=>{const r=action();if(r.ok&&focused)document.activeElement=getChickenFeedMix(farm,value).available?replacement:closeButton;return r.ok}
  runInNewContext(code,{panel:'chicken-feed',dialog:{open},farm,value,perform,mixChickenFeed,control,closeButton,document,event:{detail},dialogContent:{querySelector:(s:string)=>s==='[data-feed-stock]'?stock:null}})
  return {farm,initial,document,stock,closeButton,replacement,control}
}
test('when a selected mix becomes unavailable, keyboard lands on actual feed stock, not Close or another transaction',()=>{
 for (const [value,portions] of [['garden',3],['orchard',4]] as const) {
  const r=activate(value,1,0);assert.equal(r.document.activeElement,r.stock)
  assert.equal(r.farm.feed,r.initial.feed+portions);assert.equal(r.farm.workToday,r.initial.workToday+1)
  assert.equal(r.farm.produce.wheat,0);assert.equal(r.farm.hatchDay,r.initial.hatchDay);assert.equal(r.farm.eggs,r.initial.eggs);assert.equal(r.farm.chickensFed,r.initial.chickensFed)
  assert.match(renderChickenFeedMixes(r.farm),new RegExp('<strong[^>]+data-feed-stock[^>]+tabindex="-1"[^>]*>В запасе '+r.farm.feed+'</strong>'))
 }
})
test('still-mixable choice, pointer, failed action, inactive control and closed panel keep their normal focus',()=>{
 const more=activate('garden',2,0);assert.equal(more.document.activeElement,more.replacement)
 const pointer=activate('garden',1,1);assert.equal(pointer.document.activeElement,pointer.closeButton)
 const no=activate('garden',0,0);assert.equal(no.document.activeElement,no.control);assert.deepEqual(no.farm,no.initial)
 const noFocus=activate('orchard',1,0,false);assert.notEqual(noFocus.document.activeElement,noFocus.stock)
 const closed=activate('garden',1,0,true,false);assert.deepEqual(closed.farm,closed.initial);assert.equal(closed.document.activeElement,closed.control)
})
