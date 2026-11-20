import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { runInNewContext } from 'node:vm'
import { commissionPlayer } from './fixtures/commission-player.ts'
import { getBedHarvestPreview, restoreCurrentFarm, transplantCrop, workBed } from '../src/farm.ts'
import { inviteNeighborVisit, finishNeighborVisit } from '../src/neighbor-visits.ts'
import { renderNeighborVisits } from '../src/neighbor-visits-ui.ts'
import { guideHomeVisitor, stepHomeVisitor, syncHomeVisitor } from '../src/neighbor-visit-scene.ts'
import { showStandingVisitCrop, standingVisitCrop } from '../src/standing-crop-visit.ts'

const read=(name:string)=>readFileSync(new URL(name,import.meta.url),'utf8')
const opening=JSON.parse(read('./fixtures/market-order-selection-commands.json'))
const main=read('../src/main.ts'), islandSource=read('../src/island.ts'), layout=read('../src/lavender-layout.ts')
const showCase=main.slice(main.indexOf("    case 'visit-show-crop':"),main.indexOf("    case 'visit-do':"))
const guideMethod=islandSource.slice(islandSource.indexOf('    guideHomeVisitorToBed('),islandSource.indexOf('    focusTarget(target:'))
const sceneCoords=layout.slice(layout.indexOf('const origin ='),layout.indexOf('function sceneBox')).replaceAll('export ','')
const plots=layout.slice(layout.indexOf('const plotColumns ='),layout.indexOf('})));',layout.indexOf('export const plots'))+5).replace('export ','')
const toNative=islandSource.slice(islandSource.indexOf('const sceneOrigin='),islandSource.indexOf('const WORK_MS'))
const selectable=(html:string)=>html.match(/data-action="visit-show-crop" data-value="([^"]+)"[^>]*>([^<]+)<\/button>/)

test('Bea walks to the earned standing star carrot; showing, returning and a real later pick keep their separate effects',()=>{
  const f=commissionPlayer(opening).state
  assert.equal(f.day,15);assert.equal(f.neighbors.bea.completed,1);assert.ok(inviteNeighborVisit(f,'beaHarvest').ok)
  const before=structuredClone(f),crop=standingVisitCrop(f)!
  assert.equal(crop.index,1);assert.equal(crop.name,'Звёздная морковь')
  const html=renderNeighborVisits(f,()=>''),shown=selectable(html)!
  assert.equal(shown[1],crop.token);assert.equal(shown[2],'Показать на грядке · Звёздная морковь')
  assert.match(html,/data-action="visit-do"[^>]+>К зрелой грядке/);assert.deepEqual(f,before)
  const actor=syncHomeVisitor(undefined,f)!,focused:number[]=[],saves:string[]=[],dialog={open:true}
  // Feed real plot contact geometry and the actual island guidance method to the visitor walker.
  const island=runInNewContext(stripTypeScriptTypes(sceneCoords+plots+toNative+';({'+guideMethod+'})'),{state:f,homeVisitor:actor,guideHomeVisitor})
  island.focusTarget=(target:{kind:string;index:number})=>{assert.equal(target.kind,'bed');focused.push(target.index)}
  runInNewContext('switch(action){'+showCase+'}',{action:'visit-show-crop',panel:'neighbor-visits',farm:f,value:shown[1],standingVisitCrop,showStandingVisitCrop,dialog,
    perform:(work:()=>{ok:boolean})=>{assert.ok(work().ok);saves.push('saved');return true},closeDialog:()=>{dialog.open=false},fieldViewButton:{getAttribute:()=>'false'},island})
  assert.deepEqual(focused,[1]);assert.deepEqual(saves,['saved']);assert.equal(dialog.open,false)
  for(let i=0;i<1000&&actor.route.length;i++)stepHomeVisitor(actor,.05,false)
  assert.equal(actor.route.length,0);assert.deepEqual(actor.point,{x:769,y:475}) // aisle, clear of the player's picking stop (745,475)
  const memory=structuredClone(f.neighborVisits.memories[0]);assert.equal(memory.detail,'Звёздная морковь на грядке №2. Урожай не срывали.')
  assert.deepEqual({...f,neighborVisits:before.neighborVisits},before);assert.deepEqual(restoreCurrentFarm(structuredClone(f)),f)
  assert.equal(selectable(renderNeighborVisits(f,()=>'')),null);const after=structuredClone(f)
  assert.equal(showStandingVisitCrop(f,crop.token).ok,false);assert.deepEqual(f,after)
  assert.ok(finishNeighborVisit(f,f.neighborVisits.serial,'curious').ok);assert.ok(inviteNeighborVisit(f,'beaHarvest').ok)
  const next=standingVisitCrop(f)!;assert.notEqual(next.token,crop.token)
  assert.deepEqual(getBedHarvestPreview(f,1),{crop:'carrot',total:3,ordinary:2,special:1,trait:'star',picnicBonus:0})
  const carrots=f.produce.carrot,stars=f.variants.carrot?.star??0
  assert.ok(workBed(f,1).ok);assert.equal(f.produce.carrot,carrots+2);assert.equal(f.variants.carrot?.star,stars+1);assert.equal(f.beds[1].kind,'tilled')
  assert.equal(f.neighborVisits.active?.observation?.detail,'Звёздная морковь');assert.equal(f.neighborVisits.memories.length,1)
  assert.deepEqual(f.neighborVisits.memories[0],{...memory,reply:'curious'})
  const picked=structuredClone(f);assert.equal(showStandingVisitCrop(f,next.token).ok,false);assert.deepEqual(f,picked)
})

test('an old destination never silently shows the replacement plant or observation',()=>{
  const f=commissionPlayer(opening).state;assert.ok(inviteNeighborVisit(f,'beaHarvest').ok)
  const old=standingVisitCrop(f)!
  assert.ok(transplantCrop(f,old.index,0).ok);assert.equal(f.neighborVisits.active?.observation,null)
  assert.notEqual(standingVisitCrop(f)?.index,old.index)
  const before=structuredClone(f);assert.equal(showStandingVisitCrop(f,old.token).ok,false);assert.deepEqual(f,before)
})
