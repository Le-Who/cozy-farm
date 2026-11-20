import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
import {stripTypeScriptTypes} from 'node:module'
import {commissionPlayer} from './fixtures/commission-player.ts'
import {getBedAction,getWorkshopAction,ingredientCount,workshopIngredients} from '../src/farm.ts'
import {inviteNeighborVisit,visitActivities} from '../src/neighbor-visits.ts'
import {renderNeighborVisits} from '../src/neighbor-visits-ui.ts'
import {getRequirementHint} from '../src/requirement-guidance.ts'

const read=(p:string)=>readFileSync(new URL(p,import.meta.url),'utf8')
const main=read('../src/main.ts')
const activeBook=main.slice(main.indexOf("    case 'neighbor-visits':\n"),main.indexOf("    case 'hen-friendship':\n"))
const openWorkshop=main.slice(main.indexOf("    case 'visit-do': {"),main.indexOf("    case 'hen-friend-select':"))
test('Bea stays for the missing wheat source, then the same visit can open and complete manual baking',()=>{
  const p=commissionPlayer(JSON.parse(read('./fixtures/market-order-selection-commands.json')))
  p.act('selectSeed','wheat');p.act('workBed',0)
  while(getBedAction(p.state,0).kind!=='harvest'){
    assert.ok(p.state.day<20)
    if(getBedAction(p.state,0).kind==='water'){if(!p.state.water)p.act('refillWater');p.act('workBed',0)}
    p.night()
  }
  assert.ok(inviteNeighborVisit(p.state,'beaHands').ok)
  const visit=structuredClone(p.state.neighborVisits.active),source=workshopIngredients[0]
  const panel=()=>{const calls:string[]=[],dialogContent={innerHTML:''}
    const stockTile=(item:typeof source)=>{const n=ingredientCount(p.state,item);calls.push(n+'/'+item.quantity);return `<li>${n}/${item.quantity}</li>`}
    runInNewContext(stripTypeScriptTypes("switch('neighbor-visits'){"+activeBook+'}'),{farm:p.state,dialogContent,renderNeighborVisits,icon:()=>'',workshopIngredients,stockTile})
    return {calls,html:dialogContent.innerHTML}}
  const attempt=()=>{const calls:string[]=[];runInNewContext(stripTypeScriptTypes("switch('visit-do'){"+openWorkshop+'}'),{farm:p.state,panel:'neighbor-visits',dialog:{open:true},value:String(visit!.serial),visitActivities,getWorkshopAction,workshopRecipe:'',drawPanel:()=>calls.push('redraw'),openPanel:(id:string)=>calls.push(id)});return calls}
  const before=structuredClone(p.state),short=panel()
  assert.deepEqual(short.calls,['0/2','3/1']);assert.doesNotMatch(short.html,/data-action="visit-do"|Для ручной выпечки нужны/)
  assert.equal(getRequirementHint(p.state,{kind:'stock',item:source}).action.target,'focus-bed');assert.deepEqual(attempt(),['redraw']);assert.deepEqual(p.state,before)
  p.act('workBed',0);assert.deepEqual(p.state.neighborVisits.active,visit)
  const stocked=panel();assert.deepEqual(stocked.calls,[]);assert.match(stocked.html,/data-action="visit-do"[^>]*>В кондитерскую/);assert.deepEqual(attempt(),['workshop'])
  const eggs=p.state.eggs,wheat=p.state.produce.wheat;p.act('bakeWorkshop','round')
  assert.equal(p.state.eggs,eggs-1);assert.equal(p.state.produce.wheat,wheat-2);assert.equal(p.state.neighborVisits.memories[0].activity,'beaHands')
  assert.doesNotMatch(panel().html,/data-action="visit-do"/)
})
