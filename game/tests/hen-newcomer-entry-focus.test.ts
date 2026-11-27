import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import {runInNewContext} from 'node:vm'
import test from 'node:test'
import {canIntroduceHenToVisitor,introduceHenToVisitor,petChicken,restoreCurrentFarm,type FarmState} from '../src/farm.ts'
import {getIncubatorNewHen,renderCoopPanel} from '../src/coop-panel.ts'
import {henFriends,renderHenFriendship} from '../src/hen-friendship.ts'
import {chickenCarePlayer} from './fixtures/chicken-care-player.ts'

const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
function exact(a:string,b:string){
 const i=main.indexOf(a),j=main.indexOf(b,i+1);assert.ok(i>=0&&j>i,[a,b]);return main.slice(i,j)
}
const commands=stripTypeScriptTypes(
 exact('function button(','function quantity(')+exact('function row(','function nav(')
 +exact('function focusKey(','// The route key')
 + "function initialFocus(next,entry){"+exact("  const sceneEntry = next === 'bay-shop'","\n}\n\nfunction openRecipeBook(")+"}\n"
 + "function openMeet(){switch('hen-friendship-open'){"+exact("    case 'hen-friendship-open':","    case 'hen-treat':")+"}}\n"
 + "function petFromCard(value){switch('pet'){"+exact("    case 'pet': activateTarget(","    case 'gather-salt':")+"}}\n"
 + "function petHen(target,henGesture='stroke'){switch(target.kind){"+exact("    case 'hen': {","    case 'salt':")+"}}")
const cold=(f:FarmState)=>{const g=restoreCurrentFarm(JSON.parse(JSON.stringify(f)));assert.deepEqual(g,f);return g!}
function earnedHatch() {
 const p=chickenCarePlayer('orchard','hatchery')
 p.act('feedChickens');p.act('endDay');p.act('collectEggs');p.act('incubateEgg')
 assert.deepEqual([p.state.day,p.state.hatchDay,p.state.eggs,p.state.flockSize],[2,4,3,4])
 const pending=cold(p.state)
 p.act('endDay');p.act('endDay')
 assert.deepEqual([p.log.length,p.state.day,p.state.coins,p.state.eggs,p.state.flockSize,p.state.henFriendship.hens[4].points],[26,4,74,3,5,0])
 return {farm:cold(p.state),pending}
}
function screen(farm:FarmState,{named=true,present=true,headingRendered=true}={}){
 let markup='',panelCalls=0,writes=0,draws=0,active=''
 const checked:unknown[]=[]
 const heading={tabIndex:undefined as number|undefined,getClientRects:()=>headingRendered?[{}]:[],
  focus(opts:unknown){assert.deepEqual(Object.entries(opts as object),[['preventScroll',true]]);active='heading'}}
 const closeButton={focus(){active='close'}}
 const ctx:any={farm,panel:'coop',dialog:{open:true},selectedFriendHen:2,closeButton,
  control:{dataset:{action:'hen-friendship-open'},closest:(s:string)=>s==='.coop-incubator-new-hen'&&named},getIncubatorNewHen,
  dialogContent:{contains:()=>present,querySelector(s:string){checked.push(s);return headingRendered&&s.includes('hen-friend')&&/<h2>Пуговка<\/h2>/.test(markup)?heading:null}},
  openPanel(next:string,_remember=true,_port:string,_cue:string,_recipe?:string,entry?:unknown){
   assert.equal(next,'hen-friendship');panelCalls++
   markup=renderHenFriendship(farm,null,true,ctx.selectedFriendHen)
   ctx.initialFocus(next,entry)
  },drawPanel(){draws++},activateTarget(target:unknown){ctx.petHen(target)},henFriends,canIntroduceHenToVisitor,introduceHenToVisitor,petChicken,
  perform(fn:()=>ReturnType<typeof petChicken>){assert.ok(fn().ok);writes++;return true},notify(){},playBaySound(){},
  icon:()=>'',itemIcon:()=>'',numberFormat:new Intl.NumberFormat('ru'),
 }
 runInNewContext(commands,ctx)
 const coop=()=>renderCoopPanel(farm,{icon:ctx.icon,row:ctx.row,button:ctx.button,feedRow:()=>''})
 // Use emitted button order, including disabled/hidden semantics; no virtual pointer.
 const stops=()=>[...markup.matchAll(/<h2>Пуговка<\/h2>|<button\b[^>]*>/g)].flatMap(([tag])=>{
  if(tag.startsWith('<h2>'))return ['heading']
  if(/\bdisabled\b|\bhidden\b/.test(tag))return []
  const action=tag.match(/data-action="([^"]+)"/)?.[1],value=tag.match(/data-value="([^"]+)"/)?.[1]
  return action?[action+':'+value]:[]
 })
 return {ctx,heading,coop,stops,checked,get markup(){return markup},get active(){return active},get calls(){return panelCalls},get writes(){return writes},get draws(){return draws}}
}
test('cold earned D4 named Meet anchors at the selected hen name before any actual care',()=>{
 const {farm,pending}=earnedHatch(), before=structuredClone(farm)
 const early=screen(pending),view=screen(farm)
 const named='aria-label="Познакомиться, с Пуговкой"'
 assert.ok(!early.coop().includes(named));assert.ok(view.coop().includes(named))
 view.ctx.openMeet()
 assert.equal(view.ctx.selectedFriendHen,4);assert.equal(view.active,'heading')
 assert.equal(view.heading.tabIndex,-1,'programmatic landing only, not an extra tab stop')
 assert.deepEqual(view.stops().slice(0,7),[
  ...[0,1,2,3,4].map(i=>'hen-friend-select:'+i),'heading','pet:4',
 ],'reading order leaves the roster behind (Shift+Tab) and Pet ahead (Tab)')
 assert.equal(view.calls,1);assert.equal(view.writes,0);assert.deepEqual(farm,before)
 view.ctx.petFromCard('4')
 assert.deepEqual([view.writes,farm.henFriendship.hens[4].points,farm.pettedChickens.includes(4)],[1,1,true])
 assert.deepEqual(farm.henFriendship.hens.slice(0,4),before.henFriendship.hens.slice(0,4))
 assert.deepEqual([farm.coins,farm.fruit,farm.produce,farm.eggs],[before.coins,before.fruit,before.produce,before.eggs])
 assert.equal(cold(farm).henFriendship.hens[4].points,1)
 const generic=screen(farm,{named:false})
 assert.equal(generic.ctx.focusKey(view.ctx.control),generic.ctx.focusKey(generic.ctx.control),'existing Back key survives named-to-generic return')
})
test('ordinary selected hen, stale button, non-Home and absent heading retain normal focus or no-op',()=>{
 const {farm,pending}=earnedHatch(),before=structuredClone(farm)
 for(const [state,opts,wanted] of [
  [farm,{named:false},{calls:1,active:'close',selected:2,draws:0}],
  [farm,{headingRendered:false},{calls:1,active:'close',selected:4,draws:0}],
  [farm,{present:false},{calls:0,active:'',selected:2,draws:0}],
  [pending,{},{calls:0,active:'',selected:2,draws:1}],
  [{...farm,island:'grove' as const},{},{calls:0,active:'',selected:2,draws:0}],
 ] as const){
  const view=screen(state,opts)
  view.ctx.openMeet()
  assert.deepEqual({calls:view.calls,active:view.active,selected:view.ctx.selectedFriendHen,draws:view.draws},wanted)
  assert.equal(view.writes,0)
  if('named' in opts)assert.deepEqual(view.checked,[],'normal care-chooser entry is unchanged')
 }
 assert.deepEqual(farm,before)
})
