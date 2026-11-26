import assert from 'node:assert/strict'
import test from 'node:test'
import {installActionClickGuard} from '../src/action-click-guard.ts'
import * as F from '../src/farm.ts'
import {getHenTreat,renderHenFriendship,treatHen} from '../src/hen-friendship.ts'
import {chickenCarePlayer} from './fixtures/chicken-care-player.ts'

const hen=4
function firstColdMeet(){
  const p=chickenCarePlayer('orchard','hatchery')
  p.act('feedChickens');p.act('endDay');p.act('collectEggs');p.act('incubateEgg');p.act('endDay');p.act('endDay')
  assert.deepEqual([p.log.length,p.state.day,p.state.flockSize,p.state.produce.carrot,p.state.produce.leafyGreens,p.state.fruit.apple],[26,4,5,0,0,0])
  assert.ok(F.getTreeAction(p.state,0).available)
  assert.deepEqual(F.restoreCurrentFarm(JSON.parse(JSON.stringify(p.state))),p.state)
  return p
}
function markup(f:F.FarmState){
  const raw=renderHenFriendship(f,null,true,hen,name=>`<i class="icon" aria-label="${name}"></i>`)
  const split=raw.split('<details class="hen-friend-notes">')
  assert.equal(split.length,2)
  return {visible:split[0],notes:split[1],count:(raw.match(/class="hen-treats"/g)??[]).length}
}
function treats(area:string){
  return [...area.matchAll(/<button\b([^>]*data-action="hen-treat"[^>]*)>/g)].map(([,tag])=>({
    choice:tag.match(/data-value="([^"]+)"/)?.[1],disabled:/\sdisabled(?:\s|$)/.test(tag),name:tag.match(/aria-label="([^"]+)"/)?.[1],
  }))
}

test('earned first meeting: the three empty inspection cards are under existing notes, and the real Pet action stays visible',()=>{
  const farm=firstColdMeet().state,before=structuredClone(farm),view=markup(farm)
  assert.equal(view.count,1,'the game keeps exactly one copy of the inspectable choices')
  assert.equal(treats(view.visible).length,0)
  assert.equal((view.visible.match(/data-action="hen-friend-select"/g)??[]).length,5)
  assert.match(view.visible,/data-action="pet" data-value="4">Погладить/)
  assert.match(view.notes,/<summary>Характер и правила<\/summary>/)
  assert.match(view.notes,/Радуется запаху свежих садовых фруктов/)
  assert.deepEqual(treats(view.notes),[
    {choice:'4:carrot',disabled:true,name:'Угостить: Морковь ×1 · в запасе 0'},
    {choice:'4:leafyGreens',disabled:true,name:'Угостить: Зелень ×1 · в запасе 0'},
    {choice:'4:apple',disabled:true,name:'Угостить: Яблоко ×1 · в запасе 0'},
  ])
  assert.ok(view.visible.includes('<h3 id="hen-treat-heading">Угостить</h3>'))
  assert.match(view.notes,/aria-labelledby="hen-treat-heading"/)
  assert.equal(treatHen(farm,hen,'apple').ok,false)
  assert.deepEqual(farm,before,'looking or stale attempts cannot spend, feed or hatch')
})

test('one normal apple harvest restores the existing direct treat action and its choices, with no automatic spend',()=>{
  const p=firstColdMeet()
  p.act('petChicken',hen)
  const met=structuredClone(p.state.henFriendship.hens[hen]);assert.equal(met.points,1)
  p.act('pickFruit',0)
  const farm=p.state,before=structuredClone(farm),view=markup(farm)
  assert.equal(view.count,1)
  assert.deepEqual(treats(view.visible).map(x=>[x.choice,x.disabled]),[['4:carrot',true],['4:leafyGreens',true],['4:apple',false]])
  assert.equal(treats(view.notes).length,0)
  assert.match(view.visible,/Радуется запаху свежих садовых фруктов/)
  assert.match(view.visible,/aria-describedby="hen-treat-hint"/)
  assert.ok(getHenTreat(farm,hen,'apple').available)
  assert.deepEqual(farm.henFriendship.hens[hen],met,'returning with stock does not reset acquaintance')
  assert.ok(farm.pettedChickens.includes(hen))
  assert.deepEqual(farm,before)
  assert.ok(treatHen(farm,hen,'apple').ok)
  assert.equal(farm.fruit.apple,before.fruit.apple-1)
  assert.deepEqual(farm.henFriendship.hens[hen],{points:3,treatedOn:4,tasted:['apple']})
  const after=markup(farm)
  assert.match(after.visible,/Сегодня уже угощали/)
  assert.equal(treats(after.visible).length,0)
  assert.equal(treats(after.notes).length,3)
  assert.deepEqual(F.restoreCurrentFarm(JSON.parse(JSON.stringify(farm))),farm)
})

test('the existing native summary remains keyboard reachable and neither Enter nor Space is stolen by action guarding',()=>{
  const farm=firstColdMeet().state,before=structuredClone(farm),view=markup(farm)
  assert.match(view.notes,/^<summary>Характер и правила<\/summary>/,'real first summary element, no disabled/tabindex override')
  // Frontend action interception only: the browser's native disclosure behavior is not simulated here.
  const old=globalThis.Element
  const handlers=new Map<string,(event:unknown)=>void>()
  class NativeSummaryLike{closest(_selector:string){return null}}
  Object.assign(globalThis,{Element:NativeSummaryLike})
  const target=new NativeSummaryLike()
  const root={addEventListener(){},contains:(x:unknown)=>x===target,ownerDocument:{
    addEventListener:(type:string,action:(event:unknown)=>void)=>handlers.set(type,action),
  }}
  try{
    installActionClickGuard(root as unknown as HTMLElement)
    for(const key of ['Tab','Enter',' ']){
      let intercepted=false
      handlers.get('keydown')!({target,key,repeat:false,preventDefault(){intercepted=true},stopImmediatePropagation(){intercepted=true}})
      assert.equal(intercepted,false)
      handlers.get('keyup')!({key})
    }
  }finally{Object.assign(globalThis,{Element:old})}
  assert.deepEqual(farm,before)
})
