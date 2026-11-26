import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import {runInNewContext} from 'node:vm'
import * as F from '../src/farm.ts'
import {henCareResultFocus} from '../src/hen-care-focus.ts'
import {henFriends,renderHenFriendship,treatHen} from '../src/hen-friendship.ts'
import {chickenCarePlayer} from './fixtures/chicken-care-player.ts'

const source=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
const start=source.indexOf("    case 'hen-treat': {"), end=source.indexOf("    case 'chicken-feed-open':",start)
assert.ok(start>=0&&end>start)
const dispatched=stripTypeScriptTypes(`switch('hen-treat'){${source.slice(start,end)}}`)
function split(html:string) {
 const marker='<details class="hen-friend-notes">'
 const parts=html.split(marker);assert.equal(parts.length,2)
 const [visible,details]=parts
 return {visible,details,groups:(html.match(/class="hen-treats"/g)??[]).length}
}
function buttons(html:string) {
 return [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].flatMap(([,a,b])=>{
  if(/\shidden(?:\s|$)/.test(a))return []
  return [{action:a.match(/data-action="([^"]+)"/)?.[1], key:a.match(/data-value="([^"]+)"/)?.[1],
    label:a.match(/aria-label="([^"]+)"/)?.[1], disabled:/\sdisabled(?:\s|$)/.test(a),text:b.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()}]
 })
}
function visibleWords(main:string) {
 return main.replace(/<button[^>]+\bhidden(?:\s|>)[\s\S]*?<\/button>/g,' ').replace(/<[^>]+>/g,' ').trim().split(/\s+/).length
}
test('earned Пуговка keeps the live Walk and memory first after the one treat, with old stock cards in existing notes until tomorrow',t=>{
 const p=chickenCarePlayer('garden','hatchery')
 for(let i=0;i<3;i++){p.day();p.act('endDay')}
 assert.deepEqual([p.log.length,p.state.day,p.state.flockSize,p.state.hatchDay],[67,4,5,null])
 p.act('petChicken',4)
 const f0=p.state
 assert.deepEqual([f0.henFriendship.hens[4].points,f0.produce.carrot,f0.fruit.apple],[1,1,0])
 const noApple=split(renderHenFriendship(f0,null,true,4))
 assert.deepEqual(buttons(noApple.visible).filter(b=>b.action==='hen-treat'&&!b.disabled).map(b=>b.key),['4:carrot'])
 p.act('pickFruit',0)
 const farm=p.state;const a=structuredClone(farm),old=split(renderHenFriendship(farm,null,true,4))
 const options=buttons(old.visible).filter(b=>b.action==='hen-treat')
 assert.equal(options.length,3);assert.equal(options.filter(b=>!b.disabled).length,2)
 assert.match(old.visible,/Радуется запаху свежих садовых фруктов\./)
 let writes=0, success=false
 runInNewContext(dispatched,{farm,panel:'hen-friendship',dialog:{open:true},value:'4:apple',treatHen,
  perform(fn:()=>F.ActionResult){success=fn().ok;if(success)writes++;return success}})
 assert.ok(success&&writes===1);assert.equal(p.log.length+1,70)
 a.fruit.apple--;a.henFriendship.hens[4]={points:3,treatedOn:farm.day,tasted:['apple']}
 assert.deepEqual(farm,a);assert.deepEqual(F.restoreCurrentFarm(structuredClone(farm)),farm)
 const saved=structuredClone(farm)
 const done=split(renderHenFriendship(farm,null,true,4))
 assert.match(done.visible,/Сегодня уже угощали · снова после отдыха\./)
 assert.deepEqual(buttons(done.visible).filter(b=>b.action==='hen-treat'),[])
 assert.equal(done.groups,1)
 assert.equal(buttons(done.visible).length,7);assert.equal(visibleWords(done.visible),29)
 const after=buttons(done.details).filter(b=>b.action==='hen-treat')
 assert.deepEqual(after.map(b=>b.key),options.map(b=>b.key))
 assert.equal(after.filter(b=>b.disabled).length,3)
 assert.match(after.at(-1)?.label??'',/^Угостить: Яблоко ×1 · в запасе 1 · любимое$/)
 assert.match(after.at(-1)?.text??'',/^Яблоко ×1 В запасе 1 Любимое$/)
 assert.ok(buttons(done.visible).some(b=>b.action==='hen-walk-start'&&!b.disabled))
 assert.equal(buttons(done.visible).filter(b=>b.action==='hen-friend-select').length,5)
 assert.match(done.details,/<summary>Характер и правила<\/summary>/)
 assert.ok(done.details.indexOf(henFriends[4].memories[0])>=0&&done.details.indexOf(henFriends[4].memories[0])<done.details.indexOf('class="hen-treats"'))
 assert.doesNotMatch(done.details,/aria-describedby="hen-treat-hint"/)
 // Real focus policy works even if the previous action is in a closed or open
 // disclosure. It points only at the same neutral result; no native-browser claim.
 const progress={tabIndex:0,classList:{add(name:string){assert.equal(name,'hen-care-focus')}}}
 const previous={disabled:false,dataset:{action:'hen-treat',value:'4:apple'}} as HTMLButtonElement
 for(const open of [false,true,false]){
  const notes={open,summary:'Характер и правила'}
  const root={querySelector(query:string) {
   if(query==='.hen-friend-select[aria-pressed="true"]')return {dataset:{value:'4'}}
   if(query==='.hen-friend-progress progress')return progress
   if(query==='button[data-action="hen-treat"][data-value="4:apple"]')return after.at(-1)
   return null
  }} as unknown as HTMLElement
  assert.equal(henCareResultFocus(root,previous),progress);assert.equal(progress.tabIndex,-1)
  assert.deepEqual(notes,{open,summary:'Характер и правила'})
  assert.deepEqual(farm,saved)
 }
 const other=split(renderHenFriendship(farm,null,true,0))
 assert.equal(buttons(other.visible).filter(b=>b.action==='hen-treat').length,3)
 assert.equal(buttons(other.details).filter(b=>b.action==='hen-treat').length,0)
 assert.deepEqual(farm,saved,'browsing, other hens, and reading notes cannot spend, hatch, collect or feed')
 p.act('endDay')
 const refreshed=split(renderHenFriendship(p.state,null,true,4))
 assert.equal(buttons(refreshed.visible).filter(b=>b.action==='hen-treat').length,3)
 assert.equal(buttons(refreshed.visible).filter(b=>b.action==='hen-treat'&&!b.disabled).length,2)
 assert.equal(buttons(refreshed.details).filter(b=>b.action==='hen-treat').length,0)
 t.diagnostic(JSON.stringify({day:4,publicActions:70,main:7,visibleWords:29,disabledInspectable:3,live:'Погулять вместе',tomorrowReady:2,writes}))
})
