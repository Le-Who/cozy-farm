import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import {runInNewContext} from 'node:vm'
import * as F from '../src/farm.ts'
import {communityReturnRoute} from '../src/community-return.ts'
import {cookingReturnFixture} from './fixtures/cooking-return.ts'

const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
const scene=readFileSync(new URL('../src/arrangement.ts',import.meta.url),'utf8')
function section(source:string,start:string,end:string){const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>=0&&b>a);return source.slice(a,b)}
const mount=section(main,"    case 'arrangement': {","    case 'market':")
const resume=section(main,'function currentCommunityRequest()', 'function updateCommunityReturn()')
  + section(main,'async function resumeCommunityRequest(','function requestedRecipe()')
const close=section(main,'function closeCurrentPanel()',"closeButton.addEventListener('click'")
const back=section(main,'function returnFromPanel(',"dialog.addEventListener('cancel'")
const dialogKey=section(main,"dialog.addEventListener('keydown', event => {\n  if (event.key !== 'Escape'", "dialog.addEventListener('keydown',event=>{if(event.altKey")
const viewKey=section(scene,"  view.addEventListener('keydown', event => {", "  finish.addEventListener('click'")
const js=(s:string)=>stripTypeScriptTypes(s)
function setup(neighbor=false,bookmark=true){
  // Existing synthetic but save-valid fixture. Native/earned progression is not claimed here.
  const {farm}=cookingReturnFixture('home')
  assert.ok(F.restoreFarm(farm))
  assert.ok(F.packEggBasket(structuredClone(farm)).ok,'packing is actually available')
  const basket=F.getNeighborPlans(farm).find(p=>p.arrangement==='basket'&&p.phase==='preparing')!
  assert.ok(basket)
  if(neighbor){
    assert.ok(F.sail(farm,'village').ok);assert.ok(F.joinNeighborPlan(farm,basket.id).ok)
    const food=F.getIntentOffers(farm,basket.intentId).find(o=>o.available)!
    assert.ok(food);assert.ok(F.serveNeighborPlan(farm,basket.id,food.id).ok)
    assert.equal(F.getNeighborPlans(farm).find(p=>p.id===basket.id)?.phase,'arranging')
  }
  const before=structuredClone(farm),calls:string[]=[],pending:Promise<unknown>[]=[]
  const state:any={...F,farm,panel:'arrangement',panelHistory:[{panel:neighbor?'neighbor':'coop'}],
    arrangementRequest:neighbor?{kind:'neighbor',id:basket.id}:{kind:'packing',mode:'eggs'},
    communityRequest:bookmark?{kind:'neighbor',resident:basket.resident,planId:basket.id}:undefined,requestedFood:undefined,
    dialog:{open:true,addEventListener(type:string,fn:unknown){assert.equal(type,'keydown');state.dialogKey=fn}},
    dialogContent:{innerHTML:'',querySelector(){return {}}},
    createArrangement(_host:unknown,options:unknown){state.options=options;return {destroy(){}}},
    leaveScene(){calls.push('local-back');state.panel=state.panelHistory.pop()?.panel},
    goBack(){calls.push('local-back');state.panel=state.panelHistory.pop()?.panel},
    closeDialog(){calls.push('close');state.panel=undefined;state.dialog.open=false},
    closeContextualSale:()=>false,returnToRecipeIndex:()=>false,communityReturnRoute,
    island:{isCrossing:()=>false,crossIsland:async(commit:()=>void)=>{calls.push('cross');commit()}},
    fieldViewButton:{getAttribute:()=> 'false'},
    perform(fn:()=>{ok:boolean}){const result=fn();if(result.ok)calls.push('save');return result.ok},
    openPanel(panel:string){state.panel=panel;state.dialog.open=true;calls.push(panel)},
  }
  runInNewContext(js(resume+'\n'+close+'\n'+back+'\n'+dialogKey),state)
  const actualResume=state.resumeCommunityRequest
  state.resumeCommunityRequest=(...args:unknown[])=>{const task=actualResume(...args);pending.push(task);return task}
  runInNewContext(js(`switch('arrangement'){${mount}}`),state)
  assert.equal(state.options.mode,neighbor?'basket':'eggs')
  runInNewContext(js(viewKey),{view:{addEventListener(type:string,fn:unknown){assert.equal(type,'keydown');state.viewKey=fn}},signal:undefined,cancel:()=>state.options.onCancel()})
  const escape=async(button:boolean,loading=false)=>{
    const event={key:'Escape',repeat:false,defaultPrevented:false,target:{closest:()=>button?{}:null},preventDefault(){this.defaultPrevented=true}}
    if(!loading)state.viewKey(event)
    state.dialogKey(event);await Promise.all(pending)
    return event
  }
  const unchanged=()=>{assert.deepEqual(farm,before);assert.ok(F.restoreFarm(farm));assert.equal(calls.includes('cross'),false);assert.equal(calls.includes('save'),false)}
  return {state,farm,before,calls,pending,escape,unchanged}
}

test('packing own visible Close stays local despite a real preparing NPC bookmark',async()=>{
  const h=setup();h.state.options.onCancel();await Promise.all(h.pending);assert.equal(h.state.panel,'coop');assert.deepEqual(h.calls,['local-back']);h.unchanged()
})
test('packing view-focused Escape remains local through its existing scene callback',async()=>{
  const h=setup();const e=await h.escape(false);assert.equal(e.defaultPrevented,true);assert.equal(h.state.panel,'coop');assert.deepEqual(h.calls,['local-back']);h.unchanged()
})
test('packing Close-focused Escape bubbles to shell but cannot travel to the saved NPC',async()=>{
  const h=setup();const e=await h.escape(true);assert.equal(e.defaultPrevented,true);assert.equal(h.state.panel,'coop');assert.deepEqual(h.calls,['local-back']);h.unchanged()
})
test('packing loading Escape preserves local origin before the inner scene handler exists',async()=>{
  const h=setup();await h.escape(false,true);assert.equal(h.state.panel,'coop');assert.deepEqual(h.calls,['local-back']);h.unchanged()
})
test('packing shell Close while loading dismisses locally without reusing the saved NPC',async()=>{
  const h=setup();h.state.closeCurrentPanel();await Promise.all(h.pending);assert.equal(h.state.dialog.open,false);assert.equal(h.state.panel,undefined);assert.deepEqual(h.calls,['close']);h.unchanged()
})
test('packing with no bookmark retains its existing shell Escape and Close contracts',async()=>{
  const h=setup(false,false);await h.escape(true);assert.equal(h.state.panel,'coop');h.unchanged()
  const c=setup(false,false);c.state.closeCurrentPanel();await Promise.all(c.pending);assert.equal(c.state.dialog.open,false);c.unchanged()
})
for(const exit of ['own-close','button-escape','loading-escape','shell-close'] as const)test(`owned neighbor arrangement still returns to its explicit meeting: ${exit}`,async()=>{
  const h=setup(true)
  if(exit==='own-close')h.state.options.onCancel()
  else if(exit==='shell-close')h.state.closeCurrentPanel()
  else await h.escape(exit==='button-escape',exit==='loading-escape')
  await Promise.all(h.pending);assert.equal(h.state.panel,'neighbor');assert.deepEqual(h.calls,['neighbor']);h.unchanged()
})
test('the separately invoked explicit community return may still travel from Home',async()=>{
  const h=setup();await h.state.resumeCommunityRequest('request');assert.equal(h.farm.island,'village');assert.deepEqual(h.farm,{...h.before,island:'village'});assert.deepEqual(h.calls,['close','cross','save','neighbor'])
})
