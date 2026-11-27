import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import test from 'node:test'
import {runInNewContext} from 'node:vm'
import * as F from '../src/farm.ts'
import * as Hen from '../src/hen-friendship.ts'
import {henCareResultFocus} from '../src/hen-care-focus.ts'
import {inviteNeighborVisit,finishNeighborVisit} from '../src/neighbor-visits.ts'
import {renderNeighborVisits} from '../src/neighbor-visits-ui.ts'
import {commissionPlayer} from './fixtures/commission-player.ts'

const read=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8')
const main=read('../src/main.ts'), intro='visit-introduce-hen', hen=4
const start=main.indexOf("    case 'visit-introduce-hen': {"),end=main.indexOf("    case 'visit-find-tree': {",start)
assert.ok(start>=0&&end>start)
const handler=stripTypeScriptTypes('switch(action){'+main.slice(start,end)+'}')
const opening=JSON.parse(read('./fixtures/market-order-selection-commands.json')).slice(0,-1)
function newHen(){
 const p=commissionPlayer(opening)
 assert.deepEqual([p.actions,p.state.day,p.state.coins,p.state.eggs,p.state.neighbors.bea.completed,p.state.island],[118,14,99,3,1,'home'])
 p.act('specializeFacility','hatchery');p.act('incubateEgg');p.night();p.night()
 assert.deepEqual([p.actions,p.state.day,p.state.coins,p.state.eggs,p.state.flockSize,p.state.henFriendship.hens[hen].points],[122,16,69,2,5,0])
 return p.state
}
function reload(f:F.FarmState) {
 const restored=F.restoreCurrentFarm(JSON.parse(JSON.stringify(f)))
 assert.deepEqual(restored,f);return restored!
}
const button=(html:string,action:string,value?:string)=>[...html.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)]
 .map(([tag])=>tag).find(tag=>tag.includes('data-action="'+action+'"')&&(value===undefined||tag.includes('data-value="'+value+'"')))
const card=(f:F.FarmState,id=hen)=>Hen.renderHenFriendship(f,null,true,id)
const press=(f:F.FarmState,value:string,{selected=hen,panel='hen-friendship',open=true,attached=true}={})=>{
 let commits=0
 const control={}
 runInNewContext(handler,{...F,...Hen,action:intro,value,control,selectedFriendHen:selected,farm:f,panel,dialog:{open},
  dialogContent:{contains:(c:unknown)=>attached&&c===control},
  perform(fn:()=>F.ActionResult){const r=fn();if(r.ok)commits++;return r.ok}
 })
 return commits
}
const invite=(f:F.FarmState)=>assert.ok(inviteNeighborVisit(f,'beaFlock').ok)
const finish=(f:F.FarmState)=>assert.ok(finishNeighborVisit(f,f.neighborVisits.serial).ok)
const named='1:4'

test('earned D16: a petted Пуговка can still meet Bea on her own card, exactly as in the guest book',()=>{
 const f=newHen();assert.ok(F.petChicken(f,hen).ok);invite(f)
 const view=reload(f),guestBook=reload(f),html=card(view),entry=button(html,intro,named)
 assert.ok(entry,'the care slot should offer the existing introduction instead of only a disabled Pet')
 assert.match(entry,/>Познакомить с Беа<\/button>/);assert.doesNotMatch(entry,/ disabled/)
 assert.equal((html.match(/data-action="visit-introduce-hen"/g)??[]).length,1)
 assert.equal(button(html,'pet','4'),undefined,'same slot, not two competing actions')
 assert.deepEqual(view,f,'reading the card does not accept any visit step')
 assert.ok(button(renderNeighborVisits(guestBook,()=>''),intro,named))
 assert.equal(press(guestBook,named,{panel:'neighbor-visits'}),1)
 assert.equal(press(view,named),1)
 assert.deepEqual(view,guestBook,'one identical canonical introduction, not a second pet/payment/travel')
 assert.equal(view.neighborVisits.memories.length,1);assert.equal(view.neighborVisits.memories[0].subject,'Пуговка')
 for(const k of Object.keys(f) as Array<keyof F.FarmState>)if(k!=='neighborVisits')assert.deepEqual(view[k],f[k],k)
 assert.equal(view.henFriendship.hens[hen].points,1);assert.equal(F.petChicken(view,hen).ok,false)
 assert.match(button(card(view),'pet','4')??'',/disabled>Сегодня поглажена/)
 assert.equal(button(card(view),intro),undefined)
 const recorded=reload(view);assert.equal(press(view,named),0);assert.deepEqual(view,recorded)
 const progress={tabIndex:0,classList:{add(s:string){assert.equal(s,'hen-care-focus')}}}
 const root={querySelector(s:string){return s==='.hen-friend-select[aria-pressed="true"]'?{dataset:{value:'4'}}:s==='.hen-friend-progress progress'?progress:null}}
 assert.equal(henCareResultFocus(root as unknown as HTMLElement,{dataset:{action:intro,value:named}} as unknown as HTMLButtonElement),progress)
 assert.equal(progress.tabIndex,-1)
})

test('ordinary Pet stays available; stale, unrelated or ending visits do not acquire another action',()=>{
 const first=newHen()
 assert.match(button(card(first),'pet','4')??'',/>Погладить · \+1</);assert.equal(button(card(first),intro),undefined)
 const guestFirst=reload(first);invite(guestFirst)
 assert.match(button(card(guestFirst),'pet','4')??'',/>Погладить · \+1</);assert.equal(button(card(guestFirst),intro),undefined)
 const noPet=reload(guestFirst);assert.equal(press(guestFirst,named),0);assert.deepEqual(noPet,guestFirst)
 assert.ok(F.petChicken(guestFirst,hen).ok);assert.equal(guestFirst.neighborVisits.memories[0].subject,'Пуговка')
 assert.equal(button(card(guestFirst),intro),undefined)
 const petted=reload(first);assert.ok(F.petChicken(petted,hen).ok)
 assert.match(button(card(petted),'pet','4')??'',/disabled>Сегодня поглажена/);assert.equal(button(card(petted),intro),undefined)
 const unrelated=reload(petted);assert.ok(inviteNeighborVisit(unrelated,'beaHarvest').ok)
 assert.match(button(card(unrelated),'pet','4')??'',/disabled>Сегодня поглажена/);assert.equal(button(card(unrelated),intro),undefined)
 const live=reload(petted);invite(live);const before=reload(live)
 for(const args of [{selected:3},{panel:'coop'},{open:false},{attached:false}])assert.equal(press(live,named,args),0)
 assert.equal(press(live,'1:0'),0);assert.equal(press(live,'2:4'),0);assert.deepEqual(live,before)
 finish(live);invite(live)
 const nextGuest=reload(live)
 assert.equal(press(live,named),0);assert.deepEqual(live,nextGuest)
 assert.ok(button(card(live),intro,'2:4'))
 assert.ok(F.endDay(live).ok);assert.equal(button(card(live),intro),undefined)
 const afterRest=reload(live);assert.equal(press(live,'2:4'),0);assert.deepEqual(live,afterRest)
})
