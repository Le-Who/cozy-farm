import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { runInNewContext } from 'node:vm'
import * as F from '../src/farm.ts'
import { commissionPlayer } from './fixtures/commission-player.ts'

function pending() {
  const opening = JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json', import.meta.url), 'utf8'))
  const p = commissionPlayer(opening)
  p.visit('home'); p.act('pickFruit', 0); p.visit('grove'); p.act('pickFruit', 0); p.visit('village')
  const meal = p.act('completeSignature', { base:'preserves', ingredients:[{id:'apple',quantity:1},{id:'pear',quantity:1}] },
    { family:'preserves', processing:'bright', fruit:[{ingredientId:'apple',x:0,y:0,angle:0}], steps:['fruit','stir','jar'] })
  p.act('runResidentService', 'finn'); p.act('useSignature', meal.recipeId)
  p.visit('grove'); p.act('beginFishingTrip')
  assert.deepEqual([p.state.day,p.actions,p.state.coins,p.state.pendingFishingTrip?.config.capacity,p.state.culinary.stock[meal.recipeId]],[14,117,68,4,0])
  p.visit('home')
  assert.equal(p.state.village.scouting,false);assert.equal(p.state.culinary.picnic,null)
  return p.state
}
const copy = (f:F.FarmState) => {
  const restored=F.restoreCurrentFarm(JSON.parse(JSON.stringify(f)));assert.ok(restored);return restored
}

test('Home cannot silently replace the four-slot Grove cast after a genuine cold resume', () => {
  const farm = pending(), before = structuredClone(farm), token = farm.pendingFishingTrip!.token
  assert.equal(F.getFishAction(farm).available, true, 'the local shore itself is not exhausted')
  assert.equal(F.beginFishingTrip(farm).ok, false, 'an ordinary local cast must not abandon the trip')
  assert.deepEqual(farm,before)
  assert.ok(F.sail(farm,'grove').ok)
  assert.deepEqual(F.getResumableFishingTrip(copy(farm)),before.pendingFishingTrip)
  const cancelled = copy(before)
  assert.equal(F.cancelFishingTrip(cancelled,token+1).ok,false)
  assert.deepEqual(cancelled,before)
  assert.ok(F.cancelFishingTrip(cancelled,token).ok)
  assert.deepEqual(cancelled,{...before,pendingFishingTrip:null},'explicit abandonment refunds nothing and never starts another cast')
  const next = F.beginFishingTrip(cancelled)
  assert.ok(next.ok);assert.deepEqual([next.token,next.config?.capacity,cancelled.pendingFishingTrip?.island],[token+1,2,'home'])
})

// Exercise the existing draw/dispatch interface; only renderer, DOM and storage surfaces are test doubles.
const main = readFileSync(new URL('../src/main.ts', import.meta.url),'utf8')
function readSection(a:string,b:string) {
  const i=main.indexOf(a),j=main.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,a);return main.slice(i,j)
}
function view(farm:F.FarmState) {
  const panel='fishing', dialog={open:true}, dialogContent={innerHTML:''}
  const calls:string[]=[], rows:{label:string;action:string;value?:number;enabled:boolean}[]=[]
  const before=structuredClone(farm)
  const env={...F,farm,panel,dialog,dialogContent,value:undefined as string | undefined,
    nav:(...items:string[])=>items.join(' | '),
    button(label:string, action:string, enabled:boolean, options:{value?:number}){rows.push({label,action,enabled,value:options.value});return label},
    mountFishing(){calls.push('mount')}, renderFishingPracticeEntry(){return ''}, groveDockActions(){return ''},
    async visitPanelAt(shore:F.IslandId, next:string){calls.push('travel:'+shore+':'+next);assert.ok(F.sail(farm,shore).ok)},
    perform(action:()=>F.ActionResult,_dismiss=false){const r=action();if(r.ok)calls.push('save');return r.ok},
    closeDialog(){dialog.open=false;calls.push('close')},
  }
  runInNewContext(stripTypeScriptTypes("switch(panel){"+readSection("    case 'fishing': {","    case 'boat': {")+'}'),env)
  assert.deepEqual(farm,before,'showing the choice is read-only')
  const choose = async (action:string, value:string) => {
    env.value=value
    const from=main.indexOf("    case 'fishing-resume-shore':")
    if(from<0) return // stock initially has no such choice; the visible assertions fail above
    await runInNewContext(stripTypeScriptTypes("(async()=>{switch(action){"+readSection("    case 'fishing-resume-shore':","    case 'visit-pier':")+'}})()'),{...env,action})
  }
  return {rows,calls,dialog,choose,text:dialogContent.innerHTML}
}

test('the existing fishing panel offers a return to the original shore, not an unlabelled fresh cast',async()=>{
  const farm=pending(), before=structuredClone(farm), token=String(farm.pendingFishingTrip!.token), rendered=view(farm)
  assert.deepEqual(rendered.calls,[],'another shore with a pending cast shows action choices, not a ready-to-cast scene')
  assert.deepEqual(rendered.rows.map(({action,enabled})=>[action,enabled]),[['fishing-resume-shore',true],['fishing-abandon-shore',true]])
  assert.match(rendered.text,/В рощу · продолжить/)
  assert.match(rendered.text,/Прервать рыбалку в роще/)
  await rendered.choose('fishing-resume-shore',String(Number(token)+1))
  await rendered.choose('fishing-abandon-shore',String(Number(token)+1))
  assert.deepEqual(rendered.calls,[]);assert.deepEqual(farm,before)
  await rendered.choose('fishing-resume-shore',token)
  assert.deepEqual(rendered.calls,['travel:grove:fishing'])
  assert.deepEqual(farm,{...before,island:'grove'});assert.equal(F.getResumableFishingTrip(farm)?.config.capacity,4)
})

test('the separate abandonment action closes review and never also mounts or activates a cast',async()=>{
  const farm=pending(), before=structuredClone(farm), token=String(farm.pendingFishingTrip!.token), rendered=view(farm)
  assert.deepEqual(rendered.calls,[])
  await rendered.choose('fishing-abandon-shore',token)
  await rendered.choose('fishing-abandon-shore',token)
  await rendered.choose('fishing-resume-shore',token)
  assert.deepEqual(rendered.calls,['save','close']);assert.equal(rendered.dialog.open,false)
  assert.deepEqual(farm,{...before,pendingFishingTrip:null})
  assert.deepEqual(view(farm).calls,['mount'],'only opening an ordinary fishing preview again mounts a fresh cast')
})
