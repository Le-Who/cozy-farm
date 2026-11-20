import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import {runInNewContext} from 'node:vm'
import {chickenCarePlayer} from './fixtures/chicken-care-player.ts'
import {getClimate,weatherNames} from '../src/climate.ts'
import {canConfirmRest} from '../src/rest-preview.ts'
import {ActivationKeyGuard,ActionClickGuard,isGuardedAction} from '../src/action-click-guard.ts'
import type {FarmState} from '../src/farm.ts'

const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
const start=main.indexOf("    case 'rest':",main.indexOf('function drawPanel()'))
const branch=stripTypeScriptTypes("switch('rest'){"+main.slice(start,main.indexOf("    case 'journal':",start))+"}")
// Execute the actual cottage view, stubbing only unrelated panels/formatting.
function bedtime(farm:FarmState){
 const box={innerHTML:''},empty=()=>''
 runInNewContext(branch,{farm,dialogContent:box,getClimate,weatherNames,communityRequest:undefined,
  renderSelectedIntentRest:empty,renderShopRest:empty,renderRestPreview:empty,renderFerryReturn:empty,
  renderVisitRest:empty,renderPicnicStatus:empty,renderCoopCapacityWarning:empty,flockFeedRow:empty,
  harbourGoods:empty,nav:empty,button:(label:string,action:string,_enabled=true,opt:{value?:number}={})=>
   `<button data-action="${action}" data-value="${opt.value??''}">${label}</button>`})
 return box.innerHTML
}

test('earned incubation survives reload; the cottage names the correct morning beside the separate guarded sleep',()=>{
 const p=chickenCarePlayer('orchard','hatchery')
 p.act('feedChickens');p.act('endDay');p.act('collectEggs')
 const startDay=p.state.day, flock=p.state.flockSize
 assert.doesNotMatch(bedtime(p.state),/вылупится/i)
 p.act('incubateEgg')
 for(let night=0;night<2;night++){
  const before=structuredClone(p.state),view=bedtime(p.state),header=view.match(/<header class="rest-morning">[\s\S]*?<\/header>/)?.[0]??''
  if(night===0) assert.match(header,new RegExp(`Курочка вылупится утром дня ${startDay+2}`))
  else assert.match(header,/К утру вылупится курочка/)
  const token=header.match(/data-action="sleep" data-value="(\d+)"/)?.[1]
  assert.ok(canConfirmRest(p.state,token));assert.equal(canConfirmRest(p.state,String(p.state.day-1)),false)
  assert.equal(canConfirmRest({...p.state,island:'grove'},token),false)
  assert.equal(p.state.flockSize,flock);assert.deepEqual(p.state,before)
  p.act('endDay')
 }
 assert.equal(p.state.flockSize,flock+1);assert.doesNotMatch(bedtime(p.state),/вылупится/i)
})

test('a held key or double-click cannot activate the replacement controls after insertion or navigation',()=>{
 for(const action of ['incubate-egg','visit-rest']){
  const keys=new ActivationKeyGuard(), click=new ActionClickGuard()
  assert.equal(keys.blocks({key:'Enter',repeat:false},isGuardedAction(action)),false)
  assert.equal(keys.blocks({key:'Enter',repeat:true},false),true,'redraw cannot pass held Enter to the next control')
  keys.release('Enter');assert.equal(keys.blocks({key:'Enter',repeat:false},false),false)
  const down={detail:1,timeStamp:100,clientX:20,clientY:20}
  if(isGuardedAction(action))click.remember(down)
  assert.equal(click.blocks({...down,detail:2,timeStamp:190}),true)
  assert.equal(click.blocks({...down,timeStamp:700}),false)
 }
})

test('post-insertion keyboard focus stays on the pending egg route, never Close or Sleep',()=>{
 const from=main.indexOf("  if (focused && panel !== 'bay-freight'")
 const focus=stripTypeScriptTypes(main.slice(from,main.indexOf("\n}\n",from)))
 const routeQuery='.coop-primary [data-action="visit-rest"]', focusedTargets:string[]=[]
 const target=(action:string)=>({dataset:{action},focus:()=>focusedTargets.push(action)})
 const pending=target('visit-rest'),closeButton=target('close')
 for(const [panel,old,expected] of [['coop','incubate-egg','visit-rest'],['coop','feed','close'],['rest','incubate-egg','close']]){
  runInNewContext(focus,{panel,focused:target(old),focusKey:(btn:typeof pending)=>btn.dataset.action,
   focusedSeedCrop:undefined,closeButton,dialogContent:{querySelectorAll:()=>[pending],querySelector:(s:string)=>s===routeQuery?pending:null}})
  assert.equal(focusedTargets.at(-1),expected)
 }
})
